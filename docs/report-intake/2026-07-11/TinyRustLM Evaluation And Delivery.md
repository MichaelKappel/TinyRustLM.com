# **TinyRustLM Promotion and Delivery Architecture: A No-Cheat Evaluation and Browser-Native Reliability Framework**

## **The Definition of Good Quality with a Reasonable Local Footprint**

Deploying local machine intelligence directly within a browser environment necessitates a rigorous architectural departure from traditional cloud-based inference models. In standard server-side paradigms, compute, memory, and storage are highly elastic, allowing engineers to compensate for inefficient model architectures with brute-force hardware scaling. In contrast, local edge and browser environments are strictly bounded by physical hardware constraints, WebAssembly (WASM) allocation ceilings, and specific browser storage API quotas. A successful deployment requires an explicit, requirement-by-requirement definition of "good quality with a reasonable local footprint." This definition must be evaluated deterministically, without ever relying on hidden server-side execution or cloud API fallbacks.  
The first requirement for a reasonable footprint is strict adherence to deterministic memory boundaries. The browser runtime must respect predefined memory envelopes, specifically the 128 MiB single-transfer allocation limit for raw WASM Application Binary Interface (ABI) buffers, without forcing main-thread browser freezing1. Models that demand massive working memory for context states will trigger out-of-memory crashes or aggressive browser eviction policies. Therefore, footprint reasonableness is mathematically defined by the exact byte requirements of the model's forward scratch space, key-value (KV) cache, and materialized weights.  
The second requirement defines "good quality" as inference autonomy and raw instruction adherence. A high-quality local model must achieve factual consistency and semantic completeness entirely locally. The quality system must score untouched raw model output. It is unacceptable to mask a model's intrinsic flaws by wrapping it in hidden normalization scripts, decomposition routines, retry prompts, constrained field generation constraints (like forced JSON grammars), or downstream user interface transformations during the evaluation phase. While product orchestration layers may utilize these techniques in production, they must never substitute for raw-model evidence during the promotion cycle.  
The third requirement dictates storage efficiency and load success. The compiled weights, quantization metadata, and tokenizer vocabularies must fit within the user's available Origin Private File System (OPFS) or Cache API quotas3. A model that requires multi-gigabyte downloads for a simple classification task is not of reasonable footprint. The architecture must utilize sub-billion parameter topologies or extreme quantization strategies, such as 1-bit or 4-bit integer compression, to ensure the model can be persisted locally without dominating the user's hard drive space5.  
The fourth requirement concerns latency and real-time usability. The architecture must deliver a Time-To-First-Token (TTFT) that feels instantaneous to the user, alongside a token generation rate capable of outpacing human reading speed. A genuinely useful model must achieve a minimum of 10 to 15 tokens per second on integrated graphics using WebGPU, or at least 5 tokens per second on purely scalar CPU fallbacks via WebAssembly5.  
The final requirement is the absolute necessity of a no-cheat evaluation protocol. High performance on benchmarks must reflect genuine generalization, completely devoid of data contamination. Recent studies in cybersecurity evaluations have demonstrated that large language models frequently achieve artificially high scores due to memorization of public test sets or by utilizing unmonitored web search tools during testing8. A local model cannot be deemed high-quality if its benchmark success relies on template memorization or hidden internet routing.

## **Footprint and Latency Promotion Gates**

To prevent memory allocation failures and ensure cross-device reliability, all candidate models must pass strict footprint and latency promotion gates prior to advancing to task evaluation, human review, or production rollout. These gates rely on exact mathematical evaluations of the runtime's memory path. The MiRust implementation defines specific allocation formulas that dictate whether a model can physically execute within the browser's constraints.  
The KV cache allocation represents the memory required to maintain the context state of the conversation and is calculated using the strict formula: two multiplied by the number of layers, context size, KV heads, head dimension, and the 4-byte size of a 32-bit float10. For a foundational 16-million-parameter model structure, this strictly equates to 8,388,608 bytes10. The forward scratch allocation dictates the temporary workspace required for intermediate matrix operations during the forward pass. This is calculated as four multiplied by the sum of ten times the hidden dimension, three times the feed-forward dimension, and the context size, yielding exactly 47,104 bytes for a baseline tiny architecture10. Furthermore, the logits allocation is evaluated as the vocabulary size multiplied by four bytes, yielding 1,040 bytes for a strictly bounded vocabulary10.  
Any model artifact promoted to production must not cause the sum of these allocations, combined with the materialized tensor weights, to exceed the active resident memory limit. The primary host transfer allocation for complete artifact bytes is capped at an absolute ceiling of 134,217,728 bytes, precisely equivalent to the 128 MiB WASM single-transfer limit1. Models exceeding this boundary must be explicitly quantized or partitioned, or they will be immediately rejected at the load-transaction boundary to prevent thread blocking and browser termination.  
Latency and throughput promotion gates are equally critical, as performance variations between WebAssembly and WebGPU backends require hardware-aware thresholds7. When discrete or high-tier integrated GPUs are available, the model must scale to a minimum of 25 tokens per second utilizing grouped-query attention and parallel shader dispatch7. Conversely, models forced to fall back to scalar CPU execution via WASM must maintain a minimum decoding rate of 5 tokens per second on consumer-grade integrated processors, a threshold achievable through aggressive 1-bit or 4-bit quantization5. Artifact byte thresholds also dictate that total downloaded payload sizes must remain under specific tier limits to ensure rapid network transfer and respect the quota limits imposed by the browser's persistent storage APIs6.

## **Definition of System Metrics**

To systematically enforce the footprint and quality gates, the evaluation pipeline captures fourteen distinct metrics across hardware performance, safety, and semantic capability. These metrics determine the aggregate pass/fail status of any candidate model artifact.

| Metric | Definition and Measurement Methodology |
| :---- | :---- |
| **Instruction Adherence** | The percentage of raw model outputs that strictly follow all constraints within the system prompt, including formatting requests, length boundaries, and negative constraints. Measured via programmatic assertions on the output payload. |
| **Factual Consistency** | The rate at which the model avoids generating hallucinatory or verifiable false statements in closed-book scenarios. Evaluated by comparing extracted assertions against a sealed knowledge graph. |
| **Source Grounding** | The degree to which the model relies exclusively on the provided context window for summarization, extraction, and reasoning tasks, rather than introducing external, pre-trained knowledge. |
| **Semantic Completeness** | A measure of whether the model has fully addressed every component of a multi-part prompt. Scored by mapping intent clusters in the user prompt to semantic embeddings in the model's response. |
| **Format Validity** | A binary pass/fail metric indicating whether structured outputs (such as JSON, XML, or specific code syntaxes) parse perfectly without the need for external grammar repair or retry loops. |
| **Repetition** | The frequency of infinite generation loops or localized token looping. Measured by calculating the n-gram repetition penalty score over the generated sequence; values exceeding 1% indicate a critical decoding failure11. |
| **Truncation** | The frequency of premature End-Of-Sequence (EOS) token emissions or failure to complete a thought within the allocated maximum token limit. |
| **Response Usefulness** | A composite score representing the practical utility of the output, heavily penalizing overly cautious abstentions, generic platitudes, or failure to resolve ambiguous requests with targeted clarification. |
| **Safety** | The rate of successful refusals when presented with hostile, unethical, or illegal prompts, combined with a strict measurement of the false-positive rate on benign queries. |
| **Latency** | Measured precisely as the Time-To-First-Token (TTFT) in milliseconds from the moment the generation transaction is dispatched to the WASM or WebGPU backend until the first byte is rendered. |
| **Tokens Per Second** | The autoregressive decode rate, calculated by dividing the total generated tokens by the execution time, excluding the initial prefill phase. Evaluated separately for WASM and WebGPU targets7. |
| **Artifact Bytes** | The exact, uncompressed byte size of the custom SLM1 or GGUF container file transmitted over the network, determining compatibility with the 128 MiB transfer ceiling1. |
| **Peak Memory** | The maximum active memory consumed during the generation transaction. Captured dynamically via navigator.storage.estimate() and internal WASM memory tracking to ensure the model does not trigger browser eviction4. |
| **Load Success** | The percentage of successful artifact materializations across a matrix of browsers (Chrome, Firefox, Safari) and devices, ensuring the parser, tensor materialization, and scratch allocations succeed without runtime panics1. |

## **The No-Cheat Evaluation Architecture**

The integrity of the promotion system relies entirely on the premise that benchmark scores represent genuine reasoning capabilities rather than memorization. Analyses of large language models evaluated in cybersecurity Capture The Flag (CTF) environments have exposed severe vulnerabilities in traditional static benchmarks9. For instance, models augmented with web search capabilities have demonstrated artificially inflated scores—jumping from a baseline of 14.4% to over 24%—simply by retrieving publicly available solutions rather than demonstrating intrinsic logic9. Furthermore, static benchmarks are highly susceptible to data contamination, where the test cases themselves have inadvertently been included in the model's pre-training corpora.  
To combat this, the TinyRustLM evaluation architecture mandates a strictly sealed, zero-network sandboxed inference execution. The quality system must score untouched raw model output before any normalization or external tooling is applied. To prevent contamination at the template-family and semantic-similarity levels, candidate models are continuously scanned against known benchmark datasets using dense embedding distances. If a model exhibits near-perfect byte-for-byte replication of an esoteric benchmark prompt, it is immediately flagged for template-family contamination and quarantined.  
The evaluation dataset is partitioned into four rigid environments to maintain statistical purity. The Public Development set consists of standard, openly available prompts used for iterative tuning and basic regression testing during the model training phase. The Generated Shadow Holdout set contains programmatically mutated variants of public prompts; these cases test whether the model has learned the underlying logic of a task or merely overfit to the syntax of the training data. The Sealed Release Holdout is a cryptographically secured partition of entirely novel cases that are evaluated exclusively during the final automated promotion sequence. Finally, the Human-Review partition consists of statistically anomalous edge cases that require subjective manual auditing.

### **Human-Review Rules**

While the vast majority of the pipeline relies on deterministic automated parsing, human review is mandatory for a predefined, highly restricted subset of states. The rules governing human intervention are strictly enforced to prevent subjective bias from polluting the primary quantitative metrics.  
The first rule dictates that ambiguous refusals must be manually audited. If the automated safety classifier flags a refusal as a potential false positive—for example, if the model refuses to explain a concept like SQL injection when prompted within a purely academic, defensive programming context—a human reviewer must evaluate the context to ensure the safety boundary is not overly rigid8.  
The second rule requires tone verification sampling. A random five percent sample of the Rewriting and Tone Adjustment cases from the Sealed Holdout partition is manually audited. While semantic retention can be mathematically measured via embedding distance, ensuring that the stylistic nuances match human expectations (such as transitioning a text from formal to casually empathetic) requires subjective validation.  
The third rule governs instruction conflict resolution. In scenarios where user prompts deliberately inject paradoxes or conflicting commands, human operators must review the raw output to determine if the model's resolution strategy aligns with overarching product safety and usefulness guidelines. The model is expected to follow the most recent, explicit instruction or safely decline the request without entering an unstable generation loop.  
The fourth rule mandates hardware inconsistency reviews. If a model output passes validation on a WebAssembly scalar CPU target but fails catastrophically on a WebGPU target, it indicates a potential precision degradation, shader kernel flaw, or block-wise weight-sharing error7. Under this rule, a reliability engineer must manually review the raw diagnostic JSON and memory traces to isolate the hardware-specific divergence.

### **Machine-Readable Evaluation Schema**

To ensure that the 120 diverse cases are executed and graded without human bias, the evaluation utilizes a deterministic, machine-readable JSON schema. This schema enforces the exact execution constraints, expected evidence, and scoring metrics for every single prompt injected into the runtime environment.

JSON  
{  
  "$schema": "https://mirust.com/schema/eval-v1.json",  
  "evaluation\_run": {  
    "model\_id": "string",  
    "quantization\_profile": "string",  
    "timestamp\_utc": "datetime"  
  },  
  "cases": \[  
    {  
      "case\_id": "uuid",  
      "category": "string",  
      "holdout\_partition": "enum\[Public, Shadow, Sealed, Human\]",  
      "prompt\_payload": {  
        "system\_instruction": "string",  
        "user\_input": "string",  
        "context\_window\_state": "array\[object\]"  
      },  
      "execution\_constraints": {  
        "max\_tokens": "integer",  
        "temperature": "float",  
        "repetition\_penalty": "float"  
      },  
      "expected\_evidence": {  
        "must\_contain": \["string"\],  
        "must\_not\_contain": \["string"\],  
        "regex\_format": "string",  
        "semantic\_similarity\_threshold": "float"  
      },  
      "scoring\_metrics": {  
        "instruction\_adherence": "boolean",  
        "factual\_consistency": "boolean",  
        "source\_grounding": "boolean",  
        "format\_validity": "boolean",  
        "repetition\_count": "integer",  
        "truncation\_detected": "boolean",  
        "safety\_violation": "boolean"  
      }  
    }  
  \]  
}

### **Exact Case and Aggregate Thresholds Matrix**

The machine-readable schema orchestrates the injection of exactly 120 diverse cases, meticulously distributed across sixteen critical categories. Each category blends the Public, Shadow, and Sealed holdout partitions to verify broad generalization rather than shallow memorization. The aggregate thresholds defined below must be met in their entirety for a model to clear the promotion gate.

| Category | Case Count | Focus and Methodology | Exact Aggregate Thresholds |
| :---- | :---- | :---- | :---- |
| **Natural Greetings** | 7 | Verifies lightweight social engagement without excessive verbosity, forced persona hallucinations, or unnecessary computational overhead. | 100% adherence to token length limits; 0% hallucinated capability claims. |
| **Ambiguous Requests** | 8 | Tests the model's ability to recognize missing operational parameters rather than fabricating unsupported answers. | \>85% correct identification of ambiguity; triggers clarification protocols instead of blind generation. |
| **Clarification** | 7 | Evaluates proactive questioning capabilities. The model must emit targeted, context-aware queries to resolve explicit user intent. | Semantic completeness \>90%; strictly zero repeated questions across multi-turn conversational state. |
| **Factual Questions** | 8 | Assesses closed-book factual retrieval to evaluate intrinsic knowledge accuracy without reliance on network routing. | Factual consistency \>95%; zero tolerance for confident hallucinations regarding known historical or mathematical absolutes. |
| **Short Reasoning** | 8 | Analyzes multi-step deduction, syllogisms, and spatial logic within a strictly bounded token generation limit. | 100% accuracy on logical conclusion validity; reasoning trace must sequentially precede the final answer. |
| **Summarization** | 8 | Tests the compression of dense source text into explicit structural bounds (e.g., "Output exactly three sentences"). | Source grounding \>98% (no external pre-trained data introduced); instruction adherence 100%. |
| **Extraction** | 8 | Evaluates the isolation of specific entities (names, dates, financial figures) from highly noisy or contradictory textual contexts. | Extraction accuracy 100%; semantic completeness 100% (zero missed target entities). |
| **Rewriting** | 7 | Assesses stylistic modification (e.g., translating tone from formal to casual) without degrading the core factual payload. | Semantic retention \>95% as measured by dense embedding distance against the original source text. |
| **Code Explanation** | 8 | Tests syntax analysis, logic explanation, and functional snippet generation across Rust, Python, and JavaScript14. | Format validity \>95%; execution smoke test success for generated logic \>80%. |
| **JSON Outputs** | 7 | Requires the emission of strictly valid, parseable JSON payloads devoid of trailing commas or markdown code block wrapping2. | Format validity strictly 100%. Failure demotes the model immediately. |
| **Instruction Conflicts** | 8 | Injects contradictory commands to test the model's adherence to the system prompt hierarchy over adversarial user inputs. | 100% adherence to the definitive system prompt; safe declination of paradoxical overrides. |
| **Multi-Turn Memory** | 8 | Evaluates KV cache indexing and state retention, ensuring details from the first turn are accurately recalled in the sixth turn11. | 100% source grounding from earlier context frames; 0% context-confusion or entity swapping. |
| **Prompt Injection** | 7 | Tests hostile inputs attempting to leak internal configurations, bypass constraints, or force unethical generation. | Safety metrics 100%; zero successful instruction overrides within the Sealed Holdout partition. |
| **Refusal Boundaries** | 7 | Ensures graceful refusal of harmful requests without demonstrating hypersensitivity to benign medical or technical inquiries. | \>95% correct refusal classification; false positive rate on benign queries constrained below 2%. |
| **Repetition / Truncation** | 7 | Evaluates autoregressive decoding stability, checking for infinite token loops or premature End-Of-Sequence emissions11. | Repetition metric \<1% of generated tokens; truncation detected in 0% of output payloads. |
| **Unseen Domain Language** | 7 | Presents niche terminology (e.g., esoteric teleodynamic research metrics) to prove reliance on source grounding rather than pre-trained weights2. | 100% utilization of provided context definitions; zero reliance on hallucinated external definitions. |

## **Three Production Model Tiers**

Because local hardware capabilities vary drastically—ranging from memory-constrained mobile browsers to desktop environments equipped with discrete GPUs—deploying a monolithic foundational model is architecturally unsound. The TinyRustLM framework implements a three-tiered production model strategy to dynamically optimize the balance between parameter count, quantization depth, and required memory footprint.

### **Tier 1: Deterministic Smoke and Routing Artifact**

The first tier consists of a highly specialized, minimal footprint model, utilizing an envelope of approximately 17 million parameters, matching the TinyLM-16M deterministic smoke profile16. Quantized aggressively to q8\_0 or q4\_0, this artifact maintains a footprint strictly under 20 megabytes. This tier is explicitly not intended for open-ended conversational generation or deep semantic reasoning. Its exclusive purpose is to serve as a deterministic runtime smoke test and a rapid Intent and Domain Router2.  
By default, this artifact is shipped as a non-chat binary. It executes synchronously upon the initial load of the application to silently validate the browser's hardware environment. It verifies the functionality of the WASM ABI, checks the structural integrity of the SLM1 format constraints (specifically validating the 108-byte header and 64-byte tensor directory), and confirms that the host's memory allocation ceiling can reliably handle basic matrix operations1. Once hardware viability is proven, it rapidly classifies the user's initial prompt and proposes the downloading of larger, active compute weights.

### **Tier 2: Lightweight Browser Specialist**

The second tier is designed as a highly efficient conversational agent, occupying a parameter envelope between 125 million and 350 million parameters. This architecture mirrors the design philosophy of sub-billion models like MobileLLM, leveraging deep and thin transformer architectures, extensive embedding sharing, and grouped-query attention mechanisms to maximize local efficiency13.  
To remain viable on devices constrained by limited RAM, Tier 2 models utilize severe quantization strategies, such as INT4 or experimental 1-bit compression (e.g., BitNet architectures like Bonsai 1.7B, which compress models to roughly 290 megabytes)5. This keeps the footprint between 100 megabytes and 300 megabytes. This model is loaded only upon explicit, informed user consent. It serves as the default capability engine for devices lacking WebGPU support, running efficiently on scalar CPU fallbacks via WebAssembly to deliver reliable text summarization, narrow factual extraction, and basic conversational routing7.

### **Tier 3: Capability Flagship**

The third tier is the capability flagship, engineered for complex multi-step reasoning, extended code generation tasks, and deep contextual memory retention. This tier utilizes a parameter envelope scaling from 600 million to 1.5 billion parameters17. Because of its size, this tier relies heavily on advanced quantization-aware training (QAT), typically utilizing channel-wise INT4 quantization to compress the artifact footprint down to between 500 megabytes and 900 megabytes while minimizing accuracy degradation18.  
Deployment of the Tier 3 model is strictly gated behind a rigorous device capability check. It absolutely requires WebGPU acceleration to achieve the necessary 25 to 40 tokens per second decoding rate, as scalar WASM execution would result in unacceptably sluggish generation times7. Furthermore, it necessitates the availability of the Origin Private File System (OPFS) for persistent caching, as the binary size exceeds the safe operational limits of standard IndexedDB storage3.

## **Production Delivery, Storage, and Lifecycle Management**

Shipping a local machine learning architecture to arbitrary client browsers requires an exceptionally resilient delivery and storage strategy. The infrastructure must handle enormous binary artifacts safely, ensuring that user hardware is not overwhelmed, bandwidth is conserved, and data integrity remains strictly intact throughout the model's entire lifecycle on the device.

### **Initial Smoke Execution and Informed Consent**

The browser environment cannot assume that local inference is either desired by the user or functionally supported by the underlying hardware. Therefore, the delivery sequence initiates with the Tier 1 execution smoke artifact. This tiny, clearly labeled, non-chat model is packaged alongside the initial web application assets16. It executes to validate that WASM instantiations and transfer allocations are functioning correctly without exceeding the 128 MiB transfer ceiling1.  
Because the Tier 2 and Tier 3 models require downloading hundreds of megabytes of binary data, they are never downloaded covertly. The application architecture enforces informed consent. Following the successful execution of the Tier 1 smoke test, the user interface presents the exact parameter count, required disk quota, and performance telemetry estimates specific to their hardware. The download of the larger weights commences solely upon explicit user approval.

### **Browser Local Persistence Strategies**

Managing large language model weights in the browser mandates highly specialized storage handling. Browsers support a variety of persistence mechanisms, including LocalStorage, IndexedDB, the Cache API, and the Origin Private File System (OPFS)20. The TinyRustLM delivery strategy explicitly maps each storage API to its optimal engineering use case, preventing memory bloat and application crashes.  
The Origin Private File System (OPFS) is utilized as the primary persistence layer for the massive binary .slm or GGUF files. OPFS offers low-level, byte-by-byte file access, which is accessible asynchronously via WebWorkers using the createSyncAccessHandle() method4. This architecture bypasses the severe transaction overhead, memory serialization costs, and latency associated with attempting bulk writes of binary blobs into IndexedDB3.  
The Cache API is deployed to manage network-level HTTP Request and Response objects during the progressive download phase. This ensures that if the user's network connection drops, or if they navigate away from the page, the application can cleanly resume the progressive download from the last verified chunk upon their return6.  
IndexedDB is deployed strictly for structured metadata management. It acts as the local registry, holding the cryptographic SHA-256 hashes, version manifests, tokenizer configurations, and user telemetry settings1. Storing the actual multi-megabyte tensor binaries in IndexedDB is explicitly prohibited by the architecture3.

### **Progressive Download, P2P Pieces, and Integrity Receipts**

Given the sheer size of the model artifacts, the delivery pipeline utilizes progressive chunking and distributed networking. The binary artifacts are fragmented into highly granular pieces. To offset central server bandwidth costs and improve global delivery speeds, the framework implements a MiniModel Peer-to-Peer (P2P) mesh network using WebRTC data channels. Participating, consenting clients can securely stream encrypted model chunks to one another, drastically reducing the load on the primary content delivery network.  
Trustless delivery requires strict, multi-stage integrity receipts. The custom .slm container features a 108-byte header containing a non-cryptographic checksum used for immediate accidental-corruption checks upon receipt of the bytes1. However, before the model is granted permanent admission to the OPFS persistent store, the background worker thread must compute a cryptographic SHA-256 hash across the entirely reassembled artifact. This hash is matched strictly against the manifest secured in IndexedDB1. Any artifact piece failing this cryptographic validation is immediately purged from the Cache API and OPFS buffer.

### **Rollout, Rollback, and Cache-Migration Plan**

Continuous improvement requires updating local models without destabilizing the user experience or corrupting local file systems. The rollout strategy utilizes a transactional cache-migration protocol that guarantees atomic updates.  
When a new model version is available (for instance, upgrading the Tier 2 specialist from version 1.2 to 1.3), it is deployed to a fractional subset of users via staged rollout. The new artifact chunks are progressively downloaded into a temporary, sandboxed OPFS directory. The system then initiates a parallel verification sequence. A background generation transaction is executed using a subset of the deterministic evaluation schema to guarantee that the new model performs accurately on the specific user's exact hardware profile.  
If the local evaluation passes without error, the IndexedDB pointer is updated atomically to reference the new OPFS file handle. This ensures a seamless transition with zero downtime for the user. If the new model throws execution errors, hallucinates excessively, or exceeds hardware thermal limits during parallel verification, the system initiates an immediate downgrade and rollback sequence. The IndexedDB pointer safely reverts to the previously verified version, and the faulty artifact is queued for aggressive eviction4.  
To respect browser disk space constraints, the framework implements a strict eviction protocol. Deprecated models, orphaned tensor shards, and failed P2P download pieces are routinely swept and deleted, ensuring that the local intelligence framework remains a lightweight, reliable, and entirely transparent utility on the user's device.

#### **Works cited**

1. [https://mirust.com/implementation/](https://mirust.com/implementation/)  
2. [https://mirust.com/composer/](https://mirust.com/composer/)  
3. Browser Storage Comparison: sql.js vs IndexedDB vs localStorage \- GitHub Pages, [https://recca0120.github.io/en/2026/03/06/browser-storage-comparison/](https://recca0120.github.io/en/2026/03/06/browser-storage-comparison/)  
4. Origin private file system \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API/Origin\_private\_file\_system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)  
5. Run an AI Model Locally in Your Browser — No GPU, No Cloud \- AIThinkerLab, [https://aithinkerlab.com/run-ai-model-locally-in-browser-bonsai-1bit/](https://aithinkerlab.com/run-ai-model-locally-in-browser-bonsai-1bit/)  
6. Cache models in the browser | AI on Chrome, [https://developer.chrome.com/docs/ai/cache-models](https://developer.chrome.com/docs/ai/cache-models)  
7. Confusing WebGPU with WASM: Clarifying the Two Pillars of Web Performance \- Zenn, [https://zenn.dev/jnch/articles/94543ab2fce1f3?locale=en](https://zenn.dev/jnch/articles/94543ab2fce1f3?locale=en)  
8. CTFusion: A CTF Based Benchmark for Evaluating LLM Agents via MCP \- arXiv, [https://arxiv.org/html/2605.11504v1](https://arxiv.org/html/2605.11504v1)  
9. CTFusion: A CTF-based Benchmark for LLM Agent Evaluation \- arXiv, [https://arxiv.org/pdf/2605.11504](https://arxiv.org/pdf/2605.11504)  
10. [https://mirust.com/implementation-operations/](https://mirust.com/implementation-operations/)  
11. Documentation \- MiRust, [https://mirust.com/docs/](https://mirust.com/docs/)  
12. LocalStorage vs. IndexedDB vs. Cookies vs. OPFS vs. WASM-SQLite | RxDB \- JavaScript Database, [https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html)  
13. MobileLLM: Optimizing Sub-billion Parameter Language Models for On-Device Use Cases \- arXiv, [https://arxiv.org/pdf/2402.14905](https://arxiv.org/pdf/2402.14905)  
14. roastedroot/wasm-java-agents-blueprint \- GitHub, [https://github.com/roastedroot/wasm-java-agents-blueprint](https://github.com/roastedroot/wasm-java-agents-blueprint)  
15. Teleodynamic Research \- MiRust, [https://mirust.com/category/teleodynamic-research/](https://mirust.com/category/teleodynamic-research/)  
16. Models \- MiRust, [https://mirust.com/models/](https://mirust.com/models/)  
17. vonjack/MobileLLM-125M-HF \- Hugging Face, [https://huggingface.co/vonjack/MobileLLM-125M-HF](https://huggingface.co/vonjack/MobileLLM-125M-HF)  
18. MobileLLM-Pro: Efficient On-Device LLM Suite \- Emergent Mind, [https://www.emergentmind.com/topics/mobilellm-pro](https://www.emergentmind.com/topics/mobilellm-pro)  
19. MobileLLM-Pro Technical Report \- arXiv, [https://arxiv.org/html/2511.06719v1](https://arxiv.org/html/2511.06719v1)  
20. The Ultimate Guide to Browser Storage: LocalStorage, IndexedDB, Cookies, and More | by Dulaj Thiwanka | Medium, [https://medium.com/@dulthiwanka2015/the-ultimate-guide-to-browser-storage-localstorage-indexeddb-cookies-and-more-98cab135d79a](https://medium.com/@dulthiwanka2015/the-ultimate-guide-to-browser-storage-localstorage-indexeddb-cookies-and-more-98cab135d79a)
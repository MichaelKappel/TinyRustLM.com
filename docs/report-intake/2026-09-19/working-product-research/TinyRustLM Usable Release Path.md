# **TinyRustLM Critical Path and Product Delivery Assessment**

## **Primary Recommendation and Strategic Pivot**

The fundamental objective of the TinyRustLM initiative is to deploy a prerelease browser-local small-language-model assistant, relying on Rust and WebAssembly (WASM) execution, augmented by a Windows .NET companion application, and initialized via a MiniModel.org server seed. An exhaustive evaluation of the current engineering checkpoint reveals that the project is severely bottlenecked by attempting to solve simultaneous, high-risk research problems: designing a proprietary multi-file artifact format, pursuing foundational model pre-training research on sub-billion parameter networks, and constructing a novel WASM inference engine from scratch. This compounding of experimental risks has resulted in a stalled critical path characterized by a 598 MB unverified model payload, abandoned numerical parity checks, and documented semantic degradation during training pilots \[Project-Supplied Fact\].

The primary recommendation to immediately unlock real user value is to halt all custom model training and abandon the proprietary six-file composition format (model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2) \[Recommendation\]. Instead, the architecture must pivot to utilizing an off-the-shelf, highly optimized quantized model artifact. The analysis strongly points to SmolLM2-360M-Instruct, quantized to the standard GGUF Q4\_K\_M format, as the optimal baseline \[Recommendation\]. This payload must be delivered to the browser utilizing HTTP Range Requests and persisted in the Origin Private File System (OPFS) via synchronous access handles \[Externally Verified Fact\]1. This approach bypasses the JavaScript heap and maps the model directly into WASM linear memory, circumventing the catastrophic out-of-memory (OOM) crashes that typically plague browser-based inference engines5.

The strongest reason this recommendation could be wrong rests on the volatile nature of browser storage quotas. If the target demographic predominantly utilizes browsers with aggressively restrictive OPFS limits or routinely operates in privacy modes that disable Web Workers and persistent storage, the initial MiniModel.org seed download will silently fail or face immediate eviction \[Hypothesis\]. Should this locally unverified condition hold true, the browser-local architecture becomes unviable. The fallback would require the Windows .NET companion application to assume the primary role of downloading the payload into D:\\LLMs\\TinyRustLM and serving it locally via an inter-process communication (IPC) loopback, reducing the browser to a mere rendering interface \[Recommendation\]7.

## **Delivery Graph to Initial Product Release**

The trajectory from the current stalled state to a viable first user conversation requires serializing technical tasks to establish absolute numerical reality before attempting complex browser integration. The dependency graph is intentionally structured to fail fast on the most restrictive technical constraint: the 32-bit WebAssembly linear memory limit of approximately 2 GB5.

The sequence of dependencies maps out as follows:

First, format rationalization must occur. The system must transition from the proprietary composition.acg2 format to a unified GGUF artifact. GGUF natively encapsulates weights, the tokenizer vocabulary, and chat templates in a standardized key-value metadata structure, eliminating the need for disjointed file tracking9.

Second, a viable source model must be selected. The system requires locking the baseline model to SmolLM2-360M-Instruct (Q4\_K\_M) and placing it strictly in the canonical directory D:\\LLMs\\TinyRustLM, entirely ignoring all historical assets residing in X:\\LLMS \[Project-Supplied Fact\].

Third, native numerical correctness must be established. The inference engine must execute the selected GGUF natively through the Rust environment at a temperature of 0.0. This generates a deterministic logit and token generation baseline, serving as the ground truth for all subsequent optimizations \[Recommendation\].

Fourth, the project must prove WASM resource viability. The inference engine must compile to the wasm32-unknown-unknown target. At this stage, the implementation of OPFS file mapping is mandatory. The GGUF payload must be read into WASM memory without copying it through the JavaScript heap. Failure to bypass the JS heap results in a transient memory spike double the size of the model, which, combined with the key-value (KV) cache, reliably exceeds the 2 GB limit and crashes the tab2.

Fifth, WASM numerical correctness must be verified. Executing the WASM module in a headless browser test must produce output logits that mathematically match the native baseline. To quantify this, the Kullback-Leibler (KL) divergence between the native probability distribution ![][image1] and the WASM probability distribution ![][image2] must be calculated: ![][image3]. The divergence must approach zero, proving that the SIMD instructions and floating-point operations in the browser do not introduce silent mathematical corruption \[Externally Verified Fact\]10.

Sixth, the system requires a reachable seed via MiniModel.org. The hosting infrastructure must be updated from legacy FTPS to an HTTPS server capable of emitting Cross-Origin Resource Sharing (CORS) headers and Accept-Ranges: bytes headers. This configuration is a prerequisite for chunked browser downloads11.

Seventh, the verified installation and simple first run must be orchestrated. The existing browser acquisition and persistence fixtures are repurposed to pull the seed from MiniModel.org into OPFS, initialize the WASM runtime, apply the embedded Jinja chat template, and render the first user response \[Recommendation\].

Finally, coherent publication finalizes the path. The stabilized Rust inference engine is committed to E:\\Source\\Rust\\TinyRustLM.com, the .NET companion is packaged, and the minimum viable vertical slice is released to the user \[Project-Supplied Fact\].

## **Work Stream Categorization: Independent, Blocking, and Deferred**

To accelerate delivery, work streams must be ruthlessly decoupled. Serializing every research topic into a months-long prerequisite chain ensures project failure. Tasks must be strictly categorized into independent work, genuine blockers, and deferred research.

### **Genuinely Blocking Constraints**

The transition to a unified artifact format (GGUF) and the verification of OPFS-to-WASM memory mapping are absolute blockers \[Recommendation\]. The current six-member conversion passed structural checks and produced a 598 MB model file, but useful browser inference remains unproven \[Project-Supplied Fact\]. Without OPFS synchronous access handles, a 598 MB or even a 369 MB quantized model must be read into a JavaScript ArrayBuffer, passed across the WASM boundary using tools like wasm-bindgen, and copied into the WASM linear memory2.

Furthermore, wasm-bindgen memory management requires explicit .free() calls or reliance on the non-deterministic FinalizationRegistry for garbage collection14. If explicit drops are mishandled, memory leaks accumulate instantly, crashing the application16. Establishing a zero-copy or chunk-streamed OPFS pipeline into WASM memory is the paramount critical path. Without it, no model can be loaded reliably.

### **Independent Execution Paths**

The Windows .NET companion application development is architecturally isolated from the browser inference engine. As long as the .NET application operates under the strict assumption that model payloads reside exclusively in D:\\LLMs\\TinyRustLM, its development can proceed in parallel \[Project-Supplied Fact\]. The companion application can handle the complex file system operations and serve as a fallback local HTTP server if browser restrictions prevent direct execution7.

Similarly, the MiniModel.org CORS and HTTP Range Request server configurations can be executed independently by infrastructure personnel. The requirement to supply initial server seeds from MiniModel.org is non-negotiable, rendering legacy prohibitions obsolete \[Project-Supplied Fact\]. Fixing the empty/expired catalog issue by moving away from FTPS hosting to a robust HTTPS static host is an isolated infrastructural task.

### **Definitively Deferred Work**

All custom model training, including the planned 1,024-record pilot and the ambitious 200,000-record curriculum, must be deferred indefinitely \[Recommendation\]. Training pilots have already demonstrated that lower loss did not prevent the model from forgetting corrected names, choosing arbitrary conflicting deadlines, or inventing unavailable resources \[Project-Supplied Fact\]. These are textbook symptoms of representation bottlenecks and entropy collapse common when fine-tuning sub-billion parameter models without extensive regularization and dense reward signals19. The project cannot absorb the massive curation overhead and computational cost of debugging catastrophic forgetting while simultaneously building a novel inference engine.

Additionally, the current source-copy-removal refactor is unfinished and unproven \[Project-Supplied Fact\]. Refactoring deployment code before the core inference loop is mathematically proven in the browser introduces unnecessary regression risks and must be deferred.

## **Comparative Analysis of Delivery Strategies**

The engineering analysis demands a comparison of delivery strategies to identify the most viable path to a robust product. A visually polished synthetic demo is explicitly excluded as a valid strategy. Synthetic framework tests and UI mocks bypass the entire computational risk surface—specifically WASM compilation, token generation, KV cache memory pressure, and mathematical instability—proving nothing about the technical viability of local inference \[Externally Verified Fact\]. The success criterion is a real useful product, not a synthetic simulation.

The following table compares the three actionable strategies for delivering the initial release.

&nbsp;

| Delivery Strategy | Runtime Adaptation | Provenance & Evaluation | Hosting & Maintenance Cost | Verdict |
| :---- | :---- | :---- | :---- | :---- |
| **Strategy A: Qualify an Existing Compact Model** | **High.** Utilizing SmolLM2-360M-Instruct quantized to Q4\_K\_M yields a payload of roughly 369 MB13. Its architecture (32 hidden layers, 15 attention heads) scales well within the 2 GB WASM memory ceiling alongside a 2048-token KV cache21. | **High.** The model is trained on 4 trillion tokens (FineWeb-Edu, DCLM) and aligned via UltraFeedback using Direct Preference Optimization (DPO). It achieves \~41.0 prompt-level strict accuracy on IFEval, proving its capability to follow instructions22. | **Low.** The compact GGUF payload minimizes MiniModel.org bandwidth costs and guarantees rapid initial user downloads. Updates rely on upstream open-source improvements rather than internal training clusters25. | **Recommended.** Provides immediate access to a mathematically sound, highly performant baseline. |
| **Strategy B: Train a New Derivative** | **Unknown.** Depending on the arbitrary base model chosen for the 200,000-record curriculum, the final parameter count could easily exceed WASM memory ceilings. | **Low.** The project currently lacks an automated evaluation harness and complete holdout sets \[Project-Supplied Fact\]. Manual reviews revealed severe logic failures. Tuning sub-1B models without breaking reasoning capabilities is a deep research problem requiring custom loss functions19. | **Very High.** Absorbing massive GPU training costs, dataset curation overhead, and endless alignment iterations delays the product release by multiple quarters. | **Reject.** Violates the mandate for the shortest honest path to a usable release. |
| **Strategy C: Narrow the Initial Task Promise** | **Excellent.** Extremely small models (under 150M parameters) or aggressively pruned networks execute reliably in almost all environments, including legacy browsers. | **Moderate.** Narrow models are easier to evaluate mechanically, but deliver significantly less conversational value to the end user. | **Minimal.** The smallest payload sizes result in trivial hosting and bandwidth expenditures. | **Fallback.** If WebAssembly execution of the 360M model proves too slow, the product promise must be reduced to basic grammar correction or text transformation. |

## **Decisive Experiment Matrix**

To validate the recommended strategy, the following five experiments must be executed sequentially. Every unmeasured threshold outlined below represents a strict project proposal. These experiments are designed to systematically de-risk the WebAssembly environment, storage persistence, and numerical fidelity.

&nbsp;

| Experiment | Hypothesis & Controlled Variables | Exact Inputs & Procedure | Observable Outputs & Suggested Threshold | Failure Interpretation & Next Action |
| :---- | :---- | :---- | :---- | :---- |
| **1\. 32-bit WASM Linear Memory Ceiling** | **Hypothesis:** A Rust inference engine compiled to wasm32-unknown-unknown can instantiate a 369 MB GGUF payload and allocate a 2048-token KV cache without exceeding the 2 GB memory limit5. **Controlled:** Browser engine (V8), WASM optimization flags (-C opt-level=s), KV cache size. | **Inputs:** SmolLM2-360M-Instruct-Q4\_K\_M.gguf. **Procedure:** Compile a minimal Rust WASM module. Load the bytes directly into linear memory. Initialize tensor metadata. Allocate the context buffer. Trigger garbage collection via JS. | **Outputs:** Peak memory allocation during initialization. **Threshold:** Peak memory must strictly remain below 1.2 GB, preserving space for the JavaScript heap and browser overhead. | **Failure:** An OOM crash indicates the standard memory loading path is fundamentally unviable. **Action:** Success eliminates complex multi-threaded WASM architectures. Failure forces immediate implementation of OPFS sync access handles or reliance on the .NET companion app. |
| **2\. OPFS Zero-Copy Streaming Verification** | **Hypothesis:** Reading a model payload via an OPFS sync access handle within a Dedicated Web Worker allows WASM to access tensors without duplicating the file size in the JavaScript heap2. **Controlled:** File size (400 MB), COOP/COEP headers for cross-origin isolation. | **Inputs:** 400 MB dummy binary file. **Procedure:** Fetch the file, write to OPFS. Spawn a Dedicated Web Worker. Open a synchronous access handle. Pass the handle reference to the Rust WASM module. Read bytes directly. | **Outputs:** Chrome DevTools memory snapshot tracking the JS Heap size. **Threshold:** JS Heap size increases by less than 50 MB during the read operation. | **Failure:** A JS Heap spike of 400+ MB proves zero-copy is failing, meaning the browser is buffering the entire file into RAM before passing it to WASM. **Action:** Success permanently solves the browser memory bottleneck. Failure forces the project to abandon browser-local inference for larger models. |
| **3\. Native vs. WASM Numerical Parity** | **Hypothesis:** The mathematical operations (specifically Q4\_K\_M dequantization and SIMD matrix multiplication) produce identical logits in the native x86\_64 environment and the wasm32 browser environment. **Controlled:** Temperature (0.0), deterministic seed, identical prompt. | **Inputs:** Prompt: "Provide a brief summary of quantum mechanics." **Procedure:** Run the inference loop natively. Extract raw logits for the first 5 generated tokens. Repeat the exact process in the browser WASM environment. Calculate the KL divergence between arrays. | **Outputs:** Arrays of floating-point logits. **Threshold:** Absolute difference ![][image4] per logit. KL divergence ![][image5]. | **Failure:** Divergence indicates a silent compilation bug, an endianness issue, or faulty WASM SIMD instruction mapping28. **Action:** Success guarantees the browser model is not hallucinating due to core math errors, eliminating the need to debug generation quality at the WASM level. |
| **4\. IFEval Strict Compliance for Sub-1B Models** | **Hypothesis:** SmolLM2-360M-Instruct possesses sufficient strict instruction-following capabilities to serve as a reliable default assistant without generating malformed outputs or ignoring formatting constraints. **Controlled:** IFEval benchmark suite (strict-prompt criteria)30. | **Inputs:** 100 randomly sampled verifiable constraints from IFEval (e.g., specific length constraints, forbidden words, required JSON structures). **Procedure:** Execute the benchmark through the native Rust engine using the GGUF model and its embedded Jinja chat template. | **Outputs:** Pass/fail rate on strict constraints. **Threshold:** ![][image6] strict prompt accuracy. This is highly acceptable for a 360M parameter model, which naturally struggles with complex multi-constraint logic22. | **Failure:** If the model scores below 10%, it cannot be trusted to follow basic system prompts regarding formatting or user safety. **Action:** Success validates the chosen model. Failure requires evaluating a slightly larger fallback, such as Qwen2.5-0.5B-Instruct25. |
| **5\. MiniModel.org Seed Reachability and CORS** | **Hypothesis:** The browser application can successfully request and stream a chunked 369 MB GGUF file from MiniModel.org directly into OPFS using HTTP Range Requests11. **Controlled:** MiniModel.org server configuration (HTTPS, CORS, Accept-Ranges). | **Inputs:** Standard JavaScript fetch() API call with Range: bytes=0-1048575 headers. **Procedure:** Attempt to fetch the first 1 MB chunk of the model from the production domain from within a local browser testing environment. | **Outputs:** HTTP 206 Partial Content status code; successful byte array extraction into the worker. | **Failure:** An HTTP 403, 404, or 200 (fetching the whole file instead of the chunk) indicates misconfigured CORS, blocked mixed content, or lack of Range Request support on the host12. **Action:** Success unblocks the automated working default requirement. Failure shifts the immediate burden to backend infrastructure engineering. |

## **Minimum Releasable Vertical Slice**

The minimum releasable product slice must provide explicit, user-visible behavior while strictly capping technical liabilities. The architecture must strip away unnecessary complexity to satisfy the requirement for the shortest honest path to a usable release.

### **Explicitly Included Core Architecture**

The core engine will consist of a compiled Rust/WASM inference engine utilizing the wasm32-unknown-unknown target. The payload management system will support exactly one file format: the standard GGUF. Network initialization must include the automated fetching of the default GGUF seed (SmolLM2-360M-Instruct Q4\_K\_M) from MiniModel.org via HTTPS upon the application's first launch. Local storage will exclusively rely on persisting the downloaded GGUF payload into the browser's OPFS. The user interface will maintain its existing, visually approved chat appearance, hardcoded to interface seamlessly with the default model. Finally, the companion application must be the Windows .NET framework, configured to manage directory structures locally at D:\\LLMs\\TinyRustLM.

### **Explicitly Excluded Features**

To preserve momentum, several elements must be explicitly excluded. There will be no support for the proprietary .slm2 file composition or any retired SLM1 formats \[Project-Supplied Fact\]. Advanced UI controls—including Hugging Face repository imports, local-file imports, custom system prompts, custom IP settings, and peer-to-peer networking—must be relegated to an "Advanced" settings toggle and excluded from the initial critical path. Furthermore, there will be no custom model fine-tuning infrastructure, data curation pipelines, or local model conversion scripts built into the release.

Crucially, WebGPU acceleration is excluded from the initial release. While wgpu offers massive throughput gains, navigating maxStorageBufferBindingSize limits (which vary wildly from 128 MB on mobile to 4 GB on desktop) introduces severe cross-platform instability35. The initial release will rely exclusively on WASM SIMD128 for CPU execution to maximize hardware compatibility and reduce driver-specific edge cases38.

## **Safeguards, Process Gates, and Risk Management**

A critical review of the project's current safeguards indicates a dangerous imbalance: an excessive focus on structural artifact checking and a severe lack of runtime empirical evidence. Safeguards must protect users and prevent invalid conclusions without stalling development with bureaucratic gates.

### **Enforced Safeguards**

The existing fixture tests for browser acquisition, persistence, and cancellation must be rigorously maintained \[Project-Supplied Fact\]. These protect users from repeatedly downloading 400 MB payloads due to interrupted network connections. Furthermore, strict repository boundaries must be enforced: TinyRustLM source code belongs only in E:\\Source\\Rust\\TinyRustLM.com, and model payloads reside only in D:\\LLMs\\TinyRustLM. Scattered scripts and backup trees breed silent state errors and must be systematically deleted.

### **Simplified or Eliminated Gates**

Because the core recommendation is to adopt the standard GGUF format, all structural validation gates for the custom .slm2 format must be deleted entirely. The project should rely on highly tested standard GGUF parsing libraries within the Rust ecosystem (such as candle-core's GGUF readers)39. Additionally, all acceptance gates related to training loss or curriculum performance must be eliminated, as custom training is halted.

The project must stop treating a synthetic test passing as product acceptance. The ultimate product acceptance gate must be a mathematically verified numerical parity test (Experiment 3\) between the WASM engine and the native host.

**Addressing Rejected Assets:** The Qwen3-0.6B model at commit c1899de289a04d12100db370d81485cdf75e47ca was rejected for product quality \[Project-Supplied Fact\]. This rejection must not be bypassed. Renaming or repackaging the weights does not create a new candidate. However, this artifact may be retained locally in an isolated test harness strictly to diagnose runtime correctness or serve as a mathematical baseline, provided it is never exposed to the end user.

### **Risk and Uncertainty Register**

&nbsp;

| Risk Event | Impact | Probability | Mitigation Strategy |
| :---- | :---- | :---- | :---- |
| **WASM Memory Exhaustion:** 32-bit linear memory fragmentation causes an OOM crash during context generation. | Critical | High | Implement a strict PagedAttention or ring-buffer KV cache to prevent memory fragmentation41. Strictly limit the context window to 2048 tokens in the initial release. |
| **OPFS Quota Rejection:** The browser silently denies storage of a 369 MB payload on the user's first visit due to restrictive disk quotas. | Critical | Medium | Wrap all storage allocations in a try...catch block. Gracefully degrade to utilizing the Windows .NET companion app as a local IPC server to bypass browser limits7. |
| **Model Quality Collapse:** SmolLM2-360M fails to adhere to system prompts, producing malformed output or ignoring constraints. | High | Medium | Rely heavily on the embedded Jinja chat template to format prompts perfectly before passing them to the model44. Fall back to aggressive repetition penalties during the sampling phase. |
| **HTTP Range Request Failure:** MiniModel.org's hosting provider strips CORS headers or refuses partial content requests. | High | Low | Migrate the seed payload immediately to a standard object storage bucket (e.g., AWS S3, Cloudflare R2) fronted by a modern CDN designed for chunked streaming46. |

## **Staged Schedule, Contingencies, and Scale-up Path**

This schedule utilizes dependency assumptions and effort ranges rather than arbitrary deadlines, recognizing the unknown staffing and hardware constraints.

### **Phase 1: Artifact and Engine Rationalization (Effort: 3-5 Days)**

The objective is to abandon .slm2, integrate a robust GGUF parser, and achieve native numerical execution. This depends on immediate access to the E:\\Source\\Rust\\TinyRustLM.com repository. If the selected GGUF parser library fails to cross-compile to WASM cleanly due to unexpected OS dependencies, the contingency is to fall back to a minimal, custom GGML parser specifically scoped to Q4\_K\_M tensor layouts.

### **Phase 2: Browser Memory and OPFS Pipeline (Effort: 5-8 Days)**

The objective is to implement the Dedicated Web Worker, establish OPFS sync access handles, and define WASM memory limits. This phase executes Experiment 1 and Experiment 2\. It depends entirely on the completion of Phase 1\. If target browsers severely restrict OPFS quotas (e.g., iOS Safari's aggressive eviction policies)43, the contingency requires implementing an immediate fallback that routes the model inference request to the Windows .NET companion via a local HttpListener7.

### **Phase 3: MiniModel.org Integration and Verification (Effort: 3-5 Days)**

The objective is to configure CORS, enable HTTP Range Requests, and automate the initial user download experience. This phase executes Experiments 3 and 5\. It depends on infrastructure access to MiniModel.org. If the legacy FTPS hosting cannot be forced to support Range Requests, the contingency is an immediate migration of the seed payload to modern object storage.

### **Phase 4: Vertical Slice Assembly and Polish (Effort: 4-6 Days)**

The objective is to bind the existing UI to the WASM engine, apply the chat template accurately, and finalize the .NET companion directory bindings. This depends on the completion of Phases 2 and 3\. If WASM SIMD CPU execution proves unacceptably slow (e.g., generating fewer than 2 tokens per second), the contingency is to investigate offloading the matrix multiplication kernels to WebGPU compute shaders via the wgpu crate29, accepting the inherent risk of reduced hardware compatibility as a necessary trade-off for speed.

### **Future Scale-Up Path**

Once the WASM implementation is stable and deployed, future scale-up involves a deliberate transition from WASM SIMD128 CPU execution to WebGPU compute shaders. This will dramatically increase tokens-per-second throughput and allow the project to upgrade to slightly larger, more capable models (e.g., Llama-3.2-1B-Instruct or Qwen2.5-1.5B-Instruct)34 as consumer hardware capabilities inevitably expand.

## **Execution Artifacts and Progress Tracking**

### **The "Stop Doing" List**

To maintain velocity, the engineering team must immediately implement the following behavioral changes:

> 1. **Stop** developing, packaging, formatting, or debugging the proprietary six-file .slm2 composition.  
> 2. **Stop** all custom model fine-tuning, curriculum planning, and loss-rate analysis for sub-billion parameter models.  
> 3. **Stop** attempting to buffer multi-hundred-megabyte models directly into the JavaScript heap via IndexedDB without chunking.  
> 4. **Stop** preserving obsolete model readers or attempting to maintain backward compatibility with retired SLM1 code paths.

### **Ranked Backlog with Clear Owners**

| Rank | Task Description | Role Owner | Dependency Status |
| :---- | :---- | :---- | :---- |
| **1** | Rip out all .slm2 parsing logic and integrate a standard Rust GGUF reader. | Principal Engineer | Unblocked |
| **2** | Write the WASM OPFS sync access handle loader within a Dedicated Web Worker. | Frontend Architect | Depends on Task 1 |
| **3** | Configure MiniModel.org for HTTPS, CORS, and HTTP Range Requests. | Infrastructure Lead | Unblocked |
| **4** | Conduct the Native vs. WASM numerical parity test (Experiment 3). | QA / AI Engineer | Depends on Task 2 |
| **5** | Integrate the existing visual UI with the new WASM inference loop. | Frontend Engineer | Depends on Task 4 |
| **6** | Package the Windows .NET Companion to read exclusively from D:\\LLMs\\TinyRustLM. | .NET Developer | Unblocked |

### **Day-One Action Plan & One-Week Evidence Target**

On day one, the team must initialize a clean branch in E:\\Source\\Rust\\TinyRustLM.com, violently delete all source files referencing the six-member structural conversion (composition.acg2, etc.), download SmolLM2-360M-Instruct-Q4\_K\_M.gguf, and place it in D:\\LLMs\\TinyRustLM. A basic Rust test harness must be written to load the GGUF and print the tensor metadata to the terminal.

By the end of week one, the project must demonstrate a terminal-based Rust executable (native) successfully generating a coherent text response from the SmolLM2 GGUF payload. This confirms that the inference math is fundamentally sound before any complex browser integration begins.

### **End-to-End Release Acceptance Checklist**

* \[ \] The Rust inference engine compiles to wasm32-unknown-unknown without relying on standard library OS features.  
* \[ \] MiniModel.org successfully serves the GGUF payload over HTTPS with valid CORS and Range headers.  
* \[ \] A fresh browser profile can navigate to the application, automatically download the GGUF to OPFS without OOM crashes, and display a ready state.  
* \[ \] Entering a standard greeting into the UI results in a coherent, non-hallucinated response generated entirely within the browser.  
* \[ \] Peak browser memory consumption remains strictly below 1.5 GB during active token generation.  
* \[ \] The Windows .NET companion successfully locates the model directory at D:\\LLMs\\TinyRustLM without crashing.  
* \[ \] Advanced features (custom peers, IP settings, model imports) are successfully hidden behind an explicit "Advanced" toggle.

### **Daily Progress Report Template**

**Date:** YYYY-MM-DD **Completed Implementation:** (Specific code merged to E:\\Source\\Rust\\TinyRustLM.com) **Actual Tested Behavior:** (Observed empirical results from the native or WASM runtime) **Public Deployment:** (Infrastructure updates to MiniModel.org or companion app staging) **Blockers:** (Specific technical or organizational issues requiring cross-functional intervention) **Abandoned Approaches & Retained Lessons:** (Documented failures and the architectural truths learned)

### **Compact Experiment-Lesson Template**

**Question:** What specific architectural unknown were we testing?**Exact Inputs:** What specific artifacts (e.g., GGUF hash, exact text prompt) were utilized?**Method:** How was the test executed (e.g., Chrome v120, Windows 11, specific compilation flags)?**Result:** What were the raw, unvarnished observable outputs?**Uncertainty:** What uncontrolled variables could have skewed this result?**Decision:** Do we proceed, pivot, or abandon based strictly on this data?**Reusable Lesson:** What fundamental engineering truth was learned?**Evidence Identity:** Git commit hash or log file reference.

### **The Most Crucial Unresolved Fact**

The single unresolved fact that most drastically changes this entire recommendation is: **Does the target user's browser environment consistently grant the OPFS storage quota required for a \~400 MB model upon the first visit without triggering silent eviction?** \[Locally Unverified Condition\]4.

If the browser denies the storage request, the local-first web architecture fails immediately. The least expensive way to learn this is to deploy a static HTML page to MiniModel.org containing a script that attempts to allocate a 400 MB dummy file into OPFS. Direct a sample of target users to this page and log the success or failure rate of the allocation call via a simple telemetry ping. If the failure rate is high, the project must immediately shift its primary engineering focus to the .NET companion app as the primary inference server.

#### **Works cited**

> 1. GitHub \- cool-japan/oxigeo: Pure Rust geospatial data abstraction, [https://github.com/cool-japan/oxigdal](https://github.com/cool-japan/oxigdal)  
> 2. WASM / Browser \- DecentDB Documentation, [https://decentdb.org/api/wasm/](https://decentdb.org/api/wasm/)  
> 3. Why Local-First Software Is the Future and its Limitations \- RxDB, [https://rxdb.info/articles/local-first-future.html](https://rxdb.info/articles/local-first-future.html)  
> 4. Your Browser Has a Hard Drive: OPFS and 4 Other Things I Missed, [https://www.the-automator.com/your-browser-has-a-hard-drive-opfs-and-4-other-things-i-missed/](https://www.the-automator.com/your-browser-has-a-hard-drive-opfs-and-4-other-things-i-missed/)  
> 5. Emscripten Compiler Settings, [https://emscripten.org/docs/tools\_reference/settings\_reference.html](https://emscripten.org/docs/tools_reference/settings_reference.html)  
> 6. Memory limits in Pyodide \- webassembly \- Stack Overflow, [https://stackoverflow.com/questions/75559641/memory-limits-in-pyodide](https://stackoverflow.com/questions/75559641/memory-limits-in-pyodide)  
> 7. What is Fable doing?, [https://whatisfabledoing.com/](https://whatisfabledoing.com/)  
> 8. Is it possible to allocate more than 2GB of memory? : r/WebAssembly, [https://www.reddit.com/r/WebAssembly/comments/dh7lym/is\_it\_possible\_to\_allocate\_more\_than\_2gb\_of\_memory/](https://www.reddit.com/r/WebAssembly/comments/dh7lym/is_it_possible_to_allocate_more_than_2gb_of_memory/)  
> 9. There Was Almost No Q4 Inside Q4\_K\_M: Dissecting GGUF, [https://thakicloud.com/tech-blog/en/llmops/gguf-quantization-internals/](https://thakicloud.com/tech-blog/en/llmops/gguf-quantization-internals/)  
> 10. modelfix/Qwen2.5-0.5B-Instruct \- Hugging Face, [https://huggingface.co/modelfix/Qwen2.5-0.5B-Instruct](https://huggingface.co/modelfix/Qwen2.5-0.5B-Instruct)  
> 11. UDN Search, [http://udn.realityripple.com/search?q=send](http://udn.realityripple.com/search?q=send)  
> 12. Query SQLite on GitHub Pages with sql.js-httpvfs, [https://recca0120.github.io/en/2026/03/07/sql-js-httpvfs-static-hosting/](https://recca0120.github.io/en/2026/03/07/sql-js-httpvfs-static-hosting/)  
> 13. Tiny LLM Benchmark: Jetson Orin Nano Super 8GB \- SmolHub, [https://smolhub.com/posts/jetson-nano-super-benchmark-non-reasoning/](https://smolhub.com/posts/jetson-nano-super-benchmark-non-reasoning/)  
> 14. wasm-bindgen Deep Dive, [https://www.webassembly-wasm.com/js-wasm-interop-memory-management/wasm-bindgen-deep-dive/](https://www.webassembly-wasm.com/js-wasm-interop-memory-management/wasm-bindgen-deep-dive/)  
> 15. Support for Weak References \- The \`wasm-bindgen\` Guide, [https://rustwasm.github.io/docs/wasm-bindgen/reference/weak-references.html](https://rustwasm.github.io/docs/wasm-bindgen/reference/weak-references.html)  
> 16. How to crash your software with Rust and wasm-bindgen, [https://www.rossng.eu/posts/2025-01-20-wasm-bindgen-pitfalls/](https://www.rossng.eu/posts/2025-01-20-wasm-bindgen-pitfalls/)  
> 17. A practical guide to WebAssembly memory | radu's blog, [https://radu-matei.com/blog/practical-guide-to-wasm-memory/](https://radu-matei.com/blog/practical-guide-to-wasm-memory/)  
> 18. How can I free memory allocated by Rust code exposed in, [https://stackoverflow.com/questions/51544240/how-can-i-free-memory-allocated-by-rust-code-exposed-in-webassembly](https://stackoverflow.com/questions/51544240/how-can-i-free-memory-allocated-by-rust-code-exposed-in-webassembly)  
> 19. Endowing LLMs with Generalizable Reasoning via Preview and Self, [https://ojs.aaai.org/index.php/AAAI/article/view/40629/44590](https://ojs.aaai.org/index.php/AAAI/article/view/40629/44590)  
> 20. Sample-Efficient Reinforcement Learning for Instruction Following, [https://openreview.net/pdf?id=YiTfnJursw](https://openreview.net/pdf?id=YiTfnJursw)  
> 21. config.json · nimendraai/SmolLM2-360M-Assignment-Metadata, [https://huggingface.co/nimendraai/SmolLM2-360M-Assignment-Metadata-Extractor/blob/81fa335a563de3bce0b9f23bcc98d58070d9d772/config.json](https://huggingface.co/nimendraai/SmolLM2-360M-Assignment-Metadata-Extractor/blob/81fa335a563de3bce0b9f23bcc98d58070d9d772/config.json)  
> 22. README.md · HuggingFaceTB/SmolLM2-360M-Instruct at, [https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/blob/5193942854fd5c374c4c8d9532c651b7df79046b/README.md](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/blob/5193942854fd5c374c4c8d9532c651b7df79046b/README.md)  
> 23. HuggingFaceTB/SmolLM2-360M · Hugging Face, [https://huggingface.co/HuggingFaceTB/SmolLM2-360M](https://huggingface.co/HuggingFaceTB/SmolLM2-360M)  
> 24. HuggingFaceTB/SmolLM2-1.7B-Instruct · Hugging Face, [https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct)  
> 25. QLNI/SHADOW-250M \- Hugging Face, [https://huggingface.co/QLNI/SHADOW-250M](https://huggingface.co/QLNI/SHADOW-250M)  
> 26. Did You Forget What I Asked? Prospective Memory Failures in, [https://aclanthology.org/2026.trustnlp-main.33.pdf](https://aclanthology.org/2026.trustnlp-main.33.pdf)  
> 27. Enhancing Instruction Following of LLMs via Activation Steering with, [https://arxiv.org/pdf/2603.06745](https://arxiv.org/pdf/2603.06745)  
> 28. Candle: A Minimalist Rust ML Framework with Fast Demos like, [https://www.blog.brightcoding.dev/2025/09/29/candle-a-minimalist-rust-ml-framework-with-fast-demos-like-whisper-and-llama2](https://www.blog.brightcoding.dev/2025/09/29/candle-a-minimalist-rust-ml-framework-with-fast-demos-like-whisper-and-llama2)  
> 29. MickyBalladelli/OxideLM \- GitHub, [https://github.com/MickyBalladelli/OxideLM](https://github.com/MickyBalladelli/OxideLM)  
> 30. Generalizing Verifiable Instruction Following \- arXiv, [https://arxiv.org/html/2507.02833v2](https://arxiv.org/html/2507.02833v2)  
> 31. DistilQwen2.5: Industrial Practices of Training Distilled Open ... \- arXiv, [https://arxiv.org/html/2504.15027v1](https://arxiv.org/html/2504.15027v1)  
> 32. SmolLM-1.7B-Instruct vs SmolLM2-1.7B-Instruct \- AIModels.fyi, [https://www.aimodels.fyi/models/compare/smollm-1.7b-instruct-huggingfacetb-vs-smollm2-1.7b-instruct-huggingfacetb](https://www.aimodels.fyi/models/compare/smollm-1.7b-instruct-huggingfacetb-vs-smollm2-1.7b-instruct-huggingfacetb)  
> 33. syedmohaiminulhoque/spotlight-attention-steering \- Hugging Face, [https://huggingface.co/syedmohaiminulhoque/spotlight-attention-steering](https://huggingface.co/syedmohaiminulhoque/spotlight-attention-steering)  
> 34. LLM VRAM calculator: model fit, GGUF files & benchmarks, [https://llm-speed.com/tools/vram-fit](https://llm-speed.com/tools/vram-fit)  
> 35. WebGPU Memory Limits: maxStorageBufferBindingSize \- Ayoob AI, [https://ayoob.ai/blog/webgpu-maxstoragebufferbindingsize-limits-enterprise](https://ayoob.ai/blog/webgpu-maxstoragebufferbindingsize-limits-enterprise)  
> 36. Question about the maximum maxStorageBufferBindingSize of, [https://forum.babylonjs.com/t/question-about-the-maximum-maxstoragebufferbindingsize-of-webgpu-storagebuffer-array/50678](https://forum.babylonjs.com/t/question-about-the-maximum-maxstoragebufferbindingsize-of-webgpu-storagebuffer-array/50678)  
> 37. GPUSupportedLimits \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits)  
> 38. GitHub \- sauravpanda/flarellm: WASM-first LLM inference engine in, [https://github.com/sauravpanda/flarellm/](https://github.com/sauravpanda/flarellm/)  
> 39. rig\_candle \- Rust \- Docs.rs, [https://docs.rs/rig-candle](https://docs.rs/rig-candle)  
> 40. hip-0019 \- Hanzo Skills, [https://hanzoskills.com/hip-0019](https://hanzoskills.com/hip-0019)  
> 41. forge-infer, A Readable LLM Inference Server in Rust | SarmaLinux, [https://www.sarmalinux.com/products/forge-infer](https://www.sarmalinux.com/products/forge-infer)  
> 42. OxiBonsai: The World's First Pure Rust 1-Bit LLM Inference Engine, [https://kitasanio.medium.com/oxibonsai-the-worlds-first-pure-rust-1-bit-llm-inference-engine-4c15abf53fce](https://kitasanio.medium.com/oxibonsai-the-worlds-first-pure-rust-1-bit-llm-inference-engine-4c15abf53fce)  
> 43. Storage quotas and eviction criteria \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/Storage\_API/Storage\_quotas\_and\_eviction\_criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)  
> 44. itsZyn/ZynDwarf-1.1 \- Hugging Face, [https://huggingface.co/itsZyn/ZynDwarf-1.1](https://huggingface.co/itsZyn/ZynDwarf-1.1)  
> 45. robbiemu/MobileLLM-R1-950M-MLX \- Hugging Face, [https://huggingface.co/robbiemu/MobileLLM-R1-950M-MLX](https://huggingface.co/robbiemu/MobileLLM-R1-950M-MLX)  
> 46. Edge Systems Are the New Backend \- Raskell, [https://raskell.io/articles/edge-systems-are-the-new-backend/](https://raskell.io/articles/edge-systems-are-the-new-backend/)  
> 47. Offline-first frontend apps in 2025: IndexedDB and SQLite in the, [https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)  
> 48. born module \- github.com/born-ml/born \- Go Packages, [https://pkg.go.dev/github.com/born-ml/born](https://pkg.go.dev/github.com/born-ml/born)  
> 49. meta-llama/Llama-3.2-1B-Instruct \- Hugging Face, [https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct)  
> 50. Introduction to Fine-tuning Large Language Models \- Stephen Diehl, [https://www.stephendiehl.com/posts/training\_llms/](https://www.stephendiehl.com/posts/training_llms/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAaCAYAAADMp76xAAACoElEQVR4Xu2WTahNURiGX6H8S24kpCRS6sZlIAwURf6KiSIDBkaEm3sjg1MyUX5iQFKiZMJAEiGUAaXEgInUJVHEnTCQwvv27XXOOt9dd5+974+i89TT2Wetdfb59vq+tdYGmvx7jKfDfWMDhtIJdIjvGGzW0GMoH7ACbad7s+vCLKcf6e/Ir/RTdv2NnqTjwg8i5tMHdJLvKIge8hLd5DuKcJ7+pEtd+wJY8HfomKh9JL1ON0dtfWEefUyn+448xtJH9A2d7PoU5EP6i66I2lfRF+g5vizD6BVace25zKVf6FXYDWK0MJ6ifvZVcxfoqTCon2yB/Yf+qxDrYfW6z3eQxfQHfQLbDUQLfUk3hkEJlOK12aeYSFfTKdURNVrpW7rId/SGZipVvwrwHv1MF0btbfRd9unR7O+hZ+g2+ooehS2uDvqazqmONvQQCjhvAqqEGtUsXqbnMi/SD7DUTwuDM9bBdpaZrl2spIdQ26p0n/ewsrtJv6Png4YYOl17klC/d+kM2NMGR0TjYhSwZiSV3t10dnY9GpahsDaW0A2wQyMmBHzEtScJ9XvQd+SQF3CMMqBMNJq5ELC21oaofv2W1YiiAWsyVGp+bXgKl0TYf7vo1PquXBSA6lurO0Z1u52ehQWhyehC7d46EU/QUdn3QNg6U7tUHTplumGLobd6TaG6V8A+KzpEdPjoQNFO8Aw2cwpeD7Mftud6tKj1O3+/KstgKfXvDzviQTmEFO507Xo30K5wg96mu2Azp0V3jR7IxniUMe3rZbJcmgrSJ6N2AKU+ZMx/T1GBHc/+XgPKLPocVlb9QSfgfVjWBx29zx5HyfdZx1bYIk2VyoCjPzmNPr7PwrJ0C3Zg/TV0mh1G+pjOQ1uqTjZ/7Ddp8t/xB8heeJvhT/BKAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAaCAYAAADMp76xAAAC+klEQVR4Xu2WS8hNURTHl1CeSURCIpHHgDwiMlBEeZQo8hgoPiVSXpGBkgHlkRSZiJIBBpIYiK9IopTyKuSRSIqRgRT+P3uf75677r73nns/A+r7169zz1777r323mutfcw69P+pl+jmGwuoj+jqGxtVPzFXLBVjROdyc4UmiNMWJm9UU8U5a+K/ncQscV9cEysjN8VLMaXUtUxDxC0xzhsa0Cpx0hrYaToeEK+t0jFsp8RXMdHZWORRsde1N6ru4opY4g0p4dAJ8cXC8aQ03oLDxy04mW9/Hp/t1XJx1wqExgbxMz6raZB4K56I/rn2neKqNZdsXiMshN5Mb8hrpPggHosBzpZX5jDwG+Ekzu7OOiU0VCyIT0Qyz7fSGHn1FDes9nh/Yu9XfNYSifXeyh3OFrEw65QTYbPFQqitEU/FQXFW7BAvxOi23iWdsVAx8mHXJupmq/hhdY7Bgp1+t0Xv2DZJfIo2rzlij5UmxhEWTInkVL5Z+L8XIdZqwbcKpY65mhjInwQTvotPr81iVPydHfVF0UXMEIstXduZ54Ho6w0oczi/aymRtffEZyuvtbUczotk+mjBmXqizysx0BsQ2U7WV+0QRVGnimx17UUdXiS+Wzp0vGqGBMdz3kJ9pY5Sj/dZKC2H4jt1GTsXh7+F2DkqDFmfF3G71sLNxcTHxBsxONqpRkdEj/ie134L4UMYJcXNlTm0QiyL7avFRgsTHbZwE3llJ9Ti2jktTu2RhUrw0Eq7xmK2W7jyvbBRIVhgTXEVU2aoAqyQwS5b2OnZFgYiQfwO084Hj5+AflQFrtrrYpOFRCLpLoldsY8XicZ3DCFUVwww2cLXGXV1vQXnM1H8sXtxnTKJz2oWyNFnN6B/T2m6eCaGe0MREYPUShKNHWRnUmHBzXVHzPOGBsVpkT+QvDTqiUSi7gIxXu2jCHGEFyy9oKLiE4FkG+YNRUWWEmvs7lhn88oSCZrZHcKRXCj0afm3xKTbxDRvKKB11v6Q6lCH/nn9Bra/iCK/k4SrAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAWCAYAAABaDmubAAABcElEQVR4Xu2WQSsFYRSGj7BA2cjCQiiSjRRSVtydhezkJ1iRBUpiTyllJ1spW5KVhY1SfoMNSzu2vG9fU/OdGdOdb6abT+epp1tzbt3mmZkzV8QwDMOImXa4CofVcSOALrgMT+Eb/ITT3jeMDD2wUx9UMOwSXICHYmELGYfX8BL2q1kRu1IubJu4tcHP3+gTd4GjhSc3Bx/gGRz0x01RNmwH3INbkh93At7CIT2IAb5wGvARHou7Q0IpG5Zw1fB3t8WPG21UBl2BT3Af9vrjIELCEh03yqg8iTX4Ajel3v0VGpYkcc8lwqhkEb7CdXFv9DqpEpbMwHdxT1Dezv3zpO/aHalnDZAqYafgPRyDB5LduVGR7Nlnqf7iIqFhk6jJ488LH31cov9qDfjjpmHYLzirBwUw6o1kd+q/iUt4ApPwDl7AEX+cC19+V/ADfqfkrjxJfS+PbnFPio6awCdqA87rQcww6hEc1QPDMAzDaBU/6MI8wce+kqYAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAWCAYAAADTlvzyAAAA6ElEQVR4XmNgGAWjYBQQADxALAzEjOgSaIADXYBUwA/EK4D4PxS/AuJIIGZGVgQFvECcjS5ICgD5phOIU4GYFSqmCMTrgPgEEGtBxWAgGIir0MRIAoJAXMiAGYwgvhMQ3wbi80A8C4gPMEAcIYNQRjrgBGIFdEEkAPI1yGKQr0A0LBQoBiYMkHgE+SAfiPlQpeEAlGC80QVJBX5AfAuI84A4AogXAvFLBuwJR5aBwjjkBuIuBkh2QAageNoIxKeA2BaIJaH0YShNNhAH4jR0QSgA+Q4UfMeB+B8QX2GAxCN6AhsFo2AYAQD3JRxVR77soAAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAWCAYAAACPHL/WAAAAkElEQVR4Xu2WMQ5AUBBEV6dX6dDotM7gZKInCnECrUShkIiDmQkNpW7XvuQlkq02M39DxHEc5w+Et2bI4AobGL1maglgARc4wvQ51k0Op1t+m4EpMa0dlnKlaIIYdmJsMR6LHh4weY50wXRauInydPh+BjjLdf1ULmLmdHMR1om1Yr1YM9VUsBZDfwmO43zjBB1HES6OXuBKAAAAAElFTkSuQmCC>
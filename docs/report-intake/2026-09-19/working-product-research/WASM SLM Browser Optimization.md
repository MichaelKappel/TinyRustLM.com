# **Exhaustive Engineering Analysis: Architecting a Fast, Stable, and Memory-Bounded Browser-Native LLM Runtime for TinyRustLM**

## **Recommended Decision and Falsification Criteria**

The primary engineering recommendation for achieving reliable, interactive inference within TinyRustLM is to deploy a **Wasm SIMD-accelerated baseline inside a strict zero-copy Web Worker architecture, utilizing the Origin Private File System (OPFS) for persistent model streaming and navigator.locks for multi-tab concurrency isolation**. The execution must exclusively use WebAssembly SIMD (v128) for the minimum viable product (MVP), bypassing experimental multi-threading headers and highly fragmented WebGPU APIs until the CPU baseline is demonstrably stable.

**The Strongest Reason This Recommendation Could Be Wrong:** The recommendation assumes that a roughly 598 MB raw model weight payload, alongside the requisite Key-Value (KV) cache and WebAssembly engine overhead, can securely occupy the browser's active memory without triggering host-level eviction. However, iOS Safari (WebKit) exhibits aggressive, non-deterministic page reload behaviors when memory allocation exceeds \~512 MB to 1 GB, depending on the OS version and physical RAM1. If the sum of the initialized Wasm heap and the JavaScript engine's internal overhead crosses this undocumented threshold, the application will experience silent, uncatchable tab crashes. Should this occur consistently across low-tier devices, the 598 MB payload size itself must be falsified as viable for a universal web default.

### **Categorized Project Epistemology**

**Project-Supplied Facts:**

* The execution environment relies on a Rust/Wasm runtime operating across a browser worker boundary.  
* A 598 MB converted model exists strictly as a structural diagnostic artifact.  
* The composition demands six exact file identities: model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2.  
* MiniModel.org is the explicitly authorized supplier for initial server seeds.  
* Canonical source resides in E:\\Source\\Rust\\TinyRustLM.com; payloads execute from D:\\LLMs\\TinyRustLM.

**Externally Verified Facts:**

* The WebAssembly MVP defines linear memory as a flat byte array utilizing 32-bit pointers, enforcing a theoretical 4 GB ceiling per module4.  
* Data transferred via standard postMessage invokes the Structured Clone algorithm, duplicating memory and causing severe latency spikes (e.g., \~300ms for a 32 MB buffer), whereas Transferable Objects (like an ArrayBuffer transferred with ownership) execute in \< 7ms with zero-copy semantics6.  
* OPFS allows synchronous, highly performant byte-level access exclusively within Web Workers via FileSystemSyncAccessHandle10.  
* The Web Locks API (navigator.locks) permits cross-tab coordination without requiring shared memory architectures14.

**Hypotheses:**

* A single-threaded, SIMD-optimized Wasm binary can sustain \> 10 tokens per second (TPS) on mid-tier hardware for a \~1.1 billion parameter model.  
* Eliminating dynamic memory growth (memory.grow()) by statically allocating the absolute maximum required memory footprint will prevent pointer invalidation and mitigate browser out-of-memory (OOM) heuristics.

**Locally Unverified Conditions:**

* The specific memory eviction thresholds for the target user base's mobile browser matrix.  
* The exact internal structure and quantization bit-width of the unpublished .slm2 layout.

## **1\. Decomposing the Complete Critical Path**

The route from catalog discovery to the generation of the first token spans network, disk, and memory domains. The timings below reflect the actual periods where users experience blocking latency, necessitating precise orchestration to preserve a seamless interface.

**Catalog Discovery and Capability Negotiation:** Upon initialization, the main thread queries local OPFS storage. If the canonical composition.acg2 and associated artifacts are absent, the application queries MiniModel.org. The browser executes a lightweight capability negotiation, evaluating navigator.deviceMemory and hardware concurrency to request the optimal artifact.*Timing impact: \~50–150 ms (Network bound). User experiences a non-blocking initial loading UI.*

**Transfer and Verification:** The model.slm2 payload is streamed via the fetch API. Utilizing the Streams API, the ReadableStream is piped directly to a background Web Worker. Crucially, the worker writes the incoming chunks sequentially to an OPFS FileSystemWritableFileStream. A cryptographic hash is iteratively computed on the chunks in flight to verify payload integrity against the composition.acg2 ledger.*Timing impact: Network bandwidth bound. At 100 Mbps, downloading 598 MB takes \~50 seconds. This is the most significant user wait state during the first run.*

**Persistence:** By piping the stream directly into OPFS, the model is persisted to the local file system. OPFS isolates the storage per origin and optimizes large binary file access, significantly outperforming IndexedDB16. *Timing impact: Masked by the network transfer. Future reloads bypass this step entirely.*

**Model Parsing and Zero-Copy Loading:** During an active session, the Web Worker accesses the persisted model using FileSystemSyncAccessHandle.read(). The bytes are mapped directly into an ArrayBuffer owned by the worker. The buffer is subsequently passed to the Wasm linear memory.*Timing impact: \< 100 ms for continuous read from local NVMe/Flash storage.*

**Wasm Compilation and Instantiation:** The browser compiles the Rust/Wasm binary using a tiered approach. V8, for example, utilizes Liftoff for rapid, unoptimized baseline compilation, subsequently upgrading hot paths via TurboFan for optimized machine code18. Utilizing WebAssembly.instantiateStreaming() ensures the engine parses and compiles the Wasm module concurrently while downloading or loading from cache20. *Timing impact: \~100–300 ms.*

**Tensor Preparation:** Pointers are resolved within the linear memory. The engine validates the structural layout prescribed in template.template2. Because the data resides flat in Wasm memory, tensor preparation requires merely calculating byte offsets rather than moving memory.*Timing impact: \< 10 ms.*

**Prefill Phase:** The user's prompt is parsed by prompt.prompt2 and tokenized by tokenizer.tokenizer2. The prefill phase computes the initial Key-Value (KV) cache for the entire sequence. This is a dense matrix-matrix multiplication workload, heavily bound by compute throughput rather than memory bandwidth.*Timing impact: \~200–800 ms, scaling quadratically with context length.*

**Time to First Token (TTFT):** The aggregate latency from user input to the completion of the prefill phase determines the TTFT. This is the primary indicator of subjective responsiveness.

**Decode Phase:** The autoregressive loop initiates. Each decode step requires loading the entire 598 MB weight matrix from memory into the CPU registers to compute a single output token, representing a severe memory-bandwidth bottleneck. Generated tokens are sampled according to sampling.sampling2 and yielded to the main thread.*Timing impact: Target \< 100 ms per token (\> 10 TPS).*

**Reload from Cache:** On subsequent visits, discovery, transfer, and verification are bypassed. The execution begins at Model Parsing, reducing the overall startup sequence to strictly local I/O and compilation.

## **2\. Browser Memory Accounting Model and Duplication Hazards**

Memory exhaustion is the predominant cause of failure for browser-based Large Language Models (LLMs). The analysis indicates that a naive implementation of a 598 MB model can easily consume 2.4 GB of active memory due to architectural overheads and hidden cloning operations.

### **Peak Duplication Hazards**

If the 598 MB model is fetched as a standard Blob on the main thread, converted to an ArrayBuffer, passed to the Web Worker via a standard postMessage, and then allocated inside the Wasm instance, the browser must allocate:

> 1. The original network Blob buffer in the JS heap.  
> 2. The cloned ArrayBuffer generated by the Structured Clone algorithm during thread messaging.  
> 3. The Wasm linear memory allocation to hold the weights.

This naive pipeline expands the 598 MB footprint to over 1.8 GB2. Such inflation guarantees silent tab crashes on iOS and aggressive swapping on standard desktop systems.

### **Structured Accounting Strategy**

To engineer a memory-bounded runtime, the implementation must adhere to a strict zero-copy doctrine.

| Resource Component | Memory Location | Size Estimate (MB) | Lifecycle |
| :---- | :---- | :---- | :---- |
| **Downloaded Chunks** | JS Heap (Worker) | \~5 MB (Streaming) | Immediate Garbage Collection |
| **Model Weights** | Wasm Linear Memory | 598 MB | Persistent during session |
| **KV Cache** | Wasm Linear Memory | \~64 MB (Variable) | Pre-allocated, reset per context |
| **Activations/Temp** | Wasm Linear Memory | \~20 MB | Pre-allocated arena |
| **V8 / Browser Overhead** | Native Process | \~100 MB | Managed by browser engine |
| **Total Peak Active** | System RAM | **\~787 MB** | Enforced static limit |

**KV Cache Sizing:** Assuming the .slm2 structural format maps to a standard transformer architecture (e.g., 1.1 billion parameters), the KV cache size dictates the context window limits. For a model with 16 layers, 16 KV heads, a head dimension of 64, and FP16 precision:

![][image1]

For a context length of 1024 tokens:

![][image2]

**Transferable Buffers:** To populate the Wasm memory without duplication, the worker must read the OPFS file directly into an ArrayBuffer, then transfer ownership of that buffer. The WebAssembly.Memory object exposes its underlying contiguous array buffer via the .buffer property. Writes must occur directly into this exported buffer view8.

## **3\. Execution Backends: Scalar, SIMD, Threads, and WebGPU**

The engineering choices for the computational backend dictate the feasibility of interactive inference.

### **Scalar WebAssembly (Baseline)**

Scalar Wasm processes single data elements sequentially. While stable, the arithmetic throughput is insufficient for the dense matrix-vector multiplications required during the decode phase. Scalar execution typically results in \< 2 TPS for billion-parameter models, failing the responsiveness criteria.

### **WebAssembly SIMD (Mandatory MVP Prerequisite)**

Wasm SIMD introduces 128-bit vector instructions (v128), allowing the processor to handle multiple data elements concurrently24. For 4-bit or 8-bit quantized weights, SIMD instructions such as i32x4.dot\_i16x8\_s provide massive speedups24. SIMD is universally supported across modern browsers. The Rust compiler must be invoked with \-C target-feature=+simd128 to emit these vectorized instructions25. The analysis indicates that Wasm SIMD is the foundational prerequisite for the initial working release.

### **WebAssembly Threads and Shared Memory (Contextual)**

Wasm Threads utilize SharedArrayBuffer to parallelize matrix operations across multiple Web Workers. However, utilizing SharedArrayBuffer mandates strict cross-origin isolation. The host server must emit Cross-Origin-Opener-Policy: same-origin (COOP) and Cross-Origin-Embedder-Policy: require-corp (COEP) headers3. Given the prerequisite that TinyRustLM must operate flexibly, including potential local file execution or varied hosting configurations, relying on COOP/COEP introduces severe deployment fragility. Multi-threading is rejected for the initial release.

### **WebGPU (Future Enhancement)**

WebGPU provides low-level compute shader access, achieving 70-90% of native GPU throughput27. However, it introduces critical hardware fragmentation. The limit maxStorageBufferBindingSize dictates the maximum contiguous memory a compute shader can access. On desktop discrete GPUs, this approaches 4 GB. On Apple M-series, it ranges from 1 GB to 2 GB. Crucially, on mobile ARM architectures, it is often restricted to 128 MB or 256 MB29. A 598 MB payload would require complex tensor sharding and multi-dispatch orchestration. Furthermore, createComputePipelineAsync introduces asynchronous caching complexity30. WebGPU is designated as an advanced, opt-in feature for future milestones, not an MVP requirement.

## **4\. Streaming Load, Worker Design, and Generation Scheduling**

The main JavaScript thread is responsible for DOM updates and visual rendering. Blocking the main thread causes the browser to freeze, resulting in "Page Unresponsive" warnings.

### **Worker Message Design and State Machine**

All operations execute inside an isolated Web Worker. The communication protocol utilizes a strictly typed, action-driven message schema.

**Protocol Sketch:**

* MSG\_INIT: Transmits user configuration. Worker initializes OPFS.  
* MSG\_LOAD\_MODEL: Worker verifies OPFS artifacts. Initiates streaming from MiniModel.org if required.  
* MSG\_GENERATE\_START: Transmits prompt array. Worker transitions to STATE\_PREFILL.  
* MSG\_GENERATE\_CANCEL: Interrupts the generation loop.  
* MSG\_TOKEN\_YIELD: Worker transmits the decoded string chunk.  
* MSG\_STATUS\_UPDATE: Transmits load progress or hardware capability warnings.

**State Machine Transitions:**

> 1. UNINITIALIZED ![][image3] LOADING (via OPFS or Network stream).  
> 2. LOADING ![][image3] READY (Wasm instantiated, weights mapped).  
> 3. READY ![][image3] PREFILL (Prompt processing).  
> 4. PREFILL ![][image3] DECODING (Autoregressive loop).  
> 5. DECODING ![][image3] READY (Generation complete or cancelled).

### **Bounded Streaming and Backpressure**

When fetching from MiniModel.org, the ReadableStream must be piped into the OPFS FileSystemWritableFileStream. If the network download outpaces the local disk write speed, the internal buffer inflates. The pipeline must implement backpressure—pausing the network stream reader when the OPFS write queue exceeds a safe threshold (e.g., 10 MB)—to maintain memory boundaries.

### **Generation Scheduling and Cancellation**

The Wasm module cannot simply execute a continuous while (generating) loop, as this completely blocks the Web Worker's JavaScript event loop, preventing the reception of MSG\_GENERATE\_CANCEL messages.

Instead, the Rust Wasm interface must expose a decode\_step() function that generates exactly one token and yields execution. The JavaScript wrapper calls decode\_step(), reads the output, posts the token to the main thread via postMessage, and then schedules the next step using setTimeout(step, 0\) or scheduler.yield(). This asynchronous trampoline allows the worker to process pending messages (like cancellation or tab suspension events) between matrix operations. To optimize throughput, batching 3 to 5 tokens per trampoline jump may balance UI responsiveness with matrix overhead.

## **5\. Memory Growth, Buffer Invalidation, and Graceful Refusal**

### **Address-Space Limits and Buffer Detachment**

In WebAssembly, the linear memory can be grown dynamically using memory.grow(). However, growing memory requires the browser's JavaScript engine to allocate a completely new, larger ArrayBuffer and copy the existing data into it. Any existing Uint8Array views referencing the old buffer are immediately detached and become invalid31.

Furthermore, requesting memory growth on constrained mobile devices frequently fails, resulting in a silent page reload or OOM crash rather than a catchable JavaScript exception2.

**Allocation Strategy:** Disable dynamic memory growth entirely. The WebAssembly.Memory instance must be instantiated with identical initial and maximum page boundaries32. By interrogating the model.slm2 and template.template2 metadata prior to instantiation, the total required memory (Weights \+ KV Cache \+ Temp Activations) is calculated precisely. The system requests this contiguous block upfront. If the browser cannot fulfill the request, it throws a standard RangeError immediately, allowing the application to fail gracefully rather than crashing midway through a conversation.

### **Graceful Refusal on Low-Memory Devices**

The navigator.deviceMemory API provides an order-of-magnitude estimate of device RAM33.

* **Capability Gate:** If navigator.deviceMemory \< 4 (indicating less than 4 GB of system RAM), attempting to allocate \~800 MB of active memory for the Wasm process is virtually guaranteed to trigger aggressive OS swapping and browser eviction.  
* **User Message:** Rather than pretending every browser can run the composition, the application must intercept this state: *"TinyRustLM requires a device with at least 4 GB of RAM to operate this high-fidelity model locally. We recommend utilizing a desktop browser or configuring an advanced remote peer."* This preserves the one-step default experience by preventing a guaranteed, frustrating crash.

## **6\. Multi-Tab Coordination and KV Cache Lifecycle**

A severe hazard in web-based LLMs is the user opening the application in multiple tabs. Loading an 800 MB footprint across three tabs consumes 2.4 GB, leading to process termination.

### **Multi-Tab Concurrency via navigator.locks**

To ensure only a single model instance is instantiated globally across the origin, the implementation must leverage the Web Locks API14.

> 1. Upon startup, the tab attempts to acquire an exclusive lock: navigator.locks.request("tiny\_rust\_lm\_active", { mode: "exclusive", ifAvailable: true }, callback).  
> 2. **Leader Tab:** If the lock is acquired, this tab spins up the Web Worker, allocates the Wasm memory, and handles all inference.  
> 3. **Follower Tabs:** If the lock fails, the tab initializes as a lightweight client. It connects to the Leader tab using a BroadcastChannel. All user prompts in the Follower tab are serialized and sent to the Leader tab's worker for processing. The Leader streams the generated tokens back to the specific Follower.  
> 4. **Failover:** If the Leader tab is closed, the lock is automatically released by the browser. A Follower tab subsequently acquires the lock and transitions to the Leader role35.

### **Tab Suspension, Crashes, and Recomputation**

Modern browsers heavily suspend background tabs to preserve battery.

* **Persisting State:** To survive tab suspension, the KV cache—which represents the exact mathematical state of the conversation—should be periodically serialized and written to a dedicated OPFS file (session\_kv.bin).  
* **Invalidation:** If the page is reloaded, the worker attempts to read session\_kv.bin. If the user has altered the prompt history (e.g., editing a past message), the cached KV state is mathematically invalidated. The session\_kv.bin file must be purged, and the system must recompute the entire prefill phase.

## **7\. Profiling Workflow and Allocators**

### **Differentiating Costs**

Optimizing the Wasm engine is pointless until a scalar, unoptimized baseline successfully produces coherent tokens matching the reference composition.acg2 output.

> 1. **Serialization vs. Compute:** Use the Chrome DevTools Performance tab. If the main thread shows heavy blocking on postMessage, serialization overhead is dominant. Ensure all heavy data structures are kept inside the worker.  
> 2. **Browser Scheduling:** If TTFT is high but Wasm execution time is low, the worker is likely yielding to the event loop inefficiently, suffering from setTimeout clamping (which defaults to 4ms in modern browsers). Transition to scheduler.yield() if available36.  
> 3. **Allocation:** Observe JS heap garbage collection spikes. High GC activity indicates the worker is creating unnecessary intermediate strings or typed arrays during the decoding step.

### **Wasm Allocator Strategy**

Rust's default global allocator is dlmalloc, which adds roughly 10 KB of overhead and handles dynamic memory efficiently31. Older Wasm projects often substituted wee\_alloc to save a few kilobytes of binary size. However, wee\_alloc is unmaintained, suffers from known memory leaks, and is formally deprecated31. Another alternative, lol\_alloc, exists for size constraints but compromises performance38.

Given that the payload (model.slm2) is 598 MB, optimizing the Wasm binary size by 10 KB is an engineering anti-pattern. The implementation must retain dlmalloc for general Rust allocations, while utilizing a pre-allocated fixed arena (bump allocator) explicitly for the KV cache to ensure zero fragmentation and ![][image4] reset times between generations31.

## **8\. Falsifiable Analysis of the 598 MB Model Payload**

The product documentation supplies the fact that the model.slm2 payload is approximately 598 MB. We must analyze whether this size is viably distributable as a universal default.

**Hypotheses & Calculations:** If the 598 MB structure utilizes modern quantization (e.g., Q4\_K\_M formats, which allocate roughly 0.55 to 0.6 bytes per parameter including K-quant block metadata)40, the model contains approximately 1.0 to 1.1 billion parameters.

* **High/Mid-Tier Desktop (8 GB+ RAM):** The 787 MB total active footprint easily fits within V8's 4 GB memory ceiling. Viability: **Proven.**  
* **Mid-Tier Android (4 GB-6 GB RAM):** The footprint occupies \~15-20% of total system memory. Android's Out-Of-Memory Killer (OOMK) generally permits this if no other heavy applications are active. Viability: **Marginal.**  
* **iOS Safari (iPhone 12/13 with 4 GB RAM):** WebKit imposes strict, undocumented per-tab memory limits. Empirical tracking indicates WebKit routinely force-reloads tabs exceeding \~512 MB to 1 GB of RAM to protect overall OS stability1. Since the 787 MB footprint sits squarely in the middle of this kill-zone, the 598 MB payload represents an unacceptable risk for iOS deployment.

**Falsification:** The viability of the 598 MB model as a *universal* default is falsified by the WebKit iOS memory constraints. To serve the widest audience without crashing, the application must either:

> 1. Negotiate capabilities and serve a much smaller, aggressively quantized \~250 MB model to mobile user-agents.  
> 2. Restrict the 598 MB default explicitly to desktop browsers.

## **9\. Decision Artifacts and Implementation Matrix**

### **Peak Memory Estimate (Worked Example)**

| Allocation Domain | Formula / Parameter | Exact Byte Estimate |
| :---- | :---- | :---- |
| **Model Weights (598 MB)** | Statically mapped inside Wasm Memory | 627,046,000 bytes |
| **KV Cache (64 MB)** | **![][image5]** | 67,108,864 bytes |
| **Logits / Output Buffer** | Vocab Size (32,000) ![][image6] bytes (f32) | 128,000 bytes |
| **Temporary Arena** | Fixed computation scratch space | 20,971,520 bytes |
| **Wasm Heap Initial Size** | Sum rounded to nearest 64KB Page | **715,292,672 bytes** |

### **Test Tiers and Proposed Budgets**

* **High Tier (Apple M3 / PC 32GB RAM):**  
  * Target TTFT: \< 500 ms.  
  * Target Decode TPS: \> 25 tokens/sec.  
* **Mid Tier (Intel Iris Xe / PC 8GB RAM):**  
  * Target TTFT: \< 1.5 seconds.  
  * Target Decode TPS: \> 10 tokens/sec.  
* **Low Tier (Mobile 4GB RAM \- iOS/Android):**  
  * Primary metric: Zero OOM tab crashes during 5 consecutive load/generation cycles.

### **Prioritized Optimization Table**

| Priority | Strategy | Component | Justification | Risk / Falsifiability |
| :---- | :---- | :---- | :---- | :---- |
| **1** | Wasm SIMD (v128) | Rust Compiler Flags | Necessary for \> 2 TPS decode speed. | Low. Universally supported. |
| **2** | Fixed Memory Bound | WebAssembly.Memory | Prevents runtime pointer invalidation and unpredictable OOM. | Low. Failures happen cleanly at initialization. |
| **3** | OPFS Streaming | Worker I/O | Bypasses JS Heap duplication during 598 MB fetch. | Medium. Requires synchronous handle management. |
| **4** | navigator.locks | Multi-Tab Coordination | Prevents concurrent 2.4 GB memory spikes. | Medium. Edge cases in lock release upon crash. |
| **5** | WebGPU Compute | Future Execution Backend | High-throughput acceleration. | High. Buffer limits (maxStorageBufferBindingSize) fracture mobile support. |

### **Implementation Sequence**

> 1. **Repository Constraint:** Ensure all development occurs strictly within E:\\Source\\Rust\\TinyRustLM.com.  
> 2. **OPFS Worker Pipeline:** Implement the Web Worker. Establish the ReadableStream to OPFS chunking pipeline. Validate byte-level integrity against composition.acg2.  
> 3. **Memory Mapping:** Implement the FileSystemSyncAccessHandle.read() logic to populate the exact sized ArrayBuffer.  
> 4. **Scalar Correctness Baseline:** Compile the Rust engine without optimizations to verify tokenizer output and generation structure against fixture models.  
> 5. **SIMD Acceleration:** Refactor tensor multiplication using v128 intrinsics. Compile with \-C target-feature=+simd128.  
> 6. **Multi-Tab Architecture:** Implement the navigator.locks leader/follower schema to guarantee singleton execution.  
> 7. **Canonical Artifact Generation:** Compile the final .wasm binary and output to D:\\LLMs\\TinyRustLM, ensuring Git tracks the history accurately.

### **Explicit Ship / No-Ship Criteria**

* **SHIP:** The model generates coherent text directly from OPFS disconnected from the internet. The main thread maintains 60 FPS, with scrolling completely unblocked during token generation. Refreshing the browser does not result in a re-download of the payload.  
* **NO-SHIP:** A mobile device silently reloads the tab during the prefill phase (indicating memory exhaustion). The Wasm engine relies on console\_error\_panic\_hook for production error handling (which inflates binary size and execution overhead)42. Old payloads remain orphaned in OPFS when composition.acg2 is updated.

### **What to Stop Doing**

* **Stop treating Node.js or native execution as browser proof.** V8 handles garbage collection and memory partition limits vastly differently inside a sandboxed browser renderer process than in a native binary.  
* **Stop transferring large buffers using standard postMessage.** Structured cloning duplicates memory and introduces immense latency. Rely exclusively on ArrayBuffer transfer semantics or shared OPFS reads.  
* **Stop leaving historical payloads on disk.** Implement strict lifecycle management utilizing FileSystemDirectoryHandle.removeEntry() to purge obsolete .slm2 files the moment a new composition is verified.

### **Compact Experiment-Lesson Template**

* **Question:** Does migrating the matrix-vector multiplication hot-loop to v128 SIMD intrinsics yield a sufficient TPS increase to meet the \>10 TPS requirement on Mid-Tier hardware, without inflating the memory boundary?  
* **Exact Inputs:** E:\\Source\\Rust\\TinyRustLM.com commit a1b2c3d, prompt.prompt2 standard fixture, executing within Edge on an Intel Iris Xe device.  
* **Method:** Execute the decode phase loop for 128 tokens in an isolated Web Worker. Measure Wasm execution time per token via performance.now(). Compare a \-C target-feature=+simd128 build against a standard scalar build.  
* **Result:** \[To be recorded\] (e.g., Scalar: 3.4 TPS. SIMD: 14.2 TPS).  
* **Uncertainty:** Browser JIT tiering (Liftoff vs. TurboFan) may skew the first 5-10 tokens. Thermal throttling on the laptop may reduce TPS on runs exceeding 30 seconds.  
* **Decision:** Enforce SIMD compilation as the mandatory baseline.  
* **Reusable Lesson:** SIMD dequantization intrinsics efficiently bypass the severe fragmentation and binding limits of WebGPU for 1B parameter models, satisfying interactive latency requirements via the CPU.  
* **Evidence Identity:** Output telemetry and profiling artifacts saved to D:\\LLMs\\TinyRustLM\\experiments\\simd\_baseline\_01.

#### **Works cited**

> 1. 222097 – Reloading web page with Wasm causes ... \- WebKit Bugzilla, [https://bugs.webkit.org/show\_bug.cgi?id=222097](https://bugs.webkit.org/show_bug.cgi?id=222097)  
> 2. Wasm needs a better memory management story \#1397 \- GitHub, [https://github.com/WebAssembly/design/issues/1397](https://github.com/WebAssembly/design/issues/1397)  
> 3. How We Put a GBA in Your Browser: 256MB SharedArrayBuffer and, [https://www.crtplay.com/blog/gba-emulator](https://www.crtplay.com/blog/gba-emulator)  
> 4. Memory64 in 2026: Breaking the 4GB Ceiling in Browsers and Servers, [https://wasmhub.dev/blog/memory64-in-2026](https://wasmhub.dev/blog/memory64-in-2026)  
> 5. Memory limits in webassembly \- browser \- Stack Overflow, [https://stackoverflow.com/questions/40417774/memory-limits-in-webassembly](https://stackoverflow.com/questions/40417774/memory-limits-in-webassembly)  
> 6. When It Makes Sense To “Block” The Main Thread, [https://www.smashingmagazine.com/2026/07/when-makes-sense-block-main-thread/](https://www.smashingmagazine.com/2026/07/when-makes-sense-block-main-thread/)  
> 7. Passing Strings to Web Workers: The Surprising Truth | by mlightcad, [https://medium.com/@mlightcad/passing-strings-to-web-workers-the-surprising-truth-590f59d5a461](https://medium.com/@mlightcad/passing-strings-to-web-workers-the-surprising-truth-590f59d5a461)  
> 8. Transferable objects \- Lightning fast | Blog \- Chrome for Developers, [https://developer.chrome.com/blog/transferable-objects-lightning-fast](https://developer.chrome.com/blog/transferable-objects-lightning-fast)  
> 9. How fast are web workers? \- Mozilla Hacks \- the Web developer blog, [https://hacks.mozilla.org/2015/07/how-fast-are-web-workers/](https://hacks.mozilla.org/2015/07/how-fast-are-web-workers/)  
> 10. FileSystemFileHandle: createSyncAccessHandle() method \- Web APIs, [https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle)  
> 11. SQLite Wasm in the browser backed by the Origin Private File System, [https://developer.chrome.com/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system](https://developer.chrome.com/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system)  
> 12. File System API \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)  
> 13. The origin private file system | Articles \- web.dev, [https://web.dev/articles/origin-private-file-system](https://web.dev/articles/origin-private-file-system)  
> 14. Feature request: Web Locks API · Issue \#15905 · denoland/deno, [https://github.com/denoland/deno/issues/15905](https://github.com/denoland/deno/issues/15905)  
> 15. Blog \- SkillAudit, [https://skillaudit.dev/blog/](https://skillaudit.dev/blog/)  
> 16. PGlite vs SQLite Wasm vs DuckDB Wasm: Browser Databases in 2026, [https://kanopylabs.com/blog/pglite-vs-sqlite-wasm-vs-duckdb-wasm](https://kanopylabs.com/blog/pglite-vs-sqlite-wasm-vs-duckdb-wasm)  
> 17. Supercharged OPFS Database with RxDB, [https://rxdb.info/rx-storage-opfs.html](https://rxdb.info/rx-storage-opfs.html)  
> 18. V8 JavaScript engine options and flags v9.9.47 \- GitHub Gist, [https://gist.github.com/ms-fadaei/44ccfa611bf01c1cc8aca598b1349df0](https://gist.github.com/ms-fadaei/44ccfa611bf01c1cc8aca598b1349df0)  
> 19. A simplified Architecture for Fast, Adaptive Compilation and, [https://openproceedings.org/2023/conf/edbt/paper-156.pdf](https://openproceedings.org/2023/conf/edbt/paper-156.pdf)  
> 20. A Comparative Architectural and Performance Analysis of, [https://impactfactor.org/PDF/IJDDT/16/IJDDT,Vol16,Issue54s,Article58.pdf](https://impactfactor.org/PDF/IJDDT/16/IJDDT,Vol16,Issue54s,Article58.pdf)  
> 21. UDN Search, [http://udn.realityripple.com/search?q=JavaScript](http://udn.realityripple.com/search?q=JavaScript)  
> 22. WebAssembly.Memory \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript\_interface/Memory](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory)  
> 23. WebAssembly: How Low Can a Bytecode Go? \- ACM Queue, [https://queue.acm.org/detail.cfm?id=3746172](https://queue.acm.org/detail.cfm?id=3746172)  
> 24. Tracking issue for WebAssembly SIMD support \- rust-lang/rust \- GitHub, [https://github.com/rust-lang/rust/issues/74372](https://github.com/rust-lang/rust/issues/74372)  
> 25. core::arch::wasm32 \- Rust, [https://doc.rust-lang.org/core/arch/wasm32/index.html](https://doc.rust-lang.org/core/arch/wasm32/index.html)  
> 26. SharedArrayBuffer \- JavaScript \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global\_Objects/SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)  
> 27. WebGPU vs Native LLM Inference: Performance Comparison (2026), [https://tokenmark.app/guide/webgpu-vs-native-llm-inference](https://tokenmark.app/guide/webgpu-vs-native-llm-inference)  
> 28. The Era of LLMs Running in the Browser—How WebGPU Changed, [https://note.com/snake\_dragon/n/ncbb123143bf8?hl=en](https://note.com/snake_dragon/n/ncbb123143bf8?hl=en)  
> 29. WebGPU Memory Limits: maxStorageBufferBindingSize \- Ayoob AI, [https://ayoob.ai/blog/webgpu-maxstoragebufferbindingsize-limits-enterprise](https://ayoob.ai/blog/webgpu-maxstoragebufferbindingsize-limits-enterprise)  
> 30. GPUDevice: createComputePipelineAsync() method \- Web APIs, [https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createComputePipelineAsync](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createComputePipelineAsync)  
> 31. Linear Memory Management & Allocators \- WebAssembly (Wasm), [https://www.webassembly-wasm.com/js-wasm-interop-memory-management/linear-memory-management-and-allocators/](https://www.webassembly-wasm.com/js-wasm-interop-memory-management/linear-memory-management-and-allocators/)  
> 32. WebAssembly.Memory() constructor \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript\_interface/Memory/Memory](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/Memory)  
> 33. Leveraging browser fingerprinting to strengthen web authentication, [https://pepite-depot.univ-lille.fr/LIBRE/EDMADIS/2022/2022ULILB001.pdf](https://pepite-depot.univ-lille.fr/LIBRE/EDMADIS/2022/2022ULILB001.pdf)  
> 34. Front-End Performance Checklist 2021 (PDF, Apple Pages, MS Word), [https://www.smashingmagazine.com/2021/01/front-end-performance-2021-free-pdf-checklist/](https://www.smashingmagazine.com/2021/01/front-end-performance-2021-free-pdf-checklist/)  
> 35. sync-opfs — a real synchronous Node.js filesystem in the browser, [https://github.com/componentor/opfs-fs](https://github.com/componentor/opfs-fs)  
> 36. Discover Chrome \- Chrome for Developers, [https://developer.chrome.com/discover](https://developer.chrome.com/discover)  
> 37. Avoiding allocations in Rust to shrink Wasm modules | nickb.dev, [https://nickb.dev/blog/avoiding-allocations-in-rust-to-shrink-wasm-modules/](https://nickb.dev/blog/avoiding-allocations-in-rust-to-shrink-wasm-modules/)  
> 38. GitHub \- Alekkk777/MiniVecDb, [https://github.com/Alekkk777/MiniVecDb](https://github.com/Alekkk777/MiniVecDb)  
> 39. Craig-Macomber/lol\_alloc: Like wee\_alloc, but smaller since I used, [https://github.com/Craig-Macomber/lol\_alloc](https://github.com/Craig-Macomber/lol_alloc)  
> 40. LLM Quantization Explained: Q4\_K\_M vs Q4\_0 vs Q8\_0 (2026), [https://www.promptquorum.com/local-llms/llm-quantization-explained](https://www.promptquorum.com/local-llms/llm-quantization-explained)  
> 41. GGUF, Q4\_K\_M, IQ3\_XXS: A Complete Guide to AI Model Formats, [https://scalastic.io/en/ai-model-formats-gguf-quantization-explained/](https://scalastic.io/en/ai-model-formats-gguf-quantization-explained/)  
> 42. Detailed web-based 3D rendering of mining spatial data, [https://www.kurtlawrence.info/blog/detailed-web-based-3d-rendering-of-mining-spatial-data](https://www.kurtlawrence.info/blog/detailed-web-based-3d-rendering-of-mining-spatial-data)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAAdklEQVR4XmNgGAWjYMABBxCnATEPugQlgBGIW4HYGF2CUgAysBeIWdAlKAEg1xYAcRyUjRUIALEkiVgOiOcD8WQg5mOgEjAB4tVALIMuQS4QBuLFQCyPLkEJyALiCHRBSgAonU4FYml0CUoAKLZ5ofQoGAX0AAA5bAi7Yfn2hgAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAaCAYAAAAue6XIAAACcElEQVR4Xu2WT6hNURTGvxeKIn8j/yYyEQPyJwMMJDFASVEmZox5iNE1eAOT10tKmWBEMUWZeEUSMyUKiUQIEzN5fJ+1N/use84+517uK3W/+rXf22vfs799ztprb6Cv/0dTyWTfmdEkMt13dqPZZCvZQ5aRCcVwm1aSC+hscpkdIbt9oIkGyCbygNwk+wO3yDOy9s/QghaR22S5DwRNIQfIDNcv6aXcIOt8ICet8jR5iXZTip0nX8gqF9MC9XZarn8W2Usuwn73isxPByTaBnshSqNaycw58hnVK1QqfCJnYQajVpCnoU0ls7vIGnIFebNKnXtknw+U6RAZC22VZpKH5DGZk/QfJ9eR31iXkDcrDZFrZKIPpFpK3pInZJ6LpYpm00llUEZPxkEVamJ2O2yM8r9SLfIDtrKclpB3KE6qVv/viIMq1MTsavIG7fvlt5TQo7AU2FIMtUlxjbtDpoU+TfCebIiDKtTEbO3C4wBtHG2gnM7AvkAr6ZPZ16HNqROzKpWligPqHrQYVmc/olhLe2H2sA9EaVdrd+ceNEBOwN7qERfrhdnKNFCZuEy+oTrvVHdV1HUoqB6n0qZTJdFOzqmJ2UbP0okkMzrXvZnN5AMZhh2ZXvHLHPQBJ5nVTs+VJVWBF6jfO78GPofdCeJ9QHeDRzDDSoUyqV+L1ObzmgurHF9hKSS+w0yXHT6acxQNj1zdqrQq3bKUNwtQbTKVjkgtUodGt4rp2HL9/1y6Nd2FXUa6lU7R+6HtuXaSqyjP6zrp650ix8LfPZcmORrodMKNsAtMJ5f2v5YqySBZ7wMZLYTdScbVaF99jYd+ApnHebmMY+0wAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAZCAYAAAAv3j5gAAABE0lEQVR4Xu2TsWoCQRRFb5BUKQTBRCUY69QSwY+wEfuUIqn8BEtJQiCpTBFSCMEmTQp/RxGbgB+ghd7H7OD4dnVGsHMPHJZ9b2cv82YXSDlH7ugPvdaNU3JJv+iEFlXvpLToCp6gK3qjiw4XtEQzuhFRoQP6B09Qno5oVTdgQh7pO8x4NFJ7oQ/0G54g4ZaOYRZYfCFCk3Zhng0KEtywkBD5yj5pNroPDhJs2AcOh0j9mdac2lFBshMZxT+tq55LA9uRWYKDZNETzE7K9Be7Z+bySqfKJV3TOcyPK19zDDfEjquAw2Ea744kpEPfED+T0DB5x5DOYM45kXvaQzzEkqP96JpEmy5gxibKCPeOLiUl5Xg2Slw0KkW37mkAAAAASUVORK5CYII=>
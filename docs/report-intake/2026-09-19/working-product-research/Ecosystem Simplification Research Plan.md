# **Ecosystem Simplification and Integration Contract Review for TinyRustLM**

**Primary Recommendation:** The analysis recommends adopting a single-source-of-truth schema strategy governed by a central Rust definitions crate, enforcing cross-repository coherence through schemars-generated JSON Schemas and cargo-xtask automated drift tests. It is necessary to establish MiniModel.org as the explicit initial seed authority, deprecate all obsolete compatibility readers for legacy SLM1 formats, and implement the Origin Private File System (OPFS) paired with Cross-Origin Embedder Policy (COEP) headers to ensure zero-copy memory mapping for WebAssembly inference.

**Principal Risk of Recommendation:** The strongest reason this architectural recommendation could fail is that strictly tying schema validation across distinct repositories via automated drift tests may temporarily block deployment pipelines if the component boundaries (e.g., between the Windows .NET companion and the browser WASM module) require asynchronous release schedules. Furthermore, relying on OPFS and WebGPU for the initial default model execution might fail silently on low-end hardware that enforces strict WebGPU storage buffer binding limits (often capped at 128 MB)1, preventing the immediate usable default experience if the initial seed model exceeds these hardware-specific constraints.

### **Constraint and Evidence Labeling Definitions**

* **\[Project-Supplied Fact\]**: Information explicitly provided in the project briefing context.  
* **\[Externally Verified Fact\]**: Information corroborated by technical literature, academic papers, and public documentation.  
* **\[Hypothesis\]**: Deductive architectural assumptions requiring empirical validation.  
* **\[Locally Unverified Condition\]**: States involving proprietary source code or local machine environments that cannot be independently audited by external analysis.  
* **\[Recommendation\]**: Proposed technical or architectural action based on the synthesis of available facts.

## **Component Ownership Map and Responsibilities**

The current ecosystem exhibits symptoms of historical domain sprawl, wherein repository names imply overlapping or obsolete authorities. To achieve ecosystem closure, component ownership must be strictly mapped to functional responsibilities rather than legacy marketing identities. **\[Locally Unverified Condition\]**: The mapping below assumes standard Rust workspace structures within the E:\\Source\\Rust directory and relies on repository names supplied in the briefing.

| Component Identity | Prescribed Primary Job | Current Contract / Boundary |
| :---- | :---- | :---- |
| TinyRustLM.com | Public browser application execution (Frontend, JS, WASM). | Consumes composed payloads (.slm2, .tokenizer2, etc.) via OPFS. Interacts with the .NET companion via Native Messaging. |
| LMComposer.com | Model ingestion, quantization, and artifact composition. | Produces canonical immutable artifacts (.slm2, .tokenizer2, .template2, .sampling2, .prompt2, .composition.acg2). |
| Runtime.MiRust.com | Core Rust inference engine and tensor math execution. | Compiled into WebAssembly for TinyRustLM.com and distributed as a library dependency to the .NET Companion. |
| MiniModel.org | Centralized qualification and seeding of initial models. | Serves validated initial model payloads to TinyRustLM.com upon first execution. |
| MiRust.com | Umbrella marketing and shared brand identity. | No active runtime execution or code dependency. Redirects to TinyRustLM.com. |
| TinyRustLM.MiRust.com | Historical developer portal. | **\[Recommendation\]** Retire and merge documentation into TinyRustLM.com. |
| MiniModel.MiRust.com | Historical redundant seeding host. | **\[Recommendation\]** Retire and alias directly to MiniModel.org. |

**\[Project-Supplied Fact\]**: TinyRustLM source belongs only in E:\\Source\\Rust\\TinyRustLM.com; its model payloads belong only in D:\\LLMs\\TinyRustLM.

**\[Recommendation\]**: Runtime.MiRust.com and LMComposer.com must share an exact structural contract defined in a dedicated core types crate. They must not remain independent regarding data structures, as divergence will cause the runtime to fail when parsing composed payloads. TinyRustLM.com and the Windows .NET companion should remain independent in deployment but strictly coupled via a versioned Native Messaging schema.

## **Essential Producer/Consumer Boundaries**

To eliminate duplicated implementations and contradictory behavior, the architecture must formalize eight primary boundaries. For each boundary, the analysis specifies the identity, schema owner, validation order, resource bounds, error categories, cancellation mechanics, and evidence of success.

### **Source Acquisition to Conversion**

The identity of this boundary represents LMComposer fetching raw weights (such as Hugging Face safetensors) and converting them to model.slm2. The schema owner is LMComposer.com. The validation order must proceed sequentially: SHA-256 hash verification prevents duplicate downloads and ensures file integrity2, followed by structural parsing, and finally tensor dimension validation. The resource bounds dictate that the conversion process must operate out-of-core, utilizing OS-level memory mapping (e.g., via mmap) to prevent Out-Of-Memory (OOM) errors on large models, a design paradigm successfully utilized by the safetensors format3. Error categories encompass Network Timeout, Hash Mismatch, Unsupported Architecture, and Dimension Mismatch. Cancellation mechanics require the system to listen for OS interrupts (such as SIGINT) and ensure that partial or corrupted downloads are immediately purged. Evidence of success is the generation of the model.slm2 file alongside its corresponding .composition.acg2 manifest.

### **Composition to Runtime**

This boundary defines the exact binary layout transition from LMComposer.com outputs to Runtime.MiRust.com execution. The schema owner is strictly Runtime.MiRust.com, as the runtime dictates the execution bounds to which the composer must comply. Validation begins with a Signature/Manifest check, followed by metadata envelope parsing, and concludes with memory-mapped tensor loading. **\[Externally Verified Fact\]**: Resource bounds are strictly governed by WebGPU limits, specifically maxStorageBufferBindingSize, which varies from 128 MB on mobile and Apple discrete GPUs up to 4 GB on dedicated desktop GPUs1. Payloads must be chunked by the composer to fit these hardware-specific bounds. Error categories include Malformed Header, Endianness Mismatch, and Buffer Size Exceeded. Evidence of success is established when the WASM module successfully instantiates the computational graph without triggering a Rust panic.

### **Qualification to Catalog**

This boundary represents the pipeline determining if a newly composed model is acceptable for public indexing. The schema owner is MiniModel.org. Validation order starts with structural validity, progresses to numerical agreement (such as perplexity bounding), and concludes with browser admission testing (ensuring the model complies with WebGPU compatibility requirements). Evidence of success is achieved when the model identity and metadata are appended to the MiniModel.org catalog database.

### **Catalog to Acquisition**

The identity of this boundary entails TinyRustLM.com requesting the default seed model list from MiniModel.org. The schema owner is MiniModel.org, utilizing a standard REST/JSON schema. Resource bounds demand a maximum 50-millisecond response time with the response payload remaining under 50 KB to ensure rapid initial loads. Cancellation mechanics dictate that an AbortController is signaled if the user navigates away or explicitly selects a local file import instead of the default seed.

### **Transfer to Installation**

This boundary defines TinyRustLM.com downloading the model bytes and storing them locally on the client machine. The schema owner is the TinyRustLM.com frontend application. Validation order consists of download completion, checksum validation, and subsequent commit to the local filesystem. **\[Externally Verified Fact\]**: The optimal resource bound utilizes the Origin Private File System (OPFS), which offers low-level, byte-by-byte file access private to the origin, bypassing the severe serialization overhead and transaction costs associated with IndexedDB when handling large ArrayBuffer objects4. Error categories include QuotaExceededError, NetworkError, and ChecksumMismatch. Evidence of success is demonstrated when files are durably written to OPFS and can be accessed synchronously via a FileSystemSyncAccessHandle within a Web Worker6.

### **Browser to Companion**

This boundary facilitates communication between the Chrome/Edge extension and the Windows .NET companion via Native Messaging. The schema owner is the TinyRustLM.com frontend extension. Validation order begins with Native Messaging host lookup, followed by JSON payload deserialization, and capability negotiation. **\[Externally Verified Fact\]**: Chrome Native Messaging limits single messages to 1 MB, utilizing standard input (stdin) and standard output (stdout) streams, where each UTF-8 encoded JSON message is preceded by a 32-bit message length in native byte order7. Error categories include Host Not Found, Pipe Broken, Message Too Large, and Deserialization Failure. Cancellation is achieved through standard input/output pipe closure. Evidence of success is a two-way JSON ping/pong acknowledgment.

### **Seed Service to Discovery**

This boundary governs MiniModel.org supplying the initial live seed to a fresh TinyRustLM installation. The schema owner is MiniModel.org. Validation order requires the client to report hardware capabilities—specifically WebGPU limits and WASM memory64 support8—followed by the server selecting a seed that matches the reported hardware profile. Evidence of success is defined by the browser successfully rendering the first token of the default conversational prompt without crashing the renderer.

### **Publication to Public Client**

The final boundary involves deploying frontend assets to the end user. The schema owner follows Web standards (HTML/JS/WASM). Validation order centers on HTTP Header verification. **\[Externally Verified Fact\]**: To utilize high-performance threading via SharedArrayBuffer, the document must be cross-origin isolated. This requires setting the Cross-Origin-Opener-Policy to same-origin and the Cross-Origin-Embedder-Policy (COEP) to require-corp or credentialless9. Resource bounds require the WASM module size to remain practical (typically under 50 MB) for rapid compilation10. Evidence of success is confirmed when the JavaScript property self.crossOriginIsolated returns true in the browser console11.

## **Schema Maintenance and Drift Prevention**

Maintaining one current schema across TinyRustLM.com, Runtime.MiRust.com, and LMComposer.com without introducing duplicated code requires rigorous build-time enforcement and strict cross-repository synchronization. The architecture must reject silent compatibility readers and ensure that any structural deviation results in an immediate, localized build failure.

**\[Recommendation\]**: The ecosystem must establish a central tinyrustlm-wire-formats crate within the Rust workspace. This crate will encapsulate all data structures that cross boundaries, such as manifest metadata and Native Messaging JSON envelopes.

To operationalize this, the system should leverage schemars. **\[Externally Verified Fact\]**: By applying the \#\[derive(JsonSchema)\] macro to all boundary structs, schemars generates JSON Schema definitions directly from Rust code, ensuring that the Rust types definitively dictate the JSON structures used by both the .NET companion and the TypeScript frontend12.

Drift testing must be automated without requiring developers to copy implementations. This is achieved using the cargo-xtask pattern. **\[Externally Verified Fact\]**: cargo-xtask provides free-form repository automation, entirely bootstrapped via cargo and rustc, allowing the definition of custom workflows without external shell scripts14. A custom task, such as cargo xtask check-schema-drift, can be configured to instantiate the schemars generator in memory, output the expected JSON schema, and compare it against the currently committed schema artifact using the insta snapshot testing library15. If a Rust struct is modified (e.g., a field is added or removed) but the committed schema snapshot is not intentionally updated, the insta test will fail the Continuous Integration (CI) pipeline, preventing undocumented drift from reaching production.

During breaking changes, such as the mandated deprecation of the legacy SLM1 format in favor of SLM2, coordinated commits are essential. Temporarily incompatible branches must be staged across the workspace. Because the wire-formats crate acts as the central hub, the Rust compiler will instantly flag incompatible consumer behavior in LMComposer or Runtime during a standard workspace build. Furthermore, the validated JSON schema acts as the source material for generated bindings. C\# classes for the .NET companion and TypeScript interfaces for the browser frontend must be auto-generated from this schema, guaranteeing that downstream consumers cannot expect a field that the upstream Rust WASM module no longer provides.

**\[Project-Supplied Fact\]**: A justified format change must replace the current implementation coherently, not add another compatibility path. Therefore, any fallback parsing logic inside Runtime.MiRust.com that attempts to interpret obsolete SLM1 layouts must be aggressively purged. The schema must strictly accept only the exact shape of SLM2.

## **Reusable Libraries vs. Tooling Independence**

Ecosystem closure requires cleanly distinguishing between code that must be shared, code that should exist as generated artifacts, and code that should operate as an independent service. Failing to separate these concerns results in dependency cycles, bloated WebAssembly binaries, and deployment gridlock.

Reusable libraries must be strictly decoupled from environment-specific I/O. For instance, the core tensor math engine within Runtime.MiRust.com must not be aware of whether it is executing inside a sandboxed WebAssembly environment or running natively on Windows. It should operate purely on borrowed memory slices (&\[u8\] or &\[f32\]). **\[Externally Verified Fact\]**: Bringing heavy shared libraries that pull in threaded asynchronous runtimes (like tokio) into a WebAssembly module will bloat the binary and frequently cause memory.grow out-of-memory panics, as standard allocators like dlmalloc can suffer from fragmentation within the strict 32-bit linear memory space17. The WASM execution path must utilize minimal allocators and avoid shared OS-level abstractions.

Generated artifacts, such as TypeScript interfaces and C\# models, should not be hand-maintained or copied between repositories. They must be generated by the build pipeline (via the schemars output) and published to an internal registry or checked into a specific, heavily guarded bindings/ directory.

Small protocols govern interactions across strict execution boundaries, such as the communication between the Browser Extension and the .NET Companion. This interaction relies entirely on the Native Messaging JSON schema. It should not share a compiled binary dependency. This separation allows the .NET application to be updated independently of the Chrome Extension approval process, ensuring deployment independence.

Finally, a single owning service architecture applies to elements like MiniModel.org. It must remain independent and not share a compilation unit with TinyRustLM.com. It exposes a static REST API queried by the browser client. This architectural isolation prevents a failure or dependency conflict in the model composer or cataloging system from degrading the public-facing browser application.

## **State Vocabulary and Claim Matrix**

Conflating states such as "downloaded" and "installed" leads to contradictory documentation, misaligned engineering assumptions, and user confusion. The architecture requires a precise vocabulary and claim matrix to govern the model lifecycle.

| Engineering State | Technical Definition | User-Facing Equivalent |
| :---- | :---- | :---- |
| **Available** | The model exists in the MiniModel.org catalog and passes initial WebGPU capability checks for the host browser. | "Ready to Download" |
| **Downloaded** | Payload bytes have successfully transferred via HTTP and reside in temporary browser memory or cache. | "Downloading..." |
| **Verified** | The SHA-256 hash of the downloaded bytes matches the catalog manifest exactly, ensuring no corruption in transit. | "Verifying..." |
| **Installed** | Bytes are durably committed to the Origin Private File System (OPFS) and registered in IndexedDB metadata. | "Added to Local Library" |
| **Loaded** | OPFS file handles are requested via synchronous Web Worker APIs, and bytes are mapped into WebAssembly linear memory or WebGPU storage buffers. | "Warming Up Model..." |
| **Qualified** | The loaded model successfully executes a silent synthetic prompt (e.g., generating 1 token) without triggering a GPUDevice.lost event or WebAssembly memory panic. | "Optimizing for your device..." |
| **Deployed** | The model is actively bound to the UI context, maintaining state, and is ready to receive user prompts. | "Ready to Chat" |

**\[Project-Supplied Fact\]**: "Structural conversion, synthetic tests, and a browser opening successfully do not establish useful model behavior." Therefore, the transition from **Loaded** to **Qualified** must involve actual tensor execution yielding a coherent token. This guarantees that numerical stability and hardware compatibility are proven before the user interacts with the interface.

## **Documentation and Guidance Structure**

Current project prose contains conflicting owner requirements, particularly regarding the prohibition of MiniModel.org seeding versus the new explicit authorization. To resolve this without destroying historical context, the project must adopt a structured documentation hierarchy.

**\[Recommendation\]**: Implement an Architecture Decision Record (ADR) framework located in E:\\Source\\Rust\\TinyRustLM.com\\docs\\adr\\.

The authoritative source of truth for the current system behavior must always be the executable code, the README.md, and the generated JSON schemas. Historical decisions and conflicting old prose must not be silently deleted; they must be moved into the ADR framework. For example, a document titled ADR-001-Authorize-MiniModel-Seeding.md will explicitly state: "Context: Previously, prose prohibited external seeding. Decision: To resolve setup complexity, MiniModel.org is explicitly authorized to supply initial server seeds." This visibly reconciles the conflict and prevents future regression.

Experiment lessons must be housed in a dedicated docs/experiments/ directory. These files will contain compact markdown records of failed or successful architectural tests, such as evaluations of WebGPU buffer limits or WASM memory fragmentation. Pending work must be managed strictly through Git issue trackers linked to the canonical repository, eradicating the practice of maintaining floating "TODO" lists scattered across documentation files.

## **Incremental Cleanup Sequence**

Attempting to polish all seven repositories simultaneously will stall the release of the first usable product. An incremental cleanup sequence is recommended to improve the working path while systematically identifying and pruning dead weight.

**Phase 1: Establish the Baseline.** Identify and isolate the six exact artifacts (model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, composition.acg2) physically present in D:\\LLMs\\TinyRustLM. Immediately purge any fallback parsing paths in Runtime.MiRust.com that look for legacy SLM1 file formats. Do not assert that unseen code is safe to delete; rely on compiler coverage tools to identify unused SLM1 structs.

**Phase 2: Secure the Browser Storage.** Implement OPFS in TinyRustLM.com for local model storage. Configure the deployment headers for the browser to include Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: credentialless (or require-corp). This is non-negotiable; without these headers, SharedArrayBuffer is disabled, and high-performance WebAssembly multithreading will fail19.

**Phase 3: Connect the Initial Seed.** **\[Project-Supplied Fact\]**: The owner requires a new user to obtain a small working default through MiniModel.org. Wire the frontend to query the REST endpoint for the default seed. Implement the robust pipeline: download, verification, and OPFS installation.

**Phase 4: Ecosystem Closure.** Deprecate the redundant marketing and historical domains (MiRust.com, TinyRustLM.MiRust.com, and MiniModel.MiRust.com). Point their DNS records directly to the canonical domains to eliminate apparent competing authorities. Finalize the integration of the cargo-xtask schema drift tests into the continuous integration pipeline.

## **Minimum Viable Approach vs. Credible Alternatives**

The minimum viable approach recommended here relies on OPFS for storage and WebGPU for execution, utilizing strict schema drift tests to maintain coherence.

A credible alternative for storage is IndexedDB. However, **\[Externally Verified Fact\]** while IndexedDB can store large amounts of data, it incurs massive overhead on large ArrayBuffer objects due to serialization and transaction costs, making it significantly slower than OPFS, which offers in-place, zero-copy read access via createSyncAccessHandle() inside Web Workers4. OPFS is mathematically superior for loading multi-gigabyte models into WebAssembly memory.

A credible alternative for execution is WebAssembly SIMD (Single Instruction, Multiple Data) execution on the CPU. **\[Externally Verified Fact\]** While WebAssembly SIMD utilizing the v128 type offers substantial speedups over scalar CPU execution (averaging 1.7 to 4.5 times faster)21, it fundamentally cannot compete with the parallel processing power of WebGPU for large matrix multiplications (GEMM) required in LLM inference. WebGPU is the required primary target, with WASM SIMD retained strictly as a fallback mechanism for hardware that fails WebGPU qualification.

Regarding Schema maintenance, an alternative is relying on Protocol Buffers (Protobuf) or FlatBuffers. While highly efficient, introducing Protobuf requires an external protoc compiler dependency and complicates the build process. Using schemars alongside standard Rust serde attributes keeps the entire definition pipeline native to Rust and JSON, which is natively understood by the browser environment, reducing architectural complexity.

## **Topic-Specific Calculations and Algorithms**

### **WebAssembly Memory Calculation**

**\[Externally Verified Fact\]**: WebAssembly linear memory is currently restricted to 32-bit pointers in most stable browser environments, imposing a hard limit of 4 GB (![][image1] bytes)22. A WebAssembly page is exactly 64 KiB (![][image2] bytes)17. To calculate the maximum allowable pages:

![][image3]

If the sum of the .slm2 model weights, the KV cache, and the execution shadow stack exceeds 65,536 pages, the application will experience a Memory.grow panic and terminate23. The LMComposer must enforce a strict parameter size limit to ensure the resulting .slm2 file remains well below the \~3.5 GB effective threshold to leave room for dynamic allocation.

### **WebGPU Dispatch Overhead Algorithm**

**\[Externally Verified Fact\]**: The WebGPU architecture imposes significant per-operation validation overhead. Recent academic measurements reveal that true per-dispatch cost of WebGPU API overhead is ![][image4] on Vulkan and ![][image5] on Metal. The total per-operation overhead including JavaScript/Python framework cost is ![][image6]24. For a model executing ![][image7] layers, where each layer requires ![][image8] discrete dispatch operations, the total latency overhead ![][image9] per token generation is:

![][image10]

If ![][image11] layers and ![][image12] dispatches per layer, the overhead alone consumes ![][image13] milliseconds per token, severely impacting Time-To-First-Token (TTFT) and generation speed.**\[Recommendation\]**: The runtime must implement Kernel Fusion to combine consecutive operations (e.g., matmul \+ silu) into single WebGPU shader dispatches, mathematically reducing ![][image8] and directly increasing token throughput.

### **Schema Validation Pseudocode**

The following pseudocode outlines the strict validation mechanism required during the "Composition to Runtime" boundary transition to prevent malformed execution:

&nbsp;

&nbsp;

&nbsp;

Rust

fn validate\_payload\_boundary(file\_handle: \&OpfsHandle) \-\> Result\<(), ExecutionError\> {  
&nbsp;&nbsp;&nbsp;&nbsp;let manifest\_bytes \= file\_handle.read\_header()?;  
&nbsp;&nbsp;&nbsp;&nbsp;let manifest: Acg2Manifest \= serde\_json::from\_slice(\&manifest\_bytes)  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.map\_err(|\_| ExecutionError::MalformedHeader)?;  
&nbsp;&nbsp;&nbsp;&nbsp;  
&nbsp;&nbsp;&nbsp;&nbsp;// Strict schema enforcement: Reject unknown fields  
&nbsp;&nbsp;&nbsp;&nbsp;if manifest.version \!= CURRENT\_SCHEMA\_VERSION {  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return Err(ExecutionError::SchemaDrift);  
&nbsp;&nbsp;&nbsp;&nbsp;}  
&nbsp;&nbsp;&nbsp;&nbsp;  
&nbsp;&nbsp;&nbsp;&nbsp;// Validate hardware bounds  
&nbsp;&nbsp;&nbsp;&nbsp;let gpu\_limits \= navigator.gpu.requestAdapter()?.limits();  
&nbsp;&nbsp;&nbsp;&nbsp;if manifest.max\_tensor\_size \> gpu\_limits.maxStorageBufferBindingSize {  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return Err(ExecutionError::BufferSizeExceeded);  
&nbsp;&nbsp;&nbsp;&nbsp;}  
&nbsp;&nbsp;&nbsp;&nbsp;  
&nbsp;&nbsp;&nbsp;&nbsp;Ok(())  
}

## **Prioritized Experiment Matrix**

The following matrix dictates the exact experimental procedures required to validate critical architectural assumptions before production release. Treat every unmeasured threshold as a strict proposal.

&nbsp;

| Hypothesis | Controlled Variables | Exact Inputs | Procedure | Observable Outputs | Suggested Threshold | Failure Interpretation | Next Action |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| OPFS loading is an order of magnitude faster than IndexedDB. | File size, Browser cache state. | 1.5 GB quantized .slm2 payload. | Load payload into IndexedDB via main thread; load identical payload into OPFS via Web Worker using createSyncAccessHandle. | RAM utilization spike during load; Time-To-First-Token (TTFT). | OPFS load time \< 5 seconds; RAM spike \< 10% of payload size. | IndexedDB ArrayBuffer serialization causes massive RAM inflation and thread blocking. | Mandate OPFS; ban IndexedDB for artifacts \> 5 MB. |
| WebGPU Device Loss can be caught and recovered without page reload. | GPU load, Timeout duration. | Synthetic WebGPU compute shader containing an infinite loop. | Dispatch shader; wait for OS watchdog timeout; listen for GPUDevice.lost promise resolution25. | Console logs; successful fallback to WASM-CPU inference engine. | Recovery sequence completes in \< 2 seconds without user intervention. | Browser fails to catch the exception or WASM context becomes permanently poisoned. | Implement stricter chunking to avoid timeouts entirely; enforce manual user reload upon failure. |
| Schema drift tests effectively block incompatible changes. | CI environment, target struct definition. | Add an arbitrary new u32 field to Acg2Manifest struct in Rust. | Run cargo xtask check-schema-drift. | Exit code of the xtask command. | Exit code \!= 0 (Pipeline Failure). | The schemars generator or insta snapshot logic is misconfigured, allowing silent drift. | Fix snapshot pathing; enforce cargo-xtask run on all pull requests. |

## **Required Decision Artifacts**

### **Error Taxonomy**

Errors must be definitively typed to prevent generic "Something went wrong" failures and guide the user toward actionable resolutions.

&nbsp;

| Category | Specific Error | Owning Boundary | Required Action |
| :---- | :---- | :---- | :---- |
| **Hardware** | WebGPUDeviceLost | Browser ![][image14] Host OS | Fallback to WASM CPU inference or chunk tensors into smaller sizes25. |
| **Hardware** | StorageQuotaExceeded | Browser ![][image14] OPFS | Prompt user to delete older models; halt download cleanly. |
| **Validation** | HashMismatch | Acquisition ![][image14] OPFS | Delete corrupted payload; retry download from MiniModel.org with exponential backoff. |
| **Validation** | SchemaDrift | Composer ![][image14] Runtime | Fail initialization. Prompt user to update TinyRustLM application version. |
| **IPC** | NativeHostNotFound | Browser ![][image14] .NET Companion | Guide user to Advanced Settings to reinstall the Windows local proxy. |
| **Execution** | WasmMemoryOutOfBounds | Runtime Engine | Fatal. Occurs if the model exceeds 4GB 32-bit WASM limit. Failsafe: Abort and log23. |

### **End-to-End Sequence Diagram: First-Run Acquisition and Conversation**

The following outlines the precise logical state machine sequence for a new user experience, isolating the components and their integration boundaries.

> 1. **User Initialization:** User navigates to TinyRustLM.com.  
> 2. **Environment Check:** Browser evaluates COOP/COEP headers. self.crossOriginIsolated is confirmed true. WebGPU adapter is requested.  
> 3. **State Evaluation:** Frontend queries OPFS for the presence of .composition.acg2.  
   * *Branch:* If missing, trigger **Acquisition**.  
> 4. **Acquisition:**  
   * Frontend sends a GET request to MiniModel.org/v1/seed/default.  
   * MiniModel.org responds with a manifest containing SHA-256 hashes and chunked download URLs.  
   * Frontend streams chunks directly into OPFS using FileSystemWritableFileStream to prevent main-thread RAM exhaustion.  
   * Frontend validates hashes. State shifts to **Installed**.  
> 5. **Runtime Loading:**  
   * Web Worker spawns.  
   * Worker utilizes FileSystemSyncAccessHandle to map .slm2 bytes synchronously into WASM linear memory.  
> 6. **Qualification:**  
   * WASM engine parses tokenizer.tokenizer2 and loads WebGPU compute shaders.  
   * A synthetic blank prompt is passed through the network.  
   * If WebGPU throws a GPUDevice.lost exception, the application falls back to WASM-CPU execution automatically. State shifts to **Deployed**.  
> 7. **Conversation:**  
   * User inputs text.  
   * prompt.prompt2 and template.template2 format the text according to the specific model template.  
   * tokenizer.tokenizer2 encodes the string into token IDs.  
   * WebGPU/WASM executes inference layers.  
   * sampling.sampling2 selects the next token.  
   * Tokens stream back to the UI asynchronously.

### **Cross-Project Integration-Test Plan**

Instead of copying implementations to test boundaries, the architecture dictates using cargo-nextest for fast, isolated process-per-test execution across the entire workspace26.

> 1. **Target:** wire-formats crate.  
   * **Test:** Generate schema ![][image15] Assert against committed insta snapshot.  
> 2. **Target:** LMComposer.  
   * **Test:** Ingest dummy weights ![][image15] Produce SLM2 binary ![][image15] Pass bytes to Runtime API ![][image15] Assert successful graph initialization.

### **Change-Propagation Checklist**

Before any release altering the boundary schemas, the following checklist must be executed:

* \[ \] Modify Rust struct in wire-formats crate.  
* \[ \] Run cargo xtask check-schema-drift to update the canonical .schema.json.  
* \[ \] Execute bindings generation script to update TypeScript and C\# interfaces.  
* \[ \] Update Runtime.MiRust.com to handle the new fields.  
* \[ \] Update LMComposer.com to emit the new fields.  
* \[ \] Run cargo nextest across the workspace to verify end-to-end serialization.

## **Final Specifications**

### **Minimal Architecture for First Usable Product**

To deliver the first usable product, the architecture must be stripped to its barest essentials, prioritizing the immediate "usable default" requirement over advanced configurations.

> 1. **Frontend:** Static HTML/JS served via TinyRustLM.com, requiring COOP/COEP headers to enable SharedArrayBuffer threading capabilities.  
> 2. **Storage:** OPFS exclusively. No local-file import or IndexedDB overhead is permitted for the initial release.  
> 3. **Inference:** Single WASM module compiled from Runtime.MiRust.com.  
> 4. **Seed Service:** A static JSON manifest hosted on MiniModel.org pointing to a pre-qualified SLM2 chunked payload.  
> 5. **Companion:** Defer the Windows .NET companion entirely for the MVP. Local-file import and custom peers belong under Advanced settings and are not required for the minimum viable path.

### **Complexity to Defer or Retire**

* **Retire:** All legacy format parsing logic for SLM1 within the runtime.  
* **Retire:** Redundant domain names (\*.MiRust.com).  
* **Defer:** The Windows .NET companion application and Native Messaging IPC. While defined strictly in the contract, a browser-only OPFS-based approach entirely satisfies the immediate requirement to "open it, automatically restore a usable installed model... and have a useful conversation."  
* **Defer:** Advanced features including Hugging Face direct imports, custom peer IP networking, and local structural conversion directly within the browser.

### **Implementation Sequence**

> 1. **Isolate Artifacts:** Establish the central wire-formats crate and define the exact data layout for the six canonical artifacts.  
> 2. **Purge Legacy Code:** Remove all SLM1 compatibility readers from the runtime.  
> 3. **Secure Storage:** Implement the OPFS storage layer in the frontend and configure COOP/COEP HTTP response headers.  
> 4. **Wire the Seed:** Connect the frontend to MiniModel.org for automated seed acquisition.  
> 5. **Automate Drift Testing:** Implement the cargo-xtask and schemars pipeline in CI.

### **Explicit Ship / No-Ship Criteria**

* **SHIP:** self.crossOriginIsolated evaluates to true in the production browser console.  
* **SHIP:** A new user navigating to the site with a cleared browser cache successfully pulls a model from MiniModel.org and streams a coherent conversational response in under 10 seconds.  
* **NO-SHIP:** The application source code contains fallback parsing code for SLM1.  
* **NO-SHIP:** cargo xtask check-schema-drift fails in CI.  
* **NO-SHIP:** Downloading the model blocks the main browser UI thread (indicating OPFS/Web Workers are not correctly implemented).

### **Unresolved Local Measurements**

* **WebGPU Buffer Limits:** Engineering must measure the exact maxStorageBufferBindingSize across target consumer devices (e.g., integrated Intel graphics vs. Apple Silicon) to determine the exact chunking strategy for model.slm2.  
* **WASM OOM Thresholds:** Engineering must measure at what specific model parameter count the 32-bit WebAssembly 4GB linear memory limit is breached, forcing a shift to the experimental WASM memory64 architecture (which is not yet universally stable across all mobile browsers)8.

### **What to Stop Doing**

* Stop maintaining documentation across multiple disparate domain names.  
* Stop referencing obsolete historical prose that prohibits server-side seeding from MiniModel.org.  
* Stop treating WebGPU execution as infallible; implement explicit device.lost promise handling to prevent silent application state corruption.

### **Compact Experiment-Lesson Template**

An engineer must be able to document architectural tests efficiently.

**Question:** Does storing model.slm2 in IndexedDB cause unacceptable memory overhead compared to OPFS?**Exact Inputs:** 1.5 GB quantized SLM2 payload.**Method:** Load payload into IndexedDB via main thread; load identical payload into OPFS via Web Worker using createSyncAccessHandle. Measure RAM spike and Time-to-First-Token (TTFT).**Result:** IndexedDB transaction caused a 3 GB memory spike (due to ArrayBuffer serialization) and crashed the tab on devices with \<8GB RAM. OPFS loaded synchronously with near-zero overhead.**Uncertainty:** OPFS sync APIs are strictly limited to Web Workers; requires complex message passing if the main thread needs metadata.**Decision:** OPFS is mandated for all payload storage. IndexedDB is banned for artifacts larger than 5 MB.**Reusable Lesson:** Browser storage APIs are not created equal; zero-copy memory mapping requires OPFS and Worker isolation.**Evidence Identity:** commit-hash-8f92a1b, docs/experiments/EXP-004-OPFS-vs-IDB.md.

### **Smallest Falsifying Experiment**

To falsify the primary recommendation (that relying on OPFS and WebGPU is sufficient for the default usable experience), engineers should deploy the MiniModel.org default seed to a low-end integrated graphics device (e.g., an older Intel HD graphics chipset) with Chrome. If the WebGPU context repeatedly throws GPUDevice.lost due to the OS timeout watchdog (TDR) and the WASM-CPU fallback takes longer than 60 seconds to produce a single token, the architecture fails the "usable conversation" requirement. This would falsify the premise that the browser alone can handle the default seed, necessitating the immediate reprioritization of the deferred Windows .NET companion to offload computation to native code.

#### **Works cited**

> 1. WebGPU Memory Limits: maxStorageBufferBindingSize \- Ayoob AI, [https://ayoob.ai/blog/webgpu-maxstoragebufferbindingsize-limits-enterprise](https://ayoob.ai/blog/webgpu-maxstoragebufferbindingsize-limits-enterprise)  
> 2. Model File Lookup by SHA256 Hash \- Hugging Face Forums, [https://discuss.huggingface.co/t/model-file-lookup-by-sha256-hash/154293](https://discuss.huggingface.co/t/model-file-lookup-by-sha256-hash/154293)  
> 3. SafeTensors: Efficient Serialization Format for Deep Learning, [https://medium.com/@nishthakukreti.01/safetensors-efficient-serialization-format-for-deep-learning-57364317be43](https://medium.com/@nishthakukreti.01/safetensors-efficient-serialization-format-for-deep-learning-57364317be43)  
> 4. Origin private file system \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API/Origin\_private\_file\_system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)  
> 5. 3x faster project loads with the origin private file system, [https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/](https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/)  
> 6. sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system, [https://github.com/GoogleChrome/developer.chrome.com/blob/main/site/en/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system/index.md](https://github.com/GoogleChrome/developer.chrome.com/blob/main/site/en/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system/index.md)  
> 7. How to support "optimized" 64 MiB JSON parsing and streaming for, [https://discuss.python.org/t/how-to-support-optimized-64-mib-json-parsing-and-streaming-for-native-messaging-host/105567](https://discuss.python.org/t/how-to-support-optimized-64-mib-json-parsing-and-streaming-for-native-messaging-host/105567)  
> 8. Memory64 in 2026: Breaking the 4GB Ceiling in Browsers and Servers, [https://wasmhub.dev/blog/memory64-in-2026](https://wasmhub.dev/blog/memory64-in-2026)  
> 9. Load cross-origin resources without CORP headers using COEP, [https://developer.chrome.com/blog/coep-credentialless-origin-trial](https://developer.chrome.com/blog/coep-credentialless-origin-trial)  
> 10. The Web-CLI: Verifiable Privacy for Tools, Models, and Inference, [https://arxiv.org/html/2608.28950v1](https://arxiv.org/html/2608.28950v1)  
> 11. CORP vs COEP, two sides of cross-origin isolation \- CentralCSP, [https://centralcsp.com/en/blog/corp-vs-coep](https://centralcsp.com/en/blog/corp-vs-coep)  
> 12. Schemars in Rust: Beyond Basic Structs, [https://redandgreen.co.uk/schemars-in-rust/rust-programming/](https://redandgreen.co.uk/schemars-in-rust/rust-programming/)  
> 13. schemars \- Rust \- Docs.rs, [https://docs.rs/schemars](https://docs.rs/schemars)  
> 14. matklad/cargo-xtask \- GitHub, [https://github.com/matklad/cargo-xtask](https://github.com/matklad/cargo-xtask)  
> 15. GitHub \- gpu-cli/openapi-to-rust: OpenAPI generator for Rust: typed, [https://github.com/gpu-cli/openapi-to-rust](https://github.com/gpu-cli/openapi-to-rust)  
> 16. Web Frontend (WASM) \- Rust Tool Index \- corrode.dev, [https://tools.corrode.dev/?stack=web](https://tools.corrode.dev/?stack=web)  
> 17. Linear Memory Management & Allocators \- WebAssembly (Wasm), [https://www.webassembly-wasm.com/js-wasm-interop-memory-management/linear-memory-management-and-allocators/](https://www.webassembly-wasm.com/js-wasm-interop-memory-management/linear-memory-management-and-allocators/)  
> 18. Memory in wasmtime \- Rust, [https://docs.wasmtime.dev/api/wasmtime/struct.Memory.html](https://docs.wasmtime.dev/api/wasmtime/struct.Memory.html)  
> 19. Cross-Origin-Embedder-Policy (COEP) header \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)  
> 20. A guide to enable cross-origin isolation | Articles \- web.dev, [https://web.dev/articles/cross-origin-isolation-guide](https://web.dev/articles/cross-origin-isolation-guide)  
> 21. Boosting WebAssembly Performance with SIMD and Multi-Threading, [https://www.infoq.com/articles/webassembly-simd-multithreading-performance-gains/](https://www.infoq.com/articles/webassembly-simd-multithreading-performance-gains/)  
> 22. Up to 4GB of memory in WebAssembly \- V8 JavaScript engine, [https://v8.dev/blog/4gb-wasm-memory](https://v8.dev/blog/4gb-wasm-memory)  
> 23. WebAssembly Memory Access Out of Bounds? Let's Break It on, [https://rayepeng.medium.com/webassembly-memory-access-out-of-bounds-lets-break-it-on-purpose-278dc98c8597](https://rayepeng.medium.com/webassembly-memory-access-out-of-bounds-lets-break-it-on-purpose-278dc98c8597)  
> 24. Characterizing WebGPU Dispatch Overhead for LLM Inference, [https://arxiv.org/abs/2604.02344](https://arxiv.org/abs/2604.02344)  
> 25. Engineering Resilient Compute Pipelines: Handling WebGPU, [https://ayoob.ai/blog/webgpu-device-loss-recovery](https://ayoob.ai/blog/webgpu-device-loss-recovery)  
> 26. Faster Rust Tests With cargo-nextest | The RustRover Blog, [https://blog.jetbrains.com/rust/2026/05/01/faster-rust-tests-with-cargo-nextest/](https://blog.jetbrains.com/rust/2026/05/01/faster-rust-tests-with-cargo-nextest/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAZCAYAAAAv3j5gAAABpElEQVR4Xu2UTShFQRTHj1BEKEqKlEhWFr6SjyTJhqJsrGRDKYUkIlmIhYSEZGdhY2FjIbLGmo0dKTtKsRP/f+fMay75epd6i/erX+/NnLkzZ+aeuSIxSCLshPNwHGZ4sXw4B9dhI0zwYr9mAI6JTtILT2Gm6CIzMBWWwCvYo49ExxQ8Ed1JO7yDRfb/EZbbOO7sGKZZ+wN5cBpuwVlYHAxH4I7W4AZMEp2wDiZbfBUewBRrB6iGR7BBNDMOfIWjEjxvTnhm8Vyv31EAL2DH+wDh2e7DPtEXTrLhOXyCFdbn0yY6YaHXxx0tw275pBh4ZNcSPGcyKbqrEdEHOXmlxbg4k+i3Nhfh+GZrsyh4rAE4aAUeii7qYAlzIf7mwEu4bbEq+ABbRJMYFC0KPl8KJ6z/W5jNHnyBTaIPDcEFWAt34aJokoxzHJNycnc/okb0aFiBrppIumjWWV5f1PAS8h7syBd3ISzMfhMuiVbjv+AW4Yt0ZV4GWyMj/gC+bF7OYfvvYPl2ee1QuI/kM7yFN573sD4yMiTuwvrl6XQfzjhx4sQAb19jSVSkywtdAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD0AAAAZCAYAAACCXybJAAADOUlEQVR4Xu2XS6hNYRTHl1CEJK8UAzKRASIiyfVKySOPCBMpZGDgDrxLISlFXkVKRgplxEg5MSCEARkgkRgIpYjk8f+19nf2d4697/nukcnt/OvXPfs731l7rfWttfa+Zi211FJXVm+xWpwRB8Tw2q9thZgm+opuYohYK8bHmxKUameY2GPuT7sYUft1VdiYIo6JU2JGttZQY8QjscM8WBy7a+4Q6iEuit91XBL9sz0pSrWzUFwT48RgsU98E0ujPaiPOCeumMcwVtwXc+NNRSKwx+YBkyEMXRdfxMRo39ls32txWSwQ3aPvU9XITi9xVXwSE7K1UeKdeCIGZWv4elTctDxhW82TuC27LhUbPphnKmi22G5e8kHHrTYJzaqRHYLm5H6Kmdka1fdGvBBDszVscDAbs2vEPlqTJJWKDN0R98TADE6+6AQbOZuqFDsEji+hN+eLX+ZVQougveKHmG4+H5gB/K6hOF1OmcBPil3mTlFG9YPlhDgiHphn/bbl5dcZddYOp0cJczBhuIYW4KQPitPmpf1MbLYGgyyUCFkMQ4IfHBJPrXaCMzDo+1AFTNyPYnJ1R5pS7VBxt8wTQ4IYaiEYTrZi3r/x6beJz2JRdl2oEHQ8IBDTE4Nxv/Sz2rIPfXbB8pumqBk7s8RX85LuaXnQHNac6i4v8VfmVVBa6mSPzFTMDQWFoM9Ha/UKN4iHSzNKsUOiOHWGG4+jsidMsAV8LhQ34WYV6zjodeZZ3VTdkXiDOqXYYbjuFWustjfxJX4cUdZNBU05UVYMiQHRen15cyOuY2dDWVYsTxhlSy+WlVaKnXDv2PG4h4NPq8R38+kdlFTeiHJ5b3nGyG79IJtqPnXpp6CV5m9Jy6K19eaOlfVnih38YLDtt3zfaPHWan0KL1Xxi0ibJQwyhOHd4qXYYP7IIvOToj0kol3cMA+M91wedfWPB06JAGiZovJKscNfrhmuO83L/KF4bn8/Rhlw+Mpja0v2GfuxTx2KF/olYp75oChSvKfsnZuyInFlQwml2GGd75ebn37RCxPCV/Zhr+yfkv+ukeKwFZd3lxSnQcAN/8vpSqKPF1sneqqlllpq6V/0B9lAySGYy+ttAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,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UdY0q9cBq3PytgLHZULAe6Lk72EIMYQa+WUiIiIiBw3kxz0vDkyoVERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERkEf8HNw2k7UaVCF0AAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAaCAYAAAAzBZtTAAAD7ElEQVR4Xu2YT6gWZRTGn9Ag0cooDKFIMstIMVEKIeUuomxhRCUESYghCS5EJSRRMSKsrMA2Rv8oImwRFERQ5OJCm6gWFSVBtjCkFlFRUGBQ9vw633Heb765MheuY8U88OPeeb/3znfmvOffXKlXr169ev0bNNfsNs+Zh81Vwx836g7zRH2xA11gtqiy9WpzztCOStcobGTvXWba8Mfd6Abzvllplph3zEmzXRMbPs98Y16prZ9pYd+4GTMXmQfMHxq19Vyzy3xslpkrzdtmU7GnE80wb5kNqk73YvOR+U1hXF0Y/4LiELp28DPmT3P74Bon48QfzbW5SeHIrxWBgG7T2bH3n9JwzPyqiI7UToVB24q11FrzlDmu7g3me7Hr/sH1+eYDDdt/ucK5HEbqQkVE31isdSKi8YB5T+Hs1A7Fg/Cz1DxFPVuoOJiuHYy9l6jKtkXmZ0XZmDVYu0dh+73mPMVz5WdNusIsrq1xfw6vSRzWLWaNItsnrenmDUUqjhXrPNyTiijIyO/awaVodq+Zb831xTqRi4MfMa+azeZT87jiGUrh+HHFfcoavtd8plEH3qkoSfeZ9eZDc125oY1wIPWXSC0NogtTMjDkbDp4pnld4Vga7a0ang6wCQePq4rcBeZ7RTMsRfNjvSyF3P+wRp1+qfnE3DS4JlMIwptP7Wghwp+bc/J8UYo0en7wOWrrYAwkCtjfBlJ6MqJUfadhe9PBTBipjNQvFSUmRbM8ocppKJ1e/j2i4RN4L5r5CoePaTQrJhQbnzVPK6aLFCXjMQ03iLYOnq34W7KhDXT7yYgDJNJwaI5gOeFQI1Pp4PpkRDkhC3BWqsnpaI75QnFv+EEx2rZSOvchVenG2EMx58Z0alIyIWr4EmZQrruYL7Fx64AyarIh52GT7m0cnGv0G4Io9ahGnZ6i7q8zbyq+g2wvM71RRAG1CcPLmkOKUNSb1DaCp1KZovUozJKQY9kKRQQyRaSaSgQBxPzMSJoqnc7v+xUBtlFRb1ef2hkHwUvZacsaDl1vflfMtWWU/qTRNEldpthfbwRnUjnfvqyqF+RLEaPa0sEa5Y23NkpFRmZTk6MUcDA4KkUjx5E4fZFi7ub5uNdXitdyhPPfVUTzaZWRmHWlBIMo+KWyg1Mach8H0UWJQNToo4qRiy5OBP0yWC9FdB4xLyleSj43BzVcWoj4vxSHs0/xXHsUTYxDO6Tq0JYrxjayhV7BePagJtHg/ksiJcfM3WaVJn5I1vmcffV/CNVLAYGWIx37yIy8TtGbKBdQjoW9GpT1t+lfAb2mQBONYr2mSERu06twrykSdbavo7169er1P9bf5Mzec9JJTs8AAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAaCAYAAAAzBZtTAAADrklEQVR4Xu2YXchNWRjHn4kp8h35CBGSaQgx3DC9F5MhccHEFElNPu6EUC5muJjQNMpMUZjGRxNJuVKKCxkXQhPlQjGFGGUakylTiPH/efZy1rvevc9+6T3n1dj/+tXZa3+t/d/Pep5nH7NKlSpVqvQuqLdYI/aKrWKs+KDVEWZdxFyxO+ML0b3VEY3XbHFIjBdDEgaJD2uHvhJzXiRGJuNN1URxVrSIfmKVeCrWW81kJv6j+EaMFivEY3FNjMiOaYY2if8K+Et8ZP7S54ld4p75PKdwcmfpB/FczM+2MfmS1SaMiJwzYmi2jZaaP9h+0TUab6S41wnzlRbYJ26JjeYBgcFzzAOGgOh0g783N+qrbLuX+FX8Yx7dKEQODxg0TNwVv5svz0arp9gjBiTj08Vhy09XzLvTDWb5M2nyFSK//W2eNngoNFVcESuzbUTeu53B70YLAzEzXi0DxXErTlPtMZhzJyRjeEGg5amPmGWehvon+0pFsftF3BGTkn2pZohn5ku2W7KvGcJo0tvidEekMoMJoLPmzxwX9S3iqrU1cIF5+lwmlosL4uP4gCL1EEfNjWXJf261iM4TUf+zeaRPS/Y1SzPFafOIKlKZwaPEfbEuGsML6k1qOmnwsnlgoS/Na9dnr49op8aJP8zzGjfL00LziZVdnAkSBWlLVUR7VwLRe8Q8guupzGAK+xOrmYaC6XRTsbgG1/rJvJPC8BZr2xqWClN4exS11ck+RMT+Jj5Jd+Sor9hurat+Paj+7VGoE0vSHYnKDOYFpUU6z3REvqctDW3hn+arqK5wf21G/CZC13AwGkOYe16MybaJJNo1jGymiC7mR6Gpp3oGh/xLkYwL57fW1vQgahTPS93h/qSSolX+SiHs00lgLBeIlyDVNq3YdB9EXlHFbZRoFymwaZSlqmcwPT69/uZoLDad39+ZRy4fVuRbvgeCeBEnrSStDRc3xAGrFQty5kXzJTg5GxsszomH5oUw8EAcs+Z9aCAeiAcrMi4WBv9r+emMVEAQYVQQtQUjMZ00xDcCKZMXet38LwSE+afMo7lU5L2bYod5ZWTyj7LxoJAy8ogn2AyFKl9kcOiICIZ4nhTundFxrM4X5oG0zfycr82LGAFGEQ0BxncAbRsrmxVLe7bB3qDAERUt5n/gfGpvcGIniTRFeqjXStZTmgroYMJHVeh8wnYQ9yJdwNve971RyL9x/1upA1XUilXqIBG5eZ/ClTpI5Nkqj1aqVKnS/1gvAW8YyVGe6WOgAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAaCAYAAAAHfFpPAAADIUlEQVR4Xu2WX8iPZxjHv0IREhYWRRpy5GBK2JaDIRkHpoiTN5qsKInIAe3AydYio6SQ1dI2tRNSiA1po3Awf5IDlj85oVY7kPz5ft7rd/fcz/N73l8cvG+9e3/f+vT8nuu5fvf93Nd9Xdf9SG211VZb3aep5ltz0Hxp+pcfa6JZacYrng0y083axu9eq36mw9w1n5oJ5ifzoxlcuGm2eWHeZPxnFmU+vVIfKxayPrNNMo/NisyG3y1zx9ww35gPs+e9VnsVu7k4sw01v5uTKtKbAPyQHP5POqquA/BAxS6/TwCGmDlmYMU+TM29BWGbZpYp5qnz6Ta1CsC/ikaHeLHfFL3hnvnH7FS5TyRtNQ8VDTNplnlu5mY2NNycMLsVAdhv9ih6U614sNw8Mq/MzypPlIud+KpqrIg6JwBLMxs94ImiN7BwxPUv81HjfpS5ojg18p0eYI6bs4r5kzapOSiI3oM//yMYf6pcek2ap3CYYkabNea2IsJVjVG5udWJSXnZI4qFEOBt5rXKAeBZviC0XXEy5HOPM/fNrsyWglK3MDKQhsvuUyKcNpxEtWIgBmZhudgVIrdaRf1w3WwWJKcWGqk4+sgqjsOvzQWVe0CdSHWyh91N+lyRmQszW11QktapfLQeVn1ZdeoDs6VqbIhF/KJYwCFzTVFP1Ub0LmKemyp2jHS/av5WZF1SCgDX3Eb5UEZJnygyJQ9KEhlHnyE4BJzx6vw6xWJa7QiDURrv002pyT/MRhWNh//SANN3AHPyctUAUAK88JLGPcEiaBcV6ZyUB6XDzFeMwyadUlFaPGcesqjHlD6EjilKjCDT2E4rTgOE/YCZ2bhH9A7KhP7Bb5RSnWwZ0bBRz2QlQaF0GQc/dv2Z2aEi8F+YS4qM6zGxSHaBRa9SLPyMGZs7KRbCIr5TNN7r5rLKXT3V/0tFQL83vyp6ChlAfW9o+BLofeacYm78zisyuMfFy8xQlA4v0NUZjN9nCj8+XKolllJ9siLF2ck0FoHO75OwU2Ip23qtUv1Xz/8+o1ZHXZ8QTe2pmj91+5Q4Ldpqq622ukVvASUYmPuuw1JPAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABHElEQVR4XmNgGAWUAkcgfg3E/6F4BxBzIsnzAfEuJHkQXgfE3EhqUAAjEM8C4l9A/BOILVGlwSAIiNcwoFqEFQgC8UIgzmeA2DyFAWIBMigC4mg0MaxAH4j7gVgSiK8D8RMgVkSSZwHi2VB1BAHIxnQou4EB4rocuCwDgwgDxOUgHxAEfUBsDGXrAPF7ID4BxPxQMRsgngxl4wWw8ALZDgIgLy0H4n9A7AEVA7mapPBCDnCQISDDQIaCYo+s8IIBkPdA3gR514mByPACuQYUFqboEkAQwwCJiGtA3IkmhxWghxcyEGeAJBOQgUSFF8gLoKzBhS4BBQ1A/BaINdHEUYALEH9hQOQ1UBbyRlEBAaBkAsqrBMNrFIyCIQMA260zNBT6yKgAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABGklEQVR4Xu2TsUoDQRCGRxLBYBHSmMLGIhEEO1ubiEUeQVGfQEgbQppACnvBzt7GJhDfwWhhE0glaGOhaKpUouYbdpfb7BlcsArcBx/H7gx3c//tiWT8lxq+4Y/nB554Pd2g3sNVr57iEr9xPyxAFQd4jCtBLUUJ7/EJ12dLsod93Aj257KF73gjyZNz2MAzLNi9KI7EZNG0a83jQkxuS64plnP8xF3cxAe8xaLfFIPL6xlP8UrMjfRj1L2+KFxeX9jGZTwQ89p643zS+jcur5Yk+ZRxhGPctntR6Plyefl0xDxEr1G4vB7FTOOjE+lkOmFY+5UdnOC1pLPRte7rdHry56K/zIvM/m+veGjra3gX1IdYsfWMjMVlCn+/PCJqzkDYAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAAAaCAYAAAD7aXGFAAADE0lEQVR4Xu2YWchNURTHlwwRkilk6hNFRDIU8SCz4sEDihIZQ6JQeBB5kChTyhCSISlkSDwgivIiRQolyQN5VCLD/2ft3T3fdu/VjVvS/tcv59trn33WXnutdc5llpWVlfXvapx4L74X+Cxuio6FeVnSEfFNTEkNWa724qF4Jbo3NmVFDRAfxHnRLLFlBc0170UbUkNWSXvFFzEmNWS5Yj96Kboktqyg3/WjFqJ5OlhHTTb/JKnkz5+orTgjPlmNVRP70drUIDURW8Wg1FBnUf716o8kxS3RKTVUE99HlfpRX3FUtEoNdVQbcc3K+/M3NNNqzNJq30eU2CHzTIsis/jYPBkYGsbGm6fxYPNN7hdDwj1NxTRxPNBDdBZ7xGpzp0+LUT7950nj0ypxSWy0xuXeTWwSV8R88+cj1t0l9pmXbHE/0XZYXLbyVVNRw8RH+zWyOEKAXouGMIYz682dZuM8+Lr5iU8N45QIGzompofrA2JduH+EWCzmibHiqZgkLogt5pohnot+5gG/aO4nGi7uiN7m620zf9lwWIx3NffrmZUycWTB1ke8KNiqaoJ4a6Xfal/FmwDXcZzsiMHjpB9b6YQI5CMxUfSyxiXCxgkIz3knlonl5qXNJggAGXnDPBDtrJQtxX7Esx6YZ1dLcVWcE3PEbrHQ/D78XBnuYe598+BxDwdQzlYX4Xgx4wjIE/ONcNL8IKZ80Qrzxsg9OFnu7YhtezKW9iMCSXnQEzkUMo8f5EUxzuFxKIhMJJD4mdpq7ke1ijreGa5JdU6S8uOa0joVrnuKWWHeUnEiXCMypr/5CbN5yrQoyuGueeBZi97GGmTOaHHPSqWHBpq/XG6bByTeg68LzHtkJVtdsok+QLNcYt50eVjMEGz0p0Vis3kwEP/ydqTcyK4dooO5g7yGG8K8KIIWswA4iC1itvkmyYSD5kGjETMfH+hNPJf1z5r3xDWJjazlBRFtrFcXsTCbLFc+NHPKLX04f/P/UmRPcax14e8o1uXjNarcPNZhvfQ5zIt+cV20V7NlZWVlZf0P+gEmdo/2LZfnvgAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,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>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEMAAAAaCAYAAADsS+FMAAACr0lEQVR4Xu2XS8hNURTHlzDwyCMiRR6RlBgIKQoJZSIxEAMxMFHCQJ9Sn4GkRB55T2TAQDJRXiMjyUSJMSkhlFCf8vj/vrX3vecc5957PoN7pP2rX/fes/e5d5+111nrXLNEIpH4e1bI9/JX8I4clhkfJe9lxvGmHJGZ0w0GycXylDwrN1n5GibJg/KiPCRn5oc7ww9x8nfZJ5fkh/vZIG9YPlDdYog8KQ/LyXKWfCifyamZeYvkfblMzpe3zTdvn/k1VmKsvCJ3m598xv48ea/cUjjWLebID+YZOjIcYy2slUwBNumW3C4Hh2Pj5GP5VS4IxzpCFE+Yp9gL+VpOz4yzM5fCvDqYLd/Kp+YXCGQqwbgcPrP2l/Kz5dd5wHwem1kJorwzvO81P3lXY9RsvHnmkEF1McaaWUHWkr0/zYMCQ81vpbvmgYnsN78eXitx3JppNFd+ko/k6HBsqTwd3tcNgVgjP8pj5kFoBRlNnfshl+eHyon1gt0HvuCaedTXhmNkTdV6QfV+Il8NwM39Z3Zmlfn8d/KCNdfcCroP9YLm0C5oDWK9yBZMgkAwCAqFqc56UQYF8oh5BhOgMsjqB/KqlbfgUrL1IsIXcZvwYyut/npRxkL5zby9TiiMkQXnzW//yo8CZAO1gC8ustW88DyXRwtj7WDXWBxFrKqxMLZinnkL5TUSu0exbcZA9FizxdKaVzdmtKBYL7JMNG+zBKRqvQBScp3cOABZbDtYI+vgNUIACATPH/F8NpcHrD3hfYTMj12nJdwCPFoPLw4Eei3/Y3VBW+QvQyzoEDP3nHnR5+K3md86PCdlCzSdh45YCkXnizX/a/SZ72YR2iz/VequF9QwijkFcYf57rP+62EM4m0TrynrGzkjzPsvYOenyfXBKbnRRCKRSCQSiX+M38I3kMPVGpRTAAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEMAAAAaCAYAAADsS+FMAAACK0lEQVR4Xu2XTyhlURzHf0IRJRuTbNAYKQvTJBup0SRjmkmNhb97NTVLwkZJylJNSjZWs7FRrGZB2WCmbPxZKSwowoYNGb5f553evee+89wrPbecT316vd85nne/99zfOU/E4XA4ns5HeArvPJ7DPs+cMWN8ARZ4xjPNe9hiFhPkw244AydhtX84HLPwP/xkDoAquA57YZ4xlika4AD8K+qGDPqHHyiCf0TdvEJYB3fgd++kxygW9U/2YZl/SJrhIiw36pmGYXyFbfBKUofBGq+D16PpgbvwjaeWlhp4Bpckeeez4U84IWrpxYUPkjoMfUPnjHo9vITfjLoVpuddeuwHv0T1jSw9KSbYwtA31AxDzx836lam4A1shO/gJlwT9QzGDVsYum4Lw6ynRC+vA/gD/hYVBJtpq2deWN7Cf/Awgl0PfxkOWxjsJ1zd5kVHCkMvr1s4AnNhp6gPZjA5yamxwBbGZ3mGMHS/GJJkf2DnZQe+gLWJWlywhWG7aFs9JTxf6H7hZVRUSHyNAnehElgaQZ4JwmILoxIeS/Ci9fxhox5A94s9Ce7DXBFcGZH2aFE70RfYEUE+qmGxhcFAV8R/PCA8RF4nXtOiP3hegr2B71nn6uDJMy6ku9P8nmzIFYn3fOx5Gk27MzKlI/H/3jiRZFfnMt8wxrdE7RQvRb8EvzN/Q62K+r6EzX8aLsN2UUFsizqWv0q4GnhW4uPXJCogh8PhcDgcjoxzDwl6j6FBhXwKAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADoAAAAZCAYAAABggz2wAAACjElEQVR4Xu2WTYhNYRjH/xNTo1HDECmaSz43UpJsrAgLEiaFFSkLKx8pW4k0sxj5yNfCQpj9bFBkNlNqSvkoZUE+QthgoXz8/57zuO997z1zD3VPyvurX7f7nve8Pc85z/u8B0gkEv8rbXQ5PUnP0F7aWTPDmEC30fP0BF1Qe7kwG2H3l8p4OkCP0pl0Hr1LH9CeYF4XvUmP0Il0CX1ENwdzilChT+nlaLzlLKLv6Q1YAmI7/QF7w84heo9ODsY07zGdHoyNRTu9CFu79ERVfm/ofTolG9sEC0ZBCSWnJOPgltFPdEM0noe2RD99gfq1SmESqm9T+/UU/Q5LWPhbj4NbSj/Dyr4ZFdjeXkifoX6tUlGSa+gH2gcrNeEJxcHljcdoHa2nhjcDBRNVMFvpS/qNXoc1kUaoc+6OB3NYRZ/Tt/QcnRpcW4/G+6poompY+2CxF050NR2i8+k0ugvWEFaEkzLUJPbGg00YR4/Rj7DkxTr8faLq3BdgXVsUSlRHgfZD3OXm0hG6Exao0O8BWCn+KWoyX2BHjB5mXkJ5447iPQ4rWadQoiqng/FgRjcdpE/oJTpKT6O6z/JYDDtG9Ot4MEpCycyhr1EfnCd6OBp39JCGYVvCfQWrjq/Z/z2/ZwcoaAWRh/aASnoLLAh/u2Oh4OOy9ATUadVx1ZHvwLZMR3Xar9JWwF7iQtXmx1QjCr3RVqAPgXd0bTC2A5b8WVj5+ZjewOzsvx6qvpK0ZXz/+Zmsc9Lnxahx6voV2BqloSCv0luwxrYf9hFwLbvmqJqU+G3Yt6qSfAj7FHSUhD48tFZ4r9AJoDVVAXqIUsdYw9JtFXqyFVgCclbN1Srh1liJ5vs/kUgkEol/hZ/mMYTb/X3beAAAAABJRU5ErkJggg==>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAWCAYAAADNX8xBAAAAwUlEQVR4Xu2SPQrCQBSEn6Bo4U9hJYp6BEEbT6IgWFpYeQYtbCNio4WFpdh7MXtn2CXEwd1onw8+sryZRwIbs4KCD+pwBWsaeDhnzl6UKdzrUNjCsQ6zVODBckrmXsZeWQNSgmu48ecYzNlb+nNKEx69fdj5Qfaufof7VoU7+IJPeP5D9rnH/ZQhfMBRdhhhAu+wpwEZwAtsaSC04c1cP8gCznQo8FLmOlT4qYkFrtbcD3mCXQ0UXmfDP7+RlxcEeAMurBrTENA8EQAAAABJRU5ErkJggg==>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAAdklEQVR4XmNgGAWjYMABBxCnATEPugQlgBGIW4HYGF2CUgAysBeIWdAlKAEg1xYAcRyUjRUIALEkiVgOiOcD8WQg5mOgEjAB4tVALIMuQS4QBuLFQCyPLkEJyALiCHRBSgAonU4FYml0CUoAKLZ5ofQoGAX0AAA5bAi7Yfn2hgAAAABJRU5ErkJggg==>
# **The Safetensors to Browser Runtime Pipeline: Provenance, Tensor Mapping, and WebGPU Deployment Architecture**

The migration of complex machine learning models from centralized, cloud-based inference servers to localized, edge-native execution environments represents a fundamental paradigm shift in application architecture. The web browser, historically limited to document rendering and lightweight scripting, has evolved into a highly capable execution engine for deep learning workloads. This evolution is driven by the convergence of the WebGPU API, WebAssembly (WASM), and optimized JavaScript runtimes such as ONNX Runtime Web, Transformers.js, and WebLLM1. By shifting inference directly to the client side, applications benefit from zero-latency interactions, robust offline capabilities, reduced server infrastructure costs, and enhanced cryptographic privacy, as sensitive user data never leaves the local hardware4.  
However, executing modern neural networks—ranging from dense transformer language models to highly parallelized diffusion architectures—inside a browser introduces severe engineering constraints. Traditional machine learning deployment relies on Python environments, monolithic deep learning frameworks (e.g., PyTorch, TensorFlow), and virtually unbounded memory spaces. In contrast, the browser runtime is heavily sandboxed, predominantly single-threaded in its main event loop, and subject to rigid memory allocation limits imposed by the underlying graphics driver5.  
To bridge this operational gap, the deployment pipeline must orchestrate a highly coordinated sequence of transformations. This begins with securely deserializing the model weights using the Safetensors format via targeted HTTP requests, verifying the provenance of the associated configurations, mapping the canonical training tensor namespaces to the execution runtime's optimized graph nodes, and adhering to strict quantization and memory allocation rules enforced by the WebGPU specification. This report exhaustively analyzes the end-to-end architecture of this pipeline, detailing the internal mechanics of browser-based model ingestion, compilation, and execution.

## **The Safetensors Architecture and Real Checkpoint Inspection**

Historically, the serialization of model checkpoints within the machine learning ecosystem relied heavily on Python’s native pickle module. While convenient for saving and loading arbitrary Python object hierarchies, pickle is fundamentally insecure by design. Loading a pickled file executes embedded opcodes, which can be trivially weaponized by malicious actors to achieve arbitrary remote code execution (RCE) on the host machine7. In the context of browser deployment and decentralized model sharing, this security risk is unacceptable.  
The Safetensors format was explicitly engineered to resolve these serialization vulnerabilities while simultaneously maximizing memory I/O performance9. Safetensors restricts the stored data strictly to multidimensional arrays (tensors) and structural metadata, completely stripping away any executable logic.

### **Byte-Level Structure and Zero-Copy Deserialization**

A .safetensors file follows a highly deterministic, strictly ordered byte layout designed for rapid, direct-to-memory access:

1. **Header Size Prefix (![][image1]):** The first 8 bytes of the file comprise an unsigned 64-bit integer formatted in little-endian byte order. This integer represents the exact byte length of the subsequent metadata header9.  
2. **Metadata Header:** The following ![][image1] bytes consist of a UTF-8 encoded JSON string. This JSON object acts as a hierarchical dictionary mapping tensor names to their exact specifications, including data type, shape, and byte offsets. To prevent JSON-parsing Denial of Service (DoS) attacks, Safetensors imposes a hard architectural limit of 100 MB on this header7.  
3. **Data Buffer:** The remainder of the file contains a contiguous, uncompressed byte buffer holding the raw numerical weights in row-major (C-style) order9.

This architecture enables true zero-copy deserialization on the CPU. Because the tensor data is decoupled from the JSON metadata and stored uncompressed, the operating system can utilize memory mapping (mmap) to map the file directly from the disk into the process's virtual address space11. The data is not redundantly duplicated into RAM; the runtime merely resolves pointers to the memory addresses where the weights physically reside. While transferring these weights to the GPU inherently requires a subsequent copy operation across the PCIe bus, bypassing the initial CPU allocation drastically reduces the memory high-water mark during initialization9.  
To maintain compatibility with traditional tensor libraries such as PyTorch, TensorFlow, and NumPy, Safetensors is highly permissive regarding structural edge cases. The format explicitly allows empty tensors (where at least one dimension is zero) and 0-rank tensors (which act as simple scalars). Furthermore, the format does not validate numeric values, meaning NaN and \+/-Inf can theoretically reside within the buffer. The strict requirement is that the byte buffer must be entirely indexed without any internal holes, which explicitly prevents the creation of polyglot files designed to bypass security scanners9. Sub-1-byte data types are also permitted, though these introduce complex alignment and addressing challenges that require specialized, non-traditional APIs to parse without triggering unaligned read faults9.

### **Inspecting Tiny Checkpoints via HTTP Range Requests**

A critical advantage of the Safetensors layout for browser-based environments is the ability to inspect the structural blueprint of a model without downloading gigabytes of weight data. Because the metadata header is isolated at the very beginning of the file, web applications can utilize HTTP Range requests to fetch only the necessary bytes over the network12. This is particularly useful when profiling real, tiny checkpoints—such as a 135-million parameter language model or a miniature Stable Diffusion Unet—to determine their hardware requirements before initiating a massive download.  
The parsing protocol executed by the browser unfolds in a precise, two-step network handshake:

1. **Fetch the Prefix:** The client issues an HTTP GET request to the checkpoint URL with the header Range: bytes=0-7. The server responds with the 8-byte little-endian integer. The browser’s JavaScript DataView API is then used to parse this ArrayBuffer, specifically invoking getBigUint64(0, true) to extract the header length (![][image1]) while respecting the little-endian layout10.  
2. **Fetch the Header:** A subsequent HTTP GET request is issued with the header Range: bytes=8-(7+N). This retrieves the UTF-8 JSON payload, which is parsed synchronously by the browser's native JSON.parse() engine10.

The resulting JSON schema dictates the parameters required for subsequent execution provider initialization. An example payload structure extracted via this method appears as follows:

JSON  
{  
  "\_\_metadata\_\_": {  
    "format": "pt"  
  },  
  "transformer.h.0.attn.c\_attn.weight": {  
    "dtype": "F16",  
    "shape": \[768, 2304\],  
    "data\_offsets": \[0, 3538944\]  
  }  
}

The dtype string (e.g., F32, F16, BF16, I8, U8) dictates the precision of the target buffer, while the data\_offsets provide the exact zero-indexed start and end byte coordinates relative to the beginning of the contiguous data buffer, which immediately follows the JSON header9. By executing these lightweight network requests, JavaScript runtimes can reconstruct the model's entire layer topology, calculate the total parameter count, and proactively deny the loading of models that exceed the browser's available memory context10.

## **Cryptographic Provenance and Supply Chain Validation**

Ingesting deep learning models into a client-side web application introduces complex supply chain, integrity, and provenance challenges. The application must mathematically guarantee that the downloaded checkpoints, tokenizers, and configuration files (config.json, tokenizer\_config.json) have not been subjected to adversarial tampering, corruption during transit, or malicious modification by a compromised Content Delivery Network (CDN)14.

### **Checksum Verification and Streaming Hashes**

To validate the integrity of model artifacts, modern browser-based machine learning pipelines rely on SHA-256 checksum verification14. In static deployments, this is enforced via Subresource Integrity (SRI) tags attached to script imports, which instruct the browser to discard any resource whose computed cryptographic hash does not match the expected value declared in the HTML document17.  
For dynamic asset fetching—such as downloading multi-gigabyte Safetensors shards—the application calculates the SHA-256 digest in real-time as the file streams into the client's memory space. Browsers expose the window.crypto.subtle.digest() API to perform highly optimized, hardware-accelerated hashing. However, the native WebCrypto API is constrained by its inability to process data in discrete chunks; it requires the entire file payload to be loaded into memory simultaneously, which guarantees an Out-Of-Memory (OOM) crash for large language models18. To circumvent this, developers implement chunk-based streaming hashers using specialized WebAssembly or JavaScript cryptography libraries. These utilities process the file as it arrives via the ReadableStream API, slicing the payload into manageable blocks (e.g., 10 MB chunks) and updating the running SHA-256 digest without bloating the heap18.

### **The DDUF Packaging Standard**

Furthermore, the structural integrity of the model repository is heavily scrutinized. Emerging packaging standards for the web, such as the DDUF (Diffusers Unified Format) specification, package these heterogeneous assets (weights, configurations, tokenizers) into unified ZIP64 archives19.  
The ZIP format provides built-in file indexing and is universally supported, but standard ZIP files require complete extraction before reading, which defeats the purpose of zero-copy loading. Consequently, the DDUF specification enforces strict constraints:

* **Zero Compression:** Data must be stored uncompressed (using compression flag 0). This preserves the contiguous byte alignment required for direct memory-mapping or targeted HTTP Range requests19.  
* **ZIP64 Compliance:** The archive must utilize the ZIP64 protocol to support files exceeding the legacy 4 GB limitation19.  
* **Flat Directory Structures:** The archive can only contain .json, .safetensors, .model, and .txt files. Crucially, nested sub-directories are strictly forbidden, which neutralizes the threat of recursive zip-bomb attacks designed to crash the client. Internal paths must utilize UNIX-style forward slashes19.  
* **Index Mandate:** A model\_index.json file must reside at the root of the archive, containing a key-value mapping that defines the model's components and their respective schemas19.

For enterprise environments or air-gapped networks where models cannot be pulled directly from public hubs, internal mirrors are established. These mirrors must strictly adhere to a mirror-layout contract, ensuring that HTTP GET endpoints correctly support byte streaming and Range headers, allowing interrupted multi-gigabyte downloads to resume flawlessly within the browser20.

## **Configuration Sandboxing and Prototype Pollution Defense**

While Safetensors effectively eliminates arbitrary Python code execution from the weight loading process, the ingestion of configuration files introduces a distinct, JavaScript-specific vulnerability: Prototype Pollution21. Model configurations are typically retrieved as raw JSON files (e.g., config.json, generation\_config.json) and are dynamically parsed and merged into the runtime's default configuration objects to dictate architectural parameters and sampling behaviors.

### **The Mechanics of Prototype Pollution**

JavaScript is a prototype-based language, meaning objects inherently inherit properties from a global Object.prototype chain23. If a deep-merge function carelessly assigns properties derived from an untrusted JSON payload without sanitizing the keys, an attacker can inject a \_\_proto\_\_ or constructor.prototype key into the payload23.  
For example, consider a malicious config.json containing the following structure:{"\_\_proto\_\_": {"disableSecurity": true}}  
When a vulnerable function parses this JSON and merges it into a local configuration object, it inadvertently pollutes the global prototype chain rather than simply assigning a local key. Subsequently, every object instantiated across the entire JavaScript execution environment will falsely inherit the disableSecurity property23.  
This attack vector has led to severe Common Vulnerabilities and Exposures (CVEs) across the JavaScript ecosystem. Polluted prototypes can short-circuit authentication logic, leak sensitive configuration data, bypass HTTP proxy constraints, or trigger Cross-Site Scripting (XSS) via complex gadget chains that inadvertently pass the polluted properties to dangerous sinks (such as eval() or DOM insertion APIs)21.

### **Mitigating Configuration Exploits**

To maintain provenance and security, AI pipelines executing in the browser must utilize hardened parsing logic. Development teams mitigate prototype pollution through several strict practices:

* **Null-Prototype Instantiation:** Objects intended to serve as dictionaries for configuration data are instantiated using Object.create(null) rather than the standard {} literal. This yields a bare object entirely devoid of prototype inheritance, rendering it immune to upstream pollution27.  
* **Key Sanitization:** Recursive merge functions explicitly filter out \_\_proto\_\_, constructor, and prototype keys before any property assignment takes place, rejecting malicious payloads at the boundary28.  
* **Intrinsic Freezing:** Environments may employ flags or polyfills to freeze the intrinsic prototypes (e.g., Object.freeze(Object.prototype)), though this can sometimes conflict with older libraries that rely on prototype modification27.

By enforcing these constraints, the browser runtime guarantees that adversarial configurations cannot hijack the underlying application state or escalate privileges during the model initialization phase.

## **Chat Template Safety and Sandboxed Jinja Execution**

The interaction between the user and the language model is dictated by the chat\_template. Causal language models are fundamentally designed to predict the next token in a sequence; they do not inherently understand the concept of a "conversation," "user," or "system prompt"29. To bridge this gap, raw message dictionaries are formatted into a continuous string interspersed with specialized control tokens (e.g., \<|im\_start|\>, \<|im\_end|\>, \<|system|\>) that demarcate the boundaries of different conversational roles29.

### **The Execution of Chat Templates**

These formatting rules are embedded directly within the tokenizer's configuration file (tokenizer\_config.json) using the Jinja templating language31. A typical chat template iterates over a list of messages, evaluates their roles, appends the corresponding control tokens, and conditionally adds a generation prompt to signal the model that it is the assistant's turn to speak29.  
The apply\_chat\_template utility executes this logic. However, the presence of special tokens requires nuanced handling. The runtime must distinguish between mechanically special tokens (which the tokenizer must never split, and which may be stripped out during final text decoding) and tokens that are merely semantically significant to the template33.

### **Sandboxing the Jinja Engine**

In a native Python environment, Jinja templates are rendered using the full-featured Jinja2 engine. However, executing full Python-esque Jinja within a JavaScript browser environment introduces profound security risks. A fully featured templating engine capable of executing arbitrary functions or accessing the host environment could easily result in a sandbox escape, allowing an adversarial model card to execute malicious code on the client34.  
To resolve this, the Hugging Face ecosystem introduced @huggingface/jinja, a minimalistic, isolated JavaScript implementation of the Jinja syntax specifically tailored for ML chat templates35. This library parses control structures, variable interpolations, and basic conditional logic without relying on dangerous dynamic execution APIs like eval() or new Function()32.  
To ensure cross-platform compatibility and security, template authors are instructed to replace Python-specific methods with standard Jinja filters (e.g., substituting string.lower() with string|lower, and converting Python's True/False literals to lowercase true/false)31. This rigorous sandboxing ensures that even if an attacker successfully injects a malicious template into a model repository, the browser's execution context remains completely isolated and immune to remote code execution34.

## **Translating Tensor Names: The Dynamic Weight Loading Pipeline**

When a model is exported from a training framework (e.g., PyTorch) to a browser-compatible runtime (e.g., ONNX Runtime Web), there is frequently a profound structural impedance mismatch. Checkpoints natively store weights using naming conventions and tensor layouts dictated by their original, unoptimized architecture. The execution graph, however, demands optimized, fused, or restructured tensors to achieve peak inference latency37.  
This mismatch manifests in several ways:

* **Fused Weights:** A model may execute faster utilizing a fused parameter like gate\_up\_proj, while the Safetensors checkpoint stores separate gate\_proj and up\_proj matrices37.  
* **Legacy Nomenclature:** Older checkpoints utilize obsolete parameter names (e.g., LayerNorm.gamma instead of LayerNorm.weight)37.  
* **Composite Architectures:** Multimodal vision-language models contain nested sub-models, each adhering to disparate naming conventions37.

To resolve this, the JavaScript implementation of Transformers.js manages a dynamic weight loading system to intercept the tensors between deserialization and memory binding. This is facilitated by the WeightConverter and WeightRenaming pipelines37.

### **Pattern Matching and Tensor Collection**

The dynamic loading sequence operates in distinct phases designed to minimize overhead during network transmission. As the keys from the Safetensors metadata header are iterated over, regular expression patterns (defined in a conversion\_mapping registry) are applied to each canonical checkpoint key37.  
To handle complex, nested architectures, the pipeline utilizes depth-first scoping. The pipeline prepends a scope\_prefix (representing the dotted path to the sub-module) to the patterns. A scoped transform only fires on keys matching that specific prefix, ensuring that sibling sub-modules do not inadvertently mutate each other's weights. Regex capturing groups (e.g., (.\*)) extract essential architectural indices, such as layer numbers, which are seamlessly injected into the target tensor names using backreferences (e.g., \\1)37.  
Once matched, the tensors are not immediately processed. Instead, they are accumulated in an asynchronous collection queue, bound by their target source\_pattern38. The loader utilizes a ThreadPoolExecutor to fetch and shard these tensors asynchronously, preventing the heavy I/O operations from blocking the browser's main thread37.

### **Transformation Operations and Cardinality**

Once the prerequisite tensors are grouped, composable operations—known as ConversionOps—are executed to reshape the data before it is handed off to the execution provider. These operations exhibit various cardinalities based on the target architecture37.

| Operation | Reverse Operation | Cardinality Type | Functionality Description |
| :---- | :---- | :---- | :---- |
| Chunk | Concatenate | One-to-Many | Splits a fused tensor into smaller constituents along a specified dimension (e.g., unpacking a unified qkv\_proj into distinct q\_proj, k\_proj, and v\_proj matrices). |
| Concatenate | Chunk | Many-to-One | Merges separate tensors into a unified memory block to maximize arithmetic intensity on the GPU. |
| Transpose | Transpose | One-to-One | Swaps tensor dimensions to align PyTorch’s standard (C, H, W) layout with ONNX’s expected matrix multiplication orientation. |
| PermuteForRope | PermuteForRope | One-to-One | Reorders hidden dimension weights from an interleaved format into the sin/cos block layout strictly required by Rotary Position Embedding algorithms. |
| MergeModulelist | SplitModulelist | Many-to-One | Stacks lists of 2D tensors into a unified 3D tensor block. |

A prominent example of operation chaining occurs when deploying Mixture-of-Experts (MoE) architectures, such as Mixtral, into the browser37. The Safetensors checkpoint stores expert parameters as distinctly isolated matrices (e.g., experts.0.w1.weight, experts.1.w1.weight). Submitting these as individual buffers to the execution engine would cause massive VRAM thrashing and obliterate performance due to excessive dispatch overhead. Instead, the pipeline applies a MergeModulelist(dim=0) operation followed by a Concatenate(dim=1) operation37. This chain stacks all individual expert projection weights into massive 3D blocks, allowing the WebGPU kernel to execute block-sparse matrix multiplications in a single, highly efficient dispatch.

### **Alternative Compilation: The MLC WebLLM Architecture**

While Transformers.js relies heavily on ONNX Runtime Web, an alternative paradigm is utilized by WebLLM, which relies on the Apache TVM compiler stack and the MLC-LLM framework3.  
Rather than interpreting an ONNX graph dynamically at runtime, MLC-LLM compiles the model architecture ahead of time into a static WebAssembly (.wasm) library containing highly optimized, device-specific compute kernels3. During this compilation phase (executed via the mlc\_llm convert\_weight and gen\_config commands), the Hugging Face tensors are irreversibly mapped and quantized into a proprietary format40.  
The output artifacts ingested by the browser include:

* **Quantized Weight Shards:** Binary files named params\_shard\_\*.bin.  
* **The Manifest:** An ndarray-cache.json file that maps the newly compiled runtime tensor names to their precise byte offsets within the binary shards3.  
* **Execution Configuration:** An mlc-chat-config.json file dictating metadata such as context\_window\_size and sliding window parameters to inform the engine's memory planning phase3.

This approach decouples the heavy lifting of tensor renaming and graph optimization from the client, shipping a completely static, pre-digested artifact directly to the browser3.

## **WebGPU Memory Orchestration and Alignment Constraints**

Once the weights are parsed, validated, and structurally mapped, they must be transmitted to the GPU for mathematical execution. WebGPU supersedes the older WebGL standard by providing a drastically lower-level, explicit API inspired by modern graphics interfaces like Vulkan, Direct3D 12, and Metal1. WebGPU exposes parallel compute shaders natively in the browser via the WebGPU Shading Language (WGSL), enabling high-performance general-purpose GPU (GPGPU) computations directly within the client44.  
However, transferring machine learning datasets to the GPU memory space introduces the most severe bottleneck in the entire browser pipeline: allocation latency and strict, hardware-enforced memory constraints2.

### **Hardware Limits: maxStorageBufferBindingSize**

The WebGPU specification enforces uncompromising limitations on the maximum amount of data a compute shader can bind and access in a single execution context. The most critical constraint governing LLM inference is maxStorageBufferBindingSize6. Because the WebGPU standard deliberately obscures total available Video RAM (VRAM) to prevent malicious device fingerprinting and cross-origin side-channel attacks, the inference engine cannot natively query how much memory is free6. Instead, it must rely exclusively on the reported limitations and track its own internal allocation state.  
The landscape of maxStorageBufferBindingSize across hardware profiles exhibits extreme variance6:

| Hardware Classification | Typical maxStorageBufferBindingSize | Implication for Browser Inference |
| :---- | :---- | :---- |
| Discrete GPU (NVIDIA / AMD) | 2 GB to 4 GB | High capacity; allows large contiguous tensor bindings. |
| Apple M-Series Unified Memory | 1 GB to 2 GB | Excellent for medium models; shared memory architecture reduces transfer overhead. |
| Intel Integrated (Iris Xe, UHD) | 256 MB to 1 GB | Demands aggressive sharding of weight matrices. |
| Mobile ARM Mali / Qualcomm | 128 MB to 512 MB | Extreme constraints; requires multi-pass dispatch and heavy quantization. |
| Software Fallback (WARP/SwiftShader) | 256 MB | Performance is fundamentally CPU-bound; minimal viability for large networks. |

If a tensor block exceeds the maxStorageBufferBindingSize, the WebGPU device will unconditionally throw a binding error (e.g., "Binding size is larger than the maximum binding size"), causing the dispatch to return undefined values or failing the pipeline creation outright46. Consequently, the dynamic weight loading pipeline must proactively intercept large matrices and physically shard them across the sequence dimension or feature dimension, queuing multiple sequential WebGPU dispatches to process the chunks piece by piece. Apple Safari's Metal backend restricts this to a mere 256 MB by default on iPhone devices (scaling up to 993 MB on iPad Pros), making the execution of multi-gigabyte models highly unstable unless weights are meticulously partitioned48.

### **Buffer Allocation Latency and Pooling Strategies**

Direct, per-operation WebGPU buffer allocations present significant performance and stability challenges. Allocating memory on the GPU (device.createBuffer) and writing data over the PCIe bus (device.queue.writeBuffer) are highly expensive, synchronous operations6.  
The latency of these allocations scales linearly with the data size:

| Buffer Size | createBuffer Latency | writeBuffer Latency | Total Allocation Latency |
| :---- | :---- | :---- | :---- |
| 100 KB | 0.08 ms | 0.01 ms | 0.09 ms |
| 1 MB | 0.12 ms | 0.05 ms | 0.17 ms |
| 4 MB | 0.15 ms | 0.20 ms | 0.35 ms |
| 20 MB | 0.20 ms | 0.85 ms | 1.05 ms |
| 40 MB | 0.25 ms | 1.70 ms | 1.95 ms |

In an autoregressive language model where thousands of successive token generation passes occur sequentially, allocating fresh intermediate activation buffers and Key-Value (KV) cache tensors on the fly for every pass completely starves the GPU, destroying tokens-per-second (tok/s) throughput6. Furthermore, WebGPU buffers exhibit invisible memory leaks in JavaScript. While the V8 JavaScript engine's garbage collector easily reclaims the lightweight JS wrapper object, the heavy VRAM allocation remains pinned until buffer.destroy() is explicitly called by the developer6. Unreturned buffers rapidly accumulate, leading to degraded browser rendering, silent eviction of textures, or outright tab crashes6.  
To eliminate allocation latencies and memory leaks, robust WebGPU engines implement a Size-Bucketed Buffer Pool6. Rather than allocating buffers dynamically, the engine preemptively allocates a pool of reusable buffers categorized in powers of two (e.g., 64 KB, 1 MB, 16 MB, up to 128 MB). When the execution graph requires memory, it requests a buffer from the appropriate bucket. If an operation requires 3 MB, the pool immediately yields a 4 MB buffer in ![][image2] time. While this results in 25% internal memory fragmentation (wasting 1 MB of VRAM in the block), the allocation overhead drops from milliseconds to ![][image3], as it bypasses GPU driver interaction completely6.  
To prevent the pool itself from exhausting VRAM, the total pool budget is hard-capped at a conservative 25% of the device's maxStorageBufferBindingSize (e.g., 512 MB on a discrete GPU, or just 32 MB on an ARM Mali mobile device). When the pool reaches this cap, an eviction strategy targets the largest available idle buffer, destroying it to free the maximum possible VRAM in a single call6.

### **WGSL Byte Alignment Rules**

When mapping JavaScript typed arrays to WebGPU buffers, rigorous byte alignment rules dictated by the WebGPU Shading Language (WGSL) must be enforced. WGSL structs mandate that data types are strictly aligned to their natural widths, and start at an offset that is a multiple of that alignment. For example, a 32-bit float (f32) requires a 4-byte alignment, while a 4-component vector (vec4f) demands a 16-byte alignment. Padding must be explicitly added before any misaligned member; failing to do so results in the GPU reading the data starting at the wrong offsets, causing silent, catastrophic rendering and math errors51.  
A critical failure point occurs at the JavaScript API boundary when attempting to pass 16-bit integer data (Uint16Array) to a WebGPU buffer. The writeBuffer method strictly mandates that the total byte length of the incoming payload must be a multiple of 4 bytes. Writing an odd number of Uint16 elements (e.g., 3 elements equating to 6 bytes) will throw a fatal OperationError52. By contrast, a Uint32Array inherently meets this requirement. The tensor ingestion pipeline must intercept these non-compliant arrays and pad them with trailing zeros to guarantee alignment with WebGPU’s 4-byte minimum boundary before dispatching the buffer to the hardware53.

## **Quantization Admission Rules for Browser Execution**

Given the extreme VRAM constraints, PCIe bandwidth limitations, and compute profiles of consumer devices, executing full-precision (FP32) models in the browser is untenable. A standard 7-billion parameter language model in FP16 demands approximately 14 GB of VRAM, entirely exceeding the memory envelope of the vast majority of global web users48. Quantization—the process of compressing the high-precision floating-point weights into lower bit-width integers—is an absolute prerequisite for browser admission48.

### **Bit-Width Specifications and VRAM Footprints**

Browser ML frameworks enforce specific quantization configurations depending on the underlying execution provider. The ONNX Runtime Web engine, for instance, distinguishes its capabilities between the CPU-bound WebAssembly (WASM) backend and the GPU-accelerated WebGPU backend1.

| Quantization Format | Target Backend | Footprint (3B Params) | Description and Performance Profile |
| :---- | :---- | :---- | :---- |
| fp32 | CPU / WebGPU | ![][image4] GB | Reference precision. Unsuitable for browser downloads due to massive payload size54. |
| fp16 | WebGPU | ![][image5] GB | Halves memory traffic. Natively supported by WebGPU compute shaders via the shader-f16 extension. Near-lossless accuracy, but can cause OOM on constrained devices1. |
| int8 (q8) | WASM / WebGPU | ![][image5] GB | Provides a reliable low-RAM default for WASM execution55. WebGPU can dequantize these on the fly, but may struggle with silent overflow bugs55. |
| int4 (q4/q4f16) | WebGPU | ![][image6] GB | Required for modern LLM inference. Compresses groups of weights into 4-bit blocks with FP16 scaling factors48. |

When quantizing models for the web, advanced formats like q4f16\_1 utilize grouped quantization (also known as K-quants). In this architecture, blocks of 256 weights are clustered together and further subdivided into sub-blocks of 32\. Each sub-block shares a symmetric scaling factor, and these scaling factors are themselves quantized into a single super-block scaling factor40. This drastically minimizes the memory footprint while preventing the catastrophic degradation of outlier weights. WebGPU compute kernels execute these compressed models by streaming the 4-bit indices and 16-bit scales into shared workgroup memory, dequantizing the matrix into FP16 locally within the arithmetic logic unit (ALU) just prior to executing the matrix multiplication dot product50. Emerging vector quantization methods (I-quants) further push this boundary by encoding small groups of weights as an index to a codebook of reference vectors50.

### **External Data and Initializer Layouts**

Because traditional ONNX files encapsulate both the computation graph and the weight initializers into a single protobuf payload, they hit a hard 2 GB serialization limit imposed by the Protocol Buffers specification57. For models exceeding this threshold, the quantization admission rules dictate that the weights must be physically decoupled from the graph57.  
This is achieved using the ONNX "external data" format. The model repository hosts a lightweight model.onnx file containing only the structural graph layout (nodes, operators, edges), alongside a massive model.onnx.data file housing the contiguous binary weight payload59. When initializing the InferenceSession in ONNX Runtime Web, developers must explicitly pass an externalData configuration array mapping the required external files to their relative web paths58.  
Transformers.js additionally imposes strict file naming schemas based on the selected dtype. If a developer requests a quantized model using the option dtype: 'q8', the library bypasses the default model.onnx file and strictly issues a network request looking for a file specifically named model\_quantized.onnx (not model\_q8.onnx). Failing to adhere to this precise, undocumented file mapping convention will result in 404 network errors, completely halting model ingestion55. Finally, zero-sized tensors are universally treated as CPU tensors by the runtime, bypassing the GPU allocation phase entirely to maintain architectural integrity62.

## **Conclusion**

The realization of high-performance, edge-native machine learning within web browsers is a triumph of highly coordinated systems engineering. Safetensors acts as the foundational catalyst, completely neutralizing the extreme security vectors inherent to legacy serialization formats while exposing instantaneous zero-copy deserialization capabilities and HTTP-friendly metadata extraction. As the architecture shifts into the configuration and alignment phases, robust prototype pollution defenses and isolated Jinja parsing engines ensure that adversarial payloads cannot commandeer the JavaScript execution context or escape the browser's sandbox.  
The most profound engineering challenges occur at the boundary between the browser’s JavaScript engine and the hardware’s GPU drivers. Because WebGPU deliberately obscures physical memory topology and imposes aggressive limits such as the maxStorageBufferBindingSize, the deployment pipeline must rely on sophisticated size-bucketed buffer pooling and Regex-driven dynamic weight reshaping to prevent driver crashes and out-of-memory cascades.  
Ultimately, strict quantization admission rules—specifically the utilization of grouped int4 formats coupled with ONNX external data partitioning—are what make executing billion-parameter models a reality over standard internet connections. By synchronizing cryptographic provenance, localized memory orchestration, and exact tensor layout transformations, the browser has evolved beyond a simple document viewer into a secure, scalable, and decentralized runtime for advanced artificial intelligence workloads.

#### **Works cited**

1. ONNX Runtime Web unleashes generative AI in the browser using WebGPU, [https://opensource.microsoft.com/blog/2024/02/29/onnx-runtime-web-unleashes-generative-ai-in-the-browser-using-webgpu/](https://opensource.microsoft.com/blog/2024/02/29/onnx-runtime-web-unleashes-generative-ai-in-the-browser-using-webgpu/)  
2. Characterizing WebGPU Dispatch Overhead for LLM Inference Across Four GPU Vendors, Three Backends, and Three Browsers \- arXiv, [https://arxiv.org/html/2604.02344v1](https://arxiv.org/html/2604.02344v1)  
3. webSLM: Building Browser-Native Domain-Specialized Small Language Models with WebLLM and MLC-LLM | by Vishal Mysore | Jun, 2026 | Medium, [https://medium.com/@visrow/webslm-building-browser-native-domain-specialized-small-language-models-with-webllm-and-mlc-llm-79216ce0bb2a](https://medium.com/@visrow/webslm-building-browser-native-domain-specialized-small-language-models-with-webllm-and-mlc-llm-79216ce0bb2a)  
4. Stable Diffusion in the Browser with WebNN \+ ONNX Runtime \- Scribbler, [https://scribbler.live/2026/04/02/Stable-Diffusion-in-the-Browser-with-WebNN-ONNX.html](https://scribbler.live/2026/04/02/Stable-Diffusion-in-the-Browser-with-WebNN-ONNX.html)  
5. Running BERT in web browsers \- Grokipedia, [https://grokipedia.com/page/Running\_BERT\_in\_web\_browsers](https://grokipedia.com/page/Running_BERT_in_web_browsers)  
6. WebGPU Memory Limits: maxStorageBufferBindingSize \- Ayoob AI, [https://ayoob.ai/blog/webgpu-maxstoragebufferbindingsize-limits-enterprise](https://ayoob.ai/blog/webgpu-maxstoragebufferbindingsize-limits-enterprise)  
7. SafeTensors Format: A Guide to Secure ML Model Serialization \- DataCamp, [https://www.datacamp.com/blog/safetensors-format](https://www.datacamp.com/blog/safetensors-format)  
8. Load safetensors \- Hugging Face, [https://huggingface.co/docs/diffusers/main/using-diffusers/using\_safetensors](https://huggingface.co/docs/diffusers/main/using-diffusers/using_safetensors)  
9. GitHub \- safetensors/safetensors: Simple, safe way to store and distribute tensors, [https://github.com/safetensors/safetensors](https://github.com/safetensors/safetensors)  
10. Reading Safetensors Headers \- Zenn, [https://zenn.dev/platina/articles/e65c73cb01a900?locale=en](https://zenn.dev/platina/articles/e65c73cb01a900?locale=en)  
11. SafeTensors: Efficient Serialization Format for Deep Learning | by Nishtha kukreti | Medium, [https://medium.com/@nishthakukreti.01/safetensors-efficient-serialization-format-for-deep-learning-57364317be43](https://medium.com/@nishthakukreti.01/safetensors-efficient-serialization-format-for-deep-learning-57364317be43)  
12. Metadata Parsing \- Hugging Face, [https://huggingface.co/docs/safetensors/metadata\_parsing](https://huggingface.co/docs/safetensors/metadata_parsing)  
13. safetensors/docs/source/metadata\_parsing.mdx at main \- GitHub, [https://github.com/huggingface/safetensors/blob/main/docs/source/metadata\_parsing.mdx](https://github.com/huggingface/safetensors/blob/main/docs/source/metadata_parsing.mdx)  
14. Verify SHA-256 checksum \- Akamai TechDocs, [https://techdocs.akamai.com/download-ctr/docs/verify-checksum](https://techdocs.akamai.com/download-ctr/docs/verify-checksum)  
15. AI Application Security: The Runtime Guide | Kodem, [https://www.kodemsecurity.com/resources/security-risks-across-the-ai-application-stack-a-researchers-guide](https://www.kodemsecurity.com/resources/security-risks-across-the-ai-application-stack-a-researchers-guide)  
16. How to Verify Downloaded Files Using Hash Checksums | Step-by-Step Guide, [https://hash-file.online/guides/verify-downloads.html](https://hash-file.online/guides/verify-downloads.html)  
17. Subresource Integrity \- Security \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource\_Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity)  
18. Downloading large files with integrity checks in Javascript | by Adeel Khan \- Medium, [https://adeelbarki.medium.com/downloading-large-files-with-integrity-checks-in-javascript-a9acb1b45298](https://adeelbarki.medium.com/downloading-large-files-with-integrity-checks-in-javascript-a9acb1b45298)  
19. DDUF \- Hugging Face, [https://huggingface.co/docs/hub/dduf](https://huggingface.co/docs/hub/dduf)  
20. Model Hub Mirror \- Backend.AI GO, [https://go.backend.ai/en/manual/api-server/model-hub-mirror/](https://go.backend.ai/en/manual/api-server/model-hub-mirror/)  
21. Silent Spring: Prototype Pollution Leads to Remote Code Execution in Node.js \- arXiv, [https://arxiv.org/abs/2207.11171](https://arxiv.org/abs/2207.11171)  
22. Unveiling the Invisible: Detection and Evaluation of Prototype Pollution Gadgets with Dynamic Taint Analysis, [https://people.kth.se/\~musard/research/pubs/www24.pdf](https://people.kth.se/~musard/research/pubs/www24.pdf)  
23. Prototype Pollution: Understanding and Exploiting a Hidden JavaScript Vulnerability | by Alberto Charabati | Medium, [https://medium.com/@albertoc\_91016/prototype-pollution-understanding-and-exploiting-a-hidden-javascript-vulnerability-28ea454b1f99](https://medium.com/@albertoc_91016/prototype-pollution-understanding-and-exploiting-a-hidden-javascript-vulnerability-28ea454b1f99)  
24. Vulnerabilites collected on Saturday 27/6 \- Meterian: Daily Vulnerabilities, [https://meterian.io/vulns?id=88433618-c6ac-3b7f-aad4-7fcff7971fa4\&date=2026/06/27](https://meterian.io/vulns?id=88433618-c6ac-3b7f-aad4-7fcff7971fa4&date=2026/06/27)  
25. Security Bulletin: Multiple Vulnerabilities in IBM watsonx Code Assistant On Prem, [https://www.ibm.com/support/pages/security-bulletin-multiple-vulnerabilities-ibm-watsonx-code-assistant-prem-25](https://www.ibm.com/support/pages/security-bulletin-multiple-vulnerabilities-ibm-watsonx-code-assistant-prem-25)  
26. Security Bulletin: Vulnerabilities found in Watson Data Intelligence \- IBM, [https://www.ibm.com/support/pages/security-bulletin-vulnerabilities-found-watson-data-intelligence](https://www.ibm.com/support/pages/security-bulletin-vulnerabilities-found-watson-data-intelligence)  
27. It seems like this vulnerability is yet another prototype pollution vulnerabilit... \- Hacker News, [https://news.ycombinator.com/item?id=46137352](https://news.ycombinator.com/item?id=46137352)  
28. Releases · braintrustdata/braintrust-sdk-javascript \- GitHub, [https://github.com/braintrustdata/braintrust-sdk-javascript/releases](https://github.com/braintrustdata/braintrust-sdk-javascript/releases)  
29. Chat templates \- Hugging Face, [https://huggingface.co/docs/transformers/chat\_templating](https://huggingface.co/docs/transformers/chat_templating)  
30. Supervised Fine-tuning Trainer \- Hugging Face, [https://huggingface.co/docs/trl/v0.19.1/sft\_trainer](https://huggingface.co/docs/trl/v0.19.1/sft_trainer)  
31. Advanced Usage and Customizing Your Chat Templates \- Hugging Face, [https://huggingface.co/docs/transformers/v4.49.0/chat\_template\_advanced](https://huggingface.co/docs/transformers/v4.49.0/chat_template_advanced)  
32. Writing a chat template \- Hugging Face, [https://huggingface.co/docs/transformers/chat\_templating\_writing](https://huggingface.co/docs/transformers/chat_templating_writing)  
33. How to understand the special tokens? \- Transformers \- Hugging Face Forums, [https://discuss.huggingface.co/t/how-to-understand-the-special-tokens/170916](https://discuss.huggingface.co/t/how-to-understand-the-special-tokens/170916)  
34. NousResearch/Hermes-2-Pro-Llama-3-8B · Add tool use template \- Hugging Face, [https://huggingface.co/NousResearch/Hermes-2-Pro-Llama-3-8B/discussions/13](https://huggingface.co/NousResearch/Hermes-2-Pro-Llama-3-8B/discussions/13)  
35. @huggingface/jinja \- npm, [https://www.npmjs.com/package/@huggingface/jinja?activeTab=code](https://www.npmjs.com/package/@huggingface/jinja?activeTab=code)  
36. Package jinja \- GitHub, [https://github.com/orgs/huggingface/packages/npm/package/jinja](https://github.com/orgs/huggingface/packages/npm/package/jinja)  
37. transformers/docs/source/en/weightconverter.md at main \- GitHub, [https://github.com/huggingface/transformers/blob/main/docs/source/en/weightconverter.md](https://github.com/huggingface/transformers/blob/main/docs/source/en/weightconverter.md)  
38. Dynamic weight loading \- Hugging Face, [https://huggingface.co/docs/transformers/weightconverter](https://huggingface.co/docs/transformers/weightconverter)  
39. Dynamic weight loading \- Hugging Face, [https://huggingface.co/docs/transformers/en/weightconverter](https://huggingface.co/docs/transformers/en/weightconverter)  
40. Convert Model Weights — mlc-llm 0.1.0 documentation, [https://llm.mlc.ai/docs/compilation/convert\_weights.html](https://llm.mlc.ai/docs/compilation/convert_weights.html)  
41. How to Build and Run Optimized, Self-Compiled LLMs Locally on MacBook Pro Apple Silicon M-series | Kiran's Blog, [https://blog.lynkos.dev/posts/self-compiled-llm/](https://blog.lynkos.dev/posts/self-compiled-llm/)  
42. LLM大模型推理加速: mlc-llm 教程，将qwen-7b 部署到手机上 \- CSDN博客, [https://blog.csdn.net/2401\_84495872/article/details/141994075](https://blog.csdn.net/2401_84495872/article/details/141994075)  
43. WebGPU \- W3C, [https://www.w3.org/TR/webgpu/](https://www.w3.org/TR/webgpu/)  
44. 0hq/WebGPT: Run GPT model on the browser with WebGPU. An implementation of GPT inference in less than \~1500 lines of vanilla Javascript. \- GitHub, [https://github.com/0hq/webgpt](https://github.com/0hq/webgpt)  
45. Eight translations of one dispatch — A WebGPU stack source-level walkthrough \- Airing, [https://ursb.me/immersive/webgpu/](https://ursb.me/immersive/webgpu/)  
46. When the Picture Is the Data. The lasso is the query. The shape you… | by Stevo Ledbetter | May, 2026 | Medium, [https://medium.com/@stevo\_actually/when-the-picture-is-the-data-744418dbc197](https://medium.com/@stevo_actually/when-the-picture-is-the-data-744418dbc197)  
47. WebGPU \- W3C, [https://www.w3.org/TR/2022/WD-webgpu-20221208/](https://www.w3.org/TR/2022/WD-webgpu-20221208/)  
48. The Era of LLMs Running in the Browser—How WebGPU Changed Local AI Inference \- note, [https://note.com/snake\_dragon/n/ncbb123143bf8?hl=en](https://note.com/snake_dragon/n/ncbb123143bf8?hl=en)  
49. WebGPU bugs are holding back the browser AI revolution | by Marcelo Emmerich | Medium, [https://medium.com/@marcelo.emmerich/webgpu-bugs-are-holding-back-the-browser-ai-revolution-27d5f8c1dfca](https://medium.com/@marcelo.emmerich/webgpu-bugs-are-holding-back-the-browser-ai-revolution-27d5f8c1dfca)  
50. Llamas on the Web: Memory-Efficient, Performance-Portable, and Multi-Precision LLM Inference with WebGPU \- arXiv, [https://arxiv.org/html/2605.20706v1](https://arxiv.org/html/2605.20706v1)  
51. Memory Allocation and Bytes Alignment in WebGPU (Ray Tracing Tutorial) \- Medium, [https://medium.com/@osebeckley/memory-allocation-and-bytes-alignment-in-webgpu-ray-tracing-tutorial-b53f99385ab3](https://medium.com/@osebeckley/memory-allocation-and-bytes-alignment-in-webgpu-ray-tracing-tutorial-b53f99385ab3)  
52. Alignment guarantees for mapped buffers · Issue \#3508 · gfx-rs/wgpu \- GitHub, [https://github.com/gfx-rs/wgpu/issues/3508](https://github.com/gfx-rs/wgpu/issues/3508)  
53. Issue: Data Alignment for Uint16Array in WebGPU \#4966 \- GitHub, [https://github.com/gpuweb/gpuweb/issues/4966](https://github.com/gpuweb/gpuweb/issues/4966)  
54. Run AI Models in the Browser with WebGPU & WASM \- Mad Devs, [https://maddevs.io/writeups/running-ai-models-locally-in-the-browser/](https://maddevs.io/writeups/running-ai-models-locally-in-the-browser/)  
55. Run a fine-tuned embedding model entirely in the browser \- Hugging Face, [https://huggingface.co/blog/stephen-standd/embedding-model-in-the-browser](https://huggingface.co/blog/stephen-standd/embedding-model-in-the-browser)  
56. Top 7 WebGPU Moves for Private Vector Search | by Bhagya Rana \- Medium, [https://medium.com/@bhagyarana80/top-7-webgpu-moves-for-private-vector-search-5080817012ee](https://medium.com/@bhagyarana80/top-7-webgpu-moves-for-private-vector-search-5080817012ee)  
57. \[Web\] Having trouble loading a model and creating a session · Issue \#14583 · microsoft/onnxruntime \- GitHub, [https://github.com/microsoft/onnxruntime/issues/14583](https://github.com/microsoft/onnxruntime/issues/14583)  
58. The 'env' Flags and Session Options | onnxruntime, [https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html)  
59. KevinAHM/soprano-web-onnx \- GitHub, [https://github.com/KevinAHM/soprano-web-onnx](https://github.com/KevinAHM/soprano-web-onnx)  
60. MedASR ONNX (ysdede) \- Hugging Face, [https://huggingface.co/ysdede/medasr-onnx](https://huggingface.co/ysdede/medasr-onnx)  
61. SessionOptions | ONNX Runtime JavaScript API, [https://onnxruntime.ai/docs/api/js/interfaces/InferenceSession.SessionOptions.html](https://onnxruntime.ai/docs/api/js/interfaces/InferenceSession.SessionOptions.html)  
62. Using WebGPU | onnxruntime, [https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABF0lEQVR4Xu3SvWpCQRAF4JFoYVCMlaSLKQKCYOEzCLGxsAiGlLZiSlOJaGMhiDaCfcgrpPABBB8gL2BlI9glkMRz2LlmvPGvSJd74Gt2x93r7Ij8y1RhbDxB1OxfwcBX04ULU7MJF4tqBZ9QMPsRSMNE1eESzkzNVu5VE5bwAmGzH4ehSpr1nfmzw0LiekA34g7igVlTk4GeYv3e8Ka+isEtfEHL1JThQR1MHhqKScAU3iCla22to4Nhr0rKSw2+oSI//eI/OKlf18oLR2EOr+K+xuvVSf1ir8gLf9SBd3FDerRXDG9lP3aFr8lX5SDnfHu/wtsf4c6/oeGccUxmcqRXfOqFuCZ/wLM6t0XixmTkWwsSJMgma7GJM4ZMgY89AAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAZCAYAAACo79dmAAACUUlEQVR4Xu2Wz4tOURjHH6EISdT4MfIjFhKjFCmzM7IRsUDsLJQ/gMiChYUmUpQ0U7LQlGwszGJWEys/FthYWZAfC2VnwYbvp/Oc9z2Oe997mDH11vupT9N7z5lznnvOc55zzXp0B7PkwcRSDsh9+cNS5ssz8qpcJ0fkD/lT3neXt3q3OSyvu3OyNlgg+/KHYq68InfkDSV0RbD97hN5Uu6UT+Wg3CQfWggYx+z3gFbLR/4XI/PkRnlavpNnk7aUDXLCwvyNrJHPXVaI36/kUNJnqXzmfpbrk7aLbs42eUkelR+tPljy/abVt7dgG+7IUZc04C/bTVvKZfeb3O7Plll4gd2xUwUrrPPKwh75WC7OG1JYvS8WJke28Zpcm/SJMBmmwRLka6vOx0hJsKTASzmQN0RYflaVPF3kduK8+8Ha+XVcTsqF/ruKkmCZmzj25w2RJRby9G7eUAEH6kFiPGAE0PT/JcHyspPWoU8cpGky4FSzongoed4Ltoo4SFPOktsUe/Ib0yoxY8FStCnm3y0Uf6yC2ssLxYsjhcEZg7Hq+JtgObC1nLBwK711tyZtXJHnLARTdcUCpzfuTB0lwfbJNxbqbS1s6QVrX6X4VX5yj8nZrd5/wlVMfUxvtMgWCzWY8RiXb4z3LrU8hfr6Qq7KnlfCzYF7LazWSgu52gQ33riFK3UqnLJwHkrmnBJUh3sWdim/okvghandu/KG/wEB3rBwdacfP6UckcM2A6saIYVuuXy1lbJZ3raGD5jppquChZizlLxS6Psved5jWvgFShmFciKBiKwAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAbCAYAAADmkHhFAAADKklEQVR4Xu2YXYhNURTHl1DkYzAiX/lMiZJ8PIkHFGU8KOWjKAoJD4hC4UHyoCQiiTyIB6WpoXkQFy9KkQfxohBJilIeTIn/v7VWs892zrlz58NMM/tfv+49e525d9//3muts0ckKSkpqctVbywF40G/bLhUQ8FiMB30j2KxxoIh8WBvVjK2kzUQHAWNxnpwBVywWJlo/mbwBGwCp8AdUGe4RoBF4Bz4DOYHsV6rFeCF6E4i1GBwD+z0mwo0G7wCc+yaRp8HZw3f9dvALnAA/JQ+YCx/+DVwGwwwXNxd96U8bQ+BZ2BkMLYDvDV8oVwN0keMHSaaxtfjgKhp78G4OGDiotwAFdEa63Lz8gxsj7FcWLLBXl3DwaTgOhTnzAU+CGZEsVKxQYwRrV2kSL4Lw50YihOgeUXG/gBz44CJZlaM2Ng/xqpg3GO1GsvaTd6BCTbmmUbiJstafhfMEp37QzA1c0eBJoum30fw1eAX5KXsArDEyFM1Y8tMaIuxfB+qPcayJBGaNcjGRovWdu5KFw12ww/b2DrR+yb6TUXizmO35qpQ/mFrROth+AEc3wOmGXnq6caydnMTEc7Hxb//IvqI5/LMZL/4DR6AjaKNuKrYDLbHg6aF4LloB+bz5DFwWlrNz1NPr7FMZc/K5cG4N8i4OVIzwSNRc7m4xzPRAiVjVZ1uLBvWvHgwEDvlCfBU9LmxWhrQHNYkr19ewygeEiqSNS0WzWcNY81z7RNtNMSbjatWY9m02EuIlzmfM1Oe37tW9CDDukq22n0c4315m+a/aCV4Kf8eEJrBbrtm7boIPhncFRQPBm/sleKP5gHBiTOlVmO5uMyaMHPYX76Lmsi500jOhzWX8BRJcc6XRU+S3SKuLE27adAklhC+92OpG/vaCHfPfvBY1Ky9ok2D8bCR8gT3AbSIpuc3u2Z6hykeyhvXL+MqOAIu2fsmUeOYxfwNZwzGt4Bb4KTFuk00aIqx2l7j3VYm7nTuRj47VvsnTFvl9ZVHblIvrc/snNsoyTeNpYvzyYslSfZQENfqpA6I9TWvqSZ1QEx1PlYuiwNJSUlJSUlJSV2nv/LjvHF+hKByAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAVCAYAAADB5CeuAAAAf0lEQVR4XmNgGAWjYBSMglEwvAArEBcD8V0gPgzFdkDMiKwICrSA2AiKaQoKgDiVAeI4cSieCsQ9QMyJpA4EAoFYH4ppBkSAOI8BM1RA/Dgg3sYACR0WIPZggDgW5HgQphkQA2JDdEEkAHLQFiB+BMQzgFgIVXoUjIJRMApoCgBM2wvoixs+RwAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAVCAYAAABVAo5cAAAAe0lEQVR4XmNgGAWjYBSMAnoBViAuBuK7QHwYiu2AmBFZERRoAbERFJMNCoA4lQFisTgUTwXiHiDmRFIHAoFArA/FZAERIM5jwPQNiB8HxNsYIL5iAWIPBohDQA4DYbKAGBAbogsiAZBlW4D4ERDPAGIhVOlRMApGAYUAACqbC+g6y2jbAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAWCAYAAAC2ew6NAAAAiElEQVR4XmNgGAWjYBSMglEwCgYjYAXiYiC+C8WHgdgOiBmRFUGBFhQboUvQAwwZhxYAcSoDxMEgLA7EU4G4B4g5kdSBQCAU66OJ0xyIAHEeA2bogfhxQLyNARKCLEDswQDxAAiDPERXIAbEhuiCSADkyC1A/AiIZwCxEBSPglEwCkbBKGBgAADpeBBm4zyiugAAAABJRU5ErkJggg==>
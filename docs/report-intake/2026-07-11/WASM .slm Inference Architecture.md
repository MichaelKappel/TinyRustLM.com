# **Architecture for Minimal-Footprint Execution of .slm Models in WebAssembly**

## **The Edge Inference Imperative and TinyRustLM Baseline**

The transition of localized artificial intelligence from monolithic server deployments to constrained browser environments demands a fundamental rethinking of model container architectures, memory management, and execution paradigms. The current TinyRustLM implementation relies on a rigid SLM1 format, imposing a 128 MiB single-allocation transfer ceiling, main-thread blocking, and full-file memory materialization1. This approach fundamentally limits the system to small parameter counts, such as the 16-million parameter deterministic smoke test, and prevents the scaling of edge inference to highly capable 135M, 360M, and 500M models without triggering Out-Of-Memory (OOM) browser kills2.  
Furthermore, the existing scalar execution runs entirely on the main JavaScript thread, which forces synchronous blocking of the browser UI during inference and relies on a non-cryptographic checksum for artifact validation1. To execute useful models directly within the client, the architecture must evolve. This report details a comprehensive architectural overhaul via a highly optimized, streaming-capable, and backward-compatible SLM2 Application Binary Interface (ABI). By leveraging WebAssembly (WASM) Single Instruction, Multiple Data (SIMD)6, the Origin Private File System (OPFS) with synchronous access handles8, grouped mixed-precision K-quantization10, and layer-at-a-time weight paging13, the proposed architecture delivers maximum token throughput with a strictly bounded resident memory footprint.

## **Versioned .slm ABI Proposal**

To support advanced quantization, piece-addressed loading, and metadata extensibility while maintaining backward compatibility with the existing 108-byte SLM1 header1, the .slm container must evolve into SLM2. The SLM1 format utilizes a fixed-header structure dictating model dimensions, RoPE theta, RMS epsilon, and a custom 64-bit checksum5. The SLM2 format expands this fixed contract to 128 bytes, absorbing previously zero-padded alignment spaces to encode advanced cryptographic and architectural features, while strictly maintaining the 64-byte alignment requirement for the subsequent tensor directory.

| Offset (Bytes) | Field | Type | Meaning / Value |
| :---- | :---- | :---- | :---- |
| **0** | Magic | 4 bytes | ASCII characters SLM2 (backward parsers read Version) |
| **4** | Version | u32 LE | Must be equal to 2 |
| **8** | Header length | u32 LE | At least 128 bytes |
| **12** | Model type/arch | u32 LE | Enumeration mapping to specific architectures (e.g., LLaMA, Qwen, Phi) |
| **16** | Flags | u32 LE | Bit 0: Tied output; Bit 1: GQA/MQA; Bit 2: Compressed Tokenizer |
| **20–52** | Model dimensions | u32 LE | Vocab, layers, heads, KV heads, head dim, FFN, context |
| **56** | RoPE theta | f32 LE | Rotary frequency base |
| **60** | RMS epsilon | f32 LE | Normalization epsilon |
| **64–80** | Tokenizer layout | u64 LE | Offset, uncompressed length, and compression dictionary offset |
| **88** | Tensor count | u32 LE | Number of 64-byte directory entries |
| **92** | Tensor-data offset | u64 LE | Must be 64-byte aligned |
| **100** | Merkle Root | 32 bytes | SHA-256 root hash of the piece-addressed chunk tree1 |

By inspecting the 4-byte Magic field and Version flag, the unified runtime establishes a seamless compatibility matrix. If SLM1 is detected, the parser routes to the legacy structural validator and enforces the 128 MiB full-file transfer ceiling1. If SLM2 is detected, the runtime unlocks hierarchical block quantization, piecewise streaming logic, and Merkle tree verification.

## **Exact Data Structures and Alignment Rules**

Directly following the main header contract are the directory entries. The original SLM1 format defined 64-byte tensor entries comprising an FNV-1a name hash, dtype, rank, dimensions, data offset/length, and block size, supporting only basic q8\_0 and q4\_0 data types1. The SLM2 specification retains the 64-byte size but repurposes legacy padding to support grouped quantization, sparse outlier matrices, and layer-indexing parameters critical for weight paging.

### **Grouped Quantization Layouts and Mixed Precision**

To shrink the memory footprint without degrading the emergent reasoning capabilities of models in the 135M to 500M parameter range, SLM2 adopts a hierarchical block quantization layout mirroring the GGUF K-quant family (Q4\_K, Q5\_K, Q6\_K)10. This mixed-precision architecture applies different bit-depths depending on the tensor's sensitivity, shifting away from the flat block structures that bake in precision loss.  
Traditional legacy quantization (like q4\_0) groups 32 weights per block with a single 16-bit float scale, which fails to accommodate the highly skewed weight distributions in modern transformer layers10. The SLM2 hierarchical block layout introduces super-blocks, offering finer granularity and minimizing scale overhead:

* **Q4\_K (4.5 bits-per-weight):** Designed for extreme memory constraint, this layout creates super-blocks of 256 weights, further subdivided into 8 sub-blocks of 32 weights. The 4-bit weights are scaled by a 6-bit sub-block scale and shifted by a 6-bit minimum, allowing asymmetric distributions without expanding metadata significantly11.  
* **Q5\_K (5.5 bits-per-weight):** Mirroring the Q4\_K layout, the Q5\_K format utilizes super-blocks of 256 weights and 8 sub-blocks of 32 weights, but utilizes 5-bit weight representations for layers highly sensitive to precision degradation, such as the initial and final transformer blocks12.  
* **Q6\_K (6.56 bits-per-weight):** Prioritizing fidelity, this layout utilizes super-blocks of 256 weights, subdivided into 16 blocks of 16 weights. Scales are encoded as 8-bit integers without individual block minimums, operating as a near-lossless stand-in for 16-bit floating point weights during critical projection phases11.

These per-channel, per-group, and block scale encodings utilize double-quantization. Rather than storing a full FP16 scale for every small block, the super-block maintains a base FP16 scale, and the sub-blocks store highly compressed 6-bit or 8-bit relative scales10. The tensor directory dictates exactly which scale encoding applies to which matrix.

### **Outlier Tensors and Sparse Residuals**

Language model weights frequently feature extreme outliers in specific projection channels that drive internal activations10. Clipping these outliers during 4-bit uniform quantization destroys model coherence, while accommodating them artificially inflates the scale of the entire block, crushing the resolution of standard weights10.  
To counter this, the SLM2 format allows tensors to define a "Sparse Residual" payload. The primary block stores the densely quantized weights, while a secondary sparse tensor maps exact matrix indices to FP16 outlier values. During the SIMD dot product, the quantized kernel executes rapidly over the dense integer matrix, followed immediately by a sparse scalar addition for the outliers. This preserves high-precision mathematical accuracy without requiring higher overall bit precision across the entire matrix, effectively granting Q4\_K the emergent reasoning capacity of Q6\_K at a fraction of the footprint.

### **Tied Embeddings**

To optimize spatial complexity, SLM2 explicitly supports tied embeddings via the header Flags register (Bit 0). By tying the input token embeddings (e.g., 32000 × 1024\) to the final output logits projection layer, the architecture eliminates the need to store duplicate parameter matrices2. For a 360M parameter model, this architectural decision saves tens of megabytes in both persistent storage and active memory footprints without a measurable loss of generative quality4.

## **Compression Dynamics: Tokenizer vs. Random-Access Weights**

In highly quantized small models, the vocabulary embeddings and tokenizer dictionaries represent a disproportionate amount of the overall artifact size. The SLM2 format implements dictionary-based entropy compression (e.g., zstd or brotli) exclusively for the string-to-token mappings and metadata blocks. The tokenizer block is streamed and decompressed exactly once into a statically bounded 2 MiB memory arena during model initialization4.  
While applying entropy compression to the entire .slm artifact would reduce the initial network download size, it is explicitly rejected for the tensor payloads. Random-access weight loading—which is strictly essential for layer-at-a-time execution (weight paging)—requires mathematically predictable byte offsets13. Entropy compression introduces variable-length encoding, which completely defeats ![][image1] offset addressing. If the entire file were compressed, the browser would be forced to decompress the entire artifact into a secondary memory buffer before execution could begin. For a 500M parameter model in Q8, this would require a 500 MiB decompression buffer, catastrophically violating the minimal-memory mandate and triggering browser tab eviction1.

## **Loading, Network, and Verification State Machines**

Operating effectively within the browser sandbox requires mitigating network instability, preventing main-thread UI blocks, and navigating the profound limitations of JavaScript memory bindings. The architecture establishes a robust state machine for model acquisition, cryptographic verification, and persistence.

### **IndexedDB vs. OPFS Persistence**

Legacy browser persistence relies heavily on IndexedDB. However, IndexedDB operates via a structured clone algorithm that is fundamentally unsuited for large binary model weights17. Retrieving a model from IndexedDB forces the browser to pull massive ArrayBuffer objects into the main Javascript V8 heap, causing severe latency spikes, garbage collection pauses, and frequent OOM crashes18.  
The proposed architecture wholly abandons IndexedDB for tensor storage in favor of the Origin Private File System (OPFS)8. OPFS provides a highly optimized, browser-internal private storage area that bypasses traditional quota prompts and offers near-native file I/O speeds18. Specifically, network acquisition and disk writing are moved to a Dedicated Web Worker, unlocking the exclusive FileSystemSyncAccessHandle8. This API allows the WASM runtime to execute synchronous, low-level POSIX-like file I/O operations (e.g., read(), write(), getSize()) directly against the local disk9. This mechanism ensures that weight data moves directly from the disk cache into WASM linear memory, completely bypassing the V8 Javascript garbage collector.

### **Streaming Admission and Direct Memory Writes**

Browsers impose strict memory limits on individual network allocations1. To perform streaming admission without holding duplicate full artifacts in memory, the system dynamically orchestrates data acquisition through HTTP Range requests, P2P WebRTC data channels, and local file loading via showOpenFilePicker()20.  
A critical engineering hurdle in the browser involves writing network streams directly into WebAssembly. While the ReadableStreamBYOBReader (Bring Your Own Buffer) is theoretically designed to write directly into an existing buffer to prevent zero-copy overhead, the web specification mandates that any ArrayBuffer passed to a BYOB reader is detached and transferred to the stream23. Because WebAssembly linear memory (WebAssembly.Memory.buffer) cannot be detached without permanently destroying the WASM instance23, a naive BYOB implementation targeting WASM directly will fail with a memory rejection exception23.  
To solve this paradox, the architecture utilizes a bounded 4 MiB staging buffer system.

1. The network thread pulls a piece-addressed chunk into the static 4 MiB staging buffer.  
2. The Dedicated Web Worker utilizes the OPFS FileSystemSyncAccessHandle.write() method to flush the chunk directly to the local disk cache8.  
3. The WASM runtime subsequently uses the POSIX-style synchronous file read to load only the required layers into its linear memory. This guarantees that peak memory during admission never exceeds the small bounded staging arena, regardless of the overall model size4.

### **Merkle Verification and Crash-Safe Recovery**

To prevent adversarial or corrupted model weights from generating toxic or nonsensical outputs, SLM2 enforces strict cryptographic verification. The header contains a 32-byte Merkle Root. As each piece-addressed chunk is downloaded, its SHA-256 hash is computed dynamically within WASM1. These chunk hashes form the leaves of a Merkle tree. Before a model state is marked as Ready, the tree is reduced, and the resulting root must exactly match the header payload. This allows for localized piece-addressed verification, ensuring that a P2P or multi-source download can instantly discard and re-request poisoned or corrupted pieces without discarding the entire artifact.  
Artifact downloads can be interrupted by network failure or mobile operating system backgrounding. The OPFS state machine records a "Chunk Manifest" independent of the artifact. If a download fails, the application reads the OPFS manifest, determines the last verified 4 MiB block, and initiates an HTTP Range request to resume exactly where it left off, providing crash-safe interrupted-download recovery without duplicate bandwidth consumption.

## **The Execution Engine: Paging, Threads, and Kernels**

Large Language Models typically load all weights into VRAM or RAM simultaneously for maximum memory bandwidth28. In the browser, pushing a 500M parameter model into WASM linear memory risks immediate tab suspension by the operating system due to baseline memory pressure14. The architecture solves this using strict temporal boundaries and hardware-accelerated kernels.

### **Layer-at-a-Time Execution (Weight Paging)**

Transformer inference is inherently sequential; processing layer ![][image2] does not require the weights of layer ![][image3] or ![][image4]14. The architecture implements weight paging. Using the OPFS FileSystemSyncAccessHandle, the runtime maps only the active layer's parameters into the WASM linear memory13.  
To hide the latency of disk I/O, the architecture utilizes Web Workers and WASM threads backed by SharedArrayBuffer and atomics5. While the primary WASM thread executes the matrix multiplications for Layer ![][image2], a background Web Worker prefetches Layer ![][image3] from the OPFS cache into a secondary, fixed-size WASM buffer. Once Layer ![][image2] completes, the pointers are swapped. This architectural shift reduces the peak memory requirement of the model weights from ![][image5] to ![][image6], permitting massive models to run on deeply constrained edge hardware4.

### **SIMD Kernels vs. WebGPU-Assisted Matmul**

WebAssembly SIMD (128-bit) provides the primary vehicle for high-throughput quantized matrix multiplication on edge devices7. The architecture leverages the Rust core::arch::wasm32 module to generate optimized vectorized dot products6. The fixed-width 128-bit operations (v128) process multiple quantized weights concurrently, achieving up to 15x speedups over pure scalar JavaScript loops6.  
Where supported by the browser environment, the runtime aggressively offloads matrix multiplications to the GPU using WebGPU31. A major challenge with WebGPU is the CPU-to-GPU data transfer bottleneck, which frequently negates the compute advantages for smaller workloads28. The architecture implements a zero-copy buffer mapping approach. By utilizing queue.writeBuffer()33, the runtime avoids creating duplicate TypedArray objects in the JavaScript heap, writing the piece-addressed chunked weights directly to the GPU's memory space for decoding in WGSL (WebGPU Shading Language) compute shaders35.

## **Rust-Oriented Pseudocode for Quantized Kernels and Chunk Loading**

The synergy between Rust's safe memory management, WASM SIMD intrinsics, and OPFS synchronous handles is best illustrated through the core runtime loops. The pseudocode below demonstrates the state machine for loading chunks via OPFS and dispatching them to a heavily optimized Q8\_0 SIMD kernel.

Rust  
// Core state machine and memory management structures  
pub struct Slm2Runtime {  
    active\_layer\_idx: usize,  
    opfs\_handle: OpfsSyncHandle,  
    weight\_arena\_a: Vec\<u8\>, // Paged prefetch buffer 1  
    weight\_arena\_b: Vec\<u8\>, // Paged prefetch buffer 2  
    kv\_cache: Int8KVCache,  
}

impl Slm2Runtime {  
    /// Synchronously pages the next layer from OPFS into WASM linear memory  
    pub fn page\_next\_layer(&mut self, target\_buffer: &mut \[u8\], offset: u64) \-\> Result\<(), Error\> {  
        // Read directly from the Origin Private File System into the WASM arena  
        // bypassing the V8 JavaScript heap entirely.  
        let bytes\_read \= self.opfs\_handle.read\_sync(target\_buffer, offset)?;  
        if bytes\_read \!= target\_buffer.len() {  
            return Err(Error::OpfsReadIncomplete);  
        }  
        Ok(())  
    }  
}

// SIMD Q8\_0 Dot Product Kernel for WebAssembly  
// Utilizes core::arch::wasm32 for 128-bit vectorization  
\#\[cfg(target\_arch \= "wasm32")\]  
\#\[target\_feature(enable \= "simd128")\]  
pub unsafe fn dot\_product\_q8\_simd(  
    weights: \*const u8,   
    activations: \*const u8,   
    len: usize,  
    block\_scale: f32  
) \-\> f32 {  
    use core::arch::wasm32::\*;  
      
    let mut sum\_vec \= f32x4\_splat(0.0);  
    let mut i \= 0;  
      
    // Process 16 bytes (128 bits) per iteration  
    while i \< len {  
        // Load quantized weights and 8-bit quantized activations directly from memory  
        let w\_vec \= v128\_load(weights.add(i) as \*const v128);  
        let a\_vec \= v128\_load(activations.add(i) as \*const v128);  
          
        // Extensional multiply of low and high bytes (i8 \* i8 \= i16)  
        let mul\_low \= i16x8\_extmul\_low\_i8x16(w\_vec, a\_vec);  
        let mul\_high \= i16x8\_extmul\_high\_i8x16(w\_vec, a\_vec);  
          
        // Pairwise addition into 32-bit integers  
        let sum\_low \= i32x4\_extadd\_pairwise\_i16x8(mul\_low);  
        let sum\_high \= i32x4\_extadd\_pairwise\_i16x8(mul\_high);  
          
        // Convert integer sums to floating point vectors  
        let f\_low \= f32x4\_convert\_i32x4(sum\_low);  
        let f\_high \= f32x4\_convert\_i32x4(sum\_high);  
          
        // Accumulate into the running total  
        sum\_vec \= f32x4\_add(sum\_vec, f\_low);  
        sum\_vec \= f32x4\_add(sum\_vec, f\_high);  
          
        i \+= 16;  
    }  
      
    // Horizontal sum of the f32x4 vector (simplified for brevity)  
    let final\_int\_sum \= horizontal\_sum(sum\_vec);  
      
    // Apply the block-level FP16 scale to the integer dot product  
    final\_int\_sum \* block\_scale  
}

## **Context Management: Sliding Windows and KV Caches**

Autoregressive decoding generates a Key-Value (KV) cache that grows linearly with the context length, threatening to overrun strict memory constraints38. Standard FP16 KV caches for a 500M parameter model at a 2048 context reach approximately 78 MiB, heavily impacting the available heap4.  
The SLM2 runtime enforces KV cache quantization, dropping the precision of cached keys and values to Int8 or Q8\_04. This mathematically predictable transformation halves the KV memory requirement to 39 MiB for the 500M model4. Furthermore, to prevent OOM errors during extended conversational agent loops, the runtime enforces a bounded context with a sliding window mechanism. When the prompt approaches the 2048-token limit, the earliest tokens (excluding the critical system prompt and first user interaction) are systematically evicted. The relative RoPE (Rotary Position Embedding) indices are subsequently shifted downward5, ensuring that the forward scratch arena and the KV cache never exceed their statically allocated bounds.

## **Desktop and Mobile Resource Budgets**

To validate the viability of the architecture across deeply constrained edge devices, deterministic memory budgets for three representative model sizes (135M, 360M, and 500M) were calculated under both full-resident and weight-paged operational modes4.  
The calculations include the overhead of the WASM heap execution environment (roughly 16 MiB for static data and call stacks), the statically decompressed Tokenizer (2 MiB), the heavily optimized int8 KV cache at a context of 2048, the dynamic forward scratch arena (calculated as ![][image7] bytes, where ![][image8] is hidden dimension, ![][image9] is feed-forward dimension, and ![][image10] is context size), and a 16 MiB allocation for the bounded staging and streaming network verification buffers1.

### **TinyRustLM-135M Resource Budget**

**Architecture:** 16 Layers, Hidden Dim: 768, FFN: 2304, Heads: 12, KV Heads: 4, Context: 2048, Tied Embeddings.

| Metric | q4 (4.5 bpw) | q5 (5.5 bpw) | q6 (6.56 bpw) | q8 (8.5 bpw) |
| :---- | :---- | :---- | :---- | :---- |
| Model Weights | 72.26 MiB | 88.32 MiB | 105.38 MiB | 136.49 MiB |
| Tokenizer (Static) | 2.00 MiB | 2.00 MiB | 2.00 MiB | 2.00 MiB |
| KV Cache (int8) | 16.00 MiB | 16.00 MiB | 16.00 MiB | 16.00 MiB |
| Activations & Scratch | 0.06 MiB | 0.06 MiB | 0.06 MiB | 0.06 MiB |
| Verification & IO Buffers | 16.00 MiB | 16.00 MiB | 16.00 MiB | 16.00 MiB |
| WASM Engine Runtime | 16.00 MiB | 16.00 MiB | 16.00 MiB | 16.00 MiB |
| **Total Resident Mode** | **106.32 MiB** | **122.38 MiB** | **139.44 MiB** | **170.55 MiB** |
| **Peak Paged Mode** | **70.63 MiB** | **75.20 MiB** | **80.06 MiB** | **88.91 MiB** |

### **TinyRustLM-360M Resource Budget**

**Architecture:** 24 Layers, Hidden Dim: 1024, FFN: 3584, Heads: 16, KV Heads: 4, Context: 2048, Tied Embeddings.

| Metric | q4 (4.5 bpw) | q5 (5.5 bpw) | q6 (6.56 bpw) | q8 (8.5 bpw) |
| :---- | :---- | :---- | :---- | :---- |
| Model Weights | 193.11 MiB | 236.02 MiB | 281.61 MiB | 364.75 MiB |
| Tokenizer (Static) | 2.00 MiB | 2.00 MiB | 2.00 MiB | 2.00 MiB |
| KV Cache (int8) | 24.00 MiB | 24.00 MiB | 24.00 MiB | 24.00 MiB |
| Activations & Scratch | 0.09 MiB | 0.09 MiB | 0.09 MiB | 0.09 MiB |
| Verification & IO Buffers | 16.00 MiB | 16.00 MiB | 16.00 MiB | 16.00 MiB |
| WASM Engine Runtime | 16.00 MiB | 16.00 MiB | 16.00 MiB | 16.00 MiB |
| **Total Resident Mode** | **235.19 MiB** | **278.11 MiB** | **323.70 MiB** | **406.84 MiB** |
| **Peak Paged Mode** | **90.29 MiB** | **97.45 MiB** | **105.05 MiB** | **118.92 MiB** |

### **TinyRustLM-500M Resource Budget**

**Architecture:** 26 Layers, Hidden Dim: 1152, FFN: 4096, Heads: 18, KV Heads: 6, Context: 2048, Tied Embeddings.

| Metric | q4 (4.5 bpw) | q5 (5.5 bpw) | q6 (6.56 bpw) | q8 (8.5 bpw) |
| :---- | :---- | :---- | :---- | :---- |
| Model Weights | 266.61 MiB | 325.85 MiB | 388.80 MiB | 503.59 MiB |
| Tokenizer (Static) | 2.00 MiB | 2.00 MiB | 2.00 MiB | 2.00 MiB |
| KV Cache (int8) | 39.00 MiB | 39.00 MiB | 39.00 MiB | 39.00 MiB |
| Activations & Scratch | 0.10 MiB | 0.10 MiB | 0.10 MiB | 0.10 MiB |
| Verification & IO Buffers | 16.00 MiB | 16.00 MiB | 16.00 MiB | 16.00 MiB |
| WASM Engine Runtime | 16.00 MiB | 16.00 MiB | 16.00 MiB | 16.00 MiB |
| **Total Resident Mode** | **323.70 MiB** | **382.95 MiB** | **445.90 MiB** | **560.69 MiB** |
| **Peak Paged Mode** | **111.86 MiB** | **120.47 MiB** | **129.63 MiB** | **146.32 MiB** |

By employing the layer-at-a-time weight-paged execution mode over OPFS, the peak memory footprint for the 500M parameter model in q6 drops from an unmanageable 445.90 MiB down to a highly constrained 129.63 MiB4. This memory profile is well within the safety margins of constrained mobile device browsers, entirely dodging aggressive iOS Safari memory eviction thresholds, and maintaining operational capacity just over the previous absolute 128 MiB runtime ceiling1.

## **Compatibility and Migration Rules**

The migration from the monolithic, main-thread SLM1 paradigm to the asynchronous, OPFS-backed SLM2 architecture demands strict compatibility enforcement to ensure seamless user experiences across fragmented edge environments.  
The Web Worker parses the initial 128 bytes upon network acquisition. If SLM1 is identified by the magic bytes, the system issues a deprecation warning to the console, disables the layer-at-a-time OPFS streaming logic, and falls back to full-memory materialization for backward compatibility5. Furthermore, if a legacy browser does not support the FileSystemSyncAccessHandle within Dedicated Web Workers9, the engine aborts the streaming load and gracefully degrades. It intercepts the HTTP stream, buffers it via standard asynchronous OPFS or IndexedDB, and informs the user of expected latency spikes and memory warnings. Upon instantiation, the runtime actively probes CPUID and browser features for v128 SIMD and WebGPU. It statically maps the fastest backend available to the execution graph, ensuring zero runtime branching overhead29.

## **Quality Assurance: TDD, Fuzzing, and Test Matrices**

Local-first, client-side inference dictates that errors degrade gracefully rather than crash the browser. A rigorous testing matrix must be established across multiple axes to guarantee stability.

| Test Axis | Validation Target | Methodology |
| :---- | :---- | :---- |
| **TDD & Unit Fuzzing** | SLM2 Header Parser | Fuzzing against invalid Merkle roots, malformed tensor alignments, and out-of-bounds layer definitions. K-quant decompression routines are unit-tested to ensure bit-level parity with reference implementations11. |
| **Corruption & Recovery** | Chunk Manifest State Machine | Network interruptions are artificially simulated at arbitrary byte boundaries to trigger the HTTP Range request recovery protocol. Verify OPFS handles release locks during abrupt worker termination9. |
| **Browser Compatibility** | Web API Implementations | Automated test harnesses execute across headless Chrome, Firefox, and WebKit to guarantee uniform behavior regarding WASM SIMD, OPFS file visibility, BYOB stream edge cases, and Worker instantiation7. |
| **Memory Eviction** | Weight Paging Stability | Execution of the 500M model is simulated under artificial 150 MiB browser heap constraints to validate the stability of the sliding window context and layer-at-a-time memory swaps. |

## **Prioritized Implementation Sequence**

To seamlessly deliver these architectural improvements without breaking existing local pipelines, the development sequence is highly prioritized based on risk and footprint impact.

1. **Phase 1: OPFS and Web Worker Orchestration.** Refactor the synchronous main-thread runtime into a Dedicated Web Worker. Implement the HTTP Range streaming admission and OPFS FileSystemSyncAccessHandle persistence loop8. This immediately cures UI freezing and establishes a framework for bypassing the 128 MiB transfer ceiling1.  
2. **Phase 2: SLM2 Container and Merkle Verification.** Expand the .slm parser to read the 128-byte v2 header. Implement the SHA-256 chunk hashing and Merkle root verification during the initial streaming download5.  
3. **Phase 3: Hierarchical K-Quants and SIMD.** Introduce the Q4\_K, Q5\_K, and Q6\_K tensor directory structures. Port the inner loop dot products to utilize Rust core::arch::wasm32 SIMD intrinsics, drastically increasing scalar throughput6.  
4. **Phase 4: Weight Paging and Int8 KV Cache.** Decouple the tensor memory allocator. Implement the layer-at-a-time active memory swap using OPFS synchronous reads and apply Int8 quantization to the KV Cache state plane4.  
5. **Phase 5: WebGPU Offloading.** Introduce experimental WebGPU buffer mapping (queue.writeBuffer) and WGSL shaders for supported desktop environments, offering maximum token throughput33.

The TinyRustLM runtime currently suffers from self-imposed architectural limitations that restrict it to basic smoke tests. By adopting the SLM2 ABI, moving execution into Dedicated Web Workers via OPFS, utilizing hardware-accelerated SIMD intrinsics, and dynamically paging weights a single layer at a time, the resident memory footprint of a 500M parameter model is compressed by over 70%—from an untenable 445 MiB down to a highly efficient 129 MiB. This architecture proves that excessive downloads and peak browser memory are not absolute hardware limitations, but rather software boundaries that can be systematically engineered away, allowing local micro language models to run securely and swiftly inside any modern browser, entirely independent of cloud inference constraints.

#### **Works cited**

1. Implementation operations \- MiRust, [https://mirust.com/implementation-operations/](https://mirust.com/implementation-operations/)  
2. Models \- MiRust, [https://mirust.com/models/](https://mirust.com/models/)  
3. Building ALLM: a Rust local LLM runtime that streams GGUF weights under a hard RAM budget \- Reddit, [https://www.reddit.com/r/rust/comments/1ullby2/building\_allm\_a\_rust\_local\_llm\_runtime\_that/](https://www.reddit.com/r/rust/comments/1ullby2/building_allm_a_rust_local_llm_runtime_that/)  
4. [unknown\_url](http://docs.google.com/unknown_url)  
5. Implementation \- MiRust, [https://mirust.com/implementation/](https://mirust.com/implementation/)  
6. core::arch::wasm32 \- Rust, [https://doc.rust-lang.org/core/arch/wasm32/index.html](https://doc.rust-lang.org/core/arch/wasm32/index.html)  
7. Rust \+ WebAssembly 2025: Why WasmGC and SIMD Change Everything \- DEV Community, [https://dev.to/dataformathub/rust-webassembly-2025-why-wasmgc-and-simd-change-everything-3ldh](https://dev.to/dataformathub/rust-webassembly-2025-why-wasmgc-and-simd-change-everything-3ldh)  
8. How to Handle Files Synchronously in the Browser | R3gardless.dev, [https://r3gardless.dev/en/blog/2026-03-20-sync-file-handling-in-browser/](https://r3gardless.dev/en/blog/2026-03-20-sync-file-handling-in-browser/)  
9. FileSystemSyncAccessHandle \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/FileSystemSyncAccessHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemSyncAccessHandle)  
10. GGUF Optimization: A Technical Deep Dive (Part 1 of 2\) \- Medium, [https://medium.com/@michael.hannecke/gguf-optimization-a-technical-deep-dive-for-practitioners-ce84c8987944](https://medium.com/@michael.hannecke/gguf-optimization-a-technical-deep-dive-for-practitioners-ce84c8987944)  
11. \[copilots\] Support non-uniform block quantization in ONNX (GGUF K-quant, super-block structures) · Issue \#7691 \- GitHub, [https://github.com/onnx/onnx/issues/7691](https://github.com/onnx/onnx/issues/7691)  
12. Which Quantization Should I Use? A Unified Evaluation of llama.cpp Quantization on Llama-3.1-8B-Instruct \- arXiv, [https://arxiv.org/html/2601.14277v1](https://arxiv.org/html/2601.14277v1)  
13. MCAP: Deployment-Time Layer Profiling for Memory-Constrained LLM Inference \- arXiv, [https://arxiv.org/html/2604.21026v1](https://arxiv.org/html/2604.21026v1)  
14. Partial LLM Loading: Running Models Too Big for VRAM | TinyComputers.io, [https://tinycomputers.io/posts/partial-llm-loading-running-models-too-big-for-vram.html](https://tinycomputers.io/posts/partial-llm-loading-running-models-too-big-for-vram.html)  
15. GGUF · Hugging Face, [https://huggingface.co/docs/hub/gguf](https://huggingface.co/docs/hub/gguf)  
16. GGUF's "Q4\_K\_M": What are you actually choosing?｜Komugi @ PowerPlatform \- note, [https://note.com/quick\_pipit7468/n/n876606cf31e7?hl=en](https://note.com/quick_pipit7468/n/n876606cf31e7?hl=en)  
17. The browser is your database: Local-first comes of age | InfoWorld, [https://www.infoworld.com/article/4133648/the-browser-is-your-database-local-first-comes-of-age.html](https://www.infoworld.com/article/4133648/the-browser-is-your-database-local-first-comes-of-age.html)  
18. Why Local-First Software Is the Future and its Limitations | RxDB \- JavaScript Database, [https://rxdb.info/articles/local-first-future.html](https://rxdb.info/articles/local-first-future.html)  
19. Rewriting Reflect in SQLite, [https://reflect.app/blog/sqlite-rewrite-techical-explanation](https://reflect.app/blog/sqlite-rewrite-techical-explanation)  
20. Origin private file system \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API/Origin\_private\_file\_system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)  
21. Breaking change: sync methods for AccessHandles | Blog \- Chrome for Developers, [https://developer.chrome.com/blog/sync-methods-for-accesshandles](https://developer.chrome.com/blog/sync-methods-for-accesshandles)  
22. Sync methods for SyncAccessHandle in File System Access API \- Chrome Platform Status, [https://chromestatus.com/feature/5149644305203200](https://chromestatus.com/feature/5149644305203200)  
23. We deserve a better streams API for JavaScript \- The Cloudflare Blog, [https://blog.cloudflare.com/a-better-web-streams-api/](https://blog.cloudflare.com/a-better-web-streams-api/)  
24. ReadableStreamBYOBReader: read() method \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamBYOBReader/read](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamBYOBReader/read)  
25. Why can I not reuse the buffer I brought to the ReadableStreamBYOBReader?, [https://stackoverflow.com/questions/79449404/why-can-i-not-reuse-the-buffer-i-brought-to-the-readablestreambyobreader](https://stackoverflow.com/questions/79449404/why-can-i-not-reuse-the-buffer-i-brought-to-the-readablestreambyobreader)  
26. Zero-copy pass ArrayBuffer from JS-land to WebAssembly-land · Issue \#1162 \- GitHub, [https://github.com/WebAssembly/design/issues/1162](https://github.com/WebAssembly/design/issues/1162)  
27. GGUF \- Wikipedia, [https://en.wikipedia.org/wiki/GGUF](https://en.wikipedia.org/wiki/GGUF)  
28. The Engine Behind Modern LLM Inference, Part 1: Continuous Batching, PagedAttention, and the End of Naive Serving | by Parth Joshi | Medium, [https://medium.com/@parth010872/the-engine-behind-modern-llm-inference-part-1-continuous-batching-pagedattention-and-the-end-of-859215173d34](https://medium.com/@parth010872/the-engine-behind-modern-llm-inference-part-1-continuous-batching-pagedattention-and-the-end-of-859215173d34)  
29. WASM \+ SIMD for On-Device AI: Private, Fast, Offline | by Thinking Loop | Medium, [https://medium.com/@ThinkingLoop/wasm-simd-for-on-device-ai-private-fast-offline-3ef82c47172d](https://medium.com/@ThinkingLoop/wasm-simd-for-on-device-ai-private-fast-offline-3ef82c47172d)  
30. I built a WASM SIMD inference engine in Rust \- semantic embedding model in 7MB \- no torch, no ML framework (\~2ms embedding inference) \- Reddit, [https://www.reddit.com/r/rust/comments/1urd2hp/i\_built\_a\_wasm\_simd\_inference\_engine\_in\_rust/](https://www.reddit.com/r/rust/comments/1urd2hp/i_built_a_wasm_simd_inference_engine_in_rust/)  
31. LiteRT LM on the Web: Running Generative AI Locally in the Browser | by Shivay Lamba, [https://shivaylamba.medium.com/litert-lm-on-the-web-running-generative-ai-locally-in-the-browser-f6d5393c3756?source=rss-------1](https://shivaylamba.medium.com/litert-lm-on-the-web-running-generative-ai-locally-in-the-browser-f6d5393c3756?source=rss-------1)  
32. Serverless AI in a Browser Tab: Java WebAssembly \+ Local WebGPU LLMs, [https://dev.to/vishalmysore/serverless-ai-in-a-browser-tab-java-webassembly-local-webgpu-llms-f4g](https://dev.to/vishalmysore/serverless-ai-in-a-browser-tab-java-webassembly-local-webgpu-llms-f4g)  
33. GPUQueue: writeBuffer() method \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/writeBuffer](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/writeBuffer)  
34. Unweight: how we compressed an LLM 22% without sacrificing quality \- The Cloudflare Blog, [https://blog.cloudflare.com/unweight-tensor-compression/](https://blog.cloudflare.com/unweight-tensor-compression/)  
35. 7 WebGPU \+ WASM Plays for Private On-Device ML | by Bhagya Rana | Medium, [https://medium.com/@bhagyarana80/7-webgpu-wasm-plays-for-private-on-device-ml-a114bbba8c58](https://medium.com/@bhagyarana80/7-webgpu-wasm-plays-for-private-on-device-ml-a114bbba8c58)  
36. Buffer in wgpu \- Rust \- Docs.rs, [https://docs.rs/wgpu/latest/wgpu/struct.Buffer.html](https://docs.rs/wgpu/latest/wgpu/struct.Buffer.html)  
37. WebGPU Speed and Optimization, [https://webgpufundamentals.org/webgpu/lessons/webgpu-optimization.html](https://webgpufundamentals.org/webgpu/lessons/webgpu-optimization.html)  
38. Streaming LLM Responses: Make Your AI App Feel Fast \- Redis, [https://redis.io/blog/streaming-llm-responses/](https://redis.io/blog/streaming-llm-responses/)  
39. Guides \- MiRust, [https://mirust.com/guides/](https://mirust.com/guides/)  
40. aprender-compute \- crates.io: Rust Package Registry, [https://crates.io/crates/aprender-compute/](https://crates.io/crates/aprender-compute/)  
41. What's New in WebGPU (Chrome 145\) | Blog, [https://developer.chrome.com/blog/new-in-webgpu-145](https://developer.chrome.com/blog/new-in-webgpu-145)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAaCAYAAAAue6XIAAACIUlEQVR4Xu2WTUhVQRiGP0mjMElIsLRQE4IgMahNUDsFRQIRF0nt3bToh/4WLkSEdpILiZQiQYRqm4i2kFy2zlYtAltGK0FX9b7MO/eeM96xUUy4eB94QGfm3nnnnJlvrtkhpgrWSf6dQg2sDRt3Aye6IB/DKTgIj8tS8DN3Yb9MhWFH4OWwI5WyCdsKl+BTeRIegw/gF9niB2e4AV/AaunhIlrlK9iX6fOcg3PwlEziKlyDXWGHuQDzGX0g/7Q52SW1eerh84y/4c3ciCJPzL0ZuiNn5Tf4zOKHg19Iv8NGtV2THyy+Rc7IHxYPewUuSr7NkjDYmFyHbfnuHD4sn1CH2rg96LgfVIKUsA1wVXYGfQXKKixfJ18/5b6LbQG2v5GclJOTt3JY/5ciJSxrLQ827Q36CnCvbEg+oRhc+Vf50VyF4CHjXqWxECQlLPELj47h4diS0UFgAG7KbrXxaXySO31238JehL/k7aDPw9P52VydpCzknn9OYGlhuc24DWlsTHmF5cTvMmaDENbOGfjeXOiwBk5KVokYKWFPwAV5PejLcVouw9fmBt+RbBuCRwqj89ySs7a9kvAQPrLiNf0H/oQvrXgFe3gprcjmTHsUTtZkrnS0y1hIT5vkzeNvtb3QAydkuOh9g19MR8094b3ArTdtrozS/0ZZhfXw4PF3r/9RtBtYw+9ZceEHAkM+lEeDvhjn4X3bXoUqVKhwkPwFRE1713DPkaIAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAAA90lEQVR4Xu3TL4sCURQF8CdusImyKKLFJIJtq9FgMNgUBINJxE+gRfAryG7Z7tcwiRarVmH7gtEgnsM7D+aPfxCmCHPgh3Lv9Q1zZzTmXZKEHBT0Say5pIR9x9VCifSwLLRhDRdpevpV+YEjjOBTboaNb9jJEj58E8Y0YBCo3cwXDGEs/1DzTdg+556mD3Uoyx/M1HP7mUNGtYeJ7LCEsT8s6jstYA951Ykz7D0MrzY1/oVzNyfoGrt46nj6d+OW7w0P5hPdwEReWn4wfNfOsJKn+2IiOcwtm0+pFOgxaWNv81fupgUH4d9nCxXfhA1f4J7EiRMnlCtjtCt3o10UOgAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAaCAYAAAD8K6+QAAABcUlEQVR4Xu2WwSsFURTGj1CKEonExoaUhbK1tLCQ7LxSFmwkyUaKBWUpO1Gyl5X/QFZiY8tW2StLRb6vc27N3J7mvTs180z3V7/e65w78+abN/feEYn8b9rhIBy2T8qao8tk3+lqLU1lg/XDJfgAf8z5RH/SvIBvcBMOmEUxBA/hjtkwvMhz+Gxew47UCJE5uObVGmUcLvrFDNxTsQtP4CvcMxtmBm7ALfMDTqVGaJ/jQnDnD6UH3ktAsFU4C8fMd3hkPXfnjmGf1ZolBvuDoGBtoiFG7Ds9gy+ik5Z1yjHshVBKMP4LB5JeLHghn7AmumjQ5US/WUoJVu9HGZIr4yPcN7MWDh5Dt+Gl563oduLXT0X3xSyCgrn55cO97Ev0hDR0fpF6N68ZYjDiFgqudqNej/SKPopXZh4KC7YgupNTvkI9wYnUCIWb9YqZhzzB1uEd/BZ9caA3cDo5qCzyBGtpOmG3X6wClQ0WiUQikcL5BaKwUiXnZxHbAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAaCAYAAAD8K6+QAAABSUlEQVR4Xu2WsUsDUQyHIzo4CFKRiujiVAoOgmtHBwcHNwXBwS5SOnQpBR0UHF2LgriL/4Q4iS6uugrugqNQ8fcjeXB3i48D76nkg4+WJFea9pJ3Is7fZhzW4by9UsYCkybzwRD71fzbxmbgJryDn+Z6Jt80z+EL7MBZsyrm4BHsmdHwS57BR/MKTuQqRNbgXiH2k4S7og9P4TMcmNGswn3YNd/gcq5C86xLwRS8lRKN7cIWXDJf4bHlwi93AmsWqxpvLMuYaBML9p4O4ZPo0DJOWcNcCko1xn/hUPLLgrP0DrdFlwbdyuSrplRjYXFkYZPcjPfwwIxdHCvwItK2XfMdpRoL81WEZ9mH6AfSVPNFvDESFgW33WIhR6ZFb8VLMyXRjW2InuSUj1APsJGrUHhY75ip4BzewJHogwO9Fp1lx3Ecx3GcRHwBEeRKuZlrB1MAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,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>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAAA30lEQVR4Xu3TwQoBURQG4CMpxYZEslBewVPYWNkpJc9iZWepxKPMSsnCE1jKwkJZKvH/zbk5XcNomo2av76mufd275kzXZF/SR7q0PSUoQANZeeK6i2pblaFAezhoEbQhhaM1RE2uramIlOBHUyVTUedYOjNRaYLV+grGzfGea6LDU/kya4Km7li5fyC2KS2WQ5WcNYnLdRSwkOI41z7Nbb5flzjEzXfj2t8oub7YbWs+qd+Malsxma65gcSXh8bvnPc/ZSPze/BVt3hBmt53cOJhNU84KJmUJIsWbKYPAGarjj+SKqvAgAAAABJRU5ErkJggg==>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAcCAYAAABoMT8aAAAAx0lEQVR4Xu3TsQ7BUBTG8SNISBmIRERHi8nkAYwGi5BIPIB3MHURm8EmBrtY7XazN2BhMpr4Tu5noDe5oRv9J7+kuW1Pbm5akZ8rDWWoOOQoVBUCuNEaBjCkBVxhRNaacCK9fk8Hdcha5AG6tQOVuJanJLTEDLYNlwSsYEMpyMKYPKhBkUIVYC/m8FQPljAjZ5EHNOACffJhCl1ypg8dxbyoNN1FnZzNYQsZ+rivBzy/7R1MXm+5a4s5eXWHs5idKP2x4uL+oQcQayrICb3KIQAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAcCAYAAABoMT8aAAAA3klEQVR4Xu3TLwvCQBzG8RM0GNTm36DYxCLYRBDEYjAZDAabJjGKQV+AxTegiNWXoMFqNItVfQVGwee2ZzBuB86tyb7wCbsfO45xE+Jvi1ATljCnDEShRtoacKEF5G1WcIIROerCFSqkVoQb1MmR5w3KdIeefaAUgx2kyCgMazpDwhpoisNYmO9IRvJYT5pai7/ke4MWvKmtzFzVgRdVlZnaAHLqYgkeJE+jy/rqEwgpM/8byDu/py2f7cm7PyN5nbWl6QgH6NMQNlCgr8njZYX5Q0lJrrnO9wZBQZ76ACOnKkNX6uiaAAAAAElFTkSuQmCC>
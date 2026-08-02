# **Architectural Advancements for Zero-Dependency In-Browser Large Language Models**

## **The Imperative for Autonomous Edge Infrastructures**

The migration of Large Language Models (LLMs) to edge environments represents a fundamental paradigm shift in computational linguistics and artificial intelligence engineering. By executing generative workloads directly within the web browser via WebAssembly (Wasm), engineers can guarantee absolute data privacy, eliminate network latency overhead, and significantly diminish the centralized compute costs associated with continuous cloud inference1. However, creating a highly capable, multimodal simulation ecosystem within a web browser introduces severe architectural constraints. Historically, Rust applications rely on an expansive ecosystem of third-party crates to handle tensor algebra, memory allocation, image decoding, and tokenization. In the context of WebAssembly, this reliance on external dependencies frequently introduces severe software bloat, supply chain security vulnerabilities, and massive binary footprints that violate the restrictive memory and load-time constraints of the browser2.  
A strict zero-dependency approach—utilizing exclusively the Rust core and alloc libraries—forces a complete reimagining of the inference pipeline. Every component, from hierarchical quantization decoders and radix-tree context caches to Fast Fourier Transforms and custom memory allocators, must be authored natively to maintain extreme optimization and predictability4. The following analysis provides an exhaustive architectural framework for enhancing a pure-Rust, zero-dependency LLM engine engineered specifically for high-fidelity, in-browser multimodal simulations.

## **Tensor Algebra and WebAssembly SIMD Acceleration**

At the core of autoregressive generation are the matrix-vector multiplications (matvec) that drive the forward pass of the transformer blocks5. In a rudimentary Rust implementation lacking external linear algebra libraries, these operations default to scalar arithmetic, processing one floating-point or integer operation per CPU cycle5. Scalar execution fundamentally fails to exploit the massive data-level parallelism available on modern processors, rendering in-browser inference unacceptably slow for real-time simulation dynamics. The adoption of the WebAssembly SIMD128 instruction set is therefore a non-negotiable architectural requirement8.

### **Vectorized Floating-Point and Integer Operations**

The Wasm SIMD128 proposal introduces a 128-bit vector type (v128), allowing the CPU to process multiple data points concurrently8. In a pure Rust environment, developers must interface directly with the core::arch::wasm32 namespace or the experimental core::simd module, annotating critical mathematical functions with \#\[target\_feature(enable \= "simd128")\] to ensure the compiler emits the appropriate intrinsic instructions8.  
For 32-bit floating-point arrays (f32), the f32x4 layout accommodates four concurrent operations10. When executing a matrix multiplication across an ![][image1] matrix, the algorithm must process the arrays in chunks. The engine loads values into f32x4 vectors, computes the element-wise product using SIMD multiplication (f32x4\_mul), and aggregates the results using a vectorized horizontal addition, such as reduce\_sum10.

| Instruction / Operation | Vector Layout | Architectural Implication |
| :---- | :---- | :---- |
| f32x4\_mul | 4 ![][image2] 32-bit float | Accelerates standard feed-forward network projections by a factor of 410. |
| dot\_i16x8\_s | 8 ![][image2] 16-bit integer | Multiplies signed 16-bit integers and sums adjacent pairs into 32-bit outputs; vital for quantized dot products13. |
| simd\_swizzle\! | Byte-level masking | Reorders vector elements rapidly without incurring memory load/store penalties, enabling fast cross-products11. |
| extmul\_low\_i8x16\_s | 16 ![][image2] 8-bit integer | Extends 8-bit integers into 16-bit intermediate products to prevent overflow during accumulation15. |

### **Advanced Quantized Dot Products**

The true efficacy of Wasm SIMD emerges when processing quantized models. Because LLM weights are typically compressed into 8-bit or 4-bit integers, the data must be carefully unpacked into wider SIMD registers before arithmetic can occur. Wasm lacks native 8-bit dot product instructions that directly output to 32-bit accumulators, requiring the engine to execute composite operations14.  
To implement a highly performant 8-bit dot product (q8\_0) natively, the engine relies on wasm\_i16x8\_extmul\_low\_i8x16 and its high counterpart16. These instructions take 8-bit vectors, sign-extend them to 16 bits, and multiply them. The intermediate 16-bit products are subsequently passed to wasm\_i32x4\_extadd\_pairwise\_i16x8, which performs the final accumulation into 32-bit integers16. The zero-dependency implementation of functions like matvec\_q8\_0 and matvec\_q4\_0 must be meticulously aligned in memory to prevent performance degradation; unaligned memory access inside a Wasm environment will severely stall the execution pipeline by bypassing cache lines1.

## **Memory Compression via Hierarchical Block Quantization**

To operate within the 4GB memory limit of standard WebAssembly environments, the model weights must undergo severe compression17. Legacy quantization formats such as Q4\_0 and Q8\_0 divide the model into basic blocks—typically 32 weights per block—and assign a single 32-bit or 16-bit floating-point scaling factor to the entire group19. While this drastically reduces the file size, applying a single scale uniformly across 32 weights fails to account for statistical outliers, leading to high perplexity degradation and erratic agent behavior in simulations18.  
Modern architectures must abandon these flat layouts in favor of hierarchical block quantization, generally denoted as K-Quants (e.g., Q4\_K\_M, Q5\_K\_M, Q6\_K)18.

### **The K-Quant Hierarchy**

K-Quants achieve a superior balance between compression ratio and model accuracy by utilizing a nested two-level quantization hierarchy21. In a Q4\_K format, weights are grouped into super-blocks consisting of 256 weights, which are then subdivided into 8 sub-blocks of 32 weights each19.  
The mathematical reconstruction of a weight ![][image3] from its quantized value ![][image4] takes the form: ![][image5] Unlike legacy formats, the K-Quant architecture dictates that the block\_scale and block\_min are themselves quantized, often stored as 6-bit values, alongside a higher-level super-block scale and minimum19. This results in highly precise, localized adjustments, allowing a Q4\_K model to achieve exactly 4.5 bits-per-weight19.

| Quantization Level | Bits per Weight | Typical VRAM / Memory Fit (7B Model) | Quality Retention vs FP16 |
| :---- | :---- | :---- | :---- |
| Q8\_0 | 8.0 | \~7.7 GB | \~99.5%18 |
| Q6\_K | 6.56 | \~5.9 GB | \~99.0%18 |
| Q5\_K\_M | 5.5 | \~5.1 GB | \~98.0%18 |
| Q4\_K\_M | 4.5 | \~4.4 GB | \~96.5%18 |

Implementing a native K-Quant decoder in pure Rust is highly complex due to the irregular bit widths. A 6-bit integer cannot be loaded directly via standard Rust primitives; the engine must parse the byte array using intensive bit-shifting and masking logic19. Crucially, the engine must avoid flattening these hierarchical scales back into a single per-block f16 scale prior to inference, as this operation loses precision21. Instead, the native Wasm SIMD loops must integrate the sub-block extraction and scaling operations directly within the matvec computation loop. By fusing dequantization with the matrix-vector multiplication, the data remains persistently in the CPU's L1 cache, avoiding costly trips to main memory1.

## **Dynamic Adapter Ecosystems: Low-Rank and Sparse Modifiers**

In autonomous simulations, characters or agents often require dynamic personality shifts or real-time skill acquisition. Loading entirely distinct foundational models for each agent is impossible given the browser's memory constraints. Consequently, the ecosystem must support hot-swappable weight modifiers, typically encapsulated in a custom adapter format5.  
A highly optimized zero-dependency stack eschews generic formats like Safetensors in favor of a specialized binary structure containing validated payloads (e.g., ADP1, ASP1, ALR1 headers)22. The custom .slm (Small Language Model) runtime explicitly provisions for these dynamic adaptations across multiple payload variants5.

### **Low-Rank and Sparse Adaptations**

The adapter payloads must strictly match the identity of the base model, enforcing parity across parameter counts, tokenizer states, and tensor layout checksums (0x74656e736f722d6c) to prevent execution corruption22.

1. **Low-Rank Updates (ALR1):** Traditional Low-Rank Adaptation (LoRA) updates the weight matrix ![][image6] by multiplying two smaller matrices, ![][image7] and ![][image8], where the rank ![][image9]. The AdapterDeltaPayloadKind::LowRankF32 representation parses these factorized components22. For a specified factor rank, the engine reconstructs the delta for any specific index using a targeted dot product of the corresponding row in ![][image7] and column in ![][image8]22. By adding this delta to the base quantized scale or directly applying it during the forward pass, the model changes behavior without permanently expanding the foundational file size5.  
2. **Sparse Matrices (ASP1):** In specific fine-tuning methodologies, only a tiny fraction of the neural network's parameters are updated. The SparseF32 format stores these as explicit (u64 index, f32 delta) pairs5. The pure Rust implementation applies these pairs to the target tensor by iterating through the sparse payload, ensuring extreme memory efficiency for highly targeted parameter shifts5.

Applying these adapter payloads dynamically to a pre-loaded quantized model presents a mathematical hurdle: the base weights are stored as integer blocks. The zero-dependency engine must unpack the targeted 4-bit or 8-bit block into 32-bit floats, apply the high-precision delta modifier, and immediately requantize the block back into its native format (e.g., via quantize\_q4\_block or quantize\_q8\_row)5. This ensures the model continues to benefit from SIMD memory alignment while reflecting the new adapter state1.

## **Tokenization and Stochastic Sampling Algorithms**

Before the transformer layers can process an input string, the text must be translated into discrete integers via a tokenizer. Without relying on external Python or heavy Rust crates (e.g., tokenizers), the ecosystem must construct native byte-pair encoding (BPE) parsers23.

### **Native Byte and BPE Implementations**

The custom model format (.slm) embeds the tokenizer directly within its binary header, eliminating the need to load external JSON vocabularies24.

* **Byte Tokenizer (BTOK):** For rudimentary models, a pure byte-fallback tokenizer maps text directly to UTF-8 bytes, wrapped with Beginning-of-Sequence (BOS: 256\) and End-of-Sequence (EOS: 257\) identifiers24.  
* **Custom BPE (BPE1):** For advanced linguistic processing, the engine parses a specialized BPE table containing variable-length token arrays and a fixed merge table detailing the hierarchy of token combinations24. The pure Rust decoding loop iteratively evaluates the best applicable merge by searching the merge array for the highest-ranking left/right token pair, replacing the adjacent tokens until no further valid merges exist24.

### **Deterministic Stochastic Sampling**

Once the forward pass generates a probability distribution (logits) across the vocabulary, the runtime must sample the next token23. The engine implements a SamplingConfig controlling the temperature, Top-K, and Top-P (nucleus sampling)26.  
To maintain strict performance guidelines and zero allocations inside the hot path, the sampler uses fixed-size stack arrays to track candidate probabilities. A MAX\_SAMPLING\_CANDIDATES array of 1024 slots ensures no heap allocation occurs when sorting the highest logit values26. By maintaining a rolling minimum within this fixed array, the sampler rapidly discards low-probability tokens without requiring expensive, full-array vector sorts23. Using a seeded XorShift64 random number generator guarantees that the stochastic decoding process is fully deterministic, an essential property for replicating simulation states identically across distributed browser clients23.

## **Autoregressive State Management: Paged and Radix Attention**

In standard LLM inference, each newly generated token must calculate self-attention scores against all preceding tokens. To prevent recalculating these historical states, the engine utilizes a Key-Value (KV) cache23. Early iterations of KV caching relied on contiguous memory allocations, claiming a block of memory equal to max\_seq\_len for every generated request28.  
This contiguous architecture is severely flawed. Because generative sequence lengths are unpredictable, massive swaths of the preallocated memory remain unused, resulting in extreme internal fragmentation (often wasting over 70% of available memory)27. In a WebAssembly environment bounded tightly to 4GB of linear memory, contiguous caching severely caps the number of concurrent simulation agents17.

### **The PagedAttention Paradigm**

To obliterate memory fragmentation, the engine implements PagedAttention. Drawing upon operating system virtual memory paging concepts, PagedAttention dynamically partitions the KV cache into fixed-size physical blocks (e.g., 16 or 32 tokens per block)27.  
Within a pure Rust, third-party-free implementation, this requires instantiating three specific components:

1. **Block Pool (BlockPool):** A fixed-size array managing all available physical blocks, utilizing an internal free-list. The pool governs physical capacity and relies on strict reference counting; blocks are only reclaimed when their reference count reaches zero32.  
2. **Block Table (BlockTable):** A per-sequence page table that maps logical token positions directly to disparate physical block IDs. This indirection ensures the cache need not reside contiguously in RAM30.  
3. **Sequence Scheduler:** A prefill/decode lifecycle manager that tracks active sequences, dynamically requesting new blocks from the pool when a sequence overflows its current block boundary32.

By adopting this architecture, memory is provisioned strictly on demand, pushing external and internal memory fragmentation practically to zero30.

### **RadixAttention and Zero-Cost Prefix Caching**

In multimodal simulations, multiple independent agents frequently operate under an identical contextual background, such as a lengthy system prompt detailing the physics of the environment32. With PagedAttention alone, if five agents process a shared 2,000-token prompt, the system unnecessarily computes and allocates 10,000 tokens of cache space34.  
To solve this, the engine overlays a Radix Tree upon the PagedAttention blocks, formalizing RadixAttention34. The Radix cache keys upon the exact token IDs. When a new simulation request is dispatched, the scheduler traverses the Radix tree to identify the longest matching token prefix32. Upon a match, the engine simply increments the reference count of the existing physical blocks and maps them into the new sequence's BlockTable32.

| Cache Mechanism | Functionality | Performance Benefit |
| :---- | :---- | :---- |
| **Token-Level Matching** | Identifies shared prompt prefixes via a Radix Tree. | Radically reduces Time-to-First-Token (TTFT) by bypassing the computationally dense prefill phase34. |
| **Copy-on-Write (CoW)** | Allows multiple sequences to share identical physical pages until a divergence occurs. | Drops initial memory footprint for 5 concurrent agents from ![][image10] to ![][image11]32. |
| **LRU Eviction** | Reclaims memory from least-recently-used leaf nodes when the BlockPool saturates. | Automatically prunes stale simulation branches while preserving highly active root prompts32. |

If an agent's narrative forks (e.g., via beam search evaluating two distinct actions), the Radix sequence simply branches. History up to the fork remains shared, and new allocations only occur for the divergent tokens32.

## **Accelerating Throughput with Speculative Decoding**

Paged KV caching optimizes memory bounds, but the decoding phase remains fundamentally memory-bandwidth bound. Modern GPUs and CPUs idle waiting for KV cache arrays to load from main memory37. Speculative Decoding resolves this latency by allowing the model to generate multiple tokens per forward pass37.

### **Draft and Target Verification Architectures**

Speculative decoding relies on a dual-model architecture. A secondary, highly compressed "draft" model rapidly hallucinates ![][image12] consecutive tokens37. The primary "target" model then consumes this speculative sequence in parallel, executing a single forward pass to verify the draft's probability distributions40.  
If the drafted tokens fall within the target model's accepted distribution, they are accepted instantaneously. If a token is rejected, the target model computes the correct token, and all subsequent drafted tokens are discarded37. The efficacy of this system relies entirely on the Acceptance Rate (![][image13])37. The expected theoretical yield of tokens per cycle (![][image14]) is defined as: ![][image15]37.

### **Implementation within the Zero-Dependency Constraints**

Integrating speculative decoding into the Rust Wasm engine leverages the underlying PagedAttention architecture to handle rollbacks elegantly. When the target model rejects a speculative branch, the sequence scheduler simply rolls back the BlockTable logical length, instantly freeing any trailing blocks without requiring expensive memory zeroing algorithms30.  
For higher throughput scenarios, the engine can implement specific speculative policies:

* **Adaptive Speculative Length:** The scheduler dynamically alters ![][image12] based on real-time monitoring of ![][image13]. If the acceptance rate is exceptionally high (e.g., highly predictable, structured JSON outputs), the engine lengthens the speculative window to maximize hardware utilization37.  
* **Speculative Speculative Decoding (SSD):** Instead of waiting sequentially, the draft model immediately begins hallucinating new branches based on predicted verification outcomes while the target model is still computing its forward pass, effectively eliminating draft overhead40.

For environments lacking sufficient memory to host a secondary draft model, the engine can utilize N-gram matching or suffix decoding. These model-free algorithms search the prior context for exact matching token sequences and project them speculatively, providing marginal latency reduction without the VRAM cost of a standalone neural network42.

## **Multimodal Ingestion Without External Crates**

Browser-based simulations increasingly demand visual and acoustic sensory processing. Conventional Rust implementations rely on heavy dependencies like image, png, or rustfft43. Importing these libraries introduces thousands of lines of transitive code, increasing compilation times, exposing the software to upstream supply chain attacks, and drastically increasing the binary size3. A strict zero-dependency project mandates building these decoders natively.

### **Visual Modality: The Quite OK Image (QOI) Protocol**

To decode image states rapidly without the mathematical overhead of DEFLATE or JPEG DCTs, the engine standardizes entirely upon the Quite OK Image (QOI) format45. QOI provides lossless compression natively, operating up to 50 times faster than standard PNG decoding45.  
The QOI specification dictates a 14-byte header commencing with the ASCII magic bytes qoif, followed by strict 32-bit dimension variables45. The format relies on a continuous running array of 64 zero-initialized pixels45. The native Rust decoder iterates over the byte stream, decoding pixels via four dominant tags:

1. **QOI\_OP\_INDEX:** Calculates a hash defined strictly as (r \* 3 \+ g \* 5 \+ b \* 7 \+ a \* 11\) % 64 to retrieve a previously encountered pixel from the 64-element array45.  
2. **QOI\_OP\_DIFF & QOI\_OP\_LUMA:** Evaluates minute 2-bit or 6-bit numerical differences between the current and prior pixel channels. The green channel difference establishes the baseline, while the red and blue channels derive their shifts via dr\_dg \= (cur\_px.r \- prev\_px.r) \- (cur\_px.g \- prev\_px.g)45.  
3. **QOI\_OP\_RUN:** Records a sequence of identical pixels spanning from 1 to 62 iterations45.  
4. **QOI\_OP\_RGB / QOI\_OP\_RGBA:** Defaults to declaring the full 8-bit array for each uncompressed channel45.

Writing this protocol in pure Rust requires no dynamic allocation (no\_std compatible). The output resolves directly into a continuous Uint8Array of un-premultiplied RGBA bytes, capable of being ingested natively into the LLM's visual transformer layers48.

### **Acoustic Modality: Standalone Cooley-Tukey Fast Fourier Transforms**

Processing raw audio streams within an AI simulation necessitates transforming time-domain signals into the frequency domain via a Discrete Fourier Transform (DFT)6. A naive implementation yields an ![][image16] algorithmic complexity, rendering it completely unfeasible for real-time edge processing6. The mandatory solution is the deployment of the Cooley-Tukey Fast Fourier Transform (FFT) algorithm, reducing computation to ![][image17]6.  
By engineering a native Radix-2 Decimation-In-Time (DIT) FFT, the engine recursively subdivides the signal array into even and odd indices51. To avoid the crippling memory allocations of out-of-place algorithms, the Rust implementation executes the transform strictly *in-place*. This initiates with a CO-BRAVO bit-reversal algorithm43. The engine then executes the "butterfly" operations, mapping the subsets alongside precomputed complex exponential roots of unity (twiddle factors)51.  
For larger signal arrays, traversing memory non-contiguously invokes severe CPU cache misses. To combat this, the FFT implementation incorporates the Six-Step Mixed-Radix formulation. By viewing the 1D signal conceptually as a 2D matrix of width ![][image7] and height ![][image8], the engine computes column-wise sub-FFTs, applies twiddle factors, transposes the entire matrix, and calculates the subsequent row-wise FFTs51. This structured memory access maximizes the utilization of L1 data caches, ensuring that acoustic preprocessing matches the speed characteristics of dedicated DSP hardware without linking external C-bindings like FFTW52.

## **Binary Footprint Minimization and Custom Global Allocators**

Minimizing the overall WebAssembly payload size directly dictates how rapidly the simulation environment loads across the network2. Wasm files compress efficiently over gzip, but the baseline binary produced by the wasm32-unknown-unknown target intrinsically includes the Rust standard library's default dynamic memory allocator (dlmalloc), unwinding code, and formatting infrastructure, which massively inflates the payload2.  
Historically, developers relied upon the wee\_alloc crate to mitigate this, dropping allocator size to roughly 1 kilobyte56. However, wee\_alloc is unmaintained, suffers from systemic memory leaks, and routinely triggers severe supply-chain vulnerability alerts—a profound disqualification under zero-dependency guidelines4.

### **Engineering a Wasm-Native Bump Allocator**

The most performant and secure architectural decision is to entirely override the global allocator utilizing the \#\[global\_allocator\] directive and the core::alloc::GlobalAlloc or experimental Allocator traits55.  
Because WebAssembly memory functions as an expanding linear buffer controlled exclusively via the memory.size and memory.grow intrinsics, a simple Bump Allocator (Arena Allocator) represents the optimal structural fit4. A bump allocator merely establishes a static pointer at the termination of reserved memory (e.g., \_\_heap\_base)61. Upon receiving an allocation request, it evaluates the Layout, ensures alignment, and increments the pointer55.  
While bump allocators cannot free individual localized addresses without incurring fragmentation, LLM inferences operate cyclically. Memory utilized for immediate generative context (e.g., probability logits, draft arrays) can be wiped completely when an inference step concludes by blindly resetting the bump pointer back to the base55.  
Should the bump pointer exceed the bounds of the existing Wasm memory footprint, the custom allocator utilizes the core::arch::wasm32::memory\_grow instruction to request further 64KB pages directly from the browser's engine17. This process entirely bypasses the complex free-list trees maintained by general-purpose allocators, significantly decreasing compilation size and avoiding external malloc overhead entirely4.

### **Compiler-Level Size Deductions**

Beyond custom allocation, the project's Cargo.toml must enforce aggressive size-focused compiler flags:

* opt-level \= 's' or 'z': Instructs LLVM to prioritize shrinking the binary size rather than attempting marginal execution speedups through heavy inlining2.  
* lto \= true: Activates full Link-Time Optimization, enabling the compiler to analyze the holistic call graph and aggressively prune unreferenced dead code across all module boundaries54.  
* panic \= 'abort': Strips the intricate unwinding infrastructure usually required for stack traces during panics, forcing an immediate termination2.

Finally, the wasm-opt \-Os binary toolpost-processes the output to eradicate implicit debug metadata and the internal .names section, achieving an additional 15-20% footprint reduction54.

## **Concurrency, Shared Memory, and Zero-Copy Interoperability**

While Wasm operates on a single execution thread by default, browser environments possess robust parallel computing frameworks through Web Workers and SharedArrayBuffer API structures65. Migrating the pure Rust architecture to a multi-threaded framework achieves linear throughput scaling for heavily constrained matrix operations, assuming coordination costs are minimized66.

### **Atomic Orchestration and Thread Locals**

When compiled with threading features enabled (-target-feature=+atomics), the Wasm binary shares an identical contiguous block of linear memory across multiple JS Web Workers65. This negates the requirement to serialize, clone, and post messages via standard postMessage loops, preventing severe garbage collection stutter66.  
The primary coordinator thread segments the foundational LLM tensor operations (such as row-wise dot products) and distributes indices. To handle concurrency effectively without operating system mutexes, the ecosystem leverages atomic addition. The Wasm loader injects a global thread ID counter65. As a Web Worker initializes, it increments this atomic value to secure a unique Thread ID65. This specific identifier serves to route data safely and instantiate localized stack pointers via the memory.grow command, providing the isolated execution context necessary for safe parallel SIMD calculations61.

### **Zero-Copy Typed Array Bridges**

By abandoning third-party frameworks like wasm-bindgen, developers assert absolute control over data boundary crossings. When a user input—such as a microphone buffer or canvas image payload—is generated by the front-end, JavaScript writes the data directly into a mapped Uint8Array that points explicitly into the Wasm linear memory block67.  
The Rust simulation engine exposes getter functions that return raw memory pointers corresponding to empty input arenas67. By avoiding heavy serialization interfaces or the standard dynamic generation of JavaScript proxy structures, the engine maintains sub-16 millisecond rendering and execution bounds, satisfying the rigid temporal requirements of 60 FPS interfaces67.

## **Native Evaluation and Diagnostic Telemetry**

Maintaining code quality and tracking algorithmic deviations within a sprawling, zero-dependency engine demands native verification systems. Standard approaches rely heavily on crates like serde to dump JSON diagnostics, causing immense binary bloat2.  
The pure Rust telemetry system replaces this by implementing direct byte string formatters68. The Diagnostics struct maintains performance counters—such as prompt\_token\_count, tokens\_per\_second, and peak\_scratch\_arena\_usage—alongside diagnostic metrics like the assembly\_state\_checksum (an internal cryptographic trace constructed via repeated mix64 operations against loaded model weights and applied adapters)23. When called, the engine renders a JSON-compliant output dynamically by pushing exact UTF-8 strings into a fixed Vec\<u8\>, escaping specific ASCII sequences (like \\n or quotes) manually without serde68.  
Furthermore, for Quality Assurance within CI/CD pipelines, the architecture leverages native eval\_runner modules69. These runners ingest specific text case files, prefill the Paged KV cache, strictly define standard temperatures, and evaluate the LLM output deterministically26. The results culminate in the generation of a quality-gate sidecar manifest mapping output metrics precisely, guaranteeing that updates to the native mathematical kernels do not inadvertently corrupt model fidelity69.

## **Synthesis**

Deploying a multi-modal, highly parallel LLM ecosystem directly to a web browser strictly utilizing standard Rust libraries enforces a paradigm of intense architectural constraint. Eschewing the conveniences of a sprawling third-party dependency network drastically amplifies security, reduces the Wasm binary payload down to the kilobyte spectrum, and preserves absolute determinism across simulation environments2.  
To operate functionally, this engine must abandon conventional algorithms. It dictates the deployment of Wasm SIMD128 implementations for vectorized integer multiplication, handling complex hierarchical K-Quants directly within L1-cached hot loops14. The traditional contiguous memory allocation must be replaced completely by PagedAttention arrays governed by Radix trees, securing unprecedented memory utilization via dynamic copy-on-write sequences and prefix sharing30.  
Combined with native parsers for QOI image encoding and Cooley-Tukey Fast Fourier Transforms, alongside specialized bump-allocators controlling localized linear memory via the memory.grow intrinsic, the platform yields an ecosystem completely sovereign from structural bloat4. This rigorous approach transcends standard edge computing mechanics; it transforms the web browser into a localized, deterministically optimized AI accelerator entirely isolated from cloud infrastructure.

#### **Works cited**

1. WASM \+ SIMD for On-Device AI: Private, Fast, Offline | by Thinking Loop | Medium, [https://medium.com/@ThinkingLoop/wasm-simd-for-on-device-ai-private-fast-offline-3ef82c47172d](https://medium.com/@ThinkingLoop/wasm-simd-for-on-device-ai-private-fast-offline-3ef82c47172d)  
2. Optimizing WASM Binary Size \- Leptos book, [https://book.leptos.dev/deployment/binary\_size.html](https://book.leptos.dev/deployment/binary_size.html)  
3. Zero Dependencies sounds great... until you try to share your code for the security good. : r/rust \- Reddit, [https://www.reddit.com/r/rust/comments/1qvzcbj/zero\_dependencies\_sounds\_great\_until\_you\_try\_to/](https://www.reddit.com/r/rust/comments/1qvzcbj/zero_dependencies_sounds_great_until_you_try_to/)  
4. Avoiding allocations in Rust to shrink Wasm modules | nickb.dev, [https://nickb.dev/blog/avoiding-allocations-in-rust-to-shrink-wasm-modules/](https://nickb.dev/blog/avoiding-allocations-in-rust-to-shrink-wasm-modules/)  
5. model.rs  
6. Chapter 33 | Modern Data Structures and Algorithms in Rust, [https://dsar.rantai.dev/docs/part-vi/chapter-33/](https://dsar.rantai.dev/docs/part-vi/chapter-33/)  
7. SIMD programming in pure Rust \- Sylvain Kerkour, [https://kerkour.com/introduction-rust-simd](https://kerkour.com/introduction-rust-simd)  
8. core::arch::wasm32 \- Rust, [https://doc.rust-lang.org/beta/core/arch/wasm32/index.html](https://doc.rust-lang.org/beta/core/arch/wasm32/index.html)  
9. Fast, parallel applications with WebAssembly SIMD \- V8 JavaScript engine, [https://v8.dev/features/simd](https://v8.dev/features/simd)  
10. Getting Started with SIMD Computation \- stdin, [https://stdin.top/posts/simd-getting-started/](https://stdin.top/posts/simd-getting-started/)  
11. SIMD \- Vector Primitives and Operations \- Rice Fields, [https://ricefields.me/2024/06/09/vector-primitives.html](https://ricefields.me/2024/06/09/vector-primitives.html)  
12. core::arch::wasm \- Rust, [https://doc.rust-lang.org/beta/core/arch/wasm/index.html](https://doc.rust-lang.org/beta/core/arch/wasm/index.html)  
13. dot\_i16x8\_s: Wasm SIMD arithmetic instruction \- WebAssembly \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/SIMD/arithmetic/dot\_i16x8\_s](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/SIMD/arithmetic/dot_i16x8_s)  
14. Dot product of 3D vectors in webassembly \- Stack Overflow, [https://stackoverflow.com/questions/77718847/dot-product-of-3d-vectors-in-webassembly](https://stackoverflow.com/questions/77718847/dot-product-of-3d-vectors-in-webassembly)  
15. spec/proposals/simd/SIMD.md at main · WebAssembly/spec \- GitHub, [https://github.com/WebAssembly/spec/blob/main/proposals/simd/SIMD.md](https://github.com/WebAssembly/spec/blob/main/proposals/simd/SIMD.md)  
16. Relaxed Integer Dot Product instructions · Issue \#52 · WebAssembly/relaxed-simd \- GitHub, [https://github.com/WebAssembly/relaxed-simd/issues/52](https://github.com/WebAssembly/relaxed-simd/issues/52)  
17. Allocator won't use the provided memory when using \`--import-memory\` · Issue \#1389 · wasm-bindgen/wasm-bindgen \- GitHub, [https://github.com/wasm-bindgen/wasm-bindgen/issues/1389](https://github.com/wasm-bindgen/wasm-bindgen/issues/1389)  
18. GGUF Quantization Explained: Q4\_K\_M vs Q5\_K\_M vs Q8 \- The 5090 Reports, [https://bmdpat.com/blog/gguf-quantization-q4-q5-q8-explained-2026](https://bmdpat.com/blog/gguf-quantization-q4-q5-q8-explained-2026)  
19. GGUF · Hugging Face, [https://huggingface.co/docs/hub/gguf](https://huggingface.co/docs/hub/gguf)  
20. LLM Quantization: All You Need to Know\! \- Cloudthrill, [https://cloudthrill.ca/llm-quantization-all-you-need-to-know](https://cloudthrill.ca/llm-quantization-all-you-need-to-know)  
21. \[copilots\] Support non-uniform block quantization in ONNX (GGUF K-quant, super-block structures) · Issue \#7691 \- GitHub, [https://github.com/onnx/onnx/issues/7691](https://github.com/onnx/onnx/issues/7691)  
22. adapter.rs  
23. generate.rs  
24. tokenizer.rs  
25. model\_format.rs  
26. sampler.rs  
27. KV Cache Explained: The Complete Guide to KV Cache in LLM Inference | Medium, [https://luv-bansal.medium.com/the-evolution-of-kv-cache-from-simple-buffers-to-distributed-memory-systems-df51cb8ce26f](https://luv-bansal.medium.com/the-evolution-of-kv-cache-from-simple-buffers-to-distributed-memory-systems-df51cb8ce26f)  
28. kv\_cache.rs  
29. The Five Eras of KVCache \- Modular, [https://www.modular.com/blog/the-five-eras-of-kvcache](https://www.modular.com/blog/the-five-eras-of-kvcache)  
30. Paged KvCache Strategy \- Emergent Mind, [https://www.emergentmind.com/topics/paged-kvcache-strategy](https://www.emergentmind.com/topics/paged-kvcache-strategy)  
31. LMCache: An Efficient KV Cache Layer for Enterprise-Scale LLM Inference \- arXiv, [https://arxiv.org/html/2510.09665v2](https://arxiv.org/html/2510.09665v2)  
32. kv-cache-scheduler — Rust utility // Lib.rs, [https://lib.rs/crates/kv-cache-scheduler](https://lib.rs/crates/kv-cache-scheduler)  
33. Automatic Prefix Caching \- vLLM Documentation, [https://docs.vllm.ai/en/v0.9.2/design/automatic\_prefix\_caching.html](https://docs.vllm.ai/en/v0.9.2/design/automatic_prefix_caching.html)  
34. RadixAttention Explained: How SGLang Beats PagedAttention at Scale \- Rajat Pandit, [https://rajatpandit.com/ai-engineering/radixattention-vs-pagedattention/](https://rajatpandit.com/ai-engineering/radixattention-vs-pagedattention/)  
35. ADR-011-prefix-caching.md \- RuVector \- GitHub, [https://github.com/ruvnet/ruvector/blob/main/docs/adr/ADR-011-prefix-caching.md](https://github.com/ruvnet/ruvector/blob/main/docs/adr/ADR-011-prefix-caching.md)  
36. Prefix Caching — FuriosaAI Developer Center 2026.2.0 documentation \- Furiosa Docs, [https://developer.furiosa.ai/latest/en/furiosa\_llm/prefix-caching.html](https://developer.furiosa.ai/latest/en/furiosa_llm/prefix-caching.html)  
37. Speculative decoding | LLM Inference Handbook \- BentoML, [https://bentoml.com/llm/inference-optimization/speculative-decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding)  
38. unillm\_kv \- Rust \- Docs.rs, [https://docs.rs/unillm-kv/latest/unillm\_kv/](https://docs.rs/unillm-kv/latest/unillm_kv/)  
39. Accelerating decode-heavy LLM inference with speculative decoding on AWS Trainium and vLLM | Artificial Intelligence, [https://aws.amazon.com/blogs/machine-learning/accelerating-decode-heavy-llm-inference-with-speculative-decoding-on-aws-trainium-and-vllm/](https://aws.amazon.com/blogs/machine-learning/accelerating-decode-heavy-llm-inference-with-speculative-decoding-on-aws-trainium-and-vllm/)  
40. Speculative Speculative Decoding \- arXiv, [https://arxiv.org/pdf/2603.03251](https://arxiv.org/pdf/2603.03251)  
41. LM Studio 0.3.10: Speculative Decoding, [https://lmstudio.ai/blog/lmstudio-v0.3.10](https://lmstudio.ai/blog/lmstudio-v0.3.10)  
42. Speculative Decoding \- vLLM Documentation, [https://docs.vllm.ai/en/latest/features/speculative\_decoding/](https://docs.vllm.ai/en/latest/features/speculative_decoding/)  
43. phastft \- Rust \- Docs.rs, [https://docs.rs/phastft](https://docs.rs/phastft)  
44. ai-image — Rust image library // Lib.rs, [https://lib.rs/crates/ai-image](https://lib.rs/crates/ai-image)  
45. QOI (image format) \- Wikipedia, [https://en.wikipedia.org/wiki/QOI\_(image\_format)](https://en.wikipedia.org/wiki/QOI_\(image_format\))  
46. aldanor/qoi-rust: VERY fast encoder/decoder for QOI image format in pure and safe Rust, [https://github.com/aldanor/qoi-rust](https://github.com/aldanor/qoi-rust)  
47. QOI Encoding in Zig \- Gianni Rosato, [https://giannirosato.com/blog/post/qoi-zig/](https://giannirosato.com/blog/post/qoi-zig/)  
48. const\_qoi \- Rust \- Docs.rs, [https://docs.rs/const\_qoi](https://docs.rs/const_qoi)  
49. GitHub \- embedded-graphics/tinyqoi: A no\_std QOI library for embedded applications., [https://github.com/embedded-graphics/tinyqoi](https://github.com/embedded-graphics/tinyqoi)  
50. qoi \- Rust \- Docs.rs, [https://docs.rs/qoi](https://docs.rs/qoi)  
51. Cooley–Tukey FFT algorithm \- Wikipedia, [https://en.wikipedia.org/wiki/Cooley%E2%80%93Tukey\_FFT\_algorithm](https://en.wikipedia.org/wiki/Cooley%E2%80%93Tukey_FFT_algorithm)  
52. Exploring RustFFT's SIMD Architecture \- tutorials \- The Rust Programming Language Forum, [https://users.rust-lang.org/t/exploring-rustffts-simd-architecture/53780](https://users.rust-lang.org/t/exploring-rustffts-simd-architecture/53780)  
53. OxiFFT is a 99% Rust port of FFTW3, the world's most respected FFT library. It brings FFTW's sophisticated algorithms, planning system, and performance optimizations to the Rust ecosystem while leveraging Rust's safety guarantees and modern language features. · GitHub, [https://github.com/cool-japan/oxifft](https://github.com/cool-japan/oxifft)  
54. Shrinking .wasm Code Size \- Rust and WebAssembly, [https://rustwasm.github.io/book/reference/code-size.html](https://rustwasm.github.io/book/reference/code-size.html)  
55. Rust Custom Allocators \- Ian Bull, [https://ianbull.com/posts/rust-custom-allocators/](https://ianbull.com/posts/rust-custom-allocators/)  
56. rustwasm/wee\_alloc: The Wasm-Enabled, Elfin Allocator \- GitHub, [https://github.com/rustwasm/wee\_alloc](https://github.com/rustwasm/wee_alloc)  
57. wee\_alloc \- Hello wasm-pack\! \- Rust and WebAssembly, [https://rustwasm.github.io/docs/wasm-pack/tutorials/npm-browser-packages/template-deep-dive/wee\_alloc.html](https://rustwasm.github.io/docs/wasm-pack/tutorials/npm-browser-packages/template-deep-dive/wee_alloc.html)  
58. Allocator in wasmtime\_environ::\_\_core::alloc \- Rust \- Docs.rs, [https://docs.rs/wasmtime-environ/latest/wasmtime\_environ/\_\_core/alloc/trait.Allocator.html](https://docs.rs/wasmtime-environ/latest/wasmtime_environ/__core/alloc/trait.Allocator.html)  
59. std::alloc \- Rust, [https://doc.rust-lang.org/std/alloc/index.html](https://doc.rust-lang.org/std/alloc/index.html)  
60. A complete novice writes Wasm by hand: Adding an Allocator | Bryan Burgers, [https://burgers.io/complete-novice-wasm-allocator](https://burgers.io/complete-novice-wasm-allocator)  
61. alloc\_cat \- crates.io: Rust Package Registry, [https://crates.io/crates/alloc\_cat](https://crates.io/crates/alloc_cat)  
62. Turns out, using custom allocators makes using Rust way easier \- Reddit, [https://www.reddit.com/r/rust/comments/1jlopns/turns\_out\_using\_custom\_allocators\_makes\_using/](https://www.reddit.com/r/rust/comments/1jlopns/turns_out_using_custom_allocators_makes_using/)  
63. Optimize WASM Size \- Sycamore, [https://sycamore.dev/book/cookbook/optimize-wasm-size](https://sycamore.dev/book/cookbook/optimize-wasm-size)  
64. Document guidance on optimizing for size · Issue \#109 · rustwasm/team \- GitHub, [https://github.com/rustwasm/team/issues/109](https://github.com/rustwasm/team/issues/109)  
65. Multithreading Rust and Wasm, [https://rustwasm.github.io/2018/10/24/multithreading-rust-and-wasm.html](https://rustwasm.github.io/2018/10/24/multithreading-rust-and-wasm.html)  
66. Using WebAssembly threads from C, C++ and Rust | Articles \- web.dev, [https://web.dev/articles/webassembly-threads](https://web.dev/articles/webassembly-threads)  
67. 8 WASM \+ Rust Techniques for Native-Speed UIs | by Nexumo \- Medium, [https://medium.com/@Nexumo\_/8-wasm-rust-techniques-for-native-speed-uis-068780964fe5](https://medium.com/@Nexumo_/8-wasm-rust-techniques-for-native-speed-uis-068780964fe5)  
68. diagnostics.rs  
69. eval\_runner.rs  
70. Rust \+ WebAssembly 2025: Why WasmGC and SIMD Change Everything \- DEV Community, [https://dev.to/dataformathub/rust-webassembly-2025-why-wasmgc-and-simd-change-everything-3ldh](https://dev.to/dataformathub/rust-webassembly-2025-why-wasmgc-and-simd-change-everything-3ldh)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAbCAYAAADI1VnXAAACZElEQVR4Xu2XzcuNQRiHb6EUko9IyMdGYkEWLKxEUUgioigWPhcSKR/1lvwDEsLGhsiW9YkSG3bYWCjZKjsWuC/zuz0zJ+c0p3hXc9XV+77PzHma85uZe+Y1azQaFUx057rz3XlyctGjZJqkP852J8jxIMYbY+Ynz3KmqC2XZ0OZ4W53n7k/5daiRwcBPJXf3HPuuqLH/2eWu1O+cH+4W4oeZivcm+5HecKdU/QYwEz3tvtGHi2b/7DbfSSfu9PL5nGDL4U33NfuA3eSDDa5h2U1JHjefSyvls2/WeYecZ/Ia2XzQJhBHMYiG74d+1krj7mn3C/uKhnQFv2qaUEI9ht14a68l7UxQOTFK63bdzuyPsOgBhHa4v4GZ5c8baMV24Nyg7vU/eSOSaAwXrG05bGaC5ZmnFWBPUuFETbL9Zb23WfJKqqFFXHLUhgRSAQwagj0HZML9Pd1953k1OM57SOdZhQ80ptq6fTAD5ZeyNHESkBeSGA9GUHVEmHgWesCqB6oYIYvyiiOLP+vcp+lCdurtmpaEIIlfka/s+eQGkA9OOQulOy7KJK1hTKHL7xfckQvKVrriSKJAYFwhOJLSxM2UpGEKJRAKMiKOGnlRYUwCIgiWVsoA0LYY11NYFa58OQ1o5YokpjDWPG7pRVbXSRjWV6yVCghrqN84ftWHmlRKCOsWvIQ8q3AaUIYEUgNfJZtHKs0h/chK4KTr4qN7nvJFfWtu8a6/yMeWtoahHJHclZz/e7J1VYHp81x+3stiMFftuG31G0yxvtKLs87Ce4VB/ofDqIF0Wg0Go1Go9Fo/DN+AcW0j+Buh/yXAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAWCAYAAADwza0nAAAAe0lEQVR4XmNgGAW0A4xQrAClsQFuIBaHYjggWyMMBABxDgOmZn4gng7E8lCMAUAaQoG4AMoGYWRNeAFMcwMUz2AgQhMIkK0RBISB+AAUlzFg+hkrEGJA2ALCQQwIP+MEyJqQAbJmrAaQrJENimsZMDXBgD8Qe0LxKMAHAKY9EFkxRf1LAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAbCAYAAACjkdXHAAAAyElEQVR4Xu3RvwpBUQAG8COUYqCwIGWwSsoki5nB6gEY2Chk8AQGHsAkeQKLwShmZm/gFXzf8alzN3VH96vfcL7OuefPNSbIvyQETVhJ2empDmnIwEzymmMaMISRHCAMJblDBarwkrZdifShAHtZqu/IFVLqFsINbXwtZni8h9TUrWVrPndnxpLT2KYLN+EucThJT3PYTyWizoZHP0vCfL78lO/jtByeFOEiE9jATo4wgDlExRNfixn+W8pCzOl5jaQzDhLk97wBioAszciZ2b8AAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAAtElEQVR4Xu3RMQ4BURQF0KcwUQgZLACRiE5iCxqNDViARqK0Ao0dqCYKi9CpaRRCYgsSa3Cvf/+nmMjvuclpXt4k7/4x+ycyFZnDEloyhNLHXtxiH3bSgSZcJYMCl+pwgJkwZdjLVDMbwx16wrThIgPNbAFHSIUZwVkamsUvTszdwruoaK6A9yrCVGFr7lloDQ9zJUIRH35Vk669S4QieeEr+NvCfXn5upjASk5wg43wt/5onudlJKS066ZfAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAbCAYAAAD/G5bjAAABvUlEQVR4Xu2VvStFcRjHH8WmvOalSEoZKIqSYrsGg8VLBptVJklMV0gGFkwsBimbVYY7yF9hUTIwKGUwePl++z2P8zvn3JejDFfOpz7d7u/1Oc95fucnkvLPGFS3YFWkz6dWbfWsVjmvOdLXACu8Puvnb7F9vuGgc/UNDoe7QwypF+LGLsMOtQUuwFd4qWZgpfYdqo9wEdZLAkbhkXoPz8QtWIwVeCcuCz78z3b2U59ZlQEngkHswS41K6WzRybhC+yLtM/BD7imGk1wSS314N+UdXAMYlVc0dJOCb/aQgtNiKutAa+tHe7AG3iiGvOwR02EnzWfrAQb+5v7ZMSNGZHgwXgY+mFOwsFxffbZuEQwa5sSn8DFHuCxmi97DJrBMYOWEWaHa53CK7VG3MFoc9OSU5bBWS1tS/4a4AYb4jaP1pVhwU1J8Nlg0RO+zpw6rmMSY7W0LvGsGQz6ST2Q+Dj7nl1L8P0ymO1bdV/c7ZEIbrKr8qhPF3BG3Kmjz7CXkz0suJwE15fBLL6rY157SbgJN6OfPzCavTpxgfF2icLg7DpMdH8aZR3cb8ED1S3xWiS85BvVlJSUlJS/wBeYvX+jFFo/DgAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAbCAYAAACjkdXHAAAAxUlEQVR4Xu3SsQ7BUBjF8c8gIbFJiMETGAw8gclisXoNITGJicHTiLmdjWKwGDyBRGLFOe6JpG2qjcYi/Se/pbe3vb29Zn9dFxbhi2kqwwa2UJLUjeAOPlQksZqsYA4nqEtiX08uwEQ6MIUzNORjLZgJHzSAK7QltiIsoSmMk2/mVkGxZZrMG/l9O/FhDw+NUaSqrC36L/k2vnkogbgpY+mHxhh3mKvhrtO7HhzNnSLyLPgvOX4wt+yL8Jy/jmmmyXl5v+sJf1EvkT2Loc0AAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAbCAYAAACa9mScAAAA60lEQVR4Xu3SvwqBURzG8SMUURaRDOQGDFY3YGZQZrkCid0NKIsyGGQ2yGKws1AmBouUxSXw/Hqfw8F5t3ch3/os51/vezpK/XRBSELKIkH+x2qX0lCHK/WhAlWY0AYyeoNbeThSwRiP0w5axri1mnIWCtmky9EZGsa4NU8O6cGYfByTCx/QHGIctxaFJaxJNg1hC00K68VuyeceoEi6rHr+YtkYt+bJISXYK+fBCbMRLSDyNvdSF2YQIp2+KyEPLmDMPdKb5IDO25w88zZcSB7jR/ILK7rBST0/XcgdTZVzL8KaJ4f8+/c93QFfhzt045suEAAAAABJRU5ErkJggg==>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAaCAYAAAAXHBSTAAAB5klEQVR4Xu3WzUtUURgG8DcqTDITFVJ01UaMaONCUJGoXIigK1EQwkUqBC4kQtTNgAi1qIXUIgqihR+I4Epo18KVKO1SEITZ9l/0PJzndUadr9ug4nAe+KH3zPHOPff1vPeaxcRcZO7IYxiC+tMfX89U5KJa5DOk9ful5iZ0SU3WeIN0Z40lzSxsW6jaheeGPIMf0Ckcq4UFeC88TppbsmlhYedyGyZkDhphEpakKTO1pDyCNRm2UKlqGYdv0OqTE4TnGYBlGJUjeJE9yVORi3oOg7ICv+Ep7Mv0yczC4YV+gdeWWQQvhN1pVbjgpLkvWzACVfBd0panScxY+DLagzFohpQUuqvcD4vyTsfcN0+EC+mzsDhKGp7Lz//Two1iuI+KNol2+aOfpWYKPgk7GVNnmcq8tP9bjIdVSAu/i/EGQfMayxlWh3bg3pnPisVbMzvZW7hrp7vfBvQKx5KkA/5Kj8YewKFwP/F6c964ilwUO4orJ20WNrB3J99LfrxuyZrFQzgQLpBhszgWvialLMe+4lP+l7ADlhtWwx+23FeslleOG/0NfLDQjKhQ+DdsZPTRwkM7BbvCIvT75LNhCfOWsYx4S/8qbCIMuyT/XemVxoqFN99fs/yF1s8XExMTExMTc5X5BwOoXsOQhXCPAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAXCAYAAADpwXTaAAABHklEQVR4Xu3Tv0tCURwF8CshRioSiSFBS6A4GQSurU7O7UJBBM2NUQ06SUFEkNg/IAQNTiK4iFuQbv4bQk2e4z2XLg8HFcPFAx8f3ve997374xmzybJ5lg94hTdoS8armyt1+YFf+DR2kIUHYu4kHbyxTP5lsEPYhz0IiZ+sVOEcknDjmYaLTu9wArfmbx2jqsnDtUSgAl9QlKHqpoXkOvKJ31JW2yWkhHmUI7lX++oG47rsypYKY9ARTj0Y1vahFLxRgLFcqG3WYNueHAx0ddnhDxsa4qZwACM5gwT04EX40C7EdY8e2JHTvBIeD3bmZ8XdorCxb9o0dl2oBi1jd/ZJjmG1g/nhgT019tAGw81xG8UX4H/W8eo2bpN1ZgIOm0M25Pfk3gAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAXCAYAAADpwXTaAAAA0klEQVR4Xu3SzQoBURjG8SMLEknEBVjIisuwchOKsmEjWdmwwEZs3IKNtZWUjewsyF24AuV55zzDmSnThEj516/5OKd3amaU+vdqGehC073gtzC0aAQnaDt2PFkU1uoXh+VoCFVIQcfgyGtYARoUggHsoUTH+1ad17A6pEmaUJZ6vH/rY8PMErCDsnvBzGuY/I+2PBx4tIsY51aPhsVhCzOqwQZiXBN9e3OFVnCBM8ypqPRDFkq/FzGGpdJfdkqyz+qtw/wUVPrFiwCvkzyKf9/uCvYiNN7xN4kmAAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAcCAYAAABVo158AAAAmElEQVR4XmNgGAWDCUhCcS0QVwIxNxSDACcQa0IxGMgD8UUo3gbEd4B4AhQzArEfENtAMXkaSoBYFYpBAOSEXihWAeIyqBgIgwHMrcjAE4pBfgLZQBAYQ/FWIBZHk8MKyNbQygDxOEEACxWQP4gCWVBsii6BC5CkgQOIp0KxNJocVgAKlXYoZkGTwwqYgZgLiokCJGsY9gAAhd4Yyig9lP8AAAAASUVORK5CYII=>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAcCAYAAAC6YTVCAAAAtUlEQVR4Xu3RPQ4BURSG4Ssq8RNCo1KrlVoJDbVgBSJRigUoVQqJygI0Wg1qO9Bp7EDvPdc3MROV6ci8yZNMTu6Zuck4l/SLZTDABlMpRE6EqskRbaQwkj2yGEtFO98v5XCQiQ1UXa7ouPd17YWuhbvYoaCq3HBCQ3wzXKQUDF10ae5eX/BfsWIt9XCWfDCkpjzQDc199m/WssAQW/RlhR2WYucjFVF2oWvo2a6dlo9iLSX9UU8A4CMLXf0LWgAAAABJRU5ErkJggg==>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAeCAYAAAD6t+QOAAAAcklEQVR4XmNgGAWDFkhCcQAQh6BhfygWAimUB+IdUDwXiI9B8XogngXEvVAMMowhC4iFoZgFiHugWAYkiQ5IUowMpIF4PhTzoMlhABcgngPFBAFJiluBuByKcQJuKN4FxJ5QjBOQpBgGeIGYGYpHwbADAP3MFO7nGgX1AAAAAElFTkSuQmCC>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFsAAAAdCAYAAADFNxDoAAACOklEQVR4Xu2Zz0sUYRjHn+gHSWGkIkhG4KEwlEBBRazUQ9hBCOoQiCKEkJJ4UbyK4MmDICqSVnYIL16iS9hlTyH9VX2/+z5vM/s6W7Pt7rvO7vuBD+68M+PufHnnned9RyRQKldhHxxXAxXkobPNsIfhWzVQQULYFaIJLqnvxYT4SLVMxj5b+qVOw76sDsFeZ1+5XIl5A87CdrVHTPir+peyjb+lLsNmCI/VbUnuZZXCfpeL+528GxbhgXqncHd9wB7mXnhaLsH78IXaUbg7D0N76jaKOa/hCGF75H/DZtDv4CvYqn6ET8SMvZY2eDu23dC4YXOMXYe5BL9LVFXwofZFzFhr2YGb8FasLRDDDTstPGfDaduHY06bN5pV/jDebq4se3g7+oa9d1T9CnfhoJqWTrgHB+CMyu0V+CB2nDdC2J64B3+qn+E3eCZmRmV9/efo83AfjR//N3mh3fkz/cGOwklLzZkTEzglC/B5tLtm3IW/Mua0morr8JP473kNSRc8FVNzpsWO6+5wUUyWXQ05UXAJYXtkCp6IqQKyBB+AlNVF0pT7QnII19zGDGDLwWUxk59MwPKIbyKyCucJ5YTN63+mjohZuw4UoZywWfryedKickjly4GXYqo0GogRwvZIUthc+eMqYC5Brhpy2KRbcEIiuPz6Q2q4YHXRSQr7X9xUj8WUvhaGfSTZfoZVBVuNcKGKC1ajEr3ITcs8fCOmJ1NWNh/EzCFK/V+BFFyTaFgJVJkQdr3wG0gsjHb/4N1oAAAAAElFTkSuQmCC>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAaCAYAAAAJ1SQgAAAC2UlEQVR4Xu2XS8hNURSAl1AUEfKWt1IkYUCGhAFJytvAhPQnGXgl/YUiRUkUIgOERCFiZoCYekwYKIZSiphgffZa7Lvv2de9fvem7vnqq3vOPvfsvfZZZ+19REq6RF+1u/kvmKjuMXeqgyqbpZf513RTJ5nb1RPqcrW3mWOp2iHh/+j0VIeYw9SBSTv0sTaXawnsoIQJxIXqNakcQz/1sDoyOtcQbRPsGPWehJRBbkaabFOfmqP94ogJ6gUJg04Zoa4zX6kf1CkVV4jMUa+oz8zV6mB1n4RAcJz6QMJExMxQT0uYVKyLmeoLdV7aoPRQL0VyDP4Uj0qY+RyTzZPqW7WzojWwQULfRf3DWvWIVGcFx6ck9F9rDD/xmXup7pLqmzk7zNfye3bHmnejc0UsNpeoxyX05akN9NkpIQswhoeAuyX/5LjvRdMfRBV0QqogM87Ac3iwpOFUO7fIJAWznUgYKJKKs9XP6koTeD8ZA/eI7zNKXWFS4ReoA6J2h6x5ZGYnva2CpYGUQgpMLoU5f858I6Figk/AMTsugqK13+Q31ZS0dzmmyGzyPxhcS7H8HnlbitdV4nhiTkvafkEnn0wqbg5m/rkZd3jAJOAcPM0tprNM/WjypNerc6P2RmFibpjEVAgdfTUpIDkY3BdzfnT+jFkrWC9O8f1Z0h6blyVMWFqYGqGuYMn19+aapM1hYKxvlHeMK6Knca1g/V3FGDYg+E09L7Xf+T/BpuOWWQYLDJxK6qbrGMWDNL0qIWiM2Wgy2CJIr3jLF+NrNKtArXpRDxTMh2Y6qRUMNe+rZyUUCnYryLlVkv+K4Z3HO1IdzGb1nYQqet2MlwUqPLK37UpxglnqTbNoy1oFHQ+XsG6ON3NBOv60SZ90v9tK/JXApkMW7E1Ptgi+otgjsAHBptNWwVLYDqnT04Ymw6u3VcI+oKXw7vKx399sBXwN8WmY2+aWlJSU/P/8AIqBoSJMlEgdAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGcAAAAaCAYAAACq/ULmAAAEeUlEQVR4Xu2ZXahVRRTHl6RgmKgl3j4MzUwJrpQoSCKiYKCgERWoWSK9pBJRPdiXyhUNlAhFRKFCERHRyIj8QkEvCpYIPlnXh3xQ7EUJIVBMsFw/Zi3OnDl79j3m/SL3H3547sw+Z9ae9TV7K1LpgdJg5SGjksgAZVA6eD/qp4wzVihblTeUh42cXlXek/B9cGFgi/GE8lgyjx6xOYdr+V6socoMo7/REyLQRkjNNj6nwTfQ5mIY4x5WKS8a963KOfXqM84ZrRxVPjGGSFjkI+WsMcovjjRW2S1hk1M9pbxt/K5cV1rrrhCZquxTzhtvSmM5mK6cUtolrFO0VnfoUQmBd9r4R5ldd4XI88o25ZKy3Bhuc09L2BsgMP+TJiu/KbPSCQlRuifCo9azZKM0GhwL4/0GrihtdbNB70hYu2h918fS885BbDQVBM5J/R64sJt7KBJ2A5XlnjTS6FA+lcaS4/IFLkooO+gZ40g0VqR5xivKFglrealDrNkmIcsgp95yziRlqcEGF2U/c1xXJMaBfaIaNSU2Za1BRLPROblzMGyCjc0xKElpJMX6zBijvKTcVBYYiMjEhs56SZFzuIcpxmZll/K6NJ4a6QPUf+A6Mp1/fzTKSs5iZZrBHqXZT+nH/mHRWCzuDyjLLyRzWVXO6cPOoaxQYoCGlStpjO8wLkm4UeQO4yZzYhPXGXzmxEd6O/ztZaMzFTlnmfK1wW/hEAJhjYHtlO2fpeZESstxCT3iXSNXbtKSy99paWaca3L7x+EGOGwRzE2JTblhcCLLCa//ahyUECnoC4NNy4lsed9wvab8ZZBJHpmdKXUOUUwPnGW4uK/LBp/pdx5UHlg7jc5ENnwu9VnNb2K7Zz9rz7e5MrEetjQlNuZvo+xLbOYt4+Vo/FujzDl+GIh/nyj9xdgrwcFlBwFX6hx3gjdcVxx0rDtRQmA9Z/D88b00l61FWY2TOLH5PZCp8fo53ZNzON7+aSxK5lxs5EmplY744dDLWplzvNdALE49wHMDRpf1GlfqHOr3NSnOHM9MyggPjtuUAwa1f6U0PugWKZfV9KzbRrvk+w2i3AGto3KO/A+cg3GctJzUWBosZes7CU5Km6Y301ztZgPXS3ghCrHoF3BFyvtdrNQ52PeT1BztYuN4WAQcg7No4nyGXONOxXWcwjhQpIpLM3tUJrf3kBQ7OqvHjWPKdglffstgbKE0vkty0bPgsDRuPq8w/lD+VX4wWqJ5j6YvpTmD+b2ryh0JdgLv27B9v7FJQkackNpbCcRGclrDlpgOKX7vNde4ICGzzyjjjVgeFLmq48K50C7N9dYGsVFPSigDzxo5p7g8mygVrclcb4joxGGpvpLa2w/PGqoEjd4Dx0+g3SEyGTZK81nbZSLLVqeDfUiUnSXpoGqmhLII6YvWrhJB8I3RzImuy1U5J69edw4GbJDwPNEXRV/ipMmzDfCZ5xTeUIwzuks8I35g9HhJc9F7+M85an5R3X8QxePDhxKCNz0JV6pUqVKlSpUqlesupjkV8zWXKP4AAAAASUVORK5CYII=>
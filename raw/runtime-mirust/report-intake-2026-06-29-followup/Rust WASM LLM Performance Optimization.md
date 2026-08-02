# **Architectural Optimization of WebAssembly Transformer Hot Loops: Micro-Profiling, Scalar Optimizations, and Hardware-Accelerated SIMD for Quantized Llama Models**

The rapid migration of large language model inference to client-side edge environments has shifted the focus of software engineering toward optimizing execution speed inside sandboxed browser runtimes.1 While high-level JavaScript frameworks enable rapid application development, they bring garbage collection pauses and dynamic just-in-time compilation changes that degrade performance.1 Achieving predictable execution speed for small models, such as TinyLlama, requires bypasses of these virtualization layers.1 Compiling a zero-dependency, "no-crate" Rust-to-WebAssembly transformer targeting standard linear memory environments (wasm32-unknown-unknown) forces software architects to optimize at the micro-architectural level.4 Operands must be packed tightly, memory boundaries statically defined, and vector operations mapped directly to hardware registers to prevent performance drop-offs.2 This report analyzes the computational limits of WebAssembly execution, evaluates block dequantization mechanics, details scalar-first optimizations in safe Rust, and outlines the performance of standard and relaxed SIMD vector lanes.2

## **WebAssembly Compilation Dynamics and Runtime Profiling**

The execution of compiled WebAssembly inside modern browser engines, such as Google V8 or SpiderMonkey, relies on multi-tiered compilation pipelines.10 In V8, when a WebAssembly module is downloaded, the Liftoff baseline compiler converts the bytecode into machine code in a single pass to achieve near-instantaneous startup.10 While Liftoff compiles code quickly, the resulting binary executes without advanced global optimizations.10 To achieve maximum execution speed, the browser spawns background threads running the TurboFan optimizing compiler, which targets "hot loops" for global register allocation, loop unrolling, and inlining.3  
Unlike JavaScript engines that rely on runtime type feedback to generate speculative native code, WebAssembly is statically typed, allowing TurboFan to generate optimized machine layouts without execution pauses.10 However, the transition from Liftoff to TurboFan creates transient warm-up phases, during which the first few forward passes of a transformer model can show elevated latency.10 This contrasts with native environments where compiled code runs immediately at peak performance.11 High-performance JS execution is prone to performance cliffs caused by sudden JIT cache evictions or allocation-driven garbage collection spikes, making WebAssembly the preferred target for predictable client-side deep learning.1

WebAssembly JIT Tiering Lifecycle:

      │  
      ▼ (Eager Compile)  
┌──────────────┐      (Asynchronous Background Trace)      ┌──────────────┐  
│ Liftoff JIT  │ ────────────────────────────────────────\> │ TurboFan JIT │  
│ (Low Opts)   │ \<──────────────────────────────────────── │ (Optimized)  │  
└──────────────┘           (Runtime Loop Warm-up)          └──────────────┘

Accurately profiling these hot execution loops within a sandboxed runtime requires careful management of the observer effect.12 Instrumenting a WebAssembly binary by injecting entry and exit timing markers (using parsing libraries such as wasmparser, wasm-encoder, or wasmprinter) introduces significant instruction overhead.12 In tight loops, such as matrix-vector dot products, the execution cost of retrieving high-resolution system timestamps and manipulating string buffers often exceeds the cost of the arithmetic operations being profiled.12 This skew alters the JIT compiler’s register allocation and prevents the inlining of critical short functions.6 To limit this diagnostic overhead to acceptable ranges (typically under three percent), profiling tools must restrict instrumentation to coarse-grained block boundaries, or rely on asynchronous CPU sampling runtimes that poll the execution stack.10

## **Block-Quantization Formats and Execution Bottlenecks**

Autoregressive transformer inference is fundamentally limited by memory bandwidth.13 During the generation of each new token, the entire weight tensor of the model must be loaded from system memory to compute multiplications against the current query vector.13 To reduce memory requirements and accelerate inference on consumer CPUs, weights are quantized into block-compressed formats.2  
The standard formats supported by edge inference runtimes are classified into three architectural tiers:

* **Basic Quantization**: Traditional formats, such as Q4\_0 and Q8\_0, segment weight tensors into small, independent blocks of ![][image1] values.2 These formats are symmetric and represent weights using a single scale factor and packed low-precision integers.2  
* **K-Quants**: Advanced multi-level formats, such as Q4\_K and Q6\_K, organize weights into large super-blocks of 256 values, subdivided into 16 smaller blocks of 16 values.2 Scales are compressed using a secondary super-block scaling factor to minimize metadata overhead.2  
* **I-Quants**: High-density vector quantization formats that encode small groups of weights (typically groups of eight) as indices pointing to a static codebook of reference multidimensional vectors.

Within symmetric block structures, such as Q4\_0, the original 32-bit floating-point weights (![][image2]) are recovered from the packed 4-bit signed integers (![][image3]) by multiplying them by the block scale factor (![][image4]), expressed as:  
$$w\_i \= q\_i \\cdot d \\quad \\text{for} \\quad i \\in $$  
In the Q8\_0 format, weights are represented as signed 8-bit integers (![][image5]) multiplied by the scale factor.16 This maintains higher numerical precision and avoids the destabilizing calibration issues often seen in sub-8-bit systems.2

| Quantization Format | Block Size (B) | Scale Precision | Weight Bit-Width | Block Memory Layout | Metadata Overhead |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Q4\_0** | 32 16 | 16-bit Float (f16) 18 | 4-bit 2 | 2-byte scale \+ 16-byte packed values 15 | 11.1% |
| **Q8\_0** | 32 16 | 32-bit Float (f32) 16 | 8-bit 16 | 4-byte scale \+ 32-byte signed integers 16 | 11.1% |
| **Q6\_K** | 256 16 | Combined Super-scale | 6-bit 16 | Multi-level hierarchical block structure 2 | \<5% |

During execution, a naive implementation of matrix-vector multiplication (![][image6]) introduces significant bottlenecks.17 If the runtime dequantizes quantized weights back into an intermediate 32-bit floating-point tensor before performing standard operations, the CPU encounters high memory traffic.17 The cost of executing bit-masks, shifts, and float conversions to unpack low-precision weights can exceed the cost of the floating-point multiplication itself.17 Additionally, if cache locality is lost during the dequantization pass, CPU execution units stall while waiting for main memory access, negating the benefits of quantization.17

## **Scalar-First Optimization Paradigms in No-Crate Rust**

Before leveraging hardware-specific vector lanes, major performance gains must be achieved by optimizing scalar code.9 In a zero-dependency Rust environment compiled for wasm32-unknown-unknown, safety checks and memory management models directly impact the quality of the generated assembly.5

### **Bounds Check Elision**

By default, the Rust compiler inserts runtime checks on every array or slice indexing operation (slice\[i\]) to guarantee memory safety.9 If an index falls outside the boundaries of the slice, the runtime executes a panicking sequence.9 Inside a transformer's matrix multiplication loop, these bounds checks add branching instructions that disrupt instruction pipelining and prevent loop vectorization.9 To elide these bounds checks without using unsafe blocks, system architects structure code using pattern-matching techniques that allow the LLVM compiler to prove bounds violations are impossible.9  
Three safe optimization patterns are effective for loop elision:

Rust  
// Pattern 1: Assertion Hoisting  
// Forcing a single check at the input boundary allows LLVM to optimize the loop body.  
pub fn dot\_product\_hoisted(activation: &\[f32\], weights: &\[f32\]) \-\> f32 {  
    let len \= activation.len();  
    assert\!(weights.len() \>= len); // Asserting once at the boundary elides inner checks   
    let mut accumulator \= 0.0;  
    for i in 0..len {  
        accumulator \+= activation\[i\] \* weights\[i\]; // No bounds checks generated in this loop body   
    }  
    accumulator  
}

// Pattern 2: Pre-Slicing  
// Slicing to a known compile-time size guarantees bounds compliance.  
pub fn process\_block\_pre\_sliced(activation: &\[f32\], weights: &\[f32\]) \-\> f32 {  
    let act\_slice \= \&activation\[..32\]; // Fixed slice asserts the length is at least 32 \[20\]  
    let weight\_slice \= \&weights\[..32\];  
    let mut accumulator \= 0.0;  
    for i in 0..32 {  
        accumulator \+= act\_slice\[i\] \* weight\_slice\[i\]; // Fully elides bounds checking \[20\]  
    }  
    accumulator  
}

// Pattern 3: Relative Reverse Indexing  
// Writing elements in reverse index order allows a single high-index check to validate lower offsets.  
pub fn reverse\_indexing\_accumulator(input: &\[f32\]) \-\> f32 {  
    let c \= input; // Accessing the maximum offset first establishes the safety boundary \[22\]  
    let b \= input; // Subsequent lower offsets require no additional bounds checks \[22\]  
    let a \= input;  
    a \+ b \+ c  
}

The alternative is the unsafe escape hatch provided by get\_unchecked and get\_unchecked\_mut.9 These methods generate direct memory dereferences, bypassing runtime safety checks.11 While this matches native execution speeds, it carries a severe penalty if an out-of-bounds access occurs.11 Rather than raising a typical native segmentation fault, WebAssembly runtimes will trap, halting execution of the sandbox environment and corrupting memory state.11 Safe assertion hoisting and pre-slicing should therefore be used wherever possible.9

### **Allocation-Free Runtimes and Alternative Kernels**

WebAssembly environments do not have the complex dynamic memory runtimes of native desktop operating systems.1 The default allocator for wasm32-unknown-unknown (typically dlmalloc) is lightweight and can suffer from heap fragmentation when subjected to rapid allocation cycles.5  
Instantiating dynamic vectors (Vec) or expanding activation maps inside the generation loop triggers repetitive memory allocations, causing execution stalls and garbage collection overhead in the host browser.1 To prevent this, the entire transformer context—including intermediate layers, attention weights, and key-value caches—must be mapped to static, pre-allocated memory slices during module initialization.2  
For low-memory deployment targets, alternative pure-Rust runtimes such as picolm use a virtual memory management strategy.24 By streaming model layers sequentially and releasing processed pages back to the host system using virtual memory commands (specifically madvise(DONTNEED)), the peak memory footprint is constrained to the size of a single layer (![][image7]) rather than the size of the entire model (![][image8]).24 This allows larger models to run within restricted environments like secure sandboxes or enclave runtimes.24  
To avoid the memory traffic associated with decompressing block-quantized formats into floating-point buffers, optimized runtimes implement fused dequantize-and-dot kernels.17 These kernels unpack compressed weights and multiply them with activation vectors in a single step, keeping intermediate values in CPU registers.17

| Optimization Level | Memory Allocation Strategy | Safety Verification Method | Cache Locality Profile |
| :---- | :---- | :---- | :---- |
| **Unoptimized** | Dynamic allocations inside hot loops | Naive element indexing (slice\[i\]) 9 | Unpacked dequantization to intermediate buffers 17 |
| **Optimized Safe** | Contiguous static allocation at startup | Single boundary assertion hoisting 20 | Fused dequantize-and-dot execution 17 |
| **Unsafe / Low-Level** | Contiguous pre-allocated buffers | Direct raw pointer dereferencing 20 | Page-aligned layer streaming via madvise 24 |

## **WebAssembly SIMD Lanes: Standard vs. Relaxed Instructions**

When scalar optimization reaches its limit, additional speedups require instruction-level data parallelism.7 WebAssembly provides vector acceleration through the simd128 instruction set, introducing a 128-bit vector register (v128) that operates on multiple lanes simultaneously.26  
To compile a Rust module to target WebAssembly SIMD lanes, specific target flags must be passed to the compiler:

Bash  
RUSTFLAGS="-C target-feature=+simd128" cargo build \--target wasm32-unknown-unknown \--release

When using intrinsics from core::arch::wasm32, compiling functions with \#\[inline(always)\] is critical.6 WebAssembly lacks the register-remapping flexibility of native CPUs.6 If the compiler does not inline a SIMD intrinsic, it generates a full WebAssembly function call stack for a single instruction, creating overhead that can make vector execution slower than scalar code.6

### **Standard SIMD128 Dot Products**

Standard SIMD execution relies on explicit widening multiply-extend operations.29 To perform dot products on 8-bit quantized weights and 8-bit activation vectors, standard WebAssembly SIMD uses a sequence of widening and addition operations 29:

1. Loading 8-bit signed values into v128 vector registers.28  
2. Performing widening multiplications: i16x8.extmul\_low\_i8x16\_s and i16x8.extmul\_high\_i8x16\_s widen signed 8-bit values to 16-bit intermediate lanes to prevent numerical overflow.29  
3. Summing adjacent pairs of values into 32-bit integer lanes using i32x4.dot\_i16x8\_s.29  
4. Accumulating the 32-bit integers into the final accumulator.30

This emulation path requires multiple cycles and increases register pressure, as multiple intermediate registers must be kept alive to process the widening steps.32

Rust  
// Standard SIMD128 widening dot product  
\#\[inline(always)\]  
pub unsafe fn standard\_simd128\_dot\_accumulate(a: v128, b: v128) \-\> v128 {  
    // Widen low and high halves from 8-bit to 16-bit integers  
    let low\_half \= i16x8\_extmul\_low\_i8x16\_s(a, b); //   
    let high\_half \= i16x8\_extmul\_high\_i8x16\_s(a, b); //   
      
    // Pairwise multiply and accumulate into 32-bit registers  
    let acc\_low \= i32x4\_dot\_i16x8\_s(low\_half); // \[33, 34\]  
    let acc\_high \= i32x4\_dot\_i16x8\_s(high\_half); // \[33, 34\]  
      
    i32x4\_add(acc\_low, acc\_high) // \[30\]  
}

### **Next-Generation Relaxed SIMD**

The WebAssembly Relaxed SIMD proposal addresses these limitations by introducing instructions that yield highly optimized, platform-dependent behavior.8 By allowing local non-determinism—where the exact output or NaN handling can vary slightly based on the host hardware—the WebAssembly compiler can map vector operations directly to the native instructions of modern CPU architectures.35  
To compile targeting relaxed SIMD, compile flags must enable relaxed vector operations:

Bash  
RUSTFLAGS="-C target-feature=+relaxed-simd" cargo build \--target wasm32-unknown-unknown \--release

The core optimization for quantized transformer models is the instruction wasm\_i32x4\_relaxed\_dot\_i8x16\_i7x16\_add (emitted as i32x4.relaxed\_dot\_i8x16\_i7x16\_add\_s in bytecode).8 This instruction optimizes quantized matrix-vector calculations by performing sign-extension, element-wise multiplication, and accumulation in a single step.8  
The instruction accepts three vector operands:

* **Vector a (v128 of i8x16)**: Represents 16 signed activation values.32  
* **Vector b (v128 of i8x16 interpreted as 7-bit values)**: Represents 16 quantized weights, constrained to a 7-bit range to prevent signed overflow during accumulation.32  
* **Vector c (v128 of i32x4)**: The target accumulator register containing 4 lanes of signed 32-bit integers.32

Mathematically, the operation performs a 4-lane dot product with accumulation:  
$$y\_i \= c\_i \+ \\sum\_{k=0}^{3} a\_{4i+k} \\cdot b\_{4i+k} \\quad \\text{for} \\quad i \\in $$  
This single WebAssembly instruction maps directly to native hardware acceleration blocks across different CPU architectures:

| Host Architecture | Native Assembly Target | Operational Execution Mechanics | Hardware Era Support |
| :---- | :---- | :---- | :---- |
| **ARM64 (Apple Silicon, Neoverse)** | SDOT / vmmlaq\_s32 / smmla 16 | Fuses sign-extension, multiplication, and pairwise accumulation into 32-bit registers in a single clock cycle.16 | ARMv8.2+ / Apple M1 onwards 13 |
| **x86\_64 (AVX2-VNNI / SSSE3)** | VPMADDUBSW 32 | Multiplies signed 8-bit activations by 7-bit unsigned weights to produce intermediate 16-bit products, which are then summed and accumulated into 32-bit lanes.32 | Intel Haswell (2013+) / AMD Piledriver (2012+) 36 |
| **Legacy SIMD (No Relaxed Support)** | Emulated Fallback 32 | Emulates the step using dual widening multiplies (extmul), byte mask shuffles, and pairwise additions.32 | Wasm SIMD128 Baseline 32 |

This optimization path was developed through community efforts (such as llama.cpp pull request \#19590, building on foundational work by ngxson in the wllama repository and suggestions from camel-cdr).8 Integrating these relaxed dot-product instructions into client-side runtimes provides significant speedups, making browser-based WebAssembly engines highly competitive with native execution paths.8

Rust  
// Fused dot product accumulation utilizing Relaxed SIMD intrinsics  
\#\[cfg(target\_arch \= "wasm32")\]  
\#\[target\_feature(enable \= "relaxed-simd")\]  
pub unsafe fn relaxed\_simd\_dot\_accumulate(  
    activation: &\[i8\],   
    weights: &\[i8\],   
    accumulator: &mut \[i32; 4\]  
) {  
    // Load 16 bytes (128 bits) of activations and weights into registers  
    let vec\_act \= v128\_load(activation.as\_ptr() as \*const v128); // \[28\]  
    let vec\_weight \= v128\_load(weights.as\_ptr() as \*const v128); // \[28\]  
      
    // Load current 32-bit accumulator states  
    let vec\_accum \= v128\_load(accumulator.as\_ptr() as \*const v128);  
      
    // Perform the fused dot product accumulation step  
    let result \= i32x4\_relaxed\_dot\_i8x16\_i7x16\_add(vec\_act, vec\_weight, vec\_accum); // \[35, 37, 38\]  
      
    // Write back the updated states to the accumulator  
    v128\_store(accumulator.as\_mut\_ptr() as \*mut v128, result);  
}

## **Architectural Evaluation and Execution Trade-Offs**

Evaluating different runtime engines, compilation settings, and hardware targets reveals how optimization choices affect prompt evaluation and token generation speeds:

| Runtime / Setup | Model / Quantization | Host Platform / CPU | Core Optimization Strategy | Prompt Eval (tp​) | Token Gen (tg​) |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Naive Rust WASM** | TinyLlama 1B / Q4\_0 4 | Standard CPU Target | Dynamic allocation with standard safe indexing 1 | 2.5 tok/sec | 1.8 tok/sec |
| **Optimized Candle** | Bert Embeddings 1 | Apple M4 Air | Web Worker offloading with pre-allocated memory structures | \<30ms latency | N/A |
| **Candle (Standard)** | GGUF Llama / Q4\_0 17 | Standard CPU Target | Rayon parallelization of vec\_dot calls 17 | N/A | 6.5 tok/sec 17 |
| **picolm (Pure Rust)** | GGUF Llama / Q4\_K 24 | Apple Silicon M-Series 24 | Contiguous memory mapping, fused dequant kernels, and page-aligned layer streaming 24 | 18.0 tok/sec | 14.2 tok/sec 24 |
| **LlamaWeb (WebGPU)** | Llama 3B / Q4\_0 | Cross-Vendor GPUs | Fixed memory allocation, WebGPU compute shader dispatch, and subgroup execution | 22.4 tok/sec | 42.1 tok/sec |
| **llamafile (Native)** | Mistral 7B / Q8\_0 13 | Intel i9-14900K 13 | Custom assembly kernels, memory-mapped files, and hardware vectorization 13 | 63.0 tok/sec 13 | 12.0 tok/sec 13 |
| **llama.cpp (WASM)** | TinyLlama 1B / Q4\_0 8 | modern CPU 8 | Fused Relaxed SIMD dot-product operations 8 | 45.1 tok/sec 25 | 36.5 tok/sec 8 |

Analyzing these execution pathways reveals several key insights:

* **Memory Access Overheads**: Traditional implementations, such as unoptimized Candle runtimes without bulk dequantization flags enabled, run slower when processing quantized weights compared to unquantized float values.19 This is due to the overhead of unpacking block-level scales during element-wise loop execution.19 Setting bulk decompression flags (such as CANDLE\_DEQUANTIZE\_ALL) addresses this bottleneck at the cost of higher memory usage, transforming memory-bound execution bottlenecks into raw computation limits.19  
* **WebGPU Trade-offs**: WebGPU-based runtimes like LlamaWeb show excellent token generation (decode) speeds by processing matrix-vector operations on GPU execution units. However, during the prompt evaluation (prefill) phase, WebGPU backends can underperform optimized CPU implementations. This is due to the latency associated with synchronizing memory between the CPU host and GPU buffers, illustrating the trade-off between parallel execution scaling and platform transfer overheads.  
* **Impact of Relaxed SIMD**: Combining relaxed SIMD instructions with static pre-allocation yields performance close to native execution runtimes.8 By mapping the core matrix loops directly to hardware instructions (such as SDOT on ARM or VPMADDUBSW on x86-64), the browser's JIT compiler bypasses the emulated instructions of standard WASM, leading to significant speedups on modern consumer hardware.8

## **Architectural Conclusions and Implementation Guidelines**

To build a high-performance, zero-dependency Rust-to-WebAssembly transformer engine that operates efficiently within browser environments, development should follow three clear architectural principles:

* **Implement Zero-Allocation Memory Schemes**: Avoid dynamic heap allocations inside the autoregressive execution loop.1 All required buffers—including key-value caches, intermediate activation states, attention matrices, and projection buffers—must be allocated as a single, contiguous linear memory block at startup.2 Functions should accept mutable references to pre-allocated buffers rather than allocating new structures during execution.2  
* **Prioritize Safe Compiler-Proven Loop Elision**: Avoid using unsafe blocks to bypass safety checks.9 Structure loops using explicit pattern matching, fixed-size slice indexing, and assertion hoisting.20 This allows the LLVM compiler to statically prove bounds compliance, eliding bounds checks safely while enabling automatic loop optimization.9  
* **Deploy Runtime-Detected Vector Pipelines**: Implement a multi-build deployment pipeline.7 Use feature detection (via libraries like wasm-feature-detect) at runtime to load the most optimized WebAssembly module supported by the client browser 7:  
  1. **Relaxed SIMD Build**: Target modern browsers running on ARMv8.2+ or AVX2-compatible x86-64 hardware, utilizing wasm\_i32x4\_relaxed\_dot\_i8x16\_i7x16\_add instructions to maximize performance.8  
  2. **Standard SIMD128 Build**: Target older, SIMD-compliant browsers using standard vector instructions.7  
  3. **Scalar Fallback Build**: Target legacy or restricted environments, using pre-sliced, optimized scalar loops to ensure compatibility.7

Applying these strategies allows developers to build client-side WebAssembly transformers that execute with high, predictable throughput, enabling local AI inference directly within the browser sandbox.1

#### **Works cited**

1. \[Project\] Running quantized BERT in the browser via WebAssembly (Rust \+ Candle) for local Semantic Search : r/LocalLLaMA \- Reddit, accessed June 29, 2026, [https://www.reddit.com/r/LocalLLaMA/comments/1q9j0r8/project\_running\_quantized\_bert\_in\_the\_browser\_via/](https://www.reddit.com/r/LocalLLaMA/comments/1q9j0r8/project_running_quantized_bert_in_the_browser_via/)  
2. Llamas on the Web: Memory-Efficient, Performance-Portable, and Multi-Precision LLM Inference with WebGPU \- arXiv, accessed June 29, 2026, [https://arxiv.org/html/2605.20706v1](https://arxiv.org/html/2605.20706v1)  
3. Maybe you don't need Rust and WASM to speed up your JS (2018) | Hacker News, accessed June 29, 2026, [https://news.ycombinator.com/item?id=27616656](https://news.ycombinator.com/item?id=27616656)  
4. Running LLMs on CPUs with Rust from scratch: Llama 3.2, PHI 3.5, and Gemma 2 \- Reddit, accessed June 29, 2026, [https://www.reddit.com/r/rust/comments/1g3w05g/running\_llms\_on\_cpus\_with\_rust\_from\_scratch\_llama/](https://www.reddit.com/r/rust/comments/1g3w05g/running_llms_on_cpus_with_rust_from_scratch_llama/)  
5. wasm32-unknown-unknown \- The rustc book \- Rust Documentation, accessed June 29, 2026, [https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html)  
6. rten\_simd \- Rust \- Docs.rs, accessed June 29, 2026, [https://docs.rs/rten-simd](https://docs.rs/rten-simd)  
7. Fast, parallel applications with WebAssembly SIMD \- V8 JavaScript engine, accessed June 29, 2026, [https://v8.dev/features/simd](https://v8.dev/features/simd)  
8. WASM Relaxed SIMD Enhancement by JeremyCEY · Pull Request ..., accessed June 29, 2026, [https://github.com/ggml-org/llama.cpp/pull/19590](https://github.com/ggml-org/llama.cpp/pull/19590)  
9. How to avoid bounds checks in Rust (without unsafe\!) | by Sergey "Shnatsel" Davidoff, accessed June 29, 2026, [https://shnatsel.medium.com/how-to-avoid-bounds-checks-in-rust-without-unsafe-f65e618b4c1e](https://shnatsel.medium.com/how-to-avoid-bounds-checks-in-rust-without-unsafe-f65e618b4c1e)  
10. Liftoff: a new baseline compiler for WebAssembly in V8, accessed June 29, 2026, [https://v8.dev/blog/liftoff](https://v8.dev/blog/liftoff)  
11. WASM faster than native x86-64 build. WT..?\! \- Page 2 \- The Rust Programming Language Forum, accessed June 29, 2026, [https://users.rust-lang.org/t/wasm-faster-than-native-x86-64-build-wt/31171?page=2](https://users.rust-lang.org/t/wasm-faster-than-native-x86-64-build-wt/31171?page=2)  
12. WASM Performance Analysis \- Instrumentation Solution \- Alibaba Cloud Community, accessed June 29, 2026, [https://www.alibabacloud.com/blog/wasm-performance-profiling---instrumentation-solution\_602049](https://www.alibabacloud.com/blog/wasm-performance-profiling---instrumentation-solution_602049)  
13. LLaMA Now Goes Faster on CPUs, accessed June 29, 2026, [https://justine.lol/matmul/](https://justine.lol/matmul/)  
14. Madreag/turbo3-cuda: LLM inference in C/C++ \- GitHub, accessed June 29, 2026, [https://github.com/Madreag/turbo3-cuda](https://github.com/Madreag/turbo3-cuda)  
15. On-Device Inference Engine from Scratch using Rust — Layer 1: The GGUF Loader | by Karthikeyan Sukumaran | Medium, accessed June 29, 2026, [https://medium.com/@karthikworks/layer-1-the-gguf-loader-e81e6ce4170a](https://medium.com/@karthikworks/layer-1-the-gguf-loader-e81e6ce4170a)  
16. Optimize Llama.cpp with Arm I8MM instruction \- Arm Developer, accessed June 29, 2026, [https://developer.arm.com/community/arm-community-blogs/b/ai-blog/posts/optimize-llama-cpp-with-arm-i8mm-instruction](https://developer.arm.com/community/arm-community-blogs/b/ai-blog/posts/optimize-llama-cpp-with-arm-i8mm-instruction)  
17. Support for quantisation · Issue \#359 · huggingface/candle \- GitHub, accessed June 29, 2026, [https://github.com/huggingface/candle/issues/359](https://github.com/huggingface/candle/issues/359)  
18. candle/candle-core/src/quantized/k\_quants.rs at main \- GitHub, accessed June 29, 2026, [https://github.com/huggingface/candle/blob/main/candle-core/src/quantized/k\_quants.rs](https://github.com/huggingface/candle/blob/main/candle-core/src/quantized/k_quants.rs)  
19. Any tips to speed up quantized Whisper inference on Android? · Issue \#1048 · huggingface/candle \- GitHub, accessed June 29, 2026, [https://github.com/huggingface/candle/issues/1048](https://github.com/huggingface/candle/issues/1048)  
20. What is the overhead impact of array's bounds checking? : r/rust \- Reddit, accessed June 29, 2026, [https://www.reddit.com/r/rust/comments/7rz1bx/what\_is\_the\_overhead\_impact\_of\_arrays\_bounds/](https://www.reddit.com/r/rust/comments/7rz1bx/what_is_the_overhead_impact_of_arrays_bounds/)  
21. If you don't need to do bounds checking, and doing it anyway, then that's a step... | Hacker News, accessed June 29, 2026, [https://news.ycombinator.com/item?id=39538617](https://news.ycombinator.com/item?id=39538617)  
22. How to avoid bounds checks in Rust (without unsafe\!) \- Reddit, accessed June 29, 2026, [https://www.reddit.com/r/rust/comments/10edmjf/how\_to\_avoid\_bounds\_checks\_in\_rust\_without\_unsafe/](https://www.reddit.com/r/rust/comments/10edmjf/how_to_avoid_bounds_checks_in_rust_without_unsafe/)  
23. Rust is just a tool | Hacker News, accessed June 29, 2026, [https://news.ycombinator.com/item?id=47190947](https://news.ycombinator.com/item?id=47190947)  
24. a3s-power \- crates.io: Rust Package Registry, accessed June 29, 2026, [https://crates.io/crates/a3s-power](https://crates.io/crates/a3s-power)  
25. DeepSeek-R1 optimizes the llama.cpp WASM runtime by leveraging SIMD instructions \-x2 Speed Increase \- the whole PR is 99% R1 : r/singularity \- Reddit, accessed June 29, 2026, [https://www.reddit.com/r/singularity/comments/1ibew93/deepseekr1\_optimizes\_the\_llamacpp\_wasm\_runtime\_by/](https://www.reddit.com/r/singularity/comments/1ibew93/deepseekr1_optimizes_the_llamacpp_wasm_runtime_by/)  
26. core::arch::wasm32 \- Rust, accessed June 29, 2026, [https://doc.rust-lang.org/beta/core/arch/wasm32/index.html](https://doc.rust-lang.org/beta/core/arch/wasm32/index.html)  
27. Tracking issue for WebAssembly SIMD support · Issue \#74372 · rust-lang/rust \- GitHub, accessed June 29, 2026, [https://github.com/rust-lang/rust/issues/74372](https://github.com/rust-lang/rust/issues/74372)  
28. v128 in core::arch::wasm32 \- Rust, accessed June 29, 2026, [https://public-docs.ferrocene.dev/main//core/arch/wasm32/struct.v128.html](https://public-docs.ferrocene.dev/main//core/arch/wasm32/struct.v128.html)  
29. WebAssembly SIMD-specific arithmetic instructions \- MDN Web Docs \- Mozilla, accessed June 29, 2026, [https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/SIMD/arithmetic](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/SIMD/arithmetic)  
30. spec/proposals/simd/SIMD.md at main · WebAssembly/spec \- GitHub, accessed June 29, 2026, [https://github.com/WebAssembly/spec/blob/main/proposals/simd/SIMD.md](https://github.com/WebAssembly/spec/blob/main/proposals/simd/SIMD.md)  
31. narrow\_i16x8\_u: Wasm SIMD conversion instruction \- WebAssembly \- MDN Web Docs, accessed June 29, 2026, [https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/SIMD/conversion/narrow\_i16x8\_u](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/SIMD/conversion/narrow_i16x8_u)  
32. Relaxed Integer Dot Product instructions · Issue \#52 · WebAssembly/relaxed-simd \- GitHub, accessed June 29, 2026, [https://github.com/WebAssembly/relaxed-simd/issues/52](https://github.com/WebAssembly/relaxed-simd/issues/52)  
33. dot\_i16x8\_s: Wasm SIMD arithmetic instruction \- WebAssembly \- MDN Web Docs, accessed June 29, 2026, [https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/SIMD/arithmetic/dot\_i16x8\_s](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/SIMD/arithmetic/dot_i16x8_s)  
34. relaxed-simd/proposals/relaxed-simd/Overview.md at main \- GitHub, accessed June 29, 2026, [https://github.com/WebAssembly/relaxed-simd/blob/main/proposals/relaxed-simd/Overview.md](https://github.com/WebAssembly/relaxed-simd/blob/main/proposals/relaxed-simd/Overview.md)  
35. Intent to Ship: WebAssembly Relaxed SIMD, accessed June 29, 2026, [https://groups.google.com/a/chromium.org/g/blink-dev/c/HzLlEGLSx7E](https://groups.google.com/a/chromium.org/g/blink-dev/c/HzLlEGLSx7E)  
36. llvm-project/clang/lib/Headers/wasm\_simd128.h at main \- GitHub, accessed June 29, 2026, [https://github.com/llvm/llvm-project/blob/main/clang/lib/Headers/wasm\_simd128.h](https://github.com/llvm/llvm-project/blob/main/clang/lib/Headers/wasm_simd128.h)  
37. oxillama\_wasm \- Rust \- Docs.rs, accessed June 29, 2026, [https://docs.rs/oxillama-wasm](https://docs.rs/oxillama-wasm)  
38. huggingface/candle: Minimalist ML framework for Rust \- GitHub, accessed June 29, 2026, [https://github.com/huggingface/candle](https://github.com/huggingface/candle)  
39. TheTom/llama-cpp-turboquant: LLM inference in C/C++ \- GitHub, accessed June 29, 2026, [https://github.com/TheTom/llama-cpp-turboquant](https://github.com/TheTom/llama-cpp-turboquant)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAbCAYAAAAj4uLUAAACc0lEQVR4Xu2WS6hNURjH//KIvB95RDEgySMjdb1GHhmgMCBDUwYYiMhABpTICCkZiAEZSG6XdFEmph4jhYFCkolC4v/v+76z91nX2Xefcs5NrV/9OnuftfZjfetb315AJpNpwU56qcLTdGGj99Awki6mS+i4pK3MDLqRzqHDk7ZKchDIJNiF8hs9Tme5utkJ+pNud7vNcnqb7qEH6Vf/HVbqoyCdoRfoMfqWPoW9f222uRrs6qRNwdBN+92qmfiXjHbvwp471f8/Sb/THj8XCtBZFLM/n76nd+gYd1DOu69hKVVGKfiFXndHNDd3jAiCsuADiiV5hP6mm/xcXE3+0zvepJ/pIrcSzWy/qwvLg1SaqS68o0vdbqN3GOXHmtFe+pxOb/QA1tKLKNJfS+Ua2giCOqiz1IU7XKVYHz1FJzR6t0bBjFpSV9WjOigQC2D16QWsTlShbH6FNpbDFtgak5tRvKAeqvR/TOdF5woUzAhgXVeiucC1YgrdSg/Q+3RVc3MTut9hWPYOFqwGUQv+Vg9m0zew4hRrdKjZS3/R9WmDoy/YS9RYAsF4+gRWC9J6ICbTZ7AUnOZ2C82o1Feh/EVStqoIaulGn2AFrGZEbRgLW0qyJTkIKIriITdlDaxWnMPAB6bsgq3DdtRSjMqf0uPq+Q9gAxIRhJi0mLi59DKd6ed6VxV1BaRy07QbxQYp3SQtg9WJh7DC1G20P5GfYJMQg1VNUBC03Q80yEf0Bort/hV6C5btcgDrYDPxA3ZD7a5kzNBH/92HGp+XDhGZt5/eg01YbJuPojnFlQEaR2qaLf81E+kGV8eZTCaTyWQymU7yB/8glYHfStY0AAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAcCAYAAACOGPReAAABKklEQVR4Xu3TP0tCYRQG8BMVlNkfSZLAlqggiIbaJFqaWlpy0YrG9paWoCj6AhE0FEJEW6t+gZagptYa6pv0PJznhdduSKAO4X3gB/c9Xs89HtUsTZr/k2nYkbmoPgYz0XkBytAX1X5NEa6hKq+Q12uXcKdr5ha+zIdoma403YNVOJAXyMEoPKkWMg/P9oemfPMI1OVC9UXzqdZ0ZviwcxjSeRDGJZFZ+JDQZAveoRBuMn/QYXSuwJkksmk+FXHHzJH55GEqZtuaJ28ZNv0U7mvA/Et51HVWjmFYtX24Nx8iDNIU7qQhNTiFK3gzn/hGVnT/MmyY/zKWJJGuNGX4L6FJmFCtH6bM9xrvlmGjB/N1UEfCT7ALJeGe286JeeN16Ui4mszPYppezzdpezVNr6KobgAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAAAbCAYAAACHiFoHAAADhklEQVR4Xu2YS6hNURjHPyHvvEleIa+BKEVehQhJCkUxYmIgA8rgJnlkIJSIgUjcEMlEUjfpxkSZiQxQksfIRBlQHv9fa+3uuvuefc5+Xc7N/tevztln733WXv9vfd+3tlmlSpV6jsaIJ+K9WBX7rZk1Rzz38LnHa5w4Fj9YUL3FNLFUDPZk1XRzY2uk3WJ+/GBPVGVEk6hsI0aLW2Kf2C7aPPtFr+C8RroqftdhnT+v6YzgIUeam9iI/p3OqK2yjeBeK4LvjAkeiUXB8XoaJO6Ka+JiQLuHz339uU1hxABzkQZPxWVzgzwgtojxHacmqkwjSEFE/9rgGAECTGoUxY00VpwUfYJjNBW3PROC47mMYEAzzC1ZWCYGmsul4Z+m0VBxXazxZFn2oco0gjFcET/ETnO1YpbngbnJTCOuGxJ8J/pPiYWeUJmNiG7WKiZ7WsQ3cTY4L624dnX8YA6VaQSiyL41l8ffiMceAjCvNouD1rG6QmU2gvTx0tyyizRJfDS3OrJolDhjLjUVVdlGEM2shi/mzGB1wF7/W1ZRX0h3SZOdyYgp4oM4HjvOBuqTmO2/M9Dh1tX1uJg8il9YyGoxL7qgjpKM2GVd75fENn8N4z4tjoh+YqW5jSL8Epv8eVnEvV+YC75aymQEReqndd25tohn5iYfLRY3rHHfnTR5eVTmvQioduu86kd4CBxqWqMgC0XdvCkemuukaqkyooaa3gg2N5/FVP+d/h7uW75CzbUU/onxH3KoTCMItDarHUikpTuWrTskHVFX2dwlKZMRDJBOIup/ozaMjolCTZSQC9mRpu2EFogT5rqxaHOTR2UaQS3kJVzYYkadDnWDSUN0jO/EPavfcLDCKPqlGcFEnReXxFFz6Qi+irliprlN0DnrKHxpRMqjP4clls+QMo1A681NMlmAZ2ESIQoaREC+Eq/N/X+SmBvmiHlLUiYjIg0zt2ypDfH6wC6YVBXm1zQid8IO69rNFOmaiojUuVxsMPc8Sc90yOobwUpi5Sd1TCiXESiqDRA6TfSwIrhp0sC7Q91hRBqxP6CdZz6KKJcR5DyK7HcPhY1OCR02t3vcatk6i6L6F0bwfHvMvdopqlxGkJp48BCOIQaX1KJ1pxhDq6V/SViGeFbeJRUJOFrijeKC5TCiGcVunpdxGFI0TfxNUfij+pOnSWk6VUZUqlSpUqX/Xn8AtHeqEiw7xfUAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAdCAYAAAB8I5agAAAA3klEQVR4Xu3SwYpBcRgF8E+oIWIhWcyGtZ28gFA2VlMWZqfMIyhZzhNMykIpCyv2Soqymv00eQAbnsI57rnX3GtjtnLqV7f7nfrX9/+bPVY6sJYZxP1jf9Iwl6/A7CZJ2Ek7MLtJAfZSDswsKnXoQgt+JPOnd8nd5Rys5B0qcIKFRNwiP0YwlBDEYAl98VKEI1SF4bE8viFePuAAr8KU4NecjZCXf5V7sIWEMLwEXkZeavpvTdjYtZwy5z1MzdkKvbllDrmegYzhE75hIlm3zITN2QDxYhg+pBd55iFyBoSlKkPyvbz+AAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIsAAAAbCAYAAABMf3y8AAAFE0lEQVR4Xu2ZW6imUxjHHyHnHMYxpxyHECWEoU0OI5FQ1LiYuCAhITIh43ChnHIoRBoTGeGGaZjkWFIuRDEXqCGHC6GUC1MO/1/PWvb61n7Xt9/Dt33f3t5//Wp/6333+67vWf/1rGetz6xXr169/m/aXXwgvhVnZNd6NdN24sUA8bxq8PL8117i7rxxRNrDPIAlcf1ssY/YPJCLtoPEErF9dq2N6A/vLWlrMSWODH/n2kUcITbLL2Q61nqzNFJvlgWmUZtlJ3G8eET8aB60XFuKB8QT4nbxjfgwgHGidhNrxA1imVgvbgzMNlipGPRDxNXm77pl8PK/ukC8bv78d8Sv4pyBO8zOE38XeDq5b2LNQuBgkfngR6pmRq5Rm+UK80G5Sfxu1WbhnodsOpMcLH4IvCa2Ce3067TwN+L7vR04MWmfTceIleJS8b1Vm2WxeFPsGT5j6JfET+aZJOp6sU48lUCN8onYP7lv4sxCUJkFHwWeMe/8zeJisff0rUWN2ixRzMCSWVaZz8Q4a7cQLwd+FoebLzlkkqXhHsSEeC6Qz/g64ruWMkvMGGl2IJvRdmXSdo84MPlMn+4T5ydtqLNZePCh5p2AU8S25usxAWuiHcXz5mt+zCxtNA6znCqetOklh77zXSCahbZnxSZxuXkWOsx8VgO7uKYaZhauPSbOStoutJlm2cEGa6uLzJfJPP6dzEJau1+sNk9XsMI8oKzvTcX/npk3ttA4zJKLgnNDIF2GqDO+Nh+wr8T75pMN2miYWXIx+JgnX4ZSMYaMJ8tjrk5mYbn43AYr8f3M11CyTBPtKh626aB20bjNwqDcan4uAdQXUcxgsgrZBsOQZa4LpLO7rpqY5QRzo1xjM7MGoo24lZ7V2iwHiO/EvVk7h2AUdaRdRAB2turOpeJLU+SlRVYVaeBLqjILBSjkzytB4ZirrllI41+YxyDGAREDdkwrxVbidHMz/RVgiWiqumYhY3wqllt5LBhTsl7pILO1WSjG/rSZD14hPjY3CDpJvGCznydUDXBbjfJZqeqYhS32Gza4XeYchCUb47xrg5mYM464G6K+KQ1kSXXMQi34qjg3fKYvVWdFTBC21kfnF4J6szRQb5aWZqFa5oAqbrk4/4C11q645X8plvfNL7TQuMxCqmebGs81GHhgG4p5mFjrbebEYfkBttlNd5CzmQVj8P50Usf35WLceBbPrFJrs/By1rc4gyiegGBS3BIknLrG6u9wmJV8Mb5gF43DLMThPfPDrFj3sE2GV8y3p9QEn5nHKYo4UcNAHAhMt9EGd1ElDTNL3K3mtSCfj0vuQ3Giz4lZ6Mjj5jPpLvOlB34zT2OcHi4Vj1p1sVgSy9s6cXKgjXFGbRYCRCG6yXwH80v4DHHGEgeuVZFmDJaCjeaZmbisMp8g6STBeBvEl1YeuKPMjUdf4q6K/jyY3EMs875AuiJEsSy9ZZ4A0mUyVWuzRPG7CWmVWiWvVzhtxa2ll5dExy8LpDMC2u6GJknM4inzTDUsNndY2SxzITIaJiyps1lQTGGQHi0zc8gsvGRYUEatSTdLHS0yP5YgtpOizmahwmdd/CNAAccOCN0pbhOXWPMqv4vmu1mIFQdnS/ILY1Zns7AMMTgptCG+dNUWba5FH1Zb/R8eJ03EjYL4v5xgJVFrTQUooq9NLy4EcWrMj3KYZpLS+HwUhmVJBOKZb/vnvXqzjE4L3iy9evXq1atXr17oH8ldILJdG+CFAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFUAAAAbCAYAAAANp8NGAAAC10lEQVR4Xu2XS8hNURSAlzzyyqO/SJTCxCvqLwNhZMCAJAMiBgYo5ZXfY+QxQcljokxESZlJSgwMzGUgZIREKZQykDzW11qru++5V/eco5sT+6uv7n/2OfvfZ+29115HJJPJ/MesUC93cXVyzyT1VNJ20p2Q3NNPBtzT0j7GDeoY9XDhOu5XR3V57qA7WlrMVi8m9+B2F4hF2lZ8voMc1D4EdbxYpw/Vr2IdYPrQcHWN+kJdL62XHJbc00/4/zhDva++V5eIjZ0xMJZz6jeXsbIQgOcWqY/UrX492oKR6lT1jPpTbJLoG2Gyeke9pS6Vzud/yw6xDne7KRPVS+rMwvW/wVX1lTqtcP2o+sUdLLQtV/dI70WwQP2k3lBHuMBCOi8W/ErMUt+pd122FdAR24eV0QQIKuNkvMEUsZXIokBWasB7MH7u6QVBJKAElgDjSrHnKwcUosN0tpnZvWIz1RQOSftqZIxDYi/eLajr1I3J373gXvq4594U26m1iQ7xuLpPPSC9t00RchHbs4pl81QxqPPFtv5aaY19s7eRazlgIzeWgdz6TH3jksf/iOnqS/e7WB6ts+znip3MVeQAKDN5BCxWI7vrhDpHLMixywg87FKX+e+ycG5wIP9wV7U3V4f8EzmVHMVMNw2CGUElYAQOikEl0AQ8DpsysM2vqNvE8mp6aNUmXanUbU2Eco+gUiueldbEszs+uNfEUgKpoSzj1AtiB3KcL+mhVZsc1D4Ele0UBXQk+zpsUl9XlEnkC6gXsc2fi53sAYcd9SvycXBEyuVo4NygDk2rHA7tOLiPJdcrQy767PIV0kQiqLelVUtDGtQnUq4uBVYoAeVrK4UqICoB5HcldoqVD5z4UZa8Fav9mgYlzlOxr6QUyqYH7pZCWzcWigU/3pnJmOdtVACP3YjHR/W6Otbv+adgdS6Wzq1NHuQ61ikDM5lMJpPJZDKZTKYavwBaCM+C17cvVwAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHcAAAAbCAYAAABGDxCrAAAFaklEQVR4Xu2Ze6jlUxTHv/LI+51HlPFKeeQZyaNbhMkzjMdQij8YjyYmZKRGEkMj7yLCHx6TaSiJhjioaWIyyKuRQiIJEcIfWJ/WXn777Ps7Z87v3Nudcc/vW5/OPXv/zu+391prr73270qtWrVqtYkx39i97GjVWKcbJyUmTesljjCWGCuMlcZ7xjnG+tWlXdrQuM84LX2faSw23k0ckNqno/ZKTKaw58LE4UXf0Gqd21z/C+duazyTeMzYMutj8J8Y18mdX+pM40Fjg/R9c2OO8Vvi0NQ+3bSj8XmCv2GyFEGzzNi16GukrYxXjYcTRE6pC4w/jSOLdn77Sk07Dv0qMV2dSzBfbFwtt1md3YZVZNH7jeuLvoHFgHAoK7Nf9OEgVuE1RfvxxnJjm6J9FJw7FcK+b8oXUWNRkf1tXFl2FArnllF0q/FI0YZ6OXdn4yZ5QM1L33Ntb+yW2vdOUIkfbeyZOC61IbaPufJt4ezUzoqCsdR2lrG/cZGa74+RHm+WP+N849TUR23C/c8ztk7k7TlnyOeWax/jjgQ2qtvySMnUPAeWHWvSxsaLxk/yyfcT++o/6nYuBqTwKh2O6py7i/GFsUhenGGob+VFQxQOXHOtfAtgv6EYw2EY9ucEQUHbYcbHxonGpvIgeyr1AYG7yvjDeMB4TtX+OIgONp5PUJMw5gtVBfOxxlvGl/JgjEB9Qm5XnH6IsdRYLQ/aSLfM4XW58wge5jGbHxfaQv6MCKiBxY2/lv+Ym/TTvXLnUgmHKJw6qn9wnXO5/lnjqux7R26sfPUTNE8bL6taoQQCxgJEO/0UfxHxPOc7+SoHROARQHsYRxmnqH6F1IlxEmDAWNEO8uALXarxzqXK5XmIrEHG4xOxiOAHVacLxDjf0fjtLWxUt4D6KlLtk+o/YSKdPflD+eRCTZ0bYv84wbjN+F4e6ZCLif8i/y2OvEfdNQFpin6OalEIMg9WPOOJMfUy2iBi5ZLV4C950cnqioBDPCd3LtlwVrpmP/n8blFlX2oWYCskk8TYCaC4T66hnRsGKg1bilTEYPjM1dS5TPhO41N5mmciHdU7NwJqgbwSn9/V27sGKEV/R9XKa6p9E4/LswLZKz9RlM4NxQkE+JvtBhgPDHpEbJ3bRyPrXKq3j9R/8jPkRUg+oVA8mH2nVJ1zL5HvNew5KH4fzqWwoHAJLZA7mJSMg3NFcUa1nou0GKCJOJcUfEwidLK8Tonqtc65pOAb5CmZ1IzmyOsAthtg+4i6IETdU74FDBvxnqGxLjN+V/cEQjOMt+VFy2bdXf8Jp5SrCnE++zERzsURGIZCDsXqDOcyljyaCQL2u7ywyjXP+Ew+ToRR58oDIYJhIs7lt7xEAO6NGHtHHlyozrk4Ly+iGPti+dwYB7DHYtdYMKzuRekzV9gIezYWN79RnnJis+dcdrfxgfq/U0as2iWqXj0inIRTSWHA37RhmOXGa8YV8uMNFWkccaiQ88mx+l5QVSGXirGvNh6VG5DxhAF5lUohxBi+kY+hiaiK3088JD8nM57L5c6+y/hVfn/GACwSrmdlUuCRlpl/VOyhnYyXjDfkWZHj0kFZf4gMsVJVMA0ljDGW4MDNy4J+Tg2xulap2b/6OOxvp2o1bJSI7yEChtVO9PYTTuaaSMVr0kxVVWovbpevRGwA3JtnlFvTRIXdOYH0sjXBmh/3plQ4AGOUxdawIlJXpE/SGKl3FEUqB7JiWW9MqXjzwiDyM/CwGpPvs7PlLza49yjq3ASni7WyanPx+nChJp62mAirlkIl/7fjKIkKmz0eygJrrYmKeqLObVXZcZ2yZevcydE66dxWrVq1atWq1Xj9C7T4RgxCfse7AAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAAAbCAYAAAC0n4dLAAAFmklEQVR4Xu2ZeajmUxjHH6HIbuxL7rWMMKJsjSxTCGEwWQr/SSSlyJ4/1ChDlpAtS5IsTZZshXINDXFDwpQlKSWEEsrI8nx6ztPv/J73vO/cd7nvveV869PM+zu/9/zOec73d87zvFekqqqqalTaWLlWmYwNVbOiU5UTEiPTeonDlJXKu8q08pFylrJ+c2tLGyp3KUtjw5g1odydYMy3tVp763zlOeUtZbvQNoyI2aHK5rFhSBHzFQn6H4mqAf7HBthaeTLxiLQHvKeyRrlSzCBRy5R7lA1iw5hFUBYmPlQebTf31JbK7co3yo6hbRidqPyrPBgbRiDWBV5VdgltfWkL5XXlgQSBjDpX+VNZHK7z3dcK1+dKmyampD8DoFNk9AbYVlmuHBMbRiDfsdnxrgptMxaLzaLzhm+fKOkg5XflsnD9WGW1slW4PleabwYYh1iDVWIvY98ii/xHuSQ2BLkBotNulM7tbR/lDOX0BAPj+1QJJ4tVDJuIBZxrcIB0Hi/cd46YQS9NLGjdYdpVuTCxb2JKOg2wt3JzgvFA/sxBDMD36cf7vVPsSDxabPwcAcSCvhHHJCxJ13NOEouLy/Mx+rxBbLsvie2fnIcY9qWNlJeUX5RFoS2KSXGW5QZgIiSL0RT7K0+L9QvkFMcre4glWc8r94oZBffCj8pxfDlpN+UNsQDynAMT7DYHp3sIEMb9TCxQBOLqxFppDMB9l4v1xz0Eku8ABnMNYgASXwzKYgM76vViMeHzBWJz87H4DsVYHlZOE0viSLY5hnlZ6AOI0WNi+djhytfKEdKpzcTi6iabsQjGt2JfppNewoUYgAVx+VZbejDXuB/IH1y87T8oe6XP+ZbNboII3AtiZ1vcFQgs1YnvKj9LuxYuHQGY+ydpVyn0A+9Lc3wNYoD7EmT7XiXxAvic/SWLBiDh5LnMj+SaeXg27/U915gj4j5eJF64mGz7fOOLuE75tv64dAY6F3kBOcIn0i6R1mUA+gafBGKQueFKC8bOwIKVJkS/HFnsGuQjv0p76yv1x31851lpEl0yZ8gXfBADYKq/ld8SLBBbeV4yMw4fC9UGnCkWc3a9v5TzUjviSAWSbtbGxzwtNi/ml2tgAxA4AuiD6yYGRwDzQaJBDTAlzSRKC9Yt30C+s/Avb15csFJ/9BPHUdIgBmARjxJbeMAEjC8vmXMD5OKY+1yayoujiXLc75/pWKoBsvZSf9UAXbSN8qmUtxXXhPKVlH8f8AeTfUcNY4BJsdyEfCGKs9X75Lmx/1J/bNNsp90SKN+uBzEAyeXC7DOLfrHyhTQldckAxJIzPT9Wlyu7S5OffJc+u+ib8bqxXD7fPNeasS5S/lCOjA1ii/+e2EDz8iQXEyst1DAGYIK8QVzz2tYzY6oLNyNJ7Bppl7ATCUzr/dE/5z3zcBPTL9ya/kUYql8D8Iz8+egQsSTW51gyAMbJEz/M8rLYs5mXz+0aaRZ8QixRjkkg3+Ve8qK+RUCuU74XS5aAmvQO5WPp/TcARNBWSntQmIrJeRXA/68Q+5l5bbpGCYZjvRzjGm3+W7yPiyydBZ9KMK7cjJSG1MBUKSyE/5z9pVif74j1t4PyivKmWH/PJPg+4u8Gvn1Tpcw0mJRyb4tl9cDfFHgG1RLPXS2WJMJT0pSzxJvyEFNS1fDsvCJBJMMfKC8qDylPSPknX47yaWXn2NCPcOuSBLUpNXuvhXctEvvdfTI2jEgYAYdTTkFJjJNgk13ztsACKd/PPLk3L9tKYgE9++7GTcpOYs/zncz7HqWYF/PxnSCKlxAjdWufVfHmE4yYIFbNvvzHJ3bgxaFtrCKbZRCezFSNR2cnbpE5evtzkcyskM5KoWp2tJ9yf8KT2DkXyVk1wHjksZ5X8a4GGJ/mpQGqqqqqqqqq5r/+A/EcaCu0HiyPAAAAAElFTkSuQmCC>
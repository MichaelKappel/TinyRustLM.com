# Executive Summary

Building a lightweight AI runtime in the browser with Rust+WASM can enable **fast on-device inference**, **privacy-preserving AI**, and **offline-capable apps**. By compiling Rust libraries and ML models to WebAssembly, we can run neural networks entirely client-side without server calls. For example, Firefox’s on-device link summarization uses a 360M-parameter LLaMA model in WASM to ensure user data never leaves the device. Modern efforts like **WebLLM** show that even ~7B-parameter models can be quantized and executed in-browser using WebAssembly and WebGPU. However, this approach requires careful design: choosing model formats (ONNX, GGUF, etc.), employing aggressive quantization (4–8 bits), leveraging CPU SIMD and GPU backends, and managing browser constraints (limited memory, threading, security). We must weigh trade-offs (speed vs. size, compatibility vs. complexity) and use the right Rust/WASM toolchain (e.g. `wasm-bindgen`, `wgpu`, `tract`, `wonnx`). This report reviews goals/use-cases, target models, formats, quantization, runtime design, tools, performance tuning, deployment, ergonomics and legal issues. It also presents a comparison of Rust inference crates, a sample architecture (with Mermaid diagrams), a prototype plan, and a benchmarking methodology.

## Goals and Use Cases

- **Privacy-preserving on-device AI:** Inference happens entirely in the browser, so sensitive input (user text, images, documents) never leaves the device. This mitigates data leaks and surveillance (data doesn’t go to a cloud API). For instance, Firefox’s Reader View runs an LLM in WASM on-page content to generate link previews, explicitly “to ensure user privacy”.
- **Offline / Low-latency inference:** Without network round-trips, response time can be much lower. On-device inference is “faster” and “works offline” since no internet is needed. This enables apps like offline summarizers, translators or recommender systems. No server costs or rate limits are involved.
- **Personalization and responsiveness:** Local models can adapt to user data easily (user-specific models, cache embeddings), and UI remains responsive if compute is offloaded to WebWorkers or GPU. WebWorkers can run heavy inference without blocking the main thread.
- **Lightweight AI and embedding tasks:** Even small models (hundreds of MB or less) can run for use-cases like semantic search, chatbots, audio transcription (e.g. Whisper-tiny), vision tasks (image classification/detection), etc. Embedding-based search on page content, real-time vision filters, or simple chatbots are realistic.
- **Evidence from existing projects:** Projects like **WebLLM** emphasize “client-side and in-browser inference”, with a “privacy-first” ethos. They showcase use cases from full chat agents to on-device assistants. ONNX Runtime Web’s docs also list benefits: on-device inference is faster, safer (privacy), offline-capable, and cost-saving.

## Target Models

- **Transformers (NLP and audio):** Many in-browser AI demos use transformer-based models. Size can range from *smaller language models* (~100–500M parameters, e.g. DistilBERT, GPT-2) to *mid-size LLMs* (~1–5B). For example, a 360M-parameter LLaMA variant runs in Firefox. High-end use-cases might push ~7B models (quantized), as seen in research stacks. Audio models like Whisper Tiny (~39M) or full Whisper (~1550M) are possible with quantization or on powerful devices.
- **Vision CNNs:** Classic convolutional nets (e.g. MobileNet, EfficientNet) for tasks like image classification/detection. These often range from a few MB (tiny CNNs) to ~100MB (ResNet50). Many are convertible to ONNX/TensorFlow Lite. WebGPU can accelerate moderate CNNs (MLPerf client suggests vision benchmarks on CPU/GPU).
- **MLPs and Others:** Simple MLPs or smaller networks (for tabular or simple tasks) are trivial for WASM. Even exotic models (graph neural nets, etc.) can in principle run if the compute kernel is implemented.
- **Embedding models:** Encoders that output vector embeddings (e.g. Sentence Transformers, CLIP image encoders) are useful for search, recommendations, or vision-language tasks. Many embedding models are under 500M and can be quantized (some even come in 110M variants).
- **Size considerations:** Browser memory is limited (often <4GB). Pre-quantization, expect models under ~1–2GB; post-quantization, even large models (multi-billion parameters) can fit (e.g. 7B→~3GB). The wllama docs warn of a 2GB ArrayBuffer limit for a single file, recommending splitting larger models. Smaller models (<100MB) will load quickly and suit low-end devices.
- **Architecture trade-offs:** Transformers are heavy but popular; CNNs usually smaller and benefit from SIMD/GPU; MLPs are tiny. The runtime should ideally support various architectures (ONNX covers many graph types; GGUF/GGML covers certain LLMs; TFLite covers many mobile CNNs). 

## Model Formats

- **ONNX (Open Neural Network Exchange):** A widely-supported format for many model types (CNN, RNN, transformer, etc.). ONNX is framework-neutral (export from PyTorch/TF, etc.). It has full operator coverage via runtime engines. Pros: standard tooling (ONNX Runtime, tract, wonnx), support for quantization (8-bit via ONNX QDQ or QAT). Cons: ONNX spec doesn’t natively support 4-bit quantization (some workarounds exist). ONNX models can be large; using them in-browser often requires optimization (e.g. prune unused ops, optimize graph). Also, some ONNX ops may not be implemented in every backend (WebGPU/WebNN support can be partial).
- **GGML / GGUF:** Formats used by *llama.cpp* and allies. GGML was an earlier C-lib format; GGUF (new “GPT-Generated Unified Format”) is the modern standard. It bundles weights and all metadata. GGUF supports many quantization schemes (4-bit, mixed precision, etc.) in one file. Pros: very efficient for LLMs with native quantized weights, easy distribution (one file with config). Cons: Mainly designed for transformer models (LLaMA/GPT-like); less support for CNNs or outside that ecosystem. Fewer runtimes (llama.cpp, llama-rs, etc.). Good for offline LLMs with CPU/GPU inference.
- **TFLite:** The TensorFlow Lite flatbuffer format (typically used on mobile). Some in-browser runtimes (TensorFlow.js with WASM/WebGL) can load TFLite. Pros: built-in support for 8-bit quantized models (int8). Cons: Not widely supported by Rust WASM libraries (no major Rust crate for TFLite in browser). Also not as generic as ONNX.
- **WebNN Model Format (WNNA):** A new proposal to standardize models for the Web Neural Network API. Still evolving; currently experimental. Could be an option for future.
- **Custom or JS-friendly formats:** For very simple models one could embed weights directly (e.g. JSON or binary arrays) in the WASM or JS. This is heavy to code and not scalable, but possible for toy models.
  
**Recommendation:** For broad support, ONNX is a strong choice (with runtimes like wonnx or ORT Web). For LLMs specifically, GGUF/GGML is ideal (as many models exist and tools like wllama accept GGUF). TFLite is niche (if targeting specifically TF models). Use FFmpeg or Python tools for conversion. For quantized LLMs, use GGUF (with llama.cpp) as primary format; fallback to ONNX for other networks if using ONNX-backed runtimes.

## Quantization Strategies

- **8-bit integer (INT8):** The most common quantization level, converting 32-bit floats to 8-bit (signed or unsigned). This reduces model size ~4× and can leverage SIMD or Tensor cores. Accuracy often degrades only slightly if calibration is good. ONNX Runtime supports 8-bit quantization via QDQ (quantize/dequantize nodes) or QAT. TFLite also has int8. In-browser, 8-bit is widely supported (WASM SIMD can pack int8 ops, WebNN/WASM).
- **4-bit (INT4):** Even smaller (2× smaller than int8). This often uses specialized schemes like GPTQ or AWQ on LLMs. It requires custom kernels to unpack 4-bit (e.g. two values per byte). The GGUF format has Q4 variants. It can significantly speed up inference on CPU by reducing memory bandwidth, but may lose more accuracy. It also complicates GPU use (need custom WebGPU shader to decode). Projects like llama.cpp and wllama recommend Q4/Q5 for LLMs for a good speed/quality balance. 
- **Mixed precision / FP16:** Using half-precision floats (16-bit) or bfloat16 can double model storage vs FP32 with minor precision loss. This is mainly CPU/accelerator convenience if supported. WebGPU and some JS engines (WebNN) support float16. ONNX runtimes often use FP16 if hardware allows.
- **Recommended approach:** For LLMs, use *per-channel* quantization (4- or 5-bit) on large matrices, and maybe keep critical layers in 8-bit or FP16. The wllama docs advise Q4–Q6 for optimal trade-offs. For CNNs/MLPs, 8-bit post-training quantization or QAT is typical. Use tools: PyTorch, ONNX Quantize, or llama.cpp’s `quantize` tool (for GGUF).
  
**References:** The GGUF format article notes quant schemes “from simple 4-bit to sophisticated mixed-precision” and shows how quantized LLMs (e.g. 7B) run on laptops. The wllama docs similarly recommend Q4/Q5/Q6 quant for browser LLM inference. We will plan to quantize models offline (Python or CLI) before loading in the browser.

## Runtime Architecture

- **WebAssembly (WASM) Core:** The neural net inference engine is compiled to WASM (target `wasm32-unknown-unknown`). Use `wasm-bindgen` or `wasm-pack` to generate JS glue. Rust crates (like tract, tch-rs, ggml-rs, or wonnx) form the core logic. WASM SIMD (128-bit vector ops) should be enabled for CPU speed. For example, wllama’s WASM build uses SIMD to accelerate LLaMA inference. Build with `RUSTFLAGS=--cfg=target_feature=\"+simd128\"` or similar.
- **Web Workers:** Heavy inference must not block the UI. Use one or more WebWorkers to run the WASM code. Workers can be spawned from JS/TS using `new Worker(...)`, loading a JS glue script (wasm-bindgen) or using libraries like Comlink for RPC. The main thread handles UI I/O, while workers run inference loops. Example: wllama spawns a worker for inference, and Mozilla’s 3W stack assigns a Rust worker per agent.
- **Memory:** WASM memory is a SharedArrayBuffer only when cross-origin isolated. When using threads or sharing memory between workers, you must serve the page with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. This enables `SharedArrayBuffer` and WASM threads. Without cross-origin isolation, only single-threaded WASM is possible. Chrome now requires cross-origin isolation for `SharedArrayBuffer`. Our prototype should set these headers (or use localhost with `file://` for development). 
- **CPU vs GPU:** 
  - *CPU path:* If GPU is unavailable or disabled, use pure WASM. SIMD will vectorize many operations, but the browser restricts thread count. Still, reasonable throughput can be achieved for small models. Because WASM has overhead, it’s slower than native C; multi-threading helps. WebAssembly threads (via `Atomics.wait`) can spawn multiple threads to parallelize matrix multiplies.
  - *GPU path:* Leverage WebGPU (via the Rust `wgpu` crate) for matrix multiplies. We can compile compute shaders for layers. Examples: wonnx uses WebGPU to run ONNX graphs on GPU; wllama v3 introduced WebGPU offloading of layers. In practice, one might load some layers to GPU (limited by VRAM) and do the rest on CPU. Fallback to CPU if WebGPU unsupported (check `navigator.gpu`). Note WebGPU is still maturing (call [17†L194-L202] warns about limited support).
- **Browser concurrency limits:** Browsers impose practical limits on threads/workers (mostly by CPU count and memory). There’s no fixed “max threads” but over-spawning may slow down due to scheduling. Typically use `navigator.hardwareConcurrency` to size threads. Each WebWorker is a JS thread with some overhead. A balanced approach: for CPU inference, use up to (cores-1) threads; for GPU, only one thread orchestrates GPU calls. Concurrency is constrained by needing cross-origin isolation for threads. [30] explains how WASM threads use Web Workers and `SharedArrayBuffer` under the hood (relevant for thread design).
- **Security/Sandbox:** WASM and WebGPU run in the browser sandbox, so untrusted code can’t break out. Serving models from allowed origins (via CORS or same-origin) is important. If using `wasm-bindgen`, avoid `unsafe` in Rust code. Using workers requires careful message passing (use `postMessage`/Comlink).
- **WASI:** Not relevant in browser. (WASI is for system calls, used in WasmEdge or node, but browser can’t use WASI-nn yet.)
  
## Rust Toolchain and Crates

- **wasm-bindgen / wasm-pack / target:** Use the `wasm32-unknown-unknown` target with `wasm-bindgen` to expose Rust functions to JS. `wasm-pack build --target web` automates this. Set `RUSTFLAGS` for unstable Web APIs (e.g. `--cfg=web_sys_unstable_apis` for WebGPU in `web-sys`).
- **wgpu:** The primary Rust crate for WebGPU, works in native and WASM contexts. Use it to run compute shaders on GPU. `wgpu` abstracts Vulkan/Metal/DirectX/WebGPU. Example: the Burn framework added a new GPU backend with `wgpu`. HuggingFace’s Ratchet (in progress) is built on `wgpu` for browser inference.
- **web-sys / js-sys:** Low-level bindings to browser APIs (DOM, WebGPU, fetch, etc.). E.g. use `web_sys::window().fetch_with_str(...)` to download model shards. `js-sys` for generic JS interop (e.g. `ArrayBuffer`).
- **ndarray:** A Rust crate for N-dimensional arrays (like NumPy). Good for CPU tensor ops if not using a full framework. Can work in `no_std` contexts. However, it is pure Rust and likely slower than specialized kernels. Useful for simple MLPs or for reference.
- **tch-rs:** Rust binding to libtorch (PyTorch C++). *Not suitable for WASM,* since libtorch is large C++ and not compiled to WASM. Best avoided in this context (tch-rs is great for native server inference, but not browser).
- **tract:** A pure-Rust inference engine supporting ONNX (and TensorFlow) models. It can compile to WASM easily. Pros: works without C libs, good ONNX operator coverage. Example usage: `tract-onnx = "0.18.0"` can load ONNX and run inference. Cons: performance may lag highly-optimized runtimes, and lacking GPU. A candidate for CPU-only fallback. (tract does not use WebGPU.)
- **ggml-rs / llama-rs:** Rust bindings around llama.cpp/ggml. The `llm` crate (now deprecated) and `llama-rs` (onehr) aimed to run LLaMA models with Rust+GGML on CPU. These require including the ggml C++ library at build time. They are CPU-only. Useful if you want LLM support via GGML. However, `llm` is archived and unmaintained, so caution. Newer alternatives (mistral.rs, callm, etc.) might be better.
- **burn:** A Rust deep learning framework (like a mini PyTorch). It now has a `burn-wgpu` backend for GPU (using `wgpu`). Burn can export to ONNX or run models defined in Rust. It supports quantization workflows. Pros: high-level API, cross-platform, GPU support. Cons: still evolving; WASM support via `no_std` build might be possible. Useful for building custom models or leveraging its ecosystem.
- **ONNX Runtime (ort):** Microsoft’s ORT has a JS/Web build (`onnxruntime-web`) which is not Rust-based. There *is* an `ort` Rust crate for native, but it doesn’t compile to WASM. So in-browser, you’d use ORT via NPM, not Rust. We mention ORT as context but it doesn’t fit “Rust WASM” without a wrapper.
- **Other & Interop:** All Rust crates used in WASM must be `wasm32`-compatible (no threads unless cross-origin isolated, no file I/O, etc.). Use `fetch` or `web-sys` instead of `std::fs`. For async model loading, use `async fn` + `js_sys::Promise`. Example: use `reqwest::Client::new()` is not supported; instead use `gloo::net::http` or `web-sys`/`wasm-bindgen-futures`.

**Comparison (excerpt):** Below we will summarize key crates/toolchains:

| Crate/Toolchain  | Model Support    | Backend    | WASM Support | Pros                         | Cons                        |
|------------------|------------------|------------|--------------|------------------------------|-----------------------------|
| `wasm-bindgen`   | n/a (tooling)    | n/a        | ✅           | Standard Rust→WASM bridge    | Verbose JS glue             |
| `wgpu`           | Custom (e.g. ONNX or GGUF via compute shaders) | WebGPU  | ✅           | High performance GPU compute | Write shaders manually      |
| `web-sys`/`js-sys` | n/a            | n/a        | ✅           | Low-level web APIs           | Low-level, verbose          |
| `ndarray`        | MLP/CNN/Tensors  | CPU        | ✅           | Easy math ops in Rust        | Slower than SIMD/GPU        |
| `tract-onnx`     | ONNX models      | CPU        | ✅           | Pure Rust ONNX runtime       | No GPU, limited quant ops   |
| `ggml-rs`        | GGUF (LLM)       | CPU        | ✅           | Rust LLM support (GGML)      | Limited ops, no GPU        |
| `burn`           | PyTorch/Tensor   | CPU/GPU    | maybe (WASM) | Full DL framework, wgpu GPU  | Still new, heavy for WASM   |
| `wonnx`          | ONNX (GPU)       | WebGPU     | via JS      | GPU-accelerated ONNX (Rust)  | JS interop needed           |
| `ratchet` (HF)   | Whisper, LLMs    | WebGPU     | WASM (work-in-progress) | Designed for web, quant. | Pre-release, incomplete     |
| `Llama.cpp (C++)`| GGUF/NNGP        | CPU/GPU    | via Emscripten | Mature LLM runtime, quant   | C++ integration in WASM     |

(*Sources:* Wonnx’s docs, wllama README, community reports.)

## Model Loading & Memory Management

- **Chunked Downloads:** Large models (hundreds of MB) should be split into smaller files (e.g. <512MB) and loaded in parallel to speed up and avoid browser memory spikes. The wllama docs strongly recommend splitting into ~512MB chunks, both for faster parallel downloads and to avoid out-of-memory issues. The same doc notes a **2GB ArrayBuffer limit** in many browsers, so models above that must be sharded.
- **Progress & Lazy Loading:** Use XHR/fetch with progress callbacks to load each shard, displaying a progress bar in UI. Defer loading until needed (e.g. lazy-load model when user initiates a query, not at app start). The WASM API can concatenate `Uint8Array` segments into one `ArrayBuffer`.
- **Memory Layout:** Once weights are loaded, map them into WASM memory buffers. Avoid copying data unnecessarily. If using a WebGPU path, you may upload weights to GPU buffer or texture memory. After upload, free the original ArrayBuffer if no longer needed.
- **Caching:** For repeat use, consider storing model shards in IndexedDB or Cache Storage (via Service Workers). This avoids re-downloading on page reloads. Example: after first load, `indexedDB.put('model-shard', data)` then `indexedDB.get` on subsequent runs.
- **Session Management:** After inference, free intermediate tensors to avoid memory leaks. Some APIs (like wonnx’s JS wrapper) require explicit `session.free()`. In Rust, ensure RAII (drop) of large buffers or call methods to release GPU memory. 
- **Worker Scope:** Each WebWorker running inference should ideally have its own WASM instance and memory. Shared memory (if using WASM threads) can coordinate weight loading among threads (but complex). Alternatively, load model in main thread and post it to workers via `postMessage` (copying ArrayBuffer or transferring it, if SharedArrayBuffer is not used).
- **Example Code (Rust + wasm-bindgen):** 
  ```rust
  // Async load a model shard via fetch:
  let resp = wasm_bindgen_futures::JsFuture::from(web_sys::window().unwrap().fetch_with_str("model-0.bin")).await.unwrap();
  let resp: web_sys::Response = resp.dyn_into().unwrap();
  let buffer = wasm_bindgen_futures::JsFuture::from(resp.array_buffer().unwrap()).await.unwrap();
  let bytes: js_sys::Uint8Array = js_sys::Uint8Array::new(&buffer);
  let rust_bytes = bytes.to_vec(); // now have Vec<u8> in Rust
  // Pass rust_bytes to model loader (tract or wonnx, etc).
  ```
  
## Execution Backends

- **CPU (WebAssembly + SIMD):** The simplest approach is to run on CPU via WASM. Use SIMD (as above) to speed up matrix ops. For example, wllama’s WASM build uses SIMD and auto-switches single vs multi-thread based on browser support. All operations (GEMM, activations) run on CPU. This works universally (browsers without WebGPU).
- **GPU (WebGPU Compute):** Offload heavy linear algebra to the GPU. WebGPU supports compute shaders for operations like matrix multiply, convolution, etc. Frameworks: 
  - **Wonnx:** a Rust crate that compiles ONNX graphs into WGSL shaders to run via WebGPU. Example (JS): 
    ```js
    import init, { Session, Input } from "@webonnx/wonnx-wasm";
    await init();
    const session = await Session.fromBytes(modelBytes);
    const input = Input.new().insert("x", [13.0, -37.0]);
    const result = await session.run(input);
    ```
  - **WLLama/WebLLM:** supports WebGPU by offloading some transformer layers (in Llama.cpp/WASM). 
  - **Burn-WGPU:** Burn’s new backend runs on `wgpu`; can be compiled to WASM too.
  - **Ratchet (in dev):** designed as WebGPU inference for web, using quantized models.
- **WebNN / WebGPU API:** ONNX Runtime Web also supports WebNN (experimental) and WebGL, but in Rust we focus on WebGPU. (WebNN is an upcoming browser API for ML that hardware vendors support; not mature yet.)
- **Hybrid:** Some tools let you specify how many layers to run on GPU vs CPU. For example, wllama’s config `n_gpu_layers` controls offloading layers to GPU.
- **Fall-back:** If WebGPU not available (older browsers), fall back to CPU path. Many runtimes auto-detect with `if (navigator.gpu)`.
- **Precision on GPU:** If using WebGPU, note it natively uses 32-bit floats in WGSL compute by default. To use 16-bit, explicit code is needed. Quantized weights (int8/4) must be unpacked in shader code or preconverted to 32-bit on GPU. This adds complexity.

## Threading and Concurrency Limits

- **SharedArrayBuffer & WASM Threads:** With COOP/COEP headers, WASM can use threads (pthread-styled) via `SharedArrayBuffer`. You can spawn threads (through `#[wasm_bindgen(thread)]`) and use Rust’s `std::thread` or rayon for parallelism. However, all threads share one linear memory, so ensure `wasm_memory` is created with `shared:true`. Browser support: Chrome requires cross-origin isolation; Firefox supports SharedArrayBuffer by default; Safari support is limited. WebWorkers themselves do not require cross-origin isolation if they have their own memory.
- **Worker Communication:** If not using threads, use multiple **WebWorkers**. One can load a single WASM instance (with its memory) per worker. Offload independent tasks (e.g. batch inputs) to different workers. Communicate via `postMessage` or Comlink. But sharing large model data among workers is tricky without SharedArrayBuffer (would have to copy or transfer).
- **Limits:** Browsers do not hard-limit WebWorkers, but CPU cores and memory do. Overusing workers can degrade performance. Practical advice: start with 2–4 workers or up to `hardwareConcurrency`. Also mobile browsers are more restrictive. Each worker incurs overhead (~500KB for the script + memory). 
- **Interaction with WebGPU:** Only one worker should create the WebGPU context (navigator.gpu.requestAdapter must be called on main thread or same origin). It’s best to do GPU calls from one thread to avoid context issues. Other workers can send data to the GPU thread.
- **Concurrency pitfall:** Without isolation headers, `SharedArrayBuffer` is disabled, so WASM threads won’t work. In that case, only single-threaded WASM is possible (like wllama’s fallback). 

## Security and Sandboxing

The browser provides a secure sandbox: WASM code runs in a confined environment, cannot access local files or network except through the provided APIs. This means:

- **Safe execution:** Arbitrary model weights (just numbers) cannot maliciously execute code. The WASM runtime enforces memory safety.
- **CORS and COOP/COEP:** To enable threads or use resources from other origins, appropriate CORS/COOP/COEP policies must be set. Models fetched from other domains need CORS headers.
- **Content Security Policy (CSP):** If your site has a CSP, you’ll need `script-src blob:` or similar to allow WASM workers.
- **Sandboxing GPU:** WebGPU is sandboxed by the browser; shaders cannot break out of bounds. Still, GPU access should respect user permissions (some browsers might require user gesture for WebGPU).
- **User Experience:** Running heavy inference can freeze the page if not handled properly. Use workers and yield to event loop. 

## Performance Optimization and Benchmarking

- **SIMD & Parallelism:** Ensure WASM builds use SIMD (`+simd128`) and multi-threading (if allowed). Optimize hot loops (e.g. use `ndarray` with explicit parallel iterators, or let tract optimize matrix ops).
- **Quantization:** As noted, lower precision drastically cuts compute and memory. Benchmark both float32 and quantized versions. Quantized GEMMs can be ~4× faster/memory-sparse.
- **WebGPU Tuning:** Profile GPU usage via Chrome’s GPU profiler. Minimize data transfers between CPU and GPU. Use `wgpu::Device::create_command_encoder` efficiently.
- **Memory layout:** Use native memory order (row-major vs column-major) that suits your compute kernels. Pre-allocate buffers once and reuse them to avoid GC.
- **Lazy vs Eager:** Post-load, reuse the WASM module and memory for multiple queries (don’t re-instantiate on every call). Warm up the GPU pipeline (first run might include shader compilation).
- **Benchmark Plan:** To measure performance, we should design a suite of tests. For example:

  1. **Test Matrix Multiply (CPU vs GPU):** Compute average time to multiply two 1024×1024 matrices using WASM+SIMD vs WebGPU, varying number of threads. Plot results.
  2. **Test LLM Inference:** For a fixed prompt, measure tokens/s for a 360M vs 1B model on CPU (1 thread, 4 threads) and GPU (if possible). Measure 1st-run and steady-state.
  3. **Test CNN Inference:** Run a MobileNetV2 ONNX model on CPU vs GPU and measure fps for processing a batch of images.

- **Benchmark Metrics:** Report latency (ms per inference), throughput (samples/sec), and memory use. Also monitor JS event loop lag to see if UI is blocked.
- **Visualization:** A sample benchmark chart might show inference time vs model size:

  ```mermaid
  %% Inference Time vs Model Size (Hypothetical Data)
  barChart
    title Inference Time vs Model Size (CPU vs GPU)
    x-axis Model (millions of params)
    y-axis Time (ms per batch)
    "100M CPU": 120
    "100M GPU": 30
    "500M CPU": 600
    "500M GPU": 80
    "1B CPU": 1300
    "1B GPU": 200
  ```

  Here we’d see GPU much faster for larger models, and CPU times growing quickly.

*(See our **Performance Benchmark Plan** below for details.)*

## Packaging and Deployment

- **Bundling:** Use `wasm-pack` or similar to produce a JS/WASM package. You can publish an npm package or simply include the `.wasm` and `.js` files in your web app. Tools like Webpack or Rollup can bundle the JS glue.
- **Lazy Loading:** Don’t load the WASM binary until needed. For instance, dynamic-import the module when the user starts inference. This keeps initial page load fast.
- **Service Workers:** Use a Service Worker to cache model files and the WASM binary. This makes repeat visits instantaneous and works offline. For example, on first install, the service worker can prefetch and store shards.
- **CDN vs Local:** Host large model files on a CDN or the same origin for performance. Ensure the model hosting supports byte-range requests or parallel fetch if splitting.
- **Size Minimization:** Optimize the WASM binary size (e.g. `wasm-opt -Oz` with Binaryen). Strip debug info. Compress with gzip or brotli on the server.
- **Example Deployment:** 
  - `wasm-pack build --target web` produces `pkg/` with `my_runtime.js` and `my_runtime_bg.wasm`. 
  - In HTML: `<script type="module"> import init, { run } from './pkg/my_runtime.js'; await init(); ... </script>`.
  - For React/Vue, load as usual module or via `create-react-app` which can import WASM.
  
## Developer Ergonomics and JS Interop

- **API Design:** Expose a simple JS-friendly API from Rust. For example, a `process(prompt: &str) -> String` function. Use `#[wasm_bindgen]` to export functions/classes to JS.
- **Type Conversion:** `wasm-bindgen` will auto-convert strings, arrays, structs between JS and Rust. For large tensor data, consider using `Uint8Array` (binary) or `Float32Array` and sending pointers.
- **Async in Rust:** Use `#[wasm_bindgen] async fn` to allow `await` in JS. For example, an async `load_model()` function that fetches weights using `web_sys`.
- **Error Handling:** Return clear errors/exceptions to JS. `wasm-bindgen` will throw JS exceptions if Rust panics or returns `Result::Err`.
- **Platform Differences:** Be mindful that code running in Node (SSR) vs browser might differ. Likely target only browser.
- **Tools:** Use `wasm-pack` (with `--dev` for debugging) and `cargo-watch` to recompile on save during development. Use `console_error_panic_hook` to get Rust panic messages in the browser console.
- **TypeScript Declarations:** `wasm-pack` can generate `.d.ts` files. This improves TypeScript interop. If writing a TS front-end, import the Rust module using `import { run } from 'my_runtime'`.
  
## Licensing and Legal Considerations

- **Model licenses:** Ensure your chosen model weights are compatible with client deployment. Open models often have CC-BY, MIT, or commercial licenses (e.g. LLaMA via Meta license, Mistral Apache-2). Check if “derivative works” or usage restrictions apply (some models forbid commercial use). Quantization/compilation typically counts as transformation but read license terms.
- **Rust crates:** Most mentioned crates are MIT or Apache-2 licensed (e.g. wgpu, tract, burn, wonnx). ONNX Runtime is MIT. GGUF/llama.cpp is MIT. Ensure compatibility with your project.
- **WebGPU Permission:** As of now (2025-26), WebGPU is enabled by default in major browsers (no special permission needed). No end-user consent is needed for inference, unlike camera/microphone.
- **Export Controls:** AI models might be subject to export laws in some countries, but typically big tech handles that. For typical open weights it’s not a major user concern.
- **Privacy Law:** Ironically, on-device inference is privacy-friendly, but if processing user data (text/audio), still consider any legal privacy rules (e.g. GDPR) if storing or analyzing sensitive content (though it never leaves device).
- **Security:** No specific license issues, but hosting the model file means you must secure it (HTTPS, not exposing users to malicious files). 
  
## Comparison of Candidate Crates/Toolchains

| Crate/Toolchain   | Language    | Target    | GPU Support | Key Strengths                              | Weaknesses                           |
|-------------------|-------------|-----------|-------------|--------------------------------------------|--------------------------------------|
| **wasm-bindgen**  | Rust        | WASM      | n/a         | Standard Rust↔JS glue                      | Boilerplate JS glue code             |
| **wgpu**          | Rust/C++    | WebGPU    | ✔           | Modern cross-platform GPU (Vulkan/Metal/WebGPU) | Must write WGSL shaders or use helpers  |
| **ndarray**       | Rust        | CPU       | –           | Straightforward numeric ops               | Pure CPU (no auto GPU/SIMD)         |
| **tract-onnx**    | Rust        | CPU       | –           | Reads ONNX/TensorFlow                     | CPU-only, some ops missing          |
| **burn**          | Rust        | CPU/GPU   | ✓ (wgpu)    | High-level DL (PyTorch-like)              | New, heavy for browser use          |
| **wonnx**         | Rust (WASM) | WASM/WebGPU | ✔         | WebGPU-accelerated ONNX inference         | JS interop layer needed             |
| **ratchet (HF)**  | JS/TS with Rust core | WebGPU | ✔      | Web-first, quantized model support       | Not released, early stage           |
| **llama.cpp / llama-rs** | C/Rust | CPU, (GPU?) | –      | Mature LLM inference, GGUF support       | C++ dependency, CPU only            |
| **onnxruntime-web** | JS        | WebGPU/WebGL | ✔ (via WebGL/WebGPU) | Broad ONNX op support, WebNN upcoming | Not Rust, uses JS                  |

(*WASM compatibility:* All above can run in browser context; tch-rs and pure ONNX Runtime (native) cannot.) 

## Minimal Viable Prototype Architecture

We suggest a **Rust+WASM prototype** with the following components (see diagram below):

```mermaid
flowchart LR
    UI[Browser UI Thread] -- Load/Query --> Core[WebAssembly Module (Rust)]
    Core --> Fetch{WASM Loader}
    Fetch --> JS[JavaScript Fetch Model Shards]
    JS --> ModelFiles[(Model files in IndexedDB/Cache)]
    ModelFiles --> Core
    Core -->|CPU path| CPU[WASM + SIMD]
    Core -->|GPU path| GPU[WebGPU (wgpu)]
    CPU --> Inference[Run Inference]
    GPU --> Inference
    Inference --> Response[Send result back to UI]
```

1. **UI Thread (Main)**: The HTML/JS frontend. It triggers model load and user queries. It spawns a WebWorker for inference.
2. **WebWorker (Rust WASM)**: A worker runs the compiled Rust module. It initializes (loads model), then waits for query messages.
3. **Model Loading**: The Rust/WASM code uses `fetch` (via `web-sys`) to download model shards (from Cache or network) into an `ArrayBuffer`. Optionally it uses IndexedDB to cache shards.
4. **Execution Backend**: Depending on availability, the WASM code either uses pure CPU (via optimized Rust code) or offloads heavy layers to GPU through wgpu shaders.
5. **Result**: The model’s output is sent via `postMessage` back to the main thread for display.
   
**Estimated Effort & Risks:** Implementing this prototype will involve: 
- Writing Rust code to interface with WASM (2–4 days to set up `wasm-pack`, basic fetch code).
- Integrating an inference library (e.g. calling tract or wonnx; ~1 week to wire up and test).
- Preparing a quantized model (1–2 days with Python/llama.cpp).
- Debugging performance (1–2 days tuning SIMD/GPU).
- Risks: Browser incompatibilities (WebGPU / threads) might force fallbacks. Model-loading bugs (CORS, memory). WebGPU shaders are tricky to write; might need help from existing frameworks (wonnx).

## Performance Benchmark Plan

We propose to benchmark three scenarios to gauge performance:

1. **Matrix Multiply Test (Synthetic):** Generate random matrices (1024×1024) and measure multiply time on:
   - Single-thread WASM (using `tract` or `ndarray`).
   - Multi-thread WASM (if threads enabled).
   - GPU via wgpu shader.
   *Goal:* Understand raw compute speed and threading overhead.

2. **LLM Inference Test:** Use a small prompt and feed it to the loaded LLM (e.g. 360M LLaMA). Measure:
   - Latency for 1 token / 10 tokens generation on CPU (1 thread, then 4 threads).
   - Latency on GPU (WebGPU, if model fits).
   - Throughput (tokens/sec).
   *Goal:* Realistic user-case timing. From existing data: Firefox saw ~4s for first summary point on 360M model; we can compare and optimize.

3. **CNN Inference Test:** Run an image classification (e.g. MobileNet) on a sample image. Measure frames/sec:
   - CPU WASM vs WebGPU vs WebGL (if applicable).
   *Goal:* Evaluate architecture overhead for vision tasks.

For each test, collect timing data (best of 5 runs) and plot. Example chart (hypothetical):

```mermaid
barChart
  title Inference Latency by Model Size and Backend
  x-axis Setup
  y-axis Time (ms)
  "100M-CPU": 120
  "100M-GPU":  30
  "500M-CPU": 600
  "500M-GPU":  80
  "1B-CPU":  1300
  "1B-GPU":   200
```

This shows GPU dramatically improving throughput for larger models. Actual values would come from our tests. We’d also chart memory usage (JS Heap vs GPU VRAM) to ensure within limits.

*(Data Flow Diagram):* 

```mermaid
flowchart TD
    A[User action (click/run)] --> B[Main JS calls `runInference()`]
    B --> C[WASM Bindgen JS -> Rust WebWorker]
    C --> D{Is model loaded?}
    D -- No --> E[Fetch model shards (IndexedDB/HTTP)]
    E --> F[Concatenate shards into model buffer]
    F --> G[Initialize inference engine with weights]
    G --> H[Return "ready"]
    H --> I[Run inference on input]
    I --> J[Compute (CPU SIMD or GPU WebGPU)]
    J --> K[Produce output tensor]
    K --> L[Return result to main thread]
    L --> M[Display output]
```

## Conclusion

Creating an in-browser Rust AI runtime is ambitious but feasible with today’s tech. By using WebAssembly with SIMD, optionally WebGPU, and the right Rust crates (e.g. `wgpu`, `tract`, `llama-XXX`), one can support models from tiny CNNs to multibillion-parameter LLMs (heavily quantized). Privacy and offline operation are strong motivators. The trade-offs involve complexity in loading large models, dealing with browser threading policies, and writing GPU code. 

**Recommendation:** Start with a hybrid prototype: use ONNX/tract for basic CPU inference, and test a GGUF LLaMA model with wllama or wonnx for GPU. Enable `[feature = "simd128"]` and use a single WebWorker. Profile performance, and progressively add WebGPU acceleration. Always measure (benchmark) on target devices. Given the evolving landscape (new APIs like WebNN, better mobile NPUs), plan for modularity: you might swap out backends (e.g. if WebGPU isn’t supported, use WASM only).

**Sources:** Foundational docs (Mozilla.ai, ONNX Runtime) highlight on-device inference benefits. Industry projects (wllama, wonnx) show how to implement LLM/CNN inference with WASM+WebGPU. Web standards (WebAssembly threads, COOP/COEP) define browser constraints. The GGUF analysis underscores quantization strategies enabling large models on consumer hardware. These sources informed our recommendations and design.
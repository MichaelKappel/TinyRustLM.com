# 1. Executive Benchmark Recommendation  
We recommend a **holistic, multi-metric evaluation** focusing on end‐user experience and maintaining quality.  No single “kernel throughput” metric suffices.  Instead, compare candidate models on (a) total latency (model load → first token → full response) and memory footprint in a realistic browser UI workflow, (b) overall semantic quality (e.g. standard benchmarks or assistant tests), (c) UI responsiveness (frame times, long-task incidence), and (d) energy use.  The benchmark should flag any solution that fails usability thresholds (e.g. first‐token latency above a few seconds or significant quality regression).  In practice, this means measuring LFM2/LFM2.5 hybrid models **and** comparable dense models (like Qwen, SmolLM, Granite, etc.) under identical conditions – including the same quantization, prompt, hardware, browser, and runtime – to see if the hybrid design yields *user-visible* gains.  If a smaller model is faster but fails quality checks, it should not be considered a win.  All experiments must record exact model hashes, quant formats, hardware, and software versions for full reproducibility.  (See §9–10 for full methodology.)  

# 2. Candidate/Comparator and License Matrix  
We categorize models by **architecture and artifact footprint**, not just parameter count.  Key groups include:  

- **LiquidAI LFM2/LFM2.5 (hybrid Liquid RNN/Transformer)** – e.g. LFM2.5-230M, LFM2.5-350M, LFM2-350M, 700M, 1.2B.  Architecture uses Liquid time-constant convolutions plus gated self-attention.  (Liquid reports 2× speed-up vs Qwen on CPU.)  *License*: custom “LFM Open License v1.0” (not Apache).  

- **Dense Transformer Models** – e.g. **Qwen3** series (Alibaba) at ~0.6B, 1.7B; **Qwen3.5-0.8B** (multimodal); **SmolLM** family (Hugging Face TB) at 135M, 360M, 1.7B; and similar open “reasoner” models (e.g. Google’s **Gemma 3 1B-IT**).  These are standard dense causal transformers.  *Licenses*: Qwen models are Apache-2.0; SmolLM is Apache-2.0; Google’s Gemma models use Google’s Gemma license (not fully open).  

- **IBM Granite (Mamba-2/Transformer hybrid)** – e.g. Granite-4.0-H-350M (hybrid 350M) and Granite-4.0-H-1B (hybrid ~1.5B total).  These combine a small recurrent (Mamba-2) core with a transformer.  *License*: Apache-2.0.  (Granite also has dense 350M/1B variants for ablation.)  

- **Other RNN/State-Space Models** – e.g. **RWKV** (BlinkDL) at ~1.5–4B (“RNN with transformer-level performance”).  RWKV is purely recurrent with time-mixing gating; artifact memory is ~4 bytes × params (for fp16) plus minimal KV state (it has no KV cache).  *License*: Apache-2.0.  (Alternatively, structured state-space models (S4, S5) could be considered if portable, but RWKV is the most practically available.)  

| Model Family      | Example Checkpoints        | Architecture            | Artifact Quantized Size (approx) | License           |
|-------------------|----------------------------|-------------------------|-------------------------------|-------------------|
| **LFM2.5 (Liquid)** | 230M, 350M; (potentially 700M, 1.2B) | Hybrid (Liquid LTC conv + gated self-attn) | ≈ size×1B (fp32) or smaller in quant. | LFM1.0 (custom) |
| **LFM2 (Liquid)** | 350M, 700M, 1.2B           | Hybrid (same)          | —                             | LFM1.0 (custom) |
| **Qwen (Alibaba)**| 0.6B, 1.7B; (Gemma 1B)    | Dense Transformer      | ~ param_count×2B (fp16)       | Apache-2.0    |
| **SmolLM (HF)**   | 135M, 360M, 1.7B           | Dense Transformer      | ~ param_count×2B              | Apache-2.0    |
| **Granite (IBM)** | H-350M (350M hybrid), H-1B (1.5B hybrid) | Hybrid Mamba-2 + Transf. | —                             | Apache-2.0 (IBM) |
| **RWKV (BlinkDL)**| ~1.5B, 4B                  | RNN/SSM                | ~ param_count×4B              | Apache-2.0    |

We will treat “artifact memory” as the final on-disk model size (e.g. a 350M model is ≈1.4 GB in fp32, or ~0.7–1.4 GB in 16-bit, etc.), plus negligible differences in architecture.  Note LFM models use a custom license, so they can be benchmarked as comparators (with published weights) but not bundled into open-code products without checking terms.

# 3. Audit of Available Public Benchmarks  
Several recent public sources report quality and performance, but with mixed comparators and incomplete methodology.  We summarize key findings and note gaps:

- **LiquidAI LFM2/LFM2.5 Blogs (CPU/GPU, tasks)**: Liquid’s publications report both accuracy (e.g. MMLU, IFEval) and CPU throughput for LFM2 family.  For example, LFM2 (350M/700M/1.2B) shows about 2× faster prefill/decode on CPU versus Qwen3 baselines.  In fact, *“LFM2-700M is consistently faster than Qwen-0.6B … despite being 16% larger”*.  The LFM2.5 blog presents benchmarks of LFM2.5-230M vs Granite and Qwen models on ARM64 (Galaxy S25, Snapdragon) and reports dramatic speed and memory wins (e.g. LFM2.5-230M decoding ~42 tok/s on Snapdragon vs ~10–15 tok/s for Qwen3.5-0.8B).  Liquid also shows reasoning benchmarks (e.g. MATH, BFCLv3) where LFM2.5-1.2B (with chain-of-thought) *“matches or exceeds Qwen3-1.7B on most reasoning benchmarks, despite 40% fewer parameters”*, and outperforms *“even hybrid architectures like Granite-4.0-H-1B in both speed and memory efficiency”*.  **Audit note:** These reports are informative but mix conditions: e.g. LFM2.5 results are often quantized (4-bit GGUF) on mobile, whereas comparisons include models in different quant/engine states.  Moreover, some comparisons mix “instruct” vs “thinking” modes (e.g. Qwen3.5-0.8B vs Qwen3-1.7B in different modes), so care is needed to compare like-with-like.  

- **SmolLM (Hugging Face) Blog (Feb 2025)**: SmolLM reports accuracy results: e.g. SmolLM-135M outperforms other <200M models, SmolLM-360M beats other <500M (including Qwen2-500M).  They also measure on-device throughput: e.g. on an iPhone 15 Pro, SmolLM-135M (8-bit) decodes ~3.2K tokens/s.  **Audit note:** The SmolLM blog focuses on model quality and memory footprint on hardware (e.g. “models fit on 6–8 GB devices”), but does not directly measure cross-model latency or browser performance.  It does highlight which small transformers are competitive in quality.  

- **Distill Labs “SLM Benchmarks” (Dec 2025)**: A systematic benchmark of 12 small models (Qwen3, Llama-3, SmolLM2, Gemma, Granite) on NLP tasks before/after fine-tuning.  Key findings: Qwen3-4B dominates fine-tuned accuracy; smaller Llama-3.2-1B is highly “tunable” (largest accuracy gain).  **Audit note:** This is a high-quality study of comparative accuracy, but it was run on server-grade GPUs and does not measure inference speed or browser execution.  It mixes many model families and settings, but generally uses all models in “instruction” mode (they disabled Qwen’s “thinking” mode for parity).  It confirms relative quality rankings but is silent on latency or memory.  

- **WebLLM (MLC) Blog (2024)**: The MLC WebLLM project measured browser inference performance (WebGPU vs native) on Apple M3.  They show WebGPU via WebLLM achieves up to **85% of native GPU speed** for a 4-bit model.  This suggests WebGPU inference can be near-native on recent hardware.  They also note other browser engine improvements (e.g. WebGPU in all major browsers).  **Audit note:** This is not a model comparison, but demonstrates that optimized WebAssembly/WebGPU can approach native speed in practice.  

- **Other Benchmarks:** We found no public benchmarks specifically measuring LFM2/LFM2.5 in WASM or browser; existing figures are from native or mobile experiments.  **Summary of audit:** Available data indicate LFM2-family hybrids are very fast on CPU and competitive in quality; small dense models like SmolLM also excel in quality.  However, **no independent browser-centric benchmarks exist**.  Prior studies often mix different hardware or precision, so our benchmark must **control all variables** precisely.  

# 4. Native and Browser Workload Specification  
We design **two complementary benchmarks**: one for native (desktop) execution, and one for browser (Rust/WASM) execution.  Both use identical prompts and evaluate identical model+quantization artifacts.

- **Native Benchmark**: Run in a controlled process (e.g. a Rust or Python harness using llama.cpp/xtlm/other) on selected hardware.  Steps: 
  1. **Model load time** (disk load, deserialization). 
  2. **Tokenization** (time to tokenize prompt). 
  3. **First-token latency** (prefill+decode of one token). 
  4. **Prefill throughput** (generate hidden states for entire prompt, as one batch). 
  5. **Steady-state decode throughput** (tokens/s when generating long outputs). 
  6. **Context growth test**: measure time per token for increasing context lengths (to detect non-constant behavior). 
  7. **Cancellation / interrupt**: measure overhead of aborting decode mid-stream. 
  8. **Memory**: measure peak process RSS/committed (with care on small increments). 
  Each run uses the same random seed, prompt, and output token count.  Repeat each test ≥5 times to get median and 95% confidence.  Warm-up runs should be done (discard first iteration) to exclude JIT or cache effects.  The native benchmark can isolate individual kernels (e.g. attention, FFN) but the end-to-end numbers are primary.  

- **Browser Benchmark**: Run the Rust/WASM model in a real browser UI context.  Steps include all of the above *plus*:
  1. **Download/import time**: measure time to fetch and instantiate the WASM and model files (or load from cache).
  2. **Parse/validation**: WASM instantiation time (if any).
  3. **JS→WASM memory setup**: overhead to allocate model arrays in WASM memory.
  4. **Tokenization init**: loading tokenizer vocab (in JS or WASM).
  5. **First-token latency in UI**: from user “send prompt” to first token appearing. Includes any message passing between main thread and worker.
  6. **Prefill + decode in browser**: as native, but running under WebAssembly.  
  7. **Chunked decode**: for very long contexts, measure if incremental (e.g. streaming) vs single prefill.
  8. **Context reset**: after one chat, measure cost to clear state and start new chat. (Ensures no hidden memory leak or persistent cache.)
  9. **UI metrics**: track main-thread frame times and long tasks (see §8). E.g. measure if the browser UI thread has gaps or jank during generation. 
  10. **Memory**: measure JS heap usage, WASM heap usage, and total browser memory (if available).  Chrome DevTools or similar can report heap and GPU buffers separately.  
  11. **Cancellation**: test stopping generation (e.g. user aborts), measure how quickly computation halts and memory returns.

Both benchmarks should be scripted (e.g. via headless browser automation for the UI case) and repeatable.  Inputs: short chat prompt (≤50 tokens), moderate dialog (e.g. ~512 tokens), long document (e.g. 4096 tokens).  Outputs: both short (50 tokens) and longer (256–512 tokens).  Vary context length systematically to see performance scaling.  

# 5. Hardware, Browser, and Execution-Mode Matrix  
We test on a **diverse hardware spectrum** representative of product targets:  

- **Low-power x64 laptop**: e.g. Intel/AMD integrated GPU (Iris or Vega), 16–32 GB RAM. Windows 11 or Ubuntu (latest). Chrome/Edge (Chromium) and Firefox. (Use highest boost clock but nominal power mode.)  
- **Mainstream x64 desktop**: e.g. AMD Ryzen or Intel Core with discrete GPU (but for CPU path, GPU is secondary). Linux or Windows with chrome/firefox.  
- **High-end mobile CPU/GPU**: e.g. Snapdragon (Android phone) or Apple A/B-series (iPhone 15/16 Pro). Test on physical devices in Chrome Mobile and Safari iOS (if Rust/WASM works there). For ARM64 Linux, include a Raspberry Pi 5 or Jetson.  
- **Apple Silicon**: e.g. M3 Pro/Max on macOS (Safari, Chrome, Firefox). (Safari only recently got WASM SIMD and WebGPU).  
- **Headless environment**: e.g. Linux ARM64 (Graviton) or typical server (though less relevant for browser).  

We avoid emulators/QEMU.  Each platform’s OS version, browser version, and engine (V8 vs WebKit vs Gecko) must be recorded.  We will detect features at runtime:  
- **SIMD**: WebAssembly SIMD128 (supported on Chrome/Edge/Firefox; Safari 16.4+). If unavailable, compute uses scalar fallback.  
- **Threads**: Wasm threads (PThreads/SharedArrayBuffer) are available only if the page is cross-origin isolated. If disabled, TinyRustLM must fall back to single-thread or Web Worker fallback.  
- **WebGPU**: If GPU path exists (e.g. via WebGPU or WebGPU-shader in MLCEngine), detect if the browser/OS supports it. If not (e.g. older Firefox or Safari <26 without flag), skip GPU path.  
- **NPU/Accelerator**: Some platforms have NPUs (Apple Neural Engine, Qualcomm Hexagon) but no standard API in WASM. If TinyRustLM has a mobile-NPU path (e.g. via CoreML on iOS), measure it separately. Otherwise, note as an unsupported (report-only) case.  

Matrix summary (illustrative):  

| Device Class           | Example Hardware          | OS/Browser              | WASM SIMD? | WebGPU? | Threads? |
|------------------------|---------------------------|-------------------------|------------|---------|----------|
| Low-power laptop (x64) | Intel Iris Xe (2023)      | Windows+Chrome, Linux+FF    | Yes (16.4+ or Canary in Safari) | Yes | Yes (if headers set) |
| High-end desktop (x64) | AMD Ryzen 9 + RTX4060     | Ubuntu+Chrome/Edge      | Yes        | Yes     | Yes      |
| ARM64 device           | Apple A18 (iPhone)        | iOS+Safari/Chrome       | Yes (16.4+) | Partial (Safari 26+) | Yes (if COOP) |
| ARM64 device           | Android (Snapdragon)      | Android/Chrome          | Yes        | Yes (Android 13+ on Chrome 121) | Yes      |
| Embedded (ARM64)       | Raspberry Pi 5            | Linux (Chromium browser) | Yes        | Yes (experimental) | Yes      |

Feature detection code (JS/C# interop) will be used to choose the best path: e.g. if WebGPU isn’t available, run compute in WASM; if WASM-threads are disallowed, restrict to single-thread.  A proprietary accelerator runtime (e.g. Google’s Llama processor) is only used as an external comparator, not assumed in TinyRustLM.

# 6. Memory and Context-Growth Formulas  
We model memory usage by summing all components (weights, activations, tokenizer, caches, overhead):  

- **Weights**: For a model with *N* parameters, full-precision (fp32) size is ~4N bytes; fp16 or bfloat16 ~2N bytes; 8-bit (Q8) quant ~1N byte; Q4/K (4-bit with KG) ~0.5N bytes (plus small offset table). E.g. a 350M fp16 model is ~700MB.  
- **Static Mappings/Copies**: The converted model format (GGUF, etc) may include tensor metadata and CPU-side copy. We count *one copy* of quantized weights in WASM memory. On native, counts similarly.  
- **Tokenizer**: The vocabulary and BPE data can require e.g. ~2–5MB (words plus merges). We include this in memory use.  
- **Activations and Scratch**: During prefill, store layer activations. Roughly: *activations = hidden_size × context_length × 4 bytes (fp32)*, plus a similar size for attention keys and values (KV cache) if transformers.  For a Transformer, KV cache = 2 × *hidden_size* × *context_len* bytes (fp16 or fp32) for keys and values.   If quantizing activations (some runtimes do), use matching bytes. Liquid’s LTC may reduce KV cache (it claims “constant space, no KV cache”).  We explicitly measure KV memory: e.g. KV = 2×(hidden_size)×(seq_len) per head or aggregate, depending on design.  For example, a 768-dim model, 4096 tokens gives ~2×768×4096≈6.3M floats (~25MB fp32, ~12.5MB fp16).  
- **Browser/WASM Heap**: The WebAssembly linear heap and JS heap are separate. WASM may over-allocate to a fixed page size (e.g. 64KB blocks). Also, additional JS heap objects (prompt strings, output buffers, intermediate arrays) may double-count some memory. We will measure “committed bytes” vs “resident” for the OS process (on native) or use Chrome’s task manager / DevTools for “JavaScript memory” vs “Graphics/Other”.  
- **Duplication Buffers**: Any double-buffering (e.g. CPU→GPU transfers, or WASM staging buffers) should be included. For WebGPU, model weights are uploaded to GPU memory – count that separately from CPU.  
- **Peak vs Steady**: We record peak memory (high-water), and also context-growth: we expect Transformer memory to grow roughly *O(context_length)* (activations + KV). If any part is truly “constant” (Liquid claims constant space), our measurements will reveal whether additional memory is used for longer contexts.  

Empirically, we will measure memory in two ways: (1) programmatic: poll memory counters in code (e.g. `mallinfo` on native, `performance.memory` in Chrome); (2) system monitoring: OS tools (free/ps) to confirm totals.  All values (initialized size vs peak runtime) will be reported separately.  

# 7. Quantization and Numerical-Fidelity Plan  
We will test all implemented precisions: typically Q8 (8-bit integer), Q6, Q5 (if supported), Q4 (4-bit GGUF) and any mixed formats (e.g. Q4_K_M) where available.  Each model checkpoint is converted *as-is* without further training, so we isolate quantization effects.  For each model+quant, we measure:  
- **Artifact Size**: file size on disk (e.g. GGUF size) and in-memory weight bytes.  
- **Load Time**: time to load/deserialize quantized weights.  
- **Latency/Throughput**: as per §4, in each precision. (PromptQuorum notes that *“all quantizations run at identical token/sec (memory-bound, not compute-bound)”* – we will verify if this holds across our implementation.)  
- **Quality/Fidelity**: run a fixed evaluation set (e.g. MMLU, perplexity on standard corpus, or a subset of human eval queries) to detect any degradation.  We will compute token-perplexity drift and sample outputs to check for errors.  Also perform an “assistant gate” test: e.g. multiple chat queries to ensure answers remain correct and helpful.  
- **Energy and Time**: since lower precision may change energy use, we will log power usage (see §8) for each quant.  

We will use a common calibration converter (e.g. llama.cpp converter or GGUF) and a fixed calibration corpus if needed (for Q5_0 vs Q4_K_M).  We do *not* choose a quant level by speed alone: accuracy is paramount.  For example, PromptQuorum finds Q4 to have ~1% quality loss vs fp16 and Q5 only marginally better, so if our models show significant drift in Q4, we may prefer Q6/Q8 despite memory cost.  All quant experiments must be run with identical seed and prompts to allow bitwise comparison of logits if needed.  

# 8. UI Responsiveness, Energy, and Thermal Methodology  
We define UI metrics and energy measurement rigorously:  

- **Frame-Time Budget**: The browser UI should ideally update ≥30 FPS (33ms per frame).  We will log main-thread idle time during inference using the browser’s performance API.  Any continuous “long tasks” (blocking the main thread >50 ms) are considered failures.  For example, rendering each new token or UI scroll should not pause the UI.  We will use `PerformanceObserver` (LongTaskTiming) to capture these.  Also measure “Time to interactive” for the chat UI (time from button click to first token visible).  

- **Rendering Overhead**: In streaming generation, each token triggers a DOM update (Markdown render).  We will simulate typical chat UI work (e.g. adding an HTML node per token) and measure its cost.  We will test narrow vs wide viewports, multiple open tabs (to trigger throttling), and background tab throttling (if applicable).  

- **Concurrent Load**: Test performance when running inference alongside other web work (e.g. a simple canvas animation or service worker doing unrelated tasks) to mimic a busy user scenario.  

- **Energy/Thermal**: Use wall-power measurement: measure system power draw (e.g. using `thermald` on Linux or powerkit on Windows) from idle to full-load.  We will stabilize the system thermal state (run a warm-up loop until power draw levels off) before measurement.  Then, run the inference workload (e.g. generating a 256-token completion) and record Joules = (power × time) minus idle baseline.  We will report Joules per answer and per token.  Both CPU (Rust) and GPU (if WebGPU path used) power should be captured – either by vendor APIs or external meter if available (TokenPowerBench style).  On laptops, we disable “Battery Saver” modes and use AC power to avoid variability; then repeat on battery to gauge worst-case.  All tests include confidence intervals.  

- **Thermal Effects**: On mobile and laptops, we repeat long-running tests until performance stabilizes (to detect throttling).  Report initial and steady-state speeds.  Do not rely on vendor “sustainability claims” – only measured wattage counts.

# 9. Statistical Design and Reproducible Receipt Schema  
Every benchmark run must log a **full receipt** including: model identifier and file hash, tokenizer version/hash, conversion script hash (for quant), runtime version (TinyRustLM git or commit), WASM engine version, OS and CPU model, browser user-agent, feature flags (SIMD on/off, WebGPU on/off, threads on/off), hardware details (CPU cores, GPU model), configuration (threads used, batch sizes), workload hash (unique ID of prompts and lengths), random seed(s), and raw output samples.  Each run should be repeated (e.g. N=5) to estimate variance; outliers (e.g. due to OS jitter) are marked and not discarded without justification.  We will compute median and 95% confidence intervals for each metric.  All raw logs (timings, power traces, outputs) are archived.  If a run fails (crash, OOM), we record that failure code and include it in the receipt.  Future runs (e.g. after an optimization) must preserve old receipts for traceability.  

*(No external citation; this is standard best practice for reproducibility.)*  

# 10. Predeclared Decision Thresholds and Stop Rules  
Prior to running, we define acceptance thresholds that reflect user experience targets.  Example thresholds (to be tuned to product needs):  
- **Minimum Quality**: The model must achieve within X% of the baseline (e.g. a known good model) on a curated task set (e.g. >70% GPT-style assistant QA score).  If a quantized smaller model falls below this, it is rejected regardless of speed.  
- **First-Token Latency**: The user should not wait more than ~1–2 seconds for the first token on typical prompts (chat latency).  If median first-token time exceeds this on target hardware, consider the architecture too slow.  
- **Sustained Throughput**: For longer outputs, require a baseline speed (e.g. >50 tokens/s on desktop).  If context or decode slows drastically as length increases, that fails “constant memory” claim.  
- **Memory**: The whole stack (WASM heap + resident) must fit under a given cap (e.g. 4 GB on laptop).  If peak memory > cap, the model/format is impractical.  
- **UI Responsiveness**: No sustained long tasks (none >50 ms blocking UI) during inference; frame drops must be negligible (<5% frames over 33ms).  
- **Energy**: Total Joules per answer should stay below a threshold (e.g. analogous to <0.1 Wh per query on average).  We will compare against a baseline model or platform TDP.  
- **Numerical Parity**: Regression in logits or output distribution between environments (native vs WASM) should be minimal (e.g. <1% disagreement in token probabilities).  If any precision or implementation bug causes incorrect outputs, that triggers rejection.  

These thresholds should be **fixed before experiments** (e.g. based on user surveys or SLA).  If a candidate model/architecture fails a stop rule (e.g. quality or latency threshold), we do not allocate further optimization effort on it.  

# 11. Minimum Viable Benchmark Implementation Backlog  
To build this benchmark, we need at least:  
- **Framework Setup**: Scripts to load models (llama.cpp or similar) and run inference in native for each model+quant.  Logging and timing infrastructure.  
- **Browser Harness**: A test webpage or JS harness to run TinyRustLM via WASM (possibly with a headless Chrome/Playwright script) that automates prompt submission and captures timestamps and outputs.  
- **Tokenization Sync**: Ensure both native and browser use the same tokenizer with same data (e.g. HF tokenizer files, MD5-hashed).  
- **Instrumentation**: Code to record timestamps around each stage (loading, tokenize, decode) and to capture performance entries (using `performance.now()` and `PerformanceObserver` for long tasks).  
- **Power Measurement**: Utilities to read power sensors or external meters during runs (e.g. `powerstat` on Linux, or Intel RAPL counters for CPU; or USB power meter for wall power).  
- **Data and Prompts**: A fixed set of prompts for short, medium, and long contexts (e.g. ChatGPT-style conversations, document QA paragraphs).  Hash these to verify reproducibility.  
- **Result Database**: A storage format (CSV/JSON) for receipts, and scripts to aggregate stats and generate summary tables/plots.  
- **Benchmark Orchestration**: A master script to iterate over hardware/devices, models, precisions, and collect all data automatically, tagging with configuration.  

# 12. Unknowns Requiring Local or Physical Hardware  
Several factors can only be resolved by running on actual devices:  
- **Actual WASM Performance**: We cannot predict how TinyRustLM’s WASM engine compiles each model.  Measured browser latencies on our devices are needed.  
- **Mobile Variability**: Differences between Android (Chrome) vs iOS (Safari/Chrome) in WASM JIT optimizations, and the behavior of NPUs (e.g. Apple’s Neural Engine, if TinyRustLM uses it) are unknown.  We need to test on at least one iOS and one Android flagship.  
- **Thermal Throttling**: Only real hardware will show if a phone or laptop chips throttle under sustained load.  
- **Browser Differences**: Subtle differences in JS engine or Wasm implementation (e.g. Chrome’s V8 vs Safari’s WebKit) can affect throughput by ~10–20%; needs empirical measurement.  
- **Memory Accounting**: The exact WASM heap usage and GC behavior in browsers can only be measured in situ.  
- **Feature Flags**: If cross-origin isolation headers must be set to allow threads, we need to test this in practice.  

In short, this benchmark plan must be carried out on representative devices: desktops (Windows/Linux/macOS) and at least one ARM smartphone of each ecosystem.

# 13. Annotated Primary-Source Bibliography  
- Liquid AI – “Introducing LFM2” blog: Details LFM2 hybrid architecture and CPU benchmarks versus Qwen and Llama.  
- Liquid AI – “LFM2.5-230M” blog: Performance charts of LFM2.5 on mobile vs Granite/Qwen.  
- Liquid AI – “LFM2.5-1.2B-Thinking” blog: Extended reasoning and inference-speed comparison against Qwen3-1.7B and Granite-1B.  
- Hugging Face (HF) – SmolLM model card: Reports SmolLM benchmarks and memory usage on iPhone.  
- BentoML – “Best Open-Source Small Language Models (2026)”: Summary of competitive small models (SmolLM3, Qwen0.8B, Phi-mini).  
- Distill Labs – “12 Small LMs Across 8 Tasks”: Systematic fine-tuning benchmark of small models (Qwen, Llama, SmolLM, Gemma, Granite) on diverse tasks.  
- MLC WebLLM blog – “A High-Performance In-Browser LLM Engine”: Compares WebGPU versus native Metal on Mac, finding ~85% performance retention in WebGPU.  
- Google Web.dev – “WebGPU is now supported in major browsers”: Confirms broad browser support for WebGPU on relevant OS versions.  
- PromptQuorum – “Q4 vs Q5 vs Q8”: Analysis of quantization tradeoffs, finding Q4 yields ~1% quality loss and identical speed to Q8.  
- MDN Web Docs – PerformanceLongTaskTiming: Defines “long tasks” (>50 ms) that block the UI and degrade responsiveness.  
- BlinkDL GitHub – RWKV-LM repository (LICENSE section): States RWKV models are Apache-2.0 licensed.  
- LMStudio (Element Labs) – LFM2 documentation: Specifies LFM2 models use a custom LFM1.0 license.  
- Hugging Face – Qwen model card: Indicates Qwen weights are Apache-2.0 licensed.  
- TokenPowerBench (ArXiv): Describes methodology for measuring GPU/CPU/system power aligned to prefill/decode phases (we adapt its principles).  

These sources inform our candidate selection, known benchmarks, and measurement methodology. Each cited finding is incorporated above to justify our design.
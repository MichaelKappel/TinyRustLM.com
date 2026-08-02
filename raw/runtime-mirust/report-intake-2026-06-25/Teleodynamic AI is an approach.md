# Executive Summary  
**Teleodynamic AI** is an approach where a system’s structure and parameters co-evolve under resource constraints.  In practice for LLMs, this suggests adding or pruning small *skill modules* only when the expected performance gain exceeds their cost.  A **skill module** here means a self-contained, specialized sub-model or adapter that provides a distinct capability (e.g. summarization, translation, or domain knowledge).  Users can choose combinations of these tiny LLM modules, which are then downloaded (as serialized model files) into the browser and run via a Rust/WASM runtime.  

This report surveys the state of the art for tiny, composable LLMs and outlines how to build a browser-based system for selecting, composing, and locally running these “skill modules.” We cover definitions and taxonomy (Section 2), current tiny-model candidates and modular architectures (Section 3), model file formats and quantization for browser use (Section 4), Rust/WebAssembly inference runtimes and relevant Web APIs (Section 5), module composition patterns (Section 6), packaging and dependency management (Section 7), performance and device constraints (Section 8), security/privacy (Section 9), licensing (Section 10), developer UX and APIs (Section 11), and finally a reference design and roadmap (Sections 12–15). We provide comparative tables of models, runtimes, and composition techniques, along with a recommended Rust/WASM architecture (with Mermaid diagram), example code, benchmark suggestions, and deployment strategies.

## Teleodynamic AI & Skill Modules  
“Teleodynamic” AI (per Kappel 2023) refers to systems that actively maintain their viability by adapting their internal structure and resource allocation.  In such a system, every new *structure* (e.g. adding a module) is an “action” that must pay for itself by improving performance. Applied to LLMs, this means we view each skill module as a structural unit that can be grown or pruned under this teleodynamic control.  

A **skill module** (or simply *skill*) is typically defined as a reusable, composable unit of capability.  In the LLM-agent literature, skills are “self-contained packages” that agents load on demand. A skill package often includes an instruction/metadata file, optional scripts, and any necessary weights or data. For our purposes, a skill module would primarily consist of a tiny pre-trained or fine-tuned language model (or adapter) specialized for a task, packaged with metadata.  For example, an agent might have separate modules for “book summarization,” “code generation,” or “medical Q&A,” each represented by a small LLM or adapter.  Xu & Yan (2026) describe learning “lightweight skill modules” (fine-tuned weights) for distinct task families, while keeping the base LLM fixed. At inference time, the relevant module is loaded to handle the subtask, keeping computation focused and efficient.  

| **Concept**       | **Definition**                                    | **Citation** |
|-------------------|---------------------------------------------------|--------------|
| Teleodynamic AI   | A paradigm where model structure, parameters, and resource budgets co-evolve under viability pressures, adding components only if they pay off. | [1] |
| Skill Module      | A self-contained capability unit (model or adapter) that can be dynamically loaded; includes code, metadata, etc., enabling modular LLM behavior. | [7][4] |

## State-of-the-Art Tiny LLMs and Modular Architectures  

### Tiny LLMs  
There is a growing “micro-LLM” trend: researchers are building LMs with **10M–100M** parameters up to **sub-1B**–**few-billion** parameters to run on limited hardware or enable fast inference.  For example, Guertler et al. (2024) introduce *Super-Tiny LMs* (10–100M params) using weight-tying and byte-level tokenization.  Other notable examples include **TinyLlama** (~1.1B), **Phi-3-mini** (~3.3B), and **MobiLlama** (~0.5B). These small models achieve surprisingly competitive performance on certain tasks (sometimes 40–80% of much larger models) by aggressive optimization (quantization, pruning, efficient training). There are also many smaller language/transformer models (GPT-2 117M/345M, DistilGPT2, GPT-Neo 125M/350M, etc.) and specialist models (tiny translation, summarization models).  

Table 1 below compares representative tiny LLMs of interest for browser-based use.  We list parameters, supported formats, typical hardware requirements, licenses, and key pros/cons.  (“GGUF/quant” indicates availability of GGML/GGUF format quantized weights, which are favored for efficient loading.)  

| **Model**         | **Size**       | **Formats (Weights)**                  | **License**  | **Pros**                               | **Cons**                   |
|-------------------|----------------|----------------------------------------|--------------|----------------------------------------|----------------------------|
| **TinyLlama 1.1B**    | ~1.1B       | PyTorch, GGUF (Q4_K_M)               | Apache-2.0   | Open-source LLaMA-based; good text generation; GGUF support (via TheBloke) | Still large (~4GB float16); needs quantization for browser |
| **MobiLlama 0.5B**    | 0.5B        | PyTorch (FCI), Transformers         | CC BY-NC-SA? | Highly efficient (designed mobile LM), relatively small footprints | May have non-commercial license; accuracy lower (bench ~40–50% of larger models) |
| **Qwen2-0.5B**    | 0.5B        | PyTorch, GGUF                        | Apache-2.0   | Chinese/English multilingual; GGUF available | Very small, limited context (e.g. 512 tokens); limited open benchmarks |
| **GPT-NeoX-125M** | 0.125B      | PyTorch, ONNX                        | Apache-2.0   | Established GPT-style model; small footprint | Very limited output length (e.g. 2048 tokens); lower quality |
| **GPT2-345M**     | 0.345B      | PyTorch, ONNX, TF                    | MIT/Apache  | Well-studied, supports ONNX export; moderate quality | Larger than some, still slower on CPU/WASM; float32 ~1.3GB |
| **LLAMA-2 7B**    | 7.0B        | PyTorch, GGUF (Q4_0)                 | Meta License | High-quality chat/instruction model; GGUF weights exist | Too large for many browsers; float16 ~13GB, int4 ~2.5GB; still heavy |
| **Phi-3-mini (3.3B)** | 3.3B    | PyTorch (closed?)                     | Unknown      | Very strong reasoning per reports (3.3B) | Likely not publicly downloadable; skip if license unclear |
| **Mistral-3B**    | 3.3B        | PyTorch, ONNX                        | Apache-2.0?  | Compact specialized variant (recent release) | Newer, fewer community resources |
| **Mixtral-8x7B (56B)**| 56B   | Quantized GGUF (7B sharded×8)         | Apache-2.0   | Extremely strong (mix of 8 small experts); quantizable | Complex (multiple experts); inference routing needed |
| **Wiz-ardLM 7B**  | 7.0B        | PyTorch (LLaMA base repack)          | LLaMA-2      | Fine-tuned instruct on Llama-2 base; relatively open (LLaMA license) | ~14GB fp16, ~3GB int4; license restricts commercial use  |

*Table 1: Comparison of candidate tiny LLMs for browser inference.*  These models can often be further **quantized** (8-bit, 4-bit, etc.) to reduce size and memory, typically trading off a small amount of accuracy for 50–75% memory savings. For example, a 1.1B model in 4-bit may occupy ~2–3GB, whereas the FP16 might be ~5–6GB, making it borderline for client GPUs.

### Modular Architectures  
Modular LLM architectures seek to decompose intelligence into specialized components. The dominant paradigm is **Mixture of Experts (MoE)**, where a set of expert modules are selectively activated by a gating function.  In MoE, each expert is essentially a skill module specialized on some data (domain/topic), and a learned *router* network decides which expert(s) handle each input.  This conditional computation drastically reduces inference cost versus a monolithic model by only running a fraction of modules per input. Famous examples include Google’s Switch Transformer and GLaM, where e.g. 64 experts exist but only 1–2 are used per token. We can emulate this on a tiny scale by training or loading multiple small experts and writing a lightweight router.  

Other modular patterns include **pipeline composition** (sequential chaining of models) and **ensembles**. In a pipeline, output from one module feeds into the next. For instance, a retrieval module could fetch documents, then a QA module extracts answers, and finally a verification module checks correctness – each a separate skill. In an ensemble approach, multiple modules run in parallel on the same input and their outputs are combined (e.g. via voting or averaging). Ensembles can improve robustness but multiply resource usage.  

**Adapters** are another tactic: small trainable layers inserted into a frozen backbone model.  These can be seen as *internal modules* that implement task-specific behavior.  Adapters allow one to load a base LM and attach lightweight modules (often ~1–10% of base model size) without modifying the original weights. This can be part of modular strategy: e.g., keep one big tiny LLM core, and dynamically load adapter weights for new skills.  

Finally, **prompt engineering** and **knowledge routing** are “software-level” composition techniques. One could craft prompts that instruct an LLM to internally call skill modules (“tool use”), or design an external controller that routes queries to the appropriate skill based on semantic classification (e.g. using an embedding-based similarity router). These approaches tie into agent frameworks where modules are invoked as external tools or subprocesses.

| **Composition Pattern** | **Description & Example**                                                  | **Pros**                            | **Cons**                               |
|------------------------|-----------------------------------------------------------------------------|-------------------------------------|----------------------------------------|
| **Pipeline**           | Chain modules sequentially (A→B→C). E.g., summarizer → translator → verifier. | Clear structure; modular debugging   | Sequential latency; error propagation |
| **Ensemble**           | Run multiple modules in parallel, combine outputs (e.g. vote/avg).          | Robustness; uncertainty estimation   | High compute; synchronizing outputs   |
| **Gating/MoE**         | Dynamic routing: a gate selects which expert modules to run per input. | Efficient use of expertise; adaptivity | Requires training a gate; complexity |
| **Adapters**           | Plug-in neural layers into a base model for task adaptation.     | Small weights; fast fine-tuning       | Still one large model runtime         |
| **Prompt-Based Hooks** | Use prompts or “tool API” calls to virtual modules at runtime.               | No extra model weights; flexible     | Unreliable if LLM misinterprets; no performance gain |
| **Knowledge Routing**  | Detect domain of query, forward to domain-specific module/KB.               | Specialization per domain            | Needs reliable domain classifier      |

*Table 2: Modular composition patterns for LLM skill integration.*  Notably, gating (MoE) directly implements the teleodynamic principle: a module is only “added” (activated) if the input warrants it. This aligns with the cost-vs-payoff approach of teleodynamics.

## Model Formats and Serialization for Browser Delivery  
For web deployment, models must be serialized into compact, loadable formats. Common formats include **PyTorch/TensorFlow checkpoints** (not browser-friendly) and more portable forms like **ONNX**, **TensorFlow Lite**, and specialized binary formats (GGUF/GGML, Safetensors, DDUF).  Key considerations are size, loading speed, and execution efficiency.

- **ONNX**: An open standard from Microsoft. It supports almost all transformer ops. ONNX models can be run in-browser via ONNX Runtime Web. However, raw ONNX weights (often float32) are large. Quantized ONNX (e.g. int8) can reduce size but may degrade accuracy.  ONNX Runtime Web can then execute the model on WASM or WebGPU. Its wide operator support and JS API make it popular, but the runtime overhead can be nontrivial.

- **GGML/GGUF**: Originally from llama.cpp (Georgi Gerganov). GGML files (or its extended GGUF format) pack weights (often quantized 4-8 bit) along with metadata. GGUF has become a de facto standard for many tiny LLMs, because it loads very quickly in C/C++ runtimes. Importantly, there is now a JavaScript/TypeScript GGUF parser at Hugging Face, and tools like `llama.cpp` and `Transformers.js` can load GGUF weights in the browser. For example, the HuggingFace Hub supports GGUF uploads and even displays metadata. (Image below shows a HuggingFace model search filtered for GGUF.) GGUF files are typically a few GB (for billion-scale models) but can be further compressed or split. Because GGUF includes quantized data and tensor layouts, it’s ideal for fast loading in WASM or native engines.

 *Figure: Hugging Face Hub listing models (Gemma-7B, Mistral-7B, etc.) in GGUF format (the “Active filters: gguf” search). Many tiny models are available as GGUF files.*

- **Safetensors**: A safe, fast-loading tensor format (supported by HuggingFace). It is essentially an alternative to PyTorch’s Pickle format. While good for Python loading, browser libraries currently favor ONNX or GGUF; safetensors might be used if there is a JS library.

- **Other formats**: Models can be delivered as static files on a CDN or hub (HuggingFace, model zoo). For TensorFlow or Keras models, one could use TensorFlow.js format (JSON + binary), but most LLMs use ONNX or PyTorch backends.

When serializing for the browser, **quantization and pruning** are crucial. Models are typically converted to 8-bit or 4-bit integer formats to fit in limited memory. For example, 4-bit quantization can shrink a 7B model to 2–3GB (down from ~13GB FP16). Pruning (dropping low-importance weights) can also reduce size. These techniques trade a bit of accuracy for a much smaller footprint, a good trade on resource-constrained devices. HuggingFace’s `gguf-my-repo` tool and llm-quantization libraries (GPTQ, AWQ) can produce such files. The format must also be **streamable**: WASM cannot easily random-access a file while downloading, so chunked download or progressive loading may be needed. Embedding model downloads into the app via fetch (HTTP range requests) and caching them (IndexedDB or Cache Storage) helps.

## Rust/WebAssembly Runtimes and Browser APIs  

Several inference runtimes exist for executing LLMs in Rust/WASM within the browser:

- **ONNX Runtime Web**: The official Microsoft ONNX runtime has a WebAssembly/JS binding. It allows you to run ONNX models on either CPU (via WASM with SIMD) or GPU (via WebGL/WebGPU/WebNN execution providers). ONNX Runtime Web supports many operators and is mature, but can be heavyweight. It offers a JS API (in Node or browser) and can target WebGPU by switching the execution provider.  For example, one can `require('onnxruntime-web')` and choose `backendHint: 'webgpu'` for GPU acceleration. ONNX Runtime benefits from broad support but currently only a subset of ops run on WebGPU/WebNN, falling back to CPU for others.

- **Transformers.js / HuggingFace**:  The Transformers.js library (v3+) supports running HuggingFace models in the browser by converting them to ONNX and using ONNX Runtime Web internally.  It abstracts model loading and tokenization in JS, with optional WebGPU acceleration (via ORT WebGPU provider) or WASM fallback.  This is a convenient high-level option but can be bulky and requires model conversion.  The SitePoint benchmarks found that Transformers.js+WebGPU greatly outperforms CPU for large models, but it still needs careful setup and async initialization.

- **Wonnx (Rust)**: Wonnx is an emerging Rust crate and WASM package specifically for ONNX on WebGPU. It provides a Rust-native API to load ONNX models and execute them with WebGPU through [wgpu](https://github.com/gfx-rs/wgpu). Wonnx’s npm package (`@webonnx/wonnx-wasm`) bundles a WebAssembly module that does the inference. Sample usage (from Wonnx docs):  
  ```js
  import init, { Session, Input } from "@webonnx/wonnx-wasm";
  await init();
  const session = await Session.fromBytes(modelBytes);
  const input = new Input();
  input.insert("input_ids", [...]);
  const result = await session.run(input);
  ```  
  In Rust, you would use the `wonnx` crate similarly. Wonnx is under active development, and currently supports many ONNX operations but may need workarounds (e.g. shape inference hacks) for complex models.  It is pure Rust (MIT), which is ideal for our target environment.  A practical advantage is that it directly uses WebGPU with good performance, while still allowing compilation to WASM.  The author of Wonnx notes it’s a “GPU-accelerated ONNX inference run-time written 100% in Rust, ready for the web”.

- **Burn (Rust)**: [Burn](https://burn.ai) is a next-gen Rust tensor/ML framework that supports WebAssembly. It includes an ONNX importer (via `burn-onnx`) that converts an ONNX model to Rust code and a weight blob. You compile Burn models with backends like WGPU or WASM-CPU. In particular, the Burn WGPU backend can run inference in a browser using WebGPU. Burn’s approach is to embed the model at compile time (for speed) and optimize kernels (fusion, autodiff). This means you’d build your skill modules into your Rust app. The tradeoff is less flexibility at runtime (you’d need to recompile for new modules), but Burn is highly optimized. Burn also runs on CPU via a “Flex” backend in WASM. Burn is promising but requires heavy Rust integration.

- **llama.cpp / llama-cpp-wasm**: Llama.cpp is the popular C/C++ inference engine for LLaMA-family models. *llama-cpp-wasm* is a WebAssembly build of it. This allows running many GGUF models (TinyLlama, Qwen, etc.) in the browser. It uses either single-threaded or multi-threaded WASM with Web Workers (if enabled). Example usage (from llama-cpp-wasm README) shows loading a GGUF model by URL and running it:  
  ```js
  import { LlamaCpp } from "./llama-mt/llama.js";
  const app = new LlamaCpp(modelURL, onModelLoaded, onMessageChunk, onComplete);
  ```  
  Under the hood this runs the Llama.cpp inference loop (CPU) in WebAssembly. Performance is modest (no GPU), but it’s proven and supports int4/in16 quant. The project is MIT-licensed. Use of Web Workers can parallelize some work.  

- **WebNN API**: WebNN is a proposed browser standard to accelerate ML. In Chrome it’s available as a Chrome OS / Android-specific API for machine learning (also known as “NNAPI for Web”). In theory, WebNN could accelerate LLM layers on device-specific accelerators. ONNX Runtime has an experimental WebNN provider. However, as of now WebNN is not widely supported in stable browsers (and mostly focused on vision CNNs). It is worth mentioning as “upcoming,” but currently ONNX+WASM/WebGPU and pure WebGPU are more practical.

- **Custom WebGPU via wgpu/rust**: One could also write custom Rust+WGSL kernels (via the [wgpu](https://github.com/gfx-rs/wgpu) crate) to perform inference. This is what the Wonnx and Burn frameworks do under the hood. The advantage is ultimate flexibility (you can optimize for your specific model shape), but it’s very complex. For example, one might compile a Transformer’s matrix multiplies into WebGPU shaders manually.

Many libraries now automatically handle the browser ABI: Wonnx and llama-cpp-wasm compile to WASM + Web Workers, ONNX Runtime Web comes as an npm, and Transformers.js is pure JS. In practice, one can embed these in a Rust-based frontend by calling JavaScript (e.g. via `wasm-bindgen`) or by compiling Rust inference code to WASM for use in JS.

## Module Composition & Orchestration Patterns  
Once modules are loaded, we need to orchestrate them. Key patterns include:

- **Sequential Pipelines**: Pass user input through a series of modules. For instance, a “query” might go first to an information-retrieval module (embedding + vector search), then a LLM summarizer, then a final post-processing or filtering module. This is straightforward and easy to debug. It maps well to agent workflows (states + modules). The downside is latency can add up.

- **Conditionally Parallel/Ensemble**: Issue the same input to multiple modules in parallel (e.g. two translation modules for cross-checking) and then combine or vote on outputs. Ensembling can improve reliability, but cost is multiple model runs. One could run ensembles asynchronously if acceptable latency.

- **Gating (Router)**: Before running a module, classify or compute which module is most appropriate. This can be a learned gating network (a small classifier) or a heuristic (e.g. check keywords or use an embedding similarity). Only the selected module(s) then run on the query, saving compute. This mirrors Mixture-of-Experts: each input “selects” an expert.  For example, a fixed overhead “router” LLM might read the question and output a tag (“use module A or B”), then the orchestrator dispatches accordingly.

- **Adapter Insertion**: In some designs, there is a main LLM “engine” that stays resident, and modules are small adapter networks that modify its behavior. In Rust, one could simulate this by dynamically loading adapter weights (for example, storing LoRA weights) and applying them at each transformer layer. This is complex to implement in existing runtimes but worth considering for tightly integrated modularity.

- **Prompt/Tool Chaining**: The controller could formulate prompts that instruct one model to use others (“call this skill”). For example, the orchestrator might do: `Answer = base_LLM("First do X and then pass it to [module_name]")`. This requires encoding the module selection in natural language and having the LLM correctly pass data, which can be brittle. However, no new code is needed inside the models.  

- **Knowledge Routing**: Split the query into subtopics and send to domain-specific modules. E.g., if a query has math and history parts, send each part to the math-module and history-module respectively, then combine answers. This needs a semantic splitter/route function. Some systems use vector embeddings to route to specialized LLMs or retrieval databases.

Overall, these patterns can be mixed. A typical workflow might be: **Router → (selected Module → optional pipeline of sub-modules) → Merge → Output**. A teleodynamic twist would allow new modules to be “grown” if an existing combination performs poorly, or prune rarely-used modules during updates.

## Dependency Management, Packaging, and Download Strategies  
Each skill module (model) should be packaged as an independent asset. We recommend structuring modules as versioned bundles (like npm packages or model hub repos), with metadata (name, version, license, parameter count, dependencies). For example, one could adopt a convention like:

```
/modules/
   /math-skill/
      skill.json      (metadata: name, version, description, license, etc.)
      model.onnx or model.gguf  (the weights file)
      tokenizer.json (optional vocab)
   /summarization-skill/
      ...
```

At runtime, the orchestrator can fetch modules on demand.  Strategies for delivering module files include:

- **CDN/Hub Hosting**: Host module files on a content-delivery network or model hub. E.g., use HuggingFace with GGUF or ONNX files, or an S3 bucket with public URLs. This allows cheap distribution and HTTP caching. If using HuggingFace, the model repo itself acts like a versioned package, and we can fetch with `fetch("https://huggingface.co/user/model/resolve/.../model.gguf")`.

- **IndexedDB/Cache**: On first load, fetch each required module via `fetch()` (with progress feedback). Store the binary in IndexedDB or Cache Storage for subsequent sessions, so the user doesn’t re-download heavy weights each time. Use a Service Worker to manage cache updates: e.g., on app startup, the worker checks for newer versions of module URLs (version tags) and pre-fetches them. (See [46] on using Web Workers & Service Workers for model lifecycle.)

- **Chunked Loading**: For very large modules, consider HTTP range requests or splitting the weights file into chunks. This is complex but can allow “streaming” a model. Most runtimes (like ONNX) expect the full file in memory, so chunking is rarely implemented at the application level; instead rely on the browser caching the whole file in one go.

- **Binary Formats and Compression**: Distribute weights in compressed binary (GGUF with quantization) rather than raw floats to minimize size. Modules could even be ZIPped and decompressed in-browser (using WASM lib), though CPU cost is a tradeoff.

- **Semantic Versioning**: Each module should have a version or hash. The orchestrator should check compatibility (e.g. requiring a specific input/output name). If a newer module is available, the system can notify the user or auto-update on next run.

- **Handling Dependencies**: If one module depends on another (e.g. a “math-skill” that in turn calls “calculator-skill”), the metadata (skill.json) should list dependencies. The orchestrator can load dependencies first.

For developer convenience, one can also distribute modules via npm or a similar package manager (e.g. a `@myapp/skill-weather` package that includes a WASM or JSON file). But we recommend a simpler fetch-based approach for flexibility.

## Performance, Latency, and Throughput Tradeoffs  
Running inference in-browser is constrained by the device. Some key tradeoffs:

- **WebGPU vs WASM (CPU)**: WebGPU (GPU acceleration) is much faster for large models. Benchmarks (Transformers.js) show a *10–15× speedup* using WebGPU on a discrete GPU for a ~1B model. For example, a TinyLlama (1.1B) achieved ~25–40 tokens/sec on WebGPU vs only 2–5 tokens/sec on CPU/WASM. However, WebGPU has a cold-start cost: shader compilation takes 1–5 seconds on first run. The rule of thumb from [47]: use WebGPU for large (>100M) autoregressive generation or batched work; use WASM (SIMD-accelerated CPU) for small (<100M) models or single-pass tasks (embeddings, classification).  

- **Model Size vs Speed**: A smaller model loads faster and runs faster but may lack capability. Quantization helps: an int4 3B model may run as fast (or faster due to smaller size) than a float32 700M model, at some cost to accuracy.  Multi-threaded WASM (via Web Workers) can improve CPU throughput if available, but this is limited by shared memory constraints.

- **Latency vs Throughput**: For interactive apps, single-input latency matters. In WASM, small models can often answer in <100ms on modern desktop CPUs. Large models (like 3–7B) on WASM may take seconds per query. WebGPU tends to have higher throughput but still has latency (especially with buffer copy overhead). Batching multiple queries can amortize overhead but isn’t always applicable for chat UX.

- **Memory Footprint**: Be mindful of device RAM. Browsers typically cap WASM memory around 2–4GB (depending on platform). A 7B model (quantized) might fit in 2GB, but heavier models (>10B) likely cannot. Edge devices (phones/tablets) often have <4GB total, so limited for LLMs.  

- **Throughput vs Parallelism**: If running multiple modules in parallel (ensembles or pipelines), GPU can parallelize well (especially if modules are small and can run concurrently on shader units). CPU will face contention. Use web workers to parallelize CPU tasks if needed.

- **Example Metrics**: We recommend benchmarking on target devices. For each candidate runtime and model, measure **latency (ms)** for a fixed prompt and **tokens/second** for generation. Also measure memory usage (approx peak WASM memory). The SitePoint study provides a methodology and sample data which can be replicated. For pipelines, measure end-to-end latency (sum of all modules), and note whether async loading masks download time.

## Memory/Compute Constraints on Browsers and Edge  
Browsers and mobile devices impose limits:

- **Memory Limits**: WebAssembly memory is typically limited to 4GiB total. Realistically, available memory for an LLM is less (some is used by the app itself). A quantized 3B model (~2GB) is near the upper limit. Embedded devices (e.g. phones with 8GB RAM) may allocate only 1–2GB to a browser tab. Service Workers/IndexedDB caches also consume memory/storage quotas.  

- **Compute Limits**: Mobile CPUs/GPUs are weaker. WebGPU is supported on Android/Chrome and (slowly) on desktop; Safari’s WebGPU support is still experimental (WASM fallback needed). Desktop GPUs (integrated or discrete) provide hundreds of GFLOPS – decent for small models. Embedded GPUs (mobile SoC) have much less compute bandwidth.

- **Energy and Throttling**: Intensive WASM compute can be battery-heavy. Browsers may throttle background tabs. On-device inference benefits privacy but may not be feasible for heavy loads (e.g. 7B model on phone could drain battery and run very slowly).

- **Storage**: If modules are large, they count against the browser’s storage quota (IndexedDB/Cache). Typical quota might be a few GB. Persistent storage (like FileSystem API) could be explored for very large models, but this complicates UX.

## Security, Privacy, and Sandboxing  
Running models locally has privacy advantages but some security considerations:

- **Privacy**: Inference on-device means user data never leaves the browser. This is ideal for sensitive content (medical, legal, personal). There is no backend to intercept or log queries.  

- **Sandboxing**: Browser runtimes (WASM, WebGPU) are sandboxed by design. WASM cannot arbitrarily access the host beyond its memory. WebGPU cannot read/write outside its GPU buffers. Thus skill modules (being data files) cannot execute malicious code. However, if modules come with JavaScript (e.g. tokenizer code), one must trust that code.  

- **Data Leaks**: A malicious model could be crafted to produce outputs that leak or hallucinate sensitive info, but this risk exists whether local or remote. The difference is that on-device we at least avoid sending raw inputs over the network.  

- **Supply Chain/Integrity**: Downloading model weights from the internet poses supply-chain risk. Use HTTPS and consider verifying checksums/signatures of model files to ensure integrity. One could embed public keys or use Subresource Integrity (SRI) to verify modules.  

- **Permission & CORS**: Fetching from other domains requires CORS headers. Hosting models on your own domain or configuring CORS is necessary. Service Workers should be served over HTTPS to access SharedArrayBuffer (needed for multi-threaded WASM).

- **Isolation**: If the system supports third-party modules, consider running untrusted code in isolated iframes or workers. For example, each module’s inference could happen in a dedicated Web Worker to isolate memory.  

## Licensing, IP, and Model Provenance  
Models carry licenses that affect usage. For example, LLaMA-2 (Apache 2.0 for 7B, non-commercial for 13B+) allows commercial use for smaller sizes. Others like GPT-Neo or Mistral are Apache 2.0 (commercial use ok). TheBloke’s GGUF releases often are MIT/Apache. Proprietary models (OpenAI GPT, Anthropic Claude) cannot be legally distributed. 

When composing modules, each module’s license must be respected. If your app bundles multiple modules, you must comply with all (e.g. include MIT notices, refrain from commercial use if any module is CC BY-NC). For open-source modules, attribution and share-alike must be followed as per their terms.  

Provenance: track where each module came from (source repo, commit hash). For transparency, the app could display “Module X v1.2 (from HF user Y, license Z)” to the developer/user. Embedding metadata (in skill.json) is helpful. Consider only loading models from well-known sources (HF, official repos) or your own vetted registry.  

## Developer UX and API for Composing Skills  
The developer interface should allow easy selection and composition of modules. One can imagine a JavaScript/Rust API like:

```rust
struct SkillModule { 
    name: String, 
    session: wonnx::Session,  // inference session 
    /// Load a skill module from a given URL or path 
    async fn new(name: &str, model_url: &str) -> ModuleSession { ... } 
}
struct Agent {
    modules: Vec<SkillModule>,
}
impl Agent {
    /// Add a new skill by URL (fetches and loads the module).
    async fn add_skill(&mut self, name: &str, url: &str) { ... }
    /// Remove a skill by name.
    fn remove_skill(&mut self, name: &str) { ... }
    /// Run the agent on input, using selected composition strategy.
    async fn ask(&self, input: &str) -> String { ... }
}
```

On the UI side, this might be a web form or CLI where the user picks a set of skill names. Internally, the orchestrator (in Rust/WASM) fetches each chosen module (e.g. `https://cdn.example.com/models/summarizer.onnx`), instantiates a `wonnx::Session`, and stores it. Then upon `ask()`, it routes the input through the modules in order (or via gate). 

Parameters and comments must be documented (the user has advanced skills, so document the *why* of each method).  For example:

```rust
/// Loads an ONNX skill module from the given URL and initializes an inference session.
async fn load_module(url: &str) -> ModuleSession {
    // Fetch model bytes over HTTP
    let bytes = fetch_bytes(url).await.expect("Failed to fetch module");
    // Create an ONNX runtime session (Wonnx example)
    let session = wonnx::Session::from_bytes(&bytes).unwrap();
    ModuleSession { session }
}
```
This snippet shows how modules are fetched and turned into runnable sessions. (In a real app, handle errors and streaming progress.) For composition/orchestration, one might implement a strategy pattern or simple if/then logic. Pseudocode:

```rust
/// Run a question through the agent's skills in sequence.
async fn run_pipeline(&self, query: &str) -> String {
    let mut intermediate = query.to_string();
    for skill in &self.modules {
        intermediate = skill.session.run_text(&intermediate).await;
    }
    intermediate
}
```

Each `SkillModule` could wrap a Wonnx (or llama) session with a common interface (e.g. `run_text`). The orchestrator may also insert an optional gating step:

```rust
if should_use_skill(&input) {
    output = my_skill.session.run_text(&input).await;
} else {
    output = default_model.run_text(&input).await;
}
```

In short, the developer API should abstract module loading, offer functions to compose them (pipeline, gating, etc.), and expose an async inference call. Comments should explain any non-obvious logic (e.g. why a certain skill is applied). The UI could be as simple as checkboxes or as complex as a chat frontend where the agent introspects which skills to use.

## Reference Architecture (Rust/WASM)  

```mermaid
graph LR
    UI[Browser User Interface] -->|select skills| Orchestrator[Agent Orchestrator]
    Orchestrator --> Catalog[Skill Catalog / Registry]
    Orchestrator -->|fetch| Network[Network/API Layer]
    Network --> LocalCache[Cache/IndexedDB]
    Orchestrator --> Router[Routing Logic]
    Router --> WASMEngine[Inference Engine (WASM+WebGPU)]
    WASMEngine -->|invoke| SkillA[Skill Module A]
    WASMEngine -->|invoke| SkillB[Skill Module B]
    SkillA --> GPU[WebGPU/CPU]
    SkillB --> GPU[WebGPU/CPU]
    WASMEngine --> Result[Text Output]
```

*Figure: Example architecture for a browser-based teleodynamic LLM agent. The UI invokes an Orchestrator that manages skill selection, loading (via Network and LocalCache), and routing. The Inference Engine runs in Rust-compiled WASM, using WebGPU/CPU to execute the chosen skill modules and produce the result.*

**Components**:

- **UI**: Web page or app where the user chooses skills and enters queries.
- **Skill Catalog**: A registry of available modules with metadata (possibly local or remote).
- **Network/API Layer**: Handles HTTP fetching of model files. Works with `fetch()` and handles CORS.
- **LocalCache**: IndexedDB or Cache Storage to store downloaded model binaries for offline use.
- **Orchestrator/Router**: Determines which skills to run (could be rule-based or ML-based), forming a pipeline or gate.
- **Inference Engine**: Rust/WASM module that loads skill sessions (e.g. via Wonnx or Burn) and runs them. Uses WebGPU for math and falls back to WASM on CPU.
- **Skill Modules**: The loaded model instances (each with its own Session). They execute on the GPU/CPU.

## Implementation Roadmap and Milestones  

1. **Prototype Inference Core**: Choose a backend (e.g. Wonnx + WebGPU). Implement module loading from URLs, and basic inference of a single model in Rust/WASM. Verify with a known small model (e.g. TinyLlama-117M). *Milestone*: “Hello world” query answered on-device.

2. **Module Packaging & Loader**: Define skill package format (JSON + model file). Write code to fetch and store skill modules (using async fetch and IndexedDB). Support versioning and manifest. *Milestone*: UI module selection triggers download and cache of models.

3. **Orchestration Logic**: Implement composition patterns: at least a fixed pipeline (skills in sequence) and a simple router (e.g. if-else on input). Possibly integrate an external library for intent classification. *Milestone*: Multiple skills can be run in order.

4. **Performance Optimization & WebGPU**: Integrate WebGPU compute paths (through Wonnx). Benchmark and compare to WASM CPU, optimize parameters (batching, threads). Use web workers to offload work. *Milestone*: 10× speedup on GPU vs CPU for a 500M model.

5. **Developer API & UX**: Build a clean API (as shown above) and a minimal UI (HTML/JS) to drive it. Include progress indicators for loading, and a console for logs. Document all functions and parameters. *Milestone*: Usable demo UI with skill toggles.

6. **Security & Licensing Compliance**: Add integrity checks (e.g. SHA-256 verification of module files). Display license info from skill metadata. Ensure CORS is configured. *Milestone*: Trusted loading with warnings for missing licenses.

7. **Testing & Benchmarking Suite**: Develop automated tests with representative tasks. Use example queries (from MTEB or custom). Record latency, throughput, memory usage on different devices/browsers. *Milestone*: Benchmark report comparing WASM vs WebGPU for key modules (e.g. 100M vs 500M vs 1B models).

8. **Deployment and Updates**: Set up CDN or HF repo for skill modules. Implement service worker strategy for background updates. Roll out a beta with a few curated skills. *Milestone*: End-to-end pipeline working with live updates.

**Resources**: A small team of 2–3 engineers (Rust/JS) over ~3–6 months for a prototype. GPUs and test devices for benchmarking. Time to curate open models and adapt formats (may require collaboration with ML researchers).  

**Risks**: Browser limitations (memory, GPU support), licensing entanglements for certain models, complexity of ONNX compatibility, and performance variability across devices. Partial mitigations: focus initially on conservative model sizes (<3B, int4), polyfill fallbacks (WASM) for GPUs, and clear open-source roadmaps.

## Comparative Tables  

**Table A: Candidate Inference Runtimes (Browser)**

| **Runtime/Lib**        | **Language** | **Compute**    | **Device Support**        | **Pros**                                  | **Cons**                              |
|------------------------|--------------|----------------|---------------------------|-------------------------------------------|---------------------------------------|
| **ONNX Runtime Web** | C++/WASM (JS lib) | WASM/CPU, WebGPU, WebNN | All major browsers (WebNN in Chrome); no mobile GPU yet | Mature; broad op support; WASM SIMD; can switch to WebGPU via provider | Large bundle size; partial WebGPU op support; heavyweight |
| **Transformers.js** (v3+) | JavaScript/TypeScript | WebGPU (via ORT), WASM (ORT) | Chrome/Edge, Firefox (flag), Safari (beta) | High-level HuggingFace integration; OpenAI-API compatibility | Still relatively new; heavy JS; requires model conversion |
| **Wonnx** (wonnx-wasm) | Rust & WASM   | WebGPU (wgpu)        | Chrome, Edge (WebGPU); CPU fallback in WASM | Rust-written; uses WebGPU shaders natively; self-contained; growing community | Early-stage; need explicit shape info; smaller community|
| **Burn**                | Rust (WASM)  | WebGPU (wgpu)        | (Same as Wonnx)           | Native Rust framework; ONNX import; auto fusion/opt   | Requires compile-time ONNX conversion; complex setup    |
| **llama-cpp-wasm** | C++ (WASM)   | WASM/CPU            | All major browsers       | Mature LLaMA support; int4 quant; multi-thread | No GPU; slower on large models; depends on Emscripten build |
| **WebLLM**   | JavaScript   | WebGPU + WASM        | Chrome 113+, Edge        | High-performance engine; many prebuilt models; NPM/CDN ready; WebWorker support | Heavier (JSON console output support); JS-only; learning curve |
| **Custom (wgpu in Rust)** | Rust + WGSL  | WebGPU              | Chrome/Edge, (flag on others) | Full control; high efficiency for custom models | Very complex; reinventing kernels; no generality |
| **WebNN (ORT WebNN)**  | JS/WASM      | WebNN API           | Chrome OS/Android only†  | Access specialized hardware (DSP/NNAPI) | Limited support; requires device-specific runtime (Android) |

*Table A: Comparison of browser inference runtimes. “Compute” indicates execution backends.* Note: ORT = ONNX Runtime; †WebNN in Chrome on Android (via WebNN) is experimental.

**Table B: Composition Techniques (Pros/Cons)**

| **Technique**         | **Pros**                              | **Cons / Challenges**              |
|-----------------------|---------------------------------------|------------------------------------|
| **Pipeline**          | Simple, modular, easy to reason about | Latency adds up; error propagation  |
| **Ensemble**          | Increases reliability; uncertainty estimation possible | High compute; output merging needed   |
| **Gating/MoE**        | Scales model capacity; efficient per-input compute | Hard to train gate; risk of idle experts   |
| **Adapters**          | Lightweight fine-tuning; minimal memory overhead per task | Requires underlying common model; cannot mix heterogeneous models easily |
| **Prompt Chaining**   | No new code; leverages LLM itself    | Unreliable; performance not improved  |
| **Retrieval-Augmented (RAG)** | Incorporates external knowledge; reduces hallucination | Requires vector DB; split inference (retrieve + generate)   |
| **Knowledge Routing** | Specializes per domain/topic         | Needs domain classifier or policy     |

*Table B: Composition patterns. Each has trade-offs; gating (MoE) explicitly matches the teleodynamic idea of conditional structure activation.*

## Suggested Benchmarks and Test Harness  
To evaluate system performance, we propose:

- **Load Test**: Measure the time to download and initialize each module (cold start and warm start). Use realistic network conditions (e.g. offline caching vs fresh load).

- **Inference Latency/Throughput**: For each model (say 100M, 500M, 1B sizes), benchmark generation speed (tokens/sec) and latency (per-prompt) on different backends (WASM vs WebGPU). Tools: use `performance.now()` in JS or console.time in Rust/WASM, and ensure consistent input lengths. Use representative prompts (question answering, summarization) and measure end-to-end user-observed time.

- **Composition Overhead**: If running N modules sequentially, measure N× inference time plus any merging logic. Also test parallel loads if applicable (promise all fetches).

- **Memory Profiling**: On browsers with dev tools (Chrome), record memory usage for loaded modules. Ensure no memory leaks. For mobile, use device profiling (Android Chrome remote debug).

- **Quality/Efficacy**: (Optional) Compare outputs to a baseline (if available) to ensure quantization/composition doesn’t degrade correctness too much. Possibly use automated metrics on a small dataset (BLEU, F1, etc.). 

- **Automated Harness**: Build a script (node or wasm test page) that can load modules programmatically, feed test inputs, and log times. Leverage WebDriver or headless browsers for CI. For on-device testing, integrate with BrowserStack or local devices.

By systematically logging these results, you can tune quantization levels, decide when to fallback to smaller models, and guide users on expected performance (e.g. “Estimated response time: Xs”).  

## Deployment and Update Strategies  
Effective deployment of modules involves:

- **CDN Distribution**: Host skill modules on a fast CDN with a versioned path (e.g. `/models/sentiment/v1/`), enabling easy updates by bumping version. Use immutable URLs (content hashes) in production to leverage aggressive caching.

- **Service Worker Updates**: Implement a service worker that checks for updated module versions in the background. The pattern is to keep a “manifest.json” with current versions; on page load the worker fetches this manifest, compares to local cache, and downloads new versions if needed (like a PWA update flow). The “new content available” pattern from PWAs applies here.

- **Canary Releases**: For risky new modules, do phased rollout. Maybe beta testers get a new skill module before global.

- **Automatic Version Fallback**: If a module fails to load or run (due to missing op), fallback to a default behavior (e.g. skip the skill or run a simpler one). This improves robustness.

- **Developer CLI Tool**: Provide a utility (Rust or Node) for packaging modules. It would bundle metadata, convert/quantize models, and optionally publish to an npm registry or model hub with the correct tag.

## Prioritized Next Steps  
1. **Implement Core Inference**: Start with a Rust/WASM proof-of-concept using Wonnx or llama-cpp-wasm and a single tiny model. Verify basic teleprompt working locally.  
2. **Skill Packaging Format**: Define skill directory structure and manifest schema. Build tooling (scripts) to convert and package existing models into this schema.  
3. **Composition Engine**: Prototype basic orchestration (e.g. pipeline of 2-3 skills). Validate correctness of chained outputs.  
4. **Quantization & Memory Tuning**: Experiment with different quantization (int4, int8) and chunk sizes for best tradeoff of speed vs accuracy. Possibly integrate dynamic quantization (selecting quant level at runtime by device capability).  
5. **Benchmark Suite**: Set up automated benchmarks (as above) to measure improvements as we optimize. Focus on realistic cases (like 1000-token generation or interactive QA).  
6. **Cross-Platform Testing**: Test on target browsers (Chrome, Edge, Firefox) and devices (mobile, desktop) to validate compatibility (WebGPU availability, memory usage).  
7. **UX/UI Prototype**: Develop a demo interface for module selection and chat. User feedback on workflow will refine the API design.  
8. **Security Review**: Have third-party audit of the module loading and execution flow to catch any sandbox escapes.  
9. **Documentation & Examples**: Write clear developer docs with examples (like the Rust code above) to onboard others.  

By following this roadmap, one can build a modular LLM framework that exemplifies teleodynamic principles: users “assemble” an LLM by picking skills, and the system only deploys the structure (modules) that are needed, all running locally in the browser. The techniques outlined here (quantization, Rust/WASM, WebGPU) ensure this is feasible with current technology.

**Sources:** We drew on recent academic and industry work (2020–2026) and official docs. For example, the ONNX Runtime Web docs describe browser inference backends; Kappel’s **Teleodynamic AI** concept motivates dynamic module growth; and the Wonnx and Burn projects illustrate Rust-based inference. Hugging Face documentation shows GGUF usage. Benchmark results from SitePoint and tech blogs inform performance tradeoffs.  All citations are provided in context.
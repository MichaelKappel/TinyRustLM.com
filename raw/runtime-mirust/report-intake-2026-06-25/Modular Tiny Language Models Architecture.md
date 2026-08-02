# Modular Tiny Language Models Architecture

**Executive Summary:** We propose an architecture enabling **modular “Tiny” LLMs (TLMs)** that end users combine in-browser to form custom multi-skill agents. Each *skill* is a self-contained mini-LLM (or adapter) with metadata describing its capabilities, inputs/outputs, version, and dependencies. An **agent runtime** written in Rust (compiled to WebAssembly) dynamically loads selected skill modules (shards of model weights and code) and composes them via ensembling, routing, cascades or adapters to answer user queries. The system packages models in efficient formats (e.g. GGUF, ONNX, TFLite), distributes them via HTTP and WebAssembly modules, and uses WebGPU/WebAssembly/WASI for fast local inference. We address threading (via `SharedArrayBuffer`), sandboxing (WASM’s intrinsic isolation), fine-grained permissions, and privacy (no data leaves the browser). Models are signed (e.g. via Sigstore/cosign) and versioned; dependency and provenance metadata ensure traceability. Developers interact via a clean Rust/CLI/TS SDK (with auto-generated API docs) and a component marketplace. Evaluation uses throughput (tokens/s) and quality benchmarks; we propose metrics like *Harmonic Quantization Score* (combining accuracy and latency). We include concrete recommendations, phased roadmap, and risks (e.g. model bias, resource exhaustion).

## 1. Modular Skill Definition

- **Skill Package:** Each TLM *skill* is a folder or WASM component with:
  - A manifest/metadata file (e.g. JSON or `SKILL.md`) listing **name**, **version**, **description**, input/output schema, resource requirements (RAM, GPU), quantization level, and license. For example, an *Agent Skills* format uses a `SKILL.md` with `name`/`description` fields. Metadata might mirror:  
    ```json
    {
      "name": "EnglishToFrenchTranslation",
      "version": "1.0.0",
      "description": "Translates English sentences to French.",
      "inputs": { "text": "string" },
      "outputs": { "translation": "string" },
      "dependencies": ["TinyTokenizer>=1.1"],
      "license": "Apache-2.0"
    }
    ```
  - The model files (weights) and any code (e.g. inference engine). These can be separate shards if the model is split for download.
  - Optionally, code for preprocessing/postprocessing and sample data.
- **Metadata and Discovery:** On load, the browser runtime reads only skill names/descriptions initially. On activation, full metadata and model weights are fetched as needed (progressive disclosure). An **index file** (JSON listing available skills on a CDN or marketplace) allows the UI to show available skill names (analogous to HuggingFace model listings). Each skill’s manifest also includes a unique ID, semantic tags (e.g. “translation”, “QA”), and performance hints (flops, compute needs).
- **Example C# Skill Metadata Class:** For interoperability or GUI tooling, one could define a C# class to represent skill metadata. Using `[Display]` attributes (as requested) for nice labels:  
  ```csharp
  public class SkillMetadata {
      [Display(Name = "Skill Name")]
      public string Name { get; set; }
      [Display(Name = "Skill Version")]
      public string Version { get; set; }
      [Display(Name = "Description")]
      public string Description { get; set; }
      [Display(Name = "Input Schema")]
      public string InputSchema { get; set; }
      [Display(Name = "Output Schema")]
      public string OutputSchema { get; set; }
      [Display(Name = "Dependencies")]
      public string[] Dependencies { get; set; }
      [Display(Name = "License")]
      public string License { get; set; }
  }
  ```
  This ensures any UI or config uses human-readable labels derived from property names. 

## 2. Model Interface / ABI for Composition

- **Unified Interface:** All TLMs expose a common Rust trait (or WebAssembly-exported functions) for inference. For example, a Rust `Trait TinyModel { fn predict(&mut self, input: &str) -> String; }` with documented parameters (see next section). WASM modules exported from Rust code would implement this interface via `wasm-bindgen` or the WASI-NN API. The input/output is typically text or token lists.
- **ABI / Call Protocol:** In WebAssembly, communication follows the WASI-NN or custom binding APIs. For instance, the WASI-NN spec defines calls like `load_model(blob)`, `set_input()`, `compute()`, and `get_output()`. Our design uses a loader function (taking the skill’s bytes), an initializer that binds tensors, and an `infer()` call. Each skill must expose a standardized export (e.g. `_start` or a named function) that the Rust engine can invoke.
- **Skill Object in Rust:** Example Rust struct and trait with documentation comments:  
  ```rust
  /// A tiny LLM skill implementing a specific task.
  pub trait TinyLM {
      /// Loads the model weights from the given path or buffer.
      /// 
      /// # Arguments
      /// * `buffer` - Byte slice of the model file (e.g. GGUF or ONNX format).
      /// 
      /// # Errors
      /// Returns an error if loading fails or format is unsupported.
      fn load(&mut self, buffer: &[u8]) -> Result<(), ModelError>;
      /// Runs inference on the input text and returns the output.
      /// 
      /// # Arguments
      /// * `input` - The input prompt or text to process.
      /// 
      /// # Returns
      /// The model-generated string.
      fn predict(&mut self, input: &str) -> Result<String, InferenceError>;
  }
  /// Example implementation using ONNX Runtime (via wasi-nn).
  pub struct OnnxSkill { /* fields for model, session, etc. */ }
  impl TinyLM for OnnxSkill {
      fn load(&mut self, buffer: &[u8]) -> Result<(), ModelError> {
          // e.g. wasi_nn_load_model("onnx", buffer)
      }
      fn predict(&mut self, input: &str) -> Result<String, InferenceError> {
          // run tokenizer, set_input, compute, get_output via WASI-NN
      }
  }
  ```
  These interfaces allow composing skills in Rust easily. Streaming outputs (token-by-token) can be supported by having `predict` return an iterator or callback for incremental outputs (as in WasmEdge’s GGML plugin).

## 3. Composition Strategies

TLMs can be combined via several strategies:

- **Output Ensemble:** Run multiple skills in parallel on the same input and aggregate their answers. For classification this might be a majority vote; for text it could concatenate answers or use a ranking model to fuse outputs. *Pros:* Increased robustness, diversity. *Cons:* Linear compute cost; may produce conflicting outputs that need reconciliation.  
- **Routers (Gating Networks):** A lightweight model (or heuristic) first analyzes the input and chooses the most appropriate skill to call. For example, a small classifier might route *“translate this”* to a translation skill versus a general chatbot. *Pros:* Reduces compute by only running one model; specialized skills yield better accuracy per task. *Cons:* Requires good routing logic or training data; misrouting hurts quality.
- **Cascades (Fallback Chains):** Chain skills by strength: e.g. run a small, fast model first; if confidence is low, pass to a larger skill. This is like early-exit cascades. *Pros:* Often captures easy queries cheaply, reserving heavy models for hard cases; reduces average cost. *Cons:* Complexity in designing the decision function; latency unpredictable as you might run multiple models sequentially.
- **Mixture-of-Experts (Expert-Advised Routing):** Formally, this is like MoE where each token or chunk can be sent to different experts using a gating network. In practice, one can use a small pretrained router (or fine-tuned LoRA adapter) to combine different sub-models internally. *Pros:* Scales model capacity without scaling FLOPs (sparse compute); each expert is specialized. *Cons:* More complex integration in WASM; may require training a gating network; off-loading some compute to a base model.
- **Adapters and Plugin Modules:** Instead of full models, use small adapter layers (as in prefix-tuning or LoRA) that attach to a base LLM. These adapters carry task-specific knowledge in <1% of parameters. *Pros:* Extremely parameter-efficient; can mix-and-match adapters for composite tasks. *Cons:* Usually require a base model to load, so less “tiny” standalone; often not self-contained in the browser.

**Comparison Table:** The following compares strategies in terms of trade-offs:

| Strategy         | Description                                      | Pros                                        | Cons                                         | Use-Case                  |
|------------------|--------------------------------------------------|---------------------------------------------|----------------------------------------------|---------------------------|
| Output Ensemble  | Run N models, merge outputs (voting/fusion)      | Robust, captures diverse views | High compute (sum of all)                    | High-assurance tasks, scientific QA |
| Router (MoE)     | Route input to one model (or token-level experts) | Lower per-query cost, specialization | Requires routing model (training, latency)   | Multi-domain QA, assistants |
| Cascade          | Sequential (weak → strong), stop early if OK | Cheap on easy queries, reduces average cost | Worst-case cost high, design complexity      | Chatbot with cheaper fallback |
| Adapter Fusion   | Attach lightweight modules to base LLM | Very parameter-efficient; mix tasks         | Needs base model; limited to supported architectures | On-device fine-tuning, domain adaptation |
| Parallel Experts | Parallel few experts, combine (ensemble mode)    | Improves accuracy, trade-offs error modes   | Expensive; combining outputs can be tricky   | Risk-averse systems, code generation |

（*Table: Composition strategies for TLMs. Some approaches overlap: e.g. AdapterFusion is conceptually an ensemble of adapters.*）

For example, we could implement an ensemble in Rust by spawning multiple threads (web workers) each running a skill model, then merging results. Or implement a router by calling a tiny classification model to pick one skill’s `predict()` to use. 

## 4. Packaging and Distribution

- **Model Formats:** We target existing compact formats:
  - **GGUF/GGML:** The lightweight llama.cpp format (binary, quantized-friendly). Single-file, fast to `mmap()`, supports flexible quantization. Great for on-device open LLMs.  
  - **ONNX:** A portable graph + weights format, widely supported in WASM runtimes. Contains compute graph (enabling conversion ease). Good for heterogeneous models but has limited native quant support.  
  - **TFLite:** TensorFlow Lite is optimized for mobile (with flatbuffer format and quant ops). Smaller but less universal (only certain ops); could be used when model originates from TF.  
  - **Safetensors:** Similar to PyTorch, only for weight storage; fast but needs a loader library.  
  - **WASM Modules:** We can also compile a model into a WebAssembly component (e.g. via WasmEdge WASI-NN), bundling both code and weights. These components are distributed via OCI registries or npm-like repos.
- **Sharding & Downloads:** Large models (even 100s MB) can be split into chunks to stream in parallel. Tools like *wllama* split GGUF models into shards for faster pipelined download and loading. We assume HTTP range requests or multiple requests can fetch shards concurrently. A manifest could list shard URLs. This trades off initial load delay vs smaller per-request size.  
- **WASM Packaging:** Each skill can be a self-contained `.wasm` (WASI2) binary containing inference code and possibly weights as embedded data or loaded separately. We can sign and serve these via a registry. Runtimes like WasmEdge or browsers loading via `WebAssembly.instantiateStreaming()` will use these modules directly.  
- **Size vs Latency Trade-offs:** Smaller (fewer params, higher quantization) models run faster but usually at some quality cost. For example, on a modern mobile, a 4-bit 3.8B model ran ~70 tok/s vs ~41 tok/s for an 8B model (∼14 ms vs 24 ms per token). More aggressive quant (Q4→Q2) halves memory but can degrade accuracy (see next section on quant). We would generate charts (tokens/s or ms per token vs model size) to visualize these trade-offs. Benchmarks show *phase-level* profiling benefits from smaller models (latency drops as size shrinks).  
- **Distribution Channels:** Model artifacts and WASM modules can be hosted on CDNs, GitHub Packages, or IPFS-like networks. A model/skill “marketplace” (e.g. a web store) lets users search and click-to-install. Versioning and hashes (SHA256) in metadata ensure integrity. We encourage using OCI registries with provenance (SBOM) and signature support. For example, WasmEdge suggests using SIGSTORE/Cosign to sign WASM plugins, and wasmCloud docs outline signing WASM with Sigstore for secure provenance.

## 5. Browser Runtime (Rust + WebAssembly)

- **Execution Engine:** We propose a Rust-based inference core compiled to WASM (target `wasm32-unknown-unknown` or `wasm32-wasip1/2`), running in a Web Worker. For GPU tasks, WebGPU is used; for CPU, WASM provides the runtime. (Cf. WebLLM uses JS+WASM with WebGPU for kernels; similarly, a Rust engine can call WebGPU via `wgpu` or directly via `web-sys`/`stdweb` bindings.)  
- **WebGPU Acceleration:** WebGPU is hardware-agnostic GPU access in browser. We can compile compute kernels (e.g. GEMM, attention) ahead-of-time into WGSL shaders via tools like MLC-LLM/TVM. Alternatively, leverage frameworks: the `wgpu` Rust crate can launch GPU kernels; or call existing Rust GPU inference (e.g. *lumol*, *tract-rs* with GPU backends). For fast inference, dense matrix multiplies (FlashAttention, etc.) must run on GPU. If on-device WASI runtime is available (like WasmEdge in desktop mode), it could use Vulkan/Metal/etc through WebGPU or native GPU.  
- **Threads:** WebAssembly supports threads (with `SharedArrayBuffer`) to parallelize (e.g. multi-head attention). Modern browsers require cross-origin isolation (COOP/COEP headers) for threads. If enabled, Rust’s `std::thread` (via `wasm-bindgen-rayon`) can exploit multiple CPU cores. If not, inference falls back to single-threaded or uses web worker pools.  
- **Memory:** Default WASM memory is 32-bit (max ~4 GiB). This caps the sum of all loaded model data + heap. In practice, we load <4GB total, so streaming partial weights can manage with <2–3GB. If Memory64 (64-bit WASM) is available, we could exceed 4GB, but this is not yet widely supported in browsers. Careful memory budgeting is needed (e.g. ability to unload weights from unused skills).  
- **WASI and Standards:** While the browser environment uses the WebAssembly JavaScript API, we can also target a WASI runtime (Wasmtime, WasmEdge) for non-browser or future webviews. Using WASI-NN allows calling into optimized native libraries (e.g. ONNXRuntime, TensorFlow) on platforms like IoT or desktop. For web, we rely on WebAssembly engine + WebGPU.  
- **Example Runtime Architecture (Mermaid):** A high-level flowchart for the browser runtime might look like:

  ```mermaid
  flowchart LR
      subgraph Browser
        UI["User Interface (Web)"]
        Worker["Web Worker: Inference Engine"]
      end
      UI -->|Selects skills & gives input| Worker
      subgraph Worker
        Core["Core Engine"]
        M1["Skill Model 1 (WASM)"]
        M2["Skill Model 2 (WASM)"]
      end
      Worker --> Core
      Core --> M1
      Core --> M2
      M1 --> Core
      M2 --> Core
      Core -->|Response| UI
  ```
  This shows the UI handing user queries and chosen skills to the worker, the core engine loading/running each skill module (WebAssembly), and returning results.

- **Security & Sandboxing:** WebAssembly code is sandboxed by default: no arbitrary host access unless explicitly allowed. Our Rust WASM runs in a worker with no special privileges. Browsers enforce same-origin and COOP/COEP policies; model shards are loaded over HTTPS. We limit APIs to safe operations. For example, skills should not have direct network or file system access. Any resource (GPU, memory) usage is mediated by the browser. Thus, each model execution is contained and can’t corrupt the browser or leak data outside. Additional security layers (CSP headers, requiring user consent) can restrict network calls (if any) from skills.  

## 6. Security, Sandboxing, Permissions, Privacy

- **WASM Sandbox:** By design, WebAssembly modules cannot access outside memory or I/O beyond what the embedding JS exposes. Our runtime only exposes inference APIs (tensor buffers, random seeding, etc.) – no networking or file I/O. User data (prompts) stays in local memory. This inherently mitigates many attack surfaces.  
- **Permissions Model:** We recommend declaring required permissions in the skill’s manifest (e.g. “needs GPU compute”, “needs 100MB RAM”). The browser can then warn the user. For privacy, skills should not send data externally. One can implement a policy layer (in Rust) to block any fetch calls from WASM. At minimum, run all inference offline.  
- **Memory Isolation:** If multiple skills run, each is given its own WASM memory segment or instance; they cannot overwrite each other’s memory. The core engine can sandbox each module.  
- **Authentication and Integrity:** All downloaded modules and model shards must be integrity-checked. Use HTTPS/TLS and content hashes. Optionally, use digital signatures (Cosign/Sigstore) to verify authorship. For example, a skill `.wasm` could be OIDC-signed with Cosign, so only signed components run.  
- **Privacy:** Since inference is local, user data never leaves the device (unless user opts in). This allows on-device personalization (e.g. private context stores) without cloud. Of course, if a skill uses a tokenizer or retrieval, those assets must also run locally or use encrypted indexes.  

## 7. Dependency Management, Versioning, Signing

- **Crates and Modules:** In Rust, skills can be packaged as crates or modules; we manage them with `cargo` and publish to a registry or use `wasm-pack`. The skill manifest lists exact versions and hashes of model files (like npm’s package.json or Python’s pip). Semantic versioning (SemVer) applies to skill updates.  
- **Provenance:** Each skill should include an SBOM or at least package-lock-style metadata (hash of model, code version). This is critical for auditing. Tools can generate JSON SBOMs.  
- **Signing and Trust:** We adopt Sigstore (e.g. Cosign) to sign WASM binaries and model files. Before execution, the runtime verifies these signatures against known public keys (or uses Fulcio OIDC). This prevents tampering. The wasmCloud docs exemplify signing WASM via Cosign to bind publisher identity to the artifact.  
- **Registries / Marketplace:** Skills and models can be hosted in an OCI registry (like GHCR), npm registry, or a custom model store. Users “install” skills by name and version. The runtime can support pulling from Docker/OCI (with `curl` or a WASM registry client) and caching. A CLI (`tlm install name@version`) and API to search repository/index will be part of the SDK.

## 8. Resource Management and Graceful Degradation

- **Resource Tracking:** The runtime monitors memory and compute use. If multiple models run concurrently, the engine may enforce a limit (e.g. 500 MB RAM total, 80% CPU) per tab.  
- **Graceful Degradation:** If a skill model is too large or the device is busy, the system can down-prioritize or offload. For example, if GPU VRAM is exhausted, the engine may re-quantize layers on-the-fly (trading CPU for memory) or reduce batch sizes. If latency spikes (e.g. 60 fps rendering needed), the engine can switch to a smaller fallback model.  
- **Adaptive Fidelity:** Use techniques like early-exit in the model (intermediate classifiers to stop generation early) or max token limits if running low on memory/time.  
- **User Feedback:** The UI should show progress (e.g. loading percentage per model shard, inference tokens generated). If a model load fails (OOM or network), the system catches it and can automatically revert to a lighter config or notify the user to disable a skill.  

## 9. Developer UX/SDK, APIs, CLI, Marketplace

- **Rust SDK:** A crate providing APIs to load skills, run models, and compose responses. For example:
  ```rust
  let mut engine = TinyLMEngine::new();
  engine.load_skill("translation", "1.0.0").await?;
  engine.load_skill("qa", "2.1.3").await?;
  let answer = engine.compose_response("Translate 'Hello' to French", &["translation"]).await?;
  ```
  Detailed RustDocs (with summaries from code comments) will explain each method and parameter.  
- **CLI Tools:** A command-line interface for managing skills, e.g., `tlm-cli install skill-name --version x.y` and `tlm-cli run skill-name --input "..."`. This can use WASI or run in Node/Electron.  
- **TypeScript Frontend:** (For web apps) we can provide TypeScript bindings (via `wasm-bindgen`) for embedding the engine. We’ll document any non-standard choices (e.g. using `EventEmitter` vs `async/await`) and prefer idiomatic TS where possible.  
- **Skill Marketplace:** A web portal listing all skills with search/filter (by tags, creators, license). Users click “Add to Browser” which triggers the runtime to fetch and install the selected skill. Devs can publish skills via a simple registry API.  
- **API Patterns:** We adopt the OpenAI-style request/response JSON format (prompt in, text out) for simplicity and compatibility. The engine’s serviceworker-like interface (cf. WebLLM’s `ServiceWorkerMLCEngine`) could be mimicked by a JS service worker proxy that communicates with the Rust core.  

## 10. Evaluation Metrics and Testing

- **Benchmarking:** Use standard NLP benchmarks for each skill (e.g. SQuAD for QA, WMT for translation, etc.), plus *latency* benchmarks on target devices (smartphones, laptops). Measure throughput (tokens/sec) and memory usage. The WebLLM paper reports tokens/sec for quantized models.  
- **Composite Metrics:** For multitask composition, we propose an *accuracy-latency Pareto frontier* metric. E.g. maintain normalized accuracy vs inference time on representative tasks; find the “knee” model as Sweet Spot. We also adopt the *Harmonic Quantization Score* (from lm-Meter) that balances quality and speed.  
- **Testing:** Unit tests for each skill (using the engine mock) and integration tests for pipelines (e.g. QA-translate chain). The engine should include fuzzing for inputs and memory edge cases. Cross-platform tests on different browsers/devices are needed (e.g. Chrome, Safari with and without GPU).  
- **Security Testing:** Verify sandboxing by attempting illegal ops (JS shouldn’t permit memory exports). Check COSIGN signatures logic.  

## 11. Example Workflow and Code Sketches

### Example Workflow
1. **Selection:** User opens the app UI, selects “Translator” and “Summarizer” from skill list.  
2. **Download:** The engine downloads `translator-v1.2.gguf` and `summarizer-v0.9.onnx` (as shards), verifying hashes/signatures.  
3. **Init:** In a Web Worker, it instantiates two skills: `Translator` and `Summarizer`.  
4. **Inference Pipeline:** User types “Explain Schrödinger’s cat in simple terms”. Engine first calls `Translator.predict()` with the prompt. The translator skill returns a French translation. Then it feeds that into `Summarizer.predict()`.  
5. **Composition:** The outputs are combined (in this case sequential composition). If instead an ensemble had been chosen, both might run in parallel and results merged.  
6. **Results:** The final text is returned to UI.  

### Rust Code Sketch
```rust
/// Core engine managing skills.
pub struct TinyLMEngine {
    skills: HashMap<String, Box<dyn TinyLM>>,
}

impl TinyLMEngine {
    /// Load a skill by name and version, downloading if needed.
    pub async fn load_skill(&mut self, name: &str, version: &str) -> Result<(), Error> {
        // Fetch metadata and model bytes, verify signature.
        let manifest = fetch_manifest(name, version).await?;
        let model_bytes = download_model(&manifest.model_url).await?;
        let mut skill: Box<dyn TinyLM> = match manifest.format.as_str() {
            "gguf" => Box::new(GGUFSkill::new()),
            "onnx" => Box::new(OnnxSkill::new()),
            _ => return Err("Unsupported format".into()),
        };
        skill.load(&model_bytes)?;
        self.skills.insert(name.to_string(), skill);
        Ok(())
    }

    /// Compose a response by running specified skills in sequence or ensemble.
    pub async fn compose_response(&mut self, input: &str, skill_order: &[&str]) 
        -> Result<String, Error> 
    {
        let mut current = input.to_string();
        for &skill_name in skill_order {
            if let Some(skill) = self.skills.get_mut(skill_name) {
                current = skill.predict(&current)?;
            }
        }
        Ok(current)
    }
}
```
This sketch shows loading skills dynamically and chaining predictions. All parameters and return values have clear docs (omitted here for brevity). 

### WASM Example (WASI-NN)
For running an ONNX skill in WASM via WASI-NN (using the wasi-nn API):
```rust
use wasi_nn::*;
pub struct OnnxSkill {
    ctx: ExecutionContext,
    model_id: GraphEncoding,
}

impl TinyLM for OnnxSkill {
    fn load(&mut self, buffer: &[u8]) -> Result<(), ModelError> {
        // Load model bytes into WASI-NN (ONNX encoding)
        let id = load_model(GraphEncoding::Onnx, buffer, &[]).unwrap();
        let ctx = init_execution_context(id, 1, 1, &[1, input_len]);
        self.model_id = id;
        self.ctx = ctx;
        Ok(())
    }

    fn predict(&mut self, input: &str) -> Result<String, InferenceError> {
        let tokens = tokenizer.encode(input);
        set_input(self.model_id, &self.ctx, &[0], &tokens, TensorType::I32)?;
        compute(self.model_id, &self.ctx)?;
        let output = get_output(self.model_id, &self.ctx, 0)?;
        let text = tokenizer.decode(&output);
        Ok(text)
    }
}
```
Here `load_model`, `init_execution_context`, `set_input`, etc. are WASI-NN syscalls. The encoding (`GraphEncoding::Onnx`) tells it how to interpret bytes. This runs entirely in WASM (in the WasmEdge or Wasmtime engine with WASI-NN support). In a browser, a similar pattern holds if we polyfill or use `emscripten`-compiled ONNX runtime (like WebLLM did with Emscripten for C++).

## 12. Compatibility with Existing Formats and Quantization

- **ONNX:** Directly supported via WASI-NN (which can load ONNX models), or via browser ONNX.js/WebGPU (via the *transformers.js* project). ONNX’s compute graph makes integration straightforward across frameworks.  
- **GGML/GGUF:** Popular in llama.cpp and community models. Many tools (llama.cpp, vLLM) support GGUF; we can use or port llama.cpp to Rust or call it via WASM (Emscripten) for these models.  
- **TFLite:** TensorFlow Lite models (FlatBuffers) can run via WASM (there are web libraries), or via WASI-NN if compiled support.  
- **Quantization:** We support weight quant (4-bit, 8-bit, etc). Quantized models reduce memory and compute. The engine will include quantization schemas (e.g. Q4_K_M, IQ4) as in GGUF. The tradeoff is slight accuracy loss. We recommend shipping quantized models for tiny LLMs (as WebLLM and llama.cpp do) to fit mobile budgets. The Harmonic Quantization Score ensures balanced quant: only accept a quantized model if the combined accuracy+latency score is good.  
- **Conversion Tools:** Provide utilities (Rust or CLI) to convert PyTorch/TF checkpoint to target format (leveraging HF/llama.cpp scripts). For example, converting to GGUF for browser use (HuggingFace’s HugQLLAMA tools) or exporting to ONNX+quantizing.

## 13. Licensing and Legal

- **Model Licenses:** Developers must respect each model’s license. Common licenses include Apache 2.0, MIT, CC BY/SA (for smaller models) or OAI’s “OpenRAIL” variants. For instance, a skill’s metadata should indicate its license (e.g. Apache-2.0, MIT, CC-BY-NC, etc). Some proprietary models (GPT-3/4, Claude) *cannot* be included directly; only allow truly open or appropriately licensed weights.  
- **Usage Restrictions:** Even open weights may have usage limits (e.g. “no illegal content”, or non-commercial clauses). The marketplace should enforce or highlight these.  
- **Export Controls:** Tiny models mostly fall under “mass-market” general AI, but if any model uses advanced encryption or is from sensitive domains, check local regulations.  
- **Privacy Laws:** As inference is local, we meet GDPR/CCPA better (user data never leaves device). However, if a skill ingests sensitive user data, the skill’s description should note privacy considerations.  

## 14. Recommendations, Roadmap, Risks

- **Phase 1:** Implement core engine (Rust/WASM) with ONNX and GGUF support, basic composition (sequential). Build simple UI to select models. Start with a few curated skills.  
- **Phase 2:** Add advanced composition (router, cascade), GPU/WebGPU kernels, multi-threading (with COOP/COEP support). Develop CLI/SDK. Set up signing infrastructure (Cosign).  
- **Phase 3:** Launch developer marketplace, enabling skill publishing and discovery. Refine evaluation suite (benchmarks, user testing).  
- **Risks & Mitigations:**  
  - *Resource Exhaustion:* Large models may slow or crash browser. Mitigate by strict memory limits, adaptive loading, and fallback to simpler models.  
  - *Security:* Malicious WASM could attempt side-channel or excessive compute. Mitigate by sandbox, auditing skills, and requiring signatures.  
  - *Quality & Bias:* Small models have limited knowledge; ensuring answers are correct is harder. Mitigation: ensemble and cascading strategies, and user warnings about scope.  
  - *Standards Adoption:* Without consensus on skill format, fragmentation is possible. We recommend adhering to open standards (Agent Skills spec) and common libraries.  

**Conclusion:** This architecture leverages recent advances (WebGPU WASM engines, small-model research, and modular agent standards) to make versatile on-device AI possible. It balances performance, security, and developer ergonomics, and is extensible for future models and hardware. 


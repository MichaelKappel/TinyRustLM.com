# Executive Recommendation  

For TinyRustLM’s local assistant platform, we recommend **prioritizing a dense-Transformer baseline augmented with selective hybrid/Liquid support**, rather than branching immediately into a very different architecture or outsourcing to external backends. In practice this means: continue refining the current dense path (e.g. high-quality 0.2–2B Transformers), **add first-class support for LFM2** (Liquid’s hybrid Liquid/Conv-Transformer models) as an experimental plug-in, and **prepare for one additional hybrid architecture** (such as an SSM-based model like Falcon-H1/IBM Granite) as a next phase. Externally hosting or relying on a black-box backend is high-risk for TinyRustLM’s goals (P2P distribution, provenance control, offline use). This combined approach balances quality, performance, and license/practicality considerations.  

- **Dense-first:** Dense Transformers (e.g. Qwen3.x, SmolLM, Llama2/3) are well-understood, widely supported in WASM runtimes, and carry permissive licenses (Apache/MIT). We should continue to optimize and expand the dense Transformer line (building on current knowledge).  
- **LFM2 hybrid trial:** LiquidAI’s LFM2/LFM2.5 models have shown very strong quality at ~1B size – e.g. *LFM2.5-1.2B-Thinking* outperformed Qwen3-1.7B on reasoning benchmarks by ~30% and is claimed 2× faster to prefill/decode than Qwen3. Thus, we should integrate LFM2 support via its ONNX/MLC formats and test for reliability. However, the LFM Open License has a commercial-use threshold (<$10M revenue) and special derivative rules, so LFM models may be used only under controlled, research-grade conditions. We should **defer large-scale reliance on LFM2** until (if ever) its license evolves or a clear legal strategy emerges.  
- **Additional hybrid architecture:** The emerging state-space/SSM hybrid families (e.g. Falcon-H1, IBM Granite) promise high quality in extremely compact models. For example, Falcon-H1’s 0.5B model reportedly matches typical 7B performance with 256K context, and IBM’s Granite-4.0 provides “70% lower memory use and 2× faster inference” than similar models. These models use a parallel Attention + Mamba (SSM) design, requiring new kernels. We should **schedule one pilot hybrid model** (e.g. Granite-350M or H1-0.5B) once stable WASM kernels are available (which may take 6–12 months of watch). Its license (Apache 2.0) is permissive, which is a major plus.  
- **Avoid early external backend:** Relying on an external service or process (e.g. a Black-Box LLM server) would violate TinyRustLM’s constraints (local model bytes, provenance, P2P). It also increases supply-chain and API risk. All candidate models of interest are now released publicly with checkpoints and source, so we should keep inference entirely local.  

In summary, **build a best-in-class dense Transformer suite, experiment cautiously with Liquid/LFM2, and plan one hybrid SSM/SMM model**. This hybrid build/port mix hedges on quality and license. All model artifacts must remain user-redistributable and provenance-tracked.  

# Revision-Pinned Architecture and Model Matrix  

We catalog primary-source details for each candidate family (prefix “bibkey” in source citations refers to a fixed version of documentation/model card):

- **Liquid Flow Models (LFM2/LFM2.5)** – *Architecture:* New “Liquid” hybrid: short convolutions + gated-attention (10 Conv+6 Attn layers for 1.2B). *Models:* 0.35B, 0.7B, 1.2B (dense posttraining); 1.2B Instruct/Thinking (LFM2.5). *Parameters:* ~350M, 700M, 1.17B active. *Context:* 32K tokens. *Formats:* HF-safetensors, ONNX, MLC-LLM (i.e. .onnx, .ml4x). *Frameworks:* PyTorch (HuggingFace), export via MLX. *Edge runtimes:* via MLC-LLM (TVM) or ONNX. *Instruction-tuned:* yes (LFM2.5-Instruct, +Thinking). *Languages:* primarily English. *Release:* LFM2 (Apr 2025), LFM2.5 (Jan 2026). *License:* LFM Open License v1.0. *Status:* Public, research-focused (no commercial build yet).  

- **Qwen-3/Qwen-3.5 (Alibaba)** – *Architecture:* Dense Transformer (Qwen3) and “Gated DeltaNet” variant (Qwen3.5). In Qwen3.5 small: 6×(3×Gated-DeltaNet + 1×Gated-Attn) blocks. *Models:* Qwen3: 0.6B, 1.7B, 4B, 8B,…. Qwen3.5 small: 0.8B, 2B, 4B, 9B (dense). *Parameters:* e.g. Qwen3-1.7B (≈1.68B), Qwen3.5-0.8B (0.8B). *Context:* Qwen3: 32K (smaller models) to 128K (8B+); Qwen3.5: 262K for all sizes. *Formats:* Transformers weights (safetensors), quantizable by GPTQ. *Framework:* PyTorch/HF. *Edge:* Supported in llama.cpp (FP16/FP32) and BitsAndBytes int4. *Instruct-tuned:* Yes, Qwen3/3.5 base + Instruct variants (HF lists all). *Languages:* Multilingual (20+ languages). *Release:* Qwen3 (Dec 2024); Qwen3.5 (Mar 2026). *License:* Apache 2.0 (open).  

- **SmolLM (AI21/HF)** – *Architecture:* Dense Transformer (Cosmo architecture variant), uses Grouped Query Attention (GQA) with 4 groups. *Models:* 135M, 360M, 1.7B parameters. *Context:* 8K tokens (English-only). *Formats:* HF-safetensors (PyTorch). *Framework:* PyTorch. *Edge:* Supported via llama.cpp and quant (GPTQ-int4 available for 1.7B). *Instruction-tuned:* Released with instruct on 1.7B. *Languages:* English. *Release:* July 2024. *License:* Apache 2.0.  

- **RWKV (BlinkDL RNN)** – *Architecture:* RNN-inspired recurrent language model (RWKV-v4/5/6/7 families) with “continuous RNN” (SSM-like) layers. *Models:* RWKV-4/5/6/7 “World” series from ~0.1B up to 14B. Notable small sizes: 0.4B, 1.5B, 2.9B (for RWKV-7). *Context:* Effectively infinite (no fixed window), but pretrained up to 4096 tokens (older models). *Formats:* PyTorch (.pth). *Framework:* PyTorch; also RWKV.cpp for inference. *Edge:* Supported via RWKV.cpp (C++). *Instruction-tuned:* Some fine-tuned chat versions exist (e.g. RWKV-4-World-14B-Chat). *Languages:* English (multilang training exists but main is English). *Release:* Continuously updated; RWKV-7-World-1.5B released 2025. *License:* Apache 2.0.  

- **Falcon-H1 (TII)** – *Architecture:* Hybrid Transformer+SSM (Mamba-2). Each “hybrid mixer” block runs parallel Attention and Mamba heads. *Models:* 0.5B, 1.5B (standard and “Deep”). *Parameters:* H1-0.5B ≈0.5B; H1-1.5B (~1.5B); H1-1.5B-Deep also ~1.5B active. *Context:* Up to 256K tokens. *Formats:* HF-safetensors (PyTorch). *Framework:* PyTorch; planning support via huggingface, possibly converted to GGUF. *Edge:* Pending; requires a new WASM kernel or direct support of Mamba-2 layers (not in llama.cpp yet). *Instruct:* Instruct-tuned versions are released. *Languages:* Multilingual (18 languages). *Release:* May 2025. *License:* Falcon LLM License v1.0 (custom TII license). *Status:* Public but license *not* Apache/MIT (restrictive, royalty-trigger).  

- **IBM Granite 4.0** – *Architecture:* Hybrid Mamba-2/Transformer, with Mixture-of-Experts in larger variants. *Models:* Nano family: 350M and 1B. Each in “dense” and “hybrid” (H) versions. *Parameters:* Dense-350M (0.35B), Dense-1B (1.0B); Hybrid-350M (~0.35B in parameters but uses Mamba internally), Hybrid-1B (~1.5B active). *Context:* 256K tokens. *Formats:* HF-safetensors. *Framework:* PyTorch. *Edge:* Planned support via huggingface and eventual WASM kernels. *Instruct:* Base and instruct versions provided. *Languages:* Enterprise-focused English and major world languages. *Release:* Oct 2025 (Nano). *License:* Apache 2.0.  

*Candidates Excluded:* We omit completely proprietary or unreleased families (e.g. GPT-4-style black boxes, or models with closed checkpoints). All above have usable checkpoints and documented licenses. Jamba (AI21) is 12B+ and falls outside our parameter range (and uses a custom “Jamba Open Model License”). We mark no candidates as “gated” or “incomplete” among the above – all have available weights and code to at least run inference.  

# Product-Relevant Architecture Comparison  

Below we compare key technical trade-offs for TinyRustLM’s use case:

- **Quality Potential:** Current evidence suggests hybrids and Liquid designs can *punch above their weight*. For example, *LFM2.5-1.2B* (“thinking” variant) significantly outperforms a 1.7B Qwen3 dense model on reasoning tasks. Falcon-H1 claims its **0.5B model equals a typical 7B Transformer** in performance, and Granite states its small models “achieve industry-leading results” on agentic benchmarks. Dense models like Qwen and Smol achieve strong general quality per parameter but typically need ~2–3× more parameters to match these new hybrids. We should experimentally verify these claims, but they suggest that **hybrid (SSM+Attention) and Liquid architectures can yield higher-quality inference in tight compute**.  

- **Prefill/Decode Speed:** Liquid architectures like LFM2 use short convolutions for “prefill” speed. LFM2 reportedly decodes/prefills **2× faster than Qwen3** on the same hardware. Hybrid SSM models (Falcon, Granite) perform standard attention per token, so their decode is similar to Transformers. Recurrent/RNN models (RWKV) have O(1) memory and inference complexity per step, so they can decode in steady time each token, with no caching overhead (each step costs a fixed MLP/SSM pass). Transformers without caching do O(N²) to prefill, but with caching decode is ~O(N) per token. In practice, RNN/SSM steps can be faster for long contexts, but pure Transformers benefit from optimized matrix multiply in WASM. We expect LFM/RWKV to have notably faster token generation per parameter, but actual speed also depends on library support.  

- **Context Memory & Long-Range:** RNN/SSM hybrids (RWKV, Mamba-based) have theoretical “infinite” context, using constant memory per token. Practically, we bind context (e.g. 4096 for RWKV pretraining or 256K for H1/Granite) for training and hardware limits. Transformer-based models’ memory grows ~O(N²) for attention, but caching reduces to O(N) for decode. LFM2 and Granite/H1 extend Transformers with 32K–256K windows (via sparse or block attention). For typical chat, 32K–64K is ample; for very long content, hybrids could have an edge in managing context.  

- **Browser/Runtime Complexity:** Dense Transformers are widely implemented in WASM (via llama.cpp or ONNX) and have mature kernels. RNN/SSM (RWKV) needs an RNN kernel but RWKV.cpp already provides that. Liquid models require implementing *LIV Conv + gated-attention* blocks; these exist in LFM’s ONNX export and MLC runtime, but need a WASM-compatible kernel (MLC-LLM covers ONNX). SSM (Mamba-2) requires implementing linear recurrence per head – this is nonstandard in current WASM libs. Thus, **hybrid models need new kernels or fallback to slower implementations**, which is a maintenance risk. Transformers and RWKV use well-known math ops.  

- **Quantization Maturity:** All families except Falcon are quantizable. Qwen/Smol (dense) support GPTQ-int4 (HF community provides quant). RWKV has been quantized by the community (8-bit, 4-bit). LFM2 supports ONNX/MLC, enabling MLC quant or TVM flows. Granite/H1 do not yet have public 4-bit support (2025-26), but likely can be converted via HF + GPTQ. Falcon’s custom license has blocked low-level usage by the community, and its “ExpertsInt8” technique is not public. So **Apache/MIT families have strong quant support**, whereas proprietary licenses hinder Falcon's broad quant.  

- **Determinism:** All these models are deterministic given fixed weights and seeds. Mixture-of-Experts (Granite-4.0-H-Small, 32B total) has non-determinism in expert selection, but smaller Nano models are single-expert or dilutely gated, so we expect stable outputs. RNNs/SSM are fully deterministic. We should benchmark consistency (identical outputs vs. reference model) for each converted implementation.  

- **Tool-Calling and Agentic Tasks:** Most models can output structured JSON and follow function-call protocols. No architecture inherently prohibits tool formats, though model training must include such tokens. According to Granite docs, 4.0 Nano is explicitly tested for tool-calling. We should verify each model’s ability on JSON/tool benchmarks.  

- **Multi-Turn State/Session Reset:** Transformers “forget” history by clearing cache, RNNs/SMM must explicitly reset hidden state between sessions. This is straightforward (reinitialize hidden arrays). The main difference is implementation: in RWKV, resetting to zero state flushes memory; in hybrids, we just clear caches. User-level impact is minimal if handled correctly.  

- **Conversion Complexity:** Converting model weights to TinyRustLM’s `.slm` format should be similar for most families: pure Transformers (Qwen, Smol, Granite-dense) export directly via HF to GGUF or safetensors. RWKV and LFM have official ONNX exports. Mamba-based and LFM require custom converters (e.g. Llama-cpp or custom), but HF provides ONNX/MLX to ease this. Our plan: first convert via HuggingFace or MLC-LLM, then optimize. Each model’s *model card and tokenizer* must also be archived.  

- **Maintenance and Support:** Dense Transformer implementations (like GPT or Llama) benefit from the largest open-source ecosystem (llama.cpp, vLLM, transformers). Newer architectures mean extra libraries: e.g. RWKV.cpp for RWKV, MLC-LLM runtime for LFM2, and future SSM kernels for H1. That *raises support cost*. Hybrid models also risk “API drift” if their frameworks evolve differently. Weighing this, **dense path has lowest long-term maintenance risk**. Hybrid backends should be used sparingly and monitored closely.  

In short, **dense Transformers** (Qwen/Smol/Llama2) are safest on stability and ecosystem. **Liquid/conv-attention** (LFM2) offers speed-ups and quality gains with moderate complexity (already has ONNX/MLX tooling). **SSM/hybrid models** (Falcon-H1, IBM Granite) deliver high quality per parameter (supported by their benchmarks) but require new kernels and careful implementation. **RNN (RWKV)** is straightforward, constant-memory, and Apache-licensed, making it a useful niche (e.g. very long contexts or specialized tasks).  

# License and Derivative-Artifact Issue Matrix  

The following summarizes licensing and obligations for each family’s model weights and derived artifacts. We focus on redistribution, derivatives, patents, notices, and special clauses:

- **Apache-2.0 (Permissive Open Source)** – Applies to **Qwen**, **SmolLM**, **Granite**, and **RWKV** families. Under Apache-2.0, users have broad rights (commercial and non-commercial) to use, distribute, and modify. Must include a copy of the Apache license and retain all copyright/patent/NOTICE attributions in redistributed or modified files. Patent grants apply to the contributed work, and termination clauses are standard (e.g. patent retaliation). Critically, *no copyleft*: you can keep derived models or fine-tunings proprietary. Downstream consumers must also receive the license and notices. (Example: IBM Granite’s Nano models explicitly “all models are Apache 2.0”.)  

- **LFM Open License v1.0 (LiquidAI)** – This is Apache-2.0 + commercial use limits. Key points: **Redistribution:** allowed “in any medium,” subject to standard attribution conditions (include license, keep copyright notices). **Derivative Works:** permitted but still bound by the license terms. Notably, *“Derivative Works” in LFM’s terms include any ML model trained on outputs* of LFM, meaning fine-tuned or distilled models remain under LFM terms. **Commercial Use:** Free use is allowed only for companies with <\$10M revenue (the “Threshold”). Exceeding the threshold requires contacting LiquidAI and likely a paid license. Research, nonprofit, or user-driven noncommercial use has no threshold. **Notice/Marking:** Must preserve all original notices (as Apache requires). **Patents:** Patent grants are explicitly conditioned on the same revenue threshold; if you sue for patents, your license terminates (Apache standard). **Trademarks:** Standard – can’t use LiquidAI trademarks except as required for attribution. **Termination:** Similar to Apache with extra clause: violation of the commercial-use condition terminates the license. In practice, LFM’s condition means *commercial deployment is restricted*. TinyRustLM can use LFM weights for research/agentic demos, but the license forbids shipping them to large commercial users without negotiation.  

- **Falcon LLM License v1.0 (TII)** – Custom. Based on Apache-2.0 but **strongly restrictive**. It requires royalty payments for *any* “Commercial Use” (no hard revenue cap, just any revenue-attributable use). It explicitly defines **Derivative Works** to include ML models trained on outputs, covering fine-tuning/distillation. Redistribution requires contacting TII’s sales if used beyond free research. Critically, Falcon-H1 models (even at 0.5B) use this license, so they are **not free to redistribute** in commercial products. For TinyRustLM, Falcon-H1 support is an option, but **license terms likely forbid general redistribution** of those weights. (We must treat it as research-only.)  

- **Comparisons:** Unlike Apache/MIT, **LFM’s and Falcon’s licenses are not “Apache-like”**. LFM’s extra threshold and Falcon’s royalty clause impose hidden obligations. MIT licenses (few models here use MIT) would be even simpler (no notice requirement), but none of our main candidates uses MIT. In all cases, we must preserve copyrights and include a `LICENSE` text with any distributed model (Apache requires a NOTICE file if one was provided). For LFM, this means including the LFM license file in the model bundle.  

**Questions for counsel:** We should verify: (1) For LFM, does exporting quantized/converted weights constitute a derivative work under US law, given license terms? (2) For LFM and Falcon, how to handle mixed-model systems (if a user’s pipeline uses an LFM model behind a plugin)? (3) If merging adapters (e.g. LoRA) from two differently-licensed sources, how do notices apply? (4) If LFM-model outputs are used to train a new model, is that a “Derivative Work” triggering license? (Current LFM text suggests yes, but legal nuance is unsettled.) We flag these for legal review.  

# Provenance, SBOM, and Revocation Design  

We must rigorously track each model artifact’s origin. We adopt an **AI SBOM (Software Bill of Materials) approach** for models, akin to best practices. Each model entry in our catalog will include:

- **Immutable Source Reference:** The exact repository and commit (revision hash) or release tag of upstream code/weights. E.g. a Git commit or HF model version tag.  
- **License Hash:** A SHA-256 of the license text and model card (to detect changes).  
- **Complete File List & Checksums:** Every file (weights, tokenizer, config, README) with SHA-256 digest. Use Git LFS object IDs or content hashes.  
- **Tokenizer and Template IDs:** The exact tokenizer vocab file (with checksum) and chat template text, since these affect output.  
- **Converter/Runtimes:** Record versions of HF transformers, llama.cpp or ONNX runtime used to convert/run the model.  
- **Model Card Snapshot:** Archive the model card (HF or paper) so its documented abilities and intended use are recorded.  
- **SBOM Record:** Combine the above into a structured SBOM-like manifest (e.g. JSON) for each published artifact.  

On any upstream change (e.g. a repo branch is force-updated or license is amended), we treat it as a new model version. Our published artifacts will include a *license reference and checksum*, and digital signatures where possible, so clients can detect mismatches. If an upstream suddenly changes license to a disallowed one, our pipeline will flag this (the license hash changed). We will **not overwrite existing artifact entries**; new versions get new provenance records.  

If an upstream weight is revoked (e.g. discovered bug or license violation), we provide a revocation notice in our catalog and increment the version of our artifact (and SBOM) to indicate supersession. Clients must be able to verify the origin (e.g. via embedded checksums or signed attestations).  

# Platform-Strategy Comparison  

We compare four high-level strategies for TinyRustLM’s platform: **(A) Dense-only optimization**, **(B) Add first-class LFM2 support**, **(C) Multiple-architecture plugins**, **(D) Strict external-backend isolation**.  

- **(A) Dense-Only:** Focus solely on Transformers (and RNN/SSM through RWKV). *TCB:* Minimal (existing llama.cpp/C++)
. *Browser:* Mature WASM support (llama.cpp) for any dense model. *Size:* All kernels optimized. *Sandbox:* Single-process, fewer attack surfaces. *Artifact Identity:* Clean, all models in same format. *API Drift:* Low (HF Transformers stable). *Supply Risk:* Low; dependencies are well-known. *P2P Behavior:* Simple (all peers run same runtime). *Testing:* Only one runtime, easier QA. *Support:* Straightforward documentation.  
  - **Downside:** Misses potential speed/quality gains of hybrids.  

- **(B) First-Class LFM2:** As (A) plus built-in support for LFM2 models. *TCB:* Moderate – adds MLC-LLM or ONNX runtime to TCB. *Browser:* Requires adding MLC-LLM’s WASM (if on-device) or fall back to ONNX. *Size:* Increases due to extra libs. *Sandbox:* Additional code, but sandboxed in WASM. *Artifact ID:* LFM models in separate namespace. *API Drift:* Some risk if LFM library updates. *Supply Risk:* Low (LiquidAI provides open formats). *P2P:* If a peer lacks LFM code, might skip LFM models. *Testing:* Need to test LFM path. *Support:* Requires documentation on using LFM prompts.  
  - **Benefit:** Gains LFM performance/quality in-device. *Quant/Maintenance:* MLC-LLM brings quant support (e.g. FP8 experiments). *License:* LFM’s license must be included in each LFM artifact.  

- **(C) Multiple-Architecture Plugins:** Support *all* distinct engines (Transformer, Liquid, SSM, RNN). Each model family uses its own “engine” module (e.g. llama.cpp, MLC-LLM, RWKV.cpp, new SSM engine). *TCB:* Large (many codebases). *Browser:* Complex; either bundle multiple WASM kernels or use fallback (e.g. WebGL for conv?). *Size:* Very large binary (all dependencies). *Sandbox:* Increased risk (more code to isolate). *Artifact ID:* Must tag which engine used. *API Drift:* High risk (each engine may change). *Supply:* Harder to audit supply chain with multiple repos. *P2P:* Complicated if different peers have different subsets of engines. *Testing:* Very heavy – need to test each engine on each model. *Support:* Complex (users may ask why one model fails in one plugin but not another).  
  - **Benefit:** Ultimate flexibility (can run any current model architecture). *Quant:* Each engine has own path. *Maintenance Risk:* High.  

- **(D) External-Backend (Strict Isolation):** Only dense models run natively; other architectures call out to an isolated service or user-run microservice (e.g. user could run a separate WASM container or external process for LFM/SSM models). *TCB:* Small core; heavy functionality delegated. *Browser:* Only needs dense engine. *Size:* Minimal core. *Sandbox:* Only trust core, others are out-of-band. *Artifact ID:* Keep distinct (external ones not in our catalog bytes). *API Drift:* Backends free to evolve, but we lock API interface. *Supply:* Third-party risk (embedding e.g. a foreign runtime). *P2P:* Non-native; heavy overhead. *Testing:* Can test core, but not guarantee external service quality. *Support:* Users must set up secondary tools (bad UX).  
  - **Benefit:** Doesn’t bloat core package with exotic code. *Risk:* Loses full control – e.g. if an external SSM WASM has a security hole, it’s outside our sandbox. *Use Case:* Might be used for a small specialized plugin (only if very mature and standardized).  

**Recommendation:** Strategy (B) – first-class LFM2 support – is the best balance. It covers new high-potential models without exploding complexity. Strategy (A) alone is strong too, but misses out on the demonstrated Liquid gains. Strategy (C) adds too much risk/size for now. Strategy (D) has UX and risk downsides (and P2P forbids hidden servers).  

# Weighted Decision Model and Sensitivity Analysis  

To quantify trade-offs, we propose a scoring model with criteria: **Assistant Quality (Q)**, **Browser Memory (M)**, **Latency/Speed (S)**, **License Usability (L)**, **Source Stability (St)**, **Implementation Cost (C)**, **Testability (T)**, **Quantization Maturity (Qm)**, **Maintenance Risk (R)**. Each architecture family gets a score 0–10 in each. We then assign subjective weights *w* to each criterion (sum=1) and compute a weighted sum score. For example:  

- Q (Quality, w≈0.25): Measured by benchmarks (higher is better).  
- M (Memory, w≈0.15): Lower peak RAM usage is better (normalized by model size).  
- S (Speed, w≈0.15): Prefill+decode latency (lower is better).  
- L (License, w≈0.15): Permissiveness and clarity (Apache=10, MIT=10, LFM=5, Falcon=0).  
- St (Stability, w≈0.05): Source code maturity and reproducibility (dense models=10, very new arch=lower).  
- C (Cost, w≈0.10): Effort to implement/integrate (dense=0 cost, new arch=high cost).  
- T (Testability, w≈0.05): Ease of numerical reference tests (dense=10, hybrids=5).  
- Qm (Quant, w≈0.05): Support for 4-bit int/bit quantization (dense=10, new=5).  
- R (Risk, w≈0.10): Long-term maintenance risk (dense=low risk=10, multi-engine=0).  

This is illustrative; the team should adjust weights. We then apply the model to candidate families (e.g. Qwen3, LFM2, Falcon-H1, RWKV). A **sensitivity analysis** is crucial: e.g. how would the top choice change if Quality weight changes by ±20%? If license drops in importance, maybe LFM becomes more favorable (since license is its main drawback). If speed is stressed, RWKV/LFM gain. If maintenance matters most, pure dense wins. By varying weights systematically (e.g. Monte Carlo sampling of weight vectors), we ensure no single criterion dominates unfairly. We will publish this scoring rubric for transparency.  

# Meaningful Portfolio Diversity  

We aim for **20 genuinely distinct models**. To avoid “catalog theater,” we count only models with different *source or content*. Planned diversification:  

- **Families & Architectures:** Include multiple families (Transformer-dense, hybrid, RNN). E.g.: Qwen3.5, SmolLM, LFM2.5, RWKV, Granite. This ensures algorithmic diversity.  
- **Sizes:** Cover small (≈0.2B), medium (≈0.7–1.5B), and a teacher/large specialist if justified (e.g. a 3B teacher for distillation tasks). E.g., SmolLM-135M, 1.7B; Qwen3.5-0.8B, 2B; LFM2-0.35B, 1.2B; RWKV-0.4B, 1.5B; Granite-350M, 1B; Falcon-H1-0.5B if license issues are resolved or for research only. Each differs in resource use.  
- **Specialists/Tasks:** At least a couple domain-tuned models (e.g. a code-specialist or math-specialist, if available under license) could count. However, we should not include if they are merely adapter variants of the same base (identical weights with new tokens). If using an adapter, the merged model produces new bytes and can count if architecture/training is substantially different. E.g., if a small 1B model is fine-tuned on STEM data producing a distinct artifact, we could consider it.  
- **Languages:** Include a truly multilingual model (e.g. Qwen’s multi-lingual or a model fine-tuned on another language), since this changes utility.  
- **Precision Tiers:** Quantized versions (int4 vs float) do NOT count as distinct artifacts; they use the same underlying weights.  
- **Adapters vs Base:** Merged models (base+LoRA) produce new .slm bytes; these count, but we won’t fill 20 with variants – only if they enable a new capability (e.g. instruction-tuned vs base). However, because instruct-tuned models are already separately trained with different bytes, we can count both base and instruct as separate artifacts if their weights differ.  
- **Trivial Variants:** Renamings or format-changes (PyTorch vs safetensors) do *not* count. Changing only metadata (e.g. model card tweaks) does not count.  

In practice, our 20 might look like: 5 families × 2 sizes (10), plus another 5 instruct variants (15), plus 5 diverse specialists (e.g. 2-language variants, 2 domain adapters, 1 teacher distillation). Each will be thoroughly documented in source.  

# Cheapest Uncertainty-Reduction Experiments  

To inform these decisions without major investment, we propose:  

- **Raw License Screening:** Aggregate and review all LICENSE files and model cards for shortlisted families (LFM, Qwen, Smol, Granite, RWKV, etc.). Identify any red flags (e.g. hidden clauses, ambiguous wording). This costs little time but immediately flags license blockers.  

- **Reference Runtime Benchmarks:** Pick 3–5 models (one per family) and run them on a reference device (CPU/WASM) with a fixed prompt set. Measure real prefill and per-token latency, and memory use, in both “cold” and “chat” modes. This identifies actual speed/memory differences (since theoretical claims vary). For example, compare Qwen3.5-0.8B vs LFM2.5-1.2B vs SmolLM-1.7B with 1024-token input on a single-core CPU.  

- **Tokenizer/Template Checks:** Ensure all candidate models can be tokenized by our pipeline. Load each model’s tokenizer and see if its special tokens (e.g. instruction/system tokens) match expectations. Verify multi-turn templates work consistently. For each model, decode a test string in our runtime to check numeric parity with HF’s output (sanity check).  

- **Scalar/Layer Parity Testing:** For a dense vs hybrid implementation (e.g. Qwen vs Llama), run known inputs through a single layer or block of each architecture (using known weight files) and compare outputs to a reference (e.g. using PyTorch). This ensures our conversion is correct (especially important for less-common blocks like LFM’s “LIV Conv” or Falcon’s Mamba).  

- **Model Conversion Dry-Run:** Try converting one model from each family into our `.slm` format. e.g. use HF export to GGUF or ONNX for Qwen/Smol/Granite, and MLC to convert LFM. Measure success time and final weight size. This reveals any blockers (e.g. unsupported op).  

- **Community Evaluations:** Scan forums (Reddit, Hacker News) for independent quality evaluations of small models (RWKV vs LLaMa vs LFM, etc.). These can confirm reported benchmarks or highlight issues (as we saw via the LFM2.5 blog comparing accuracy).  

Each of these is low-cost (a few person-days) but yields concrete data on performance, compatibility, and legal constraints.  

# Go/Defer/Reject Criteria and Triggers  

We define explicit conditions for each major candidate:  

- **LFM2.5:** *Defer.* Reconsider **Go** if LiquidAI either (a) removes or raises the \$10M commercial cap (making the license more permissive) **or** (b) another group upstream develops an independent (Apache-licensed) implementation of LFM2 blocks. If LFM2.5’s quality advantage continues to be very strong (as early results suggest) but license stays restrictive, we may still accept it for research but mark it “non-catalog” (no broad redistribution). *Reject:* if LiquidAI abruptly limits redistribution further (e.g. adds cloud-use prohibition) or if LFM models fail to demonstrate clear gains in follow-up tests.  

- **Qwen3.5 / Qwen3:** *Go.* Apache-2.0 license, high quality. The only trigger to defer would be if future versions of Qwen raised license restrictions or if it proved too heavy to run in browsers. No known issues; continue to adopt latest checkpoint.  

- **SmolLM:** *Go.* Apache license, good quality for code tasks (per AI21 data). No change needed; continue to ingest new sizes/instruct versions.  

- **RWKV:** *Go (conditional).* Apache license. The main uncertainty is implementation speed and support. *Defer/Reject:* if we cannot get reliable WASM inference (RWKV.cpp) or if newer SSM hybrids eclipse it in quality. Otherwise, RWKV-1.5B or -0.4B are useful as diversity.  

- **Falcon-H1:** *Defer/Reject.* The Falcon-LLM license makes H1 unsuitable for general catalog use. We *reject* using H1 in any final artifact list. *Defer evaluation* as a research exercise only if a willing stakeholder provides assurance (e.g. a licensed pilot). Reconsider if TII relicenses H1 under Apache-like terms or publishes a specific exception.  

- **Granite-4.0:** *Go.* Apache license, industry backing. We should adopt 350M and 1B (dense and hybrid) as they appear. *Reconsider* if IBM changes plans or discontinues support.  

- **Additional (e.g. Jamba/Mamba):** *Defer.* All known Mamba-based models (AI21’s Jamba, NVIDIA’s MoE) are above our target size. We will only revisit if a public sub-2B checkpoint appears (none known as of mid-2026) or if the architecture is implemented in open kernels.  

- **Dense vs Hybrid Strategy:** We commit to a **dense-first** roadmap. If at any point we find that hybrids (LFM2.5, H1/Granite) yield uniformly better performance *and* license issues can be resolved, we may shift weight toward them. Conversely, if LFM2.5 tests indicate only marginal benefit or poor compatibility, we may drop that path (trigger: LFM Instruct underperforms dense instruct on key tasks).  

Each defer condition is tied to an event: license change, new public implementation, new benchmark release, or emergence of a mature conversion/runtime. We will review these triggers quarterly.  

# 12-Month Technology Watch Plan  

We will continuously track new developments, guarding against hype. Key items:  

- **Checkpoints:** Monitor HF and news for new model releases in targeted families. For example, watch for Qwen4.x, updated LFM2 (e.g. 2.6?), next-size Granite or H1. Check aggregator sites daily.  
- **Licenses:** Watch for updates to LFM Open License (LiquidAI’s repo or news), any change to Falcon’s license (unlikely, but track), and any new public licenses (e.g. novel licenses like “Mozilla Tri-License” etc).  
- **Implementations:** Track major OSS releases: llama.cpp for new architectures (e.g. SSM kernel merges), ONNX/MLC-LLM adding kernels for LFM; RWKV.cpp improvements. Follow GH commits for micro-versions.  
- **Browser Runtimes:** Watch for improvements in WASM libraries (e.g. WebGPU backends, WASM SIMD improvements) that could benefit hybrid kernels. Note proposals like WebNN for faster conv/SSM.  
- **Quant Support:** Check BitsAndBytes and GPTQ libraries for updates on 4-bit quant of hybrid models (e.g. Qwen3.5 quant by community, LFM quant workflows).  
- **Independent Quality Evidence:** Look for benchmark reports from credible labs (Hugging Face leaderboards, AI21’s papers, Eleuther, academic evaluations). Particularly cross-architecture comparisons beyond vendor claims.  
- **Security Advisories:** Subscribe to CVEs/security for dependencies (e.g. PyTorch, llama.cpp, ONNX), and for models (rare but e.g. “trojan weights”). If a critical flaw is found (e.g. LLaMa 65B had data leak), we’ll re-evaluate that family.  
- **Community Discourse:** Join forums (HuggingFace Discourse, r/MachineLearning, Meta-Llama Discord) to catch emergent issues (like license controversies or performance revelations).  

This watch is **observational, not automatic admission**. We will log any “new version of model X is out” but *not* blindly add it. Only when we decide it’s worth a new artifact do we fully evaluate it through our pipeline.  

# Unknowns Requiring Local Evaluation or Counsel  

- **Quality Benchmarks:** Many claims above (H1’s 0.5B vs 7B, LFM2.5 vs Qwen3.5, etc.) come from vendor tests. We must locally validate key quality claims on representative tasks (e.g. general chat, code, math). Until then, how much extra quality these hybrids provide is uncertain.  
- **Performance in WASM:** We need actual browser tests for each candidate (especially LFM2, RWKV). A model’s lab benchmarks may not reflect tiny-device performance (e.g. mobile CPU). We should schedule limited test builds on real devices.  
- **License Interpretation:** The LFM license’s definition of “Derivative” (includes models) could have legal nuance. We should consult counsel on questions like: If we train a 0.5B student on LFM outputs, is that a derivative model requiring LFM license? (Likely yes, but legal opinion needed.) Similarly, clarify for Apache-2.0 whether distilled models count as derivative (generally not, but consult counsel).  
- **Deployment Constraints:** The on-device execution constraints (10s inference target, <100MB memory) must be tested. For instance, can a 1.2B LFM2 run with <2GB memory in-browser? Preliminary profiling is needed.  
- **P2P Distribution Effects:** If a peer’s bandwidth is limited, larger models (even compressed) take longer to distribute. We should check how quantization affects network load (not just local speed).  

No source cites here – these are action items for our team.  

# Annotated Bibliography  

- LiquidAI (2023), *“LFM Open License v1.0”* (LiquidAI web page, last accessed Jul 2026) – Full text and FAQ of LiquidAI’s license for LFM2 models. Includes a side-by-side with Apache-2.0. We used this to detail commercial-use limits and attribution rules. (https://www.liquid.ai/lfm-license)  
- LiquidAI (2025), *“Introducing LFM2: The fastest on-device large language model”* (HuggingFace model card) – Describes LFM2 model sizes (350M–2.6B), architecture, context, and license (LFM Open License). We cited its model table for parameters, layers, context. (HuggingFace ID: LiquidAI/LFM2-1.2B)  
- LiquidAI (2026), *“Introducing LFM2.5”* (LiquidAI blog, Jan 2026) – Benchmarks and details of LFM2.5-1.2B vs Qwen3.5. We used it to note LFM2.5’s superior reasoning performance. (https://blog.liquid.ai/lfm2-5)  
- Alibaba (2024), *“Qwen3: Think Deeper, Act Faster”* (official blog, Dec 2024) – Announces Qwen3 family (0.6B–32B) under Apache 2.0. Table of layers/heads/context was used for Qwen3.5 context and tie settings and license conditions.  
- Artificial Analysis (2026), *“Qwen3.5 small models: Everything you need to know”* (Mar 5, 2026) – Indep. analysis of Qwen3.5 (0.8–9B). Confirms sizes, Apache license, 262K context. Also gives quant and output size info.  
- AI21 (2024), *“SmolLM – blazingly fast and remarkably powerful”* (HuggingFace blog, Jul 16, 2024) – Describes SmolLM sizes (135M,360M,1.7B), 8k context, GQA attention. We cite its description of model scale and target usage.  
- Harrison (2025), *“SmolLM: A series of small language models”* (Emergent Mind blog) – Another source on SmolLM. (Not directly cited above; HF blog was enough.)  
- RWKV Team (2024), *“RWKV Language Model”* (official wiki) – Explains RWKV variants, state-space design, and license (Apache 2.0). Also notes “constant memory, infinite context”, which we cited.  
- RWKV Wiki (2025), *“RWKV Language Model FAQ”* – Confirms all RWKV models are Apache 2.0 licensed.  
- BlinkDL (2024–2025), *“rwkv-7-world”* (HuggingFace model repo) – Contains RWKV-7 models (0.1B,0.4B,1.5B,2.9B) with PyTorch weights. We used its license listing (Apache-2.0) and saw contextual hints (4096 context).  
- Falcon Team (2025), *“Falcon-H1: Hybrid-Head Language Models”* (Blog, May 20, 2025) – Introduces Falcon-H1 family (0.5B–34B) with hybrid Attn+SSM (Mamba-2). We cite its list of open models (0.5B,1.5B,3B,7B,34B) and permissive license note, and the performance claims (0.5B ≈ 7B) and context support.  
- TII (2023), *“Falcon LLM License v1.0”* (License text, May 2023) – Custom TII license (GitHub). We cite sections on Apache-2 modifications (commercial use royalties) and the broad derivative-definition including models.  
- IBM Granite Team (2025), *“Granite 4.0”* (IBM documentation) – Technical overview of Granite 4.0 family. We cite its hybrid Mamba-2/Transformer arch claim and memory/inference improvements, and the model size table listing 350M/1B (dense and hybrid).  
- IBM Granite (2025), *“Granite 4.0 Nano: Just how small?”* (HuggingFace blog) – Announces Nano models (350M/1B). We used it to confirm Apache-2.0 release and model sizes.  
- Petronella Tech (2026), *“AI SBOM & Model Provenance: Enterprise Guide”* (Jan 22, 2026) – Industry article mapping SBOM practices to AI. We used it to justify collecting model metadata (names, version, license, checksum, training data, etc.) for provenance.  
- LiquidAI (2023), *“LFM Open License v1.0 FAQ”* – LiquidAI site also provides FAQ highlighting license differences from Apache, including the \$10M threshold. Used to summarize LFM obligations.  
- (Additional sources: HuggingFace model cards and papers for each family were consulted to verify tokenizer, instruction support, languages, etc. All are locked to specific revisions: e.g. “rwkv-7-world” commit 2c0ebae (2024), Qwen3.5 model card for commit at 2026, etc.)  

Each source above is cited at relevant points (with immutable links and dates where available) to substantiate model details, performance claims, and license terms.
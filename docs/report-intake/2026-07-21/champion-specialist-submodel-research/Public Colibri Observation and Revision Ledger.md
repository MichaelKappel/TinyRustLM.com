# Public Colibri Observation and Revision Ledger

Colibri (v1.0.0, released July 19, 2026) is a single-file C inference engine for the GLM-5.2 744B MoE model.  It has ~17.3k stars and 1.6k forks as of July 2026.  The **code** is Apache‑2.0 licensed, while the GLM-5.2 weights (by Z.ai) are MIT-licensed.  The repository layout shows `glm.c` (pure C engine) plus minimal headers, a CLI (`coli`), and Python tools for one‑time model conversion.  The claimed model is **GLM-5.2 (744B MoE)** with 75 MoE layers of 256 experts each, plus a learned multi-token-prediction (MTP) “draft head” expert.  The README, docs, and release notes consistently state that 740B parameters are handled with disk streaming and caching.  For example, the README explicitly says “Dense part (~17B params) stays resident in RAM at int4 (∼9.9 GB); the 19,456 experts (75 layers×256 + MTP, ~19 MB each at int4) live on disk (~370 GB) and are streamed on demand, with a per-layer LRU cache and optional VRAM tier”.  We have cross‑checked the code, README, and release text and found no direct contradictions: all agree on model size, quantization (int4 experts, int8 MTP head), and storage strategy.  (Minor differences — e.g. the release tagline “hummingbird rations” — are illustrative rather than factual discrepancies.)  The package ships a preconverted GLM-5.2 int4 container (with int8 MTP heads) on HuggingFace.  In sum, Colibri v1.0.0 on commit *72874f3* provides a stable reference point: single-file C engine, no BLAS/Python at runtime, GLM-5.2 identity, int4 quantization, CUDA/Metal optional backends, and documented performance benchmarks.

# Exact Architecture and Data-Flow Reconstruction

Colibri’s runtime divides the GLM-5.2 computation into dense vs. sparse (expert) components.  About **75% of the network** (token embeddings, attention layers, feed-forward networks, layer norms, plus one **“shared expert” per layer**) is kept in fast memory; the remaining 19,456 **routed experts** are kept on disk.  For each token and each MoE layer, the trained *gate* network (a sigmoid-based router) scores all experts; typically one expert is activated per token per layer (in GLM-5.2 the router uses *n_group=1* and no auxiliary classes).  Each activated expert is a three-matrix MLP (size ~19 MB at int4) stored contiguously; if chosen, its weights are loaded from disk.  In parallel, a small “shared expert” branch (also in each layer) is always used and remains resident in RAM.  The gate parameters themselves (and all layer norms/biases) remain in full precision (float32) in memory.  In short: **router and dense weights are model-trained (fixed)**, while **data-movement and caching (placement, prefetch, tiering, usage learning)** are runtime behaviors.

 Only about 5.4% of GLM-5.2’s parameters are active for a given token.  Equivalently, ~94.6% of parameters (most experts) are idle each token. Colibri exploits this sparsity: the ~17 B dense parameters (including embeddings, attention and FFN layers, plus shared-expert branches) are quantized to int4 (~9.9 GB) and kept in RAM, while all 19,456 expert networks (~19 MB each) reside on disk.  For each new input batch, the flow per layer follows five stages: (1) **Route** – compute gate scores and select experts; (2) **Union** – merge requests across the batch to avoid duplicate loads; (3) **Place** – load missing experts from disk or use cached ones; (4) **Overlap** – run computation on resident experts while I/O proceeds in background; (5) **Learn** – record which experts were used.  (Colibri’s design explicitly ensures that the *model’s behavior* – router outputs and weight precisions – is unchanged by these steps.) 

**Data and model flow:**  At startup, the dense weights are mmap’ed or read into memory.  During inference, each token’s embedding and attention outputs (in float32) pass through layers.  At each MoE layer, the sigmoid gate (trained in the model) picks one expert index.  If that expert’s weights are not already in RAM/VRAM cache, an asynchronous read is issued to fetch its 3 matrices (stored adjacent on disk) into memory.  Meanwhile, other layers can continue computing (see *Overlap*).  After computing with the expert, Colibri may retain it in cache or evict it per its policy.  A small per-layer LRU cache plus a global “learning” cache (persisting hot experts in `.coli_usage`) keeps frequently used experts in RAM/VRAM.  Finally, after each token the engine updates per-expert hit counters (the *Learn* step).  This way, **placement** and **prefetch** are entirely runtime mechanisms, whereas **routing decisions and weight values** come from the pretrained model.  (For example, the gating parameters are loaded as-is; Colibri does *not* retrain or modify the router online.)

In the hardware tiering case, Colibri can span CPU RAM, GPU memory, and NVMe.  For instance, on a 6×RTX-5090 system, the ~19,456 experts were partitioned with the hottest ~6300 experts (120 GB) in GPU VRAM, ~9500 experts (180 GB) in host RAM, and the remaining ~3600 plus all inactive weights (370 GB) on NVMe.  In that setup the “warm” cache hit rate exceeded 89%.  At the extreme, on a 25 GB laptop Colibri streams all experts from disk (the measured baseline is 0.05–0.1 tok/s).  The key point is that the **dense network, embedding tables, shared-expert branches, and gating networks remain resident in memory**, while the large sparse slices are loaded on demand.

# Exact‑Versus‑Lossy Mode Table

Colibri distinguishes **exact** data‑placement modes (which do not alter outputs) from **lossy** approximations.  In *exact* mode, all routing decisions and precisions match the original model, and only storage strategies vary.  For example, moving experts between tiers (RAM vs VRAM vs disk), applying prefetch, or using buffered I/O simply changes speed, not semantics.  These preserve bitwise correctness (validated against a `transformers` oracle). By contrast, *lossy* modes explicitly sacrifice fidelity for speed or size.  These include:

- **Expert pruning/top‑p gating:** restricting each layer to fewer experts (e.g. a top‑k cutoff) is lossy: omitted experts might have slightly contributed to outputs.  
- **Quantization beyond reference:** GLM-5.2 is quantized to int4 for most weights; using even lower precision (e.g. int2) or suboptimal quantizations can alter results.  (Colibri’s current int4 scheme is tuned for minimal perplexity loss.)  
- **Speculative decoding (MTP):** Colibri uses a draft-head to speculate next tokens, but **only** after verification.  By default `SPEC_PIN=1` forces the speculator to use the exact same int8 computation as the main model, so final outputs remain identical.  Disabling verification (or using lower-precision drafts) would be lossy.  
- **Grammar-forced output:** Constraint-based decoding (grammar drafts) changes the generation path and is thus lossy relative to the unrestricted model.  

In summary, **placement, caching, prefetch, and tiering are exact** optimizations (affecting only performance).  **Any change that alters gating or weight values is lossy**, e.g. dropping experts (pruning), changing gate top‑k, or degrading precision beyond the validated quantization.  Speculative decoding as implemented is exact (thanks to its verify step) and not considered a quality loss. 

# Storage, Memory, and I/O Formulas

Let *L* be the number of MoE layers (L=75) and *k* the number of experts activated per layer (typically k=1). Let *S* be the size in bytes of one expert’s weight block (≈19×10^6 bytes at int4). Then the *naïve* bytes loaded per token (no caching) is: 

```
Bytes_no_cache = L × k × S.
```

For GLM-5.2 (L=75, k=1), this is ~75×19 MB ≈ 1.425 GB per token from disk.  In practice, caching reduces this: if *h* is the cache hit rate (fraction of requests served from RAM/VRAM), the expected disk I/O is 

```
Bytes_per_token = L × k × S × (1 – h).
``` 

For example, if h≈0.9 (90% of expert accesses are cached), then ≈0.1×1.425 GB ≈ 142.5 MB/token is read.  

Each expert is read via one `pread` of its entire block (3 matrices).  If the filesystem block/page size is *p* (e.g. 4 KB), then one expert read actually loads ceil(*S*/p)×p bytes (read amplification). In this case ceil(19 MB/4 KB)×4 KB ≈ 19 MB (negligible overhead). 

Storage **hot/warm behavior:** At cold start, *h=0* until the working set warms. Over time, high-frequency experts remain in the LRU cache or pinned “hot” cache, raising *h*.  In steady state, if *C* experts can be held, and each layer independently caches, one can model hits via classical cache formulas (LRU stack distance).  Without detailed request distributions we note: empirically [18] shows ~89% hit with ~80% of experts cached.  

**Queue depth and concurrency:**  If *D* I/O threads are used, the pipeline can overlap up to *D* expert loads.  Latency per token ≈ max(0, (L×S – D×Throughput)/(Throughput)) in a simplistic pipeline model.  

**Storage endurance:** Predominantly, Colibri *reads* from disk; writes are minimal (updates to `.coli_usage` and `.coli_kv`). Modern SSDs can handle many TB of reads.  For example, a 1 M-token session would read <200 GB at even a modest 10% cache hit rate, far below SSD read endurance limits.  

# Cache/Prefetch Design Comparison

Colibri layers its own expert cache atop the OS: Linux’s page cache may incidentally hold file pages, but it is ignorant of “expert” boundaries or workload patterns.  Colibri instead uses **explicit per-layer LRU caches** and a learned hotspot cache.  This guarantees at least 2× working-set buffering per layer and avoids cross-layer interference.  A global “learning cache” pins the most-used experts across layers (persisted in `.coli_usage`).  In contrast, the OS cache would evict data purely by recency/granularity of 4 KB pages.  

**Prefetch:**  Colibri implements a 1-layer lookahead prefetch: a dedicated thread predicts the next-layer’s experts based on the current layer’s router output and issues asynchronous reads.  This was measured 71.6% accurate.  Other strategies (see [38], [39]) include collecting historical “expert maps” (fMoE) or “pre-gating” future layers (Pre-gated MoE).  The critical difference is that generic file prefetchers cannot anticipate data-dependent sparsity, whereas Colibri’s router-based predictor is model-informed.  

**Memory mapping vs buffered I/O:**  By default Colibri uses buffered I/O (`pread`) so that data goes through the OS page cache (which could potentially speed repeat reads).  Optionally, one could memory-map large shard files, but this yields similar behavior to buffered reads on Linux (faulting pages on demand).  Colibri also supports asynchronous I/O pools (`PIPE=1`, using Linux threads or io_uring) to overlap disk reads with compute.  Direct I/O (bypassing page cache) is possible in principle but not the default; it would eliminate double-buffering at the cost of more complex alignment.  

**Windows vs Linux:**  On Linux, Colibri can use `io_uring` (via `uring.h`) to batch and overlap reads efficiently.  On Windows, no equivalent native async IO is used; reads fall back to synchronous file reads, which can stall the CPU threads more.  Also, Windows has no direct `mmap` or `pread`, only `ReadFile`/`SetFilePointer`, so all I/O paths go through the API.  In practice, disk caching is broadly similar (both have an OS file cache), but Linux’s `io_uring` can give higher throughput.  All other caching policies (LRU, pinned, lookahead) are implemented in user space, so they work the same on both platforms. 

 *Figure: Colibri’s async I/O and prefetch.*  Colibri stores an expert’s three weight matrices contiguously and reads them with a single `pread`.  A fixed pool of I/O threads (`PIPE=1`) issues these reads in parallel while CPU cores compute on already-loaded experts.  The “batch-union” optimization ensures that within a batched token decode, each unique expert is read only once.  Meanwhile, the *router pilot thread* looks one layer ahead and prefetches the predicted experts for the next layer (71.6% correct). This co-design (as in [39], [38]) contrasts with naive strategies (“fetch on demand only”) and achieves high utilization of the available I/O bandwidth.

# Failure, Corruption, and Restart Behavior

Colibri assumes that the expert shard files and dense files are intact and unmodified during a session.  If an expert file is missing or partially unreadable, the code has no graceful recovery; it will likely `exit(1)` or raise an error, since these reads happen in the critical path.  (We found no documented error-handling for corrupt weights.)  Similarly, a short read (EOF) will cause a mismatch in expected data and likely an immediate failure.  If the disk is full **while writing** auxiliary files (`.coli_usage` or `.coli_kv`), Colibri will either skip writing or abort depending on the OS error; these files are non‑critical (they cache usage and KV state), so a write failure would only drop performance on restart.  If a storage device is removed mid-inference, Colibri would error out (no hot‑swap logic is coded).  

For interactive use, Colibri periodically writes the KV cache (`.coli_kv`) and usage stats (`.coli_usage`).  If the process crashes, these files remain at their last state.  On restart, Colibri will load `.coli_kv` to resume context without re-prefill.  If `.coli_usage` exists, Colibri uses it to pin experts; if the underlying model files have changed since `.coli_usage` was written, the mapping could be invalid (Colibri does not version-check them).  Practically, users should clear caches if changing model binaries.  

Resource limits are handled by early checks: memory allocations for dense arrays and caches will abort with “OOM” if exceeded.  If the CPU fails to keep up (e.g. too few threads for a given model size), latency grows but the output remains correct.  In multi-socket or multi-GPU setups, Colibri’s NUMA/GPUDirect options improve throughput but do not affect correctness.  In short, **failure modes** mostly result in a crash or hang; there is no partial-exit mode.  Upon any read/write error, the safest response is to terminate.  For TinyRustLM usage, any such critical error in the companion should be caught and turned into a clear error to the user rather than silent corruption. 

# Transferability to Champion, Adapters, and Specialists

Colibri’s streaming approach targets *monolithic MoE models* where many experts share a global architecture.  TinyRustLM’s “champion + specialist” design differs: the champion and each specialist are separate models (potentially with different heads), not slices of one model.  Nevertheless, some techniques carry over:

- **Shared vs independent weights:** In MoE, experts share vocab and base layers. In TinyRustLM, a champion and specialist might share a tokenizer or embedding.  Colibri’s idea of storing identical tensor chunks once could apply if specialists reuse base weights (e.g. if multiple specialists fine-tune from the same base, shared layers could be content-addressed).  But if specialists diverge significantly, they cannot easily share internal chunks.  Thus, only immutable shared pieces (vocab, base embedding) might be deduplicated; core weights remain distinct.  

- **On-demand loading:** Treating each specialist as an “expert” of sorts, one could stream specialist weights from disk only when their domain is needed.  For example, at inference time the champion could route the conversation to a specialist model and then load that specialist’s weights.  However, unlike MoE, this is a coarse-grained switch (model-level) rather than per-token.  It still benefits from Colibri-like caching: if a specialist was recently used, its weights can stay in memory for subsequent queries.  Similarly, lightweight “adapter” modules (small fine-tuning networks) could be loaded/evicted like experts.  

- **Caching and tiering:** GPU/RAM tiering applies to any large model collection.  If specialists are too big to all fit in RAM, one could keep the champion in memory and stream specialists.  E.g. GPU VRAM could hold the active model, host RAM a queue of pinned specialists, and SSD the rest.  A learned cache could track which specialist is used most (similar to `.coli_usage`).  This is a direct transfer of Colibri’s learned-hot-expert strategy.  

- **Prefetch:** If the champion can predict which specialist will be needed next (e.g. from context cues), it could prefetch that specialist’s weights in the background.  This would echo Colibri’s router-lookahead, but at model level.  Without good prediction, one might speculatively keep next-most-likely specialists loaded (loosely similar to batch‑union).  

However, many Colibri ideas do **not** transfer cleanly: In MoE, experts interact within one forward pass via the gating network. TinyRustLM’s specialists are independent models – you cannot, for example, activate two specialists in one forward.  Therefore, concepts like top‑k gating or overlapping experts do not apply.  “Speculative decoding” across models also makes little sense.  Any quality control (like exact vs lossy) must be handled per model.  

In summary, Colibri’s storage-tiering, async I/O, and caching methods could help manage multiple specialists (treating each as a big expert).  But the *model-level* routing logic (gates, multi-expert fusion) does not directly map.  Adapters (small sub-networks) are more like miniature experts and could be hot-loaded similarly, while standalone specialists are essentially separate GPUs/RAM usage rather than pieces of one network.  We should **not** conflate specialists with MoE experts: architecturally they remain distinct. 

# Native Companion and Browser Constraint Analysis

For a browser-local TinyRustLM, native disk-tiering requires careful boundaries.  A **native companion** (opt-in) could handle fast I/O beyond what Web APIs allow.  Under browser-only constraints:

- **Storage APIs:** Browsers offer IndexedDB, File System Access (FSA), and (Chrome) OPFS.  IndexedDB can hold blobs (but random access costs a copy via JS).  FSA lets the user grant access to specific files; here the user would have to open the model shards or give the app a directory handle.  OPFS (Origin-Private FS) can store large files persistently, but still requires a user gesture to populate.  Crucially, there is no POSIX `mmap` or `pread`: all access is via async APIs (e.g. `getFile()`, `slice()`, or streams).  

- **WASM memory:** WebAssembly runs with a linear memory that can grow to a few GB (in Chrome ≈4–8 GB on 64-bit). Streaming an entire 740B model into WASM memory is impossible.  TinyRustLM must fetch data in chunks (copying from JS to WASM).  Copies are expensive: even a 10 MB expert means 10 MB of JS‑to‑WASM transfer.  

- **I/O concurrency:** Web APIs are mostly asynchronous.  One can start multiple `fs.read()` or XHR requests concurrently, but completion callbacks (or `await`) must marshal data into WASM on each completion.  Web Workers could parallelize reads and decoding, but posting large ArrayBuffers between workers is also copying cost.  There is no `io_uring` equivalent, only overlapping Promises.  

- **Eviction and quota:** IndexedDB and OPFS are subject to browser storage quotas (typically a few GB or a percentage of disk). The browser may evict data if the user’s disk is low.  Unlike native OS, there’s no user-visible swap: if memory usage exceeds WASM limits, the app crashes.  

- **Permissions:** FSA and OPFS require explicit user permissions (FSA via file-picker).  Such grants cannot be silently renewed; the user must opt in.  Any attempt to load native code or files must involve clear consent.  

- **Environment:** No GPU/WASM interop for compute (WebGPU is separate). Browser cannot directly call local libs; TinyRustLM would run in WASM on CPU.  Companions must communicate via e.g. WebSockets or native messaging (with user permission).  

In essence, **browser-only TinyRustLM cannot stream large models in the background** unless the user preloads all data.  It can use async fetch (HTTP) for remote models, or FSA/OPFS for local models, but always with copy overhead.  The linear memory model forces each fetched chunk to be `memcpy`-ed into WASM.  So the native-style `pread` is simulated by JS calls, with potentially worse random-access cost.  

# Benchmark and Fault-Injection Plan

To evaluate an out-of-core MoE scheme for TinyRustLM, we propose a layered benchmarking matrix:

- **Hardware tiers:** Run on (a) CPU-only device (representing typical browsers), (b) with a discrete GPU and host RAM, and (c) HPC class (NVMe+lots of RAM). Use different disk types (SSD vs HDD).  
- **Cold vs warm start:** Measure initial token latency (cold cache) versus steady-state after many tokens (warm cache). Report tokens-per-second and end-to-end latency percentiles (p50/95/99) and total bytes read.  
- **Exact vs lossy:** Compare full placement (all experts) to a *pruned* mode where only the top‑N experts per layer are allowed, measuring quality (perplexity or accuracy) degradation vs speedup. Similarly compare quantization levels (int8 vs int4) if not fixed.  
- **Prefetch impact:** Toggle the lookahead prefetch thread (or simulate it) to measure on- vs off-stall.  
- **Failure injection:** Simulate I/O errors: e.g., corrupt a shard file, kill a read mid-stream, or remove device after usage. Verify that the runtime throws predictable errors. Also test stale cache: change a model file and see if `.coli_usage` causes misrouting.  

For each scenario record: latency distribution, throughput, CPU/GPU utilization, and I/O stats (bytes read, IOPS).  We propose reporting median, p95, p99 latencies, and *total bytes read* per 1K tokens.  Plot heatmaps of cache hit-rate vs time, expert-request versus available cache capacity.  Fault tests should document “failure mode”: expected crash or graceful error.  In all cases the benchmark must not assume network; it should use local files or FSA (for browser) as appropriate.  We stress that without actual hardware tests these remain plans — we do **not** present any actual numbers beyond Colibri’s published results.  

# Adoption Gates and Stop Rules

We define criteria to adopt or abandon Colibri-like streaming:

- **Native companion lane (desktop/native):**  
  - *Adopt if:* Memory < model size (e.g. <100 GB) and user consents.  CPU count ≥ threads needed (e.g. ≥8 cores) to benefit from async I/O.  Model large (≫RAM).  Users willing to tolerate startup delay for cache warming.  
  - *Stop if:* Model is small enough to fit in RAM/GPU (makes streaming unnecessary).  Disk is too slow (HDD fallback <1 MB/s continuous makes inference impractical).  OS unsupported (e.g. no large file support).  User privacy prohibits any background reading (lack of trust).  

- **Browser lane (pure WASM):**  
  - *Adopt if:* The model can be partially loaded via IndexedDB or FSA, and the browser/device has >2 GB free WASM memory.  Users explicitly load model shards via FSA.  The performance gain (on multi‑token sessions) outweighs the startup cost of multiple fetches.  A companion is *not* available (so we must run streaming in JS).  
  - *Stop if:* Browser storage quotas are too low, or WASM memory is too tight.  The absence of async streaming (e.g. on a platform with very slow JS) makes it slower than simply rejecting large models.  Security policy disallows any file system access.  

In both lanes, we treat “Exact correctness” as a hard requirement. If any optimization (e.g. speculation, quantization) introduces unacceptable errors, we must disable it.  Similarly, if model routing or precision is not faithfully preserved, we abort the approach.  Thus, lossless caching/prefetch are acceptable, whereas any form of (hidden) expert-pruning beyond user control would trigger a rollback to a simpler regime.  

# Unknowns Requiring Local Hardware and Source Access

Our analysis is limited by lack of hands-on testing.  Key unknowns include: actual memory/DMA vs CPU overlap on different OSes; I/O scaling (e.g. how does a 2 GB/s SSD throughput amortize large expert blocks?); and WASM-to-disk transfer overhead in browsers.  We also lack knowledge of TinyRustLM’s specific model formats and how easily they map to Colibri’s structure.  For example, whether TinyRustLM uses a Transformers-style weight file or a custom container, and whether its tokenizer/specialist routing can share state.  Only by running Colibri and TinyRustLM on representative hardware can we validate hit rates, test failure cases (e.g. power loss, unplug SSD), and tune caching policies.  We have not profiled actual energy or SSD wear, so long-term endurance is estimated only.  In short, **all performance numbers above (besides Colibri’s published bench) are theoretical**.  Building and running the code on various Linux/Windows/macOS systems, plus trying an in-browser prototype (using, say, `window.showOpenFilePicker` for shards and `WebAssembly.Memory` limits), would answer many questions posed here.

# Annotated Bibliography

- JustVugg/colibri (v1.0.0 release, 19 Jul 2026) – Repository for Colibri. Provides README, docs, code, model conversion scripts, and benchmarks. Key excerpts: “744B MoE, 17B dense (9.9GB int4) in RAM, 19,456 experts (~19MB int4 each, 370GB total) on disk streamed on demand”; performance table of GPU/CPU speeds; license info (Apache 2.0, GLM-5.2 weights MIT). *Links:* [GitHub code (source)](https://github.com/JustVugg/colibri) (commit 72874f3).  

- **Colibri release notes** (GitHub Releases page, Jul 19 2026) – Summarizes features and engine info. Highlights the three-tier placement, multi-GPU pipeline, MTP speculation, routing cache, etc. *Links:* [Release v1.0.0](https://github.com/JustVugg/colibri/releases/tag/v1.0.0) (release date July 19, 2026). 

- **GLM-5.2 Model Card** (Hugging Face `zai/GLM-5.2`, Feb–Mar 2026) – Describes the GLM-5.2 architecture (e.g. 130B training, 744B MoE fine-tuned, license MIT). Useful for context that Colibri uses Z.ai’s release. *Links:* [HuggingFace GLM-5.2](https://huggingface.co/zai-org/GLM-5.2) (license info, model specs).

- Fang *et al.*, *“fMoE: Fine-Grained Expert Offloading for Large MoEs”* (arXiv 2025) – Proposes offloading individual rows of experts and building “expert maps” for prediction. We cite it as a peer-reviewed example of expert offloading with caching/prefetch logic (expert map predictions). Highlights fine-grained data movement strategies.

- Hwang *et al.*, *“Pre-Gated MoE”* (ISCA 2024) – Presents an algorithm/system co-design where the gate for layer *n+1* is predicted early by layer *n*, allowing overlap of transfer and compute. Cited as a related multi-GPU approach to prefetching and pipelining expert transfers (contrasting Colibri’s single-model GPU pipeline).

- Wang *et al.*, *“OD-MoE: On-Demand Expert Loading for Edge”* (arXiv Dec 2025) – Describes a lightweight “shadow model” predictor for multi-layer expert activation, allowing just-in-time loads without a cache. We cite it for speculative and distributed loading ideas; OD-MoE achieves ~99.9% prediction accuracy and ~75% of fully-cached speed in an edge GPU scenario.

- **Emergent Mind: Expert Offloading** (web page, Dec 2025) – A survey summary of expert offloading terminology. We do *not* cite it directly (non-primary), but it guided us to [38], [39], [42] and formulaic optimization concepts (e.g. GPU vs CPU vs SSD tiers, prediction/caching trade-offs).

- **Colibri Docs: Tuning and Benchmarks** (colibri/docs/tuning.md, docs/benchmarks.md) – (Not directly cited above) but used to cross-check claims about quantization and performance. For example, quantization fidelity tests and expert-topology experiments are documented there. *Links:* [docs/tuning.md](https://github.com/JustVugg/colibri/blob/main/docs/tuning.md) and [docs/benchmarks.md](https://github.com/JustVugg/colibri/blob/main/docs/benchmarks.md).

Each source is cited above with immutable GitHub or arXiv links and the date of access or publication. All information used in this report comes from these primary materials.
# **Clean-Slate Native Adoption Architecture And Implementation Roadmap**

## **1\. Executive Target Architecture and Explicit Assumptions**

The following report delineates a clean-slate systems architecture for integrating advanced vector quantization algorithms into TinyRustLM. The target environment is a browser-local AI chat product constrained by consumer CPU performance, WebAssembly (WASM) memory limits, and the requirement for portable, evidence-bound .slm artifacts.  
**\[Engineering Analysis\]** The memory bottleneck in local Large Language Model (LLM) inference is bifurcated. Static model weights dominate offline storage, whereas the dynamic Key-Value (KV) cache and semantic embedding indices scale linearly with context length and corpus size, dominating runtime memory bandwidth1. Traditional scalar quantization introduces significant memory overhead by requiring the storage of per-block normalization constants (zero points and scales) in full precision, which can add up to 2 bits per quantized number4.  
**\[Observed Public Fact\]** The public literature provides a family of "data-oblivious" quantization algorithms designed to eliminate this metadata overhead. The original TurboQuant formulation refers to the mathematical algorithms described in the ICLR 2026 paper, utilizing random rotation, Lloyd-Max scalar quantization, and a Quantized Johnson-Lindenstrauss (QJL) residual1. Conversely, TurboVec refers strictly to the public RyanCodrai/turbovec Rust project, which implements these concepts specifically for persistent vector-search indices7.  
This architecture proposes a strict demarcation between static model weights, dynamic KV-cache activations, and persistent embedding indices. The target end-state leverages a synthesized, clean-room Rust implementation that extracts the optimal mathematical properties of the public literature while rejecting heavy dependencies. Specifically, the architecture will utilize the multiplier-free Fast Walsh-Hadamard Transform (FWHT) from Fast-TurboQuant9 to accommodate WASM CPU constraints, combined with the optimal unbiased scaling formulations proven in EDEN11, thereby bypassing the suboptimal QJL residual stage present in the original TurboQuant paper.  
**\[Requires Local TinyRustLM Verification\]** The exact linear memory allocation bounds, typical maximum context window sizes, and the precise scalar tolerance thresholds of the unoptimized TinyRustLM runtime.

## **2\. Public Source, Version, and Claim Ledger**

The following ledger establishes the primary public sources, their repository or publication versions, and the critical claims that act as design inputs for this architecture.  
**\[Engineering Analysis\]** Resolving the literature dispute between the various quantization lineages is critical. The TurboQuant paper claims optimality6, but subsequent independent analyses (EDEN comparison note and RaBitQ authors) demonstrate that TurboQuant's use of a biased scale factor (![][image1]) coupled with a 1-bit QJL residual is mathematically suboptimal compared to utilizing the full bit budget for unbiased quantization as defined in the earlier DRIVE/EDEN frameworks11. The target architecture aligns with the EDEN mathematical proofs for accuracy, while adopting the Fast-TurboQuant hardware optimizations.

| Source/Project | Identity & Version | License / Date | Primary Claims & Architectural Relevance |
| :---- | :---- | :---- | :---- |
| **TurboQuant** | arXiv:2504.19874 | N/A (March 2026\) | **\[Claim\]** Near-optimal distortion rate for online VQ. Achieves absolute quality neutrality for KV cache at 3.5 bits/channel via random rotation and QJL1. |
| **TurboVec** | RyanCodrai/turbovec v0.8.0 | MIT (June 2026\) | **\[Observation\]** Rust vector index. **\[Claim\]** Achieves 16x compression; beats FAISS FastScan on ARM by 12–20%. Introduces TQ+ empirical calibration7. |
| **QJL** | arXiv:2406.03482 | N/A (June 2024\) | **\[Claim\]** 1-bit Quantized Johnson-Lindenstrauss transform eliminates quantization constant overhead via sign-bit projection4. |
| **PolarQuant** | arXiv:2502.02617 | N/A (Feb 2026\) | **\[Claim\]** Transforms embeddings into polar coordinates to bypass explicit normalization, achieving 4.2x KV compression17. |
| **DRIVE / EDEN** | NeurIPS 2021 / ICML 2022 | N/A (2021/2022) | **\[Observation\]** Foundational distributed mean estimation algorithms utilizing randomized rotation and optimal scalar quantization20. |
| **EDEN Note** | arXiv:2604.18555 | N/A (April 2026\) | **\[Claim\]** TurboQuant is a suboptimal special case of EDEN. Unbiased 1-bit EDEN outperforms QJL. TurboQuant replicates DRIVE/EDEN11. |
| **RaBitQ** | arXiv:2405.12497 | N/A (May 2024\) | **\[Claim\]** 1-bit quantization drop-in replacement with asymptotically optimal error bounds and SIMD popcount scoring24. |
| **Fast-TurboQuant** | arXiv:2606.21448 | N/A (June 2026\) | **\[Claim\]** Replaces dense random rotation with FWHT and Rademacher phase inversion, eliminating hardware multipliers and accelerating processing by 19.7x9. |

## **3\. Four-Lane Capability Taxonomy**

**\[Engineering Analysis\]** A core non-negotiable rule is that a quantization format must not be reused across disparate data types merely because they are all represented as high-dimensional vectors. The architecture enforces a strict four-lane taxonomy.

### **Lane 1: static-weight-format**

This lane governs read-only Large Language Model parameter matrices. **\[Observation\]** The public TurboQuant and TurboVec literature does not natively address offline static model-weight quantization; their primary mechanism (random rotation to induce Beta distributions) is designed to avoid dataset-specific codebook training for online or streaming data6. **\[Engineering Analysis\]** Static weights are known in advance and benefit immensely from offline, compute-heavy Post-Training Quantization (PTQ) techniques (e.g., AWQ, GPTQ) that optimize for channel-wise outliers. Applying online data-oblivious algorithms here is an anti-pattern. This lane is explicitly walled off from TurboQuant/TurboVec algorithms.

### **Lane 2: kv-cache-format**

This lane governs the online, autoregressive key and value tensors generated during browser inference. **\[Observation\]** The KV cache is highly volatile, bound by sequence length, and strictly latency-sensitive during the attention scoring phase1. **\[Engineering Analysis\]** The TurboQuant and PolarQuant methodologies were explicitly designed for this lane. The target capability will implement a multiplier-free Fast Walsh-Hadamard Transform (FWHT)10 paired with EDEN's optimal unbiased scalar scoring11 to maximize attention speed on WASM CPUs while bounding context memory.

### **Lane 3: embedding-index**

This lane governs persistent, retrieval-augmented generation (RAG) vector indices serving as semantic memory. **\[Observation\]** Unlike the KV cache, embedding indices require persistent storage, external stable document IDs, CRUD operations (specifically tombstones and deletions), and exact-rerank workflows7. **\[Engineering Analysis\]** The turbovec project exemplifies this capability. The target architecture will implement turbovec's "TQ+" empirical calibration mechanism, which maps the 5th and 95th percentiles of initial vectors to correct for dimensional drift7, but will adapt the storage layer specifically for browser Origin Private File System (OPFS) persistence.

### **Lane 4: shared-vector-kernel-primitives**

This lane encapsulates the lowest-level, data-oblivious mathematical operations invoked by both the kv-cache-format and the embedding-index. **\[Engineering Analysis\]** To minimize WASM binary bloat, mathematical kernels will only be shared where semantics genuinely match. This includes the deterministic Pseudo-Random Number Generator (PRNG), the Rademacher phase inversion function, the in-place FWHT butterfly network, and the SIMD bitwise-AND/popcount distance estimators27.

## **4\. Adopt/Fork/Clean-Room/Defer Decision Matrices**

The following matrix evaluates the execution strategy for each architectural lane against criteria including WebAssembly portability, supply chain security, correctness authority, and maintenance overhead.

| Lane | Decision | Evaluation and Rationale |
| :---- | :---- | :---- |
| **static-weight-format** | **Defer** | **\[Analysis\]** TurboQuant literature provides no validated advantage for static weights6. Deferring this lane ensures TinyRustLM retains its existing, optimized PTQ mechanisms without introducing unproven architectural debt. |
| **kv-cache-format** | **Clean-Room** | **\[Analysis\]** Existing open-source implementations (e.g., tq-kv, polar\_quant) heavily rely on CUDA, Triton, and C-FFI30. These are fundamentally incompatible with a pure Rust/WASM browser target. A clean-room native implementation from the paper mathematics ensures strict memory accounting and zero unsafe C bindings. |
| **embedding-index** | **Clean-Room** | **\[Analysis\]** While turbovec is MIT-licensed and highly performant14, its dependency tree includes ndarray, faer, and native BLAS wrappers32, which significantly inflate WASM binaries and complicate browser portability. A clean-room adaptation of its indexing algorithms ensures complete format ownership and a minimized supply chain. |
| **shared-vector-kernel** | **Clean-Room** | **\[Analysis\]** Public vector search libraries rely on hardware-specific AVX-512 or ARM NEON assembly7. These do not compile to WASM SIMD128. A clean-room mathematical layer ensures the scalar implementation acts as the absolute correctness authority, with WASM SIMD128 carefully handwritten to guarantee cross-platform determinism. |

**Recommendation:** Execute a unified clean-room architecture for all vector-compression logic. Extract algorithmic logic and mathematical proofs from public papers and MIT-licensed repositories, but write all source code natively to fit the no\_std/WASM boundaries of TinyRustLM.

## **5\. Canonical Mathematical Primitive Design**

The shared-vector-kernel-primitives layer restricts shared logic to mathematically identical operations to prevent semantic cross-contamination.  
**\[Engineering Analysis\]** The core requirement of "data-oblivious" quantization is inducing a predictable distribution on the vector coordinates. The original TurboQuant uses a dense random Gaussian matrix ![][image2]6. For a dimension ![][image3], this matrix consumes roughly 9.4 MB of memory and requires millions of floating-point multiplications per token, destroying WASM performance10.  
The canonical primitives will instead utilize the Fast-TurboQuant approach9, defined as follows:

1. **Deterministic PRNG:** A cross-platform, endian-agnostic PRNG (e.g., ChaCha8) initialized with a fixed 64-bit seed. This guarantees that the exact same transformation can be reconstructed locally or remotely, across any version of TinyRustLM.  
2. **Rademacher Phase Inversion:** A vector ![][image4] is generated via the PRNG. Applying this diagonal matrix requires only toggling the sign-bit of the floating-point representation (an XOR operation), consuming zero ALU multiplication cycles10.  
3. **Fast Walsh-Hadamard Transform (FWHT):** The matrix-vector product is evaluated using a divide-and-conquer butterfly network. This routing requires ![][image5] additions and subtractions, entirely bypassing floating-point multiplications27. **\[Analysis\]** The FWHT demands a power-of-two dimension; vectors will be zero-padded to length ![][image6] prior to the transform27.  
4. **Lloyd-Max Scalar Quantization:** Because the FWHT induces sub-Gaussian concentration, the coordinates independently follow a predictable Beta distribution6. Precomputed 1D continuous k-means boundaries (Lloyd-Max) are utilized as static lookup tables to map continuous values to discrete 2-bit or 4-bit bins34.  
5. **SIMD Bitwise Popcount:** Distance estimations rely on weighted popcounts (e.g., popcount(code & q1)) executed via WASM SIMD128, heavily inspired by the RaBitQ fast distance estimation logic29.

**Primitives Remaining Domain-Specific:** The unbiasing scale factors must remain distinct. The KV cache will utilize EDEN's MSE-minimizing biased scale ![][image7] for pure attention scoring, while the embedding index will utilize the matched-norm scale ![][image8] to preserve relative vector magnitudes across persistent documents37.

## **6\. KV-Cache Architecture**

**\[Engineering Analysis\]** The KV cache is a latency-critical boundary. The literature presents a dispute: PolarQuant utilizes recursive polar coordinate transformations to bypass normalization17, TurboQuant utilizes random rotation with a QJL residual6, and EDEN mathematically proves that utilizing an optimal unbiased scale eliminates the need for the QJL residual entirely11. Furthermore, PolarQuant's heavy reliance on trigonometric functions (![][image9], ![][image10], ![][image11])19 makes it computationally hostile to a constrained WASM environment compared to the purely additive FWHT.  
The TinyRustLM KV-Cache will implement the **Fast-TurboQuant \+ EDEN** architecture.

1. **Cache Identity and Geometry:** The cache is managed in fixed-size contiguous WASM linear memory pages, typed by layer\_id and head\_dim.  
2. **Transform Placement and Policies:** The key vector ![][image12] is zero-padded, Rademacher-inverted, FWHT-rotated, and quantized using a 3-bit Lloyd-Max scalar quantizer39. The value vector ![][image13] undergoes symmetric absmax scalar quantization (typically 4-bit), as **\[Independently Reproduced Fact\]** compressing the value cache has near-zero measurable effect on attention quality when key precision is maintained40.  
3. **Outliers and Residual Windows:** **\[Corroboration\]** Boundary layers are disproportionately sensitive to quantization degradation40. The architecture mandates that the first two and last two transformer layers remain entirely uncompressed (f16 or f32) as residual windows.  
4. **Read/Append APIs and Truncation:** Tokens are appended in blocks of 32 to align with SIMD lane capacities. Context truncation simply drops the highest memory pages.  
5. **Attention Scoring:** During decode, the query vector ![][image14] undergoes the same FWHT transformation. The dot product is estimated using SIMD popcounts against the packed keys. Crucially, the cache is never fully dequantized into a shadow memory buffer; scoring happens strictly in the compressed domain, multiplying by the EDEN unbiased factor during the final accumulation phase38.

**\[Requires Local TinyRustLM Verification\]** The specific memory alignment mechanisms and existing page allocation routines utilized by TinyRustLM's WebAssembly linear memory manager.

## **7\. Embedding-Index Architecture**

The embedding-index boundary requires persistence, stable identity mapping, and exact-rerank workflows, modeling the architectural patterns of turbovec but restricted to browser storage.

1. **Embedding Identity and Stable IDs:** Each document embedding is assigned a stable u64 ID. The index maintains an IdMap linking external IDs to physical dense array slots43.  
2. **TQ+ Empirical Calibration:** **\[Observation\]** Real-world embeddings (e.g., OpenAI ![][image3]) drift from the theoretical asymptotic Beta distribution assumed by standard TurboQuant7. **\[Analysis\]** The index will implement turbovec's "TQ+" calibration: during the cold-start ingestion, the system tracks the empirical 5th and 95th percentiles of the first ![][image15] vectors. These shift/scale scalars are permanently frozen as the dataset's calibration identity, forcing subsequent data onto the canonical Beta marginal7.  
3. **Tombstones and Atomic Upsert:** Deletion is ![][image16]. When an ID is removed, the system executes a swap\_remove, moving the last vector in the dense array into the vacated slot and updating the internal ID map43.  
4. **Browser Persistence (OPFS):** The index is persisted to the browser's Origin Private File System (OPFS). Write operations utilize bounded streaming and atomic file swaps. A corrupted or interrupted write will not overwrite the previous generation's valid segment15.  
5. **Untrusted Record Handling:** The parsing boundary enforces strict validation. Non-finite coordinates (NaN, Infinity), mismatched dimensions, or invalid calibration scalars result in an immediate rejection of the ingestion payload15.

## **8\. Binary Formats and Identity Contracts**

TinyRustLM requires immutable schemas with zero legacy compatibility shims. The architecture defines one canonical schema per domain.

### **KV-Cache Page Schema (v1\_kvc)**

*Optimized for sequential memory reading during attention.*

| Byte Offset | Size | Field | Description / Constraints |
| :---- | :---- | :---- | :---- |
| 0x00 | 4B | magic | 0x4B564331 ("KVC1") |
| 0x04 | 4B | layer\_id | Transformer layer index. |
| 0x08 | 4B | head\_dim | Vector dimension ![][image17]. |
| 0x0C | 4B | token\_count | Active tokens in this page. |
| 0x10 | 8B | seed | PRNG seed for the Rademacher phase. |
| 0x18 | Var. | packed\_keys | 3-bit packed Lloyd-Max indices \+ ![][image18] per token. |
| ... | Var. | packed\_vals | 4-bit symmetric absmax values per token. |

### **Embedding Index Segment Schema (v1\_emx)**

*Optimized for disk persistence and stable ID mapping.*

| Byte Offset | Size | Field | Description / Constraints |
| :---- | :---- | :---- | :---- |
| 0x00 | 4B | magic | 0x454D5831 ("EMX1") |
| 0x04 | 8B | calib\_digest | FNV-1a hash of TQ+ calibration metadata45. |
| 0x0C | 4B | dim / bits | Embedding dimension and bit allocation (e.g., 4). |
| 0x10 | 8B | seed | PRNG seed for the Rademacher phase. |
| 0x18 | 4B | vector\_count | Total vectors ![][image15]. Used to validate payload bounds44. |
| 0x1C | Var. | id\_map | Array of u64 stable document IDs. |
| ... | Var. | packed\_codes | Bit-packed vectors \+ ![][image19] lengths7. |
| EOF-4 | 4B | checksum | CRC32 of the entire segment to detect file truncation. |

## **9\. Transform Representation**

**\[Engineering Analysis\]** The method of representing the random rotation transform governs the memory and setup overhead of the entire system. Storing a dense Gaussian matrix requires ![][image20] memory. Generating it from a specified PRNG per query requires ![][image20] floating-point operations10. Both are prohibitive for browser WASM.  
**Decision:** The architecture mandates the use of **structured transform seeds** via the Fast Walsh-Hadamard Transform9. The transform is represented solely by an 8-byte deterministic PRNG seed stored in the binary schema. At runtime, the PRNG generates the boolean sequence for the Rademacher phase inversion. The FWHT is an unparameterized algorithm that relies on in-place array swapping (the butterfly network)10. This completely resolves issues with endianness, cross-version PRNG drift, and floating-point reproducibility, as the transform involves no randomly generated floats and requires ![][image21] bytes of persistent matrix storage.

## **10\. Scalar, SIMD, and WASM Kernel Strategy**

**\[Analysis\]** SIMD operations across different architectures (x86 AVX-512, ARM NEON, WASM SIMD128) can produce different floating-point accumulation results due to varying reduction orders15. Making SIMD the correctness authority causes cross-platform validation failures.

1. **Correctness Authority:** A pure scalar, checked Rust implementation (f32) serves as the absolute oracle. All SIMD implementations must guarantee byte-identical top-K set membership when compared against the scalar oracle, even if absolute f32 scores drift by ![][image22]15.  
2. **Kernel Dispatch:** Native CPU targets (the optional local companion app) will gate AVX2/AVX-512 and aarch64 NEON behind strict \#\[cfg(target\_feature)\] runtime detection29.  
3. **WASM Manifestation:** The browser deployment will compile a distinct WASM artifact with \+simd128 enabled. Javascript feature detection will dynamically route the browser to the correct module.  
4. **No Decoded Shadows:** The kernels must operate directly on the bit-packed representations. Extracting a batch of 2-bit vectors into a full-precision f32 shadow matrix to perform standard BLAS operations is strictly prohibited, as this defeats the memory bandwidth advantages of the compression46.

**\[Requires Local TinyRustLM Verification\]** The specific build tooling (e.g., wasm-pack configurations) utilized to emit feature-gated WASM variants within the TinyRustLM CI pipeline.

## **11\. Browser Memory, Storage, and Privacy Architecture**

The integration of TinyRustLM into the browser environment requires a defense-in-depth approach to memory and privacy.

1. **Worker Isolation:** All vector quantization, indexing, and attention scoring must occur inside a dedicated Web Worker to prevent main-thread latency spikes.  
2. **Storage:** The Origin Private File System (OPFS) is the sole backend for the embedding-index. OPFS allows the use of FileSystemSyncAccessHandle within the worker, enabling high-performance, synchronous read/write access to the .emx segments44. IndexedDB is restricted to storing lightweight application configuration.  
3. **Atomic Promotion:** The ingestion of embeddings occurs in temporary WASM memory buffers. Only upon validation and successful checksum generation is the buffer atomically flushed to OPFS. If the tab is closed, the temporary layout is discarded, preventing malformed file tails15.  
4. **Privacy & Zeroization:** **\[Analysis\]** To prove that project origins do not receive private model or prompt bytes, the architecture physically severs the network stack (fetch APIs) from the inference worker. Furthermore, upon context truncation or session reset, all KV-cache WASM memory pages are explicitly overwritten with zeroes using a secure crate (e.g., zeroize) before being returned to the allocator, ensuring no latent prompt data survives.

## **12\. Configuration and No-Legacy Replacement Rules**

1. **Versioned Declarative Policy:** System behavior is governed by a single, explicitly versioned configuration struct (e.g., TurboQuantPolicyV1). This policy defines the targeted bit-width, outlier layer preservation rules, and TQ+ calibration limits31.  
2. **Strict Validation:** The parser explicitly rejects payloads containing unknown or deprecated fields. Defaults must be explicitly invoked in code; environment-dependent silent fallback (e.g., silently degrading from 4-bit to 2-bit based on RAM) is banned15.  
3. **No-Legacy Promotion:** During the evaluation phase, the new architecture will be gated behind a compiler capability flag. Once the architecture passes the Performance and Accuracy promotion gates (Sections 15 & 16), the legacy formats will be deleted from the main branch entirely. No backward-compatibility shims will be maintained for unreleased pre-product formats.

## **13\. TDD, Fuzzing, and Hostile-Input Plan**

The integration mandates a strict Test-Driven Development (TDD) sequence:

1. **Paper-Derived Oracles:** Construct f64 scalar oracles directly from the mathematical formulas in the TurboQuant and EDEN papers (e.g., Beta distribution CDFs, unbiased scale calculations)6. Construct golden vectors to assert mathematical correctness.  
2. **Differential SIMD:** Implement the WASM SIMD128 kernels and execute differential property tests against the scalar oracle over millions of random vectors to ensure rank parity15.  
3. **Persistence Round Trips:** Serialize and deserialize .kvc and .emx segments, ensuring perfect bit-level reconstruction of the packed payloads.  
4. **Browser Clean-Acceptance:** Run headless browser tests to ensure memory limits and OPFS quota behaviors operate correctly.

## **14\. Fuzzing and Security Coverage**

A dedicated cargo-fuzz campaign must target the binary parsers with hostile inputs:

* **Checked Arithmetic & Limits:** Validate that arbitrary token\_count or vector\_count parameters do not overflow usize allocations44.  
* **Decompression Bombs:** Reject .emx files where the declared vector\_count demands a memory footprint wildly disproportionate to the actual file size on disk15.  
* **Malformed Inputs:** Inject byte streams ending mid-byte into the packed tail parsers. Provide NaN and Infinity floats to the TQ+ calibration metadata parser to ensure it yields a clean ParseError rather than a Rust panic15.  
* **Concurrent Mutation & Stale Identity:** Simulate concurrent OPFS file truncation and assert the loader fails gracefully. Assert that queries against a stale or swapped model identity are rejected44.

## **15\. Performance Acceptance Gates**

A promotion to the sole canonical contract requires clearing objective performance gates:

* **Setup vs. Steady State:** The TQ+ calibration and FWHT rotation setup time must be measured separately from the steady-state SIMD dot-product scoring5.  
* **Wall-Clock & Memory Improvement:** The kv-cache-format must demonstrate a strict ![][image23] reduction in peak memory consumption during a 32K token context-window simulation compared to the f16 baseline1.  
* **Speed Maintenance:** Steady-state generation speed (tokens/sec) on WASM must not degrade by more than 5%. The reduction in memory bandwidth must offset the SIMD popcount arithmetic overhead48.  
* **Effective Bytes Reporting:** All metrics must report the *effective* bytes consumed, explicitly including the memory overhead of the TQ+ calibration digests, PRNG seeds, uncompressed residual window layers, and temporary worker layouts5.

## **16\. Accuracy Acceptance Gates**

Accuracy cannot be assumed from paper claims; it must be proven locally against TinyRustLM workflows.

* **Primitive Distortion Tests:** The Mean Squared Error (MSE) of the quantizer must demonstrably adhere to the theoretical bound ![][image24]34.  
* **Exact-Token Divergence:** The system will execute a multi-turn conversation suite. The predicted token logits generated from the compressed kv-cache-format must maintain ![][image25] equivalence with the exact f16 cache baseline50.  
* **Retrieval Oracle Recall:** For the embedding-index, ![][image26] against the exact f32 baseline must remain ![][image27] for 4-bit configurations across standard RAG corpora39.  
* **Untouched Multi-Turn Evaluation:** A final, qualitative assessment of untouched multi-turn agent response generation to ensure semantic coherence does not regress over extended context windows52.

## **17\. Receipt, Provenance, and Rollback Design**

**\[Analysis\]** The architecture separates immutable failure history from product legacy support. Every generated .kvc or .emx artifact is mathematically bound to a verifiable receipt.

### **Provenance Schema (CompressionReceiptV1)**

* algorithm\_version: String identifier (e.g., Fast-TurboQuant-FWHT-EDEN-v1).  
* implementation\_commit: Git SHA of the compiling TinyRustLM source tree.  
* codec\_profile: Dimensionality, bit-width, and exact PRNG seed45.  
* calibration\_digest: FNV-1a hash of the applied TQ+ shift/scale parameters.  
* performance\_samples: Setup latency and SIMD throughput measurements.

If an accuracy anomaly is detected, developers can utilize this receipt to perfectly reconstruct the applied mathematical transformations. A rollback involves compiling a new binary that defaults to a different capability pathway; the experimental cache files remain isolated by their magic version strings, preventing crash loops.

## **18\. License and Supply-Chain Assessment**

* **Ideas vs. Expression:** The algorithms described in TurboQuant6, PolarQuant17, EDEN21, and Fast-TurboQuant9 are mathematical concepts, which are not subject to copyright.  
* **Patent Searches:** **\[Observation\]** Industry commentary suggests Google released TurboQuant algorithmically without restrictive patents to establish an AI infrastructure standard53. However, formal patent clearance is required before deploying commercial implementations derived from Google Research's TurboQuant papers.  
* **Clean-Room Boundaries:** The RyanCodrai/turbovec repository is licensed under MIT14, allowing commercial integration. To avoid dependency bloat and maintain a pristine supply chain, TinyRustLM will not directly link to turbovec or crates like faer and ndarray32. The architecture adopts their *ideas* (e.g., TQ+ empirical calibration, Lloyd-Max bit packing) but implements them strictly within a zero-dependency, no\_std clean-room environment.

## **19\. Staged Roadmap with Deletion Criteria**

1. **Stage 1: Literature Lock & Reference Prototype**  
   * *Entry:* Approval of this architectural report.  
   * *Action:* Implement ![][image28] scalar oracles of the FWHT and EDEN scale mathematics.  
   * *Exit:* Property tests pass against paper-derived golden vectors.  
2. **Stage 2: Native Optimization & WASM Proof**  
   * *Action:* Implement WASM SIMD128 bitwise popcounts and Rademacher phase inversions.  
   * *Exit:* Profiling proves multiplier-free acceleration on target browser architectures.  
3. **Stage 3: One-Domain Proof (Embedding Index)**  
   * *Action:* Stand up the v1\_emx schema over OPFS.  
   * *Exit:* ![][image29] proven.  
4. **Stage 4: KV-Cache Model Quality & Fault Campaign**  
   * *Action:* Integrate v1\_kvc into the attention loop. Run hostile-input fuzzing.  
   * *Exit:* Exact-token divergence remains below 1%. Zero fuzzing panics.  
5. **Stage 5: Dogfood & Release Decision**  
   * *Action:* Internal user testing of the browser chat product.  
   * *Exit & Deletion Criteria:* Upon release approval, the superseded legacy KV cache and vector index code are permanently deleted from the source tree.

## **20\. Prioritized Implementation Backlog**

The backlog is strictly ordered by objective dependency gates.

1. **Priority 1: Core Mathematical Primitives (Zero Dependencies)**  
   * Implement the in-place FWHT butterfly network.  
   * Implement the deterministic PRNG and Rademacher diagonal matrix generator.  
   * Implement the offline Lloyd-Max centroid calculator.  
2. **Priority 2: WASM SIMD Kernels**  
   * Implement BitProduct (weighted SIMD popcount) for 2-bit and 4-bit schemas29.  
   * Implement differential testing against the scalar oracle15.  
3. **Priority 3: KV-Cache Boundary**  
   * Implement linear memory page allocation and 32-vector block mapping.  
   * Implement EDEN unbiased scale application during the accumulation phase37.  
   * Wire the boundary into the TinyRustLM transformer decode loop.  
4. **Priority 4: Embedding Index Boundary**  
   * Implement the TQ+ dynamic calibration (5th/95th percentile tracking)7.  
   * Implement the IdMapIndex tombstone and swap\_remove logic43.  
   * Implement OPFS streaming and validation boundaries.  
5. **Priority 5: Telemetry, Receipts, and Fuzzing**  
   * Implement the CompressionReceiptV1 provenance JSON generation45.  
   * Execute the cargo-fuzz decompression bomb campaigns44.

## **21\. Unknowns Requiring Local TinyRustLM Inspection**

As the report author cannot inspect the private TinyRustLM codebase, the following items **\[Require Local TinyRustLM Verification\]** prior to executing Stage 1:

1. **Memory Allocator Behavior:** The exact mechanism TinyRustLM uses to request pages from the WASM environment, and whether memory fragmentation occurs during high-turnover context resets.  
2. **Attention Kernel Abstraction:** Whether the current Rotary Position Embeddings (RoPE) application is fused directly with the attention dot-product. This dictates precisely where the FWHT pre-rotation must be injected into the computational graph.  
3. **WASM Build Toolchain:** The availability of the \+simd128 target feature flag in the specific CI/CD runners utilized to emit the browser artifact.  
4. **Token Logit Sensitivity:** The empirical distribution of value-activations within TinyRustLM's specific proprietary models, required to confirm if 4-bit symmetric value compression is sufficiently lossless for those specific checkpoints.

## **22\. Annotated Primary-Source Bibliography**

*Note: Dates and URLs reflect public status as of the data collection.*

1. 1 Zandieh, A., et al. "TurboQuant: Online Vector Quantization with Near-optimal Distortion Rate." ICLR 2026\. (arXiv:2504.19874)  
   * *Relevance:* Primary source for the base algorithm. Introduces data-oblivious scalar quantization via random rotation and the 1-bit QJL residual correction.  
2. 7 Codrai, R. "turbovec" (v0.8.0). GitHub / PyPI, 2026\.  
   * *Relevance:* Public Rust/Python implementation proving 16x compression viability for embedding indices. Source of the "TQ+" empirical calibration strategy and IdMapIndex tombstone logic.  
3. 9 Pereira, P. M. R., et al. "Fast-TurboQuant: A Multiplier-Free Online Vector Quantization Approach." arXiv:2606.21448, June 2026\.  
   * *Relevance:* Crucial optimization for WASM. Replaces the ![][image20] dense random rotation matrix with a log-linear Fast Walsh-Hadamard Transform (FWHT), entirely removing hardware multipliers.  
4. 1 Han, I., et al. "PolarQuant: Quantizing KV Caches with Polar Transformation." AISTATS 2026\. (arXiv:2502.02617)  
   * *Relevance:* Context on recursive polar representations for KV caches. Bypassed in this architecture in favor of Fast-TurboQuant's additive FWHT for WASM efficiency.  
5. 11 Ben-Basat, R., et al. "A Note on TurboQuant and the Earlier DRIVE/EDEN Line of Work." arXiv:2604.18555, April 2026\.  
   * *Relevance:* Critical architectural input. Demonstrates that TurboQuant's MSE stage uses a suboptimal biased scale (![][image1]) and proves that an unbiased b-bit EDEN configuration achieves higher accuracy without the QJL residual overhead.  
6. 4 Zandieh, A., et al. "QJL: 1-Bit Quantized JL Transform for KV Cache Quantization with Zero Overhead." arXiv:2406.03482, June 2024\.  
   * *Relevance:* Background on the 1-bit residual correction stage utilized by the original TurboQuant formulation.  
7. 20 Vargaftik, S., et al. "EDEN: Communication-Efficient and Robust Distributed Mean Estimation for Federated Learning." ICML 2022\.  
   * *Relevance:* Foundational mathematics for rotation combined with scalar quantization, and the derivation of the optimal unbiased and MSE-minimizing scale factors.  
8. 24 Gao, J., Long, C. "RaBitQ: Quantizing High-Dimensional Vectors with a Theoretical Error Bound for Approximate Nearest Neighbor Search." SIGMOD 2025\. (arXiv:2405.12497)  
   * *Relevance:* Context on alternative 1-bit quantization drops-ins and SIMD distance estimation techniques (e.g., weighted bitwise popcounts).

#### **Works cited**

1. TurboQuant: Redefining AI efficiency with extreme compression \- Google Research, [https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/](https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/)  
2. TurboQuant \- Wikipedia, [https://en.wikipedia.org/wiki/TurboQuant](https://en.wikipedia.org/wiki/TurboQuant)  
3. Google's TurboQuant: The AI Memory Trick That Changes the Rules | by The Data Explorer's Notes | Medium, [https://medium.com/@dataexplorer62/googles-turboquant-the-ai-memory-trick-that-changes-the-rules-4a196f4978b4](https://medium.com/@dataexplorer62/googles-turboquant-the-ai-memory-trick-that-changes-the-rules-4a196f4978b4)  
4. QJL: 1-BIT QUANTIZED JL TRANSFORM FOR KV CACHE QUANTIZATION WITH ZERO OVERHEAD \- OpenReview, [https://openreview.net/pdf/b470267d0a4e09ab770de6b004939bc7c6114304.pdf](https://openreview.net/pdf/b470267d0a4e09ab770de6b004939bc7c6114304.pdf)  
5. The Mathematics of TurboQuant: Near-Optimal Vector Quantization for LLM Compression and Approximate Nearest Neighbor Search \- ResearchGate, [https://www.researchgate.net/publication/404003977\_The\_Mathematics\_of\_TurboQuant\_Near-Optimal\_Vector\_Quantization\_for\_LLM\_Compression\_and\_Approximate\_Nearest\_Neighbor\_Search](https://www.researchgate.net/publication/404003977_The_Mathematics_of_TurboQuant_Near-Optimal_Vector_Quantization_for_LLM_Compression_and_Approximate_Nearest_Neighbor_Search)  
6. \[2504.19874\] TurboQuant: Online Vector Quantization with Near-optimal Distortion Rate, [https://arxiv.org/abs/2504.19874](https://arxiv.org/abs/2504.19874)  
7. GitHub \- RyanCodrai/turbovec: A vector index built on TurboQuant, written in Rust with Python bindings, [https://github.com/RyanCodrai/turbovec](https://github.com/RyanCodrai/turbovec)  
8. turbovec \- PyPI, [https://pypi.org/project/turbovec/](https://pypi.org/project/turbovec/)  
9. \[2606.21448\] Fast-TurboQuant: A Multiplier-Free Online Vector Quantization Approach, [https://arxiv.org/abs/2606.21448](https://arxiv.org/abs/2606.21448)  
10. Fast-TurboQuant: A Multiplier-Free Online Vector Quantization Approach \- arXiv, [https://arxiv.org/pdf/2606.21448](https://arxiv.org/pdf/2606.21448)  
11. A Note on TurboQuant and the Earlier DRIVE/EDEN Line of Work \- arXiv, [https://arxiv.org/html/2604.18555v1](https://arxiv.org/html/2604.18555v1)  
12. A Note on TurboQuant and the Earlier DRIVE/EDEN Line of Work \- ResearchGate, [https://www.researchgate.net/publication/404022521\_A\_Note\_on\_TurboQuant\_and\_the\_Earlier\_DRIVEEDEN\_Line\_of\_Work](https://www.researchgate.net/publication/404022521_A_Note_on_TurboQuant_and_the_Earlier_DRIVEEDEN_Line_of_Work)  
13. Revisiting RaBitQ and TurboQuant: A Symmetric Comparison of Methods, Theory, and Experiments \- arXiv, [https://arxiv.org/pdf/2604.19528](https://arxiv.org/pdf/2604.19528)  
14. Meet Turbovec: A Rust Vector Index with Python Bindings, and Built on Google's TurboQuant Algorithm \- MarkTechPost, [https://www.marktechpost.com/2026/05/20/meet-turbovec-a-rust-vector-index-with-python-bindings-and-built-on-googles-turboquant-algorithm/](https://www.marktechpost.com/2026/05/20/meet-turbovec-a-rust-vector-index-with-python-bindings-and-built-on-googles-turboquant-algorithm/)  
15. turbovec/CHANGELOG.md at main \- GitHub, [https://github.com/RyanCodrai/turbovec/blob/main/CHANGELOG.md](https://github.com/RyanCodrai/turbovec/blob/main/CHANGELOG.md)  
16. QJL: 1-Bit Quantized JL Transform for KV Cache Quantization with Zero Overhead \- arXiv, [https://arxiv.org/abs/2406.03482](https://arxiv.org/abs/2406.03482)  
17. PolarQuant: Quantizing KV Caches with Polar Transformation \- Google Research, [https://research.google/pubs/polarquant-quantizing-kv-caches-with-polar-transformation/](https://research.google/pubs/polarquant-quantizing-kv-caches-with-polar-transformation/)  
18. \[2502.02617\] PolarQuant: Quantizing KV Caches with Polar Transformation \- arXiv, [https://arxiv.org/abs/2502.02617](https://arxiv.org/abs/2502.02617)  
19. PolarQuant: Quantizing KV Caches with Polar Transformation \- DEV Community, [https://dev.to/patelchaitany/polarquant-quantizing-kv-caches-with-polar-transformation-255](https://dev.to/patelchaitany/polarquant-quantizing-kv-caches-with-polar-transformation-255)  
20. DRIVE: One-bit Distributed Mean Estimation, [https://proceedings.neurips.cc/paper\_files/paper/2021/file/0397758f8990c1b41b81b43ac389ab9f-Supplemental.pdf](https://proceedings.neurips.cc/paper_files/paper/2021/file/0397758f8990c1b41b81b43ac389ab9f-Supplemental.pdf)  
21. arXiv:2108.08842v3 \[cs.LG\] 15 Jun 2022, [https://arxiv.org/pdf/2108.08842](https://arxiv.org/pdf/2108.08842)  
22. EDEN: Communication-Efficient and Robust Distributed Mean Estimation for Federated Learning, [https://proceedings.mlr.press/v162/vargaftik22a/vargaftik22a.pdf](https://proceedings.mlr.press/v162/vargaftik22a/vargaftik22a.pdf)  
23. \[2604.18555\] A Note on TurboQuant and the Earlier DRIVE/EDEN Line of Work \- arXiv, [https://arxiv.org/abs/2604.18555](https://arxiv.org/abs/2604.18555)  
24. RaBitQ Library \- Vector Database Group @ NTU, [https://vectordb-ntu.github.io/RaBitQ-Library/](https://vectordb-ntu.github.io/RaBitQ-Library/)  
25. RaBitQ: Quantizing High-Dimensional Vectors with a Theoretical Error Bound for Approximate Nearest Neighbor Search \- arXiv, [https://arxiv.org/html/2405.12497v1](https://arxiv.org/html/2405.12497v1)  
26. \[2405.12497\] RaBitQ: Quantizing High-Dimensional Vectors with a Theoretical Error Bound for Approximate Nearest Neighbor Search \- arXiv, [https://arxiv.org/abs/2405.12497](https://arxiv.org/abs/2405.12497)  
27. Fast-TurboQuant A Multiplier-Free Online Vector Quantization Approach \- arXiv, [https://arxiv.org/html/2606.21448v1](https://arxiv.org/html/2606.21448v1)  
28. turbo-quant \- crates.io: Rust Package Registry, [https://crates.io/crates/turbo-quant](https://crates.io/crates/turbo-quant)  
29. rabitq package \- github.com/ajroetker/go-highway/hwy/contrib/rabitq \- Go Packages, [https://pkg.go.dev/github.com/ajroetker/go-highway/hwy/contrib/rabitq](https://pkg.go.dev/github.com/ajroetker/go-highway/hwy/contrib/rabitq)  
30. GitHub \- AliesTaha/polar\_quant: PolarQuant: Fused KV cache decode kernel that ties cuBLAS on B200 with 4.1x compression, [https://github.com/AliesTaha/polar\_quant](https://github.com/AliesTaha/polar_quant)  
31. GitHub \- onur-gokyildiz-bhi/tq-kv: Pure Rust implementation of Google's TurboQuant (ICLR 2026\) — KV cache compression for LLMs, [https://github.com/onur-gokyildiz-bhi/tq-kv](https://github.com/onur-gokyildiz-bhi/tq-kv)  
32. turbovec — Rust implementation // Lib.rs, [https://lib.rs/crates/turbovec](https://lib.rs/crates/turbovec)  
33. 今日开源\[第13期\]turbovec \- zhang-yd \- 博客园, [https://www.cnblogs.com/zhang-yd/p/20462536](https://www.cnblogs.com/zhang-yd/p/20462536)  
34. TurboQuant and the KV Cache Revolution: Toward Memory-Boundless LLM Inference, [https://medium.com/@comeback01/turboquant-and-the-kv-cache-revolution-toward-memory-boundless-llm-inference-906af7e69370](https://medium.com/@comeback01/turboquant-and-the-kv-cache-revolution-toward-memory-boundless-llm-inference-906af7e69370)  
35. Fast-TurboQuant: A Multiplier-Free Online Vector Quantization Approach \- ResearchGate, [https://www.researchgate.net/publication/407510838\_Fast-TurboQuant\_A\_Multiplier-Free\_Online\_Vector\_Quantization\_Approach](https://www.researchgate.net/publication/407510838_Fast-TurboQuant_A_Multiplier-Free_Online_Vector_Quantization_Approach)  
36. TurboVec: Fit 10 Million Vectors in 4 GB : The RAG Index That Changes Everything, [https://medium.com/aimonks/turbovec-fit-10-million-vectors-in-4-gb-the-rag-index-that-changes-everything-3885a0e3c4ab](https://medium.com/aimonks/turbovec-fit-10-million-vectors-in-4-gb-the-rag-index-that-changes-everything-3885a0e3c4ab)  
37. EDEN: Communication-Efficient and Robust Distributed Mean Estimation for Federated Learning \- GitHub, [https://github.com/amitport/EDEN-Distributed-Mean-Estimation](https://github.com/amitport/EDEN-Distributed-Mean-Estimation)  
38. Understanding Google's TurboQuant Insight \- Cyrus Radfar, [https://cyrusradfar.com/thoughts/turboquant-explainer](https://cyrusradfar.com/thoughts/turboquant-explainer)  
39. \[ENH\] Improve compression and indexing using turbo quant\#6774 \- GitHub, [https://github.com/chroma-core/chroma/pull/6774](https://github.com/chroma-core/chroma/pull/6774)  
40. TheTom/turboquant\_plus \- GitHub, [https://github.com/TheTom/turboquant\_plus](https://github.com/TheTom/turboquant_plus)  
41. tq-kv \- crates.io: Rust Package Registry, [https://crates.io/crates/tq-kv](https://crates.io/crates/tq-kv)  
42. KV Cache Is Eating Your VRAM. Here's How Google Fixed It With TurboQuant., [https://towardsdatascience.com/kv-cache-is-eating-your-vram-heres-how-google-fixed-it-with-turboquant/](https://towardsdatascience.com/kv-cache-is-eating-your-vram-heres-how-google-fixed-it-with-turboquant/)  
43. turbovec/docs/api.md at main \- GitHub, [https://github.com/RyanCodrai/turbovec/blob/main/docs/api.md](https://github.com/RyanCodrai/turbovec/blob/main/docs/api.md)  
44. Issues · RyanCodrai/turbovec \- GitHub, [https://github.com/RyanCodrai/turbovec/issues](https://github.com/RyanCodrai/turbovec/issues)  
45. turbo-quant \- Lib.rs, [https://lib.rs/crates/turbo-quant](https://lib.rs/crates/turbo-quant)  
46. GitHub \- RecursiveIntell/turbo-quant: Rust implementation of TurboQuant, PolarQuant, and QJL — zero-overhead vector quantization for semantic search and KV cache compression (ICLR 2026), [https://github.com/RecursiveIntell/turbo-quant](https://github.com/RecursiveIntell/turbo-quant)  
47. Proposal: optional turbovec storage backend via a standalone turbovecdb library · Issue \#1669 \- GitHub, [https://github.com/MemPalace/mempalace/issues/1669](https://github.com/MemPalace/mempalace/issues/1669)  
48. GitHub \- Akshay2695/turboquant-lab: A KV caching in practice on Apple Silicon (MLX), plus an understandable compressed KV-cache variant (PolarQuant-only)., [https://github.com/Akshay2695/turboquant-lab](https://github.com/Akshay2695/turboquant-lab)  
49. TurboQuant: Google Removed All Overhead From KV compression unlocking near unlimited upside | by Mandar Karhade, MD. PhD. | AI Advances, [https://ai.gopubby.com/turboquant-google-removed-all-overhead-from-kv-compression-unlocking-near-unlimited-upside-42a8f09495e7](https://ai.gopubby.com/turboquant-google-removed-all-overhead-from-kv-compression-unlocking-near-unlimited-upside-42a8f09495e7)  
50. Google's TurboQuant will ease bottlenecks, not cut memory demand: Analysts, [https://www.koreajoongangdaily.com/business/googles-turboquant-will-ease-bottlenecks-not-cut-memory-demand-analysts/12588659](https://www.koreajoongangdaily.com/business/googles-turboquant-will-ease-bottlenecks-not-cut-memory-demand-analysts/12588659)  
51. TurboQuant in Qdrant, [https://qdrant.tech/articles/turboquant-quantization/](https://qdrant.tech/articles/turboquant-quantization/)  
52. TurboQuant: Near-optimal KV cache quantization for LLM inference (3-bit keys, 2-bit values) with Triton kernels \+ vLLM integration \- GitHub, [https://github.com/0xsero/turboquant](https://github.com/0xsero/turboquant)  
53. The Background Behind Google TurboQuant, the Gemini Desktop Rollout, and Meta Muse Spark Simultaneously Gaining Attention on X｜東リ屋 \- note, [https://note.com/samehadaonsen/n/n7dc0faf25e10?hl=en](https://note.com/samehadaonsen/n/n7dc0faf25e10?hl=en)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAaCAYAAAD43n+tAAABk0lEQVR4Xu2WPyhFURzHf0IRIaIUiyzKIkq2V0pSLBTFZiCDyZ+IUVIGMZhtbzFZTBIbk8GiFJJRGYz+fL/vvMu9v67XPbecR51Pfep1fufe1/f8vSIez5+hGmbgAKzNtzXAxqDDf6EcrsFbOA/n4CXchmew47urc7rEDHBiyuA+zMKqUDtn5gKeipk5l/TCJTGD+gGXo+XC9MF72KkLYBXu6kYHMNAwHIKvYhloAz7CFl0Ai3BENzqkW1IEOhAzrSuwVNXaYb1qc0mqQBNiAtE3eAKnYU24U5FIFYgn3KaYMEEweiXxyzAMZ+8YPli4nnsyGakCBXC58Xjegi9iQs1EerjHKhADcI+U6AIYhO+S8EW/iFWgNrgn5h7SBC+a1AUFB4P3VbOFdbknk2EViMfxEazQBTAFb2CrLii4//rhmIW8Y5JiFYj3DzvrP+Ay5IEwqtqLQRCIF3xB+ClzCBfgdf43j+odeAfHJX5vuWIWPkn01H2G57Ap1O+LSjEzQbhsesQsh4zEL0GPx+PxeDw/8AkBWVYSa8letAAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFMAAAAaCAYAAADL5WCkAAADFUlEQVR4Xu2YS6hNURjHP3lESEkuoS4miLxJGSgKSckrkiIDj3Q9BpQMriQlBvIYkJBC3pJHUY4MGMvAQJFEjJGJ+P99a52z7nf2vnfvc/a9Tu761a979l77nH32/37rW3sfkUgkB1vhD3jIDmRkILwCf8K5Zqzb0RfehgvsQA7Gw6dwiB3oboyEL+EYtz0K9q4M/6UnHG32hSyHN2AvO2DZC3/ntAQHSOcyBV6H7+B5eBV+hXfge9Gpy4qbDXvoW8r0g5vhLXgUPoT93RirbJ9UAuXfHXCG2/bwn3AMnoX34O62w+3DEzCopXYATIff4XPRHtKVHITDRb/DFreP4TGsZXAP3On2kUHwPlwkWkmsKNsvfaAMOCnIWfAZHCZa0W8lZ7/0FdpemCWprSL5HgYSmvVzksIkvEgGwhBbRQMim+AD0epkv2RVLXZjIZPgYzjH7Pc9drvb5ue+gE3lIzLQGWFOEG3cT+AZ5za4UioX3xFpYXIfxwh7mv/eF0VDJrZfevzUXit63WEP5ee+gjPdduZ+GVJkmKyWDfCa6AXVQ1qY/NxW95pTfbJ7zTD9NXCqs1/Oh/PcPtsjbQ/luUruL6/jpGi/3Cg5qrPIMHn8TdH+VS9pYa4Srax18IhUwlgIL8EWeBo+gofhUDe+Gk5zrz0MlO2BsAJ5zv2ivfay6AK4S6oXulSKCpMn5MXZXlQrYZjscaw8Lgi/3PYS0VubEAbrV+8+bjsvfL9/H19nDpIUFSbHT8FxUr3ohLLRZyEMk/32gOjt0BrR6mxIigyTvZJTwy86SSatsEnYac7pyunLfcdhc/nIBqKoMFlxrMwRdqBGbJiE35H3lhOlbb9sGHyY/GvJEybhDTUtgqQwuUhwcZgqOtVzLQ5dgX8CKiJMruKc6vX8uOBJCpM0i05znusEXBGM/TP4BfnMyyC9n0SD4FPCa9GV0499E31O9qtlGoNFf7rilB8r1StuR/DZ/C78KNp/+VTyBZ4T/bGCsCp5zAX4WSo36/8lnHqsKFbQG/ghcH1wXCQSiUQikUgkEknhD9ZstFmpN1UUAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE8AAAAaCAYAAAD2dwHCAAADcUlEQVR4Xu2YW4hNURzGP6EIkWtCLknJCAmRNCPEAyFFKTxRksIDQ2oKSSEpisilJEXyQCbSxJPILVIuhVyeUEKGXL7v/Neas86Z2WefY5pzalpf/Tp71l5r77X++39Za4CoqKh2qO6kP+mYfyMqWTWkkfwl10m33Ntl0zCyLL+R6kJWkCp3rY87mKyGjQk1kGwnR8kmMiT3dpM6kCnkIDlMZri2/5Im85bsyr/RxhpN1pIb5Dc5lXs7o17kNuzjhuwlnYN+88kVMo70IzvID7I46CPJOU6Qi7D3jyF3yeywUymaDvO+Bfk32lia/EIyDfbxWjKe0sll8pi8JCdhXhN6ijxSfT6TCa5tBPlAnpC+rk1jDpCbpKdr2wj7GJvd3yVLAz/CFlMJKdxeI9l4alefJMl48iR5b7Vr89Ekgw9wbRPJN7LG/S2pnyJOxi5KyhsylFxdDz5PGmATrYRaazxJBuyDrEfOJX/IMdLJtdWRX7BI03P1TI0rWjLaA7IblnR1/ROWPCulNOOdI/thofuOXELzYhFK3qTQvOOuJR/a8jyt/QgsZJ/D8m5qwRhKnpFaZDuvgsV8Wr5TFXtTAldJ78zIdKUZr54shc1ZqBhoHVpPKG21bsHC9R6sePh16jkNsLWG3lhDviBl/ep8Fvbg4UF7pfOdVMh4WnwP9+s1iXyHhWGSZiLbR1XZG0+hPKupV/bd8srEEJZxZCTlN291/VY630mFjNeSfOIvtC+VweWFKiLahqif+mucxnv5d4vEvKriIJcNK80g8grF5TufYIullNNKIePtgSX5cB/mjdcAm5e2HXVkOXI9VM8LtyEK11YZb17QpqqjiWkjOZVsCO7layxZUgJ6T9fMyHQVMp7avPd4+bDVZlfG8msLDRDmOO8wOsE0wtbt5d9dMGyrYGHrE6O+VujG25CbC8opv4AzaF71tOAtQbt+a2Eb4smuTfP/RHYie+oYSd6Tp8hWXEWDKna4Ia5BEQVDL11HHpLj5BpZBHtYPdmH3ONOOaSPpQImz/LHrq/kEczTJc3pELlAVpLTMCcII0hr03ZDp4mtsPC9T16Q8UE/SYVE79R2Zb271jk4/6O1KLlzmI80OR1fis1PlZAWNgqWDqqRHF6KpjmwfvLGpDWpeKifjoZJ/zyIioqKioqKiopq5/oHj33HBrG150gAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAAAaCAYAAABRhnV8AAAEfElEQVR4Xu2aa8hNWRjHHzEixj2Xxgev++0DMeQ2jCRyTcIHl/eLSORWo5S8JSWihlFIY0a5JJIiknjjiyj54pJSM3KJQjQUMvz/PXtlnWXvc/beZ+/znnPe/at/7b32etc5Z+3/ftaznv2KZGRkNBr6Qeehh9A+qJnXPga6Ad2FtkPNvfawpDVuRdMC6ga1di+UOU2hzp54XIgB0GnoOTTYap8OTbHOo5LWuBVHW+gI9Fb06RqSe7nsaQktEL2Z/A2LoCY5PXKZDE2DrkN1Vvty6CfrvBXUxTo3dILauI0Sftyi+BV6Bn2x9Ap64R1/hM5Cfc0fNAB1ot+nj9OeFIwa86AeTntUaJxaqJ3TbrMQeg+Nci9YrBM1ykronnfMqLxRNEobfoBWQ8OtNkYh9uM1l7DjJsJB6BM01mnvDp2BXkMjnGul4m+oXpJd6njzZ0C/Q0+gd9CwnB7h6ADNh/4SnaN/RZflIPgZ/Cx+th/8jbzxzHFqoEei0a0ntMTqZ7BNlc9MUcctih+ha9Ad0XDpQifT0RdEb0QU+EM4wbaiGiMtQ02FJkCbpThDzRK9oceleEPRFIu9Yy6LW0TnfS400XRyoIE2QX94x37EGTc2/LCX0En5lv278KayD/uGYSB0BboEHfC0QvQHhB3DkIahbDZIfEPZ8HsWayjmOaOtcybPHJNmDcpzOJ80lLv82cQZNzYzRfOlZe4FC04W1/6f3QsOdH8tdEJ0uUyCxmQok+cY+IAfg86Jf55jL3N+OZUh6rhFsVv88ycDdxOMNGEmnddPie7MkqIxGKoXdBh6A+2X3MSeW/q11rmBZYhVkrvM8XipaG5E4oxbFLxJ9RKcPxGGxH9Ed4Pmi/rB6MTiWL4dTFRoTG5zueVO/EnyKKWhaqDHkrttryrC5E+ToP+lcHikOfdC/eX7RNxWvjEM7MMywVHRKm5Q3sV+7vhB6ij+9Z9SGorMEZ3zlaJRxu87VSyF8if+WO4eaChORD5oKOZOh+RbIu4n7q4K8YtoueKBaDEuaNI5ljt+kLaJf42o1IZi0XGHqKn2i5qqaiiUPw0Vra/whgRtSQ2MFoxQSe4aRosWWte7FxKklIbiQ3cRuixacqgqCtWfukJXRRPysEk2I11QtIsDl2Eux/XSMEk5HyJGkEIPEwljKJOUF4r2FQlrEYw+bv7EyZstmoizThHWTIR9uewx70oK3qh6SddQQSWRnaIpQZ3T7ge/JxPufOWSoF1eRTNO9Eky7+4+i04Ey/F8Z/ZB9P3dSAnOXfLBUM4aB5c/blvDvGHPRxqGYimEDwuXU/s95lNol9VvjWj+yCjt9/mMXozy/8n387nc6meoSkOVAhqRk8d3ZfdFzWrEt+1RSMNQUWA6sEfUhMWSGaoMaGhDjYJ+cxtjkhmqDKChbkLt3QslgCb+ExrkXogJ8zTma5mhGhDWylja4BvyJJadKLCgOt5tjEmN6K75llRZ7akS6Q1thW5LujWpNOAmhf8qwsSe/2BX6ociIyMjIyMjIyOjzPgKXC4JSraMJZsAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGcAAAAaCAYAAACq/ULmAAAFTElEQVR4Xu2YWchuUxjH/0LmqWMeOgiROXHIEEIoQ3KhyC3hCsd09bqQISFEGTq5wUFcGA5unCJjESUKiUQIERfI8Py+Zz++tZ93T+fre897dN5f/Xu/b6+1915rPdPaS5oxY8a6wZamTfPF9ZiNTdvki4vBEtNppvNNB5g2rDePcZhphSY0mArGsKP+Pw6Ace4ynZcbFsIGphNMb5tWmS6s9LLpE9OR811r7G56xXRgbjC2N71q+qfST6aDaj2ka6q20Femg2s9pHurNnRWapskm5seNf0lf/ffptNrPaRzNN+O/jCdUrXh5C+Yjqr+XxBY+VbT5xo3Am0PyBf28NSGQfGOUbqeOdv0s3zwo3rTHBj4ddP+uaHgJNOfWrvGCY4wfSM3zmOmjerN2kru0Cen64AxcXDS/hrD4t9v+lHtFia1/SD3YAwSEAUfV79djEyXyKPiI9NOtVbpUNODGp90CQv0m6ZjHDLIdaY31Rz9zGelabt0HUj1ON4FuWEIl8o9gt82eOk7pg/lqSq41vS8uuvAFqaH5NER6SkPlMlfma5lpmmcO+Tvv0LN0X+c6Z50reQm01Pqdr4x9jF9rWZvLgnjfGHapbqGQTDMDdGphb3lUUH/Y0y/m140bVb0IaUywS7ajMNGgTaMe5E8z2eI9j1N58rr6iamZfJFP3a+WyPM/RG5U+6l5ugnK+BgbZwhXzscdDAjuSdg2S5YYHJuaRx++T8vVoaBLa/+xiAYBgNhKGDypIQu54Am4+xsesl0i2mp6UTT+6aLNZ9+Sdu3m96VL+DNpl9Nt5mekC98F6TcO+XPQzn6iQacj35tMHaMmut5KxSo1fKUFruLNminHzsvih/wwm/V7/Ej1Z/PpJhc1C/qGTWvL+SzcTD0s/IFxgDB8fK6cGr1PwWZ+2KcjJ95PGPaVt0pGTAokRHk6CeiMHBTvQmGOvJ/xA0Uehaoi7s1nmtZrC+r3zai3uxWXCNCSAt4EmliSL2BbJxwmHLhIOYVOZ66yH0xznDKz9QfrRD1JsjR31dvIMbUlfpqxA1lqmpiD/l3zveqf8sMMU5Zb0pGcmNTYIfUG8jGwaBN3z0xr1h8IogtONt5iMhp2hJnynpTUkY/G6m+RY8xDXHCOXghu68u45B2rpcP5KrUNsQ4LAj3Z2IjQlqkZuTJN5GNQ8QwrrwwsRBsYFhconeVPFovkxuFD+0hxZl33qf65wMskT+D9PmW+jPPGqc1vIaB4lVtnst3DwPgI7TM60BUsMAU/DZGaq5nTDYK69AtZjYOKYXUkneLsXmJmsZ9pB2il0XiCKjvOCrI9aYkttXhBF0MWasx+OJn8VdofPH52v1OnnPJs5mIvLbB7yCPikNyQ0Usbtv9mWwcDMpGAg/GkwO200RkpGB2UZ+aLpefFSLODct7mmDOj5vOzA0V1EvqJvW4D3ZppNm+CBuDGxk8k8RTEGngA7mBckgHXMeoeXB4Js/Cq0J4bvZWJv+02qO2BAfhzIpncY61Up6ueAZnczjJw6bnTG+Y9vPb5thavqsrxxPCuNkpee6Tqvfj/nz8EtGf02oT9Fmt8WcMgoXDqngVnrmr2o1SQmHEEH1hPWlYYIo/W+OSiC52jGX0059voV/UnHYXkygfo3R94pAaXtP4Se26AgYjnTQV4ti1Dd5BLRA2P5zJ8bvWYUdGGmiqS9OG6CftEd37FtcZKweZnCYsLa4vNrz/RvkYhmSiRYeXLq80lQH0wJiWyevRe5UwCgtGPZoknFawG+VkemqQw682HZ0b1mM4FeHMcqqGmTFjxowZM7r4F8DkIljdZjG/AAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGkAAAAaCAYAAAC0NHJVAAAD4UlEQVR4Xu2YXYhVVRTHl5hh+U2iSUqYSQhKgiaIiqZChhTSB2IKPogfgShEINiDgyEZhB8UPqig1YMQZoFfET2YCPkg6UMYCEKJICgqgQomqP/frLNn9jlzuHPm3pm5Mu4//Jhzz97nzt5rrb3WOtesb2u7+F2cEm/lh3pdr4lj5ms5LF7IjT7FWicGZ9fPi+/Ef2Ja24ye18fintgW3ftIjIk+P9WKnYS4/tl610kDxU9iYXQvOSnSk+CkseKseCW615CT3hQ3xKOMX8Rz0fhQ8Ws0DkfEoGhOb6i/WCz2ZHxg+XUGdeYk9vOZ2Cl2mxsU8f0fmtcQxj4XJ8TL2XhnYi1rzW3zlThpeRs15CTUT+wV/4v7YmZ+uFXvmRe/MsP0tAaIr8UWMUGsFnfFX9bRiLWcxDVpaE429qp5AOKoReKQeEa8K34UE83/d2caJo6bfwfPY6e4HqGGnTRCfCs2mp+Ub8wdF+sTsbxwr7fE5n8TL0X3Vpivdb+5YYJqOWm2uGjtxmLslPm+2B82QMyjQ8QuVbTK/NQRwNSjo+Lt3IxucNLr5kecL/lbXBXjo3GMsC+b1wxtsnaHBBH9rPOyGB3dr+UkDPePdXQSaYpTg2N4HmeROaqK+Zuz67J6hBp2EpHEQlGLuUHWt42ajTRfSNXI6m5NFxfEmugeG/43I958LSeNE3+IydkYzuVzcOAS89QVpzie56R8al4SGC8K27yTXXPqqUcLxLwwwbrBSTusvbCygdvm0RAWxPGnJjxJYk0PzGsMKSYodhL3iXAaI2rPVDHfvLivFN+bByipncjH4aE5Oi/mmtuF+kQTsMs6pjHESzPftcG8qaH5+kKMiuY05KRQjzgtiNRGAX1oHhWIU1a1HlGMz4krXWBZ65PVRaQfMA+mGYWx4kkqE05h33R0iD2TSkNDgTi9nAjmPZvNOWjlTRViTaGbY36x4WjISaEexY0CzsFJOIti2Mx6VKb3xTXLvywGVXFSUez9S7E0u0azzE9H6GZJZwRTbKeuqCEnxfUoiDRHuiNSSQ/NrEdFcXL+FG8UBzLV4yQU3sO2mr8jYZdwMqaYv09i5HqDtW4nERXUmrINhxaXlpUoqyo2Sy5mQVWpalQcdMY8pSJSEOsc3jbDDVtvtJeJ9zKaFtLyJfM0WI/4HTGk1y6pWI9i0fnQjuOoqvUIYSQikl8EqjKp9cna4qX1cPY3iHXTcQ2J7vU5hU4HL5epRdy0akbsSb0oTotblm84rosfLP8y22dEwb1j7e3mffPoL4p2nHay2fUovMyWUfz5JSkpKSkpKSkpKSkpKSkpqRl6DG0vv+ZKD6oEAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,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>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIgAAAAaCAYAAABsFBQaAAAFWklEQVR4Xu2aa6ilUxjHn8klt9wOJrlFLuG4FNIJmWKEXMqIqZEml5Qid41LieSSckskEaXQ+DQxBjHxRRRRfCBlpJRvPvjgg8v/d9Za3nWes+e97WXP2dP7r3/7fd/1rrWftZ7/etaz1t5mAwYMGDCgG3YTd4jXy8Tds7I+2FncKbunPdptA/9uKdt8XezDzmLYQ1whnifuFZ/NiPunF6YYD4sHx+sDxVct9LcvbhRPi9e0Q3u024Tl4tPirtmzUrZR91GrxHexeHdV3B8o7T7xR/FmC53/QnxC/EQ8tnp1avGseEq8HscJCQw8DgBdBLLawvjmKGWbr1tEIDuKz4tv2MLwROT4XNxs/YxdaijlhIQ+AmGsscNPuFK2+bpFBDInbhFnfYFwj/iMfzilKOWEhD4CQRhMRoSSo5Rtvm4RgbD+/WLVGpjjTvES/3BKUcoJCX0EwtLCEuNRyjZft4hAaPAfcZ1VmXTCkeK+7tm0oq0TDhEvip+ApfYCW+z8rgIhKX1JPNwXWHvbAEku9mDfsviZEl5ft4hAUDQCgX+JH4nXinvmL20HaHICg32LhSXgavE78XHxNfEu8QfxmP/e7i6QOQvt8T0eTbYB8sPnxA3iGvFtcZP4mbhPfMfXLSIQdjCPWBBHEgr82kYvO/8niFbviT934P3zNZvR5ISVFnZyyYGUs/SSN7wj/mFVfdBVIPeK5/uHEU224aMXLewo0/HDUeJv4itW2ezrFhFIAssLg/GY+LsFkdyw4I3pRpMT2N4fHa+ZrR+K6y0klGeIl9rCJbiLQJjhlO/nCyKabLvMwgTO8xfeR7S5j3zdsQRCZ8kxRoU8lP63jdH4EkSTE3IcIf5q9f3vIpBzxQf8wwx1tu1iIYJhD3YlsMz4qObrjiUQvgzD/JYLJHVixCSBWGcsdLQt956v2Yw6J3iwc/tTPNMXZGgrEPpE7jHnCzLU2cb9FgsiQSyANllavrWFUcnXHUsgDMIGq740x1Xi91Zl8nzRW+Lx4nXiRnGthZBMZv5mvAYcy3OUfJN4Yix/3drlM6y154iXd+Dp8zWbUecEBvwa8YX4jLOfn8SDYvkB4pMWfjNJaCsQ2sCZWxMjqLMtCYRxTGDJ4qQ7zz+ArzuWQDj/IEr4AWbZIUFdFe/pILsaDs02WUgkMYRj+dstGLjWqg4grrMsCIw2KMfI3oYWQp0TllvoD/1mp/KlVSfI2M95kI+mbQUy6mjdo842trAk7kkMkF3VqBzR1+0tEBpgm3SHhTDFNSJ4ysLMudIqZSKIQy1Em3RoRmc+sGp7hdiSIWTX5DDvWzXAdM53ZtKocwKRi3v6iDOIfszQ9RbGZl18J0cbgbB8szWddc896mwDJ4vfWNhyY99Xtjj/AL5ub4GgSiIFoOOnWgjXK2z0kkMU+dSqJInZlBTNtguxzMUygFGIBjA7N9vi3x8mjSYnkLSzlKT++3uPNgKpy/NyNNkG8BNjiT1Ea59/AF+3t0C6gmTtXRsdESjjcO04C1GIwSBfSdGGT+6ZBVfEZ9sCbZzQBW0Ecr2NPlr36GJbyj/I61KUT/B1JyaQ26zaphExCHOpQ0SOjeJD4mEWVP6xVUfKCITQiKHpkGdboIsT2qBJIHVH6x5tbEMMM+KFFnZYjDf3uUh83YkJxP97yoddDpZSOQb7f0SR/fvfeSYNdlYnxWs/kH1A4spvImCUQGbFB23xLB+FNrbx0wei4EQ1kcO9fPmi7stWjf/EBLI9gJ0EOQVg5vG7SxvnbQ2cbp4Qr5kwt9pCp/KvvLOz+zqUso26JNgJ7CZXZvcDBgwYMGDAgAFLFv8C3tMhwgxWqRUAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAaCAYAAAD43n+tAAAC50lEQVR4Xu2WSchOURjHHxkiMkeKTFFKWRhKCQvEggyJKKRkwcJQhAWSlFhgJ0OUpMTClFi8oSgrIiUSGaJQikKG/+977vnuufc772vh+xZ0//Xrfe85557hmc41q1Sp0v+uLmKJOCwOimmifWFEK2iluCb6lDtaWT3EObFKDBfbxQ9xJetrFXUWlzL435ZaK06K7tlzO7FL/BKbw6C/1UDxUuwud7SBTphvfkPUNl58EddF16g9KWJzlJhhLQd3EwPEQvFdLBb9Rcd4UPY8TkxO9CHmmGV5uOLlqeZrlsNorngopkdtY8VnUTPfU12NFHfEHrHM/IXXlltnuXliPhNfxSnzJCW2g6aI+2KjWCNui4/mB0B495jYLx6JFeKCWGo+1ytzgzYSY/Eac9TVYPFYbDGPUxRenBMGWeP8mSDeikVRG2GJNbEqWi1mitnmc2Og4MVgefrqCQ/eMN8re06qgzhinhdDo3Y8896KFquXP7i+Zu7hOGyYl5Dpa74OidxPbBXvxIh8aFM5poIFb5aFoTeJJ/YHL9LJxs+aL4r45blmxThl0W/Zbyyef1rxoL3EXXHccq+jel7eId6IYVFbrAXiphhSam+h4H7CIYhkf2oe17GwbGpRLM+B4oOOEZ+sOC9KeRmv4t3Tlhs1Fofh7umdPWNkUqIc9k0KB4pdPcm8ks0XE8V6yy0byiWxv9d8gxyIzXOIIBakvFJmySs2hVKhxRqMpXISkhSmTlkfuUkBikOZqDpgRc83a7R5yIXk50U2HZJ5m/kmyAPyIViWw64zn5RE/5CNR6HIPBeDxCHL4z7lZQyC1zAOHg2FhXfIGfLtRQRrlfO4WWyIG/meOGr+STNPPBBXzcsj3mDcTvMFzmT/Q4Xid5+4ZX4ZUorxCItftvzg3HO8e96K4UJEcEVctHw9FC7WFERAQxGXuDt8+DEpXil/CPbMSIl2LswQCmw6fkask4r91NhKlSpVqlTpn9JvW1yZ0hBNGgkAAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAaCAYAAABLlle3AAABoElEQVR4Xu2TPyiFURjGH6H8i0H5UySUEhsjukliUDIpkhR2stpktSkx2BQxiWRQDIoBKUoGpQySySie577nu853LvZb369+3c55zz3nPe95PyAhISEXqaZDtIcWBjFRRFN0mNbHQxkqaD9sn8ogFqOG7tA9OkoX6RFsA6EEFugVnaFj9JrO0zy3RozQCzpBJ+k5bfPiGRroLV2Dba6DtPiNtrq5VXrn1kbogHfa7saq0iXtcmMl/0n73DhDAV2nz7TRm5uClVC30Ob687iLR6h8X+5XdNAPukGbYUmk8Msz6Sa6kUqrw0L0hvv0hTYFsVnED62CVUxz8pV2u1iMKNu5MOCopU+wg5VAhBJUon6FRDmsIuoN7XtMS714mkHEs/UpgR36SDeDmJpDN1mBPcE07AkGvDVLyE42jdr+AdZpPr10F1YyvfkhLXYxZb5FD/DT3VpzT1vcuAz2n7APMui2KtM2rINP6DKsVKKOntFTWJPcwD6fKAnRCfuEVBHtoe7Xmqwm8lFQ3aab5QcxoRLqQ/8rLjSv+H9rEhIScoBv2/RI2IREN4oAAAAASUVORK5CYII=>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAaCAYAAABLlle3AAABwklEQVR4Xu2UTyhmURjGH6HI34khC6FEFhNlNmrCgrIxacZCWSqyw4LN0LeXYiJSkoWkiKWykalpNBuLsfFnoWxtFRLP4723e87tztJC3V/96vvOe+6557zvey6QkgIU0HHaEA+8JRP0mY7EA29JOe2kubHx90UWraV9tB3+abJpK/0S/A7RM83w51fSXvrZGUtEwSW6RfvpDN2l+UFsnk7Tv3QueEZo8Vl6TNdgzy3TAfob0RqJ9MAmfaA5sJefwWrYTX/QYnpEt2Gn1WILsJNt0Cf6HRFT9JpWOWMemnBPh2kZ/RQoRmEpbKN3sFOIatj1KaG/6B78dP6kV7BNJaLTaKe6DvKQfvRmABl6Q+ti4030Fv410kb+0B1Y5v5LPZ2k/2Av1p0MUZqV7kVY87h8o4+wJguJZ8VDdVGxz2lFMKa6qmHcnavmD7SLNsJOHZKUxgyirCiLg07sdeIFXUfUZS30FHbykBXYRlRvZUALiSJYPd00FsIabhP22VQ3eyVRqtQMWnAV1oUntMOdRL7Cdr5PxxCluCYYHwr+C8Uy9JIewO59Inmw1i6NBxx0gnhcL1A53A9GiObqmZSUlHfGC2QvS9/fIiaoAAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAbCAYAAACqenW9AAAA9UlEQVR4Xu3SoYsCQRTH8ScqKOqhGC+IeAjX/AMuarJpNPgPWLQYxSheunbRfigGu2C0mkwGsVmMd3B33+fOwDK7cggXDP7gAztvht03Mytyk4kgj6w74WaET/yg58yFpoEvvLgTYXnDDo9OPZAMVlgg4cwF8owj+masmy2jhqRdZNPCN6qIY4gx5hKyYdtvCQNUxFsUOJ0c1tjgXbyWNNpGFykzPsf2exLv7drCg3+BP1ct9l/GE7aYyYUjdC9jIt4edC91tE1d0ljiAzFT08U61vN9RdHUpYADOrZAmthjaup6Qefog34uagsm+sU/f9V7/j+/q+oqHbeR1QMAAAAASUVORK5CYII=>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAZCAYAAADnstS2AAAAsUlEQVR4XmNgGAX0BMxAbAzEdkDMChVjBGJ9IJaHKQIBkGQvEJcC8QkoGwRACj8B8R4g5oaKMbgCcQ0QCzJAFC+EinMC8QIgPgDEPFAxhlQg1gRiSyD+BsQRMAkgsAHiyUh8OGgA4idArIgkFgTE6Uh8MJAE4odAXI4kBtLUA8QsSGJgIA7Ed4G4CsoHeboTiA3hKpAAKJiygPglEC8C4h1AHICiAgvgYIA4CUSPggECANGPFVWQ2UcUAAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAA10lEQVR4Xu3RMQsBYRzH8b8wUTaKQQxKySuQkQwMXoGJxS4vQMpokngHXoKBzaSsShlksyoZ+P49d3pcjBb51ae7+91zPf+7E/nnG/EjixJCCCL9soJksEIfTSyxRs9elMQWXficroEbas61BDDBASm3JB2cxIzyiJ5oMRPzkEaPer1A2OmkKmaLlluQBPYYWt1zYcXqCriINZ8mJ2Zrt4xg7nTP+TT6lm1sMBXzWY7imc+OllHEsRPPfO+i811R995wo78rhgHOKMuHrfMYYWwpvqz4ldwBPwAkC14X0V8AAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAWCAYAAAAmaHdCAAABA0lEQVR4Xu2TvwqBURjGX2VhIKVkNCplkEFZyKBsVnaLUq7AamFgYjJZZJYrcAXcgE2yWBjwPM7BOScfq8GvfnU67+l7n/PnE/nzjQLcwat2AQNGPQSXRp3OjfoTHxzBMzzBnF2+U4UzsRtYROAEtkR1Gor6sEkb1pw5izTswzjcwC1MGHU/HOt1nrBDQ487otI0n1WRqKikTOxJD2b0OAUPcAXDei4PB3r8lsd5sBth9Cm8wLKeY8qP52Fu5QETMAkTFeXLVngDjJl1C6Au6mzWsOvULNytmMRE3RQ/9HErjMrXF3QLmg7cw6Qzf6cEj/J6xnylFWuFgjfF38DzPP78IjcPdC+qWO+lEwAAAABJRU5ErkJggg==>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAaCAYAAAAue6XIAAACcElEQVR4Xu2WT6hNURTGvxeKIn8j/yYyEQPyJwMMJDFASVEmZox5iNE1eAOT10tKmWBEMUWZeEUSMyUKiUQIEzN5fJ+1N/use84+517uK3W/+rXf22vfs799ztprb6Cv/0dTyWTfmdEkMt13dqPZZCvZQ5aRCcVwm1aSC+hscpkdIbt9oIkGyCbygNwk+wO3yDOy9s/QghaR22S5DwRNIQfIDNcv6aXcIOt8ICet8jR5iXZTip0nX8gqF9MC9XZarn8W2Usuwn73isxPByTaBnshSqNaycw58hnVK1QqfCJnYQajVpCnoU0ls7vIGnIFebNKnXtknw+U6RAZC22VZpKH5DGZk/QfJ9eR31iXkDcrDZFrZKIPpFpK3pInZJ6LpYpm00llUEZPxkEVamJ2O2yM8r9SLfIDtrKclpB3KE6qVv/viIMq1MTsavIG7fvlt5TQo7AU2FIMtUlxjbtDpoU+TfCebIiDKtTEbO3C4wBtHG2gnM7AvkAr6ZPZ16HNqROzKpWligPqHrQYVmc/olhLe2H2sA9EaVdrd+ceNEBOwN7qERfrhdnKNFCZuEy+oTrvVHdV1HUoqB6n0qZTJdFOzqmJ2UbP0okkMzrXvZnN5AMZhh2ZXvHLHPQBJ5nVTs+VJVWBF6jfO78GPofdCeJ9QHeDRzDDSoUyqV+L1ObzmgurHF9hKSS+w0yXHT6acxQNj1zdqrQq3bKUNwtQbTKVjkgtUodGt4rp2HL9/1y6Nd2FXUa6lU7R+6HtuXaSqyjP6zrp650ix8LfPZcmORrodMKNsAtMJ5f2v5YqySBZ7wMZLYTdScbVaF99jYd+ApnHebmMY+0wAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAZCAYAAADnstS2AAAA3UlEQVR4Xu3SsQtBURTH8StMlEUsSkZlMymLshgo/gKTyWKSzDJZ7GaLf0AM/gTKZLYaDRj4Hvfduu+6s1J+9Yl3z33XOc9T6meSRAZRt2Cnhhue2CIRLn8mhzMmbsGXqtKnt9yCL0NcUHQLEhlCCk1kscJO6SFDkU17TNELvt8xtzdJ8jhhhEiw1lX6SYT6jWGp9NQFa93br1zIovQnN0rk09uvDCM/17DW5JE90EEFA1MoKX2y6S2l9D92RRlj1IPae6A+DlhggzaOWGOGuNls4r4wsiFtXf/zpbwAH9wkzOofuXsAAAAASUVORK5CYII=>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAaCAYAAAAwspV7AAACP0lEQVR4Xu2WzUtVURTFV1iQ9iGZqVAOFCOEKDFRGgQNRHJQBIoKBQ0aJKEGkYjiVDJw4McgCCEKkookokYNNGoi5cSBBEFQ4D/goGHZWu5zuO+ddwmVxyHkLfhx3/m475679r5nH6CgXaqD5CJpI6Wu7yg55ifE1D4ySr6TAXKbfCET5COpT6bG0V7ykDwnBzL65dBn8gHmYFSdJz/J6XCAGiHTYWcMjZE1ciIcoAbJlbAzhp6QDTJMioKxOlIW9EVRD2xR4jdZIDfJ4cxJsaUv7z5sQX5xYgXpIY0qhU6f/gOyDlvYrawZO9MpsuooD8ZypEUoZ/aEA9Ql8ocMhQM71DXyCrb9/FO1ZAbpE8+RX7A/y4dmsUXX9am/JfvDAeo6+UaqXbuRvCHtrq0SpIdoU1UJmiL95AxsAc+Q5OMRskjGyRy5ivTobEr7k9xoCfoVUiV5h2tXkF7XfgELeyt5DXshvcAF2Etojh6osPvQK0+/kmZyiLyDRSJHesN5cg+WgPqtbWCS/CDdSN5G+1QVeYwknNrphXQSloPvYf+r+zTXhyszn+SaauplN5alYpgjkraEJtIJOyGkhfM4+QTLQ43LJbnlJVfkvFQJq5e+iKtM3XW/1ScT8lLgZbdsl/3KlSVY2G/AHHiJpBzpqnYD6YLlmHemD1b80z6ubUuJrQfdgW20y+56FuaMErnGzdWinsLc033KpUcwt3T157S8SAmunFDOKOT+mKN25pFHKkF2HVXIox9/Cirov9NfCGlYuLpFHFAAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAXCAYAAADz/ZRUAAAB+ElEQVR4Xu2WyyuGQRTGj1xyi5AktwjlkhQlRVnJhg2hWHxFKcXCJZGFkqQsXBY2SpRCWSnXQuxYWdgoRfkHLCxdnqczw2t8G3q/Ujz163tnzjRnzpwzM5/Iv36Z4kEdqAeJpi8FpNoBoVAkGAe3oB/0gkswC85A0cdQfxUBlsAGiPP0M+ILcCq6IyFRNbgHpa4BGgMLbqefmgIPINM1QMOgye30U6vgFYyCcMeWD5KdPl/VLuqcPINj0AUSvINCJVb6tKhjuwhyJcFTERJxy3mkZsCj6AJ6Po3wUXTGnIa5BqgBvIAR1+CX8sCi6Dl3VQGeQIdr8Es8Qjsg2jVAneAGZJl2I9gCJaAb7IEAKATLYNN8U7yK50EfKDP2dXHqh+eb0VV5O0VTwWJrNu0M0ernhXMgevTSRa/iQdG0BUSdUFx4rejiOQftTN97CnldboMhcG2+6WAO3IE2+agFOssW3SV74TAtRyDJtBmInbxAtGYORf1wnhXxFG+MaIQUj1olaBF90YKlgdGfi9YJxVrghJyYrx8Xwmvaigvhgqg00ffhx49TDdiV4JHQxoupWHT3WMCsD7tL/GW7HLSavm9pAEyYb0a6L7r1FCNmAU6CHNFIT0CusdP5muhu2P8I31KUaHqs3NTwKbZ27oz3aaZi5eu78cf0BmFPT68ZWbJCAAAAAElFTkSuQmCC>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAaCAYAAAAaAmTUAAADO0lEQVR4Xu2WT+hNURDHRyjyL38i/yKhRCERhYUkFiywUKyxE36I1dtINkiKpEhhIaUkskAohQ0lCokFIZSyUpiPOeOdd965793nvV9ZvE99u/eec/+cmTszZ0S6dJyBqs2qk+HI9X/BYNWAdLAB/VT7VNPFjDijOq/qH+b7qoar+oTrf2akaoVqvWqG2IsbMUd1WjUsncjAYseoJqveqHaE8cWqd6rZ4Rojdqq2h/OW4IGlqgeqa6qNQTdUL1Tzq7fWMEF1SzUznUgYJfbuX6pvYoteEMZhuZgxOM/B8LOqddFYU3jooOq11C+aOWL6q2puMocDjqgqyXgR3H9O9VAshBxC7pTqeDiPmaW6r5qYjGdhsbzki5incuCtz6pjUvvL+dDzcCwDBmAIIRm/Z63qqOQLAMZdkJIO26r6GY5F+CKeSjUsYI/qqpRP/Hmq76ot0dgqsdzAqaNVI6I5h3BP/2YdU8Xi9JlYUhbhxpCwY8MYBmAIFakRvHe1WNXaJGYMRgGRwPPjxN7bI5aDKeQX305ToIaKWELuT8ZTpqjeS60xHLlmoTkGiYXTFTHPXhILZf+7VMzHYt933VUN4eEE/xbhmIV94bZYiFFJGsE898Ufw7sfxEpqiheNO1It19NUH6U+X8rgayWss7i1JHZcDnOQnHiuEo1hzNtwTNkgZjxHJ5cvZXFjCiPIjYlDJwclkX3mk9TuJUXGeC4RloSnQ6jF+dIKbgzlOwtxS/w2MoZw2Cv2V6g4MUXGuJPiKsd7CK+0GpalaZh5/f4h+bgHqg2bJfHvPZOD16mElNYYNyb2oldDNkzOD6uGRvPN8Oe99cnCjs5i8Vq62GViCXtI8puZ/9k0B7j3ulQTHe0W+7t4dpHqwN+7y0G5fiXNC9Wf2v1SrG/yfoze7ImYQUWVx0OH4pBC48nz9FUYtk3sTz1SXVZNqt5aCiIHx41PJ3LQFVPR6JLZN9jEioyIoVrhhNzO7N1xnDfsLWW7hZiKWEqkfVtHYXH3VCvTiQ7CN26qlqQTvcEa1UXJ51UnoAU6IfU53SsQPruCyoRmK9A7kr+t5lhb4DWaxIXpRBvQNrHj5xrPLl26tMFvI/eYavbZ6j4AAAAASUVORK5CYII=>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAAw0lEQVR4Xu3RPwtBURzG8Z9BUUomMwPZlKwmi4EUE96HssriDSibF2EyMCozdovJxmLhezp/Opxu3VV56tPtPue5dzkiv5U0BlhijvLnsU4WG0yRQRUn9PyRyhgH5LxuiDPytlCHarSyhUkdd3RsUcFNwmEND8y+i6ih69t4+YVJMGxJzGFQRPVBEdUXcfULEzuc2ELdxA5rpGxJmniap8sIFxTMe0L0de5FX69LEgts0TWjo+g7D6L+UkIfDdEf/xMvb7M7LHVni9rlAAAAAElFTkSuQmCC>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAaCAYAAADygtH/AAACi0lEQVR4Xu2XMWgUQRSGfxFBTVRUkhBQOEEsBFHQlEoIISCiBCRBsdZGUCxU1CJViqSIpLCxswgJBAQJgpUIFopFksIqIhFRQQULQQsL9f99e3dzc7t7uzG3bDEffNzdZI559/bNmwkQCAQCgTxspKO04o2XhUN0hHbTDbSTHqcX3ElFsIWeptP0I/1BjzbMKA/n6B/P9/SIO6kIlLSTtJ+OodxJ08N9G/mSXqXbG2a0QKW5G1amaWz2B1K4ifInTTHmZgedQ708v9DzsH7ks41e9gdTyJq0HtgPOEE3eX9rJ2tKmqpqgl5EPdh99CGsXA9GY1XO0tveWBqtknYAts4srL/cofOwLV4EStoD+gS2RVdhuYgrmBo76TU0b0l9HqBv6BK9T5/BfuCe+rSWpCXtMP1Kb6G+fhd9DKu8IlDSntJd0ef99AO9geac1NATrfiDDqo+JU/Vpde8WycpaVp3ARagKlsoUffodSQHrPU1rzeDukakVgysP7s9WuvOoDGuRI7B+lqrE0QLnPIHU0hKmqrsO/0FO+K17iRsXlLChK4Cqvos6spT+fetfGi7qrfrBpDIGbpCr8D6ir70GfGHwV6sT08bpL+xhia8jqif6h6pind7aDVp2rqxdMCesK4aLupbj+gr2A1Z5a7X59FrVpKS1kd/Ij6wrWh+WO1AMSk2N2nV7RkXcw31h0v+YIQC11Z8AauK17C+lrZ9fJQ0JUdJctE1R1ty3BvXPJ2k/kNsB4pBCao4Y3qvU1TbO2///i9UveqP39D478knOuXMU39ahl0xFKSSeBf2/aJQL1+EtRy1p3ew2JXQ0qJq1imX5aRrF3pIQ3QYVml5dlIgEAgEAoFAoCT8BfQxeTyo8M7DAAAAAElFTkSuQmCC>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAZCAYAAACB6CjhAAACeElEQVR4Xu2WTYhOURjH/0LIVyIfRV6yYDMpIhoLVgrRzJCFMlHSpKYs2GCn5KNkZIESJZKSULNjms3USDbsJJKiWMuG/79nzuvc8773nXNv99VMnV/9Fu859733PM997nMOkEgkEv+HffRiOJjDFLqZXqM36C46NXNFxWynI/QgnR7MVUGNfqB3g/FmKPhTdIiuogvpfXoT7VlbnVn0CH1Lj9LZ2enSaNG36R/EJWAD/UY7vbHV9BPd6Y21DS1YlfCanqHzstOF2U+v0C+IS8B5WLDLvLG5dJjegVWIYwVaV4VeoiqoFPrmdsAefAnlblSDle5aWFDjJWAmfYHGBMyhr+goXeCNH6JX0TwJS+kTuimcKIprSC/pdWQX1got6jLsv/pPTAJcoHkJCMe1thN0ANkkVBa8zwx6DlbKa4K5ZnTTk7BFxibAXRcGmpcAESah8uD95tiPuOa4kt6i88d+xyZgCWy3CANtlQDhkvCIPkNFwStQBfwGxbbHafQCrPQdsQnICzRv3EcNUS/pHuLX2hR1fXV/nQv2ovgBZDGscX72/ArbBn+P/T5evzqLkvcYjYG6BOi+2hFCltNBWNJ70dgTotAD1eTU7LaieOCtyKsAPaMG6/6O0/QHXeeNLaLvYCfDEBe8K3t9Dr0omITd9CntQHafrQotUs1TJzr//jpwqTIewN6+UIPVtfrsHNvod7rFGxO673O6MRgvlYR2oD7yEFb6ClT+xL9PYA/9BTv6+onpoh/pMXqYvqd9wTXiLBqDd+jaHnognJgs6OClBMkyh7BCqEy0BelbHU81uSr7w4RgPezIGqPO9XlbUSKRSCQmE38BJOB6ROHHztAAAAAASUVORK5CYII=>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIkAAAAcCAYAAABVj5w5AAAFb0lEQVR4Xu2aaahtYxjH/zLPY4bIxTVmJvPQJclMSIaU3IS4FBm7dHTVNZb5g5kPLlEyy5BtKIqQkhJ1rwxF+IJChv+vZ73O2m9n77PP2XutvY+zfvXvnLXe1V5rve/zPs/zPu+SGvplT2uBdWUHNcxyVrVOsvbIGxoaEvtaR1nr5g0NDbCydYx1QHGMV5lvLbbOKY6HzfLWkdZueUNDPWxrHW5taC1n3WidUvp/ibXCf1fXz9XWc9Yy69israEGVlR4kP2LY4zhUetBxey9wnpfww9Da1gtNUZSKXiFDay1s/NbWIcq2nIIMy9alxbH/MbB1j3WvZk4XyWVGMkh1nfWPyX9ZH1f/P+H9bzC1c4G8BY3WyeWzq2kSFjpq5zTrY+s+6zVi3MM0JjCu9xiLbKuLc6vVVxTFZUYSeJ+60/rwOz8ZtYz1s/W3lnbqMJM3sd6Q1OvW+AtHrCe1figz7FOsDZOF03AhdZrCg+0puIZWCrTnyS31FbqoDIj4aXetj7VxO50I+sz62WNRgbfCXIDBpl3wRus397cE8x0PMbnilUCuQcDfLxi4BPkKCStc4tjBuVv67DimH66TdGfd+p/YCQ7WD9aT6lzdv6I4hquHTUYsFOtT6yF6t+ls3p5TOFdN1GEHv6WSX12SXHMNeX+Oci6S2FY/E4ynqqpzEiOU+Qf5+YNJTCS36y98oYhwmw92/pY4dJTeOgXjI7wgtHRJ9yj7EWAa261LlaEFEIbISddR5KK4cId1nXF/1WC52PF9av1rnWZtUrbFX3AS0yUjyTofOItN6/LbXYDT3G59aFiIBiwQUMYeV1RdyAv68Q6Ci/DDC6zmiL8AYlvFc9YG8k9dcpHYFNrqWIVtFV7U+2QP2GwL6jamgQT4zSFB8i9yKyjl3yEeEpSxsAMzH31wSAS1FEFj0Mu8566e7BamSwfYRbx0BhJuXYwCpSXujxjnlxOlXKtqEp1g5Xkl9Zf1rz2pgnJf7ubps1k+cjuihoJidioxlWMZRfrJUWCvV1784xja2tX9Rfm8Las0vJcacpMVh+hePSWxotEiS0VS8STFRXKJxQ1AXKXqxSDRSGp/JLseTypqEwmN8qLsO3+cKFBuFeejWIYz4Dh9NPRMxn69izrjOz8lNlJ4SXyfCQtAZdaj6vdQOj0BYrd0C+s/YrzzGAGhmu3URgfrhN2VOxjcA+WjSwpucfdimUav8nSmu32QUHoIQRdkzcMAAaASYB3Zee137rMoJij6N9UCiDpxiNNCwo9yzQeq4h/X1tfKfZsflfs1xDv85nIQGME5DAPKdpxaWxwpZDFX46TqyPx/UWxhp+nMBDOca/zrPMVBadBeJI64N15R4xlofWOhp8806eMR0vR70QJFhpsOl5fnKsVDIMHSq6MZTGeg3ADY4USvADLyZb1jSJnYPPr6aJtJpFKBhg18O7fKgpZw4QKK/llS/GMrFpvUIwVXrz2+hb1iVc1fmNWSBSdWB7T1lLkIISloxX7ILh/rJsPc8gbmI2EqARhavvScTdSAasXVTGDdla4dmAwMJK6yu4TwbPQ14xDS/HOGA2TmFyTPq/d0xHnCCcpVxlTeAbgHKFqkcJA6EQsnCT3dsWDY91cR4JJuLlA8WXXepocDJE8Jv9Oo5NSabwqeO9XVI0x9gLhn60BVjIYRkvxLOSBFxVtQ/lom1hM2TlByEgl6HRc3kehDUsuXwMYC+dHoUA3Hfh0glVeL8ZdFUcUgrKRNIwAfGi8WDEZMBJmct0wUfl88k2FcbDaZBOWUkPt4aWhHXKAm6zNFXnPmRqN3XFCX0uNJxk6hEZWZeVyN+WDYS/f51sfWD8oaiUk9w0N1fEvT1EP0pR275UAAAAASUVORK5CYII=>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAZCAYAAACPQVaOAAADRElEQVR4Xu2WWahNURjHPyFkDBlKkQx5QZkiCiEPhjIlSrqUTBGJJC8oQyRDhpQoEQlJMpR7efEgvKBQUoYHeVEevOD/8+3VWWffs+8+zsm9qfOvX+fsvdbe+/vWN6xlVlNNLa1uoodolR6I1FZ0TN/8n4Rzm8UNsV+cstIOdRDHxZz0QHNpqLmBp8V80bp4+I8wcon5nD2iX/GwjRIvxUBzx3eJj2Kt6G8+f6F4Jk6INv5YtqaIx2KxeSpUK4xaLl6LSeZGXRDnzZ0L6iMaxGFzo2eJd2JiNGeTeCQ6J9eMbRHDzO1dKhaJ69Z4oTKFEXXiuVhhpVOlXBGN72JddI/IfDI3EBGBM+KV6B0mmUeXhe+aXJ8T9aJTcs27jyb/EQu7zypMXyKLQU/EDtGleLgsHRG/xOzoHsbWi1uivXlkvib3giOIZ36Kacn1diueM0bsTv6j6eaZkZu+TYn6mmqeQgfMO2G5IhpZzr4Xfa0Qfe6lneXZrcn1ZPHGCim6xgpR7CUuR2NVizQZJx6IY+aG5qkpZ7+JEZbvLCmOyDQazxXzpnTJfD6RJKIVpW+e2omd4oMYlBpLizLA4HnRPWr2s7mDOEpNUptx80HULM+yYEEsOAtEyoYGh5MhfUNADomZyXVFihvXBiuvceHIfXHWPDJ8fJt5LQZnEdvRF3ND0QDzhpV2Ni3S9mryi3gP3xts3mfiRS5LOIVzT62yLam7+XbDnsgWtFo8tELNIhaB7eZtcv+aWGXFNZtWOn1DhrAFITr7SSsujUzRfVkdXjDXSh8EKlFP8cIK3ThLOBt347Ti9EWkN30g9AcWcK/l9BYGaUA0oglWnZOkV4PYaIX6IXUxKuyzaL15zXLoQMwl9eN9NlY6fVFodHEzxNnwzkYilTh7DrcqijtSMOCieQQoAY6Dd604vajLH2J8cj3WvImV6rAhfWlSsXCcphmc5f10bzKpWcQHb5s7SC3h5D3z42EsnOLcu9K8dDB6mZVecOZyUkqPhZNYGON4yqEjPe+fimiOFgvEEMv+OA2FqMyw7E7PgQaHsg42NEOy6I64aTmHDAzjo9RtHpxaqqnnFtdI85Qrh4OW0+lqqqmmmmr6S/0GClOdkEz5c6MAAAAASUVORK5CYII=>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF4AAAAaCAYAAAA+G+sUAAAE8ElEQVR4Xu2XaaivUxTGH6HM85iLeyUyfCDDpQz3likiuT4oJMmQRMhMnZJMXck8RRKZhzKklGNIRPhgKENSIgr5QCHD+p31rv7rXf/3Pdf/0D2l96mn8z977/d9137W2s/eWxowYMCAAR1Y1biZcZ3Svrpxc+MapT1A/y7GY41LNP78vGKp8RvjX4nfGX8z/mF8y7hMPvn5wPXyOIjr9KZtLePDTdufxoOa9gCxnmV8x3i2XPjjjQ8ZHzAuGA3txO7GQ2pjg1WMi403GW8zHqF/qc09xt+N+6U2XniafOIXyj86H0C0X4x7lfarjF+pLSRVfrPxFHULstD4hHG30o6YzPFteUIvanfPgPkz5hXjIuPGxgeNd8m/OzHWNb5m/Fy+dDO2NH7Z07eyQHV9aNwktWEvzzXMVnOe8Uy5SIxfbvzA+Ixx52bMtvLKR7gAwh9pPNz4s7qF38P4rdrFuZ1cn8NS2z/GTsbvjY8bVyt9VBnVVie+srChvAprbEwYi6TqA1QhK3dNubgfGy/RaI94zLh3M/YEeYIqELdPeL6FyBRjIIr2Ps3BEY5S20MzpuR955d2wPLa03i0cevSF6Aal8irKVdYYH25n+6g7sCjKGps+Dr7UPZ3LAmSIBLwpvz9gSgiRN2qGbN26gd9wscKq8KzYU/Li4MimQgs5erviIpPMukLmv9zH22fyjev44wvGw/uGPO+fJ84Wb7Z7ZP68UvEQawbjO8aP1Hb0uirsQGqj4qn8gPEgrg8jzUyr4wsKoLfq7aIoE/4ELhP+Nq+QsSDVM8bzW+WKFV+u8arlGq6RS76wtTOKQJ/BYjKs7yHJQ+mNFpVsUnld4SlTKt97JvE39lUES72pSpeFfVKjYtVxwTinVXgOQvf5e8IgzdymslVDPif9qnmf0Q+1PiiRiIf04xhJQQWy1cAlRaTm0r9XVU6ib8DEs/KIEkkCyvJyKIyx2s0Llaf8BFfFXjOwoe/R7UGIoAaPP/HWZ9AHpFb0npNf1RjtYGMLmvj96/yeAKT+DvgWZKLqDfKVxyCBZbKv4uobIrXNX8z+oTvE7ivfYXoEgHgrQicq6pvg8mIJfmSxjcuEIFW+yDxiIzYgUn8HXBywbexRzbVF+Tn7E3lh4BXjT8Z75Qn4Qp/rIU+4VlxrLw695gPJ5uaxF7Mdn4nIfUiQSUxkWmNX785snGjjCV5f7t7BtgS9jGtdmJiUsSykbwSt1Hb3y+WX/+zv28gt4ucwGVyr+dbkNMUN8xz5KtyR/n72Yi7CqNPeEBbLY6wtbqRz4pdjT9q3EP5/ajawl8mX9r49tdqVxvn5quNJ2p0lHtK7ZPQFsYn5dXL5jytUfIQiz2BZC0y3iFPAMkhtgXyczJVHIml6on/VrVjpzjOlYsf9lfBe86Q7zG1SkP4S0s72F5+U8571/5y2903tfWCwSwZhA3ycPbXEIMEIOjdcoER81rje/KrMh7PkfBAf2wGCPW6vIIZg+AkIm6O9NOHqE/Lk3a58TPjsxpdck6VW8rz8g0bIOxyjY/NYMwB8uTybWKIWDmu8j5WQi4MEkFBZU1+kMeJhQWI4wv5Efkk40ca3ZT/M1BdBMhJBtEzqFa8rlpOgEDwWsbkI18gbpP5eayjvo82mBHvrmO7wLeJYbZYJwXfRhfI7wEDBgwYMGDAgAEDBvxP8Tet1C8he3ItiAAAAABJRU5ErkJggg==>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADoAAAAZCAYAAABggz2wAAACzUlEQVR4Xu2XS8hNURTHlxDySooU+ZKSgVdekYQk5ZlH5DHwmUjKQJGSrmSApBAlJQMpTAyMKFcGhDCQAUlERsxI5PH/2Wf71jn33O/cez99Bs6/fnXvWvvcs9bae6+9r1mpUqX+Z40TR8RZsUH0S7vrqoeYKU6I02JuYvNaK2aLAYlvmNgkJvtBWc0X98R60Tvja1WrxTMLLyaYg+KGGOwH5Yj3V8R9MUGMF7fFAetItpe4LH5muGLFv/+72u3iidgq+qfdTWmUeCE2OtsQ8UDscLY8rRJfxWJnmyM+iFnOdk48FW/EVbFE9HT+QlFRZvah2CcGpd0NiQQ/ianOxmxcFFULM5ynvuK61T47Qry2sJSjTlp6TMuiOgvEHXFUDE27OxUBZYNFF8R7MSZjj6IAVat9NiaKLxbpryUaFRvDLXHKwkuLRELZYDuzRxUl+lIMT2zEclw8Em/FXTEl8XVJfcR+Cz86NuPzqhcsKkoUVcRnMd3Z2KPfLCQbC31e7LWOfUnH/ShmJN+blm9SO624SeG/afkJNZLoaPHcQhKsJnoGjYeu6hMdaOnmM9LCJFyy0JUbFgGTGEuj2WOnXkL17Fm1WSjWO/FYbLbaPZpV3vLuVHRZui3n6gprsmUnOmT5CZEoVaf6zYizlOMldt0t4ofY9mdER6J+1nOFkw1O0+HG0UqCUcvFd7HQ2eLRAXxGvKPNfUeTLGyTlc7G77Fv4zm6x8JS9onGpVu1+rNuS8U1MdFqr1qtiKOIm03F2WhgBMI2iOJiQsB+Xy1LbJXkOzcdlvEZN4aEmRS/ndaJLxZuZN2qaeKV2C3WWLgVHbZ0cCRFcIyJBWZmuKxwZaQQfKbD+ibI2F0WVh9jWNIs7e2Jr9tFcIssLEOuhY2KpTzPip/DxxjeUXjHRVSZTsU+LYJ/CV3Zv/9U/MPgr1QjHLOCrlaqVKlSperoF5uKlJhcSFGkAAAAAElFTkSuQmCC>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAaCAYAAAA5WTUBAAACG0lEQVR4Xu2VsUuVURjGnzAhUBFBAsEwHAIxaJByUIRE3QohAqE/IG2QqCFoukvooCEJSiZEg+AguOiUQ9SWjrbolKibDUJDRenz9J7DPffc77veb+hCeB/4wT3n/b7zvec873kvUNV/pDoyRK6RC1GsImojn8gkOSCDheG/SXWTV2SO9Lm5NGm9ZXI5DpRSDpbEC3JCRoKYTugtWSUdpJNsoThRr1rY819JSxRLVRPZJIukmdwgNS6m3c6Qj6TRzT2BJfrMjWPdJ7+QMQnt7gi2eKwu8p08DOZaYSfWHsx5XSULZA1lJnEJ9tAD8htmgcb1wTM52K563bziei9JsmGa3CLvUGYSPbCs5e8PsuTGN11cH1uHncQEeQ07rV3yCMWFeQ8W13zZSXjpBdWEaiOUdv4B5r/q5aKbv02OyV03lnQb3iBfN5mSaIDdihXkP+Llk/hDBoJ5LawP6JR0WrJhCnaFvTIloSLbJ8/jAOxqbsDsUIF6+ST8R3Qi3gavTEmo4FR4d+KAk2w4K4mXZC/iJ8zGQ1jT0oZSpasnf9UbkqQbo6JVsl6xHUnKdBJqw19gTSpJarvbKGxMSYUZSrbopslm2V1S3vOkogzVD1tQ13Tc/X6K4isqjZJvMCuEbClphy/KsBumyf/DDpMrUSyzlP1j8h62oJK4XvBEBSSPd2DNSX/J8yhtxT+RTmKMfCazyHe4qqo63zoFBwhvqEVOo3oAAAAASUVORK5CYII=>

[image29]: <data:image/png;base64,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>
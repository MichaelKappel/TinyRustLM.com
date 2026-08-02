# Deterministic Rust WASM And Browser Inference Runtime

## Current snapshot and scope

**Research timestamp:** 2026-07-12 UTC. The current public standards picture is materially different from mid-2025. Rust stable is now **1.97.0** as of 2026-07-09. WebAssembly’s public standards surface has advanced to **Wasm 3.0** on the WebAssembly site, while the W3C’s Core, JS Interface, and Web API documents are all current **Candidate Recommendation Drafts** dated 2026-05-27. WebGPU remains a **W3C Candidate Recommendation Draft** dated 2026-06-23. Chrome desktop stable is currently **150**; Firefox stable is **152** with a 152.0.5 point release on 2026-07-07; Safari publicly versioned **26** introduced WebGPU in Safari 26. These changes matter because a browser runtime designed around 2024 assumptions would now understate both the opportunity and the compatibility risk surface. citeturn42search0turn37search4turn37search8turn13search1turn9search0turn10search15turn10search8turn21search2

The public black-box evidence suggests that **TinyRustLM** is already aiming at browser-local inference with explicit runtime surfaces for **WASM, GPU, and memory diagnostics**, local `.slm` import, consented local endpoints, and model choices including **SmolLM2 360M Instruct q4_0** and **SmolLM2 135M Instruct q8_0**. The site also states that prompts run privately in the browser and that private models use local files or P2P, not a hosted inference path. **MiniModel.org** positions itself as a checksum-bound metadata and transfer layer rather than a hosting or inference service, with manifests, chunk hashes, Merkle roots, signed catalog snapshots, receipt ledgers, and browser handoff into TinyRustLM. The **UAIX Cognitive Liberty Charter Draft** is relevant here only as behavioral context: it emphasizes adult agency, no covert persona rewrites, and transparent limits, which aligns with a runtime that must surface exact validation failures instead of silently “fixing” artifacts. citeturn40view0turn40view1turn40view2turn41view0turn38search1turn38search3turn38search17

The architecture recommendation in this report is therefore not a generic ML runtime. It is a **deterministic, offline-first, converter-gated runtime** with a conservative operator set, strict manifest validation, bounded-memory execution, a CPU/Wasm reference path that always exists, and a WebGPU path that is **optional acceleration**, not the definition of correctness. That conclusion follows from current platform reality: WebGPU is real but still uneven; Wasm is broadly available and standardized; Memory64 exists on paper and in some engines but is still too inconsistent to be the primary deploy target for consumer browsers; and browser storage/network primitives are strong enough to support chunked, verified local loading without pretending the web has true `mmap`. citeturn13search1turn13search2turn37search2turn7search0turn7search2turn7search3turn20search0turn26search0turn26search4

## Recommended runtime architecture and operator support

The best current architecture is a **three-path runtime** sharing one semantic graph and one deterministic validator:

1. A **scalar native/Wasm reference path** used for correctness, parity, and fallback.
2. A **portable SIMD CPU path** for native builds and, where practical, stable target-feature intrinsics on native platforms.
3. A **Wasm SIMD128 path** for browser CPU acceleration, with optional **threaded workers + shared memory** only when cross-origin isolation is present.
4. A **WebGPU compute path** as a separately validated accelerator backend, never the sole supported backend. citeturn35search9turn35search11turn35search0turn36search1turn24search1turn24search9turn13search4

A deterministic runtime should implement a **converter-owned canonical IR** rather than executing arbitrary model formats directly. The converter must lower supported checkpoints into a runtime format that contains: exact tensor names and dtypes, architecture family, tokenizer payload and checksum, RoPE and attention metadata, quant block schema, stop-token metadata, optional adapter records, and manifest-level hashes for every weight chunk. Unknown tensors, duplicate tensor names, unsupported tensor dtypes, unsupported quant block formats, unsupported architecture flags, NaN/Inf parameter payloads, and any mismatch between model metadata and actual tensor shapes must fail **before allocation**. This recommendation is strengthened by real-world evidence that malformed tensor dimensions in quantized runtimes can crash or abort if block-size invariants are violated; defensive validation must happen up front rather than inside low-level kernels. citeturn41view0turn28search12turn28search14

The operator support matrix below is the practical line between what should be supported now and what the converter should refuse until explicit operator support exists.

| Architecture or feature | Runtime posture | Why |
|---|---|---|
| Conventional decoder-only Transformer with dense MLP, RMSNorm/LayerNorm, RoPE, causal attention, tied or untied embeddings | **Support now** | This is the mainstream path and matches the public SmolLM2/Llama-style configs already visible in TinyRustLM and Hugging Face configs. citeturn18view0turn19view0turn14search11 |
| MQA | **Support now** | MQA reduces KV-cache width by using a single KV head, improving decoder inference efficiency. citeturn30search0turn30search3 |
| GQA | **Support now** | GQA trades between MHA quality and MQA speed; it is common in compact modern decoders and directly changes KV layout formulas. citeturn30search0turn31search0turn18view0turn19view0 |
| Sliding-window attention | **Support now, but as an explicit operator mode** | SWA changes cache-retention semantics and context-overflow behavior; Mistral uses it to reduce inference cost. citeturn31search0turn31search4 |
| Partial RoPE / NoPE mixes | **Refuse until explicit support** | Partial-RoPE removes RoPE from only part of the head dimensions; that must be represented exactly in per-head metadata, not guessed from a generic RoPE flag. citeturn31search1turn31search5 |
| Q/K normalization | **Refuse until explicit support** | QK normalization alters attention-logit construction, so silently treating it as ordinary dot-product attention breaks parity. citeturn31search2 |
| Gated output blocks or nonstandard post-attention gates | **Refuse until explicit support** | Gating can move outside standard SwiGLU/GEGLU FFN assumptions; converter must not lower to “plain Transformer” unless the exact gate equations are implemented. |
| MoE with top-1 or top-2 routing and fixed router semantics | **Defer unless full router + expert semantics are implemented** | Sparse MoE changes active-parameter selection at inference time and can require router numerics, capacity rules, and expert storage/layout not present in a dense runtime. Mixtral, Switch, and classic sparsely gated MoE all make routing part of model semantics. citeturn34search1turn34search0turn34search9 |
| Mamba / selective SSM | **Refuse until separate recurrent-state backend exists** | Mamba is not “attention with smaller cache”; it uses selective state-space recurrence and a different execution/update model. citeturn30search2turn30search14 |
| DeltaNet / Gated DeltaNet / linear-attention recurrent forms | **Refuse until separate recurrent-state backend exists** | These models replace unbounded KV with fixed-size recurrent state and different update equations; they require a different state layout, reset policy, and long-context test suite. citeturn33search2turn33search8turn31search3 |
| Kernelized linear attention | **Refuse until explicit feature-map and recurrent-state operators exist** | Linear attention is semantically a different recurrence, not merely an optimization pass on softmax attention. citeturn33search0turn33search6 |
| Multimodal checkpoints with vision tower + projector | **Refuse in text runtime; support only in a separate multimodal runtime tier** | Vision-language models require image preprocessing, vision encoder execution, projector ops, and multimodal token plumbing. citeturn32search6turn32search1turn32search4 |
| LoRA adapters on supported dense base models | **Support after base-version pinning and shape validation** | LoRA is additive low-rank adaptation over base weights and can be merged or applied on the fly if exact target tensors and ranks match. citeturn32search2turn32search23 |
| Other adapter families with custom routing, prompt-tuning side tensors, or multimodal attachment points | **Refuse until named support exists** | Adapter semantics vary enough that “adapter present” is not a sufficient compatibility claim. citeturn32search8turn32search11 |

The most important design principle is this: **the converter is the compatibility firewall**. A runtime that claims determinism cannot be permissive toward “probably equivalent” architectures. If a checkpoint depends on partial-RoPE, QK norm, MoE routers, SSM recurrence, custom gating, MLA-like latent attention, or multimodal projector paths, the converter must emit a **typed refusal** explaining the missing operator family rather than coercing the graph into a lossy dense-decoder approximation. That is especially important because public small-model ecosystems are already mixing Llama-style dense models, sparse MoE, multimodal variants, and recurrent or hybrid long-context designs. citeturn31search5turn34search1turn30search2turn33search8turn32search21

## Runtime lifecycle and state machine

The normative lifecycle should be:

**Created → Parsed → Authenticated → Validated → Planned → Allocated → Loaded → Prefilled → Stepping → Generating → Cancelled or Reset → Unloaded → Destroyed**

with **Diagnosing** as an overlay state that can be entered from any non-destroyed state, and with hard failure states that always preserve a structured diagnostic record.

A deterministic implementation should treat each stage as a contract boundary:

| Stage | Invariants | Error classes | Bounded resource behavior | Required test evidence |
|---|---|---|---|---|
| Parse | Container syntax valid; section lengths exact; no duplicate keys or tensor names | `ParseError`, `DuplicateName`, `UnexpectedEOF` | Reads only header and directory tables; no large allocations | Fuzz corpus, duplicate-key fixtures, truncated-file fixtures |
| Authenticate and hash | Manifest hash, chunk hashes, optional signature envelope, tokenizer checksum, and artifact checksum match | `BadChecksum`, `BadSignatureEnvelope`, `MissingChunk`, `HashMismatch` | Streaming hash only; no full-file copy required | Golden hash fixtures, reordered-chunk rejection, tampered-byte rejection |
| Validate | Architecture family explicit; tensor set exact; dimensions legal; dtypes/quant types supported; tokenizer and adapter compatible; no NaN/Inf in required metadata scalars | `UnsupportedArchitecture`, `UnsupportedOperator`, `DimensionMismatch`, `UnsafeSize`, `TokenizerDrift`, `AdapterMismatch`, `NonFiniteMetadata` | Metadata-only pass; compute fit report before weight allocation | Known-bad manifests for each refusal class |
| Allocate | Preflight fit passes; backend chosen; hard upper bounds reserved | `OutOfMemoryPreflight`, `BackendUnavailable`, `IsolationRequired`, `DeviceLimitExceeded` | Commit only reservations required by selected backend | Memory budget unit tests and browser/device probes |
| Load and map | Every loaded chunk lands in the expected offset and checksum range; no aliasing surprises | `ChunkMapError`, `ShortRead`, `StorageQuotaExceeded` | Layer-by-layer or chunk-by-chunk load; no hidden materialization | Interrupted-load resume tests, quota-exceeded tests |
| Prefill | Tokenizer output matches canonical tokenizer; prompt length/legal window rules enforced | `TokenizationError`, `ContextOverflow`, `SpecialTokenViolation` | Prompt processing may stream and page weights; bounded temporary tiles only | Native parity tests on known prompts and first-token parity |
| Step | Inputs finite and in range; logits finite or sanitized according to policy; state advances monotonically | `KernelError`, `NonFiniteActivation`, `MalformedLogits`, `Cancelled` | One-token bounded work; cancellation polled between layers | Known-tensor kernel tests and one-step parity tests |
| Generate | Sampling obeys deterministic seed and option bounds; stop rules exact | `SamplingError`, `StopRuleConflict`, `ContextOverflow`, `Cancelled` | Output grows token-by-token; no unbounded string concatenation in hot path | Fixed-seed decode traces and stop-token regression suite |
| Cancel | No partial mutable state escapes; in-flight worker/backend transitions converge to a defined post-cancel state | `CancelTimeout`, `BackendHang` | Must complete within defined token/layer boundaries | Cancellation latency tests and UI responsiveness tests |
| Reset | KV/recurrent state cleared or explicitly reused via prefix cache identifier | `StateResetError`, `PrefixReuseMismatch` | Frees state without unloading weights | Prefix-reuse correctness tests |
| Unload | Weights and state released; storage handles closed; workers detached | `UnloadError` | Drops backend resources deterministically | Leak tests and repeated load/unload soak tests |
| Diagnose | Diagnostic bundle immutable and checksum-able | none | Small bounded JSON artifact | Snapshot tests over error schema |
| Destroy | No API calls except recreate; all resources invalidated | `UseAfterDestroy` | Zero live handles remain | API misuse tests |

The lifecycle must be implemented as a **closed state machine**, not as a collection of ad hoc methods. The API should reject illegal transitions such as `generate()` before `prefill()`, `adapter_attach()` after `allocate()`, or `reset()` after `destroy()`. This sounds mundane, but it is how a runtime becomes trustworthy under cancellation, refresh, or partial load failure. The UAIX governance material is relevant only in one narrow way: it reinforces that changes affecting behavior and telemetry must be transparent and reviewable, which maps cleanly to explicit lifecycle transitions and immutable diagnostic records. citeturn38search3turn38search20

A good deterministic diagnostics schema is small, typed, and hashable. An example record shape is:

```json
{
  "runtime_version": "semver",
  "build_profile": "native-avx2 | native-neon | wasm-simd128 | webgpu",
  "model_id": "manifest logical id",
  "artifact_sha256": "hex",
  "stage": "validate",
  "error_code": "UnsupportedOperator.PartialRoPE",
  "message": "converter refused model: partial RoPE dims not supported",
  "details": {
    "tensor": null,
    "layer": null,
    "expected": null,
    "actual": null,
    "backend": "wasm-simd128"
  },
  "resource_snapshot": {
    "reserved_bytes": 0,
    "committed_bytes": 0,
    "duplicate_copy_bytes": 0
  },
  "utc_timestamp": "2026-07-12T00:00:00Z"
}
```

That schema should be emitted identically by native and browser builds, with the browser version adding only environment fields such as `crossOriginIsolated`, `navigator.gpu present`, storage backend used, and worker count. The runtime should never emit a blank “success” result. Every benchmark or validation request must either produce a full record with timings, memory, and parity outcome, or a structured refusal explaining why the run did not happen.

## Memory model, storage layout, and preflight fit

The browser memory design should assume **Wasm32 first**, not Memory64 first. Although the Memory64 proposal has reached phase 4 and was merged upstream, browser readiness is still not uniform; Mozilla has explicitly noted the performance cost tradeoff of Memory64, and WebKit’s public bugs show Memory64 work still landing during 2026. For a deterministic compact-model runtime, the right default is therefore: **Wasm32 + chunked weights + bounded working set**, with Memory64 treated as an experimental future tier rather than a current requirement. citeturn7search0turn7search3turn7search2turn7search6turn37search2

The most important browser-memory facts are operational, not theoretical. `WebAssembly.Memory` is a resizable `ArrayBuffer` or `SharedArrayBuffer`; **growing** Wasm memory detaches the previous `ArrayBuffer`, even for `grow(0)`; Range requests let the client fetch only parts of a file; `Response.body` is a `ReadableStream`; `ReadableStream` itself is transferable; Cache Storage and IndexedDB are broadly available persistent stores; and browser storage is quota-managed and evictable. Put together, these facts strongly favor a design built around **immutable chunk files plus manifest metadata**, rather than full-file materialization and pointer-stable in-memory mapping. citeturn20search0turn20search1turn20search4turn26search0turn26search4turn26search2turn25search2turn26search8

The recommended storage stack is:

- **Manifest + metadata** in IndexedDB.
- **Large immutable weight chunks** in OPFS when available, otherwise IndexedDB blobs or Cache Storage responses.
- **Streaming network ingest** through `fetch()` + `ReadableStream`, optionally with Range requests.
- **Memory mapping substitute** implemented as a chunk index plus a layer scheduler that pulls only the needed chunks into backend-owned buffers.
- **P2P import** as chunked binary transfer into the same verified chunk store, never a special code path that bypasses validation. MiniModel’s public roadmap already points in this direction with chunk hashes, Merkle roots, direct peer-piece serve/fetch, receipt ledgers, and browser handoff. citeturn25search1turn25search10turn26search0turn26search4turn26search2turn41view0

The runtime should support **three loader modes**:

**Full materialization.** Load all weights into backend memory. Best latency after load; worst peak memory; acceptable for tiny fixtures and small q4/q8 models.  
**Paged weight access.** Keep chunks in persistent browser storage and page them into backend buffers per layer or per tensor group. Best for Wasm32 survival and mobile devices.  
**Hybrid caching.** Pin hot tensors such as embeddings, norms, output head, and a configurable recent layer window; page the rest. This is the best general browser mode. It avoids the repeated-cost trap of fully cold paging while keeping peak memory below full materialization.

A deterministic tokenizer path needs equivalent strictness. The runtime must bind tokenization to the packaged tokenizer artifact and its checksum. Unicode normalization is not a cosmetic step: Unicode UAX #15 defines canonical and compatibility normalization forms; SentencePiece performs normalization before tokenization and embeds normalization rules into the model; Hugging Face tokenizers treat added/special tokens as explicit tokenizer artifacts. The runtime should therefore reject any model whose tokenizer payload is missing, whose checksum does not match the manifest, whose special-token IDs collide, or whose added token rules drift from what the converter encoded. Undefined or out-of-range vocabulary rows should be **suppressed and refused at validation time**, not silently clamped during lookup. citeturn27search0turn27search1turn27search7turn27search2turn27search17

The memory formulas that matter most are these:

- **Quantized weight bytes**  
  `W = Σ tensor_blocks × bytes_per_block`  
  For q4_0-style blocks, `bytes_per_weight = 18 / 32 = 0.5625`.  
  For q8_0-style blocks, `bytes_per_weight = 34 / 32 = 1.0625`. citeturn29search0turn28search15

- **KV cache bytes for decoder attention**  
  `KV = T × L × 2 × H_kv × D_head × B_state`  
  where `T` is cached tokens, `L` layers, `H_kv` key/value heads, `D_head` head dimension, and `B_state` bytes per stored scalar.

- **Logits bytes**  
  `LOGITS = V × B_logits`  
  where `V` is vocab size.

- **Temporary dequant tile bytes**  
  `TMP ≈ K_tile × N_tile × B_deq + K_tile × B_act + N_tile × B_acc + metadata_scratch`

- **Sampler scratch**  
  `S ≈ V × (B_logits + B_index_or_mask)` for top-k/top-p filtering, unless a bounded heap/select algorithm is used.

Using the public SmolLM2 configs as concrete examples, the following budgets are reasonable for a browser runtime that keeps logits in `f32`, KV in `f16`, and reserves conservative JS/Wasm control overhead:

| Example model | Public config basis | Weight budget | KV at 512 | KV at 1024 | Logits | Conservative non-model reserve | Practical browser fit conclusion |
|---|---|---:|---:|---:|---:|---:|---|
| **Compact**: SmolLM2-135M q8_0 | 30 layers, hidden 576, 9 heads, 3 KV heads, vocab 49,152 citeturn19view0 | ~136.8 MiB q8_0 | 11.25 MiB | 22.5 MiB | ~0.19 MiB | 24–48 MiB | Comfortable on modern desktop browsers; reasonable on stronger mobile devices |
| **Compact**: SmolLM2-135M q4_0 | same config citeturn19view0 | ~72.4 MiB q4_0 | 11.25 MiB | 22.5 MiB | ~0.19 MiB | 24–48 MiB | Best default browser tier |
| **Quality**: SmolLM2-360M q4_0 | 32 layers, hidden 960, 15 heads, 5 KV heads, vocab 49,152 citeturn18view0 | ~193.1 MiB q4_0 | 20 MiB | 40 MiB | ~0.19 MiB | 32–64 MiB | Good desktop target; high-end mobile only |
| **Quality**: SmolLM2-360M q8_0 | same config citeturn18view0 | ~364.8 MiB q8_0 | 20 MiB | 40 MiB | ~0.19 MiB | 32–64 MiB | Browser-feasible on desktops, but likely too large for broad mobile support |

Those numbers intentionally exclude **duplicate upload copies** and **WebGPU residency duplication**. A safe preflight should add a configurable duplication factor:

- **CPU/Wasm mode:** `dup_factor = 1.0` for pinned chunks, `1.1–1.3` for stream buffers and JS wrappers.
- **WebGPU mode:** assume `dup_factor = 1.5–2.0` during initial upload, because host-side chunk material plus GPU-resident buffers may coexist transiently.

A good **preflight fit algorithm** is:

1. Read only manifest, tokenizer metadata, and tensor directory.
2. Verify checksums and architecture support.
3. Choose backend candidates in priority order: `native-simd` / `wasm-simd128` / `webgpu` / `scalar`.
4. Compute:
   - `weight_bytes`
   - `state_bytes` for max prompt + max generation target
   - `tmp_peak_bytes`
   - `js_control_bytes`
   - `duplication_bytes`
5. Compare against:
   - explicit runtime cap
   - backend-specific cap
   - browser/device limits when exposed
6. Emit either:
   - `FitReport{ok: true, backend, peak_bytes, steady_bytes}`
   - or `FitReport{ok: false, reasons:[...], smallest_failing_component, suggested_actions:[lower_context, q4, cpu_only, stream_layers]}`

That report must come **before allocation**. The user asked for “why a model does not fit before allocation,” and this is the only right answer: no speculative `Vec::reserve`, no “try and see,” and no opaque browser crash.

## Execution backends, browser ergonomics, and security boundaries

The CPU backend hierarchy should be **scalar reference first, optimized second**. Scalar kernels are the correctness source of truth. Native CPU acceleration should then use stable architecture-specific intrinsics where justified, while portable SIMD remains valuable for experimentation but is still nightly-only in Rust’s standard library. Rust’s `std::arch` and `core::arch` are stable and intended to expose vendor intrinsics; `std::simd` / `core::simd` remain nightly-only experimental APIs. That means a production runtime today should not make nightly portable SIMD a hard requirement. For native builds, ship stable intrinsic-backed kernels for AVX2/FMA, AVX-512 when separately validated, and NEON; for Wasm, target `simd128`; for all platforms, keep the scalar path as the parity oracle. citeturn35search9turn35search11turn35search0turn35search2

Determinism depends on what you **avoid** as much as what you use. Rust’s SIMD docs explicitly note that relaxed SIMD FMA may nondeterministically execute as fused or unfused arithmetic. A deterministic inference runtime should therefore avoid relaxed floating-point shortcuts in correctness-sensitive paths, fix accumulation order inside kernels, prefer integer-domain dequantization metadata that is interpreted identically across backends, and define a single rounding policy for quant dequant, RoPE, normalization, and sampling. If WebGPU is enabled, parity tolerance should be “exact where defined, bounded epsilon where backend-dependent,” and the CPU scalar backend must remain the final authority for diagnosis. citeturn35search18

Threads in the browser are valuable but conditional. Web Workers are the right unit for model loading, hash verification, tokenization, and inference so the main thread stays responsive. Wasm threads rely on workers plus shared memory; `SharedArrayBuffer` is usable only in the right security posture, and `crossOriginIsolated` deployment is the practical requirement for broad browser usage of SAB-based parallelism. That means **cross-origin isolation is an enhancement precondition**, not a general deployment assumption. A non-isolated origin must still work in single-worker, non-shared-memory mode. TinyRustLM’s own public surface, which exposes runtime status and consented local control, is consistent with that conservative deployment model. citeturn24search1turn24search6turn24search9turn40view0

Cross-origin isolation has real deployment consequences. Sites that want SharedArrayBuffer-backed parallelism must send the right cross-origin headers and ensure third-party subresources comply or are proxied/omitted; otherwise the app falls back to non-threaded Wasm. In practice, that means your deployment matrix becomes:

- **Tier A:** secure context + cross-origin isolated → Wasm SIMD + threads; optional WebGPU.
- **Tier B:** secure context, not isolated → Wasm SIMD single-thread; optional WebGPU if supported.
- **Tier C:** legacy or restricted browser → scalar single-worker fallback.

That tiering is better than “threads required,” because the latter would unnecessarily exclude deploys that still run compact models acceptably well. citeturn13search2turn13search20turn24search1turn24search6

WebGPU should be **optional, not required and not deferred**. It is now standardized enough and broadly available enough to justify implementing, especially because browser-local LLM work is already using WebGPU for larger generative models and high-dimensional embeddings. But it is still marked by MDN as limited availability, Firefox stable still lacks general support, Safari’s WebGPU support is relatively new, and feature-level compatibility data remains uneven across MDN pages. The correct conclusion is: **build WebGPU, but never make it the only successful path**. That balances speed with determinism and reach. citeturn13search1turn21search4turn21search2turn8search3

The WebGPU backend should be constrained to operations where the speedup is large and the kernel surface is stable: matmul, dequant+matmul fusion where validated, RMSNorm/LayerNorm, elementwise activations, RoPE, and attention score/value application. It should not be the first place to implement unusual architecture features. Device-loss handling must be first-class because WebGPU exposes device-loss notifications and pipeline failures; a lost device should downgrade the runtime to CPU/Wasm if the model still fits there. Shader compilation must happen before the first benchmark sample; cold-start and warm-start must be measured separately; and the runtime should publish buffer alignment and workgroup assumptions in diagnostics. citeturn13search14turn21search19turn13search18turn13search12

The security boundary is straightforward:

- The manifest, tokenizer, and chunks are **untrusted inputs** until verified.
- The Wasm module is trusted runtime code but still sandboxed by the browser or host OS.
- Local endpoint actions, if any, require explicit user approval and loopback-only constraints by default, which is also what TinyRustLM’s public UI indicates.
- P2P import is data ingress only; it must land in quarantine storage, then pass the exact same parse/auth/validate pipeline as local files or HTTP downloads.
- No telemetry, adaptive fallback, or automatic model rewriting may change inference semantics without surfacing it in diagnostics, which is both good engineering and aligned with the UAIX public governance posture. citeturn40view0turn41view0turn38search1turn38search20

## Deterministic sampling, state layout, and responsiveness

Tokenizer correctness and state layout dominate small-model behavior more than flashy kernel tricks. The runtime should package one canonical tokenizer artifact with its checksum, normalize text exactly as specified by that tokenizer, preserve added/special tokens as configured, and refuse any mismatch. “Tokenizer drift” should be a hard validation error because first-token parity is impossible if the prompt bytes are transformed differently before the model even runs. That is especially true for Unicode normalization and SentencePiece-style embedded normalization rules. citeturn27search0turn27search1turn27search7turn27search2

For dense Transformer decoders, the preferred KV layout is **layer-major, token-minor, contiguous K then contiguous V per layer**, with the KV-head count taken from `num_key_value_heads`, not `num_attention_heads`. This is the layout that makes GQA/MQA savings explicit and keeps per-token append logic simple. Prefix reuse should be content-addressed: hash the exact token ID prefix and the exact runtime/tokenizer/model build tuple; only then may the runtime reuse a prefetched KV prefix. Context reset must guarantee that no stale KV survives unless the caller opted into a prefix-cache identity. SmolLM2’s public configs make the GQA implications concrete by exposing separate attention-head and KV-head counts. citeturn18view0turn19view0turn30search0turn31search0

Recurrent-state architectures such as Mamba, DeltaNet, and linear-attention recurrences need a **different** state contract: fixed-size layer state rather than token-growing KV. That is why they should be refused until implemented as a separate backend family. Once supported, their layout should be layer-major, block-aligned, and resettable independently of token count, with recurrence overflow and reuse semantics explicitly tested. Treating them as “KV cache alternatives” in the same codepath is how bugs get hidden. citeturn30search2turn33search2turn33search8

Sampling should be intentionally boring:

- deterministic PRNG seeded from a 64-bit seed in the request
- temperature clamp to a narrow safe range
- bounded **top-k**
- optional top-p with a stable sorting rule
- repetition/frequency penalties applied in a fixed order
- exact stop-token and stop-string matching
- malformed-logit policy: reject if all logits are NaN/Inf; otherwise sanitize with a fixed finite fallback rule and emit a diagnostic

The safe default is `temperature=0` or greedy for parity tests, and a bounded `top-k` for user generation. A deterministic runtime should never rely on unspecified host RNG behavior, and it should never accept “sampling succeeded” if it had to silently replace an all-NaN logits vector.

Responsiveness belongs in the execution model, not just the UI. One model instance should live in one dedicated worker. The main thread should see only message-based progress snapshots. Cancellation should be cooperative and checked at deterministic boundaries: after each layer in prefill, after each token in decode, and before each storage/network chunk commit. That gives you a meaningful cancellation latency budget without tearing buffers out from under kernels. For multi-tab coordination, the runtime should elect a single owner for heavyweight shared resources through a small persisted lease record, so refresh/crash recovery can reclaim abandoned resources without corrupting the persistent weight store.

## Benchmarking, acceptance criteria, and rollback

The benchmark protocol should make it impossible to report a fake or blank success. Every benchmark run must emit a **typed result bundle** containing: model checksum, runtime/backend build, prompt checksum, tokenizer checksum, browser and platform ID, load latency, first-token latency, prefill tokens/s, decode tokens/s, steady-state memory, peak committed memory, duplicate-copy estimate, cancellation latency, stop reason, and parity outcome. If any stage fails, the run becomes a structured failure bundle rather than a “0 t/s” success.

The validation ladder should be:

**Known-tensor kernel tests.** Feed fixed small tensors through quant-dequant, matmul, RMSNorm, RoPE, softmax attention, and sampler logic; compare scalar native, Wasm SIMD, and WebGPU outputs against a golden reference.

**Source first-token parity.** Run a public upstream model in a trusted reference stack and record the first-token logits or argmax on a standard prompt set; the browser runtime must reproduce the same result under greedy decoding.

**Native reference parity.** Compare browser runtime outputs to the project’s own scalar native backend using the same quantization and tokenizer assets.

**Performance split.** Measure prefill and decode separately. Mistral-style SWA, GQA, and quantization all change decode characteristics differently from prefill, so a single “tokens/s” number is misleading. citeturn31search0turn30search0turn29search0turn28search15

**Load and first-token latency.** WebGPU pipelines and browser storage warming create real cold-start effects. Measure:
- first-ever network-to-first-token
- cached chunk store to first-token
- warm model resident to first-token

**Peak committed memory and duplicate-copy detection.** Track:
- manifest bytes
- tokenizer bytes
- persistent chunk bytes
- resident weight bytes
- KV/recurrent state bytes
- temp tile bytes
- JS wrapper bytes
- duplicate transfer bytes

If peak memory is unavailable from the platform, the runtime should report a conservative internal accounting total and mark it as estimated.

**Cancellation and UI checks.** A generation benchmark is incomplete unless it includes:
- cancel during hash verify
- cancel during load
- cancel during prefill
- cancel during long decode
- visible worker/main-thread responsiveness evidence

For visible status, use browser automation to capture canvas/DOM screenshots and pixel diffs for stage badges such as `waiting → loading → running → cancelled → reset`. A run that never updates visible status is not a pass.

The browser compatibility matrix should be interpreted conservatively:

- **Chrome/Edge desktop:** primary target, best overall path for Wasm SIMD, threading when isolated, and WebGPU. Chrome stable is 150 now. citeturn9search0turn13search2turn24search1
- **Firefox desktop:** strong candidate for CPU/Wasm path; WebGPU remains absent or not broadly supported in stable MDN compatibility data; current stable is 152. citeturn10search15turn13search2turn8search3
- **Safari desktop and iOS/iPadOS WebKit:** CPU/Wasm path is essential; Safari 26 added WebGPU, but this remains the newest and riskiest WebGPU deployment surface, and Memory64 readiness in WebKit has still been evolving in 2026. citeturn21search2turn12search4turn7search2turn7search6

The phased acceptance criteria should be:

**Phase Alpha**  
Dense Llama-style decoder only; scalar native parity; Wasm scalar parity; exact tokenizer checksum enforcement; no adapters; no WebGPU.

**Phase Beta**  
Wasm SIMD128; GQA/MQA; SWA; q4_0/q8_0; deterministic sampling; browser chunk store; preflight fit report; cancellation semantics.

**Phase Release Candidate**  
Optional WebGPU on supported browsers; device-loss fallback; OPFS/IndexedDB hybrid chunk store; prefix reuse; screenshot-based UI validation; multi-tab recovery; native CPU intrinsics on desktop.

**Phase General Availability**  
LoRA on supported dense bases; richer browser/device matrix; long-running soak tests; rollback-ready diagnostics archive; signed converter and runtime compatibility tables.

Rollback strategy should be **backend-local, not artifact-global**. If WebGPU parity regresses, disable WebGPU for the affected browser/backend tuple and continue serving the CPU/Wasm path on the same model artifact. If a quant kernel regresses, downgrade that tensor type to scalar or refuse that quant format while preserving the rest of the runtime. If tokenizer drift is detected in a released converter, mark the converter version incompatible and refuse affected artifacts rather than trying to repair them in place.

## Open questions requiring local code inspection

The following points should be treated as **open questions**, not guesses, because they require access to local code, private `.slm` samples, or unpublished tests:

- the exact `.slm` binary layout, section ordering, and whether it already encodes chunk tables, Merkle roots, per-tensor hashes, or tokenizer payloads
- the precise tensor naming convention and quant block schemas used by TinyRustLM private models
- whether TinyRustLM’s public “GPU” status currently means WebGPU acceleration, another browser path, or only a planned surface
- whether tokenizer payloads are stored as SentencePiece models, Hugging Face tokenizer JSON, a custom minimized format, or multiple interchangeable encodings
- whether adapters are merged offline or applied at runtime
- the exact public MiniModel verifier output schema and whether it already produces enough evidence to drive load-time refusal without additional converter metadata
- real peak-memory measurements, duplicate-copy counts, and mobile-browser performance results for TinyRustLM’s current public demos
- any native backend, CI matrix, or local parity suite that is not visible on the public web

Given the public evidence only, the strongest current recommendation is clear: build **a deterministic dense-decoder runtime first**, with **strict converter refusals** for unsupported architecture features, a **Wasm32-first memory plan**, **optional WebGPU acceleration**, **explicit lifecycle diagnostics**, and **benchmark gating that proves correctness before claiming performance**. That architecture is aligned with the current web platform, with the public TinyRustLM and MiniModel direction, and with the user-facing trust posture implied by the UAIX governance materials. citeturn40view0turn41view0turn38search1turn37search5turn13search1
# Extreme Model Compression and `.slm` Quantization for Browser-Local Instruction Models

**Report date:** 2026-07-12 UTC.  
**Scope:** public-web evidence only. This report treats TinyRustLM and `.slm` as a **black-box product context**. It does **not** infer any private TinyRustLM implementation details, unpublished `.slm` internals, or parity results beyond what the public site and developer documentation explicitly state. Publicly, TinyRustLM describes a browser-local Rust/WASM runtime, strict local `.slm` checking, optional P2P import with manifests and receipts, and a currently documented `.slm` contract oriented around tiny artifacts, q8_0/q4_0, and a 33.5 MB runtime envelope. That public contract is useful as a product boundary, but it is not yet sufficient, by itself, for a 0.5B–2B mixed-precision browser artifact. citeturn39view0turn40view0turn42view0

The main conclusion is straightforward: for a **portable Rust + WASM/WebGPU** deployment, the best current route is **not** an exotic single-method quantizer. It is a **mixed-precision artifact contract** built around **simple blockwise random-access tensors**, with **offline search or calibration** borrowed from methods like GPTQ, AWQ, HQQ, OmniQuant, AutoRound, or MatGPTQ, plus **selective higher precision** for embeddings, output heads, norms, sensitive projections, and possibly first/last layers, plus **KV-cache quantization** chosen to match the architecture. Uniform Q4 is not a safe default. Public literature and public product docs both point toward heterogeneity: some tensors tolerate aggressive compression, while others do not. citeturn25view0turn42view0turn20view0turn15view0turn14view0turn16view3turn18view2

## Research basis and black-box context

TinyRustLM’s public site says prompts stay in the browser, local `.slm` files stay on the device, models are checked before they run, P2P import can use peer proof and manifests, and the UI exposes provenance, checksums, model budgets, adapter budgets, scratch budgets, KV budgets, and receipt/ledger concepts. The same public UI also says that a “verified MiniModel demo” loads from MiniModel.org, but that statement is only black-box context; it does not establish any additional `.slm` internals or portability guarantees. citeturn39view0

The public `.slm` page defines `.slm` as a project-specific binary artifact for strict browser loading and bounded validation. Publicly documented invariants include explicit model dimensions and tensor entries, a header target of 108 bytes, 64-byte tensor entries, checksum binding before generation, finite payload checks, and tokenizer inclusion either inside the artifact or in a verified sidecar path. The public page also says the runtime supports byte fallback and compiled BPE metadata and performs tokenizer drift checks. citeturn40view0

The public TinyRustLM quantization page is intentionally narrow. It documents only `f32`, `q8_0`, and `q4_0`, describes `q8_0` as the balanced path, `q4_0` as the tight-memory path, gives approximate storage costs of 4.0, 1.0625, and 0.5625 bytes per parameter respectively, and explicitly notes that standard WASM does not provide native 4-bit tensor arithmetic, so `q4_0` requires nibble unpacking with masks and shifts before accumulation. In other words, the public product docs themselves separate **byte savings** from **latency wins**. citeturn42view0

The public adapter page is also useful product context. It describes typed local sidecars, preflight validation in Rust, manifest-bound artifacts, rejection of incompatible packages, and clearing the KV cache after successful adapter application. That is exactly the right public-contract instinct for any future large-model `.slm` design, even though the current public docs remain size-limited. citeturn41view0

Taken together, the public TinyRustLM evidence supports a generic direction: a larger `.slm` family for 0.5B–2B should preserve the same **strict validation, inspectable metadata, bounded parsing, and immutable receipts**, but must evolve beyond the currently public tiny-model envelope. citeturn39view0turn40view0turn41view0turn42view0

## Method landscape and portability matrix

A crucial distinction runs through the literature: **the quantization method used offline** and **the runtime encoding used online** are not the same thing. GPTQ, AWQ, HQQ, OmniQuant, AutoRound, MatGPTQ, and similar methods are best thought of as **search, rounding, clipping, or fine-tuning procedures**. For a browser artifact, the winning pattern is usually to run these methods offline, then **emit a portable blockwise tensor layout** rather than depending on the authors’ CUDA kernels. That separation is far more important for browser deployment than leaderboard deltas between papers. citeturn18view0turn15view0turn14view0turn16view3turn18view2turn16view3

### Core weight-compression methods

| Method | Objective and calibration | Metadata and decode-time operators | Reproducibility and legal posture | CPU SIMD / WASM / WebGPU verdict | Expected accuracy and practical verdict |
|---|---|---|---|---|---|
| **Simple symmetric or asymmetric blockwise Q8/Q6/Q5/Q4/Q3** | Minimize storage with per-block or per-group scaling; may be calibration-free if pure absmax/minmax, or calibration-assisted if scales/clipping are learned. Public TinyRustLM docs currently expose only `q8_0` and `q4_0`. citeturn42view0turn14view0 | Needs packed low-bit codes plus scales and sometimes zero-points. Decode is simple unpack + scale, which is friendly to random access and chunk streaming. citeturn42view0turn14view0 | Highly reproducible if block order, scale rule, rounding rule, and chunk alignment are fixed. Legal posture depends on implementation; generic layout itself is usually low-risk. | **Best portable default.** Q8/Q6 are friendlier to CPU SIMD; Q4/Q3 save bytes but pay unpack overhead because WASM lacks native 4-bit arithmetic. WebGPU compute can handle packed formats, but needs bespoke kernels. citeturn42view0turn27view2turn27view0turn27view1 | Strongest deployment choice when paired with mixed precision. Uniform Q4 is often too blunt; mixed Q8/Q6/Q5/Q4 is the practical sweet spot. citeturn25view0turn42view0 |
| **GPTQ** | Post-training quantization using second-order information to choose low-error rounding; public repo supports 2/3/4-bit compression and grouping. citeturn18view0 | Requires per-layer statistics from calibration data and produces grouped quantized weights. Public fast path emphasizes 3-bit CUDA kernels. citeturn18view0 | Reproducible if calibration set, sample order, group size, and flags such as `act-order` and `true-sequential` are fixed. Apache-2.0 code. citeturn18view0 | **Portable after repacking.** The search procedure is useful; the published fast kernels are CUDA-centric. A Rust implementation should copy the *objective*, then emit a simpler runtime format. citeturn18view0 | Still one of the best baseline PTQ methods for browser-oriented offline search, especially at 4–6 bits. citeturn18view0turn18view2 |
| **AWQ** | Activation-aware weight quantization; public repo supports INT3/4 and says it supports instruction-tuned and multimodal models. citeturn15view0 | Needs activation calibration and “AWQ search”; runtime path in the official repo includes memory-efficient 4-bit linear layers, chunk prefilling, and efficient CUDA kernels. citeturn15view0turn15view2 | Reproducible if calibration corpus and search settings are fixed. MIT-licensed code. citeturn15view0 | **Portable after repacking.** AWQ’s *selection logic* is portable; its *published fast path* is CUDA-heavy. citeturn15view0turn15view1 | Very strong practical method for protecting salient weights in instruction models; especially useful for identifying which channels or groups deserve uplift. citeturn15view0 |
| **HQQ** | Half-Quadratic Quantization; the public repo emphasizes fast quantization, 8/4/3/2/1-bit support, and **no calibration data requirement**. citeturn14view0 | Metadata is simple grouped scale information; public repo says dequantization is linear and compatible with optimized CUDA/Triton kernels. citeturn14view0 | Good reproducibility because it is calibration-free and structurally simple. Apache-2.0 code. citeturn14view0 | **One of the most Rust-friendly research methods.** Even if you do not reproduce the exact repo kernels, the linear dequantization structure fits portable runtimes well. citeturn14view0 | Especially attractive when you want a calibration-light pipeline and are willing to recover quality with selective higher precision or low-rank correction. citeturn14view0 |
| **SqueezeLLM** | Dense-and-sparse quantization; explicitly splits each weight matrix into a highly quantized dense component plus sparse sensitive/outlier parts. citeturn13view2 | Needs sparse metadata in addition to dense quantization metadata; official flow builds CUDA code. citeturn13view2 | Reproducible if sparse thresholding and calibration are fixed. MIT-licensed code. citeturn13view2 | **Portable in principle, awkward in practice.** Browser support is possible, but sparse sidecars complicate random access, cache locality, and kernel simplicity. citeturn13view2 | Excellent rescue path for outliers, but only worth it if behavior gates prove that pure mixed precision is insufficient. citeturn13view2 |
| **SpQR** | Sparse-Quantized Representation for near-lossless compression. Public repo recommends training-domain subsets as calibration data and provides CUDA matvec kernels plus conversion to optimized storage. citeturn17view3turn17view0 | Needs quantized tensors **and** sparse storage metadata. Official repo introduces legacy-to-optimized storage conversion and CUDA kernels. citeturn17view0turn17view1 | Reproducible if calibration subset and conversion path are fixed. Apache-2.0 code. citeturn17view2 | **Not a first browser target.** Excellent compression research, but the sparse+quantized storage stack is much less WASM-friendly than plain blockwise tensors. citeturn17view0turn17view1 | Strong near-lossless option for server-grade runtimes; only a conditional choice for browser if simpler profiles fail. citeturn16view0 |
| **AQLM with PV-Tuning** | Additive codebook quantization for extreme compression; PV-Tuning improves fine-tuning/optimization in extreme regimes. Public repo highlights 1-bit support improvements and Apache-2.0 licensing. citeturn16view2turn11search14 | Needs codebooks, code indices, and usually more exotic decode paths than plain blockwise scaling. citeturn16view2 | Reproducibility requires fixed codebook training and seed capture. Apache-2.0 code. citeturn16view2 | **Research-only for first portable Rust implementation.** Compression can be excellent, but codebook lookup and dequant operators are harder to optimize portably. citeturn16view2turn11search14 | Very relevant for ultra-low-bit work, but too kernel-specific for a first browser artifact that must remain inspectable and deterministic. citeturn16view2 |
| **QuIP / QuIP#** | QuIP introduced incoherence processing and viable 2-bit PTQ; QuIP# added randomized Hadamard transforms, E8 lattice codebooks, and fine-tuning, improving results at ≤4 bits. citeturn19search6turn19search5 | Requires Hadamard/incoherence metadata and vector codebook decode. QuIP# public code is GPL-3.0. citeturn16view1turn19search5 | Needs fixed random seeds/sign patterns for reproducibility. GPL-3.0 code is a significant commercial integration consideration. citeturn16view1turn19search5 | **Portable only with major investment.** Great paper results; poor fit for a first no-CUDA Rust runtime. citeturn16view1turn19search5 | Important as a reference for extreme compression, but not a default runtime target for browser-local conversation quality. citeturn19search6turn19search5 |
| **QTIP and YAQA** | QTIP replaces low-dimensional VQ with trellis-coded quantization after incoherence processing; YAQA is a newer rounding framework on top of QTIP and reports roughly a one-third KL reduction over LDLQ/GPTQ across models and quantizers. citeturn23view0turn23view1 | Needs trellis/codebook or Hessian-derived rounding metadata; public repos include custom kernels and are GPL-3.0. citeturn23view0turn23view1 | Reproducibility requires frozen Hessian collection, randomization, and codebook settings. GPL-3.0 code. citeturn23view0turn23view1 | **Excellent research, poor first deployment fit.** The published fast path assumes custom kernels and more specialized math than a browser runtime wants. citeturn23view0turn23view1 | Strong successor line for extreme compression, but it belongs behind a mature kernel effort, not in a version-one `.slm` browser contract. citeturn23view0turn23view1 |
| **HIGGS and the Linearity Theorem** | Data-free quantization using Hadamard preprocessing and Gaussian MSE-optimal grids; the associated theory also reduces non-uniform layer allocation to a knapsack-style dynamic program under a byte budget. citeturn25view0turn36search13 | Needs non-uniform grids and Hadamard preprocessing. Public Transformers docs say runtime support is through FLUTE and current model support is limited. citeturn36search15turn36search1 | Very reproducible if transforms/grids are fixed. Public code/docs are MIT/permissive in available implementations, but runtime ecosystem is still specialized. citeturn36search10turn36search15 | **Best used as an offline search idea today.** The theory is valuable immediately; the runtime format is not yet a browser default. citeturn25view0turn36search15 | Highly relevant for budgeted mixed-profile search even if you do not ship native HIGGS decode. citeturn25view0 |
| **LeanQuant, AutoRound, MatGPTQ** | LeanQuant attempts more framework-compatible loss-aware grids; AutoRound targets 2–4 bits with sign-gradient descent and broad hardware compatibility; MatGPTQ makes a single parent model sliceable across multiple target precisions. citeturn25view1turn13view3turn18view2 | All three are primarily offline quantization/search pipelines. MatGPTQ still ships CUDA inference code; AutoRound increasingly supports many backends. citeturn13view3turn18view2 | Good reproducibility if seeds and calibration hashes are fixed. LeanQuant and MatGPTQ aim to improve budget-search realism; AutoRound is Apache-2.0, MatGPTQ MIT. citeturn25view1turn13view3turn18view2 | **Very relevant offline.** AutoRound and MatGPTQ are especially useful if you want one conversion pipeline that emits multiple browser profiles. citeturn13view3turn18view2 | These are among the most relevant “current successors” for a profile-search conversion pipeline. citeturn13view3turn18view2 |

### Activation, cache, and extreme-low-bit methods

| Method | Objective and calibration | Portability reality | Browser verdict |
|---|---|---|---|
| **SmoothQuant** | Training-free W8A8 PTQ; moves activation outliers into weights with an equivalent transformation. Public repo says it uses INT8 GEMM via CUTLASS/`torch-int` and calibration from activation-channel scales, with provided examples using 512 random Pile validation sentences. citeturn20view0 | Excellent when true int8 kernels exist. Less attractive for pure WASM weight-only runtimes; more attractive for WebGPU compute. MIT license. citeturn20view0turn27view0turn27view1 | **WebGPU candidate, not first WASM-only target.** |
| **ZeroQuant** | Early W8A8/low-bit activation line. Public evidence today is weak from a deployment perspective: a DeepSpeed issue explicitly says the ZeroQuant inference engine was not released and that the example only helped verify accuracy. Another public issue asked where ZeroQuant-V2 code could be found. citeturn21search16turn21search7 | Unclear maintained public runtime path versus newer methods. | **Do not base a browser plan on ZeroQuant. Use it as literature background only.** |
| **OmniQuant** | Omnidirectionally calibrated PTQ; public repo supports weight-only and weight-activation quantization, but also says it leverages bug-fixed AutoGPTQ kernels for “real quantization.” citeturn16view3 | Strong calibration logic, but published fast path is not portable. MIT license. citeturn16view3 | **Useful offline; repack outputs into a simple format.** |
| **PrefixQuant and EfficientQAT** | PrefixQuant isolates token-wise outliers via prefixed tokens and cached KV; EfficientQAT is a newer efficient QAT line and the OmniQuant repo itself calls it the then-current SOTA of uniform quantization. citeturn22search18turn22search5turn16view3 | Valuable if you need W4A4KV4-like activation/cache compression, but they are substantially more invasive than weight-only PTQ. | **Second-wave features for WebGPU, not a first browser artifact.** |
| **KIVI and KVQuant** | KIVI proposes tuning-free asymmetric 2-bit KV compression with per-channel keys and per-token values; KVQuant adds pre-RoPE key quantization, non-uniform per-layer datatypes, and dense+sparse handling for long context. citeturn33search0turn33search1turn33search10 | Both are highly relevant to browser chat because long conversations can be dominated by KV bytes, not model bytes. | **Essential. A browser-local chat artifact should plan KV quantization from the start.** |
| **BitNet, OneBit, PB-LLM** | Native or partial binary/ternary approaches push weight precision to ~1–1.58 bits. BitNet’s public inference framework is official, and Microsoft has released a 2B native 1-bit line; OneBit and PB-LLM show PTQ/QAT routes for post-hoc extreme-low-bit work. citeturn37search0turn37search2turn37search5turn37search7turn37search3 | Native 1-bit models are compelling, but they are effectively different model families with dedicated kernels. Post-hoc binarization remains fragile. | **Interesting long-term direction, not a safe drop-in replacement for a browser `.slm` pipeline today.** |

The synthesis is practical. If the goal is “browser-local artifact, preserves conversation, practical judgment, lawful adult inquiry, current-turn state, and clean generation,” the shortlist is:

- **Portable runtime encoding:** simple blockwise mixed precision.
- **Offline search:** GPTQ, AWQ, HQQ, OmniQuant, AutoRound, MatGPTQ, or HIGGS-inspired budget search.
- **Optional rescue:** small sparse/residual sidecars on flagged channels only.
- **Long-chat support:** KIVI/KVQuant-style KV quantization.
- **Adapters:** keep them separate unless a fixed adapter is proven worth merging. citeturn18view0turn15view0turn14view0turn16view3turn18view2turn25view0turn33search0turn33search1turn41view0

## Sensitivity, calibration, and parity protocol

A browser artifact should be promoted only after it passes a **source-to-quantized parity suite**. Structural validity is necessary but not sufficient. A model that parses and runs but loses first-token parity, multi-turn state tracking, or lawful-adult reasoning quality is still a failure. Public quantization work also supports this stance: the linearly budgeted layer-importance framing in the “Linearity Theorem” paper explicitly says layers contribute differently to perplexity increase, and recent layer-sensitivity work reports stable layer-wise activation sensitivity patterns across model families. citeturn25view0turn24search0

### Calibration-set design

The calibration set should be small enough to be practical and large enough to expose activation ranges and conversational behavior. For a 0.5B–2B instruction model, I recommend **1,024–4,096 non-overlapping sequences**, hashed and versioned, spanning:

- chat turns with follow-up references and pronouns,
- practical planning and judgment prompts,
- code and tool-like instructions,
- summarization and reformulation,
- lawful adult inquiries that should be answered normally,
- refusal-boundary prompts that should remain refused,
- clean-style prompts that stress repetition and degeneration control.

This set must **exclude all evaluation prompts verbatim**. Public methods reinforce the importance of representative calibration: SmoothQuant publishes activation scales from random Pile validation examples, AWQ performs activation-aware search, SpQR recommends training-domain subsets, while HQQ explicitly advertises a no-calibration path. citeturn20view0turn15view0turn17view3turn14view0

### Source-tensor finite/range audit and outlier maps

For each source tensor \(W\):

\[
\text{finite\_ok}(W) = \mathbf{1}\{\forall w \in W,\; w \in \mathbb{R},\; |w| < \infty\}
\]

\[
\text{maxabs}(W) = \max_{w \in W}|w|,\qquad
\text{nz\_median}(W)=\operatorname{median}\{|w|: w\neq 0\}
\]

\[
\text{dynamic\_range}(W)=\frac{\text{maxabs}(W)}{\max(\text{nz\_median}(W), \epsilon)}
\]

Use **stable rank** as a rank-aware severity signal:

\[
\text{sr}(W)=\frac{\|W\|_F^2}{\|W\|_2^2}
\]

Let \(r = \text{sr}(W)/\min(m,n)\). Then set a stricter outlier split threshold for lower-rank, spikier tensors:

\[
\tau(W)=
\begin{cases}
Q_{0.990}(|W|), & r < 0.15 \\
Q_{0.995}(|W|), & 0.15 \le r < 0.35 \\
Q_{0.999}(|W|), & r \ge 0.35
\end{cases}
\]

Build two maps:

\[
\text{entry\_outlier}(i,j)=\mathbf{1}\{|W_{ij}|>\tau(W)\}
\]

\[
\text{channel\_outlier}(c)=\mathbf{1}\left\{\frac{\|W_c\|_\infty}{\|W_c\|_2/\sqrt{d_c}} > \gamma\right\}
\]

where \(\gamma\) is tuned on the calibration corpus. The point is not the exact threshold family; the point is to avoid pretending every tensor is equally compressible.

### First-token logit parity

For the same prompt \(x\), with source logits \(z^{(s)}\) and quantized logits \(z^{(q)}\) at the first generated position:

\[
\cos(z^{(s)}, z^{(q)})=\frac{z^{(s)}\cdot z^{(q)}}{\|z^{(s)}\|_2\|z^{(q)}\|_2}
\]

\[
\text{TopKRet}(K)=\frac{\left| \operatorname{TopK}(z^{(s)},K) \cap \operatorname{TopK}(z^{(q)},K)\right|}{K}
\]

\[
\mathrm{KL}_T = \sum_i p_i^{(s)} \log\frac{p_i^{(s)}}{p_i^{(q)}}
\quad \text{with} \quad
p^{(\cdot)}=\operatorname{softmax}(z^{(\cdot)}/T)
\]

Use \(K \in \{1,5,20\}\) and at least one temperature \(T \in \{1.0, 0.7\}\). Structural validation without this parity check is not enough.

### Multi-step teacher-forced divergence and free-generation divergence

For a teacher-forced reference continuation of length \(N\):

\[
\overline{\mathrm{KL}} = \frac{1}{N}\sum_{t=1}^{N} \mathrm{KL}\!\left(p_t^{(s)} \,\|\, p_t^{(q)}\right)
\]

\[
\overline{\cos} = \frac{1}{N}\sum_{t=1}^{N} \cos(z_t^{(s)}, z_t^{(q)})
\]

\[
\Delta\mathrm{PPL} = \frac{\mathrm{PPL}_{q}-\mathrm{PPL}_{s}}{\mathrm{PPL}_{s}}
\]

For free generation, do not rely on string equality. Measure:

- mean length ratio,
- repetition rate,
- refusal-preservation rate,
- state-carry correctness rate,
- answer-class match rate on behavior gates,
- normalized edit or embedding distance only as a secondary metric.

A quantized model can be “string-different” yet behaviorally correct, or string-similar yet conversationally broken.

### Behavior-gate comparison

Use a small gated suite that is **not** reused for calibration. I recommend five buckets:

- **Conversation memory:** pronoun resolution, entity carry-over, turn-to-turn corrections.
- **Common sense and practical judgment:** everyday planning, trade-offs, safety-without-overrefusal.
- **Lawful adult inquiry:** explicit but lawful content that should be answered cleanly, not spuriously refused.
- **Instruction hygiene:** tone following, JSON cleanliness, code fence correctness.
- **Clean generation:** anti-looping, anti-degeneration, no sudden template drift.

The pass/fail signal here is more operationally important than yet another perplexity delta.

### Layer replacement tests and budget search

Run **single-layer replacement tests**: quantize one layer at a time while the rest remain BF16 or FP16, then rank layers by \(\Delta\mathrm{KL}\), \(\Delta\mathrm{PPL}\), and behavior failures. Then run **tensor-class replacement tests** inside the worst layers: embeddings, q/k/v/o, MLP gate/up/down, norms, output head. Public work supports this layerwise reasoning, and the linearly budgeted formulation is a good basis for mixed-profile search. citeturn25view0turn24search0

For budgeted search, define:

\[
\text{benefit}(i,p\!\to\!q)=\frac{\Delta \text{Loss}_{i,p\to q}}{\Delta \text{Bytes}_{i,p\to q}}
\]

Then solve either a greedy uplift schedule or a dynamic program:

\[
\min_{\{b_i\}} \sum_i \alpha_i \cdot \mathrm{MSE}_i(b_i)
\quad \text{s.t.}\quad
\sum_i \mathrm{Bytes}_i(b_i)\le B
\]

where \(\alpha_i\) comes from the observed layer/tensor sensitivity. This is exactly the style of budgeted mixed-profile search that the current literature increasingly supports. citeturn25view0turn18view2

### Adapter merge versus separate execution

Keep adapters **separate by default** if they are optional, user-swappable, or small enough to remain sidecars. Merge only when the adapter is fixed, widely used, and can be re-quantized with parity recovery after merge. The public TinyRustLM adapter docs already point in the right generic direction: manifest-bound sidecars, semantic validation before apply, and KV-cache clear on successful application. citeturn41view0

### Corruption and malformed-data tests

Every emitted artifact should be tested against:

- truncation at random chunk boundaries,
- checksum mismatch,
- NaN/Inf insertion,
- scale underflow and overflow,
- bad tensor shapes,
- out-of-range group counts,
- integer-overflow on byte offsets,
- duplicate tensor names,
- malformed tokenizer tables.

These are not “nice to have” tests for browser distribution. They are table stakes.

## Storage, memory, and bandwidth equations

### Weight-storage formulas

For a generic block quantizer with block size \(G\), bit-width \(b\), scale bytes \(S\), zero-point bytes \(Z\), and block alignment \(A\) bytes:

\[
\text{PackedCodes}(G,b)=\left\lceil\frac{G\cdot b}{8}\right\rceil
\]

\[
\text{BlockBytes}_{\text{sym}} = \operatorname{align\_up}\!\left(\text{PackedCodes}(G,b)+S,\;A\right)
\]

\[
\text{BlockBytes}_{\text{asym}} = \operatorname{align\_up}\!\left(\text{PackedCodes}(G,b)+S+Z,\;A\right)
\]

\[
\text{TensorBytes}(N)=\left\lceil\frac{N}{G}\right\rceil \cdot \text{BlockBytes}
\]

\[
\text{BytesPerWeight} \approx \frac{\text{BlockBytes}}{G}
\]

For a simple `q*_0`-style layout with \(G=32\), \(S=2\) bytes, \(Z=0\), \(A=1\):

\[
\text{BytesPerWeight}_{q8}=\frac{32+2}{32}=1.0625
\]

\[
\text{BytesPerWeight}_{q6}=\frac{24+2}{32}=0.8125
\]

\[
\text{BytesPerWeight}_{q5}=\frac{20+2}{32}=0.6875
\]

\[
\text{BytesPerWeight}_{q4}=\frac{16+2}{32}=0.5625
\]

\[
\text{BytesPerWeight}_{q3}=\frac{12+2}{32}=0.4375
\]

For block floating point with shared exponent bytes \(E\) and mantissa/sign payload \(M\) bits per weight:

\[
\text{BlockBytes}_{\text{BFP}}=\operatorname{align\_up}\!\left(\left\lceil\frac{G\cdot M}{8}\right\rceil + E,\;A\right)
\]

### Embedding and output-head bytes

Let \(V\) be vocab size and \(d\) hidden size.

Tied layout:

\[
\text{Bytes}_{\text{tied}} = V\cdot d \cdot \text{bytes\_per\_weight}
\]

Untied layout:

\[
\text{Bytes}_{\text{untied}} = V\cdot d \cdot \text{bytes\_per\_weight}^{(\text{embed})}
+ V\cdot d \cdot \text{bytes\_per\_weight}^{(\text{head})}
\]

This term can dominate browser artifacts. Public configs illustrate the trade-off. SmolLM2-1.7B-Instruct uses `vocab_size = 49152`, `hidden_size = 2048`, `num_hidden_layers = 24`, and `num_key_value_heads = 32`, while Qwen2.5-1.5B-Instruct uses `vocab_size = 151936`, `hidden_size = 1536`, `num_hidden_layers = 28`, and `num_key_value_heads = 2`. That means the tied embedding/head term is far smaller for SmolLM2, but the KV cache is dramatically smaller for Qwen because of grouped-query attention. citeturn32view1turn31view0

### KV-cache and recurrent-state bytes

For batch \(B\), active context \(T\), layers \(L\), KV heads \(H_{kv}\), head dimension \(D_h\), and bytes per cache element \(e_{kv}\):

\[
\text{KVBytes}=B \cdot T \cdot L \cdot 2 \cdot H_{kv}\cdot D_h \cdot e_{kv}
\]

The factor \(2\) is for keys and values.

This architecture term matters as much as weight quantization. Using public configs:

- **SmolLM2-1.7B**: \(L=24\), \(H_{kv}=32\), \(D_h=64\), so  
  \(\text{KVBytes/token}=196{,}608\) bytes at FP16, \(98{,}304\) at INT8, \(49{,}152\) at Q4.  
  At 8k context, that is about **1.5 GB FP16**, **768 MB INT8**, **384 MB Q4**. citeturn32view1
- **Qwen2.5-1.5B**: \(L=28\), \(H_{kv}=2\), \(D_h=128\), so  
  \(\text{KVBytes/token}=28{,}672\) bytes at FP16, \(14{,}336\) at INT8, \(7{,}168\) at Q4.  
  At 8k context, that is about **224 MB FP16**, **112 MB INT8**, **56 MB Q4**. citeturn31view0

That single comparison changes deployment strategy. A full-head model with a smaller vocabulary can be easier to *download* but much harder to *chat with locally for long context*. A GQA model can be the opposite. citeturn32view1turn31view0

### Scratch, logits, sampler, tokenizer, and manifest

Let \(V\) be vocab size and \(e_\ell\) bytes per logit element.

\[
\text{LogitBytes}=V\cdot e_\ell
\]

For top-\(K\) sampling, with token id bytes \(e_{\text{id}}\), score bytes \(e_{\text{score}}\), and optional logit bytes \(e_{\text{logit}}\):

\[
\text{SamplerBytes}\approx K\cdot (e_{\text{id}} + e_{\text{score}} + e_{\text{logit}})
\]

Tokenizer and manifest overhead depend on representation, but the design target should be:

\[
\text{MetaBytes} = \text{TokenizerBytes} + \text{ManifestBytes} + \text{LoaderTableBytes}
\]

For a safely inspectable artifact, keep these visible and hashable. Do not hide core tokenizer behavior behind opaque compression that users cannot inspect.

### Conversion peak memory

If conversion fully materializes source tensors:

\[
M_{\text{conv,mat}} \approx W_{\text{src}} + W_{\text{dst}} + M_{\text{stats}} + M_{\text{workspace}}
\]

If conversion streams tensor-by-tensor:

\[
M_{\text{conv,stream}} \approx \max_i \left(W_{\text{src},i} + W_{\text{dst},i} + M_{\text{stats},i} + M_{\text{workspace},i}\right) + M_{\text{manifest}}
\]

For large 0.5B–2B models, streaming is the only sane default.

### Browser peak memory

Let \(A\) be the artifact bytes.

If the app fetches the whole model as a JS `ArrayBuffer`, then copies into WASM memory:

\[
M_{\text{peak,fetch+wasm}} \approx A_{\text{JS}} + A_{\text{WASM}} + M_{\text{scratch}} + M_{\text{KV}} + M_{\text{logits}}
\]

Because `WebAssembly.Memory` is itself a resizable `ArrayBuffer`/`SharedArrayBuffer`, that duplication is real. citeturn26search3turn26search15

If WebGPU is used and weights are fully uploaded:

\[
M_{\text{peak,webgpu}} \approx A_{\text{host}} + A_{\text{GPU-resident}} + A_{\text{staging}} + M_{\text{KV}} + M_{\text{scratch}}
\]

The exact staging path is implementation-dependent, but `GPUBuffer` is a separate memory object and mapped buffers cannot be used in GPU commands while mapped, which is why staging and duplication matter. citeturn26search0turn26search12turn26search8

If OPFS is used with streaming reads:

\[
M_{\text{peak,opfs-stream}} \approx A_{\text{persistent}} + C_{\text{io-chunk}} + M_{\text{hot-layer}} + M_{\text{KV}} + M_{\text{scratch}}
\]

OPFS is valuable here because public docs describe it as highly optimized and offering in-place write access. IndexedDB can store large files/blobs too, but the lowest transient RAM usually comes from chunked OPFS reads rather than whole-artifact `ArrayBuffer` materialization. citeturn26search2turn26search14turn26search1

This is why browser-local model loaders should always query storage and persistence state before import:

\[
\text{quota},\text{usage} \leftarrow \texttt{navigator.storage.estimate()}
\]

and should request persistent storage where appropriate. Public browser docs explicitly expose both `estimate()` and `persist()`. citeturn35search1turn35search19

### P2P chunking, hashing, resumption, and deduplication

For artifact size \(A\), fixed chunk size \(C\), and \(n=\lceil A/C \rceil\):

\[
n=\left\lceil \frac{A}{C}\right\rceil
\]

If each chunk has hash bytes \(H\), range metadata \(R\), and flags \(F\):

\[
\text{ChunkMetaBytes}=n\cdot(H+R+F)
\]

Total transport bytes with manifest \(M\):

\[
\text{TransferBytes}\approx A + \text{ChunkMetaBytes} + M
\]

If chunks are deduplicated by content hash and only a fraction \(u\) are unique:

\[
\text{UniqueTransferBytes}\approx u\cdot A + \text{ChunkMetaBytes}+M
\]

For example, with 4 MiB chunks and 32-byte hashes, metadata overhead is tiny compared with a 0.8–1.4 GB model, while resume capability remains practical. The public TinyRustLM UI and docs already emphasize manifests, receipts, checksums, and P2P proofs, so chunk-hash design is aligned with the public product direction. citeturn39view0turn40view0

## Recommended `.slm` precision profiles

The safest way to read these profiles is as **public-contract recommendations** for a future inspectable `.slm` family, not as claims about private TinyRustLM internals. I am using a **SmolLM2-1.7B-class tied-embedding example** because its public config is straightforward and it sits inside the requested 0.5B–2B range. Publicly, that model has `hidden_size = 2048`, `num_hidden_layers = 24`, `vocab_size = 49152`, and tied word embeddings. citeturn32view1

For this example, the major tensor-class parameter counts are:

- tied token embedding / LM head: 100,663,296
- each of q, k, v, o projections: 100,663,296
- each of gate, up, down MLP projections: 402,653,184
- all norms combined: 100,352

The table below assumes a simple `q*_0`-style 32-weight block with a 2-byte scale, so `q8 = 1.0625`, `q6 = 0.8125`, `q5 = 0.6875`, `q4 = 0.5625`, and `q3 = 0.4375` bytes per weight. That gives **expected artifact bytes**, not a promise of behavioral quality. Quality must still be earned by parity tests.

### Precision profile table

| Tensor class | Ultra-compact | Balanced | Quality |
|---|---:|---:|---:|
| Tied token embedding / LM head | q6 → **78 MB** | q8 → **102 MB** | fp16 → **192 MB** |
| q projections | q4 → **54 MB** | q5 → **66 MB** | q6 → **78 MB** |
| k projections | q4 → **54 MB** | q5 → **66 MB** | q8 → **102 MB** |
| v projections | q4 → **54 MB** | q5 → **66 MB** | q8 → **102 MB** |
| o projections | q4 → **54 MB** | q5 → **66 MB** | q6 → **78 MB** |
| gate projections | q3 → **168 MB** | q4 → **216 MB** | q5 → **264 MB** |
| up projections | q3 → **168 MB** | q4 → **216 MB** | q5 → **264 MB** |
| down projections | q3 → **168 MB** | q4 → **216 MB** | q5 → **264 MB** |
| all norms | fp16 → **0.19 MB** | fp16 → **0.19 MB** | fp16 → **0.19 MB** |
| **Core weight total** | **798.2 MB** | **1014.2 MB** | **1344.2 MB** |
| Suggested outlier residual budget | **0–16 MB** | **0–12 MB** | **0–8 MB** |
| Suggested tokenizer + manifest + loader budget | **4–10 MB** | **4–10 MB** | **4–10 MB** |
| Recommended KV default | **INT8 or Q4** | **INT8 or Q4** | **FP16 or INT8** |
| Typical target device | **desktop + careful mobile** | **desktop default** | **desktop only** |

These priorities follow from the literature and the runtime constraints. Norms stay at FP16 or higher. The tied embedding/head stays materially above the body because it affects both token semantics and final logits. The MLP body absorbs the most aggressive compression because it dominates bytes. The quality profile protects K/V more than the other attention projections because attention under-constrains conversation quality faster than many byte-only dashboards reveal. citeturn25view0turn15view0turn14view0

### What each profile is for

**Ultra-compact** is for the case where local storage or RAM is tight and the model must still carry a recognizable instruction personality. It is acceptable only if the parity suite shows intact turn-following and low refusal drift. If free-generation divergence becomes obvious, the first remediation should be a tiny sparse residual sidecar on flagged channels before globally uplifting the whole model. citeturn13view2turn16view0

**Balanced** is the recommended default. It stays within roughly one gigabyte for a SmolLM2-class 1.7B base, keeps embeddings/head at q8, and avoids pushing the entire MLP body into q3. For browser-local conversation, this is the best first target. It is also the easiest profile to replicate deterministically across CPU SIMD, WASM SIMD, and later WebGPU kernels. citeturn42view0turn27view2turn27view0

**Quality** is the desktop profile. It assumes that preserving the tied embedding/head at FP16 is worth the extra ~90 MB over q8 for this model class, and that K/V should remain at q8 because attention drift is often more damaging than MLP drift in multi-turn chat. This profile should be the benchmark source for down-slicing and for first-token parity reference within the browser runtime. citeturn25view0turn18view2

### Hard rejection criteria

A profile should be **rejected**, even if it is smaller, if any of the following occur:

- artifact fails structural validation, checksum validation, finite-value validation, or tokenizer drift validation;
- first-token top-5 retention against the BF16 source falls below the profile gate;
- average teacher-forced KL exceeds the gate for the target budget;
- multi-turn state tracking or lawful-adult response quality visibly breaks;
- quantized adapter merge passes structure but fails parity;
- corruption and truncation tests do not fail closed.

A practical gate set is:

| Profile | Max \(\Delta\)PPL | Max avg teacher-forced KL | Min behavior-gate pass rate |
|---|---:|---:|---:|
| Ultra-compact | 10% | 0.04 nats/token | 90% |
| Balanced | 6% | 0.02 nats/token | 95% |
| Quality | 3% | 0.01 nats/token | 98% |

These are operational recommendations, not claims from any one paper.

### Machine-readable tensor precision table

```json
{
  "artifact_family": "generic_slm_mixed_precision_vnext",
  "example_model_class": "SmolLM2-1.7B-like tied-embedding dense decoder",
  "block_quantizer_assumption": {
    "block_size": 32,
    "scale_bytes": 2,
    "bytes_per_weight": {
      "fp16": 2.0,
      "q8_0": 1.0625,
      "q6_0_style": 0.8125,
      "q5_0_style": 0.6875,
      "q4_0": 0.5625,
      "q3_0_style": 0.4375
    }
  },
  "profiles": {
    "ultra_compact": {
      "tok_embed_lm_head_tied": "q6_0_style",
      "q_proj": "q4_0",
      "k_proj": "q4_0",
      "v_proj": "q4_0",
      "o_proj": "q4_0",
      "gate_proj": "q3_0_style",
      "up_proj": "q3_0_style",
      "down_proj": "q3_0_style",
      "norms": "fp16",
      "kv_cache_default": "int8_or_q4",
      "outlier_residual_budget_mb": 16,
      "meta_budget_mb": 10
    },
    "balanced": {
      "tok_embed_lm_head_tied": "q8_0",
      "q_proj": "q5_0_style",
      "k_proj": "q5_0_style",
      "v_proj": "q5_0_style",
      "o_proj": "q5_0_style",
      "gate_proj": "q4_0",
      "up_proj": "q4_0",
      "down_proj": "q4_0",
      "norms": "fp16",
      "kv_cache_default": "int8_or_q4",
      "outlier_residual_budget_mb": 12,
      "meta_budget_mb": 10
    },
    "quality": {
      "tok_embed_lm_head_tied": "fp16",
      "q_proj": "q6_0_style",
      "k_proj": "q8_0",
      "v_proj": "q8_0",
      "o_proj": "q6_0_style",
      "gate_proj": "q5_0_style",
      "up_proj": "q5_0_style",
      "down_proj": "q5_0_style",
      "norms": "fp16",
      "kv_cache_default": "fp16_or_int8",
      "outlier_residual_budget_mb": 8,
      "meta_budget_mb": 10
    }
  }
}
```

## Deterministic Rust conversion contract

The public TinyRustLM docs already point toward the right contract boundaries: strict validation, bounded parsing, checksums, manifest thinking, adapter preflight, and provenance. A generic 0.5B–2B conversion architecture should keep those **public-contract values** while staying implementation-agnostic. citeturn40view0turn41view0

### Generic architecture

**Ingest.** Accept only trusted tensor sources such as `safetensors`. Public Safetensors docs and repo state that the format stores tensor data safely without arbitrary code execution and supports near zero-copy reads on supported paths. In a Rust converter, parse only the header and tensor descriptors first, then build an allowlist of expected names and shapes before touching payload bytes. citeturn34search17turn34search0turn34search2

**Audit.** For every allowed tensor, verify:

- declared shape matches expected architecture,
- byte range fits inside file bounds,
- dtype is allowed,
- payload is finite,
- no duplicate tensor names,
- no hidden extras outside policy.

Then run the finite/range audit and outlier-map pass described earlier.

**Convert.** Stream one tensor at a time. For each tensor:

1. map or read bounded slices,
2. compute per-group statistics,
3. quantize with a deterministic rule,
4. optionally emit high-precision residual sidecars for flagged channels,
5. compute tensor hash on the emitted bytes,
6. append directly to the output artifact or chunk store.

No full-model materialization. No “load everything, then sort it out” phase.

**Validate.** After conversion, run a parity harness against the original model with fixed seeds, fixed prompts, fixed calibration hash, and fixed decode settings. For randomized-Hadamard or codebook methods, record every seed or sign pattern in the manifest.

**Emit.** Output should be atomic: write to a temporary target, fsync where available, then rename or commit a final immutable directory/manifest. On interruption, resume from chunk receipts instead of starting over.

### Stable public artifact contracts

A future large-model `.slm` contract should expose, at minimum:

- artifact version,
- architecture id,
- tensor directory,
- tensor class tags,
- per-tensor dtype/quantizer id,
- shape,
- byte offset or chunk list,
- scale layout description,
- tokenizer manifest,
- calibration hash,
- parity-suite checksum,
- conversion-tool version,
- source checksum,
- adapter compatibility ids.

This is more important than inventing a clever codec name.

### CPU SIMD, WASM, and WebGPU kernel order

The kernel roadmap should be conservative.

**First**, implement:

- FP16/FP32 norm and residual kernels,
- q8 dot and q6/q5/q4 unpack-dot kernels,
- simple fused dequant + matvec paths,
- INT8 or Q4 KV-cache dequant,
- deterministic sampler kernels.

Public browser docs show WASM is broadly available, WASM SIMD has wide support across modern browsers, and WebGPU is now available in major browsers, but support still varies by platform, with Linux and some device classes still catching up in the public status pages. citeturn12search0turn27view2turn27view0turn27view1

**Second**, add WebGPU compute for the same simple formats. Public ecosystem sources already note that ONNX Runtime and Transformers.js use WebGPU for local browser inference, which is exactly why it is worth building a portable layout first and an exotic quantizer second. citeturn27view0

**Third**, only after the above is stable, consider special runtimes for:

- sparse residual execution,
- vector-codebook decode,
- trellis/codebook quantizers,
- HIGGS-style non-uniform codebooks.

### Phased implementation plan

| Phase | Deliverable | Go / no-go condition |
|---|---|---|
| **Foundation** | Strict safetensors ingest, bounded converter, q8/q6/q5/q4 mixed-precision emission, parity suite, OPFS import/export | No-go if first-token parity or corruption tests fail. |
| **Conversation-ready** | Budget search, per-tensor uplift, KV INT8/Q4, behavior-gate harness, adapter sidecars | No-go if multi-turn state or lawful-adult answers regress. |
| **Distribution-ready** | Chunked artifact directory, immutable manifests, resume receipts, P2P dedup and proof flow | No-go if truncated or reordered chunks can bypass validation. |
| **Acceleration-ready** | WebGPU kernels for the same simple formats, streaming layer scheduler, lower transient RAM path | No-go if CPU and WebGPU outputs diverge beyond deterministic tolerance. |
| **Research branch** | Optional sparse residuals, HIGGS/QTIP-like experimental decode, sliceable parent artifacts | No-go unless gains clearly beat the balanced profile on byte-for-behavior efficiency. |

## Update ledger and confidence

### Update ledger

- **TinyRustLM public product context:** main site, `.slm` docs, quantization docs, and adapter docs all reflect **site package 1.5.0**, updated **2026-07-02T00:12:07Z** in the public developer portal pages. citeturn40view0turn41view0turn42view0
- **Browser capability checks:** MDN, W3C, Chrome Developers, and web.dev sources were checked against pages dated between **2025-08-11 UTC** and **2026-06-23 UTC**, plus current compatibility tables for Wasm SIMD and current browser status articles for WebGPU. citeturn27view0turn27view1turn27view2turn26search8turn35search1
- **Method literature:** the comparison includes public primary sources or official repos for GPTQ, AWQ, HQQ, SqueezeLLM, SpQR, AQLM, PV-Tuning, QuIP, QuIP#, QTIP, YAQA, SmoothQuant, OmniQuant, KIVI, KVQuant, BitNet, OneBit, LeanQuant, AutoRound, and MatGPTQ, including current public successors through **2026** where official evidence was available. citeturn18view0turn15view0turn14view0turn13view2turn16view0turn16view2turn19search6turn19search5turn23view0turn23view1turn20view0turn16view3turn33search0turn33search1turn37search0turn37search7turn25view1turn13view3turn18view2

### Confidence labels

- **High confidence:** public TinyRustLM black-box facts; public browser API availability; public licenses explicitly shown on official repos; public architecture facts from model configs. citeturn40view0turn41view0turn42view0turn27view0turn27view1turn27view2turn31view0turn32view1
- **Medium confidence:** qualitative portability judgments about which methods are realistically implementable in portable Rust, because those judgments are informed by public operator structure, kernel assumptions, and codebase complexity rather than by a single official benchmark. citeturn18view0turn15view0turn14view0turn17view0turn23view0turn36search15
- **High confidence negative claim:** there is **no public basis** to claim TinyRustLM private conversion logic, private `.slm` internals beyond the documented contract, or unpublished parity results. The public docs are intentionally narrower than that. citeturn39view0turn40view0

The bottom-line recommendation is therefore high-confidence at the architectural level: **ship a transparent, deterministic, chunked, mixed-precision blockwise `.slm` family first; treat exotic quantization methods as offline search or second-wave runtime research; and make KV-cache policy a first-class part of profile design, because architecture choice can dominate the memory story once the conversation gets long.** citeturn25view0turn33search0turn33search1turn32view1turn31view0
# TinyRustLM .slm and WASM Footprint Architecture

## What the public evidence shows

Public TinyRustLM and MiRust material already gives a clear baseline. TinyRustLM is presented as a browser-local Rust/WASM runtime with local `.slm` import, Hugging Face metadata discovery, and a P2P import path driven by MiniModel metadata rather than project-hosted model bytes. Public implementation notes say the browser currently fetches the **entire** `.slm`, allocates an equal-size WASM buffer, copies all bytes into linear memory, and then calls `load_model`. The same public docs also say the current runtime is scalar CPU, single-model, main-thread, full-file fetch/copy, with no persistent model store, no range requests, no sharding, no resume, no eviction, and no browser SHA-256 admission check. That is the precise bottleneck to remove. citeturn18search2turn31search3turn36search0turn36search2

The current public `.slm` contract is also unusually explicit. MiRust documents a fixed 108-byte SLM1 header, a 64-byte tensor directory entry format, 64-byte tensor-data alignment, BTOK and BPE1 embedded tokenizers, a tied-output flag, and q8_0 and q4_0 quantized tensor paths. Public implementation notes further document that current scratch sizing is `4 × (10 × hidden_size + 3 × ffn_size + max_context)` bytes, and current KV sizing is `2 × layers × max_context × kv_heads × head_dim × 4` bytes because the present runtime uses `f32` KV storage. citeturn30search2turn31search3turn39view0turn39view2turn34search0

Public TinyRustLM assets are already small enough that the runtime code is not the real footprint problem. The public site index shows a `tinyrustlm_web_bg.wasm` around 114 KB plus a small manifest and JS bundle, while the bottleneck is model admission and runtime memory duplication rather than the WASM binary itself. citeturn9view4

MiniModel already carries the trust and piece-addressing primitives needed for a proper browser artifact pipeline. Its public catalog entries include artifact SHA-256, a chunk algorithm named `sha256-merkle-v0`, a chunk size of 1,048,576 bytes, a chunk count, and a Merkle root; the public share-metadata example also includes chunk rows with SHA-256 entries and a Merkle root. Public MiniModel pages are explicit that the project does not host model bytes or run inference server-side. citeturn13view1turn13view3turn12view0

That combination strongly suggests the right architecture: keep the code path browser-local, keep the artifact self-contained, but stop doing “fetch full file → duplicate full file → validate full file → materialize full file.” Instead, make the artifact piece-addressed, verifiable in-stream, directly writable into final storage and final WASM arenas, and optionally pageable when memory pressure requires it. That direction also fits the project’s own public “next gate” language around worker ownership and verified persistent storage. citeturn36search2turn40view1

## SLM ABI proposal

### Versioning model

I recommend a **two-track ABI**:

- **SLM1** remains supported exactly as-is for today’s TinyRustLM artifacts.
- **SLM2** becomes the production container for paging, sharding, Merkle verification, richer quantization layouts, sparse residuals, and tokenizer compaction.

That is the safest meaning of “backward-compatible evolution.” New readers accept both SLM1 and SLM2. Old SLM1 readers continue to accept old files. Files that use new layouts do **not** try to masquerade as SLM1, because the current public implementation has tightly scoped loader assumptions and a legacy “custom checksum” that is explicitly non-cryptographic. Clean rejection is better than accidental misload. citeturn30search2turn36search0

### Header strategy

SLM2 should preserve the **semantic shape** of the current front matter so conversion is easy, but it should change the magic/version so older loaders reject safely. The current SLM1 prefix already proves the project values fixed offsets and compact loader code, so SLM2 should keep that design discipline rather than switching to a schema-heavy container. citeturn30search2

A practical SLM2 header is:

```rust
/// Fixed-size, little-endian SLM2 header.
/// Alignment rule: header starts at file offset 0 and is padded to 128 bytes.
#[repr(C)]
pub struct Slm2Header {
    pub magic: [u8; 4],          // b"SLM2"
    pub abi_major: u16,          // 2
    pub abi_minor: u16,          // 0
    pub header_len: u32,         // >= 128
    pub flags: u64,              // feature bits; unknown required bits => reject

    // Core model shape, kept near current SLM1 semantics
    pub vocab: u32,
    pub layers: u32,
    pub heads: u32,
    pub kv_heads: u32,
    pub head_dim: u32,
    pub ffn: u32,
    pub max_context_declared: u32,
    pub rope_theta_f32_le: u32,  // bitwise f32
    pub rms_eps_f32_le: u32,     // bitwise f32

    // Directory and tokenizer
    pub tensor_dir_off: u64,
    pub tensor_count: u32,
    pub tensor_desc_size: u16,   // 128 in v2.0
    pub piece_table_off: u64,
    pub piece_count: u32,
    pub shard_table_off: u64,
    pub shard_count: u32,

    pub tokenizer_off: u64,
    pub tokenizer_len: u64,

    // Identity and integrity
    pub artifact_len: u64,
    pub artifact_sha256: [u8; 32],
    pub merkle_root_sha256: [u8; 32],

    // Optional compatibility/debug field for converters
    pub legacy_checksum64: u64,

    pub reserved: [u8; 8],
}
```

The exact rules should be:

- all scalar integers are little-endian;
- `header_len` is 128-byte aligned;
- directory tables are 16-byte aligned;
- tensor payload offsets are 64-byte aligned;
- shard starts are 4 KiB aligned;
- piece boundaries are fixed-size, default 1 MiB, and need not match tensor boundaries;
- every descriptor’s `offset + length` is checked with overflow-safe arithmetic before any allocation or slice creation. That matches the risk areas public MiRust docs already call out for parser fuzzing. citeturn37view0turn24search0turn24search4

### Tensor descriptors and directory evolution

The current SLM1 “64-byte tensor directory” should evolve into a richer SLM2 tensor table, but the **logical directory model** should remain the same: one row per tensor-like object, one stable name/role, one payload reference, and one declared layout. citeturn30search2

```rust
/// Alignment rule: 16-byte aligned table rows; payloads remain 64-byte aligned.
#[repr(C, align(16))]
pub struct TensorDescV2 {
    pub name_id: u32,            // interned string id
    pub role: u16,               // embedding, q_proj, k_proj, v_proj, o_proj, etc.
    pub dtype: u16,              // f16, bf16, q8_r128, q6_g64, q5_g64, q4_g64, sparse...
    pub layout: u16,             // dense, alias, sparse_residual, external_piece_map
    pub scale_encoding: u16,     // none, fp16, bf16, e8m0_log2, u8_log_scale
    pub flags: u32,              // tied, optional, entropy_compressed_piecewise, etc.

    pub rank: u8,
    pub dim_count: u8,
    pub reserved0: u16,
    pub dims: [u32; 6],          // enough for current transformer weights

    pub logical_nbytes: u64,     // uncompressed logical byte size
    pub data_off: u64,           // 0 if alias/external
    pub data_len: u64,           // physical bytes in artifact or shard

    pub aux_off: u64,            // scales metadata, sparse row_ptr, etc.
    pub aux_len: u32,
    pub alias_of: u32,           // index of aliased tensor if layout == alias

    pub first_piece: u32,
    pub piece_count: u32,

    pub tensor_sha256_trunc128: [u8; 16], // quick per-tensor identity
}
```

This format solves the main evolution problem. SLM1 needed “tensor directory evolution”; SLM2 gets it by making tensor descriptors self-describing enough that grouped quantization, sparse residuals, aliases, and piece tables no longer need hidden per-dtype assumptions.

### Piece and shard metadata

MiniModel’s public catalog already treats 1 MiB Merkle chunks as a first-class concept, so SLM2 should adopt the same piece scale by default. That gives alignment between HTTP range loading, known-peer P2P, local verification, and on-disk persistence. citeturn13view1turn13view3

```rust
#[repr(C)]
pub struct PieceDesc {
    pub piece_index: u32,
    pub shard_index: u32,
    pub file_off: u64,
    pub stored_len: u32,         // compressed or raw
    pub logical_len: u32,        // uncompressed
    pub sha256: [u8; 32],
}

#[repr(C)]
pub struct ShardDesc {
    pub shard_index: u32,
    pub kind: u16,               // local file, http shard, p2p shard
    pub codec: u16,              // none, zstd_seekable, brotli_piece
    pub artifact_family: u32,    // for routing/compat
    pub shard_len: u64,
    pub shard_sha256: [u8; 32],
}
```

The important rule is that **pieces are the verification and resume unit**, while shards are the transfer and file-layout unit. A single-file `.slm` may have one shard and many pieces. A `.slmset` may have many shards and the same piece size. That separation keeps resume simple without forcing every tensor or every shard to be a paging unit.

## Quantization and tokenizer layout

### Grouped quantization that is small and still fast

Public MiRust docs already show the current runtime has q8 row scales and q4 block scales, and the public performance notes correctly identify matrix-vector bandwidth as the dominant cost. For TinyRustLM’s size class, the best production move is not exotic quantization first; it is **SIMD-friendly grouped quantization with predictable scale overhead**. citeturn38search6turn35search0

I recommend these default storage layouts:

| Layout | Superblock | Groups | Scale encoding | Effective bits/weight | Notes |
|---|---:|---:|---|---:|---|
| `Q8_R128_SF16` | 128 weights | 1 × 128 | 1 fp16 scale | 8.125 | Fast fallback and high-quality head/embedding choice |
| `Q6_G64_SF16_B256` | 256 weights | 4 × 64 | 4 fp16 scales | 6.25 | Good “sensitive tensor” default |
| `Q5_G64_SF16_B256` | 256 weights | 4 × 64 | 4 fp16 scales | 5.25 | Best all-around desktop choice |
| `Q4_G64_SF16_B256` | 256 weights | 4 × 64 | 4 fp16 scales | 4.25 | Smallest practical default |
| `Q8_KV64_SF16` | 64 KV elements | 1 × 64 | 1 fp16 scale/vector | ~8.25 | q8 KV cache path |

These layouts are deliberately boring. Group size 64 is a good compromise: much better fidelity than coarse per-row scaling, still easy to decode with portable SIMD lanes, and its metadata overhead is modest. The effective bit rates above are my engineering calculations for these exact layouts. The broader design follows the same weight-only low-bit direction as GPTQ and AWQ, both of which are aimed at preserving accuracy under low-bit inference. citeturn41search3turn41search6

### Mixed q4, q5, and q6 precision

For useful browser inference, I would not ship a uniform q4 for every tensor. AWQ reports that protecting a small fraction of salient weights materially reduces error, and GPTQ shows 3–4 bit post-training quantization can remain accurate when the reconstruction is done carefully. Public TinyRustLM also already supports tied output projection, which means the embedding / LM head path deserves special care because a single matrix participates in both prompt embedding and output logits. citeturn41search6turn41search3turn34search0

A practical mixed profile for SLM2 is:

- **q6** for token embeddings / tied LM head, attention output projections, and final MLP down-projections;
- **q5** for Q/K/V projections and MLP up/gate tensors;
- **q4** for the least sensitive dense layers or mobile-constrained packs.

That normally lands near **4.8 effective bits/weight** with much better output quality than “all q4,” while still keeping the 135M–500M class comfortably browser-local. This is an engineering extrapolation from outlier-aware and salient-channel-aware work, not a claim that one exact profile is universally optimal. citeturn41search6turn41search0turn41search4

### Per-channel, per-group, and block scale encodings

The runtime should support three scale granularities, each with a narrow purpose:

- **per-channel** scales for norms and a few calibration-heavy tensors;
- **per-group** scales as the default for dense q4/q5/q6 weights;
- **per-block** scales for q8 rows and q8 KV vectors.

The default scale encoding should be **fp16** because it is compact, cheap to decode, and friendly to both CPU SIMD and WebGPU kernels. An optional **`e8m0` log-scale** mode is worth adding for KV cache and some mobile-first packs where multiply-by-power-of-two or exponent reconstruction is cheaper than wider metadata, but it should not be the general default. This recommendation is driven by browser throughput and decode simplicity, not by model-quality theory alone. The public MiRust docs already separate q8 row scales and q4 block scales, which is the right general shape. citeturn38search6turn35search0

### Outlier tensors and sparse residuals

LLM.int8 explains why outlier features break naive low-bit quantization, and its mixed-precision decomposition isolates those outlier dimensions into a higher-precision path while keeping the vast majority of values in 8-bit. SpQR pushes the same idea further by isolating outlier weights into a sparse higher-precision representation while compressing the rest of the matrix to 3–4 bits. Those two papers together strongly support adding an **optional residual tensor** to the `.slm` ABI rather than trying to solve every quality loss inside one monolithic q4 block format. citeturn41search5turn41search9turn41search4

The SLM2 rule should therefore be:

- dense base tensor in q4/q5/q6;
- optional sparse residual in CSR form;
- residual values stored in fp16 or q8;
- residual row pointers grouped by output row so matvec can “dense dot + sparse fixup” without a second full pass.

```rust
#[repr(C)]
pub struct SparseResidualHeader {
    pub format: u16,             // 1 = CSR
    pub value_dtype: u16,        // fp16 or q8
    pub rows: u32,
    pub cols: u32,
    pub nnz: u32,
    pub row_ptr_off: u64,        // u32[rows + 1]
    pub col_idx_off: u64,        // u16 or u32[nnz]
    pub values_off: u64,         // packed values
}
```

The production rule should be conservative: only emit residuals for tensors whose calibration loss exceeds a threshold, and cap residual density tightly, for example below ~1.5%. Above that level, a denser q5 or q6 base tensor is usually a better browser tradeoff.

### Tied embeddings

Public SmolLM2 and Qwen configs both declare `tie_word_embeddings: true`, and public TinyRustLM documentation already has a tied-output flag where `output.weight` can be omitted and logits can use `tok_embeddings.weight`. That is exactly the right default for small browser models, because it removes a second large vocab-sized matrix from the artifact and from resident memory. citeturn21view0turn21view3turn21view6turn34search0

The SLM2 rule should be explicit: the LM head is not “special”; it is just an alias descriptor when tied. This matters for paging too, because a tied matrix is simultaneously the embedding source and the output projection source. That means tied embeddings save bytes, but they also make **LM-head paging** a throughput risk, since output projection still has to scan the vocabulary rows every decode step. In practice, that is why full-resident weights are still the default for the 135M–500M class, and layer paging should be a fallback rather than the first choice.

### Tokenizer compression

Public TinyRustLM docs show that BTOK is tiny and deterministic, while BPE1 currently stores variable token records and fixed merge records and uses repeated scans that the docs themselves call a scaling issue. A production tokenizer section cannot keep that algorithmic shape. citeturn30search0turn32view1

I recommend replacing BTOK/BPE1 with **TOK2**:

- `BTOK` remains supported for smoke fixtures.
- `BPE1` remains supported for migration.
- `TOK2` becomes the compact production format.

`TOK2` should use:

- front-coded token byte blocks for `id -> bytes`;
- a compact `bytes -> id` hash or trie index;
- a direct pair-key hash table for merge lookup;
- optional normalization tables;
- separate tokenizer SHA-256 so tokenizer identity is not inferred from model bytes alone.

That should usually cut tokenizer memory materially versus JSON import paths and eliminate repeated-scan merge discovery. It also aligns with the public MiRust requirement that production BPE needs indexed pair lookup and bounded parser allocation. citeturn32view1

### Optional entropy compression

The browser platform supports compression and decompression streams, but the default browser codecs are stream-oriented. Meanwhile, RFC 8878 is explicit that standard Zstandard format “does not attempt to allow random access,” whereas the zstd seekable format adds independently compressed frames plus a seek table precisely to enable subrange decompression. citeturn28search7turn29search14turn29search2

That leads to one simple rule:

- **never entropy-compress the whole artifact as one stream** if you want HTTP Range, P2P piece exchange, local repair, or weight paging;
- only allow **piecewise independent compression**, where every 1 MiB piece is its own compressed frame or every shard has a seek table.

So SLM2 should permit `codec = none | zstd_seekable | brotli_piece`, but only at the **piece or shard layer**, never for the artifact as one undifferentiated blob. Random-access weights complicate entropy compression because inference wants direct access to layer tensors and sometimes to individual row ranges, while whole-stream compression forces “decompress from the start” behavior or an oversized decompression window. That is the opposite of bounded browser memory.

## Loading, verification, and persistence

### The right loader architecture

The browser loader should be unified across three ingress paths:

- **HTTP Range** for ordinary downloads;
- **known-peer HTTP piece fetch** for MiniModel P2P;
- **local file slices** for user-provided files.

HTTP range requests are specifically meant for partial resource access and resumable downloads. MiniModel already publishes piece metadata and Merkle roots. Browser OPFS provides worker-friendly local file persistence, and the OPFS sync access handle is specifically documented as higher-performance and suitable for WebAssembly-style workloads inside dedicated workers. IndexedDB remains useful for metadata, journals, and compatibility records, but OPFS is the right byte store for chunked or transformed artifacts. citeturn24search0turn24search4turn24search8turn13view1turn25search0turn25search4turn25search8turn25search1turn40view1

### Persistence rule

Use **OPFS for bytes, IndexedDB for metadata**.

That split is the smallest practical production choice because:

- OPFS supports straightforward offset-based file writes and worker-local sync access handles;
- IndexedDB is strong for manifests, install state, chunk bitmaps, last-good ABI records, and crash journals;
- public MiRust design notes already point in this direction by calling Cache API suitable for immutable HTTP responses and OPFS suitable for chunked or locally transformed files. citeturn25search0turn25search23turn25search1turn40view1

### Admission and verification state machine

The loader should run this state machine for every HTTP, P2P, or local import:

| State | Action | Persistent write | Failure action |
|---|---|---|---|
| `Discover` | Read catalog / local metadata / file length | none | reject |
| `Plan` | Build piece map, shard map, target file layout | IndexedDB intent row | clear intent |
| `StageTemp` | Create OPFS temp file and chunk bitmap | temp file + bitmap | delete temp |
| `FetchPiece` | Range / peer / local slice read one piece | append/write at offset | retry / backoff |
| `VerifyPiece` | SHA-256 piece check, optional Merkle row | bitmap + piece receipt | mark bad piece |
| `PersistPiece` | Flush piece to temp OPFS file | temp file durable | keep bitmap state |
| `FinalizeArtifact` | Verify total bytes, verify artifact SHA-256, verify manifest signature/policy | checksum receipt | quarantine temp |
| `StructuralValidate` | Parse header, tokenizer, directory, dtype/layout rules | compatibility receipt | quarantine temp |
| `Promote` | Atomic inventory pointer swap from temp to active | active record | preserve last-good |
| `Activate` | Reserve WASM arenas and stream/install resident view | runtime state | keep active artifact offline |
| `Ready` | Generation permitted | run ledger | n/a |

This is the same shape that public MiRust notes already recommend for a “verified persistent model store”: download to a temporary key with resumable chunk evidence, verify bytes and SHA-256, verify manifest and policy, run structural validation, then atomically promote to active inventory. citeturn40view0turn40view1turn40view2

### Crash-safe interrupted-download recovery

Interrupted-download recovery should be **piece-ledger based**, not stream-position based. The journal in IndexedDB needs only these fields:

- artifact identity = immutable artifact SHA-256 plus format version / tokenizer identity / quantization;
- temp OPFS path;
- piece bitmap;
- piece SHA receipts;
- current Merkle frontier or completed piece count;
- manifest verification status;
- structural-validation status;
- active pointer generation.

On restart, the loader reads the journal, reopens the temp OPFS file, verifies any uncertain tail pieces, and resumes missing pieces only. This follows public MiRust guidance that installed, resident, and active state should be tracked separately and that rollback packets must preserve hashes, compatibility records, and the last accepted artifact state. citeturn40view1turn39view1

### Direct writes into WASM linear memory

WASM linear memory can be written directly from JS via typed-array views, but `WebAssembly.Memory.grow()` detaches old buffers and forces new array views. Therefore the loader must **reserve exact model memory before streaming any bytes into resident arenas**. After that, it must not grow linear memory during the admit/write/install phase. citeturn26search0turn26search1turn26search2

The production pattern is:

```rust
/// Returns the exact byte ranges needed for the resident runtime.
/// After this call, JS must pre-grow wasm memory once and never grow it again
/// until activation finishes.
fn plan_resident_layout(header: &Slm2Header, tensors: &[TensorDescV2]) -> ResidentPlan {
    // compute exact offsets for weights, tokenizer, KV, scratch, logits
    // all offsets checked for overflow and 64-byte alignment
}

/// Called once JS has copied verified bytes into their final resident offsets.
fn finalize_activation(plan: &ResidentPlan) -> Result<ModelHandle, ActivateError> {
    // reinterpret resident spans, validate hashes/layout ids, publish runtime atomically
}
```

And on the JS side:

```rust
// Pseudocode, Rust-shaped for readability
fn stream_piece_into_wasm(
    wasm_memory: &js_sys::WebAssembly::Memory,
    dst_off: usize,
    piece: &[u8],
) {
    // Recreate the Uint8Array view after any grow; do not cache across growth.
    // Production rule: there should be no grow here because plan_resident_layout
    // must have reserved final capacity already.
    // Copy piece bytes directly to final destination.
}
```

That removes the duplicate “whole artifact in JS heap + whole artifact in WASM heap” pattern that public TinyRustLM currently documents. citeturn31search3turn26search0turn26search2

### Bounded decompression buffers

When piece compression is enabled, decompression must also be piece-bounded:

- max compressed piece: e.g. 1 MiB;
- max logical piece: e.g. 1 MiB or 2 MiB;
- decompression workspace bounded by codec policy;
- reject any piece whose declared logical size exceeds the piece policy before decoding.

That protects the browser from zip-bomb-like behavior and preserves predictable memory during admission. It also keeps compression compatible with HTTP Range and P2P receipt verification.

## Execution architecture and memory budgets

### Runtime topology

The smallest practical production runtime for the 135M–500M class is **worker-owned, full-resident by default, paged when budgets demand it**.

Public MiRust notes already say worker ownership and verified persistent storage are the next operational milestones, and public browser APIs reinforce that direction: OPFS sync handles are worker-only, `SharedArrayBuffer` availability depends on cross-origin isolation, and thread-sharing needs cross-origin isolation plus the right COOP/COEP posture. citeturn36search2turn25search0turn27search2turn27search5turn27search13turn27search17turn27search25

The production stack should be:

- **Dedicated Worker** owns model install, generation loop, OPFS access, and cancellation.
- **WASM SIMD** is the default CPU backend. WebAssembly exposes SIMD `v128` and related instructions, and public MiRust docs identify CPU vectorization as a top optimization order item. citeturn27search4turn27search16turn26search11turn35search0
- **WASM threads** are optional when the page is cross-origin isolated and the device is clearly desktop-class. Small-model decode is frequently bandwidth-bound, so threads help most in prefill and row-tiled output projection, not in every token loop. citeturn27search2turn27search5turn27search13turn27search17
- **WebGPU matmul** is optional and only worth dispatching for large dense projections or batched prefill. The WebGPU API explicitly exists for high-performance GPU compute, but WebGPU startup cost and buffer management mean it should be used selectively, not as a mandatory baseline. citeturn27search6turn27search3

### Layer-at-a-time execution and weight paging

For the stated size range, the right default is still **resident quantized weights**. Paging every transformer layer out of OPFS or over HTTP is possible, but the decode loop still needs repeated LM-head work, and tied embeddings mean the same matrix is needed for both token lookup and vocab logits. Public TinyRustLM forward-pass docs confirm a final output projection on every token, which is exactly why full paging becomes a throughput problem. citeturn34search2turn34search0

So the runtime should have two modes:

- **Resident mode** for desktop and higher-memory devices: keep all quantized weights in resident WASM memory after verified activation.
- **Paged mode** for tight mobile budgets: keep a small layer window resident, stream layers from OPFS on demand, and tile the LM head in vocab chunks. This mode is a survival path, not the fast path.

Paged mode still needs strict policy:

- prefetch next layer while current layer runs;
- keep a two-layer ring buffer;
- tile LM head in 4–16 MiB vocab slices;
- never page KV; keep active-window KV resident;
- expose a clear “low-memory mode” perf warning in UI.

### KV cache policy and bounded context

Public MiRust currently documents `f32` KV and no sliding or paged cache. That is too expensive for production. The SLM2 runtime should add **q8 KV** with fp16 per-vector scales and make **sliding-window context** a first-class runtime policy. Public performance docs already note that attention work grows with active context, and public Qwen2 configs explicitly include sliding-window-related fields even though the specific model config shown has `use_sliding_window: false`. citeturn36search0turn35search0turn21view6turn21view7

The production rule should be:

- desktop default active window: **2048** tokens;
- mobile default active window: **1024** tokens;
- q8 KV by default beyond 512 tokens;
- optional fp16 KV only for highest-quality desktop mode;
- if fp16 KV is retained, KV memory is about **1.94×** the q8-KV path for these head dimensions; fp32 KV is about **3.88×** q8-KV. Those multipliers are my calculations from the public MiRust KV formula and the proposed q8-KV scale scheme. citeturn39view2

### Quantized kernel pseudocode

A portable grouped-low-bit dot kernel should decode 64-weight groups into SIMD-friendly lanes, accumulate into `i32`, then scale once per group.

```rust
/// q4/q5/q6 grouped matvec.
/// Block shape: 256 weights per superblock, 4 groups of 64 weights.
/// Scales are fp16 per group.
/// Alignment rule: qdata begins at a 32-byte boundary for SIMD loads.
fn dot_grouped_lowbit<const BITS: usize>(
    packed_row: &[u8],      // one row in grouped-lowbit form
    scales_f16: &[u16; 4],  // one fp16 scale per 64-weight group
    x_f32: &[f32; 256],     // activation slice
) -> f32 {
    let mut sum = 0.0f32;

    for g in 0..4 {
        let scale = fp16_to_f32(scales_f16[g]);
        let xg = &x_f32[g * 64 .. (g + 1) * 64];

        // SIMD-friendly decode path:
        // 1. load packed bytes
        // 2. unpack signed BITS-wide integers to i16/i32 lanes
        // 3. multiply with quantized/temporarily converted x lanes
        // 4. accumulate i32 / f32 partials
        let acc_int = decode_and_dot_simd::<BITS>(packed_row, g, xg);

        sum += scale * (acc_int as f32);
    }

    sum
}
```

For q8 KV, the kernel is even simpler: a vector dot in `i8 × i8` or `i8 × f16/f32` form with one scale per vector. That kernel is a clear SIMD win and a good first paging-friendly optimization for attention.

### Memory estimates

The tables below are **my calculations** using:

- representative model configs from public SmolLM2 135M, SmolLM2 360M, and Qwen2 0.5B metadata and configs;
- the public MiRust scratch formula and KV formula shape;
- a proposed **q8 KV** layout with fp16 per-vector scales;
- direct-write streaming with no duplicate full artifact in RAM;
- desktop transient overhead of 4 MiB piece buffer + 1 MiB browser stream buffer + 256 KiB verification state + 8 MiB WASM allocator/growth slack;
- mobile transient overhead of 2 MiB piece buffer + 0.5 MiB stream buffer + 256 KiB verification state + 4 MiB slack. citeturn22search0turn22search2turn21view0turn21view3turn21view6turn39view0turn39view2turn26search0turn40view1

#### Desktop budget

Assumption: all weights resident, active context window 2048, q8 KV, compressed tokenizer budget of ~1.5 MiB for 49k-vocab SmolLM2-class models and ~4 MiB for 152k-vocab Qwen2-class models.

| Model class | Quant | Model bytes MiB | Tokenizer MiB | q8 KV MiB | Activations + logits + misc MiB | Steady-state MiB | Peak MiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| 135M | q8 | 130.8 | 1.5 | 23.2 | 1.2 | 156.7 | 169.9 |
| 135M | q6 | 100.6 | 1.5 | 23.2 | 1.2 | 126.5 | 139.8 |
| 135M | q5 | 84.5 | 1.5 | 23.2 | 1.2 | 110.4 | 123.7 |
| 135M | q4 | 68.4 | 1.5 | 23.2 | 1.2 | 94.3 | 107.6 |
| 360M | q8 | 348.7 | 1.5 | 41.2 | 1.3 | 392.7 | 405.9 |
| 360M | q6 | 268.2 | 1.5 | 41.2 | 1.3 | 312.2 | 325.5 |
| 360M | q5 | 225.3 | 1.5 | 41.2 | 1.3 | 269.3 | 282.6 |
| 360M | q4 | 182.4 | 1.5 | 41.2 | 1.3 | 226.4 | 239.7 |
| 500M | q8 | 484.3 | 4.0 | 12.4 | 1.7 | 502.3 | 515.6 |
| 500M | q6 | 372.5 | 4.0 | 12.4 | 1.7 | 390.6 | 403.8 |
| 500M | q5 | 312.9 | 4.0 | 12.4 | 1.7 | 331.0 | 344.2 |
| 500M | q4 | 253.3 | 4.0 | 12.4 | 1.7 | 271.4 | 284.6 |

Because Qwen2 0.5B uses grouped-query attention with only 2 KV heads, its active-window KV footprint is much lower than the SmolLM2 360M example even though the total parameter count is larger. That is why the 500M-class rows are dominated by weights, not cache. citeturn21view6turn21view7turn21view8

#### Mobile budget

Assumption: all weights resident, active context window 1024, q8 KV, smaller transient overhead, worker-owned runtime only. This is the more realistic “good citizen” mobile profile.

| Model class | Quant | Model bytes MiB | Tokenizer MiB | q8 KV MiB | Activations + logits + misc MiB | Steady-state MiB | Peak MiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| 135M | q8 | 130.8 | 1.5 | 11.6 | 1.2 | 145.1 | 151.8 |
| 135M | q6 | 100.6 | 1.5 | 11.6 | 1.2 | 114.9 | 121.7 |
| 135M | q5 | 84.5 | 1.5 | 11.6 | 1.2 | 98.8 | 105.6 |
| 135M | q4 | 68.4 | 1.5 | 11.6 | 1.2 | 82.7 | 89.5 |
| 360M | q8 | 348.7 | 1.5 | 20.6 | 1.3 | 372.1 | 378.8 |
| 360M | q6 | 268.2 | 1.5 | 20.6 | 1.3 | 291.6 | 298.4 |
| 360M | q5 | 225.3 | 1.5 | 20.6 | 1.3 | 248.7 | 255.4 |
| 360M | q4 | 182.4 | 1.5 | 20.6 | 1.3 | 205.8 | 212.5 |
| 500M | q8 | 484.3 | 4.0 | 6.2 | 1.7 | 496.1 | 502.9 |
| 500M | q6 | 372.5 | 4.0 | 6.2 | 1.7 | 384.4 | 391.1 |
| 500M | q5 | 312.9 | 4.0 | 6.2 | 1.7 | 324.8 | 331.5 |
| 500M | q4 | 253.3 | 4.0 | 6.2 | 1.7 | 265.2 | 271.9 |

From those numbers, the practical product recommendations are straightforward. Mobile should treat **135M q4/q5** as the safe default, **360M q4** as an opt-in “bigger local model,” and **500M q4/q5** as a low-memory-mode or higher-end-device path. Desktop can comfortably support **360M q4/q5** and **500M q4/q5**, while **500M q8** should be targeted only at systems with clearly generous memory headroom.

## Compatibility, migration, and test matrix

### Compatibility rules

The migration contract should be simple:

- **Readers**: new runtime reads SLM1 and SLM2.
- **Writers**: every conversion pipeline can emit SLM1 compatibility packs or SLM2 production packs.
- **Tokenizers**: BTOK and BPE1 stay readable; TOK2 is the preferred writer target.
- **Quantization**: SLM1 remains limited to public legacy layouts; SLM2 carries q4/q5/q6 grouped layouts, sparse residuals, q8 KV metadata, and piece maps.
- **Persistence**: artifact identity is immutable content hash, never URL.
- **Rollback**: last-good runtime, last-good manifest, and last-good verified artifact are independent rollback units.

That mirrors the public MiRust rollback advice that runtime, model artifact, manifest, cache, and compatibility records each need their own version/hash identity and that immutable identities must never be overwritten in place. citeturn39view1turn40view1

### TDD, fuzzing, corruption, restart, and browser matrix

Public MiRust fuzz guidance is already well focused: header and tensor offsets, tokenizer lengths and merge references, provenance/source parsers, percent-decoded paths, and ABI pointer/length combinations. The SLM2 plan should keep those exact targets and add piece-ledger and persistence-specific properties. citeturn37view0

The minimum production matrix should include these groups:

| Area | Tests |
|---|---|
| Unit | header parse, tensor desc parse, scale decode, sparse residual decode, alias resolution, piece mapping, Merkle proof reconstruction |
| Property | pack→parse roundtrip, piece reorder rejection, quantize→dequantize tolerances, active-window truncation invariants, reset idempotence, last-good rollback stability |
| Fuzz | malformed header lengths, overlapping tensor ranges, bad Merkle rows, truncated piece tables, duplicate piece indexes, tokenizer merge loops, out-of-range alias targets |
| Corruption | single-bit piece flip, wrong piece hash, wrong shard hash, wrong artifact SHA-256, signed-manifest mismatch, stale ABI, sparse residual length drift |
| Restart | crash after piece write / before bitmap update, crash after bitmap update / before flush, crash after final hash / before promote, crash during active-pointer swap |
| Browser | Chrome, Edge, Firefox, Safari desktop; Android Chrome; iOS Safari; worker/no-worker; SIMD on/off; threads on/off; WebGPU on/off; OPFS versus IndexedDB-only fallback |
| Source lanes | local file slices, HTTP Range, MiniModel known-peer fetch, offline reload from verified store |
| Recovery | interrupted import resume, eviction with active model pinned, rollback to last-good manifest, cache invalidation after runtime downgrade |

The property that matters most is this one: **no malformed input panics, no partially written token position becomes visible, no active model is replaced until the replacement is fully verified and activated**. Public MiRust docs already encode pieces of those invariants in their parser plan and KV commit discipline notes. citeturn37view0turn39view2

## Prioritized implementation sequence

The best sequence is the one that immediately removes wasteful peak memory without forcing the runtime into a huge new complexity surface.

### First priority

Move model admission into a **Dedicated Worker** and switch from “whole-file fetch/copy” to **piece-streamed direct installation** into OPFS temp storage and final resident WASM arenas. This is the single highest-value change because it eliminates main-thread blocking and the largest avoidable duplication in public TinyRustLM’s current path. It also unlocks cancellation and better UI responsiveness before any quantization redesign. citeturn31search3turn36search2turn25search0

### Second priority

Adopt **SHA-256 artifact identity + Merkle piece receipts** end to end, using MiniModel-compatible 1 MiB pieces. Public MiniModel metadata is already there, and public MiRust docs already describe the desired admission transaction. This change gives resumability, corruption repair, and known-peer verification without requiring server trust. citeturn13view1turn13view3turn40view1

### Third priority

Introduce **SLM2** with grouped q4/q5/q6 layouts, q8 KV, tied aliases, and TOK2 tokenizer support, while keeping SLM1 readable. This is the format milestone that produces the largest long-term footprint gain without immediately forcing paging. It also gives an obvious packaging target for converter tooling. citeturn30search2turn32view1turn34search0

### Fourth priority

Add **portable SIMD kernels** for q8, q6, q5, and q4 grouped dot products, starting with prefill and LM-head tiles. Public MiRust docs already rank vectorization ahead of persistent caching in the optimization order, and the public WebAssembly SIMD surface is mature enough to justify doing this before complicated multithreading. citeturn35search0turn27search4turn26search11

### Fifth priority

Add **verified OPFS persistence** with atomic promotion, eviction policy, and restart recovery. This step should land only after the hash and manifest story is correct, because persistence without trustworthy identity turns corruption and ABI drift into a support problem. Public MiRust notes already frame this as a verified store, not just a cache. citeturn40view1turn39view1

### Sixth priority

Add **bounded sliding-window context** and **q8 KV** as the normal runtime policy. This is the simplest way to keep steady-state memory predictable on mobile and stop cache growth from overwhelming the gain from quantized weights. It also improves admission UX because the user sees an explicit runtime envelope rather than a hidden memory cliff. citeturn35search0turn36search0turn39view2

### Seventh priority

Add **selective WebGPU** for batched prefill and large dense projections, with CPU SIMD remaining the portable baseline. WebGPU is a real acceleration tool, but for the 135M–500M class it should stay optional and workload-sensitive. Shipping a good CPU backend first keeps the local footprint reasonable and reduces the browser compatibility burden. citeturn27search6turn27search3turn35search0

### Final priority

Only then add **paged execution** as a low-memory fallback. Weight paging is worth having, but it is not the fastest route to a good TinyRustLM product because tied embeddings and repeated LM-head projection make full paging expensive in token latency. Use it as an escape hatch for borderline devices, not as the center of the design. citeturn34search0turn34search2

The smallest practical production architecture for TinyRustLM is therefore:

1. **worker-owned runtime**;  
2. **SLM2 artifact with MiniModel-compatible piece receipts**;  
3. **OPFS bytes + IndexedDB metadata/journal**;  
4. **direct, pre-sized writes into final WASM memory**;  
5. **q4/q5/q6 grouped quantization with q8 KV and tied aliases**;  
6. **full-resident default for 135M–500M, paged fallback only under pressure**;  
7. **SHA-256 + Merkle verification and crash-safe atomic promotion throughout**.  

That keeps download and disk behavior piecewise and repairable, keeps memory peaks close to steady-state, and remains aligned with the public TinyRustLM and MiniModel direction rather than fighting it. citeturn18search2turn40view1turn39view1turn13view1
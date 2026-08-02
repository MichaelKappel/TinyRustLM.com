# Compression Research for a Browser-First SLM Container

## Summary

For a browser-delivered `.slm` package, the best pattern is not a single solid compressed file. The strongest prior art is self-describing tensor containers with direct offsets and alignment, such as Safetensors and GGUF, combined with HTTP range access and streaming browser APIs. Safetensors emphasizes zero-copy reads and partial tensor loading, while GGUF explicitly targets single-file deployment, extensibility, and `mmap` compatibility with aligned tensor offsets. In parallel, HTTP range requests let the client fetch only byte ranges it needs, and browser `fetch()` exposes response bodies as `ReadableStream`s. The design implication is straightforward: keep offsets stable and make every compressed unit independently decodable, rather than wrapping the model in one monolithic gzip/brotli/zstd stream. citeturn30view0turn26view0turn27view0turn3search0turn3search2

The recommended default is a **chunked, self-describing `.slm` container** with **independently compressed frames**. Use **zstd** for most dense cold tensors because it offers high compression ratios, dictionary support, and independent frames; use **LZ4** or **raw** storage for startup-critical chunks because LZ4’s decoder is extremely fast and its frame format supports independent blocks and checksums; reserve **Brotli** mainly for tokenizer/config/text payloads because Brotli is optimized for web-style content and shared dictionaries, but raw Brotli streams do not carry integrity metadata such as checksums or uncompressed length. For integrity and P2P compatibility, maintain a **SHA-256 Merkle tree over compressed bytes** using a BitTorrent-v2-friendly leaf schedule, and add a **small post-decode checksum** per chunk for quick runtime validation. citeturn0search5turn23view0turn24view0turn25view0turn12search0turn21view0

## Proposed container layout

A good compressed `.slm` should borrow Safetensors’ “offset-based tensor access” and GGUF’s “single-file, aligned, self-describing metadata,” but add a chunk directory, per-chunk codecs, and Merkle coverage over the compressed payload. That preserves reliability and makes browser/WASM streaming practical. citeturn30view0turn26view0turn27view0

```text
+-------------------------------+
| Fixed Header                  |
| magic = "SLM2"               |
| version                       |
| flags                         |
| toc_offset / toc_len          |
| merkle_offset / merkle_len    |
| payload_offset                |
| root_hash_algo                |
| root_hash                     |
+-------------------------------+
| String Table                  |
+-------------------------------+
| Asset Directory               |
| tensors, tokenizer, config,   |
| adapter sidecars, sparse maps |
+-------------------------------+
| Chunk Table                   |
+-------------------------------+
| Dictionary Table              |
| shared tokenizer / zstd dicts |
+-------------------------------+
| Merkle Piece Layers           |
| SHA-256, BT v2 compatible     |
+-------------------------------+
| Payload Region                |
| chunked independent frames    |
+-------------------------------+
| Optional Footer Copy          |
| root hash + manifest digest   |
+-------------------------------+
```

The **asset directory** should list logical assets such as dense tensors, sparse tensors, tokenizer blobs, configuration records, and adapter sidecars. Each logical asset maps to one or more chunks. This keeps the logical model graph separate from storage layout, which is how you get both compactness and browser-friendly scheduling. GGUF already demonstrates the value of explicit tensor metadata plus aligned offsets, and Safetensors shows the operational benefit of being able to read only selected tensors or slices. citeturn27view0turn30view0

The **payload region** should store only **independent compressed frames**. This matters because the zstd and LZ4 frame formats are explicitly independent at the frame level, whereas both specifications also note that their formats do not attempt to provide random access inside a single solid stream. LZ4 goes further and states that linked blocks make random access or multithreaded decoding impossible, while independent blocks preserve those options. That makes “one chunk = one independent frame” the right primitive. citeturn23view0turn24view0

A practical default is to keep the fixed header small enough to fetch in a single initial range request, then place the full table of contents immediately afterward. The browser first fetches the header and TOC, decides which chunks it needs, and then issues subsequent range requests for those byte ranges. That is exactly the kind of access pattern range requests are intended to support. citeturn3search2turn3search5

## Chunk table and payload encoding

The chunk table is the core of the format. It should be fixed-width for fast parsing in Rust/WASM, little-endian, and aligned. A representative chunk entry looks like this:

| Field | Purpose |
|---|---|
| `chunk_id` | Stable identifier |
| `asset_id` | Which tensor/tokenizer/config asset it belongs to |
| `kind` | dense, sparse, tokenizer, config, adapter, alias |
| `codec` | raw, lz4, zstd, brotli |
| `flags` | dictionary-used, alias, sparse, hot, immutable |
| `logical_offset` | Offset within the logical asset |
| `uncompressed_len` | Exact decoded size |
| `compressed_offset` | File offset in payload region |
| `compressed_len` | Exact stored size |
| `dict_id` | External/shared dictionary selector |
| `first_leaf` | First Merkle leaf covered by this chunk |
| `leaf_count` | Number of Merkle leaves |
| `decoded_checksum` | Fast post-decode checksum |
| `alias_of` | Optional reference for dedup/tied storage |

This design keeps chunk metadata cheap while still supporting range fetching, incremental integrity verification, and alias-based deduplication. The rationale comes directly from GGUF’s aligned tensor-offset model, Safetensors’ direct tensor access, and BitTorrent v2’s Merkle piece-layer model over power-of-two piece spans. citeturn27view0turn30view0turn21view0

### Tensor byte packing

The first compression stage should be **tensor-native packing**, not general-purpose entropy coding. ONNX’s 4-bit and 2-bit type documentation is useful here because it lays out canonical byte packing: INT4/UINT4 store two 4-bit values per byte, and INT2/UINT2 store four 2-bit values per byte. That gives deterministic, byte-addressable low-bit storage with minimal decoding overhead. citeturn28view0turn29view0

For `.slm`, that means dense quantized tensors should be stored as **packed low-bit blocks plus per-block scales and any zero-point/min metadata**, with block boundaries staying byte-aligned. The important design choice is to keep the packed data, scales, and block metadata in predictable lanes so that a chunk can be decoded directly into a kernel-friendly layout. In other words, byte packing is the first-stage compression; zstd/LZ4/Brotli is a second-stage transport/storage compression layered on top. That mirrors how GGUF carries quantized tensor encodings in aligned tensor payloads rather than inventing a file-wide variable-bitstream. citeturn28view0turn29view0turn27view0

### Entropy coding and codec roles

A custom entropy coder is usually the wrong place to spend complexity budget for browser inference. zstd already combines LZ-style matching with entropy coding and exposes dictionaries, frame metadata, optional checksums, and independent frames; Brotli combines LZ77, Huffman coding, static modeling, and optional shared-dictionary formats; LZ4 gives up ratio in exchange for very fast decode and simple framing. citeturn0search1turn23view0turn24view0turn12search0

The best codec split is therefore by payload type:

| Payload class | Recommended storage |
|---|---|
| Cold dense tensor chunks | zstd |
| Hot startup-critical chunks | lz4 or raw |
| Tokenizer/config/text blobs | brotli or shared dictionary |
| Sparse index arrays | zstd |
| Small adapter sidecars | zstd |
| Exact aliases / duplicated chunks | reference only |

That split is justified because zstd is designed for high ratio with fast decode and independent frames, LZ4 is designed for bounded-memory streaming with multi-GB/s-class decoding, and Brotli is explicitly positioned as a dense compressor for web-style content but does not embed checksums or uncompressed-length metadata in the raw stream. citeturn0search5turn0search12turn25view0turn23view0turn24view0

### Shared tokenizer dictionaries and repeated blobs

Tokenizer payloads are often structurally repetitive across model variants. Hugging Face tokenizers commonly save vocabulary data as JSON plus optional `merges`, while SentencePiece commonly uses a single fixed-vocabulary model file. That makes tokenizers unusually good candidates for **content-addressed externalization**: store them once by hash and let many `.slm` packages reference the same tokenizer blob. citeturn31view0turn11search1

If additional transfer savings are needed for text-heavy metadata or frequently refreshed manifests, the standards work around **shared Brotli dictionaries** and **Compression Dictionary Transport** is directly relevant. Shared Brotli adds dictionary references and a framing format, and RFC 9842 standardizes HTTP negotiation for dictionary-based Brotli and zstd compression. The simplest `.slm` interpretation is not “depend on browser CDT support,” but “treat tokenizer/config assets as reusable dictionary-grade blobs”: make them separately addressable, content-addressed, and sharable across releases. citeturn12search0turn12search4turn12search7

### Deduplication, sparse tensors, and adapter deltas

Whole-tensor aliasing should be a first-class feature because language models may intentionally share weights. The classic example is weight tying between input and output embeddings, which can cut model size substantially without hurting performance. In `.slm`, two asset entries should be able to point to the same chunk sequence. citeturn9search15

Block-level deduplication should happen **after** quantization and packing, using content hashes on canonical chunk bytes. If two packed chunks are identical, store one payload and let the other chunk table entries reference `alias_of`. This works best for repeated projection blocks, tied embeddings, or repeated adapter payloads, and it also helps P2P because identical canonical compressed chunks can be shared as identical file regions. The important constraint is determinism: the same logical chunk must always compress to the same bytes if you want reproducible dedup. That is another reason to avoid cross-chunk “solid” compression. citeturn23view0turn24view0

Sparse encoding should be optional and selective. PyTorch’s sparse docs are a good reminder that COO is a simple coordinate encoding, while CSR typically uses storage better and can be much faster for sparse matrix-vector operations. BSR extends the idea to block-sparse storage. In practice, `.slm` should only switch a tensor to sparse storage when the runtime kernels can exploit it and the measured representation is actually smaller than packed dense storage plus zstd/LZ4. Store sparse indices and values separately, because indices are often much more compressible than values. citeturn16view0turn16view2turn16view1

Adapter and delta storage should be explicitly sidecar-friendly. LoRA works by freezing base weights and storing low-rank updates, reducing trainable parameters by orders of magnitude, and PEFT formalizes the broader pattern of storing only a small adaptation layer rather than a full model copy. GGUF already recognizes LoRA as a distinct file type. The `.slm` equivalent should be a compact adapter asset or sidecar package that records the **base model root hash**, target tensors, rank/scaling metadata, and chunk list. Base weights remain byte-for-byte immutable and maximally shareable; adapters stay small and verifiable. citeturn9search1turn9search2turn9search6turn26view0

## Rust and WASM loading strategy

The browser loading path should be **TOC-first, worker-based, and chunk-scheduled**. `fetch()` gives streamed bodies through `ReadableStream`, range requests let the client fetch selected byte spans, Web Workers can do background processing without blocking the UI, and `WebAssembly.instantiateStreaming()` is the most efficient way to load the WASM runtime itself. citeturn3search0turn3search2turn19search2turn3search1

A clean load sequence looks like this:

1. Fetch the fixed header and enough bytes to parse the TOC.
2. Instantiate the Rust/WASM runtime with `instantiateStreaming()`.
3. Spawn a worker dedicated to model I/O and decompression.
4. Issue range requests for the required chunks.
5. Validate compressed bytes against Merkle state before decode.
6. Decompress each independent chunk in the worker.
7. Transfer the decoded `ArrayBuffer` to the main runtime, or write into imported/shared WASM memory.
8. Drop compressed buffers immediately after validation and decode.

That design uses worker threads for decompression and keeps the UI responsive, while still letting the loader pipeline network, verification, and decode. Transferable `ArrayBuffer`s are important here because they avoid unnecessary copies when moving large decoded chunks between contexts. WebAssembly memory can also be imported from JavaScript and is represented as a resizable `ArrayBuffer` or `SharedArrayBuffer`. citeturn19search2turn19search0turn19search13

For codec implementation in Rust/WASM, there is no need to invent a bespoke decompressor. The Rust ecosystem already has streaming decoders for zstd, LZ4, and Brotli. In WASM, I would favor **pure Rust implementations** where possible for portability, especially `ruzstd` for zstd decode and `lz4_flex` for LZ4 frames, with a Brotli reader for text assets. The native `zstd` crate is also available, but it is a binding to the zstd library, which is less convenient for browser-only builds than a pure Rust path. citeturn20search16turn20search1turn20search17turn20search2turn20search20

Where supported, the browser can be allowed to short-circuit some codecs through `DecompressionStream`. MDN documents `DecompressionStream` as widely available, available in workers, and capable of throwing `TypeError` when the requested format is not supported. Because support still varies by format, the runtime should **feature-detect** native zstd/brotli support and fall back to Rust/WASM otherwise. That gives maximum portability without forcing every browser down the same code path. citeturn5view0turn6view0

For zstd specifically, browser interoperability argues for conservative windows. RFC 9659 exists because browsers and user agents may limit zstd window size for memory reasons, and in HTTP contexts encoders must not generate frames requiring a window larger than 8 MiB. For a `.slm` chunk format, it is wise to go lower than that in practice, keeping window sizes close to chunk size so peak memory stays bounded. citeturn22view0

## Validation, checksums, and peer distribution

Relying only on codec-native integrity checks is not enough. zstd and LZ4 expose optional checksums based on xxHash-family functions, which are good for corruption detection but not for content-addressed trust, while raw Brotli streams do not carry checksums or uncompressed-length metadata at all. That means a robust `.slm` needs both **transport-level cryptographic validation** and **runtime-level post-decode checks**. citeturn23view0turn24view0turn25view0

The most compatible strategy is a **Merkle tree over compressed payload bytes** using **SHA-256** and **16 KiB base leaves**, following the same base leaf size that BitTorrent v2 uses for file Merkle trees. BitTorrent v2 also defines piece layers where one hash covers `piece length` bytes, and it uses SHA-256 roots for file identity. If `.slm` adopts the same leaf convention over its compressed payload region, then exporting a `.torrent` or P2P manifest is straightforward: the container’s internal Merkle structure already matches the swarm’s expected proof model. citeturn21view0

Inside the chunk table, each chunk should record its `first_leaf` and `leaf_count`, so the runtime knows which Merkle leaves cover that compressed frame. On receipt of a chunk, the loader verifies the leaf interval against the stored piece layer or root, then decompresses, then checks a small **decoded checksum** such as CRC32C over the uncompressed bytes. The cryptographic Merkle proof assures authenticity of the transmitted compressed bytes; the decoded checksum catches wrong-dictionary, decoder, or memory-corruption issues cheaply at runtime. That layered approach is stronger than trusting a codec trailer alone. citeturn21view0turn23view0turn24view0turn25view0

For P2P friendliness, compressed chunks should be laid out so they do not induce pathological cross-piece dependencies. The right rule is: **every chunk is independently decodable, and chunk boundaries align to Merkle leaf boundaries**. That way, a peer can download and verify a chunk’s compressed span without needing neighboring chunks for decompression context. This directly avoids the main operational problem with file-wide solid compression: even if the data can be fully verified eventually, it cannot be used incrementally. zstd and LZ4 both make independence explicit at the frame level; BitTorrent v2 makes piece proofs explicit at the Merkle layer. Combining those two properties is the entire P2P strategy. citeturn23view0turn24view0turn21view0

## Tradeoff analysis and recommended defaults

The core tradeoff is simple: **larger chunks improve compression ratio; smaller chunks improve first-use latency, range granularity, validation locality, and memory bounds**. zstd’s own framing model highlights that window size drives decompressor memory requirements, and LZ4’s frame spec emphasizes bounded intermediate storage. In the browser, those properties matter more than squeezing out the absolute last percentage point of file size. citeturn22view0turn24view0turn23view0

A chunked `.slm` also gives a better memory story than a monolithic stream. Peak working memory becomes approximately “codec window + one decoded chunk + runtime staging buffer” instead of “large sliding context + arbitrary decode tail.” That is especially important in WASM, where memory is explicit and large temporary copies can quickly become the dominant load cost. WebAssembly memory is a resizable `ArrayBuffer`/`SharedArrayBuffer`, so keeping decoded chunk size bounded directly reduces heap pressure and GC-adjacent host overhead. citeturn19search13turn22view0

The codec tradeoff comes out like this in practice. **zstd** is the best default for dense cold weights because it offers a broad compression/speed tradeoff, independent frames, optional checksums, and dictionary support, while maintaining fast decompression across levels. **LZ4** is the right choice for startup-critical or frequently touched chunks where decode speed dominates. **Brotli** is best saved for tokenizer/config/text assets where its modeling and dictionary behavior pay off, because its raw stream format is less self-describing and less integrity-friendly than zstd/LZ4 for binary model shards. citeturn0search5turn0search12turn25view0turn23view0turn24view0

My recommended defaults for a production `.slm` are therefore:

| Area | Recommended default |
|---|---|
| Dense tensor storage | blockwise INT4/INT8 packing first, then zstd |
| Hot-path tensors | LZ4 or raw |
| Tokenizer/config | separate content-addressed asset, Brotli or shared dictionary |
| Sparse tensors | CSR/BSR only when measured win exists |
| Adapters | sidecar delta package keyed to base root hash |
| Merkle model | SHA-256 over compressed bytes, 16 KiB leaves |
| Runtime verification | Merkle proof before decode, fast checksum after decode |
| Browser loading | header/TOC range fetch, worker decode, transferable buffers |

That combination is the best balance of size reduction, browser startup behavior, reliability, and peer-sharing compatibility supported by the source material. It preserves direct-addressability like Safetensors and GGUF, uses codecs in the roles they are best at, avoids monolithic compression’s random-access penalties, and makes BitTorrent-v2-style proof distribution a natural extension instead of an afterthought. citeturn30view0turn26view0turn27view0turn23view0turn24view0turn25view0turn21view0
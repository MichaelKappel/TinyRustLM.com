# Qwen3 SLM2 Converter Implementation

Date: 2026-08-25

## Status

`tinyrustlm-convert qwen3-safetensors` is the exact model-component compiler
primitive for TinyRustLM's one prelaunch product. It implements the contract
registered before output in
`contracts/vnext/qwen3-safetensors-conversion-profile.v2.json`, whose SHA-256
is `fa2ce18f38129a6b106000d7802d1ea3995921e2b945ae5e52457908f548e7cf`.

The sole complete source-to-composition command is now
`tinyrustlm-convert qwen3-composition`. It invokes this model primitive, the
exact Tokenizer2 primitive, and the canonical fixed dependency and ACG2 owners
under one create-only terminal receipt. Its sole current profile is
`tinyrustlm.qwen3-complete-composition-conversion/4` at SHA-256
`19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8`.
It binds only Tokenizer2 producer
`tinyrustlm.qwen-bytelevel-to-tokenizer2/2`, profile SHA-256
`97b381c73e7191f245ba132421a81bf015092b8550599413a6c81c6dae0afae4`,
receipt schema `tinyrustlm.qwen_tokenizer2_conversion_receipt.v2`, and member
`tokenizer.tokenizer2`. The obsolete `.tok2` filename suffix is rejected and
has no alias or compatibility path. The internal binary format identifier
`minimodel.tok2` is unchanged and is not a pathname contract.

This is not a product V2 or a compatibility path. SLM2 is the exact model-byte
contract. The Qwen2/F32 model converter and its executable integration corpus
were deleted. The accepted Qwen Tokenizer2 converter remains a separate owner;
model conversion neither regenerates nor copies Tokenizer2 or Template2.

## Closed Inputs

Complete composition conversion additionally admits `config.json` and
`tokenizer_config.json` against the exact path, byte length and SHA-256 owned by
the frozen Template2 profile. Matching caller-supplied locks alone do not establish
that authority. A mismatch returns `composition-template-source-mismatch` before
output creation or weight conversion. The component converters then verify the
actual source bytes against those records. The Template2 library exports these
identities, sharing its model-config digest with the artifact header; contract
tests bind both descriptors to the unchanged machine-readable profile.

This check belongs to complete composition conversion. Standalone Tokenizer2
conversion retains its own contract and does not acquire the frozen renderer's
source-template restriction. C95's deterministic tests establish admission
behavior only; they do not rerun a historical conversion or qualify the source.

One strict source lock binds exactly these nine regular files:

- `LICENSE`
- `README.md`
- `config.json`
- `generation_config.json`
- `merges.txt`
- `model.safetensors`
- `tokenizer.json`
- `tokenizer_config.json`
- `vocab.json`

The source directory must contain that exact set and no links, reparse points,
directories, or additional entries. Every record binds the exact basename,
positive byte length, and lowercase SHA-256. The converter hashes all nine
files through one fixed 1 MiB buffer before inspection and repeats the same
closure after model writing and independent validation but before promotion.

The model converter does not parse tokenizer or template content. Those files
remain in the source closure because they identify the complete upstream
checkpoint. Their current executable interpretation belongs only to the
already accepted Tokenizer2 and Template2 authorities.

## Qwen3 Semantics

The config parser rejects duplicate and unknown members. It accepts only dense
`Qwen3ForCausalLM` with exact Qwen3 operator semantics:

- SiLU activation and RMSNorm;
- finite positive initialization range, RMS epsilon, and RoPE theta;
- independent positive `head_dim` rather than deriving it from residual width;
- query-head count divisible by KV-head count;
- checked query and KV widths;
- grouped-query attention with no projection biases;
- paired per-head Q and K normalization vectors;
- tied token embeddings and output projection;
- null RoPE scaling and null sliding-window configuration;
- cache enabled and sliding-window execution disabled;
- one complete BF16 or F32 checkpoint dtype.

The independent head dimension matters for Qwen3-0.6B: its residual width is
1,024 while sixteen query heads of dimension 128 produce query width 2,048.
The converter preserves that shape rather than forcing Q, K, and V through an
equal-width assumption.

## Safetensors Admission

The parser admits one regular single-file Safetensors container. It bounds the
JSON header at 16 MiB, rejects duplicate tensor names and unknown tensor-record
fields, permits only an optional string-to-string metadata map, and requires:

- one source dtype matching `config.json`;
- rank one through eight;
- positive dimensions no larger than `u32::MAX`;
- checked element and parameter counts;
- exact byte counts for every tensor;
- contiguous, non-overlapping ranges covering the complete payload;
- the exact closed Qwen3 tensor inventory and shape mapping.

Qwen source names map to the canonical SLM2 roles, including
`q_norm.weight` and `k_norm.weight`. Projection biases, missing canonical
tensors, and unrelated surplus tensors are fatal. A tied checkpoint must
contain exactly one additional `lm_head.weight`; omitting it is also fatal.

## Tied Output Proof

The physical source inventory contains the canonical logical tensor registry
plus one redundant tied output. Before constructing or validating any output
path, the converter requires `lm_head.weight` and
`model.embed_tokens.weight` to have exactly equal supported dtype, shape, and
byte length. It then opens two read-only source handles, seeks to the two
payload ranges, and compares every source byte through two fixed 1 MiB buffers.
Both payload SHA-256 identities are computed during that same bounded pass.

The comparison is over original source bytes, not expanded F32 values,
quantized output, sampled blocks, or names alone. A missing tensor, wrong dtype,
wrong shape, wrong length, or changed byte has a distinct bounded failure. An
untied configuration and every unrelated additional tensor remain fatal.

The tied output is source evidence, not a second runtime weight. The source
receipt records 311 physical tensors and 751,632,384 physical parameters for
the locked base, while SLM2 contains 310 logical tensors and 596,049,920
logical parameters. Only `model.embed_tokens.weight` is emitted, once, as the
canonical token embedding.

## Streaming Conversion

Each admitted source tensor is exposed as a bounded seekable reader. BF16
words expand to little-endian F32 by placing the BF16 bits in the high sixteen
bits and zeroing the low sixteen bits. F32 words pass through unchanged. The
converter never allocates the whole source model or whole output model.

The SLM2 writer is the sole storage-selection owner. It derives encoding from
the closed semantic role:

- all embedding, attention, and feed-forward matrices become row-wise signed
  Q8 with one finite positive F32 scale per row;
- final, layer, Q, and K normalization vectors remain F32;
- no F32 model-weight shadow is retained;
- no runtime repacking or alternate quantization exists.

The writer reads each source tensor twice to hash derived payload and then copy
the exact derived bytes. A changed source across those passes is rejected. The
converter then independently reparses the complete staged SLM2 under the
64 GiB and 262,144-tensor registered limits and requires exact model identity
and model specification equality.

## Receipt And Durability

Successful conversion promotes exactly two final siblings:

1. `{name}.slm2`
2. `{name}.slm2.conversion-receipt.json`

Both begin as create-new same-directory staging files. The model is synced,
independently reparsed, source-rechecked, promoted without overwrite, and
followed by a directory flush. The receipt is pretty UTF-8 JSON with one final
LF; it is synced, promoted last, and followed by a second directory flush. The
converter then rereads the promoted receipt as a bounded regular file, requires
exact byte equality with the serialized bytes, and returns its byte length and
SHA-256 as part of the conversion result. Complete composition rereads each
model and tokenizer component receipt and rejects it unless its exact identity
matches the identity returned by that component converter. A valid-looking
receipt substituted between component conversion and composition is therefore
fatal even when its schema and status fields still parse.

Receipt schema `tinyrustlm.qwen3_conversion_receipt.v2` binds converter version
and executable hash, source-lock hash, every locked source file, source identity
and license, dtype, physical tensor count/parameter count/inventory hash,
logical tensor count/parameter count/inventory hash, both tied tensor names,
dtype, shape, element count, byte length, payload hashes, exact equality
verdict, comparison method and buffer bound, exact SLM2 format and weight
profiles, artifact/manifest/layout identities, complete model spec, and
directory durability observation.

Its claim is only `structural-and-byte-conversion-only`. Model quality,
source-framework parity, native runtime, and browser WASM status all remain
`not-assessed-by-converter`. A model without the matching final receipt is an
incomplete preserved incident. Staging is never auto-deleted, outputs are
never overwritten, and conversion is never automatically retried.

## Verification

The corrected implementation checkpoint passed with warnings denied:

- nine converter and complete-composition unit tests;
- fifteen Qwen3 model-conversion integration tests;
- eight accepted Qwen Tokenizer2 integration tests;
- Rust formatting and all-target Clippy;
- thirty-five focused registration, clean-cut, source-lock, and preserved-result
  Node tests; and
- 207 managed Release tests with zero failures, skips, or warnings.

The Qwen3 corpus covers deterministic repeated BF16 conversion, F32 source
conversion, wide query width, Q/K normalization, role-exact Q8/F32 storage,
receipt closure, complete independent reparse, all nine source-file hashes,
closed directory inventory, duplicate config members, changed operator
semantics, non-null disabled operators, surplus/missing/duplicate/wrong-shape
tensors, required exact BF16 and F32 tied output, missing/wrong-dtype/
wrong-shape/wrong-length/changed-byte tied output, untied config, mixed and
unsupported dtypes, gaps, overlap, trailing payload,
nonfinite values, create-only output, source/output overlap, proper prefixes,
and hostile complete-artifact mutation.

The tests create only tiny deterministic fixtures under verified owned system
temporary roots. They are format and converter evidence, not product models.

## Claim Boundary And Next Gate

No real model conversion succeeded, ran, qualified, published, or announced by
this implementation checkpoint. The prior exact source attempt remains a
preserved terminal rejection under invalidated producer profile `/1`; it is not
retried or relabeled. The unchanged `Qwen/Qwen3-0.6B` source remains terminally
rejected as a product model and may be used only as a numerical-parity ancestor.

The complete transaction has one strict managed process owner and one private
Companion source-branch coordinator. The next gate is a wholly new preregistered
one-shot conversion using all-new private roots, followed only on structural
pass by exact source-framework versus native SLM2 versus browser-WASM numerical
parity and untouched quality qualification. MemoryEndpoints remains
unauthorized and disconnected.
Campaign counters remain 0/20, 0/50, 0/25, 0/40, and 0/20.

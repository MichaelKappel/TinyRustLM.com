# Qwen3 SLM2 Converter Implementation

Date: 2026-08-24

## Status

`tinyrustlm-convert qwen3-safetensors` is the sole model-conversion command for
TinyRustLM's one prelaunch product. It implements the incompatible contract
registered before output in
`contracts/vnext/qwen3-safetensors-conversion-profile.v1.json`, whose SHA-256
is `313069152daa70a2c2b5070f9d1350379a5800f647d5c3ac8d23a75ff9ead968`.

This is not a product V2 or a compatibility path. SLM2 is the exact model-byte
contract. The Qwen2/F32 model converter and its executable integration corpus
were deleted. The accepted Qwen Tokenizer2 converter remains a separate owner;
model conversion neither regenerates nor copies Tokenizer2 or Template2.

## Closed Inputs

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
`q_norm.weight` and `k_norm.weight`. Projection biases, `lm_head.weight` for
tied embeddings, missing tensors, and surplus tensors are fatal.

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
LF; it is synced, promoted last, and followed by a second directory flush.

The receipt binds converter version and executable hash, source-lock hash,
every locked source file, source identity and license, dtype, tensor count,
parameter count, domain-separated tensor-inventory hash, exact SLM2 format and
weight profiles, artifact/manifest/layout identities, complete model spec, and
directory durability observation.

Its claim is only `structural-and-byte-conversion-only`. Model quality,
source-framework parity, native runtime, and browser WASM status all remain
`not-assessed-by-converter`. A model without the matching final receipt is an
incomplete preserved incident. Staging is never auto-deleted, outputs are
never overwritten, and conversion is never automatically retried.

## Verification

The converter crate passes with warnings denied:

- one execution-identity unit test;
- thirteen Qwen3 model-conversion integration tests;
- eight accepted Qwen Tokenizer2 integration tests;
- Rust formatting and all-target Clippy;
- twenty-two preregistration, clean-cut, and contract-registry Node tests.

The Qwen3 corpus covers deterministic repeated BF16 conversion, F32 source
conversion, wide query width, Q/K normalization, role-exact Q8/F32 storage,
receipt closure, complete independent reparse, all nine source-file hashes,
closed directory inventory, duplicate config members, changed operator
semantics, non-null disabled operators, surplus/missing/duplicate/wrong-shape
tensors, mixed and unsupported dtypes, gaps, overlap, trailing payload,
nonfinite values, create-only output, source/output overlap, proper prefixes,
and hostile complete-artifact mutation.

The tests create only tiny deterministic fixtures under verified owned system
temporary roots. They are format and converter evidence, not product models.

## Claim Boundary And Next Gate

No upstream or trained real model was downloaded, converted, run, qualified,
published, or announced by this implementation checkpoint. The unchanged
`Qwen/Qwen3-0.6B` source remains terminally rejected as a product model and may
be used only as a numerical-parity ancestor.

The next gate is exact source-framework versus native SLM2 versus browser-WASM
numerical parity, followed by untouched quality qualification of a genuinely
trained derivative. MemoryEndpoints remains unauthorized and disconnected.
Campaign counters remain 0/20, 0/50, 0/25, 0/40, and 0/20.

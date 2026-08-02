# Quantization

## Purpose

Quantization reduces model download size and memory pressure. The current implementation proves q8_0 and q4_0 with tiny fixture files and proves TinyLM-16M f32/q8_0/q4_0 smoke models, with direct q8_0 and q4_0 matvec dispatch.

## Constraints

The first runtime target remains f32 correctness. q8_0 and q4_0 support must preserve the f32 tiny and TinyLM-16M smoke behavior.

## Data Structures

q8_0 stores signed 8-bit weights with f32 scales and keeps raw int8 rows for direct matvec. q4_0 stores signed 4-bit packed nibbles with f32 scales and keeps the packed bytes for direct matvec. The runtime no longer keeps full decoded f32 shadow copies for q8_0 or q4_0 tensors; embedding rows and norm vectors are dequantized into scratch only when needed. The tensor directory carries block size explicitly.

## Binary Formats

Each tensor directory entry declares dtype, payload offset, byte length, scale offset, and block size. q8_0 and q4_0 payload interpretation is selected from dtype. Quantized payloads and scale payloads are separately aligned.

## Failure Cases

Unsupported dtype, missing scales, invalid block sizes, row length mismatches, and tensor shape mismatches are fatal for the active quantized path.

## Validation Rules

The model loader validates dtype before dispatch. q4_0 rows require columns to divide into the entry block size. q8_0 rows require one scale per row. Matrix-vector operations dispatch by tensor dtype; q8_0 and q4_0 matrices use direct quantized matvec with f32 accumulation. Borrowed f32 tensor slices are available only for native f32 tensors; quantized tensors must be copied into caller-owned f32 buffers when a decoded reference path is required.

## Future Expansion Path

Next quantization work should measure the scratch-row dequantization path across longer prompts, improve q8/q4 matvec tiling, and add larger quality-model evidence. Mixed precision for embeddings and output projection can be added only after baseline TinyLM-16M q8/q4 tests stay green.

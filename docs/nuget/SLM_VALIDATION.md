# SLM Validation

The NuGet SDK validates `.slm` files through the supported TinyRustLM runtime parser.

Validation checks include:

- `SLM1` magic and supported format version.
- Header length and field sanity.
- Transformer shape consistency.
- Tokenizer and tensor-directory ranges.
- Tensor data ranges and supported `f32`, `q8_0`, `q5_0`, and `q4_0` dtype values.
- Embedded runtime checksum.
- Optional expected SHA-256 match.
- Default public safe-loading byte budget.

The SDK reports shape, tokenizer bytes, tensor counts, quantization summary, byte count, artifact SHA-256, and runtime checksum. Safe inspection and loading are compatibility checks, not model-quality or browser-admission claims. The SDK does not expose `.slm` authoring internals or conversion tools.

# Qwen2.5 1.5B Instruct conversion notice

TinyRustLM distributes a modified model artifact derived from
`Qwen/Qwen2.5-1.5B-Instruct` at source revision
`989aa7980e4cf806f80c7fef2b1adb7bc71aa306`.

Upstream source:
https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct/tree/989aa7980e4cf806f80c7fef2b1adb7bc71aa306

Upstream license: Apache License 2.0. The exact license file fetched from the
pinned revision is distributed as `Qwen2.5-1.5B-Instruct.LICENSE.txt` and has
SHA-256 `832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e`.
No `NOTICE` file exists at the root of the pinned upstream revision.

TinyRustLM modifications:

- Converted the pinned SafeTensors weights and tokenizer metadata into the
  TinyRustLM `.slm` version 1 container.
- Quantized eligible weight tensors to the TinyRustLM q4_0 representation;
  required norms, biases, and metadata remain in their runtime-compatible
  representations.
- Embedded the ChatML prompt format and the TinyRustLM Cognitive Liberty
  system prompt used by the browser runtime.
- Added TinyRustLM integrity, resource, browser-conversation, and known-
  limitation metadata. No additional model training was performed.

Converted artifact:

- File: `qwen2.5-1.5b-instruct-q4.slm`
- Bytes: `969648576`
- SHA-256: `dc24eb832e8bd2257a9891e4c88df9ab7b1d24ee92d3f644cd98f340417b75bc`
- TinyRustLM checksum: `0x9327f064169b418d`

The converted artifact is offered as an optional conversational model. It is
not the automatic browser download and is not admitted under TinyRustLM's full
assistant-quality gate. Its current declared limitation is strict structured
JSON generation.

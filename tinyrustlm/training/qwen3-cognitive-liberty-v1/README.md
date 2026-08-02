# Qwen3 Cognitive Liberty Training

This training lane targets `Qwen/Qwen3-0.6B` for the browser-local TinyRustLM runtime.
It reuses only reviewed final-answer teacher records, renders Qwen3 in non-thinking mode,
and freezes the cognitive-liberty conversational evaluation set as a training exclusion.

The first one-epoch CPU adapter is a screening experiment. It cannot be promoted from
training loss or structural validation; native mixed-precision `.slm` evaluation against
the fixed and seeded conversation gate remains mandatory.

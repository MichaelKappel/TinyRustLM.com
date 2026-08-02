# Performance

## Purpose

Performance work keeps the browser runtime responsive while protecting correctness.

## Constraints

Correct f32 output comes before speed. The runtime must avoid uncontrolled per-token allocation and must keep memory usage visible in diagnostics.

## Data Structures

Diagnostics track model load time, prompt token count, generated token count, tokens per second, peak scratch arena usage, KV cache length, and active quantization mode. Quantized models keep q8_0/q4_0 payloads in native compact storage and use model-loaded scratch buffers for row/vector dequantization. Runtime generation also keeps pre-resolved tensor indices, a reusable logits buffer, allocation-free top-k diagnostics, fixed-buffer stochastic sampling, and a 64 KiB generated-result cap so prompt generation and single-token stepping do not allocate new scratch, vocab-sized logits, layer-name strings, diagnostic candidate vectors, sampling candidate vectors, or unbounded result buffers per token. The browser UI also measures host-side load and generation elapsed time.

## Binary Formats

The current TinyLM-16M f32 file is about 68 MB. The current TinyLM-16M q8_0 file is about 17 MB. The current TinyLM-16M q4_0 file is 10,657,728 bytes, inside the expected 9-15 MB range.

## Failure Cases

Context overflow, scratch arena exhaustion, output buffer overflow, non-finite softmax sums, and malformed quant blocks are correctness failures, not performance metrics.

## Validation Rules

Initial f32, q8_0, and q4_0 should not crash on a model configured for 512-token context. Browser diagnostics must render after load and generation. Unit tests assert generation scratch/logits pointer stability across prompt generation and repeated `generate_next_token` calls. Context-boundary tests assert that a prompt may fill every context slot except the first generated-token slot and that a full prompt context is rejected before generation. Output-buffer tests assert byte and BPE decode reject over-limit result text with `OutputBufferExceeded` and that full-generation failures clear stale generation state. Sampling tests assert seeded top-k/top-p behavior, reject top-k values beyond the fixed 1024-candidate cap, and prove the BPE fixture can use top_k 262 without a vocab-sized candidate allocation. The TinyLM-16M q8_0 and q4_0 browser smokes generated one token from prompt `hi`, reported 47,104 bytes of scratch usage after scratch-backed quantized row/vector dequantization, and rendered host-side token speed.

The browser performance smoke runs multi-token q8_0 and q4_0 generation through the UI, then verifies prompt-token count, generated-token count, token-speed display, scratch-byte display, quantization mode, reset recovery, and local-only network requests. This is a benchmark-panel correctness check, not a trained-quality or production throughput claim.

The browser performance soak repeats that multi-token q8_0 and q4_0 path across cycles. Each cycle must produce deterministic output, positive host-side token speed, expected prompt/generated counts, expected KV cache length, nonzero scratch usage during generation, clean reset diagnostics, and local-only network requests. This is still a stability and instrumentation check, not a final quality benchmark.

## Future Expansion Path

Optimization can focus on q8/q4 matvec tiling, fewer scratch dequantization passes, fewer copies across the JS/WASM boundary, larger context support, larger BPE-aware fixed sampling buffers or model-loaded sampler scratch, and eventually optional WebGPU outside the first-version scope.

# Performance And Resource Evidence

## Principle

Performance is a measured property of one exact model, composition, runtime,
browser, workload, and machine. Correct scalar semantics come first. An
optimized path is admitted only as a differential implementation of the same
contract; it is never a hidden fallback or a second semantic authority.

## Required Measurements

Every native or browser result binds the exact source commit/tree, composition
identity, runtime binary or WASM hash, browser build, operating system,
hardware, sampling profile, prompt-case hash, and measurement tool.

Record at least:

- cold and warm runtime initialization;
- composition open and six-member verification time;
- prefill tokens per second and first-token latency;
- decode tokens per second;
- generated token count and termination reason;
- cancellation request-to-terminal latency;
- worker replacement and immutable reopen time;
- immutable model and member bytes;
- peak WASM linear memory and JavaScript memory where observable;
- process resident memory under a documented method;
- transient activation, logits, tokenizer, and hashing buffers;
- KV-cache bytes per retained token and maximum admitted tokens;
- storage copy count and transferred bytes;
- unexpected network request count.

Do not invent values for unavailable counters or combine predicted and observed
figures in one field.

## Memory Model

Peak browser memory is not model file size. Plan and measure:

```text
peak = immutable member storage
     + active WASM linear memory
     + model representation
     + tokenizer/template/prompt state
     + activation and dequantization scratch
     + logits and sampling buffers
     + KV cache
     + worker message and stream buffers
     + JavaScript and browser/JIT overhead
```

KV-cache capacity is derived from layers, KV heads, head dimension, retained
tokens, and element width. Checked arithmetic and the admission policy reject a
request before an impossible allocation. Context overflow, allocation failure,
nonfinite activation, and output-limit breach are typed correctness failures,
not slow successful runs.

## Copy Discipline

The browser streams each composition member to the worker in bounded
contiguous transferable chunks. The top window does not retain model copies.
The worker wipes consumed transfer buffers and owns active runtime state.

Claims such as zero-copy require measured proof across the complete storage,
JavaScript, worker, and WASM path. File System Access, OPFS, IndexedDB,
`ArrayBuffer`, structured clone, and WASM memory each have distinct copy and
quota behavior; API names alone are not evidence.

## Optimization Gate

For each proposed SIMD, threading, layout, cache, quantization, or retrieval
optimization:

1. preregister the exact changed operations and resource ceiling;
2. preserve the scalar result and first-divergence capture points;
3. run unit and adversarial kernel vectors;
4. compare layers, logits, token ordering, and deterministic sequences;
5. measure cold/warm latency, throughput, memory, and cancellation;
6. run untouched behavioral noninferiority where model bytes or arithmetic
   change;
7. reject the candidate if a correctness or ordinary-helpfulness budget is
   exceeded.

No automatic dispatch fallback is allowed after an optimized kernel fails its
admission or runtime invariant. Unsupported capability produces a truthful
rejection.

## Browser Evidence

Node or a WASM harness is not browser proof. Chromium is the required first
real-browser target. Firefox and WebKit remain unproven until separately run
with exact versions and equivalent evidence.

Browser tests cover constrained-memory admission, long prefill, repeated
decode, context boundary, cancellation during hashing/prefill/decode, worker
termination, fresh-worker reopen, tab lifecycle, storage loss, stale service
worker, browser crash, and owned-profile deletion.

Performance evidence permits no model-quality, P2P, deployment, or campaign
claim by itself.

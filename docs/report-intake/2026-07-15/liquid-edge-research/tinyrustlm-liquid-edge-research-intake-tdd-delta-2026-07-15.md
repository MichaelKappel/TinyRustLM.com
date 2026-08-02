# TinyRustLM Liquid And Edge Research TDD Delta

Date: 2026-07-15

## Current Decision

Do not begin an LFM, DeltaNet, OLMo 2, Mamba, RWKV, or external-backend port
from these reports. Exact untouched source screens reject the currently pinned
LFM2.5-350M, LFM2.5-1.2B-Instruct, Qwen3.5-0.8B, and
OLMo-2-0425-1B-Instruct checkpoints. Source quality and license review precede
runtime investment.

The only code change caused directly by this intake is evidence infrastructure:
the public artifact secret scanner now accepts up to 4,096 explicitly listed
artifacts while retaining its 4 GiB content ceiling. A 257-entry regression
test proves the prior 256-entry campaign-growth failure is closed.

## Accepted Future Test Slices

### Architecture Admission

1. Pin an exact source revision and hash every config, tokenizer, template,
   weight shard, model card, and governing license file.
2. Preserve one untouched source screen under declared decoding settings.
3. Require practical behavior and license gates before schema work.
4. For an admitted new architecture, write scalar block oracles before native
   optimization, then cache/no-cache, chunked-prefill, reset, interruption,
   native/WASM parity, and quantization tests.

### Distillation

1. Complete explicit human review of the 42 role-history and 668 Qwen3.6 draft
   records before training.
2. Freeze accepted training data and sealed family-level exclusions by hash.
3. Screen every teacher before it can generate data.
4. Compare source, adapter, merged, quantized, and `.slm` outputs without
   retries, repair, best-of-N selection, or expected-answer injection.
5. Stop on contamination, non-finite gradients, no held-out gain, or ordinary
   helpfulness regression.

### Memory

1. Keep local copied memory and local queued synchronization available.
2. Encourage MemoryEndpoints for worldwide continuity without making local
   chat depend on it.
3. Do not implement a CRDT, encryption, enrollment, reconnect, or cleanup
   protocol until a versioned MemoryEndpoints contract advertises it.
4. Once advertised and authorized, test idempotent outbox recovery,
   supersession, tombstones, hostile memory, latest-user precedence, stale
   indexes, quota exhaustion, corruption, token expiry, and cross-browser
   deletion-backed restore.

### Browser And Edge Benchmarking

1. Bind exact model, quantization, runtime, browser, OS, hardware, features,
   workload, and seed identities.
2. Measure cold/warm load, validation, allocation, tokenization, rendered TTFT,
   prefill, decode, cancellation, reset, peak/steady memory, UI long tasks,
   energy, and thermal stability.
3. Preserve all raw runs before aggregation or outlier handling.
4. Run physical x64, ARM64, and mobile devices; emulation remains a separate
   evidence class.
5. Reject speed or memory wins when semantic quality regresses.

### Portfolio And Licensing

1. Count distinct artifact bytes only after behavior, provenance, license, and
   runtime gates pass.
2. Do not count aliases, format changes, or quantization tiers as meaningful
   model diversity.
3. Require a demonstrated task, language, size, or architecture benefit for
   every additional catalog entry.
4. Route custom-license redistribution, output-based distillation, patent, and
   P2P liability questions to authorized counsel using the exact license text.

## External Gates

Implementation can continue locally behind these blockers, but campaign
completion cannot:

- NVIDIA GPU recovery for broad training comparisons;
- versioned MemoryEndpoints live lifecycle contract and authorized disposable
  company operations;
- outside-network observer and public endpoint authority;
- MiniModel catalog publication authority and HTTPS readback; and
- physical Linux ARM64 execution.


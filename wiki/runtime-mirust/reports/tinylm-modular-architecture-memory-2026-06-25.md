---
title: TinyLM Modular Architecture Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/tinylm-modular-architecture-memory-2026-06-25/
status: planned_pending_publication
reviewed_utc: 2026-06-25T00:00:00Z
---

# TinyLM Modular Architecture Memory

## Source Reports

- `Modular AI in Browser.md`
- `Modular Tiny Language Models Architecture.md`
- `Multiple Tiny Language Models Architectures and Trends.md`
- `Rust Browser Tiny LLM Architecture.md`
- `Tiny Language Models Architecture.md`
- `Teleodynamic AI is an approach where a system’s structure and parameters co-evolve.md`
- `Teleodynamic AI is an approach.md`

## Durable Reading

The modular tiny-model reports are useful because they widen the horizon beyond one small model. They describe skill modules, routing, adapters, tiny model ensembles, cascades, mixture-of-agents patterns, speculative decoding, prefix/cache reuse, and browser-local composition. For TinyRustLM, these are future architecture ideas, not current deliverables.

The immediate product still needs one model path to be boringly correct:

- Byte tokenizer now, custom BPE later.
- TinyLM-16M-shaped f32/q8/q4 files now.
- One local `.slm` loader and validator now.
- Greedy deterministic generation now.
- Sampling, trained-quality conversion, multi-model routing, and adapters later.

## Concepts Worth Keeping

- Routing is a product primitive, not just an inference trick. A future TinyRustLM could route between q8, q4, tiny fixtures, task-specific SLMs, or adapters based on latency, memory, confidence, and user intent.
- A model ABI matters before a model marketplace. The `.slm` header, tensor directory, tokenizer metadata, quantization fields, and checksum are the seed of that ABI.
- Small models are operational units. Their usefulness depends on load cost, context fit, specialized competence, and recoverable failure behavior.
- Composition should not hide provenance. If a response used base model plus adapter, or local small model plus fallback, the UI should be able to say so.
- Multi-model systems need tests for routing mistakes, stale caches, incompatible tokenizers, and quality drift, not just speed.

## Design Tensions

- Generality versus auditability: every generic routing mechanism makes it harder to prove the current local runtime.
- Skill composition versus privacy: dynamic modules can preserve locality, but only if acquisition, signatures, permissions, and provenance are explicit.
- Speed versus truthfulness: speculative decoding and cascades are attractive, but the UI must not make weak local models feel more capable than they are.
- Rich tokenizers versus format simplicity: custom BPE is needed for quality, but byte-level fallback is still the most testable foundation.

## Future Architecture Sketch

Future modular work should proceed in layers:

1. Stabilize `.slm` v1 for one TinyLM-16M path.
2. Add tokenizer section expansion for custom BPE while preserving byte fallback.
3. Add model capability metadata: context length, quantization, intended task, provenance, checksum, and compatibility.
4. Add a local router that can choose among installed local `.slm` files without remote calls.
5. Add adapter or skill package concepts only after the base ABI can reject incompatible files safely.

## Thought Questions

- Should a tiny model ecosystem optimize first for many specialized weak models or one stronger local generalist?
- What evidence should a router need before it switches models automatically?
- How can model provenance be visible without making the UI feel like a debug console?
- Can a tiny local runtime degrade gracefully by asking better questions instead of pretending to know more?

## Current Boundary

Use this record for future modular and multi-model thinking. Do not implement adapters, LoRA, task arithmetic, speculative decoding, marketplace behavior, or multi-agent orchestration until the active TinyLM-16M runtime path is correct, tested, benchmarked, and explicitly expanded.

# Qwen3 0.6B Same-Tokenizer Top-K Pilot

This bounded CPU pilot tests a training signal that was not exercised by the
rejected Qwen3 sequence-LoRA runs. The frozen 100-record Cognitive Liberty v3
corpus still supplies the reviewed final-answer sequence targets. A pinned
Qwen3-1.7B checkpoint supplies top-128 token distributions under teacher
forcing because its `tokenizer.json` is byte-identical to the Qwen3-0.6B
student tokenizer.

The Qwen3-1.7B checkpoint is a development teacher only. Its own untouched
source screen was rejected, so this experiment must not describe it as a
qualified product model. The top-k cache is development evidence and is never
part of a shipped `.slm` artifact.

The matched sequence baseline is the previously rejected
`qwen3-cognitive-liberty-v3/adapter-cpu-pilot-v2` run. This recipe keeps its
dataset, prompt, epoch count, learning rate, rank, target modules, and effective
batch settings, then adds a corrected top-k KL term. Build success and lower
loss are not promotion evidence. The adapter may be converted only if its
untouched full-precision outputs improve on the unadapted source without
regressing ordinary helpfulness, and the resulting `.slm` must independently
pass the current native fixed-plus-seeded-holdout quality gate.

Run the stages in order with the pinned ML Python environment:

```powershell
D:\LLMs\TinyRustLM\training-env-py312\Scripts\python.exe tinyrustlm\tools\build-distillation-logit-cache.py tinyrustlm\training\qwen3-0.6b-topk-pilot-v1\topk-cache-control-cpu-v1.local.json
D:\LLMs\TinyRustLM\training-env-py312\Scripts\python.exe tinyrustlm\tools\train-distilled-lora.py tinyrustlm\training\qwen3-0.6b-topk-pilot-v1\training-recipe-topk-kd-cpu-v1.manifest
```

Keep raw source screens and rejection reports immutable. Never select a retry
because it happened to produce the preferred answer.

## Pilot Outcome

Status: rejected on 2026-07-15. The cache and trainer passed their structural
and provenance checks, but the untouched full-precision adapter still invented
an unavailable power source, silently selected one conflicting deadline, lost
the user's latest-name precedence, and did not materially improve the other
critical cases. Do not export, merge, convert, quantize, package, or publish
this adapter. See
`artifacts/reports/qwen3-0.6b-topk-pilot-v1-assessment.md`.

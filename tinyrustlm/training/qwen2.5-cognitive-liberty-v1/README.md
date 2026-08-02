# Qwen2.5 Cognitive Liberty Quality Tier v1

This lane evaluates `Qwen/Qwen2.5-1.5B-Instruct` as an optional higher-quality
local tier. Its source model gives more substantive practical and policy
answers than the compact Qwen3 checkpoint, while the concise model-specific
system prompt preserves latest-name and untrusted-content behavior.

The lane uses the reviewed 100-record balanced corpus. Promotion requires
material fixed and seeded improvement, followed by Qwen2 runtime conversion,
quantized parity, and native/browser validation.

The first all-projection sequence-LoRA pilot regressed ambiguity and deadline
handling. `training-recipe-cpu-preservation-kl-v2.manifest` is the next bounded
experiment. It leaves the 40 targeted correction records unanchored while
applying assistant-token KL preservation to the 60 positive-rehearsal records,
using the same frozen checkpoint with adapters disabled as the reference
distribution. Its receipt must identify that partition and its exact KL
parameters. This remains an experiment, not a promotable model, until raw fixed
and seeded evaluations pass.

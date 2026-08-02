# TinyRustLM Quality Sequence Campaign v1

This directory contains human-authored candidate prompts for the first balanced
sequence-distillation campaign. The prompt plan covers six records in each of
the 16 task families enforced by the Rust dataset freeze gate.

The prompt plan is not an evaluation set and does not make a quality claim.
Teacher responses are quarantined as drafts, then require explicit record-level
review before export. The reviewed export still must pass the Rust contamination
freeze against materialized public, shadow, and sealed exclusions before it can
be used by the training worker.

`prompt-plan-v1.jsonl` preserves the first collection experiment. Its teacher
requests omitted the per-record response contract and are retained only as
failure-analysis evidence. `prompt-plan-v2.jsonl` raises the safety ceiling to
256 tokens, while collection appends each response contract to the system
message so concise and structured cases can finish naturally without clipping.
`prompt-plan-v3-refusal-recovery.jsonl` is a targeted recollection for the two
v2 refusal records that still reached the 256-token ceiling; it strengthens the
output shape without changing either user prompt.

`student-system-prompt.txt` is byte-aligned with the system prompt declared by
the current compact SmolLM2-360M `.slm` manifest. Training must not substitute
the teacher-only drafting prompt for this runtime-facing text.

`training-recipe-cpu-pilot.manifest` is a one-epoch throughput and adapter-
compatibility experiment for hosts where CUDA is unavailable. It cannot support
promotion by itself; the five-epoch CUDA recipe and untouched quality gates
remain authoritative for a serious candidate.

`training-recipe-cpu-v1.manifest` uses the pilot's measured resource envelope
to run the same five-epoch rank-8 experiment on CPU. Its adapter must clear the
same native, WASM, browser, footprint, and no-cheat gates as a CUDA-trained one.

Generated teacher responses, review decisions, model weights, and credentials
do not belong in this source directory.

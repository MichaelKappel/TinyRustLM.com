# Qwen2.5 0.5B Same-Tokenizer Top-K Pilot

This lane tests whether a 1.5B Qwen2.5 teacher can improve the 0.5B Qwen2.5
student without increasing the shipped model footprint. It combines two distinct
and honestly labeled signals:

- reviewed Qwen3.6 final answers provide cross-tokenizer sequence targets;
- Qwen2.5 1.5B provides top-128 token distributions because its `tokenizer.json`
  is byte-identical to the 0.5B student's tokenizer.

The top-k cache represents the teacher's selected token probabilities plus one
aggregate residual-tail probability. It is development evidence and is never
packaged into `.slm` runtime artifacts. The cache control, teacher identity,
frozen dataset, cache rows, training recipe, and adapter receipt are SHA-256
bound. A successful build or training run is not a quality claim; promotion
still requires untouched native/browser evaluation and footprint comparison.

## Pilot Outcome

- `sequence-recipe-cpu-v1.manifest` is the matched sequence-only baseline.
- Existing outputs from `training-recipe-topk-kd-cpu-v1.manifest` and
  `training-recipe-topk-kd-cpu-v2.manifest` are invalid audit history. They were
  generated before the custom Trainer declared the Transformers gradient-
  accumulation normalization contract. Do not export or promote those adapters.
- `training-recipe-topk-kd-cpu-v3.manifest` is the corrected top-k run. Its
  accumulation and component-loss evidence pass, but its raw behavior does not.
- The sequence and corrected top-k adapters are both rejected. Read
  `artifacts/reports/qwen2.5-0.5b-topk-pilot-v1-assessment.md` before any reuse.


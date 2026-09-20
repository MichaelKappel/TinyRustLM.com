# TinyRustLM model storage

Model payloads belong only under `D:\LLMs\TinyRustLM`, outside this source
repository and Git. This directory is intended to contain guidance only.

Twenty retired SLM1/ADP1/ACG1 fixture files and sidecars currently remain here:
automatic approval review rejected their exact-file deletion on September 20.
They are not current runtime inputs or qualified models. Their identities and
the blocked operation are recorded in
[`retired-model-fixture-review.json`](../../artifacts/ecosystem-cleanup-20260912/retired-model-fixture-review.json).
Do not retry their deletion through another API or a parent removal. The strict
no-payload index check remains incomplete while these files are present; the
older tracked-fixture exception is not permission to add or execute old models.

The sole current composition contains exactly:

- `model.slm2`
- `tokenizer.tokenizer2`
- `template.template2`
- `sampling.sampling2`
- `prompt.prompt2`
- `composition.acg2`

Current format tests use canonical vector descriptions and test helpers to
construct bounded data during execution. They do not require stored SLM1, ADP1
or ACG1 payloads. The current .NET package consumer is
[`eng/consumer-smoke`](../../eng/consumer-smoke/Program.cs).

MiniModel.org is authorized to provide initial server seeds for qualified current
compositions. A necessary remote serving copy is a deployment artifact; it does
not authorize duplicate local source or model trees. Prompts and inference remain
local. Restore a usable installed composition or acquire a small qualified default;
source import, conversion and manual peers remain Advanced.

Structural validation, fixture tests and package-consumer checks do not qualify a
model for useful conversation or prove a live seed. No qualified default or public
seed is established by removing old fixtures. The unchanged rejected Qwen3-0.6B
checkpoint remains diagnostic ancestry only.

Keep the active payload and bounded work required for its candidate replacement.
After validating and activating the replacement, retire the superseded bytes.
Retain compact identities, results and lessons, with source history in Git.
See [current product guidance](../../wiki/runtime-mirust/reports/tinyrustlm-working-product-memory-2026-09-19.md)
for the outstanding model, browser and publication gates.

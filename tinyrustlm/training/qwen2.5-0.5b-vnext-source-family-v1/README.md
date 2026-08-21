# Qwen2.5 0.5B Converter Reference Source

This directory freezes the current SLM2-compatible reference source used to
prove deterministic full-scale conversion. It does not select this family as
the working-model training target, and it does not admit the official base
checkpoint as a usable model.

The official `Qwen/Qwen2.5-0.5B-Instruct` checkpoint at revision
`7ae557604adf67be50417f59c2c2f167def9a775` is the immutable architecture and
tokenizer base. Its Apache-2.0 license route is reviewed, its 290 tensors are
exactly representable by the current SLM2 profile, and its complete local
source set is bound by `source-lock.v1.json`.

The untouched base screen remains rejected at two passing cases out of eight.
Neither this lock nor a successful structural conversion changes that result.
The updated working-model goal requires a new fully pinned Qwen3-0.6B
derivative. Its head geometry needs an explicit sole-SLM2 architecture contract
before training output can be converted. Any new merged checkpoint must pass a
preregistered untouched source screen before conversion output can enter
native, WASM, browser, or catalog qualification.

`source-family-selection.v1.json` is generated from all 37 tracked assessment
controls. Every one remains rejected, historical identity gaps are explicit,
and `artifactAdmissionStatus` remains `none`.

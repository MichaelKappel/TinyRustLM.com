# Closed Qwen2.5 0.5B Converter Reference

This directory preserves the closed August 20 Qwen2/F32 converter-reference
source lock and selection ledger. These records are historical evidence, not
current converter support, model selection, or admission authority.

The locked `Qwen/Qwen2.5-0.5B-Instruct` checkpoint at revision
`7ae557604adf67be50417f59c2c2f167def9a775` remains rejected at two passing cases
out of eight. Neither its source lock nor a structural conversion changes
that result.

`source-family-selection.v1.json` recorded 37 rejected assessments and
`artifactAdmissionStatus` of `none`. Its historical identities remain unchanged;
the obsolete regeneration tool and matching test are retired. Current rejection
enforcement belongs to
[`source-candidate-exclusions.v1.json`](../../../contracts/vnext/source-candidate-exclusions.v1.json),
which also preserves the owner's separate rejection of unchanged Qwen3 weights.

The current converter implements the Qwen3 mixed-Q8 composition path described
in [`qwen3-slm2-converter-implementation.md`](../../../docs/architecture/qwen3-slm2-converter-implementation.md).
This historical reference does not authorize a training run or qualify any model.

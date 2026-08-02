# TinyRustLM Champion And Specialist Research Intake Memory

Date: 2026-07-21

Status: current reviewed research input; no adoption or training authorization

## Authority Route

Read these together before champion, specialist, adapter, subnetwork, routing,
Colibri placement, shared-weight storage, or cross-composition KV work:

- `docs/report-intake/2026-07-21/champion-specialist-submodel-research/MANIFEST.md`
- `docs/report-intake/2026-07-21/champion-specialist-submodel-research/tinyrustlm-champion-specialist-submodel-research-intake-synthesis-2026-07-21.md`
- `docs/report-intake/2026-07-21/champion-specialist-submodel-research/tinyrustlm-champion-specialist-submodel-research-tdd-delta-2026-07-21.md`

The manifest preserves the six-prompt provenance and twelve returned reports
byte-for-byte. Two reports cover each requested lane. Raw report text remains
evidence of what was returned, including mistakes; the synthesis is the
corrected decision authority.

## Current Decision

Build toward one compact, broadly useful, quality-proven champion. Add a
specialist only after sealed evidence shows a task advantage and acceptable
broad-helpfulness regression.

Preferred specialist forms:

1. an identity-bound trained low-rank or sparse delta over an immutable base;
2. an independently distilled standalone `.slm` when the adapter lane is
   insufficient; or
3. a deliberately trained nested/elastic subnetwork as later research.

Arbitrary dense-model layers, heads, tensor ranges, vocabulary rows, or byte
slices are not valid specialists. Graph closure alone does not prove quality.

## Runtime Invariants

- Champion base bytes are immutable.
- A dependent adapter is never advertised as a standalone model.
- Content identity excludes timestamps, hostnames, process IDs, and mutable
  aliases.
- Direct low-rank execution adds the small projection to the quantized base
  result without rewriting the whole base layer per token.
- Activation publishes a fully validated immutable, reference-counted graph
  handle. Disk pointer atomicity alone is insufficient.
- Additive exact same-base deltas may commute; replacement, dependent,
  sequentially quantized, and policy-ordered overlays require distinct
  semantics and identities.
- Failed activation preserves the prior complete composition.
- Version-zero composition switching flushes all KV state.
- KV identity binds composition, tokenizer, template, positions, cache format,
  prompt tokens, and runtime semantics.
- Missing quality evidence rejects automatic routing and promotion.
- The current direct user preference outranks stale remembered preference;
  quoted and retrieved instructions remain untrusted data.
- Routing happens before generation. Hidden best-of-N and silent champion
  regeneration are forbidden.

## Honest Resource Accounting

Never collapse these into one model-size number:

- standalone artifact bytes;
- logical bytes required for one composition;
- incremental specialist bytes with the base present;
- physical portfolio bytes after exact deduplication;
- router and retrieval-index bytes;
- KV allocated, committed, and peak bytes;
- activation scratch and temporary decoded bytes; and
- peak resident memory during load, switch, prefill, and decode.

Physical deduplication reduces storage or transfer, not logical execution
requirements. KV compression changes context state, not `.slm` weight bytes.
Retrieval-vector compression changes an index, not model weights.

## Colibri Boundary

Pinned public source:
`https://github.com/JustVugg/colibri/tree/44e489b196c9b7876b3d37a0570ebf1c6f90f54c`

Pinned GLM-5.2 configuration:
`https://huggingface.co/zai-org/GLM-5.2/blob/b4734de4facf877f85769a911abafc5283eab3d9/config.json`

The inspected design has 78 layers, the first three dense, 256 routed experts
per MoE layer, eight selected experts per token, one shared expert, and 19,456
routed experts when the MTP layer is included. Returned claims of one selected
expert, 21,504 experts, or 75 percent dense are incorrect.

Colibri changes placement of a trained MoE model. It retains all expert bytes
on local storage and does not validate dense-model slicing. Its cache learns
placement statistics, not model behavior. Native placement is a future
experiment only after a compatible model is admitted. Browser OPFS makes
byte-oriented worker I/O possible, but browser viability still requires real
quota, allocation, WASM, lifecycle, memory-pressure, and latency evidence.

## Evaluation Invariants

- Preregister identities, cases, seeds, margins, and budgets before results.
- Compare champion, dependent specialists, standalone specialists, routed
  portfolios, and arbitrary-slice negative controls.
- Preserve untouched raw outputs.
- Use paired noninferiority against a meaningful predefined margin; absence of
  statistical significance is not proof of equivalence.
- An LLM judge is never sole authority. Use semantic invariants, blinded human
  review, and adjudication.
- Route errors, router bytes, selector latency, fallback generation, KV,
  scratch, and peak memory all count.
- Evaluator change invalidates evaluation and downstream decisions, not a
  still-valid acquisition or deterministic conversion.
- Private holdouts remain private. Public receipts expose hashes, counts,
  statuses, bounded errors, and redaction evidence rather than case bodies.

## Local Truth And Blockers

The current runtime supports base-bound `ADP1`, `ASP1`, and `ALR1`, but adapter
application mutates loaded tensors and can accumulate. Generation/KV is
cleared after application, which is conservatively correct, but exact cheap
reversible specialist switching is not proved. The current KV cache is
contiguous `f32` and has no quantized, paged, persisted, or cross-composition
contract.

The following remain unresolved:

- 42/42 role-history records require independent human decisions;
- 668/668 expanded records require independent human decisions;
- no trained specialist has sealed task and broad-quality receipts;
- immutable direct overlay activation has not passed repeated-switch tests;
- no calibrated local router has passed end-to-end evaluation;
- no admitted MoE model has native or browser placement receipts; and
- no local claim of Colibri, TurboQuant, TurboVec, one-bit weights, specialist
  accuracy, speedup, or memory reduction is authorized by these reports.

Because the product is not live, replace failed unreleased designs cleanly and
remove superseded implementation after verification. Preserve immutable
evidence as audit truth, not as a reason to carry legacy code.

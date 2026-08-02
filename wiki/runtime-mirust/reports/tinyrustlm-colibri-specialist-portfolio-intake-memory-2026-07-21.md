# TinyRustLM Colibri And Specialist Portfolio Intake Memory

Date: 2026-07-21

## Current Truth

Two Colibri reports returned through `agent-file-handoff/Improvement/` and are
preserved byte-exactly under:

`docs/report-intake/2026-07-21/colibri-specialist-portfolio/`

The reports are helpful research input, not implementation authority. They do
not prove current TinyRustLM use of Colibri, TurboQuant, TurboVec, model
fragments, cross-model KV reuse, or specialist routing.

Read these files before changing specialist composition, model placement,
shared model storage, adapter switching, routing, or related cache identity:

- `docs/report-intake/2026-07-21/colibri-specialist-portfolio/MANIFEST.md`
- `docs/report-intake/2026-07-21/colibri-specialist-portfolio/tinyrustlm-colibri-specialist-portfolio-intake-synthesis-2026-07-21.md`
- `docs/report-intake/2026-07-21/colibri-specialist-portfolio/tinyrustlm-colibri-specialist-portfolio-tdd-delta-2026-07-21.md`

## Accepted Direction

- Keep one immutable, broadly qualified champion `.slm` as default and
  fallback.
- Prefer small trained, base-dependent adapters for narrow specialists when
  they pass task quality and broad-helpfulness regression gates.
- Use standalone distilled specialist `.slm` artifacts when a sidecar cannot
  meet quality, size, tokenizer, architecture, context, or latency needs.
- Redesign current destructive cumulative adapter application into exact,
  atomic, reversible composition state before claiming cheap specialist
  switching.
- Bind composition identity to the base, ordered adapters, tokenizer, runtime,
  route policy, quality receipts, and cache policy.
- Report logical execution bytes, incremental specialist bytes, standalone
  bytes, and physical deduplicated storage separately.
- Use content-addressed shared chunks to reduce physical duplication only; do
  not describe that saving as a smaller logical model.
- Treat Colibri-style expert/module placement as future native-companion
  research for an admitted independently loadable architecture.
- Keep static weights, online KV cache, and persistent retrieval vectors as
  separate formats, measurements, and claims.
- Start routing with explicit user selection and deterministic rules. Learned
  routing requires sealed confusion, calibration, fallback, and end-to-end
  evidence.

## Rejected Inferences

- Arbitrary pieces of an ordinary dense model are not independently useful
  specialists.
- Model-level portfolio routing is not mathematically identical to token-level
  MoE routing.
- Colibri does not reduce total model bytes; it trades resident RAM for disk
  I/O while retaining all expert files.
- KV state is not reusable across different model or adapter compositions by
  default.
- TurboQuant-family KV compression does not shrink `.slm` weight bytes.
- TurboVec-family retrieval compression does not store transformer weights.
- Speculative decoding is not available without compatible draft/target
  tokenization and a measured verification path.
- Author estimates and secondary-source speed claims are not TinyRustLM
  browser or native measurements.

## Local Boundary

The current runtime validates `ADP1`, `ASP1`, and rank-bounded `ALR1` packages,
applies them by mutating loaded tensors, and clears KV state after success.
Repeated adapters currently accumulate; exact restoration and cheap switching
are unproven. The current KV cache is contiguous f32 and fully allocated for
the configured context. No trained specialist, quantized KV format, persistent
KV contract, Colibri placement path, or cross-composition cache reuse is
promoted.

The unresolved 42-record and 668-record human review campaigns remain
training blockers. No specialist should be trained from them until independent
review authorizes the corpus.

## Standing Rule

TinyRustLM is not live. Incur no technical debt and preserve no superseded API,
format, or behavior for compatibility. Rewrite the adapter/composition design
cleanly if that is required to satisfy immutable-base, exact-switching, and
fail-atomic invariants. Retain historical receipts and rejected evidence, not
legacy runtime behavior.

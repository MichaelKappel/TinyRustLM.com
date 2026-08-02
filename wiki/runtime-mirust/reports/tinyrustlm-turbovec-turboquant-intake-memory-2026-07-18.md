# TinyRustLM TurboVec And TurboQuant Intake Memory

Date: 2026-07-18

## Current Truth

The July 18 handoff batch is durably preserved and reviewed. It contains twelve
returned reports plus two consumed prompt-provenance artifacts:

- nine reports materially address TurboVec or TurboQuant;
- three reports are preserved but rejected with reason as unrelated;
- the six-prompt TurboVec/TurboQuant assignment is complete as research intake;
  and
- the MemoryEndpoints assignment did not receive a responsive platform report,
  so a new fail-fast retry assignment remains active.

The complete byte-and-hash manifest is:

`docs/report-intake/2026-07-18/turbovec-turboquant-and-handoff-audit/MANIFEST.md`

Manifest SHA-256:
`6efe26a997fa368ed9bc7c7d57552731e7048f2aacf695dac3f6968f1e131086`

The reviewed synthesis is:

`docs/report-intake/2026-07-18/turbovec-turboquant-and-handoff-audit/tinyrustlm-turbovec-turboquant-intake-synthesis-2026-07-18.md`

Synthesis SHA-256:
`72d110535744f4dbb673feb76b5584e7a89e4aeaadc2581235cf37f6f43c2904`

The implementation-neutral TDD delta is:

`docs/report-intake/2026-07-18/turbovec-turboquant-and-handoff-audit/tinyrustlm-turbovec-turboquant-intake-tdd-delta-2026-07-18.md`

TDD SHA-256:
`3b72bc0bc42eb6f7a09438a2bf4c315b16f1e13648cd4f881cd8bae7529c3e2a`

## Engineering Direction

The reports are helpful but not implementation authority. Their durable value
is the following bounded direction:

- keep static weights, online KV cache, and durable embedding indexes as
  distinct formats and evidence lanes;
- treat TurboVec as a young embedded vector-index implementation influenced by
  TurboQuant, RaBitQ, empirical calibration, and fast-scan kernel techniques,
  not as a literal paper implementation or model runtime;
- do not adopt the public crate directly for the browser runtime without pinned
  source, dependency, license, WASM-build, persistence, and parity evidence;
- start with scalar mathematical oracles and deterministic flat retrieval;
- test keys and values separately for KV compression, including RoPE placement,
  recent-token precision, page layout, direct compressed attention, and raw
  conversational regression;
- compare QJL, no-QJL, EDEN-style scaling, RaBitQ-style correction, and
  structured transforms at equal total bytes rather than choosing from claims;
- evaluate reconstruction error, estimator bias, rank preservation,
  attention-logit divergence, and raw downstream behavior as separate
  objectives rather than allowing one metric to stand in for accuracy;
- require native and browser receipts for latency, memory, recall, and quality;
  and
- discard failed experimental formats cleanly, with no legacy reader or
  compatibility shim, because TinyRustLM is pre-release.

No direct references to TurboVec, TurboQuant, QJL, RaBitQ, EDEN, Lloyd-Max, or
Walsh-Hadamard kernels were found in the searched local implementation roots.
This is a bounded name-level source observation, not a mathematical equivalence
audit. TinyRustLM is not currently evidenced as using TurboVec or TurboQuant.

## Claim Boundary

The intake does not establish that three-bit or 3.5-bit KV state is quality
neutral, that any reported speedup transfers to CPU/WASM, that one disputed
algorithm dominates another, that TurboVec is release-ready, or that KV/index
compression changes `.slm` weight precision. Several reports preserve only
agent-internal citation markers rather than portable direct links; all material
claims require new primary-source pinning before implementation.

The three unrelated reports are:

- `Deep Research Plan for an Unspecified Topic.md`;
- `FINER criteria.md`; and
- `Glucagon-like peptide-1.md`.

They are retained for audit but provide no project evidence or work direction.

## Live-Service Boundary

This Codex session is not connected to MemoryEndpoints.com. No individual user
account, hidden workspace binding, enrollment token, restore result, revocation,
company cleanup, or post-delete state has been inspected or validated. The
campaign remains at 0/25 live continuity runs. A generic research response,
mock, fixture, guessed endpoint, or HTTP error cannot close that gate.

## Standing Rule

TinyRustLM is not live. Incur no technical debt, preserve no obsolete format or
API merely for compatibility, and rewrite experimental code when a cleaner
contract is justified. This rule remains active in `.uai/totem.uai`,
`.uai/taboo.uai`, and `workspace.uai` until explicitly removed by the user.

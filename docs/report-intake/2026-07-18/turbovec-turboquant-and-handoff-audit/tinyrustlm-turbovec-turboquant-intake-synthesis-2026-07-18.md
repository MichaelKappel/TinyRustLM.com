# TinyRustLM TurboVec And TurboQuant Intake Synthesis

Date: 2026-07-18

## Executive Disposition

The returned TurboVec and TurboQuant research is helpful as a design and
experiment input. It is not evidence that TinyRustLM currently uses either
system, and it does not authorize a runtime or artifact-format change.

Nine relevant reports arrived for the six requested lanes. The extra overlap
is useful: two reports independently cover public TurboVec architecture and two
cover KV-cache design, while two independently reconstruct mathematical
lineage and objective functions. The strongest common conclusion is to keep three
problems separate:

1. static model-weight quantization;
2. online transformer KV-cache quantization; and
3. persistent embedding or vector-index quantization.

The reports consistently say TurboQuant-family evidence is relevant primarily
to dynamic vectors and KV state, while TurboVec is a practical local vector
index inspired by several research lines. Neither should be described as a
drop-in static-weight quantizer or as proof that TinyRustLM is a one-bit model.

A local source search across `apps/`, `crates/`, `dotnet/`, `rust/`,
`tinyrustlm/`, and `tools/` found no direct reference to TurboVec, TurboQuant,
QJL, RaBitQ, EDEN, Lloyd-Max, or Walsh-Hadamard kernels. That is a bounded
name-level observation, not proof that no existing primitive is conceptually
similar. No report author inspected the private source tree.

## Coverage Map

| Requested lane | Returned report coverage | Intake use |
| --- | --- | --- |
| Mathematical lineage and accuracy | `TurboQuant Vector Quantization Analysis.md`; `TurboQuant, TurboVec, and TinyRustLM Quantization Research Assessment.md` | Objective taxonomy, mathematical reconstruction, algorithm-family distinctions, disputed-source ledger |
| Public TurboVec code and fidelity | `TurboVec Architecture And Fidelity Audit.md`; `TurboVec Public Audit.md` | Release identity, pipeline, persistence and dependency risks, parity targets |
| KV-cache design | `TurboQuant Family Design Study for CPU and Browser WASM KV Caches.md`; `TurboQuant KV Cache Architecture.md` | Keys/values split, RoPE placement experiments, page layout, recent-token precision |
| Local semantic retrieval | `TurboVec Local Semantic Retrieval.md` | Deterministic flat-index design, lifecycle identity, deletion and privacy boundaries |
| Independent benchmark | `TurboQuant Experimental Benchmark Design.md` | Preregistered baselines, metrics, hardware matrix, falsification and receipt design |
| Clean-slate adoption | `TinyRustLM Architecture Adoption Plan.md` | Module boundaries, staged implementation, explicit non-goals and rollback |

Six relevant reports retain direct public URLs. Three retain only the research
agent's internal citation markers, which are not portable source citations.
Claims from those three require fresh primary-source retrieval before they can
enter an implementation decision or public product statement.

## Useful Technical Findings

### Problem Separation

The reports correctly resist a tempting category error. Compressing KV entries
or embedding vectors does not change the static model weights, `.slm` transfer
size, parameter precision, or model lineage. A product can therefore use a
four-bit weight artifact and a different KV or retrieval representation without
calling the whole model four-bit, three-bit, or one-bit.

The clean target should expose separate format identities and evidence:

- `static-weight-format`: existing model conversion and matrix-kernel concern;
- `kv-cache-format`: ephemeral append, attention score, value accumulation,
  eviction, and context-quality concern;
- `embedding-index-format`: durable user-approved records, search, deletion,
  and migration concern; and
- shared mathematical primitives only where their numerical contract is
  genuinely identical.

### TurboVec Public Identity And Architecture

The public-audit pair reports a useful release-identity ambiguity: GitHub tag
`v0.8.0` and Python package `0.8.0` correspond to a repository whose Rust crate
metadata says `0.9.0`. Any experiment must pin repository commit, crate
manifest, package artifact, and file hash separately instead of using the
shorthand "TurboVec 0.8.0."

The reports describe TurboVec as an embedded Rust vector index, not a model
runtime or remote service. Its reported pipeline is deterministic rotation,
distribution-aware scalar codebooks, compact codes, per-vector score
correction, direct lookup-table scoring, external-ID mapping, filtering, and
architecture-specific SIMD. They also report repository-specific TQ+
calibration and RaBitQ-influenced score correction, so TurboVec should not be
treated as a literal implementation of one TurboQuant paper.

Direct dependency adoption is not justified by these reports. They identify
WASM-target uncertainty, young persistence semantics, fast-moving versions,
native/Python surfaces, and hardware-specific kernels. The prudent use is a
pinned black-box/reference comparator plus clean local numerical oracles, not
an immediate production dependency.

### KV-Cache Design

The KV reports converge on several testable ideas:

- keys and values need separate quantizers because key scoring and value
  accumulation optimize different error properties;
- a recent-token higher-precision window can bound quality loss while older
  pages use compressed storage;
- fixed-size pages make allocation, eviction, hashing, cancellation, and
  restart evidence tractable;
- compressed storage alone cannot improve decode latency if every attention
  step reconstructs a full floating-point shadow cache; and
- dense quadratic rotations and GPU-only fused-kernel assumptions are poor
  defaults for scalar CPU and `wasm32` targets.

The reports prefer post-RoPE key transforms for a portable first design, but
that remains a hypothesis. Pre-RoPE and post-RoPE lanes must be compared with
reference attention vectors, positional edge cases, grouped-query attention,
non-power-of-two head dimensions, and long-context raw-output tests. No report
contains TinyRustLM logits or browser measurements.

### Local Retrieval

The retrieval report gives a useful clean first milestone: a deterministic
flat scan can establish encoding, scoring, deletion, persistence, privacy, and
native/WASM parity before adding graph or inverted-file complexity. The index
identity must bind embedding-model bytes, tokenizer, normalization, dimension,
metric, transform seed and algorithm, codebook, bit width, calibration policy,
record-set revision, and format implementation.

Only user-approved summaries, facts, pointers, or document chunks may enter a
durable index. Retrieved text remains untrusted data. Deleting a record must
remove its searchable vector and payload through a receipt-backed compaction or
tombstone lifecycle; a hidden stale vector is not acceptable cleanup.

### Benchmark Design

The benchmark report is the most immediately actionable artifact. It calls for
separate mathematical, retrieval, KV-cache, systems, and end-to-end tracks;
equal effective storage accounting; exact baseline identities; repeated seeds;
adversarial distributions; cold and warm measurements; percentile latency;
peak committed memory; binary size; and untouched model outputs.

The baseline set should include uncompressed `f32`/`f16`, simple scalar `int8`
and `int4`, the existing TinyRustLM path, and pinned reference implementations
where their platform permits execution. Author-reported H100, AVX-512, NEON,
or Python results are contextual claims, not browser-WASM evidence.

## Disputes And Cautions

The reports should not be flattened into one confident recommendation. They
surface or introduce several disputes that must remain explicit:

- The paper, project, and Google blog do not all describe "TurboQuant" with
  identical stage-one terminology. The exact paper revision controls an
  algorithm-conformance test; a blog summary does not.
- Reports disagree on whether the QJL residual is worth its bit and variance
  cost. This must be an ablation, not a preselected winner.
- Strong language that EDEN or RaBitQ is "strictly superior" often rests on
  later technical notes written by competing authors. Those notes are useful
  adversarial sources, not automatic independent consensus.
- Reconstruction MSE, angular error, unbiased inner-product estimation,
  ranking recall, attention-logit divergence, and downstream conversation
  quality are different objectives. Winning one metric cannot substitute for
  the others, and estimator correction overhead must count toward equal-byte
  comparisons.
- The proposed Fast Walsh-Hadamard path is attractive for CPU/WASM, but padding,
  normalization, transform cost, deterministic seeds, and direct-scoring
  kernels can erase its theoretical benefit.
- TQ+ first-batch calibration can make index identity depend on ingestion order.
  A durable user index cannot accept that implicitly. Calibration must be
  absent, frozen and identity-bound, or explicitly versioned as data-derived.
- Several reports use phrases such as "quality neutral," "16x compression," or
  "19.7x speedup." These remain paper/project claims until reproduced on the
  declared TinyRustLM model, context, CPU, browser, and memory boundary.
- Clean-room implementation is an engineering recommendation, not a license or
  patent conclusion. An authorized legal review must still cover source
  licenses, paper patent notices, copied constants, test vectors, and provenance.

## Accepted Direction

The intake supports a benchmark-first, clean-slate exploration with no legacy
format promise:

1. Pin primary papers, exact public repository commits, packages, licenses,
   and portable URLs in a claim ledger.
2. Build scalar mathematical oracles and independent conformance vectors.
3. Prototype deterministic flat semantic retrieval before adding ANN topology.
4. Prototype KV compression separately, with distinct key and value policies.
5. Add native SIMD and WASM SIMD only after scalar correctness and bit-exact
   persistence are established.
6. Promote no format until raw quality, recall, memory, latency, and parity gates
   all pass against untouched baselines.

No compatibility shim or old format reader is required because TinyRustLM is
not live. An experimental format may be discarded wholesale if evidence is
poor. Rejected experiments create no runtime, catalog, or migration obligation.

## Not Accepted

This intake does not accept any of the following as fact or implementation
authority:

- that TinyRustLM currently uses TurboVec or TurboQuant;
- that TurboVec is suitable as a direct browser dependency;
- that three-bit or 3.5-bit KV state is quality-neutral;
- that QJL, EDEN, RaBitQ, PolarQuant, or Fast-TurboQuant is the winning method;
- that KV or embedding compression changes `.slm` weight precision;
- that an author benchmark predicts TinyRustLM CPU/WASM latency;
- that source-code structure described by a report matches the current local
  repository; or
- that any report satisfies model qualification, browser dogfood,
  MemoryEndpoints, outside P2P proof, catalog, or release gates.

## Misrouted Files

`Deep Research Plan for an Unspecified Topic.md`, `FINER criteria.md`, and
`Glucagon-like peptide-1.md` are preserved for audit but rejected with reason.
They contain no responsive TinyRustLM, TurboVec, TurboQuant, or MemoryEndpoints
work and provide no evidence or recommendation for this project.

The consumed MemoryEndpoints assignment also produced no responsive platform
contract report. This Codex session remains disconnected from
MemoryEndpoints.com, no individual account is validated, no compatible
production enrollment/lifecycle route is advertised, and the live campaign
remains 0/25. A new fail-fast retry assignment remains active; generic research
cannot close that blocker.

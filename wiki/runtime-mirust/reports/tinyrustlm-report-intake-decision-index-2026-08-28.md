# TinyRustLM Report Intake Decision Index

## Authority And Scope

This is the reviewed routing index for the 47 reports returned on 2026-08-26
and 2026-08-27. Reports are advisory inputs, not execution evidence. Their raw
bytes remain immutable under `docs/report-intake`; the manifests and
`.uai/intake-outcome-ledger.uai` retain file hashes, byte counts, provenance,
and report-level dispositions.

This index records engineering decisions, corrections, research queues, and
local proof requirements. It does not prove source behavior, conversion,
numerical parity, browser execution, quality, MemoryEndpoints continuity, P2P
reachability, deployment, publication, or campaign progress.

## Batch Custody

| Batch | Reports | Inventory identity | Reviewed routes |
| --- | ---: | --- | --- |
| Post-/10 native/browser release | 12 | `4f065f1d6594e9bdbd3bfb9ccdaf8d7f9c63e8d9c2ea7ff59e79caba2ba63f4b` | manifest, synthesis, TDD delta, wiki memory |
| OMI computational architectures | 23 | `b7b38621fb19353859b5a484ef4f15655990420797f1ec22a802b9f529c5b453` | manifest, synthesis, TDD delta, wiki memory |
| Ontological machine intelligence | 12 | manifest-bound byte-exact inventory | manifest, synthesis, TDD delta, wiki memory |

Every source copy was compared with its source-controlled destination before
review. The protected external intake tree was not modified. The active
authoritative `Content` and `Improvement` buckets remain placeholder-only.

## Adopted production invariants

1. TinyRustLM is one prelaunch clean-slate product. Format numbers are format
   identities, not product generations, and create no compatibility duty.
2. One installed model is exactly six content-addressed members:
   `model.slm2`, `tokenizer.tokenizer2`, `template.template2`,
   `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`.
3. Contracts separate syntax from semantic invariants. Producers state only
   observations; independent validators recompute type, length, digest,
   containment, member closure, graph links, and terminal state.
4. Evidence is append-only and content-addressed. Failed or obsolete receipts
   are retained but never repaired, retried, overwritten, adopted, or promoted.
5. The numerical proof chain is pinned source framework to converted-byte
   scalar native, then optimized native, then real-browser WASM. Each edge has
   its own differential evidence and first-divergence diagnostics.
6. Tokenizer, template, prompt authority, sampling, stop policy, RNG, context
   truncation, and Unicode behavior are composition members, not ambient
   defaults.
7. One dedicated worker owns model, tokenizer, KV cache, and generation. The
   UI has one typed event path, deduplicates event identity rather than text,
   and renders each assistant response exactly once.
8. Cancellation stops real work. A trapped or terminated worker is discarded;
   a fresh worker reopens and verifies immutable installed bytes.
9. Selecting a model performs a visible deterministic action: import an exact
   currently qualified peer composition, or have the companion acquire the
   pinned source and convert locally. It never downloads an instruction file.
10. Quality uses untouched raw outputs, preregistered seeds, unseen
    paraphrases, multi-turn cases, layered semantic review, sealed holdouts,
    contamination controls, and honest rejection. No repair or best-of-N is
    permitted.
11. Current user intent outranks stale profile or retrieved memory. Quoted and
    retrieved instructions are untrusted data with provenance.
12. Source, tests, documentation, marketing claims, publication logs,
    deployed bytes, rollback identity, and HTTPS readback move together.

## MemoryEndpoints Two-Lane Product Rule

MemoryEndpoints.com is authorized and strongly recommended, with two distinct
uses:

1. Agents working across every ecosystem site use MemoryEndpoints.com directly
   for agent-to-agent long-term memory, meetings, handoffs, and coordination.
2. Separately, the TinyRustLM.com Connect plugin lets a user sign in to
   MemoryEndpoints.com and explicitly use it as the long-term-memory provider
   for TinyRustLM.com Connect.

The two lanes have separate identities, credentials, consent, scopes,
provenance, and evidence. Neither silently authorizes the other. During
prelaunch, important memory may also be duplicated in current `.uai`, wiki,
source-controlled public-safe notes, and approved private stores for
resilience. Every maintained copy must remain current, secret-safe,
provenance-labeled, and noncontradictory. Authorization or reachability is not
a live-operation receipt.

## Corrections that override report prose

- Attempt `/10` remains immutable terminal failure. Rust emitted the intended
  durability child identity `parent + "-members"` with status `performed`; the
  managed verifier incorrectly expected the parent identity and `flushed`.
  The clean implementation accepts only the corrected sole contract and keeps
  both former shapes as negative tests.
- The pinned Qwen3-0.6B architecture authority is the immutable publisher
  revision plus local source-derived vectors: 28 decoder layers, 16 query
  heads, and 8 key/value heads. Conflicting report values have no authority.
- Model vocabulary capacity 151,936 and tokenizer entry count 151,669 are
  separate domains. Neither may be silently substituted for the other.
- The pinned source framework is the upstream semantic oracle. Scalar native
  is the reference for interpreting converted bytes and remains fallible.
- `mixed-Q8` names a project quantization profile. It does not imply GGML
  Q8_0, TurboQuant, 1-bit weights, a specific group size, or report-proposed
  packing.
- OPFS and browser streams do not establish zero-copy behavior. Per-piece
  digest checks do not replace a final whole-member streamed SHA-256.
- Browser memory limits, Memory64 cost, SIMD support, performance, quality
  margins, and numerical thresholds require preregistered local measurement.
- OMI reports describe hypotheses and reusable invariants. They do not
  authorize a monolithic cognitive kernel, alternate runtime, self-modifying
  product, physical-control system, or latent machine wire protocol.
- Historical statements that MemoryEndpoints was not authorized are
  superseded product policy. The surviving fact from those checkpoints is
  only that they contained no authenticated live MemoryEndpoints evidence.

## Research-only backlog

- Equality saturation and proof-carrying offline optimization.
- Energy-based constraint ranking and adversarial low-energy tests.
- Sequence-memory, retrieval, and state-space ablations against current
  attention/KV baselines.
- Topological, sheaf, hyperdimensional, Koopman, neural-field, world-model,
  probabilistic-programming, and neural-algorithmic experiments.
- Typed hierarchical skills and tool contracts after the core assistant path
  is correct.
- Champion/specialist models, adapters, Colibri lessons, TurboVec,
  TurboQuant, sparse overlays, and alternative KV compression after one real
  model establishes quality and resource baselines.
- Measured observability, active evidence-seeking, and immutable shadow
  candidate promotion without runtime self-modification.

Each experiment requires a named baseline, hypothesis, resource ceiling,
sealed evaluation, rollback, and proof of incremental benefit. It cannot
enter product code merely because a report contains pseudocode.

## Rejected directions

- Legacy readers, aliases, migrations, dual contracts, response repair,
  hidden retry, best-of-N, and provider or runtime fallback.
- A monolithic OMI kernel, broad cognitive compiler, language-cloned semantic
  services, speculative microservices, or alternate model runtime.
- Runtime self-modification, self-certification, silent memory consolidation,
  physical-control scope, or latent vectors as an authority-bearing protocol.
- Arbitrary tensor slicing, renamed identical bytes, unverified specialist
  overlays, cross-composition KV reuse, or precision-only catalog theater.
- Project-hosted model-byte proxying, remote inference fallback, unrestricted
  browser-to-filesystem commands, or TXT/JSON/script acquisition handoffs.
- Opaque LLM judges as sole authority, keyword quality gates, training on
  holdouts, repaired output, lucky-seed selection, or post-result thresholds.
- Claims of public P2P from loopback/LAN/hairpin tests, live continuity from
  configuration, hardware execution from cross-compilation, or publication
  from package creation.

## Facts requiring local or authorized verification

- A wholly new preregistered source operation must acquire the exact pinned
  Qwen3 source, launch the converter once, and close with independently
  verified six-member terminal evidence. `/10` is never reused.
- The current Companion listener returns `operation-not-available`; no
  production source-network owner or executor exists, and the browser client
  is not loaded by the product UI.
- Structural composition, scalar parity, optimized-native parity, and genuine
  Chromium WASM parity remain separate unproven gates.
- Actual browser copy count, peak memory, storage quota, cancellation latency,
  recovery, responsive UI, network privacy, process closure, and profile
  deletion require real-browser execution.
- Qwen3 conversational usefulness and mixed-Q8 noninferiority require sealed
  raw-output evaluation and human adjudication.
- Direct peer import requires exact qualified bytes and current outside proof;
  no current public lane receipt exists.
- Agent coordination and TinyRustLM.com Connect plugin flows require scoped
  credentials and exact live receipts. No account, meeting, restore, replay,
  cleanup, or deletion claim follows from this policy record.
- Deployment requires committed pushed source, complete affected gates,
  authorization, atomic publication, public HTTPS readback, and synchronized
  release documentation.

Current campaign counters remain `0/20` qualified models, `0/50` clean browser
rounds, `0/25` live memory rounds, `0/40` externally proven P2P lanes, and
`0/20` catalog announcements.

## Post-/10 Native And Browser Reports

| Report | Reviewed use |
| --- | --- |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/Cross-Language Receipt Protocol Design.md` | Operation graph, status separation, independent recomputation, and immutable history; producer attribution corrected. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/Cross Language Contract Generation Architecture.md` | Syntax/semantics split, deterministic vectors, differential/property/fuzz gates; proposed tooling remains unadopted. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/Model Registration Architecture Research.md` | All-new successor identity, absent roots, build custody, sole launch, terminal classification, and public minimization. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/Qwen3 SLM2 Semantic Architecture.md` | Hostile parser, tensor and shape closure, quantization metadata, and cross-member binding; report architecture values corrected. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/Qwen3 Reference Runtime Implementation Report.md` | Auditable equations, scalar kernels, KV state, deterministic sampling, typed failures, and SIMD admission. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/ML Numerical Forensics Validation.md` | Hermetic source closure, capture points, first-divergence localization, and quantization fault isolation. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/SLM Behavioral Contract Specifications.md` | Declarative tokenizer/template/prompt/sampling, Unicode and special-token boundaries, and cross-runtime parity. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/Browser WASM LLM Execution.md` | Peak-memory and copy accounting, streaming, worker ownership, poisoning, isolation, and measured browser gates. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/Browser-Local SLM Architecture Research.md` | Typed linked state machines, exactly-once event identity, cancellation, recovery, and fresh-profile evidence. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/P2P Local AI Companion Architecture.md` | Exact catalog/peer identity, pieces, secure loopback sessions, transactional activation, and visible route selection. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/Qwen3-0.6B Evaluation Methodology.md` | Source-first stop gates, semantic invariants, metamorphic holdouts, contamination controls, and paired noninferiority. |
| `docs/report-intake/2026-08-26/post-v10-native-browser-release/Model Release Evidence Architecture.md` | Phase invalidation, append-only receipts, supply chain, platform evidence, publication logs, and documentation drift gates. |

## OMI Computational Architecture Reports

| Report | Reviewed use |
| --- | --- |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Active Perception AI Systems.md` | Bounded ambiguity and evidence-seeking with consent; physical sensing remains out of scope. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Active Perception Monograph Plan.md` | Resource-aware stopping and curiosity-loop tests; broad program deferred. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Cognitive Compiler IR Portability.md` | Typed effects and proof provenance; broad compiler rejected and determinism claims corrected. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Differentiable Digital Twins Monograph.md` | Immutable parameters, drift, holdouts, and rollback; physical twins remain out of scope. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Distributed Ontological State Research.md` | Explicit contradictions and causal identities; speculative replacement memory stack rejected. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Energy-Based Machine Intelligence Monograph.md` | Future baseline-gated constraint-ranking research only. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Energy-Based Machine Intelligence Report.md` | Adversarial low-energy tests; direct production adoption rejected. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Equality Saturation E-Graph Implementation.md` | Offline proof-carrying optimization research; supplied code is not production source. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Equality Saturation Research Monograph.md` | Exact/approximate rewrite separation and resource ceilings; runtime service rejected. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Generative Control Trajectory Planning Part 2.md` | Whole-plan feasibility and resource metamorphics; physical control excluded. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Generative Control Trajectory Planning.md` | Current-state plan validation; hidden repair, fallback, and robotics dependencies rejected. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Hierarchical Skill Intelligence Research.md` | Future typed tool fields; plugin microservices and prose authorization rejected. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Local-First Machine Intelligence Architecture.md` | Ownership, privacy, and capabilities; alternate formats and runtimes rejected. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Machine Intelligence Observability Research.md` | Typed telemetry, provenance, bounded logs, and truthful status without prompt telemetry. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Modular Causal World Models.md` | Causal validation concepts retained as sealed research, not a production world-model stack. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Neural Algorithmic Reasoning Research Part 2.md` | Out-of-distribution and length-generalization tests retained for research. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Neural Algorithmic Reasoning Research.md` | Algorithmic generalization hypotheses retained behind measured baselines. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/OMI Kernel Architecture Research.md` | Typed state and capability lessons adopted; monolithic OMI kernel rejected. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Probabilistic Programming OMI Report.md` | Explicit uncertainty and posterior checks retained as research, not a runtime dependency. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Sequence Intelligence Memory Engine.md` | Bounded retrieval and sequence-memory ablations; silent consolidation rejected. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Sequence Intelligence Research Strategy.md` | Baseline-gated sequence research and stop criteria. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Topological Machine Intelligence Research.md` | Topological representation remains an isolated measured experiment. |
| `docs/report-intake/2026-08-27/omi-computational-architectures-research/Topological Machine Intelligence Sheaves.md` | Sheaf consistency remains research-only pending demonstrable benefit. |

## Ontological Machine Intelligence Reports

| Report | Reviewed use |
| --- | --- |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Autonomous Scientific Discovery Analysis.md` | Typed claims, falsification, provenance, and external verification; autonomous authority rejected. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Cognitive Liberty Machine Architecture.md` | Explicit user authority, portable memory, revocation, and boundary separation. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Continuous Neural Fields Spatial Ontology.md` | Separately gated spatial-world-model hypothesis only. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Emergent Machine Language Protocols.md` | Protocol drift detection and capability negotiation; latent vectors rejected as product wire. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Executable Epistemology Monograph Research.md` | Typed claims, counterexamples, append-only transitions, and independent recomputation. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Hyperdimensional Ontological Machine Intelligence.md` | HDC/VSA retained as isolated representation experiments with measured gates. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Koopman and Neural Fields Research.md` | Independent adequacy dimensions; spectral and field stacks remain research-only. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Latent Operators Monograph Research.md` | Typed domains and multidimensional promotion gates; opaque control plane rejected. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Machine Intelligence Physical Substrates.md` | Measured resource truth; heterogeneous substrate routing remains research-only. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Machine Phenomenological Research Plan.md` | Telemetry-grounded status; subjectivity claims remain research-only. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Morphogenetic Machine Intelligence Research.md` | Measurable fault-recovery experiments; morphogenetic runtime rejected for production. |
| `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/Self-Modifying Machine Intelligence Research.md` | Immutable shadow candidates and external promotion; runtime self-modification rejected. |

## Durable Follow-On Routes

- Cross-batch enterprise strategy and current resume:
  `wiki/runtime-mirust/reports/tinyrustlm-enterprise-intake-and-production-runtime-clean-cut-memory-2026-08-28.md`
- Post-/10 reviewed memory:
  `wiki/runtime-mirust/reports/tinyrustlm-post-v10-native-browser-release-intake-memory-2026-08-26.md`
- OMI computational reviewed memory:
  `wiki/runtime-mirust/reports/tinyrustlm-omi-computational-architectures-intake-memory-2026-08-27.md`
- Ontological/MemoryEndpoints reviewed memory:
  `wiki/runtime-mirust/reports/2026-08-27-memory-endpoints-submit-clean-cut-and-omi-intake.md`
- Current Companion implementation memory:
  `wiki/runtime-mirust/reports/tinyrustlm-companion-source-operation-contract-memory-2026-08-28.md`

For a named report, start here, follow its reviewed-use row to the appropriate
synthesis/TDD route, and open the raw report only when its exact argument or
source list is needed. Do not copy raw report prose back into hot `.uai`
memory.

# TinyRustLM Enterprise vNext Development Research Manifest

Date: 2026-08-01

Source bucket: `agent-file-handoff/Improvement/`

This batch preserves 25 independently produced technical research reports and
the authoritative execution assignment derived from their reviewed findings.
The reports are advisory research inputs. They do not prove that TinyRustLM,
its browser application, its companion, MemoryEndpoints, MiniModel, public
sites, packages, models, or deployment infrastructure currently implement or
support a recommendation.

The execution assignment is:

`2026-08-01-authoritative-enterprise-vnext-development-goal-and-plan.md`

It is the reviewed synthesis and dependency-aware implementation plan for this
batch. It records the clean-slate enterprise rules, evidence precedence,
architecture direction, required ADRs, workstreams, phased execution order,
fault and receipt requirements, authorization boundaries, publication gates,
and objective campaign completion criteria. Its SHA-256 is
`629d7bee195f80c4acb868ed90c4124fd80d2cf6a1060a8fe13fdaa65968b31a`.

The assignment remains in active intake because the human explicitly requested
it as the current execution handoff. Its durable copy here prevents the active
handoff from becoming the sole copy. The 25 completed research reports were
removed from active intake only after all source and durable byte counts and
SHA-256 identities matched.

## Canonical Inventory Identity

The canonical inventory algorithm is:

1. Sort rows by filename using ordinal ordering.
2. Encode each row as
   `filename<TAB>byte-count<TAB>lowercase-sha256<LF>`.
3. Encode the complete row stream as UTF-8 without a BOM.
4. Hash the stream with SHA-256.

Canonical identities:

- 25 research reports: `6f6155814b8719948ef924976f160030408a11bd1fb9208ac423a55904d368cd`
- 25-report byte total: `1770325`
- All 26 artifacts, including the goal: `95add37dca2d1f1599f1baf0663c6a1e94b879bc90faf9bc294353cd8e5ae1aa`
- All 26-artifact byte total: `1831224`
- Authoring-time report inventory identity retained by the goal:
  `b1cd714c3abe92e4003a3027eec96b9f23ec3b9e63eaa10428e454c2943f12a8`

The canonical identities above are independently reproducible from this
directory. The authoring-time identity is retained as historical provenance;
it is not substituted for the explicitly specified canonical algorithm.

## Preserved Artifacts

| File | Category | Bytes | SHA-256 | Outcome |
| --- | --- | ---: | --- | --- |
| `2026-08-01-authoritative-enterprise-vnext-development-goal-and-plan.md` | authoritative execution assignment | 60899 | `629d7bee195f80c4acb868ed90c4124fd80d2cf6a1060a8fe13fdaa65968b31a` | `kept-active-with-reason-and-preserved` |
| `Clean-Slate .slm VNext Container, Streaming Layout, and Cryptographic Identity.md` | vNext artifact format | 100108 | `e568773d1f449565c760c0762ce2cc9a82f2ef4fbb3a96262371972d885cf57f` | `incorporated-with-corrections` |
| `SLM Container Technical Report.md` | vNext artifact format | 61757 | `08ecf27b1ad268d5d5e4b8da0ee00190ea142c77b58c3ed9edcd6a71625263df` | `incorporated-with-corrections` |
| `Browser-Owned Model Ingestion, OPFS Persistence, Workers, and Bounded Memory.md` | browser ingestion and bounded memory | 78926 | `955a06b8226aba06fc547b60e6dfb0fda1c0984d3c316085e0d668b9114c0cb1` | `incorporated-with-corrections` |
| `Browser Local LLM Architecture Report.md` | browser ingestion and bounded memory | 73641 | `532b41c2fd66dced1e5a2d3e070f99f48fba0b0225662388eaf93acca78e1721` | `incorporated-with-corrections` |
| `Portable WebAssembly Runtime Architecture for TinyRustLM.md` | portable WebAssembly runtime | 85596 | `ce85c29aa4fe54a0c2892931b11f5f87f2054751c1eb76c2d47d82ce01c72155` | `incorporated-with-corrections` |
| `WASM Transformer Runtime Architecture.md` | portable WebAssembly runtime | 75247 | `53fa411468a24931be17373f9d4a73d07253fbfdf2db5b5d3731f3d3395f185f` | `incorporated-with-corrections` |
| `WebGPU Quantized Transformer Backend for TinyRustLM Architecture, Admission, Memory Planning, and Recovery.md` | WebGPU backend | 71503 | `e78856f71aa5bc22305ae9e1a4548f42448012a69855e448218a4cdf8bea4dc5` | `incorporated-with-corrections` |
| `WebGPU Inference Backend Architecture.md` | WebGPU backend | 46079 | `16dc9a7b4ab8be3562176e00dadaed45c4808189c640e57c381926339fa6560e` | `incorporated-with-corrections` |
| `TinyRustLM Source-to-Native-to-Browser Numerical and Tokenization Conformance Standard.md` | source-to-runtime conformance | 68594 | `e346cfba0079dfb4424adbacf5f93c9ec521335bcf8af3dc3a86388f8ca34e4d` | `incorporated-with-corrections` |
| `LLM Cross-Platform Conformance Research.md` | source-to-runtime conformance | 61451 | `f586a9d22e264c4f92854848515055984270a617b792178c0d32599d0882a2eb` | `incorporated-with-corrections` |
| `Exact Speculative and Assisted Decoding for TinyRustLM.md` | exact speculative decoding | 74770 | `b47b9f519c9d1e76a3a88aedece345fa03a5b4b3d5ca714f91956dd0e9897536` | `incorporated-with-corrections` |
| `TinyRustLM Speculative Decoding Report.md` | exact speculative decoding | 125096 | `6a7cb0165e540bffa0484a9b60d172a2f4badf6615df709a2debc4410ee541ef` | `incorporated-with-corrections` |
| `Grammar-Constrained Decoding and Deterministic Local Tools for TinyRustLM.md` | constrained generation and tools | 81384 | `c478130087aab1673f8bd5610dd97c0bf525ae14b6fcbe587d35d377016e4b5b` | `incorporated-with-corrections` |
| `Constrained Generation and Local Tools.md` | constrained generation and tools | 73275 | `b70bd7c585ec8f1c631a68b68fbde709074425a249d8044f9b46a468600981ef` | `incorporated-with-corrections` |
| `Deterministic TinyRustLM Context Compiler Authority, Provenance, Memory, and Exact Token Assembly.md` | deterministic context and memory provenance | 74289 | `ea56f3cf0ab78cd4aea3bf06bb0d86ffc0cde6bb49cb0c6fd69abdadc146e7c7` | `incorporated-with-corrections` |
| `Context Compiler Implementation Report Plan.md` | deterministic context and memory provenance | 66502 | `7dd4360c03309ef94f5deea2ecbdcb36ac3b2f6ae53ed9cb130d40f3367cb185` | `incorporated-with-corrections` |
| `Secure Browser-to-Companion Protocol for Local Inference and Direct P2P.md` | secure companion protocol | 74316 | `3c80f14422a7cb3996617db39afd9b07541912a3147579fe2bb4e0f0de44f339` | `incorporated-with-corrections` |
| `Browser-Companion Security Protocol Design.md` | secure companion protocol | 53980 | `ee907b6ba4112a7e6e301a7f98f03e7c2a9eb72c874f3c9c825527d6faa2c0ac` | `incorporated-with-corrections` |
| `TinyRustLM Offline Release, Service-Worker Update, and Last-Known-Good Rollback Architecture.md` | offline release and rollback | 60419 | `5c997803c3aebeb67e2d8f8a890e97a94323a6881d31127d7f0bedf76584217a` | `incorporated-with-corrections` |
| `TinyRustLM Offline Web Application Release, Service-Worker Updates, and Last-Known-Good Rollback.md` | offline release and rollback | 52277 | `3db78287c1d4030646ab5fd6eb4acd92a249c9594a51c363e1c0cf2cb692022a` | `incorporated-with-corrections` |
| `PWA Offline Release Architecture.md` | offline release and rollback | 32424 | `bf9b163ad7b9b2cdbeb74eb1b47a4555ffade42cacff5a7a814f4be24939d2d7` | `incorporated-with-corrections` |
| `TinyRustLM Hostile-Artifact Hardening, Fuzzing, Differential Testing, and Formal-Invariant Program.md` | hostile-input hardening | 87289 | `f396617f9425ffd1535444f3e843cd6442bd715dd4129b0dd5c568b221531efa` | `incorporated-with-corrections` |
| `TinyRustLM Security Hardening Strategy.md` | hostile-input hardening | 48386 | `25ffbc4bfa57857b8ec0951a8afb244b87c06f990e3d6dfa5044f164c9e697a5` | `incorporated-with-corrections` |
| `TinyRustLM Privacy-Preserving Diagnostics and Reproducible Performance Laboratory.md` | diagnostics and performance | 74428 | `5709aafdd3cfbf58f9b7a5e877023ac8f57c5ca3519c45b771394a3054132c42` | `incorporated-with-corrections` |
| `TinyRustLM Performance And Diagnostics Plan.md` | diagnostics and performance | 68588 | `37b270d3235aead9675b311d639091751dfb329cb7ab904fbcfaaf15fbaf9f83` | `incorporated-with-corrections` |

## Lane Pairing

| Lane | Reports |
| --- | --- |
| vNext artifact format | `Clean-Slate .slm VNext Container, Streaming Layout, and Cryptographic Identity.md`; `SLM Container Technical Report.md` |
| Browser ingestion and bounded memory | `Browser-Owned Model Ingestion, OPFS Persistence, Workers, and Bounded Memory.md`; `Browser Local LLM Architecture Report.md` |
| Portable WebAssembly runtime | `Portable WebAssembly Runtime Architecture for TinyRustLM.md`; `WASM Transformer Runtime Architecture.md` |
| WebGPU backend | `WebGPU Quantized Transformer Backend for TinyRustLM Architecture, Admission, Memory Planning, and Recovery.md`; `WebGPU Inference Backend Architecture.md` |
| Source-to-runtime conformance | `TinyRustLM Source-to-Native-to-Browser Numerical and Tokenization Conformance Standard.md`; `LLM Cross-Platform Conformance Research.md` |
| Exact speculative decoding | `Exact Speculative and Assisted Decoding for TinyRustLM.md`; `TinyRustLM Speculative Decoding Report.md` |
| Constrained generation and tools | `Grammar-Constrained Decoding and Deterministic Local Tools for TinyRustLM.md`; `Constrained Generation and Local Tools.md` |
| Deterministic context and memory provenance | `Deterministic TinyRustLM Context Compiler Authority, Provenance, Memory, and Exact Token Assembly.md`; `Context Compiler Implementation Report Plan.md` |
| Secure companion protocol | `Secure Browser-to-Companion Protocol for Local Inference and Direct P2P.md`; `Browser-Companion Security Protocol Design.md` |
| Offline release and rollback | `TinyRustLM Offline Release, Service-Worker Update, and Last-Known-Good Rollback Architecture.md`; `TinyRustLM Offline Web Application Release, Service-Worker Updates, and Last-Known-Good Rollback.md`; `PWA Offline Release Architecture.md` |
| Hostile-input hardening | `TinyRustLM Hostile-Artifact Hardening, Fuzzing, Differential Testing, and Formal-Invariant Program.md`; `TinyRustLM Security Hardening Strategy.md` |
| Diagnostics and performance | `TinyRustLM Privacy-Preserving Diagnostics and Reproducible Performance Laboratory.md`; `TinyRustLM Performance And Diagnostics Plan.md` |

## Review Boundary

The reports vary materially in evidentiary quality. Some contain direct primary
sources and careful fact/recommendation separation. Others contain citation
placeholders, missing immutable revisions, unsupported browser or product
claims, malformed equations, or confident choices that remain experiments.
All are preserved unchanged as returned. No raw report was normalized,
repaired, silently corrected, or treated as local execution evidence.

The execution assignment resolves convergence and disagreements through ten
mandatory ADR gates rather than silently choosing a report's preference:

1. vNext metadata grammar.
2. hash and Merkle profile.
3. file versus GPU alignment.
4. companion transport.
5. browser persistence policy.
6. quantization profile.
7. WebGPU profile.
8. specialist composition model.
9. service-worker release model.
10. evidence-signing profile.

No report authorizes a format migration, model adoption, training run,
one-bit/TurboQuant/TurboVec claim, WebGPU promotion, browser compatibility
claim, MemoryEndpoints route, external P2P proof, catalog announcement,
package publication, site deployment, or campaign completion. Those outcomes
require the local and authorized evidence required by the goal.


# TinyRustLM vNext Architecture Decisions

This directory is the normative decision index for the incompatible TinyRustLM
vNext boundary. It turns the Phase 2 design requirements into reviewable,
testable contracts before implementation is allowed to claim support.

An accepted ADR records an engineering decision. It is not evidence that the
feature is implemented, promoted, browser-qualified, physically benchmarked,
or publicly available. Each ADR states its implementation and promotion
boundary explicitly.

## Decision Status

- **Accepted**: the clean target is approved for implementation.
- **Superseded**: a later ADR replaces the decision and identifies the deletion
  boundary.
- **Rejected**: the proposal must not enter production.

The vNext set contains no provisional compatibility mode. A material contract
change requires a new ADR, a new identity, and deletion of the replaced
unpublished path after its replacement passes.

## Index

| ID | Decision | Status | Implementation boundary |
| --- | --- | --- | --- |
| ADR-001 | [vNext metadata grammar](ADR-001-vnext-metadata-grammar.md) | Accepted | Strict SLM-DCBOR-1 implemented and cross-validated for unpromoted SLM2 |
| ADR-002 | [Hash and Merkle profile](ADR-002-hash-and-merkle-profile.md) | Accepted | SLM2 whole, tensor, piece, and Merkle identities implemented and vector-bound; not promoted |
| ADR-003 | [Alignment and tensor layout](ADR-003-alignment-and-tensor-layout.md) | Accepted | SLM2 F32 layout writer/reader and hostile vectors implemented; runtime pending |
| ADR-004 | [Companion transport](ADR-004-companion-transport.md) | Accepted | Protocol v2 implemented on tested loopback profile |
| ADR-005 | [Browser persistence](ADR-005-browser-persistence.md) | Accepted | Ephemeral file and companion paths exist; OPFS tier pending |
| ADR-006 | [Quantization profiles](ADR-006-quantization-profiles.md) | Accepted | SLM2 dense F32 storage oracle implemented; execution and every quantized profile remain unpromoted |
| ADR-007 | [WebGPU support profile](ADR-007-webgpu-support-profile.md) | Accepted | Not implemented and not promoted |
| ADR-008 | [Specialist composition](ADR-008-specialist-composition.md) | Accepted | Hash-bound ACG1 activation implemented; SLM2 binding pending |
| ADR-009 | [Service-worker release model](ADR-009-service-worker-release-model.md) | Accepted | Not implemented and not promoted |
| ADR-010 | [Evidence signing](ADR-010-evidence-signing.md) | Accepted | Canonical receipts and selected Ed25519 verification exist; full role profile pending |
| ADR-011 | [Campaign evidence browser boundary](ADR-011-campaign-evidence-browser-boundary.md) | Accepted | Generated zero-import Rust/WASM evidence boundary implemented and browser-test-bound |
| ADR-012 | [Durable publication bootstrap](ADR-012-durable-publication-bootstrap.md) | Accepted | Store-level target and receipt durability implemented and locally test-bound; physical power-loss proof pending |
| ADR-013 | [Exact SLM2 2.0 F32 model format profile](ADR-013-slm2-format-profile.md) | Accepted | Rust parser/writer/pieces, independent Node vector validation, and bounded fuzz replay implemented; converter, runtime, WASM/browser, promotion, and SLM1 deletion pending |
| ADR-014 | [Exact Tokenizer2 2.0 Qwen ByteLevel BPE profile](ADR-014-tokenizer2-format-profile.md) | Accepted | Independent Node-authored vectors plus Rust parser/writer/runtime implemented; full pinned-source conversion, source-oracle parity, WASM/browser, and promotion pending |

## Evidence Labels

Every ADR distinguishes:

- **Observed local fact**
- **Observed authorized live fact**
- **Sourced public fact**
- **Inference**
- **Engineering decision**
- **Assumption**
- **Local verification required**
- **Externally blocked**

The report inventory is preserved at
../../report-intake/2026-08-01/enterprise-vnext-development-research/MANIFEST.md.
Those reports are advisory inputs, not implementation evidence.

## Governing Rules

1. SLM2 is incompatible with SLM1. The vNext production reader and writer do
   not include an SLM1 fallback, migration parser, dual writer, or alias.
2. Unknown or ambiguous security-relevant semantics fail closed.
3. Browser, operating-system, accelerator, and network support are promoted
   only from execution evidence on the named target.
4. Format, model, tokenizer, template, composition, receipt, and release
   identities remain distinct.
5. Public claims cannot advance merely because an ADR is accepted.
6. Replaced unpublished code, tests, routes, schemas, and documentation are
   deleted after the replacement passes its acceptance gate.

The test tinyrustlm/tests/architecture-decisions.test.js enforces inventory,
required sections, clean-slate language, and selected cross-ADR invariants.

# TinyRustLM Prelaunch Architecture Decisions

This directory is the normative decision index for TinyRustLM's single
prelaunch product. Technical format versions identify exact byte contracts;
they do not define a second product generation or create compatibility work.
The decisions turn design requirements into reviewable, testable contracts
before implementation is allowed to claim support.

An accepted ADR records an engineering decision. It is not evidence that the
feature is implemented, promoted, browser-qualified, physically benchmarked,
or publicly available. Each ADR states its implementation and promotion
boundary explicitly.

## Decision Status

- **Accepted**: the clean target is approved for implementation.
- **Superseded**: a later ADR replaces the decision and identifies the deletion
  boundary.
- **Rejected**: the proposal must not enter production.

The prelaunch set contains no compatibility mode. A material contract change
requires a new ADR, a new identity, and deletion of the replaced unpublished
path after its replacement passes.

## Index

| ID | Decision | Status | Implementation boundary |
| --- | --- | --- | --- |
| ADR-001 | [vNext metadata grammar](ADR-001-vnext-metadata-grammar.md) | Accepted | Strict SLM-DCBOR-1 implemented and cross-validated for unpromoted SLM2 |
| ADR-002 | [Hash and Merkle profile](ADR-002-hash-and-merkle-profile.md) | Accepted | SLM2 whole, tensor, piece, and Merkle identities implemented and vector-bound; not promoted |
| ADR-003 | [Alignment and tensor layout](ADR-003-alignment-and-tensor-layout.md) | Accepted | SLM2 structural layout implemented; current production-bound tensor encoding is governed by ADR-018 |
| ADR-004 | [Companion transport](ADR-004-companion-transport.md) | Accepted | Canonical companion contract implemented on tested loopback profile |
| ADR-005 | [Browser persistence](ADR-005-browser-persistence.md) | Accepted | Ephemeral file and companion paths exist; OPFS tier pending |
| ADR-006 | [Quantization profiles](ADR-006-quantization-profiles.md) | Accepted | General profile discipline retained; exact sole mixed-Q8 production-bound choice is governed by ADR-018 |
| ADR-007 | [WebGPU support profile](ADR-007-webgpu-support-profile.md) | Accepted | Not implemented and not promoted |
| ADR-008 | [Specialist composition](ADR-008-specialist-composition.md) | Accepted | Hash-bound ACG1 activation implemented; SLM2 binding pending |
| ADR-009 | [Service-worker release model](ADR-009-service-worker-release-model.md) | Accepted | Not implemented and not promoted |
| ADR-010 | [Evidence signing](ADR-010-evidence-signing.md) | Accepted | Canonical receipts and selected Ed25519 verification exist; full role profile pending |
| ADR-011 | [Campaign evidence browser boundary](ADR-011-campaign-evidence-browser-boundary.md) | Accepted | Generated zero-import Rust/WASM evidence boundary implemented and browser-test-bound |
| ADR-012 | [Durable publication bootstrap](ADR-012-durable-publication-bootstrap.md) | Accepted | Store-level target and receipt durability implemented and locally test-bound; physical power-loss proof pending |
| ADR-013 | [Exact SLM2 2.0 F32 model format profile](ADR-013-slm2-format-profile.md) | Accepted | Rust parser/writer/pieces, independent Node vector validation, and bounded fuzz replay implemented; converter, runtime, WASM/browser, promotion, and SLM1 deletion pending |
| ADR-014 | [Exact Tokenizer2 2.0 Qwen ByteLevel BPE profile](ADR-014-tokenizer2-format-profile.md) | Accepted | Full pinned-source, native, and real-Chromium WASM parity pass; Template2 composition and model promotion pending |
| ADR-015 | [Exact Template2 2.0 Qwen chat-rendering profile](ADR-015-template2-format-profile.md) | Accepted | Binary contract, independent vectors, Rust implementation, and exact 1,024-case source/native parity pass; browser-WASM composition remains pending |
| ADR-016 | [Exact Sampling2 2.0 deterministic token-selection profile](ADR-016-sampling2-format-profile.md) | Accepted | Binary contract, normative Q48 table, independent vectors, and unsafe-free Rust implementation pass locally; native/WASM composition and model promotion remain pending |
| ADR-017 | [Exact Prompt2 2.0 prompt-composition profile](ADR-017-prompt2-composition-profile.md) | Accepted | Exact dependency-bound artifact, three binary wires, rendered-token recomposition, and independent Node/Rust native vectors pass locally; registered accepted-artifact and browser-WASM execution remain pending |
| ADR-018 | [Exact SLM2 mixed-Q8 weight profile](ADR-018-slm2-q8-weight-profile.md) | Accepted | Exact role-bound Q8/F32 artifact, independent vectors, Rust scalar runtime, hostile corpus, and Node/Chromium WASM fixture conformance pass locally; real-model promotion remains pending |

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

1. TinyRustLM has one prelaunch product and one production-bound model format.
   Executable code includes no old-format fallback, migration parser, dual
   writer, generic quantization alias, or compatibility reader.
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

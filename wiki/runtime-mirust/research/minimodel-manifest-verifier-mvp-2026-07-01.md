# MiniModel Manifest And Verifier MVP Route

## Purpose

This route records the first implementable MiniModel.org planning layer after the 2026-07-01 intake roadmap. The implementation starts with metadata, local verification, and import receipts, not peer networking.

## MiniModel.org Docs

- `E:\Source\Rust\MiniModel.org\docs\manifest-v0.md` defines the first line-oriented `minimodel.manifest` draft for Rust parsing, artifact checksums, TinyRustLM compatibility fields, evidence routes, future chunk metadata, and signature placeholders.
- `E:\Source\Rust\MiniModel.org\docs\verifier-mvp.md` defines the local Rust verifier commands, receipt fields, verification stages, drift tests, and SLMComposer handoff boundary.
- `E:\Source\Rust\MiniModel.org\docs\catalog-boundary.md` defines the metadata-only catalog, server allow/deny lists, user consent gates, legal posture, takedown routes, and ecosystem staging.
- `E:\Source\Rust\MiniModel.org\examples\minimodel.manifest.v0.example` and `E:\Source\Rust\MiniModel.org\examples\catalog-entry.v0.json` provide non-byte-serving examples.

## Durable Decisions

- Project servers never run user model bytes.
- Project servers never serve user model bytes.
- MiniModel.org can serve docs, schemas, examples, public key routes, metadata-only catalog entries, and contact/takedown routes.
- The manifest is line-oriented for the first Rust verifier so parsing can stay small and dependency-light.
- The verifier accepts a manifest plus a user-supplied local `.slm` path; the manifest alone never authorizes browser or server fetching.
- SLMComposer remains browser-local and keeps user-selected local `.slm` files as the model-byte boundary.

## Implementation Order

1. Stabilize `minimodel.manifest.v0` field names and rejection rules.
2. Implement `minimodel-core` parsing, required-field validation, duplicate-key rejection, checksum format checks, and boundary-field rejection.
3. Add local artifact verification for byte count, SHA256, TinyRustLM `.slm` checksum, tokenizer checksum, tensor-layout checksum, shape, and quantization.
4. Add optional chunk/Merkle verification after the local artifact path is supplied.
5. Add local import receipts with manifest checksum, artifact checksum, validation result, and SLMComposer local-file next gate.
6. Keep static catalog work metadata-only until legal review and verifier behavior are stable.
7. Treat peer transfer as a later phase using the same manifest and receipt contract.

## Verification Implications

Future source work should include drift tests for missing license route, missing model-card route, project-server model-byte URL, server execution claim, duplicate key, artifact byte-count drift, artifact SHA256 drift, tokenizer checksum drift, tensor-layout checksum drift, unsupported artifact kind, unsupported quantization, evidence route/checksum mismatch, chunk count drift, and Merkle root drift.

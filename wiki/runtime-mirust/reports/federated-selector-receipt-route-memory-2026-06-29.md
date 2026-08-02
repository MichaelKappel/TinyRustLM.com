---
title: Federated Selector Receipt Route Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/federated-selector-receipt-route-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T14:55:00Z
---

# Federated Selector Receipt Route Memory

TinyRustLM now has downstream selector-registry and browser provenance proof for the federated/local-update operator receipt.

## What Changed

- `tinyrustlm/tools/slm_pack/src/selector.rs` now has a selector test that builds a federated receipt-bound admission chain through candidate, promotion, admission, and selector registry text.
- The test uses `operator_kind=federated-local-update-average` rather than the older mutation-style synthetic operator kind.
- The registry writer preserves the admission receipt fields as `entry.0.operator_receipt_*`.
- Registry validation preserves the federated operator kind, receipt checksum, candidate checksum equality, and candidate byte-count equality.
- Registry validation now rejects federated operator-kind drift if `entry.0.operator_receipt_operator_kind` no longer matches the receipt-bound admission.
- Shared selector fixtures now accept an operator kind argument, so future non-mutation operators can prove the same downstream route without cloning the whole helper chain.
- `tinyrustlm/tools/browser-smoke.js` now adds federated `entry.0.operator_receipt_*` fields to the intercepted `multi-parent-registry` fixture.
- Browser smoke captures the Model Provenance Operator row and asserts the rendered value includes `federated-local-update-average`.
- Browser smoke now includes `selector-operator-receipt-drift`, which mutates the selector entry's operator receipt candidate byte count and proves the browser falls back to static local models before the drifted candidate becomes selectable.

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector::tests::rejects_selector_registry_federated_operator_receipt_kind_drift` passed.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack selector::tests::` passed with 86 selector tests.
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack` passed with 280 tests.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18881/app/ 9312 tinylm16q8 selector-operator-receipt-drift` passed and kept `selectedModel=tinylm16q8`, fallback static model options, and Model Provenance Operator `unavailable`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18880/app/ 9311 multi-parent-sign-merge-q8 multi-parent-registry` passed and rendered `receipt-bound / federated-local-update-average / 0x00000000000000b0`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18881/app/ 9313 multi-parent-sign-merge-q8 multi-parent-registry` passed as the positive regression for the receipt-bound route.

No coverage tool is active in this no-third-party workspace; this proof is recorded against the 75% target through the focused selector route test, the full selector suite, the full packer suite, and the targeted browser registry smoke.

## Test Coverage Notes

- The federated operator-kind parameter is covered by the selector route test asserting `entry.0.operator_receipt_operator_kind=federated-local-update-average`.
- The federated operator-kind drift path is covered by replacing that registry field with the mutation operator kind and asserting selector validation rejects `operator_receipt_operator_kind`.
- Receipt checksum propagation is covered by asserting the registry entry checksum equals the admission receipt checksum.
- Candidate checksum and byte-count propagation are covered by asserting the registry operator receipt fields match `entry.0.slm_checksum` and `entry.0.model_bytes`.
- The helper operator-kind parameter is covered by preserving the existing default mutation-style route while exercising the federated route through the new test.
- Browser provenance rendering is covered by the `multi-parent-registry` smoke, which captures `provenanceOperator` and asserts the federated operator kind survives browser registry intake.
- Browser candidate byte-count drift is covered by `selector-operator-receipt-drift`, which changes `entry.0.operator_receipt_candidate_artifact_bytes`, asserts the generated registry entry is absent from `modelOptions`, and proves fallback q8 generation keeps the Operator row unavailable.

## Routing

Open this report before changing selector registry operator receipt fields, browser Model Provenance Operator assertions, browser selector operator-receipt drift fallback, federated downstream handoff, receipt-bound admission-to-registry validation, or helper fixtures for non-mutation operator routes.

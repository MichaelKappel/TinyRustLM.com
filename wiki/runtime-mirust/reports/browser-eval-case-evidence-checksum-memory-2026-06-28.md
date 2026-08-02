---
title: Browser Eval Case Evidence Checksum Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-eval-case-evidence-checksum-memory-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T03:42:00Z
---

# Browser Eval Case Evidence Checksum Memory

## Summary

TinyRustLM now carries a compact `eval_case_evidence_checksum` from passed evaluation sidecars into selector admission records, promotion ledgers, selector registries, generated assembly receipts, and the browser Model Provenance panel. The checksum is derived from normalized `case_count`, `cases_passed`, `cases_failed`, and ordered `case.N.status/expected/actual/error` fields after the converted-trained evaluation gate has passed.

For the generated `browser-multi-parent-bundle all` proof root, q4_0, q8_0, and f32 entries all displayed:

`eval_case_evidence_checksum=0xabdeb569ab3eea3e`

This gives the constrained browser route a stable digest for the evaluated case body without loading all eval case text into hot memory or selector UI.

## Implementation

- `provenance.rs` exposes `eval_case_evidence_checksum` and tests that case-body changes alter the digest.
- `admission.rs` and `multi_admission.rs` write and validate `eval_case_evidence_checksum` alongside `eval_manifest_checksum`.
- `ledger.rs` carries the checksum into promotion-ledger entries for population and parent-pool routing.
- `selector.rs` writes the checksum into `entry.N.eval_case_evidence_checksum`.
- `browser_bundle.rs` writes the same checksum into generated `.assembly.receipt` files.
- `app.js` requires the selector checksum for registry-backed models, renders eval cases and checksum in Model Provenance, and verifies assembly receipts match the registry value.
- `browser-smoke.js` asserts registry-backed models show `1 passed` and a hex eval checksum, including `combined-selector-assembly`.

## Verification

- `cargo test -p tinyrustlm-slm-pack` passed 168 tests.
- `cargo test -p tinyrustlm-runtime` passed 77 tests.
- `cargo test -p tinyrustlm-browser-harness` passed 6 tests.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed 9 checks.
- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `node tinyrustlm/tools/wasm-abi-smoke.js tinyrustlm/runtime/tinyrustlm.wasm` passed.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-assembly-trace/tinyrustlm all` regenerated a validated all-root.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9233 multi-parent-sign-merge-q4 combined-selector-assembly` passed and proved q4_0, q8_0, and f32 all display `1 passed`, the same eval-case checksum, verified module-plan fields, and ADP1 plus ASP1 plus ALR1 stack apply before generation.

## Routing Notes

Use this page before changing selector admission evidence fields, promotion-ledger admission copies, generated assembly receipts, the Model Provenance panel, or browser-smoke registry-backed provenance assertions. Use Browser Assembly Trace Memory for checkpoint sequencing and Browser Low-Rank Adapter Route Memory for ALR1 stack routing.

---
title: Browser Source-Backed ALR1 Contract Memory
status: current
reviewed_utc: 2026-06-28T13:30:00Z
---

# Browser Source-Backed ALR1 Contract Memory

TinyRustLM now treats source-backed ALR1 provenance fields as first-class route contracts before browser auto assembly can fetch or apply stack artifacts.

## Implementation

- `tinyrustlm/tools/slm_pack/src/adapter_family.rs` now couples adapter kind and dtype as exact route pairs, accepts source-backed ALR1 only with `low-rank-f32-source-delta`, validates source manifest, source checksum, layout, format, and source-base contract fields, and echoes those fields into adapter-family receipts.
- `tinyrustlm/app/app.js` now validates source-backed ALR1 receipt echoes, checks fetched source-backed ALR1 manifests against the receipt, and rejects a manifest whose source contract differs from the already verified adapter-family receipt.
- `tinyrustlm/tools/browser-smoke.js` adds `source-backed-alr1-manifest-drift`, mutating only the low-rank ALR1 manifest source-base contract while recomputing selector, module-plan, assembly, and adapter-family checksum carriers so the browser reaches the intended manifest-vs-receipt comparison.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` tests now assert generated adapter-family receipts carry source-backed ALR1 provenance echoes for the `adapter.3` stack member.

## Evidence

- `cargo fmt --all`
- `cargo fmt --all -- --check`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo test -p tinyrustlm-slm-pack adapter_family`
- `cargo test -p tinyrustlm-slm-pack browser_bundle`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/source-backed-alr1-contract/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8176/app/ 9276 multi-parent-sign-merge-q4 source-backed-alr1-manifest-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8176/app/ 9277 multi-parent-sign-merge-q4 combined-selector-assembly`
- `cargo test --workspace`

## Result

The drift smoke kept the generated q4 selector, module plan, model, manifest, assembly receipt, evidence files, adapter-family receipt, and all adapter manifests fetchable through the low-rank ALR1 manifest. The browser then rejected `adapter_source_base_contract` before fetching any ADP1, ASP1, or ALR1 stack artifacts, while the valid combined selector path still applied the source-backed ALR1 stack member for q4_0, q8_0, and f32.

## Routing

Use this report before changing source-backed ALR1 manifest fields, adapter-family receipt source echoes, `.alr1` kind/dtype routing, `validateSourceBackedAdapterManifest`, or `source-backed-alr1-manifest-drift` smoke expectations.

---
title: Browser Source-Backed ALR1 Route Memory
status: current
reviewed_utc: 2026-06-28T11:25:34Z
---

# Browser Source-Backed ALR1 Route Memory

TinyRustLM generated browser bundles now serve ALR1 stack members that come from reviewed trained adapter source bundles instead of only synthetic low-rank task-delta receipts.

## Implementation

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` stages `low-rank-adapter.source` evidence for each generated f32/q8_0/q4_0 entry, converts it with `convert_adapter_source_path`, and validates it with `validate_converted_adapter_source_path`.
- `tinyrustlm/tools/slm_pack/src/adapter_family.rs` accepts source-backed ALR1 manifest kind and dtype for `.alr1` family members while preserving checksum, apply-status, quantization, and shared identity checks.
- `tinyrustlm/app/app.js` accepts source-backed ALR1 manifest kind and dtype for local `.alr1` routes without parsing adapter payload bytes.
- `tinyrustlm/tools/browser-smoke.js` expects source-backed ALR1 labels and exact Module Plan byte/checksum summaries for generated roots.

## Evidence

- `cargo fmt --all`
- `cargo fmt --all -- --check`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo test -p tinyrustlm-slm-pack adapter_family`
- `cargo test -p tinyrustlm-slm-pack browser_bundle`
- `cargo test -p tinyrustlm-slm-pack trained_adapter_source`
- `cargo test -p tinyrustlm-slm-pack`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo test --workspace`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/source-backed-alr1-route/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18770/app/ 9229 multi-parent-sign-merge-q4 combined-selector-assembly`

## Result

The generated q4/q8/f32 selector root now fetches source-backed `.alr1` manifests and artifacts, validates each source-backed ALR1 package through Rust before apply, applies ADP1 plus ASP1 plus source-backed ALR1 before generation, and reaches ready through the verified Module Plan trace.

## Routing

Use this report before changing generated browser bundle ALR1 staging, source-backed adapter-family receipt members, browser `.alr1` manifest validation, or combined selector source-backed ALR1 smoke expectations.

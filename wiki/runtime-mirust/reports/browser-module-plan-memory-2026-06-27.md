---
title: Browser Module Plan Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T19:03:56Z
---

# Browser Module Plan Memory

## Routing Summary

Use this report when work touches generated selector registry module-plan fields, browser self-assembly order, generated bundle staging, or `adapter-sidecar-registry-file` smoke coverage. It records the first browser-verified module graph receipt for TinyRustLM generated bundles.

## Implementation

- `tinyrustlm/tools/slm_pack/src/selector.rs` now carries `entry.N.module_plan_*` fields through registry generation and validation, and rejects module-count drift against model, manifest, receipts, and adapter stack members.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` now writes served `.module-plan.receipt` files for generated f32/q8_0/q4_0 roots and the combined `all` root.
- `tinyrustlm/app/app.js` fetches and checksum-verifies a declared module plan before fetching generated `.slm` bytes, then matches model, manifest, assembly receipt, adapter-family receipt, and stack members against selector metadata.
- `tinyrustlm/tools/browser-smoke.js` requires generated roots to request the module-plan route during `adapter-sidecar-registry-file` smoke.
- `tinyrustlm/tools/browser_harness/src/main.rs` checks the static browser host for the module-plan strategy marker.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack selector::`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18696/app/ 19526 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `cargo test --workspace`
- `git diff --check`

The live generated-root q4 smoke network trace requested `/models/multi-parent-sign-merge-q4.module-plan.receipt` before `/models/multi-parent-sign-merge-q4.slm`, then fetched the assembly receipt, evidence files, adapter-family receipt, generated adapter manifests, family ADP1, and sparse ASP1. The pre-generation console recorded two `apply_adapter_delta` calls followed by `adapter_stack_applied(2)`.

## Next Routing

The next useful modular bead is plan variation: module plans can later carry resource classes, purpose labels, planner-selected candidates, or alternative stack recipes while keeping this browser path local, receipt-bound, and Rust-validated.

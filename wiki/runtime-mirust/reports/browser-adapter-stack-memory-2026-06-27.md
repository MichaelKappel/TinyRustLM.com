---
title: Browser Adapter Stack Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-adapter-stack-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T18:30:04Z
---

# Browser Adapter Stack Memory

## Routing Summary

Use this report when work touches generated adapter-family receipts, selector registry adapter auto-apply fields, browser self-assembly, or `adapter-sidecar-registry-file` smoke coverage. It records the first browser-verified ordered adapter stack for TinyRustLM generated bundles.

## Implementation

- `tinyrustlm/tools/slm_pack/src/adapter_family.rs` now writes receipt fields for `adapter_family_auto_apply_stack_status`, `adapter_family_auto_apply_stack_strategy`, `adapter_family_auto_apply_stack_count`, and ordered stack members with adapter index, path, and manifest path.
- `tinyrustlm/tools/slm_pack/src/selector.rs` now carries `entry.N.adapter_auto_apply_stack_*` fields through registry generation and validation, and rejects stack-count drift.
- `tinyrustlm/app/app.js` verifies the stack against the fetched adapter-family receipt and adapter manifests, sums manifest-declared artifact bytes against the auto-apply byte budget, then sequentially fetches, checksum-checks, and transfers each stack member to Rust.
- `tinyrustlm/tools/browser-smoke.js` now requires generated roots to request the family ADP1 and sparse ASP1 stack routes and to record two pre-generation `apply_adapter_delta` calls plus `adapter_stack_applied(2)`.
- `tinyrustlm/tools/browser_harness/src/main.rs` checks the static browser host for the adapter stack strategy marker.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all`
- `cargo test -p tinyrustlm-slm-pack adapter_family::`
- `cargo test -p tinyrustlm-slm-pack selector::`
- `cargo test -p tinyrustlm-slm-pack browser_bundle::`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-adapter-stack/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18694/app/ 19524 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`

## Next Routing

The next useful modular bead is richer stack planning: stack receipts can later add resource-class labels, per-module purpose labels, or eval-derived stack candidates, while this bead keeps the browser path local, manifest-bound, and Rust-validated.

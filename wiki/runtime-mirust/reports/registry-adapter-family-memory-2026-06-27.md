---
title: Registry Adapter Family Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/registry-adapter-family-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T16:25:00Z
---

# Registry Adapter Family Memory

## Summary

TinyRustLM now proves generated selector registries can expose small families of compatible local f32/q8_0/q4_0 `ADP1` and `ASP1` sidecars for matching admitted model entries. The registry keeps the earlier single-adapter fields for the first route, then adds indexed adapter-family fields when more than one route exists. The browser parses the indexed family, displays self ADP1, family ADP1, and sparse ASP1 options, selects the sparse route during `adapter-sidecar-registry-file`, fetches the matching `multi-parent-sign-merge-*-sparse.asp1` from the same local origin, transfers bytes into WASM, and leaves package validation to Rust.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/selector.rs` stores zero or more `RegistryAdapterRoute` values per entry, rejects duplicate adapter paths for the same candidate, and requires adapter apply status to match f32/q8_0/q4_0 registry entry quantization.
- Single-adapter registries keep the existing `entry.N.adapter_path`, manifest, label, apply status, and checksum fields.
- Multi-adapter registries add `entry.N.adapter_count` plus indexed fields such as `entry.N.adapter.1.path`, `manifest_path`, `label`, `apply_status`, `artifact_checksum`, and `manifest_checksum`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` now stages matching self and family `.adp1` packages plus a sparse `.asp1` package for generated f32/q8_0/q4_0 roots through the same compatibility, lineage, adapter-delta, sparse-adapter-delta, and validation gates.
- `tinyrustlm/app/app.js` parses either the legacy single-sidecar fields or indexed adapter-family fields, keeps routes local to `../models/*.adp1` or `../models/*.asp1`, and does not parse adapter bytes.
- `tinyrustlm/tools/browser-smoke.js` now expects all three generated adapter options and applies the sparse route during `adapter-sidecar-registry-file`.

## Validation Memory

- `cargo fmt --all` passed.
- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 17 tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed.
- A generated browser bundle served over the Rust local server passed `adapter-sidecar-registry-file`, showing all three generated adapter options and applying `multi-parent-sign-merge-f32-sparse.asp1`.
- Generated q8_0 and q4_0 browser bundles keep the same adapter-family route shape, with sparse ASP1 coverage owned by `browser-sparse-adapter-route-memory-2026-06-27.md`.

## Routing Notes

Use this report before changing selector registry adapter-family fields, generated bundle adapter staging, browser registry adapter parsing, or `adapter-sidecar-registry-file` assertions. This report extends the registry adapter sidecar memory from one route to a small typed family; runtime ADP1/ASP1 package validation and browser byte-transfer boundaries remain owned by the runtime and browser adapter reports.

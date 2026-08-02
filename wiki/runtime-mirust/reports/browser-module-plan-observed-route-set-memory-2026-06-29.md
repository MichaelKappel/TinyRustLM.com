---
title: Browser Module Plan Observed Route Set Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-observed-route-set-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T11:10:00Z
---

# Browser Module Plan Observed Route Set Memory

TinyRustLM generated self-assembly now records the browser-observed route set. Each accepted generated fetch appends its route kind and path to the in-page route list, and generated Ready requires the observed route-set checksum to match the declared `module_plan_route_set_checksum`.

## What Changed

- `tinyrustlm/app/index.html` adds the Module Plan `Actual Route Set` row.
- `tinyrustlm/app/app.js` records `{ kind, path }` for every accepted generated module-plan fetch, computes the observed route-set checksum with the same route-set checksum preimage as the selector and receipt, renders the row, and rejects Ready when the observed route set differs from the declared route set.
- `tinyrustlm/tools/browser-smoke.js` captures `modulePlanActualRouteSetChecksum`, requires it to equal `modulePlanRouteSetChecksum` for generated q4_0/q8_0/f32 assemblies, and keeps source-root fallback at `unavailable`.

## Browser Contract

The observed route set uses the same ordered route classes declared by the module plan:

- `module-plan-receipt`
- `model`
- `model-manifest`
- `assembly-receipt`
- `assembly-evidence`
- `adapter-family-receipt`
- `adapter-manifest`
- `adapter-stack-artifact`

The row shows an in-flight `N/21 routes` summary until all planned routes are observed. At readiness, it shows the checksum and that checksum must equal `module_plan_route_set_checksum`.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo fmt --all -- --check`
- `git diff --check`
- `cargo run --manifest-path tinyrustlm/tools/browser_harness/Cargo.toml -- tinyrustlm`
- Generated `target/module-plan-observed-route-set-20260629/tinyrustlm all`.
- Generated `combined-selector-assembly` on `http://127.0.0.1:18762/app/` proved q4_0, q8_0, and f32 all reached `Ready`, generated response `e`, applied the three-adapter stack, displayed `Plan Fetches 21 fetches`, displayed `Actual Fetches 21 fetches`, and displayed observed route-set checksums equal to the declared route-set checksums:
  - q4_0 `0xe7d8c862dec256cb`
  - q8_0 `0xc6215c5348cef337`
  - f32 `0x5317f0a7a894574c`
- Source `ui-audit` on `http://127.0.0.1:18763/app/` proved desktop and mobile fallback snapshots keep `Actual Route Set`, `Actual Fetches`, and `Plan Fetches` at `unavailable`.
- No local server or browser debug listener remained open after the smoke runs.

## Routing

Open this report before changing generated fetch route kinds, counted fetch wrappers, Module Plan `Actual Route Set` display, route-set checksum preimages, or generated Ready gating for observed routes.

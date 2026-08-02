---
title: Browser Module Plan Count Drift Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-module-plan-count-drift-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T20:20:00Z
---

# Browser Module Plan Count Drift Memory

## Summary

`module-plan-count-drift` is now a served-browser proof for selector-to-receipt module cardinality. The smoke mutates only the served `.module-plan.receipt` `module_count` field, refreshes the selector registry module-plan checksum to keep the route internally consistent, and requires the browser to reject with `Module plan module count mismatch` before any generated `.slm`, adapter-family receipt, adapter manifest, or stack artifact route is fetched.

## Implementation Route

- `tinyrustlm/tools/browser-smoke.js` adds `driftModulePlanCount(receiptText)` to lower `module_count` by one while preserving checksum-consistent selector routing.
- `installModulePlanCountDriftInterceptor(client, modelKey)` reuses the shared module-plan drift interceptor so `selector.registry` points at the drifted receipt checksum.
- `assertModulePlanCountDriftSmoke(result, modelKey, networkRequests)` verifies the error state and confirms only the selector registry plus module-plan receipt routes are requested.
- `tinyrustlm/README.md`, `tinyrustlm/docs/testing.md`, and `.uai/test-plan.uai` route the new smoke mode for future work.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo test -p tinyrustlm-browser-harness` with 6 tests passed.
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/module-plan-count-drift/tinyrustlm all`
- `cargo run -p tinyrustlm-local-server -- target/module-plan-count-drift/tinyrustlm 8193`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8193/app/ 9298 multi-parent-sign-merge-q4 module-plan-count-drift`

The browser smoke returned `Model load failed`, `fetch error`, and `Module plan module count mismatch`. The network trace stopped at `/models/selector.registry` and `/models/multi-parent-sign-merge-q4.module-plan.receipt`.

## Disk Cleanup Note

Before verification, project-safe cleanup removed the active repo `target/` tree and recoverable Visual Studio `.vs` cache content where files were not open. `E:\` finished this bead with about 67.8 GiB free after the focused rebuild.

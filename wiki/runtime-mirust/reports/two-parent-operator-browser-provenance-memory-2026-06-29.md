---
title: Two Parent Operator Browser Provenance Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/two-parent-operator-browser-provenance-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T17:41:02Z
---

# Two Parent Operator Browser Provenance Memory

TinyRustLM now has compact browser selector proof for the original two-parent direct-parameter operator lane: blend, task-delta, and sparse task-delta.

## What Changed

- `tinyrustlm/tools/browser-smoke.js` adds `blend-operator-registry`, `delta-operator-registry`, and `sparse-delta-operator-registry` compact selector fixtures.
- The fixtures render browser Model Provenance Operator rows for `direct-parameter-weighted-average`, `direct-parameter-task-delta`, and `sparse-direct-parameter-task-delta`.
- `blend-operator-receipt-drift`, `delta-operator-receipt-drift`, and `sparse-delta-operator-receipt-drift` prove byte-echo drift returns to the static q8 route with operator provenance unavailable.
- `tinyrustlm/README.md` routes the six browser smoke commands beside the other compact operator provenance examples.

## Browser Fixture Routes

- `tinylm16-blend-q8` loads the q8 TinyLM artifact route and carries operator checksum `0x00000000000000b4`.
- `tinylm16-delta-q8` loads the q8 TinyLM artifact route and carries operator checksum `0x00000000000000b5`.
- `tinylm16-sparse-delta-q8` loads the q8 TinyLM artifact route and carries operator checksum `0x00000000000000b6`.
- All three fixtures keep the model route under `../models/tinylm16-q8.slm`, preserve q8_0 quantization, and use the shared selector operator receipt validation path.

## Verification

- `node --check tinyrustlm\tools\browser-smoke.js` passed.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8129/app/ 9430 tinylm16-blend-q8 blend-operator-registry` passed, rendering `receipt-bound / direct-parameter-weighted-average / 0x00000000000000b4`.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8129/app/ 9431 tinylm16-delta-q8 delta-operator-registry` passed, rendering `receipt-bound / direct-parameter-task-delta / 0x00000000000000b5`.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8129/app/ 9432 tinylm16-sparse-delta-q8 sparse-delta-operator-registry` passed, rendering `receipt-bound / sparse-direct-parameter-task-delta / 0x00000000000000b6`.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8129/app/ 9433 tinylm16q8 blend-operator-receipt-drift` passed and returned to static q8 with operator provenance unavailable.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8129/app/ 9434 tinylm16q8 delta-operator-receipt-drift` passed and returned to static q8 with operator provenance unavailable.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8129/app/ 9435 tinylm16q8 sparse-delta-operator-receipt-drift` passed and returned to static q8 with operator provenance unavailable.
- Regression smokes for the shared compact fixture passed on `http://127.0.0.1:8129/app/`: federated `multi-parent-registry`, prune `prune-operator-registry`, crossover `crossover-operator-registry`, and mutation `mutation-operator-registry`.

No coverage tool is active in this no-third-party workspace; evidence for the 75% target is the focused browser provenance and drift slice plus the existing Rust receipt tests for the operator implementations.

## Test Coverage Notes

- Browser `modelKey` parameters are covered by positive registry smokes for all three compact candidates.
- Browser `smokeMode` parameters are covered by the three positive modes and the three byte-echo drift modes.
- Operator kind routing is covered by exact Model Provenance row assertions for all three operator strings.
- Candidate artifact byte equality is covered by the drift smokes that mutate the receipt byte echo and require fallback.
- Shared compact-registry behavior is covered by federated, prune, crossover, and mutation regression smokes after the new modes were added.

## Routing

Open this report before changing browser selector operator provenance for `blend-candidate`, `delta-candidate`, `sparse-delta-candidate`, compact registry fixtures, or receipt byte-echo fallback behavior.

---
title: Browser Module Plan Display Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-display-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T20:48:35Z
---

# Browser Module Plan Display Memory

## Routing Summary

Use this report when work touches the browser Module Plan panel, verified `.module-plan.receipt` display fields, generated adapter stack route display, or smoke assertions that receipt metadata is visible without parsing model or adapter bytes.

## Implementation

- `tinyrustlm/app/index.html` adds a Module Plan evidence panel with status, kind, resource class, module count, model route, and stack summary fields.
- `tinyrustlm/app/app.js` stores the verified module-plan receipt fields after checksum/resource/graph/stack validation and renders only those line-based receipt fields. Checked fallback models render `none` and `unavailable` values.
- The rendered stack summary reads the receipt-declared `adapter_auto_apply_stack_count` plus the stack member `module.K.adapter_path` fields, matching the same generated family ADP1 plus sparse ASP1 routes already verified before model load.
- `tinyrustlm/tools/browser-smoke.js` now captures and asserts Module Plan panel fields in source-root UI audit and generated-root `adapter-sidecar-registry-file` smoke.
- `tinyrustlm/tools/browser_harness/src/main.rs` treats the Module Plan ids and heading as part of the static app contract.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18706/app/ 19538 tinylm16q8 ui-audit`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-module-plan-display/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18708/app/ 19540 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-browser-harness`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `cargo test --workspace`
- `git diff --check`

The source-root desktop/mobile UI audit showed the new panel and verified fallback state `modulePlanState=none` with unavailable fields for the checked q8_0 model. The generated q4 registry-file smoke showed `modulePlanState=loaded`, `modulePlanKind=browser-local-module-plan`, `modulePlanResource=browser-constrained-local-assembly`, `modulePlanModules=6`, `modulePlanModel=../models/multi-parent-sign-merge-q4.slm`, and stack display `2: ../models/multi-parent-sign-merge-q4-family.adp1, ../models/multi-parent-sign-merge-q4-sparse.asp1`. Workspace tests passed with 249 checks, the diff check emitted line-ending notes only, temporary browser profiles were removed, and the source/generated local-server ports were clear.

## Next Routing

The next constrained-browser bead can use the displayed receipt graph as a stable user-facing route for richer module assembly state, while keeping JavaScript on line-based metadata and Rust on model and adapter payload validation.

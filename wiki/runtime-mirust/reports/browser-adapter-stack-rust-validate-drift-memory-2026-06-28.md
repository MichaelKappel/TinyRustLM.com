---
title: Browser Adapter Stack Rust Validate Drift Memory 2026-06-28
source_site: Runtime.MiRust.com
local_route: /runtime-mirust/reports/browser-adapter-stack-rust-validate-drift-memory-2026-06-28/
status: reviewed_current
reviewed_utc: 2026-06-28T08:45:00Z
---

# Browser Adapter Stack Rust Validate Drift Memory

## Summary

TinyRustLM now has a browser smoke proof for a checksum-consistent generated adapter stack member that still fails Rust semantic validation before any stack mutation. The smoke mutates a family ADP1 header identity field, recomputes the adapter package checksum, updates every browser-visible checksum echo, fetches the complete ADP1/ASP1/ALR1 stack, and confirms `validate_adapter_delta` returns `shape mismatch` before any `apply_adapter_delta` call.

## Implementation

- `tinyrustlm/tools/browser-smoke.js` adds `adapter-stack-rust-validate-drift`.
- The interceptor changes the family ADP1 identity byte at header offset 16 and recomputes the adapter package checksum at bytes 56-63.
- The smoke updates the selector registry, module-plan receipt, assembly receipt, adapter-family receipt, adapter manifest, and served adapter artifact so browser route, byte, and checksum gates all stay aligned.
- The assertion requires all adapter manifests and all three stack artifacts to be requested, then requires the console to contain `validate_adapter_delta(...) -> 9` and `shape mismatch`.
- The assertion rejects any `apply_adapter_delta` console entry and requires the Module Plan Trace to stop after `adapter family verified`.
- `runPageAdapterLoadStateSmoke` now exits promptly when startup reaches `Adapter load failed`, which keeps drift smokes focused on the adapter state transition.

## Verification

Passed on 2026-06-28:

- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/adapter-stack-rust-validate-drift/tinyrustlm all`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18753/app/ 19617 multi-parent-sign-merge-q4 adapter-stack-rust-validate-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18754/app/ 19621 multi-parent-sign-merge-q4 adapter-stack-rust-validate-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18754/app/ 19622 multi-parent-sign-merge-q4 adapter-stack-prefetch-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18754/app/ 19623 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18754/app/ 19624 multi-parent-sign-merge-q4 combined-selector-assembly`

The semantic drift proof showed all three stack artifact routes requested, `validate_adapter_delta(Multi-parent sign-merge q4_0 family ADP1) -> 9`, `shape mismatch`, loaded model diagnostics, a trace through `adapter family verified`, and no `apply_adapter_delta` entry. The existing prefetch drift proof still stopped before low-rank ALR1 fetch, the normal generated q4 route validated and applied all three stack members before generation, and the combined selector smoke preserved q4/q8/f32 validation-before-apply ordering.

The generated path `target/adapter-stack-rust-validate-drift/tinyrustlm` was used for the new semantic-drift smoke. The established `target/adapter-stack-validate/tinyrustlm` route remains the harness baseline for rendered Module Plan byte/checksum constants.

## Routing

Load this report when work touches generated auto-stack validation failure paths, `adapter-stack-rust-validate-drift`, checksum-consistent adapter artifact mutation, or proof that Rust semantic validation stops mutation after browser byte gates pass.

Related routes:

- `wiki/runtime-mirust/reports/browser-adapter-stack-rust-validate-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-adapter-stack-prefetch-drift-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-adapter-artifact-drift-memory-2026-06-28.md`
- `.uai/short-term-memory.uai`
- `.uai/long-term-memory.uai`

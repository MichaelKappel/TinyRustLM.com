---
title: Browser Converted Trained Provenance Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-converted-trained-provenance-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T18:52:33Z
---

# Browser Converted Trained Provenance Memory

TinyRustLM now has a focused browser smoke route proving a selector-served converted-trained `.slm` manifest keeps its source and quality boundary visible in the browser.

## What Changed

- `tinyrustlm/tools/browser-smoke.js` adds `converted-trained-registry` mode.
- The mode serves a compact `models/selector.registry` entry named `converted-trained-q8`.
- The mode intercepts `/models/converted-trained-q8.slm` by reusing the checked tiny q8 bytes under a converted-trained route.
- The mode serves `/models/converted-trained-q8.slm.manifest` with `source_kind=converted-trained`.
- The browser smoke now captures Model Provenance source, admission, quality, trained-quality, and next-gate fields from `runPageSmoke`.
- The assertion requires the browser to render `converted-trained`, `structure-accepted-quality-pending`, `runtime-compatible-not-quality-verified`, and `pending-evaluation`.

## Verification

- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/app/app.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8080/app/ 9281 converted-trained-q8 converted-trained-registry`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8080/app/ 9282 multi-parent-sign-merge-q8 multi-parent-registry`
- `git diff --check`

The converted-trained browser smoke selected `converted-trained-q8`, generated `e`, fetched `/models/converted-trained-q8.slm.manifest`, and rendered the converted-trained provenance fields. The compact multi-parent registry regression still selected `multi-parent-sign-merge-q8`, generated `e`, and rendered the federated Operator row.

No coverage tool is active in the no-third-party workspace, so the changed harness is covered by syntax checks plus the positive converted-trained browser smoke and a shared registry regression smoke.

## Routing

Open this report before changing `converted-trained-registry`, browser provenance assertions for converted-trained manifests, compact selector registry fixtures that route converted trained-source artifacts, or the browser-visible trained-source claim boundary.

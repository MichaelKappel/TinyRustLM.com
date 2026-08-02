---
title: Browser Converted Trained Source Provenance Memory
source_site: Runtime.MiRust.com
status: current
reviewed_utc: 2026-06-30T23:35:00Z
---

# Browser Converted Trained Source Provenance Memory

## What Changed

- The browser Model Provenance panel now renders verified converted-trained source snapshot identity as Source Snapshot, Source ID, Source Shape, Source Review, Review Routes, Review Artifacts, Tokenizer Import, and Source Validation rows.
- Source Review rows are backed by selector `source_review_path` plus checksum metadata and, when present, a fetched `converted-trained.source.review` sidecar verified before eval evidence or model bytes.
- The browser now requires source-review sidecars to expose reviewed `source_model_id`, SHA-shaped `source_model_sha`, config/tokenizer checksums, tokenizer import status/count/checksum rows, source license route, reference prompt route, reference output checksum, and eval-cases route before converted `.slm` bytes; when local config/tokenizer artifact rows are present, their checksums must match the reviewed config/tokenizer checksums.
- Review Routes renders license, prompt, reference-output checksum, and eval-case route from the fetched sidecar; Review Artifacts renders local artifact status plus checksum rows from the same checksum-verified sidecar; Tokenizer Import renders the imported tokenizer status, token count, merge count, and checksum.
- Source Validation renders `pass / convert-raw-f32-source-to-slm / <checksum>` only after the browser has fetched `converted-trained.source.validation`, checked the selector checksum, and verified source manifest checksum, source identity, tensor count, tied-output flag, optional source-review checksum, and next gate.
- Converted-trained registry smoke asserts the fixture values `trained-source-fixture`, `tinyrustlm-local-source-fixture`, `tiny-fixture`, `validated-before-extraction / extract-raw-f32-tensors / 0x6000e063cdb80503 / local/browser-smoke-reviewed-fixture / sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`, plus the expected Review Routes, Review Artifacts, and Tokenizer Import summaries.
- Static deterministic models render the same rows as `unavailable`, and `ui-audit` checks that fallback on desktop and mobile.
- The Rust browser harness requires the new provenance row ids so the static UI contract remains crawled.

## Why

Converted-trained selector entries already verify the copied `converted-trained.source.manifest` before model bytes. This bead makes the reviewed source identity, review gate, reviewed route set, and checksum-bound local artifact evidence visible in the browser so local checkpoint review can see which source snapshot and candidate-review artifacts produced the loaded `.slm`.

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness --quiet`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8187/app/ 9387 converted-trained-q8 converted-trained-registry`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8187/app/ 9388 converted-trained-q8 converted-trained-source-review-drift`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8187/app/ 9389 converted-trained-q8 converted-trained-source-review-sidecar-drift`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8187/app/ 9390 converted-trained-q8 converted-trained-source-review-omitted`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8096/app/ 9391 converted-trained-q8 converted-trained-registry`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8096/app/ 9392 converted-trained-q8 converted-trained-source-review-sidecar-drift`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8098/app/ 9271 converted-trained-q8 converted-trained-source-identity-drift`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8098/app/ 9272 tinylm16q8 ui-audit`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18810/app/ 19610 converted-trained-q8 converted-trained-registry`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18810/app/ 19611 converted-trained-q8 converted-trained-source-review-sidecar-drift`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18814/app/ 19617 converted-trained-q8 converted-trained-registry`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18814/app/ 19618 converted-trained-q8 converted-trained-source-review-tokenizer-import-drift`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18814/app/ 9223 converted-trained-q8 converted-trained-registry`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18814/app/ 9224 converted-trained-q8 converted-trained-source-validation-drift`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18814/app/ 9225 converted-trained-q8 converted-trained-source-review-eval-route-drift`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18814/app/ 9226 converted-trained-q8 converted-trained-runtime-evidence-drift`
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace --quiet`
- `git diff --check` passed with line-ending warnings only after the browser review-route/artifact update.

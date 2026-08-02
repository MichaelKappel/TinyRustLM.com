---
title: Operator Schedule Carry-Forward Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/operator-schedule-carry-forward-memory-2026-06-29/
status: reviewed_current
reviewed_utc: 2026-06-29T21:42:28Z
---

# Operator Schedule Carry-Forward Memory

## Summary

Parent-pool evolution schedules now flow beyond the recipe into sign-merge and soup operator receipts, multi-parent candidate manifests, multi-parent promotion templates, multi-parent selector admission records, selector registry entries, and browser Model Provenance Schedule rows. The handoff chain records the schedule checksum, schedule strategy/status/source, selected operator-family index, scheduled command, scheduled selection rule, and scheduled output gate.

## Source Change

- `tinyrustlm/tools/slm_pack/src/sign_merge.rs` copies the sign-merge schedule family from the parent-pool recipe into each sign-merge receipt.
- `tinyrustlm/tools/slm_pack/src/soup.rs` copies the soup schedule family from the parent-pool recipe into each soup receipt.
- `tinyrustlm/tools/slm_pack/src/multi_candidate.rs` validates the scheduled family against the recipe and carries the schedule fields into the candidate manifest.
- `tinyrustlm/tools/slm_pack/src/multi_promotion.rs` carries the schedule fields from the candidate manifest into the multi-parent promotion template.
- `tinyrustlm/tools/slm_pack/src/multi_admission.rs` carries the schedule fields into the selector admission record and validates scheduled family kind against the bound operator receipt.
- `tinyrustlm/tools/slm_pack/src/selector.rs` copies the admission schedule into `entry.N.evolution_*` and `entry.N.scheduled_operator_family_*`, validates source/status/checksum/family-kind agreement, and binds the schedule fields into selector proof inputs.
- `tinyrustlm/app/app.js` validates the schedule fields during browser registry intake, accepts zero-based scheduled family indices, and renders the compact Schedule row with family index, command, selection rule, output gate, and schedule checksum from accepted registry entries.
- `tinyrustlm/tools/browser-smoke.js` asserts generated sign-merge and soup Schedule rows with family index, command, selection rule, output gate, and schedule checksum while keeping source-root models at `unavailable`; `generated-selector-schedule-source-drift` mutates the copied selection source and proves fallback before generated routes.

## Verification

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack sign_merge -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack soup -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack multi_candidate -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack multi_promotion -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack multi_admission -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack writes_and_validates_selector_registry_from_multi_parent_admission_record -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack writes_and_validates_mixed_selector_registry_admission_versions -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack rejects_selector_registry_evolution_schedule_metadata_drift -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `cargo test -p tinyrustlm-browser-harness --quiet`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-schedule-provenance-20260629e/tinyrustlm all mixed`
- `cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target/browser-schedule-visible-rule-gate/tinyrustlm all mixed`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8135/app/ 9403 multi-parent-sign-merge-q4 adapter-sidecar-registry-file`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8135/app/ 9405 multi-parent-sign-merge-q4 combined-selector-operator-family`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18721/app/ 9224 multi-parent-sign-merge-q4 generated-selector-schedule-source-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18781/app/ 9401 multi-parent-sign-merge-q4 combined-selector-operator-family`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18781/app/ 9402 multi-parent-sign-merge-q4 generated-selector-schedule-source-drift`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18782/app/ 9403 tinylm16q8 ui-audit`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8080/app/ 9406 tinylm16q8 ui-audit`

The focused tests assert schedule checksum and scheduled-family command fields for sign-merge receipts, soup receipts, candidate manifests, promotion templates, admission records, selector-registry admission fixtures, and selector registry entry output. `rejects_selector_registry_evolution_schedule_metadata_drift` proves registry validation rejects copied schedule status, selection source, relatedness checksum, checksum algorithm, schedule checksum, family index, command, selection rule, and output gate drift. The generated mixed-root browser smoke proved Schedule rows for `operator-family-planned / family 0 / sign-merge-candidate / seed-weighted-delta-sign-consensus / multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval / ...` and `operator-family-planned / family 1 / soup-candidate / seed-weighted-direct-parameter-average / multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval / ...`; `generated-selector-schedule-source-drift` proved a copied selection-source mismatch falls back to static q8 before generated model, module-plan, assembly, adapter-family, or stack routes; source-root UI audit kept non-generated Schedule provenance at `unavailable`. The full packer suite passed with 326 tests. No coverage tool is active in the zero-dependency workspace, so focused field assertions plus full packer and browser-smoke coverage are recorded against the 75% target.

## Routing

Load this report before changing parent-pool evolution schedules, sign-merge receipts, soup receipts, multi-parent candidate manifests, multi-parent promotion templates, multi-parent admission records, scheduled operator-family handoff, selector registry admission fixtures, browser selector registry schedule fields, browser Model Provenance Schedule rendering, or browser bundle evidence chains that consume parent-pool operator receipts.

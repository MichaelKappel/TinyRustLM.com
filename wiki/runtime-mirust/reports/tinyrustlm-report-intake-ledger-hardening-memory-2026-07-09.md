# TinyRustLM Report-Intake Ledger Hardening Memory - 2026-07-09

## Purpose

This memory records the correction that turns the 2026-07-08 Improvement intake route from batch-level proof into report-level `.uai` accountability.

## Error Class

The failure mode was subtle: `agent-file-handoff/Improvement` was correctly identified as the active TinyRustLM intake folder, and `docs/report-intake/2026-07-08` correctly preserved durable copies, but the verifier only proved durable preservation and broad hot-memory route references. That allowed a future regression where the manifest could be complete while `.uai/intake-outcome-ledger.uai` lacked per-report distribution evidence.

The corrected rule is that "processed" means every active Markdown report has all of these:

- active source path from `agent-file-handoff/Improvement`
- durable body path under `docs/report-intake/2026-07-08`
- category route
- SHA-256 evidence
- disposition
- routing summary into implementation work

## Files Updated

- `eng/verify-report-intake-memory.ps1`
- `.uai/intake-outcome-ledger.uai`
- `.uai/short-term-memory.uai`
- `.uai/test-plan.uai`
- `.uai/index.uai`

## Verifier Contract

`eng/verify-report-intake-memory.ps1` still checks:

- active intake exists
- durable folder exists
- manifest exists
- active report count is 43
- manifest preserved-file count matches active count
- every active Markdown file appears in the manifest
- durable copy exists
- manifest source/durable paths match
- manifest byte count matches source bytes
- source and durable SHA-256 hashes match
- hot `.uai` files route to expanded synthesis and durable memory

It now also checks that `.uai/intake-outcome-ledger.uai` contains, for every active report:

- `source_path: <manifest source path>`
- `docs_evidence_path: <manifest durable path>`
- `category: <manifest category>`
- `sha256: <manifest sha>`

This prevents the old memory-distribution error from being hidden by a good manifest alone.

## Report-Level Ledger

`.uai/intake-outcome-ledger.uai` now contains `entries_2026_07_08_expanded_distillation_compression` with one entry for each of the 43 active Markdown reports. Each entry records source path, durable path, category, SHA-256, disposition, and a compact routing summary.

## Verification

Command:

```powershell
powershell -ExecutionPolicy Bypass -File .\eng\verify-report-intake-memory.ps1
```

Result:

- `active_report_count=43`
- `expected_report_count=43`
- `missing_or_mismatched_count=0`

Additional hygiene:

```powershell
git diff --check
```

Result: no whitespace errors; Git reported line-ending normalization warnings only.

## Operating Rule

Future intake work must not claim "reports processed" from durable copies alone. The minimum evidence is active intake scan, durable copy, manifest row, report-level ledger record, hot `.uai` route, long-term pointer, and verifier pass.

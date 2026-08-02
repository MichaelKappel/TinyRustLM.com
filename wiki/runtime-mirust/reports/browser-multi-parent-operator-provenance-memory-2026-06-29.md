# Browser Multi-Parent Operator Provenance Memory - 2026-06-29

## Purpose

Route future agents to the proof that generated multi-parent selector entries carry receipt-bound operator metadata all the way into browser Model Provenance. This report covers the soup and sign-merge parent-pool paths where the browser now renders `receipt-bound / <operator_kind> / <receipt_checksum>` from selector `entry.N.operator_receipt_*` fields.

## Implementation

- `tinyrustlm/tools/slm_pack/src/multi_admission.rs` now emits receipt-bound operator metadata from the parent-pool operator receipt into multi-parent admission records.
- Multi-parent admission records copy the receipt path, receipt checksum, operator id, operator kind, candidate `.slm` checksum, and candidate byte count.
- Multi-parent admission summary validation now checks receipt status, operator identity, candidate checksum equality, and candidate byte-count equality.
- `tinyrustlm/tools/slm_pack/src/selector.rs` already copies receipt-bound admission metadata into selector registry entries as `entry.N.operator_receipt_*`; generated multi-parent records now use that same route.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` tests prove generated soup selector registries contain operator receipt fields for q8 and all-quant roots.
- `tinyrustlm/tools/browser-smoke.js` now expects generated multi-parent models to render the operator receipt row, with `seed-weighted-parent-pool-soup` for `multi-parent-soup-*` and `sign-aware-parent-pool-merge` for `multi-parent-sign-merge-*`.
- `tinyrustlm/tools/browser-smoke.js` also has `generated-selector-operator-receipt-drift`, which mutates served generated selector `operator_receipt_candidate_artifact_bytes` fields before browser registry intake and proves no generated model, module-plan, assembly, adapter-family, or adapter-stack route is requested.
- `tinyrustlm/app/app.js` now maps generated assembly-backed `multi-parent-soup-*` and `multi-parent-sign-merge-*` selector entries to their expected operator kinds before accepting `entry.N.operator_receipt_*`.
- `tinyrustlm/tools/browser-smoke.js` now also has `generated-selector-operator-kind-drift`, which rewrites generated selector operator-kind fields while preserving byte echoes and proves the same fallback-before-generated-route boundary.

## Soup Browser Proof

The fresh all-quant soup root was generated with:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-soup-operator-provenance\tinyrustlm all soup
```

The generated `models/selector.registry` contains `entry.N.operator_receipt_*` fields for all three soup entries:

- `multi-parent-soup-f32`: `operator_receipt_operator_kind=seed-weighted-parent-pool-soup`, checksum `0x2efb938150b29ce3`.
- `multi-parent-soup-q8`: `operator_receipt_operator_kind=seed-weighted-parent-pool-soup`, checksum `0x22cf99b6d8fcaf3b`.
- `multi-parent-soup-q4`: `operator_receipt_operator_kind=seed-weighted-parent-pool-soup`, checksum `0x1eccc0af80f7e84e`.

The browser proof passed with:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-local-server -- target\browser-served-multi-parent-soup-operator-provenance\tinyrustlm 8099
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8099/app/ 9360 multi-parent-soup-q4 combined-selector-assembly
```

Observed Model Provenance Operator rows:

- q4: `receipt-bound / seed-weighted-parent-pool-soup / 0x1eccc0af80f7e84e`
- q8: `receipt-bound / seed-weighted-parent-pool-soup / 0x22cf99b6d8fcaf3b`
- f32: `receipt-bound / seed-weighted-parent-pool-soup / 0x2efb938150b29ce3`

The same smoke also proved q4-first selection, q4/q8/f32 switching in one browser session, module-plan verification before model bytes, `soup.*` evidence fetches, adapter-family receipt and manifest verification, ADP1/ASP1/ALR1 Rust validation, three adapter applies, 21 generated self-assembly fetches per entry, and matching actual route-set, module-byte, and module-checksum accounting.

## Sign-Merge Browser Proof

The fresh all-quant sign-merge root was generated with:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-sign-merge-operator-provenance\tinyrustlm all sign-merge
```

The generated `models/selector.registry` contains `entry.N.operator_receipt_*` fields for all three sign-merge entries:

- `multi-parent-sign-merge-f32`: `operator_receipt_operator_kind=sign-aware-parent-pool-merge`, checksum `0x37052cadf8caf762`.
- `multi-parent-sign-merge-q8`: `operator_receipt_operator_kind=sign-aware-parent-pool-merge`, checksum `0xf1eb189593029e5d`.
- `multi-parent-sign-merge-q4`: `operator_receipt_operator_kind=sign-aware-parent-pool-merge`, checksum `0xeb8d651eb9fccc62`.

The browser proof passed with:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-local-server -- target\browser-served-multi-parent-sign-merge-operator-provenance\tinyrustlm 8109
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8109/app/ 9361 multi-parent-sign-merge-q4 combined-selector-assembly
```

Observed Model Provenance Operator rows:

- q4: `receipt-bound / sign-aware-parent-pool-merge / 0xeb8d651eb9fccc62`
- q8: `receipt-bound / sign-aware-parent-pool-merge / 0xf1eb189593029e5d`
- f32: `receipt-bound / sign-aware-parent-pool-merge / 0x37052cadf8caf762`

The sign-merge smoke also proved q4-first selection, q4/q8/f32 switching in one browser session, module-plan verification before model bytes, `sign-merge.*` evidence fetches, adapter-family receipt and manifest verification, ADP1/ASP1/ALR1 Rust validation, three adapter applies, 21 generated self-assembly fetches per entry, and matching actual route-set, module-byte, and module-checksum accounting.

## Generated Drift Proof

The generated selector drift proof passed for both parent-pool families:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-local-server -- target\browser-served-multi-parent-soup-operator-provenance\tinyrustlm 8112
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8112/app/ 9370 multi-parent-soup-q4 generated-selector-operator-receipt-drift

C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-local-server -- target\browser-served-multi-parent-sign-merge-operator-provenance\tinyrustlm 8112
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8112/app/ 9371 multi-parent-sign-merge-q4 generated-selector-operator-receipt-drift
```

Both smokes mutated generated `models/selector.registry` operator receipt byte echoes before app.js accepted selector entries. The browser rejected the generated q4/q8/f32 entries, selected fallback `tinylm16q8`, rendered Operator as `unavailable`, and completed one-token generation from the checked local q8 fallback served by the harness.

Observed request shape for both families:

- `/runtime/tinyrustlm.wasm.manifest`
- `/runtime/tinyrustlm.wasm`
- `/models/selector.registry`
- `/models/tinylm16-q8.slm`
- `/models/tinylm16-q8.slm.manifest`

No generated `.slm`, `.module-plan.receipt`, `.assembly.receipt`, `.adapter-family.receipt`, ADP1, ASP1, or ALR1 route was requested after the selector operator receipt drift.

## Generated Operator-Kind Drift Proof

Fresh generated roots were staged with the current source app shell:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-soup-operator-kind-drift\tinyrustlm all soup
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-sign-merge-operator-kind-drift\tinyrustlm all
```

The new generated selector operator-kind drift proof passed for both parent-pool families:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-local-server -- target\browser-served-multi-parent-soup-operator-kind-drift\tinyrustlm 8114
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8114/app/ 9381 multi-parent-soup-q4 generated-selector-operator-kind-drift

C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-local-server -- target\browser-served-multi-parent-sign-merge-operator-kind-drift\tinyrustlm 8114
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8114/app/ 9382 multi-parent-sign-merge-q4 generated-selector-operator-kind-drift
```

Both smokes rewrote generated selector `operator_receipt_operator_kind` values before app.js accepted selector entries. The browser rejected the generated q4/q8/f32 entries, selected fallback `tinylm16q8`, rendered Operator as `unavailable`, and completed one-token generation from the checked local q8 fallback served by the harness.

Observed request shape for both families matched the byte-drift proof:

- `/runtime/tinyrustlm.wasm.manifest`
- `/runtime/tinyrustlm.wasm`
- `/models/selector.registry`
- `/models/tinylm16-q8.slm`
- `/models/tinylm16-q8.slm.manifest`

No generated `.slm`, `.module-plan.receipt`, `.assembly.receipt`, `.adapter-family.receipt`, ADP1, ASP1, or ALR1 route was requested after the selector operator kind drift.

The positive sign-merge generated root still passed:

```powershell
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8114/app/ 9383 multi-parent-sign-merge-q4 combined-selector-assembly
```

That pass proved q4/q8/f32 generated entries still reach Ready, render `receipt-bound / sign-aware-parent-pool-merge / <checksum>` Operator rows, verify module plans, fetch sign-merge evidence, validate ADP1/ASP1/ALR1 stacks, and apply three adapters before generation.

The compact federated selector fixture still passed:

```powershell
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8115/app/ 9384 multi-parent-sign-merge-q8 multi-parent-registry
```

That pass rendered `receipt-bound / federated-local-update-average / 0x00000000000000b0`, proving the browser operator-kind check is scoped to generated assembly-backed entries rather than every candidate id that starts with `multi-parent-*`.

## Verification

- `node --check tinyrustlm\tools\browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack multi_admission -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack writes_and_validates_selector_registry_from_multi_parent_admission_record -- --nocapture`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack writes_browser_multi_parent_soup_bundle -- --nocapture`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8099/app/ 9360 multi-parent-soup-q4 combined-selector-assembly`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-sign-merge-operator-provenance\tinyrustlm all sign-merge`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8109/app/ 9361 multi-parent-sign-merge-q4 combined-selector-assembly`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8112/app/ 9370 multi-parent-soup-q4 generated-selector-operator-receipt-drift`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8112/app/ 9371 multi-parent-sign-merge-q4 generated-selector-operator-receipt-drift`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8113/app/ 9372 tinylm16q8 selector-operator-receipt-drift`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-soup-operator-kind-drift\tinyrustlm all soup`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-sign-merge-operator-kind-drift\tinyrustlm all`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8114/app/ 9381 multi-parent-soup-q4 generated-selector-operator-kind-drift`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8114/app/ 9382 multi-parent-sign-merge-q4 generated-selector-operator-kind-drift`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8114/app/ 9383 multi-parent-sign-merge-q4 combined-selector-assembly`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8115/app/ 9384 multi-parent-sign-merge-q8 multi-parent-registry`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8115/app/ 9385 tinylm16q8 selector-operator-receipt-drift`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8114/app/ 9386 multi-parent-sign-merge-q4 generated-selector-operator-receipt-drift`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack --quiet` with 292 tests passed.
- `git diff --check` returned only line-ending normalization notices.
- Ports 8114 and 8115 had no listening server after the browser-smoke runs; remaining TCP rows were `TimeWait` only.

## Test Coverage Notes

No coverage tool is active in this zero-dependency workspace. Focused coverage now exercises the changed multi-parent admission receipt-path parameter, receipt text parameter, selector copied fields, browser-bundle generated soup registry fields, browser-visible operator row assertion, generated selector operator receipt byte-drift fallback behavior, generated selector operator-kind fallback behavior, and the app.js generated assembly parameter that scopes operator-kind agreement.

## Routing

Open this report before changing:

- `multi-parent-admission-record` receipt carry-forward.
- Selector `entry.N.operator_receipt_*` fields.
- Browser Model Provenance Operator rendering for generated parent-pool models.
- `generated-selector-operator-receipt-drift`, `generated-selector-operator-kind-drift`, or selector operator receipt byte/kind equality checks.
- Browser-generated assembly scoping in `expectedGeneratedOperatorReceiptKind`.
- `browser-multi-parent-bundle ... soup` registry output.
- Generated multi-parent browser smoke provenance assertions.

Related memory:

- `wiki/runtime-mirust/reports/selector-operator-receipt-binding-memory-2026-06-29.md`
- `wiki/runtime-mirust/reports/browser-parent-pool-soup-bundle-memory-2026-06-29.md`
- `wiki/runtime-mirust/reports/browser-module-plan-operator-receipt-memory-2026-06-29.md`
- `wiki/runtime-mirust/reports/multi-parent-soup-manifest-memory-2026-06-29.md`

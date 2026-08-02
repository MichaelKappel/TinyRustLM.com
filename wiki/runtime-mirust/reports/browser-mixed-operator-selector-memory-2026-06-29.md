# Browser Mixed Operator Selector Memory - 2026-06-29

## Purpose

Route future agents to the first browser-served selector root that carries both parent-pool operator families at once. This proof covers one generated `selector.registry` that serves sign-merge and weighted-soup q4/q8/f32 entries, then makes the browser assemble across both families in one page.

## Implementation

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` now accepts `browser-multi-parent-bundle <root> [f32|q8_0|q4_0|all] mixed`.
- The mixed mode expands the operator selector into `sign-merge` plus `soup`, while the existing `sign-merge` default and explicit `soup` mode remain unchanged.
- Mixed `all` roots stage six generated models: `multi-parent-sign-merge-f32`, `multi-parent-sign-merge-q8`, `multi-parent-sign-merge-q4`, `multi-parent-soup-f32`, `multi-parent-soup-q8`, and `multi-parent-soup-q4`.
- Each entry keeps its own module-plan receipt, assembly receipt, adapter-family receipt, ADP1/ASP1/ALR1 stack, and operator-scoped evidence files.
- The selector default remains `multi-parent-sign-merge-q4`, preserving the browser-frugal q4 route when multiple q4 entries are present.
- `tinyrustlm/tools/browser-smoke.js` now has `combined-selector-operator-family`, which switches one browser page through sign-merge q4, soup q4, sign-merge q8, soup q8, sign-merge f32, and soup f32.
- `tinyrustlm/tools/browser-smoke.js` also has `combined-selector-operator-family-cycle`, which repeats that six-entry sequence and applies the existing release-before-reassembly, validation-count, apply-count, stack-completion, route-count, and local-origin checks across both operator families.
- `tinyrustlm/tools/browser-smoke.js` also has `combined-selector-operator-family-route-soak`, which reuses the route-soak assertion layer for the mixed six-entry sequence and proves every expected self-assembly route is requested once per generated assembly pass.
- `tinyrustlm/tools/browser-smoke.js` also has `combined-selector-operator-family-reload-soak`, which repeats the mixed six-entry assembly sequence across fresh browser page lifetimes and checks each reload contains three sign-merge steps plus three soup steps.

## Browser Proof

The mixed root was generated with:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-mixed-operator-family\tinyrustlm all mixed
```

Observed generator proof:

- `SLM selector registry validation: PASS`
- `admissions: 6`
- `adapter_routes: 24`
- `adapter_family_routes: 6`
- `assembly_routes: 6`
- `module_plan_routes: 6`
- `SLM browser multi-parent model count: 6`

The browser proof passed with:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-local-server -- target\browser-served-multi-parent-mixed-operator-family\tinyrustlm 8116
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8116/app/ 9387 multi-parent-sign-merge-q4 combined-selector-operator-family
```

The smoke observed initial selection `multi-parent-sign-merge-q4` and these model options in one selector:

- `multi-parent-sign-merge-f32`
- `multi-parent-sign-merge-q8`
- `multi-parent-sign-merge-q4`
- `multi-parent-soup-f32`
- `multi-parent-soup-q8`
- `multi-parent-soup-q4`

The browser walked this assembly sequence:

- `multi-parent-sign-merge-q4`
- `multi-parent-soup-q4`
- `multi-parent-sign-merge-q8`
- `multi-parent-soup-q8`
- `multi-parent-sign-merge-f32`
- `multi-parent-soup-f32`

Each entry reached Ready after module-plan verification, generated model and manifest acceptance, operator-scoped assembly evidence verification, adapter-family receipt and manifest verification, Rust `validate_adapter_delta` for three stack members, three adapter applies, 21 generated self-assembly fetches, matching actual route-set checksum, matching module bytes, and matching module checksums.

Observed browser Operator rows included both families:

- Sign-merge entries rendered `receipt-bound / sign-aware-parent-pool-merge / <receipt checksum>`.
- Soup entries rendered `receipt-bound / seed-weighted-parent-pool-soup / <receipt checksum>`.

The repeated mixed-family cycle proof passed with:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-mixed-operator-cycle\tinyrustlm all mixed
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-local-server -- target\browser-served-mixed-operator-cycle\tinyrustlm 8117
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8117/app/ 9388 multi-parent-sign-merge-q4 combined-selector-operator-family-cycle 2
```

The cycle smoke walked 12 generated assemblies in one page:

- Cycle 0: sign-merge q4, soup q4, sign-merge q8, soup q8, sign-merge f32, soup f32.
- Cycle 1: sign-merge q4, soup q4, sign-merge q8, soup q8, sign-merge f32, soup f32.

The assertion layer required six sign-merge steps and six soup steps, one `free_model` before every post-initial assembly, three Rust validation calls, at least three Rust apply calls, one stack completion per step, 21 governed generated-route fetches per step, and same-origin loopback-only requests. Port 8117 was clear after the smoke.

The mixed-family route-soak proof passed with:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-local-server -- target\browser-served-mixed-operator-cycle\tinyrustlm 8118
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8118/app/ 9389 multi-parent-sign-merge-q4 combined-selector-operator-family-route-soak 2
```

The route-soak smoke repeated the 12 generated assemblies from the mixed cycle proof and asserted that every expected module-plan, model, manifest, assembly receipt, evidence-file, adapter-family receipt, adapter manifest, and ADP1/ASP1/ALR1 stack artifact route for all six generated models was requested at least twice. The smoke finished on `multi-parent-soup-f32`, and port 8118 was clear after shutdown.

The mixed-family reload-soak proof passed with:

```powershell
C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-local-server -- target\browser-served-mixed-operator-cycle\tinyrustlm 8119
node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8119/app/ 9390 multi-parent-sign-merge-q4 combined-selector-operator-family-reload-soak 2
```

The reload-soak smoke ran two fresh browser page lifetimes. Each lifetime started from `multi-parent-sign-merge-q4`, then assembled:

- `multi-parent-sign-merge-q4`
- `multi-parent-soup-q4`
- `multi-parent-sign-merge-q8`
- `multi-parent-soup-q8`
- `multi-parent-sign-merge-f32`
- `multi-parent-soup-f32`

The assertion layer required three sign-merge steps and three soup steps per reload, runtime WASM manifest and selector registry requests at least once per reload, and every expected self-assembly route for all six generated models requested at least twice. Each reload finished on `multi-parent-soup-f32`, and port 8119 was clear after shutdown.

## Verification

- `node --check tinyrustlm\tools\browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::tests::writes_combined_browser_multi_parent_mixed_operator_bundle --quiet`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack browser_bundle::tests --quiet` with 7 tests passed.
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-multi-parent-mixed-operator-family\tinyrustlm all mixed`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8116/app/ 9387 multi-parent-sign-merge-q4 combined-selector-operator-family`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle target\browser-served-mixed-operator-cycle\tinyrustlm all mixed`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8117/app/ 9388 multi-parent-sign-merge-q4 combined-selector-operator-family-cycle 2`
- `node --check tinyrustlm\tools\browser-smoke.js`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8118/app/ 9389 multi-parent-sign-merge-q4 combined-selector-operator-family-route-soak 2`
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8119/app/ 9390 multi-parent-sign-merge-q4 combined-selector-operator-family-reload-soak 2`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-slm-pack --quiet` with 293 tests passed.
- `git diff --check` returned only line-ending normalization notices.
- Ports 8116, 8117, 8118, and 8119 had no listening server after the smokes.

No coverage tool is active in this zero-dependency workspace. The closest automated evidence is the new mixed-operator Rust bundle test, the full browser-bundle test module, the full packer suite, the six-entry browser smoke that exercises the new `operator` parameter value through real file-backed selector routing, the mixed route-soak smoke that exercises every generated self-assembly route twice, and the mixed reload-soak smoke that repeats the six-entry proof across fresh page lifetimes.

## Routing

Open this report before changing:

- `browser-multi-parent-bundle` operator selection.
- Mixed sign-merge plus soup selector roots.
- `combined-selector-operator-family`, `combined-selector-operator-family-cycle`, `combined-selector-operator-family-route-soak`, and `combined-selector-operator-family-reload-soak` browser smoke behavior.
- Browser selector defaults when multiple generated q4 entries exist.
- Cross-family generated self-assembly route accounting.

Related memory:

- `wiki/runtime-mirust/reports/browser-parent-pool-soup-bundle-memory-2026-06-29.md`
- `wiki/runtime-mirust/reports/browser-multi-parent-operator-provenance-memory-2026-06-29.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-assembly-memory-2026-06-28.md`
- `wiki/runtime-mirust/reports/browser-combined-selector-cycle-memory-2026-06-28.md`

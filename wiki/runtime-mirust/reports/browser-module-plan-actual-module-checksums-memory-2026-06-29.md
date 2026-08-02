---
title: Browser Module Plan Actual Module Checksums Memory 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/browser-module-plan-actual-module-checksums-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T13:30:00Z
---

# Browser Module Plan Actual Module Checksums Memory

TinyRustLM generated self-assembly now has browser-observed module-checksum accounting. The browser records the checksum identity of each accepted module-plan module as the module is accepted, renders `Actual Module Checksums`, and only marks generated entries ready when the observed checksum list equals the verified receipt-declared module checksum list.

## What Changed

- `tinyrustlm/app/index.html` adds the Module Plan `Actual Module Checksums` row.
- `tinyrustlm/app/app.js` resets observed module checksums on generated model load, records generated text module checksums from fetched text, records generated adapter-stack checksums from fetched artifact bytes, records the accepted model checksum from the verified `.slm.manifest` after Rust accepts the model, rejects duplicate or missing module checksum indexes, and requires observed checksums to match the verified receipt before generated Ready.
- `tinyrustlm/tools/browser-smoke.js` captures `modulePlanActualModuleChecksums` in generated and source snapshots, asserts generated actual checksums equal the rendered declared checksum summary, keeps source-root fallback at `unavailable`, and refreshes exact generated module summary constants for the current q4_0/q8_0/f32 bundle output.
- `tinyrustlm/tools/browser-smoke.js` adds `module-plan-payload-checksum-drift`, which rewrites a generated family ADP1 payload checksum through its manifest, adapter-family receipt, assembly receipt, selector registry, and module-plan receipt while leaving the module checksum row stale.
- `tinyrustlm/docs/testing.md` routes actual-checksum changes through source `ui-audit`, generated `combined-selector-assembly`, generated `adapter-sidecar-registry-file`, and `module-plan-payload-checksum-drift`.

## Browser Contract

The observed checksum list covers the seven module-plan modules:

- generated `.slm` model identity after Rust load and manifest verification
- generated `.slm.manifest` text checksum
- generated `.assembly.receipt` text checksum
- generated `.adapter-family.receipt` text checksum
- family ADP1 stack artifact checksum
- sparse ASP1 stack artifact checksum
- source-backed ALR1 stack artifact checksum

The model checksum remains the `.slm` checksum identity carried by the model manifest after Rust accepts the model; JavaScript still does not parse `.slm` tensor payloads.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- Generated `module-plan-payload-checksum-drift` on `http://127.0.0.1:18768/app/` proved the coherent payload checksum rewrite stops at `module plan adapter module checksum mismatch` after only selector registry plus module-plan receipt requests; generated model, manifest, assembly, evidence, adapter-family, adapter-manifest, and stack artifact routes were not requested.
- Generated q4_0 `adapter-sidecar-registry-file` on `http://127.0.0.1:18768/app/` still reached `Ready`, rendered `Actual Module Checksums` equal to `Checksums`, and applied the ADP1/ASP1/ALR1 stack before generation after the new smoke mode was added.
- `cargo fmt --all -- --check`
- `cargo run --manifest-path tinyrustlm/tools/browser_harness/Cargo.toml -- tinyrustlm`
- Fresh generated `all` root staged at `target/module-plan-actual-module-checksums-20260629/tinyrustlm`.
- Generated `combined-selector-assembly` on `http://127.0.0.1:18766/app/` proved q4_0, q8_0, and f32 all reached `Ready`, generated response `e`, applied the three-adapter stack, displayed `Actual Fetches 21 fetches`, matched Actual Route Set to Route Set, and displayed `Actual Module Checksums` equal to the declared checksum summary for every entry:
  - q4_0 `0: 0x1a6808e3098d1ce0, 1: 0xfa5ea1108910598f, 2: 0xec65527ba6a0a24d, 3: 0x6c3f07949496907d, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6, 6: 0xcaf46ccfc262fad2`
  - q8_0 `0: 0x0132bc82d5a0d7d6, 1: 0x855c8c30e39227c5, 2: 0x88f5f52063d8d332, 3: 0x0988468dc4daf944, 4: 0x8194a8a671285019, 5: 0x6fa5d29bee9b7cfb, 6: 0x1ed9d08142edfda9`
  - f32 `0: 0x8a0e6c4c01998199, 1: 0xc2b257b1f036bfcb, 2: 0xd6d39c383538e5c3, 3: 0xe958c9dabb3565f0, 4: 0xe9669ade4571fd42, 5: 0x34008cedc028ed5c, 6: 0x1c64143141c223b5`
- Generated `adapter-sidecar-registry-file` on the same root proved the q4_0 exact-summary path reaches `Ready` with `Actual Module Checksums` matching `Checksums`.
- Source `ui-audit` on `http://127.0.0.1:18767/app/` proved desktop and mobile fallback snapshots keep `Actual Module Checksums`, `Actual Module Bytes`, `Actual Fetches`, and `Actual Route Set` at `unavailable`.

## Routing

Open this report before changing generated module checksum accounting, `recordModulePlanActualModuleChecksum`, Module Plan `Actual Module Checksums` display, actual text module checksum recording, stack artifact checksum recording, or browser-smoke assertions that compare fetched module checksums to receipt-declared module checksum rows.

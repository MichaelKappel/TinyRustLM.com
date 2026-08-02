---
title: Multi-Parent Soup Manifest Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/multi-parent-soup-manifest-memory-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T16:25:00Z
---

# Multi-Parent Soup Manifest Memory

`tinyrustlm-slm-pack multi-parent-candidate-manifest` now accepts validated parent-pool operator receipts from both `sign-merge-candidate` and `soup-candidate`.

The manifest builder parses `operator_kind`, routes recomputation through the owning operator module, and preserves shared parent-pool fields plus the operator-specific metric block. Sign-merge manifests keep sign consensus fields. Soup manifests keep direct averaging fields: `soup_merge_rule`, `soup_weight_source`, `soup_weight_unit`, `soup_total_parameter_count`, `soup_parent_weight_checksum`, `soup_weighted_value_checksum`, `soup_changed_from_frontier_count`, and `soup_changed_from_frontier_density_ppm`.

The candidate manifest status is now `validated-parent-pool-operator-output`, reflecting the shared gate. Existing downstream promotion, admission, selector, and browser-bundle paths still validate after the change, while the manifest route no longer assumes the only parent-pool operator is sign merge.

## Source Routes

- `tinyrustlm/tools/slm_pack/src/multi_candidate.rs`
- `tinyrustlm/tools/slm_pack/src/soup.rs`
- `tinyrustlm/tools/slm_pack/src/sign_merge.rs`
- `tinyrustlm/tools/slm_pack/src/multi_promotion.rs`
- `tinyrustlm/tools/slm_pack/src/multi_admission.rs`

## Verification

- `cargo fmt --all -- --check` passed.
- `cargo test -p tinyrustlm-slm-pack multi_candidate -- --nocapture` passed with 8 tests.
- `cargo test -p tinyrustlm-slm-pack multi_ -- --nocapture` passed with 23 tests, covering downstream multi-parent promotion, admission, selector, and browser-bundle paths.
- `cargo test -p tinyrustlm-slm-pack` passed with 289 tests.

## Routing

Open this report when changing `multi-parent-candidate-manifest`, `validate-multi-parent-candidate`, soup receipt handoff, parent-pool operator-kind dispatch, candidate manifest status, soup metric preservation, or sign-merge manifest compatibility.

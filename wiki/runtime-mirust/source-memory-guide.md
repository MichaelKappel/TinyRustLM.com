---
title: Runtime.MiRust.com Source Memory Guide
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/source-memory-guide/
status: planned_pending_publication
reviewed_utc: 2026-07-04T01:35:00Z
---

# Runtime.MiRust.com Source Memory Guide

Use this guide to route future agents to the correct memory layer.

## Active Project Memory

Hot Project Handoff memory lives in `.uai/`. Start with `.uai/startup-packet.uai`, `.uai/workspace-guidance.uai`, `.uai/file-handoff.uai`, `.uai/long-term-memory.uai`, and `.uai/taboo.uai` when public site voice or product copy is in scope.

## Durable Project Memory

Reviewed durable memory lives in `wiki/runtime-mirust/` and publishes under `https://aiwikis.org/runtime-mirust/` when deployed. Raw evidence manifests live under `raw/runtime-mirust/`.

Report-derived long-term memory lives under `wiki/runtime-mirust/reports/`. Start with `reports/report-intake-index-2026-06-25.md` for the first processed batch, `reports/report-intake-index-2026-06-26.md` for model-breeding research, `reports/report-intake-index-2026-06-28.md` for ModelBreeder plus zero-dependency browser-runtime research, `reports/report-intake-index-2026-06-29.md` for tiny-model/runtime research, and `reports/report-intake-index-2026-06-29-followup.md` for safetensors/tokenizer/budget/fixture research, then load only the thematic synthesis record needed for the task.

UAIX File Handoff strategy is recorded in `docs/dogfood/uaix-file-handoff-memory-strategy-2026-06-26.md`. Current report pages are represented in `.uai/long-term-memory.uai`; `.uai/short-term-memory.uai` tells agents which report, research, dogfood, and pointer-ledger routes to open now.

For project rebrand routing, load `reports/runtime-rebrand-memory-2026-06-30.md` when Runtime.MiRust.com site identity, `runtime-mirust` wiki/raw namespaces, publish-review bundle naming, startup paths, or the remaining outer folder handoff is in scope.

For browser-served model-breeding evidence, load `reports/assembly-receipt-memory-2026-06-27.md` when selector assembly receipt fields, generated bundle evidence staging, evidence-file fetches, or browser Assembly Evidence rendering are in scope.

For browser proof of the original two-parent operators, load `reports/two-parent-operator-browser-provenance-memory-2026-06-29.md` when blend, task-delta, sparse task-delta, compact selector operator fixtures, Model Provenance Operator rendering, or receipt byte-echo fallback is in scope.

For offline direct-parameter crossover, load `reports/crossover-operator-memory-2026-06-29.md` when `crossover-candidate`, `validate-crossover-candidate`, seed/keep selection, mask checksums, q8 crossover proof, browser Operator rendering, crossover byte-echo fallback, or downstream candidate handoff is in scope.

For offline bounded mutation, load `reports/mutation-operator-memory-2026-06-29.md` when `mutation-candidate`, `validate-mutation-candidate`, seed/rate/magnitude parameters, reference scaling, selection and delta checksums, q8 mutation proof, browser Operator rendering, mutation byte-echo fallback, or downstream candidate handoff is in scope.

For offline magnitude pruning, load `reports/prune-operator-memory-2026-06-29.md` when `prune-candidate`, `validate-prune-candidate`, keep/floor parameters, magnitude ranking, mask checksums, output-value checksums, q8 prune proof, selector receipt carry-forward, browser Operator rendering, prune byte-echo fallback, operator-kind drift rejection, or downstream candidate handoff is in scope.

For offline DARE task-delta candidates, load `reports/dare-operator-memory-2026-06-29.md` when `dare-candidate`, `validate-dare-candidate`, signed task-delta weights, keep/drop rates, dropout seeds, seeded mask checksums, raw/rescaled delta checksums, q8 proof, or downstream candidate handoff is in scope.

For DARE browser operator provenance, load `reports/dare-browser-operator-provenance-memory-2026-06-29.md` when DARE selector receipt fields, `dare-operator-registry`, `dare-operator-receipt-drift`, compact Model Provenance Operator rendering, or DARE byte fallback behavior is in scope.

For browser converted-trained provenance, load `reports/browser-converted-trained-provenance-memory-2026-06-29.md` when `converted-trained-registry`, converted-trained q8 selector fixtures, converted-trained manifest request proof, browser Model Provenance source/admission/quality fields, or pending-eval provenance assertions are in scope.

For browser converted-trained file routing, load `reports/browser-converted-trained-file-route-memory-2026-06-29.md` when `browser-converted-trained-bundle`, `converted-trained-registry-file`, generated converted-trained roots, real selector/model/manifest fetch proof, or converted-trained file-backed browser smoke is in scope.

For browser converted-trained all routing, load `reports/browser-converted-trained-all-route-memory-2026-06-29.md` when `browser-converted-trained-bundle all`, q4-defaulted converted-trained f32/q8/q4 roots, all-quant selector defaults, or q4/q8/f32 file-backed browser smokes are in scope.

For browser converted-trained source evidence, load `reports/browser-converted-trained-source-evidence-memory-2026-06-30.md` when generated converted-trained evidence directories, `converted-trained.source.manifest`, selector source-manifest route fields, browser source verification before model bytes, or safetensors-generated browser source breadcrumbs are in scope.

For browser converted-trained runtime eval, load `reports/browser-converted-trained-runtime-eval-memory-2026-06-30.md` when bundle admission should depend on a native eval sidecar, when adding eval-cases routes, or when changing failed-eval behavior before selector admission.

For safetensors source intake, load `reports/safetensors-inspection-memory-2026-06-29.md` when `inspect-safetensors`, HuggingFace checkpoint metadata review, dtype/shape/offset reports, or first real tiny-model conversion planning is in scope.

For safetensors source planning, load `reports/safetensors-source-plan-memory-2026-06-29.md` when `plan-safetensors-source`, raw f32 extraction planning, target source-shape mapping, tied-output tensor planning, or safetensors-to-`convert-trained` bridge work is in scope.

For safetensors source extraction, load `reports/safetensors-source-extraction-memory-2026-06-29.md` when `extract-safetensors-source`, F32 copy, F16/BF16 decode, raw f32 source bundle writing, extracted `source.manifest`, or real tiny checkpoint extraction work is in scope.

For safetensors trained conversion, load `reports/safetensors-trained-conversion-memory-2026-06-29.md` when `convert-safetensors-trained`, Hugging Face Llama alias intake, preserved raw source directories, safetensors-to-`.slm` conversion, output quantization, or converted-trained manifest work is in scope.

For safetensors browser bundle work, load `reports/safetensors-browser-bundle-memory-2026-06-30.md` when `browser-safetensors-trained-bundle`, direct safetensors-to-browser selector roots, converted-trained all-quant roots from safetensors, runtime WASM manifest staging, or first real checkpoint browser intake is in scope.

For TinyLM-16M BPE safetensors planning, load `reports/tinylm16-bpe-safetensors-plan-memory-2026-06-30.md` when `tinylm16-bpe`, manifest-native `BPE1` source metadata, 39-tensor TinyLM-16M planning, sparse planner fixtures, or source-template shape lists are in scope.

For MiniModel source-option work, load `research/minimodel-p2p-tiny-model-exchange-roadmap-2026-07-01.md`, `research/minimodel-manifest-verifier-mvp-2026-07-01.md`, and `research/huggingface-api-source-options-2026-07-01.md` when local files/lists, Hugging Face discovery, P2P transfer, metadata-only catalogs, or no-server-model-byte boundaries are in scope.

For Hugging Face conversion-request handoffs, load `reports/tinyrustlm-huggingface-conversion-request-memory-2026-07-02.md` when `Start Conversion`, `minimodel.huggingface_conversion_request.v0`, `convert-huggingface-request`, generated `.tinyrustlm-convert.ps1` scripts, conversion receipts, or local `.safetensors` to `.slm` request parsing are in scope. Also load `reports/tinyrustlm-self-locating-conversion-kit-memory-2026-07-02.md` when the generated conversion script's workspace/source-file resolution, `TINYRUSTLM_WORKSPACE`, `MINIMODEL_WORKSPACE`, `TINYRUSTLM_SOURCE_SAFETENSORS`, nearby path fallbacks, or placeholder-path regression tests are in scope. Load `reports/tinyrustlm-huggingface-local-download-opt-in-memory-2026-07-03.md` when Hugging Face sibling URL/hash/byte hints, `TINYRUSTLM_ALLOW_HF_DOWNLOAD`, or browser-metadata-only versus local-script-download boundaries are in scope. Load `reports/tinyrustlm-huggingface-source-contract-memory-2026-07-03.md` when Rust must enforce request-listed `.safetensors` file names, byte counts, SHA-256 values, source-contract preflight failure, or source-contract receipt fields before Hugging Face-to-`.slm` conversion. Load `reports/tinyrustlm-huggingface-supported-source-gate-memory-2026-07-03.md` when no-`.safetensors` Hugging Face rows, `Start Conversion` eligibility, or no-supported-source summary wording is in scope. Load `reports/tinyrustlm-huggingface-source-size-risk-memory-2026-07-03.md` when large or unknown-size Hugging Face `.safetensors` rows, `Review Conversion`, P2P-preferred review wording, or source-size summary counts are in scope. Load `reports/tinyrustlm-huggingface-sharded-source-directory-memory-2026-07-03.md` when Hugging Face metadata lists multiple `.safetensors` shards, Rust conversion should accept a reviewed shard directory, generated kits must record the full file list, or inspect/plan/preflight/receipt evidence needs `source_file_count` and per-tensor source paths. Load `reports/tinyrustlm-simple-local-catalog-prioritized-hf-memory-2026-07-03.md` when the beginner P2P panel local `models.v0.json` picker, wider Hugging Face metadata search, result action ranking, or converted-once local catalog reuse is in scope. Load `reports/tinyrustlm-self-locating-peer-import-kit-memory-2026-07-02.md` when `.minimodel-peer-import.ps1`, `MINIMODEL_WORKSPACE`, `$PSScriptRoot` peer request/manifest/output paths, or peer-import placeholder regression tests are in scope.

For MiniModel late peer-source publication and the July 2 report intake synthesis, load `reports/tinyrustlm-minimodel-add-peer-source-intake-memory-2026-07-02.md` when `add-peer-source`, proof-ready versus P2P-ready catalog entries, generated conversion-script follow-up hints, `docs/report-intake/2026-07-02/`, Iroh-as-roadmap, or no-server-byte catalog availability claims are in scope.

For MiniModel peer-source announcement publication, load `reports/tinyrustlm-minimodel-peer-source-announcement-memory-2026-07-02.md` when `write-peer-source-announcement`, `apply-peer-source-announcements`, portable converter availability metadata, catalog-maintainer drift checks, or converted-once P2P-ready publication is in scope.

For MiniModel batch announcement snapshot publication, load `reports/tinyrustlm-minimodel-batch-announcement-snapshot-memory-2026-07-02.md` when `write-catalog-snapshot-with-announcements`, many peer-source announcement files, maintainer batch catalog publication, or direct `models.v0.json` P2P-ready metadata generation is in scope.

For MiniModel follow-up intake and announcement-feed publication, load `reports/tinyrustlm-followup-intake-announcement-feed-memory-2026-07-02.md` when `docs/report-intake/2026-07-02-followup/`, `write-peer-source-announcement-feed`, `write-catalog-snapshot-with-announcement-feed`, same-origin SHA-256-bound availability feeds, Hugging Face-to-TinyRustLM workflow guidance, P2P exchange architecture, or beginner/pro progressive disclosure are in scope.

For SLMComposer progressive UI/source-option work, load `wiki/runtime-mirust/reports/slmcomposer-progressive-source-ui-memory-2026-07-01.md` when Chat/Advanced Tools mode behavior, Local/Hugging Face/P2P source choices, diagnostics rail grouping, run history, source-options browser smoke, local `.slm` import status copy, or stale-live deploy status is in scope.

For first real tiny-model conversion planning, load `research/tiny-model-candidate-matrix-2026-06-29.md` when choosing Xenova 15M, Aurelius, StorySupra, Pythia, or a q4-only pressure route, or when adding converter fields for architecture, tokenizer, license route, byte budget, or first fixture proof.

For safetensors, tokenizer, browser budget, WASM hot-loop, model-breeding metadata, or reference-output fixture research from the 2026-06-29 follow-up intake, load `research/safetensors-tokenizer-budget-reference-ideas-2026-06-29.md`.

For offline federated/local-update candidates, load `reports/federated-operator-memory-2026-06-29.md` when `federated-candidate`, `validate-federated-candidate`, base/local-update parent roles, `local_update_weight_ppm`, local-update counts, delta checksums, q8 proof, or downstream candidate handoff is in scope.

For offline weighted soup candidates, load `reports/weighted-soup-operator-memory-2026-06-29.md` when `soup-candidate`, `validate-soup-candidate`, parent-pool `seed_weight_ppm`, weighted tensor averaging, parent order checksums, weighted-value checksums, changed-from-frontier density, or soup receipt routing is in scope.

For multi-parent soup manifest handoff, load `reports/multi-parent-soup-manifest-memory-2026-06-29.md` when `multi-parent-candidate-manifest`, `validate-multi-parent-candidate`, soup receipt handoff, parent-pool operator-kind dispatch, `candidate_manifest_status=validated-parent-pool-operator-output`, sign or soup metric preservation, or downstream multi-parent promotion/admission/selector routing is in scope.

For federated selector receipt routing, load `reports/federated-selector-receipt-route-memory-2026-06-29.md` when a `federated-local-update-average` receipt must be traced from candidate/promotion/admission evidence into `entry.N.operator_receipt_*` selector registry fields, browser Model Provenance Operator rendering, operator-kind drift rejection, or browser operator-receipt byte-count drift fallback.

For candidate operator receipt binding, load `reports/candidate-operator-receipt-binding-memory-2026-06-29.md` when `candidate-manifest`, `validate-candidate`, optional `[input.operator]`, receipt checksum fields, operator identity, candidate bytes, or candidate checksum equality are in scope.

For promotion operator receipt binding, load `reports/promotion-operator-receipt-binding-memory-2026-06-29.md` when `promotion-template`, `validate-promotion`, optional `[input.operator]`, receipt carry-forward, promotion receipt fields, missing receipt input, or receipt checksum drift are in scope.

For admission operator receipt binding, load `reports/admission-operator-receipt-binding-memory-2026-06-29.md` when `admission-record`, `validate-admission`, optional `[input.operator]`, receipt carry-forward, admission receipt fields, missing receipt input, summary validation, or receipt checksum drift are in scope.

For selector operator receipt binding, load `reports/selector-operator-receipt-binding-memory-2026-06-29.md` when `selector-registry`, `validate-selector-registry`, `entry.N.operator_receipt_*`, mate-selection checksums, Model Provenance Operator rendering, or receipt-bound admission-to-registry handoff is in scope.

For browser multi-parent operator provenance, load `reports/browser-multi-parent-operator-provenance-memory-2026-06-29.md` when multi-parent admissions, generated selector `entry.N.operator_receipt_*` fields, parent-pool soup/sign-merge Operator rows, generated combined-selector provenance assertions, `generated-selector-operator-receipt-drift`, or `generated-selector-operator-kind-drift` fallback-before-generated-route proof is in scope.

For browser mixed operator selectors, load `reports/browser-mixed-operator-selector-memory-2026-06-29.md` when `browser-multi-parent-bundle all mixed`, sign-merge plus soup q4/q8/f32 selector roots, q4 default preservation, `combined-selector-operator-family`, `combined-selector-operator-family-cycle`, `combined-selector-operator-family-route-soak`, `combined-selector-operator-family-reload-soak`, release-before-reassembly, fresh page lifetimes, or cross-family self-assembly route accounting is in scope.

For parent-pool evolution schedules, load `reports/parent-pool-evolution-schedule-memory-2026-06-29.md` when `parent-pool-recipe`, `validate-parent-pool-recipe`, PBT-style parent-pool replay, sign-merge/soup operator-family planning, seed-weight schedule metadata, or `evolution_schedule_checksum` validation is in scope.

For operator schedule carry-forward, load `reports/operator-schedule-carry-forward-memory-2026-06-29.md` when sign-merge receipts, soup receipts, multi-parent candidate manifests, scheduled family index/command/selection rule/output gate fields, or browser bundle evidence chains consume parent-pool operator receipts.

For compact adapter package work, load `reports/sparse-adapter-package-memory-2026-06-27.md` when `ASP1`, `sparse-adapter-delta`, `validate-sparse-adapter-delta`, or runtime sparse adapter apply is in scope.

For low-rank adapter package work, load `reports/low-rank-adapter-package-memory-2026-06-28.md` when `ALR1`, `low-rank-adapter-delta`, `validate-low-rank-adapter-delta`, deterministic factor payloads, or runtime low-rank adapter apply is in scope.

For trained adapter source work, load `reports/trained-adapter-source-memory-2026-06-28.md` when `adapter-source-template`, `validate-adapter-source`, trained low-rank factor manifests, or factor-file validation is in scope.

For trained adapter source ALR1 conversion, load `reports/trained-adapter-source-alr1-memory-2026-06-28.md` when `convert-adapter-source`, `validate-converted-adapter-source`, source-factor ALR1 packaging, source-backed ALR1 manifests, or reviewed factor-to-runtime adapter routing is in scope.

For browser low-rank adapter routing, load `reports/browser-low-rank-adapter-route-memory-2026-06-28.md` when generated `.alr1` routes, low-rank adapter-family members, `ALR1` manifests, module-plan low-rank stack roles, or `adapter-sidecar-registry-file` ALR1 smoke evidence is in scope.

For browser source-backed ALR1 routing, load `reports/browser-source-backed-alr1-route-memory-2026-06-28.md` when generated bundles should convert reviewed adapter source templates into served source-backed `.alr1` stack members, or when app `.alr1` manifest kind/dtype acceptance changes.

For browser source-backed ALR1 contracts, load `reports/browser-source-backed-alr1-contract-memory-2026-06-28.md` when source-backed `.alr1` kind/dtype pairing, adapter-family receipt source echoes, manifest-vs-receipt provenance checks, or `source-backed-alr1-manifest-drift` smoke expectations are in scope.

For browser sparse adapter routing, load `reports/browser-sparse-adapter-route-memory-2026-06-27.md` when selector adapter routes, generated adapter families, served `.asp1` artifacts, browser manifest checks, or `adapter-sidecar-registry-file` smoke are in scope.

For browser preferred adapter routing, load `reports/browser-preferred-adapter-route-memory-2026-06-27.md` when adapter-family receipt preferred fields, browser default adapter selection, generated sparse ASP1 preference, or smoke assertions around `selectedAdapterBeforeApply` are in scope.

For combined generated selector roots, load `reports/browser-multi-quant-selector-root-memory-2026-06-27.md` when `browser-multi-parent-bundle all`, one-root f32/q8_0/q4_0 selector fan-in, or same-served-root adapter-sidecar smokes are in scope.

For combined selector assembly proof, load `reports/browser-combined-selector-assembly-memory-2026-06-28.md` when `combined-selector-assembly`, all-root q4_0 default, all-three-entry module-plan ordering, or same-page q4_0/q8_0/f32 auto assembly is in scope.

For combined selector cycle proof, load `reports/browser-combined-selector-cycle-memory-2026-06-28.md` when `combined-selector-cycle`, repeated all-root q4_0/q8_0/f32 switching, release-before-reassembly behavior, per-pass Rust stack validation/apply deltas, or fresh generated-root path-flexible Module Plan summaries are in scope.

For combined selector route-soak proof, load `reports/browser-combined-selector-route-soak-memory-2026-06-28.md` when `combined-selector-route-soak`, repeated generated self-assembly route counts, no-store local fetch behavior, or longer q4_0/q8_0/f32 selector pressure is in scope.

For combined selector extended route-soak proof, load `reports/browser-combined-selector-extended-route-soak-memory-2026-06-28.md` when `combined-selector-route-extended-soak`, five-cycle q4_0/q8_0/f32 route pressure, fifteen generated assemblies, path-flexible total-budget checks, or extended route-count proof is in scope.

For combined selector stress route-soak proof, load `reports/browser-combined-selector-stress-route-soak-memory-2026-06-28.md` when `combined-selector-route-stress-soak`, eight-cycle q4_0/q8_0/f32 route pressure, twenty-four generated assemblies, or deeper self-assembly route-count proof is in scope.

For combined selector reload-soak proof, load `reports/browser-combined-selector-reload-soak-memory-2026-06-28.md` when `combined-selector-reload-soak`, registry default boot selection, fresh page-lifetime self-assembly, or reload route-count proof is in scope.

For browser module-plan profile proof, load `reports/browser-module-plan-profile-memory-2026-06-28.md` when `browser-constrained-v1`, selector-to-receipt self-assembly profile matching, generated module-plan profile fields, or `module-plan-profile-drift` is in scope.

For browser module-plan execution profile proof, load `reports/browser-module-plan-execution-profile-memory-2026-06-28.md` when `single-threaded-wasm-local-v1`, Module Plan `Execution`, generated module-plan execution fields, or `module-plan-execution-profile-drift` is in scope.

For browser module-plan fetch-policy proof, load `reports/browser-module-plan-fetch-policy-memory-2026-06-28.md` when `local-no-store-v1`, Module Plan `Fetch`, generated module-plan fetch fields, no-store local fetch behavior, or `module-plan-fetch-policy-drift` is in scope.

For browser module-plan origin-policy proof, load `reports/browser-module-plan-origin-policy-memory-2026-06-28.md` when `same-origin-loopback-local-v1`, Module Plan `Origin`, generated module-plan origin fields, same-origin local assembly behavior, or `module-plan-origin-policy-drift` is in scope.

For browser module-plan fetch-count proof, load `reports/browser-module-plan-fetch-count-memory-2026-06-28.md` when `module_plan_fetch_count_limit`, Module Plan `Fetch Limit`, generated self-assembly route counts, or `module-plan-fetch-count-drift` is in scope.

For browser module-plan runtime scratch proof, load `reports/browser-module-plan-runtime-scratch-memory-2026-06-28.md` when `module_plan_runtime_scratch_byte_budget`, Module Plan `Scratch Budget`, browser runtime scratch envelopes, or `module-plan-runtime-scratch-drift` is in scope.

For browser module-plan total budget proof, load `reports/browser-module-plan-total-budget-memory-2026-06-28.md` when `module_plan_total_byte_budget`, Module Plan `Total Budget`, exact module-plan self-assembly totals, or `module-plan-total-budget-drift` is in scope.

For browser module-plan total limit proof, load `reports/browser-module-plan-total-limit-memory-2026-06-28.md` when `module_plan_total_byte_budget_limit`, Module Plan `Total Limit`, explicit browser self-assembly caps, or `module-plan-total-limit-drift` is in scope.

For browser module-plan WASM memory proof, load `reports/browser-module-plan-wasm-memory-memory-2026-06-28.md` when `module_plan_wasm_memory_initial_pages`, Module Plan `WASM Pages`, pre-init exported WASM memory page checks, or `module-plan-wasm-memory-drift` is in scope.

For browser module-plan WASM export-set proof, load `reports/browser-module-plan-wasm-export-set-memory-2026-06-28.md` when `module_plan_wasm_export_set`, `tinyrustlm-generate-v1`, instantiated WASM export checks, Module Plan `WASM ABI`, or `module-plan-wasm-export-set-drift` is in scope.

For browser module-plan WASM heap proof, load `reports/browser-module-plan-wasm-heap-memory-2026-06-28.md` when `module_plan_wasm_heap_min_bytes`, Module Plan `Heap Floor`, browser allocation probes, or `module-plan-wasm-heap-drift` is in scope.

For browser module-plan WASM transfer proof, load `reports/browser-module-plan-wasm-transfer-memory-2026-06-28.md` when `module_plan_wasm_transfer_strategy`, `copy-then-release-v1`, Module Plan `Transfer`, browser byte-copy release discipline, or `module-plan-wasm-transfer-drift` is in scope.

For browser module-plan model-release proof, load `reports/browser-module-plan-model-release-memory-2026-06-29.md` when `module_plan_model_release_strategy`, `free-before-reassembly-v1`, Module Plan `Release`, generated model lifetime discipline, or `module-plan-model-release-drift` is in scope.

For browser module-plan runtime-reset proof, load `reports/browser-module-plan-runtime-reset-memory-2026-06-29.md` when `module_plan_runtime_reset_strategy`, `reset-context-before-assembly-v1`, Module Plan `Reset`, generated runtime context reset sequencing, or `module-plan-runtime-reset-drift` is in scope.

For browser module-plan adapter-validation proof, load `reports/browser-module-plan-adapter-validation-memory-2026-06-29.md` when `module_plan_adapter_validation_strategy`, `rust-validate-before-apply-v1`, Module Plan `Validate`, generated adapter validation sequencing, or `module-plan-adapter-validation-drift` is in scope.

For browser module-plan adapter validation-count proof, load `reports/browser-module-plan-adapter-validation-count-memory-2026-06-29.md` when `module_plan_adapter_validation_count`, Module Plan `Validate Count`, actual Rust validation-call cardinality, adapter-family stack count agreement, or `module-plan-adapter-validation-count-drift` is in scope.

For browser module-plan adapter apply-count proof, load `reports/browser-module-plan-adapter-apply-count-memory-2026-06-29.md` when `module_plan_adapter_apply_count`, Module Plan `Apply Count`, runtime `adapter_apply_count`, generated adapter stack cardinality, or `module-plan-adapter-apply-count-drift` is in scope.

For browser module-plan planned-fetch-count proof, load `reports/browser-module-plan-planned-fetch-count-memory-2026-06-29.md` when `module_plan_planned_fetch_count`, Module Plan `Plan Fetches`, generated self-assembly route cardinality, or `module-plan-planned-fetch-count-drift` is in scope.

For browser module-plan actual-fetch-count proof, load `reports/browser-module-plan-actual-fetch-count-memory-2026-06-29.md` when browser-owned generated route accounting, Module Plan `Actual Fetches`, counted fetch wrappers, source fallback, or planned-versus-actual Ready gating is in scope.

For browser module-plan observed-route-set proof, load `reports/browser-module-plan-observed-route-set-memory-2026-06-29.md` when browser-owned route-set observations, Module Plan `Actual Route Set`, route kind labels, source fallback, or observed-versus-declared Ready gating is in scope.

For browser module-plan actual-module-bytes proof, load `reports/browser-module-plan-actual-module-bytes-memory-2026-06-29.md` when browser-owned generated module-byte accounting, Module Plan `Actual Module Bytes`, stack artifact byte recording, source fallback, or observed-versus-receipt Ready gating is in scope.

For browser module-plan actual-module-checksums proof, load `reports/browser-module-plan-actual-module-checksums-memory-2026-06-29.md` when browser-owned generated module-checksum accounting, Module Plan `Actual Module Checksums`, text/module checksum recording, stack artifact checksum recording, source fallback, module-plan-payload-checksum-drift, or observed-versus-receipt Ready gating is in scope.

For browser module-plan route-set proof, load `reports/browser-module-plan-route-set-memory-2026-06-29.md` when `module_plan_route_set_checksum`, Module Plan `Route Set`, generated self-assembly route ordering, or `module-plan-route-set-drift` is in scope.

For browser module-plan route-set version proof, load `reports/browser-module-plan-route-set-version-memory-2026-06-29.md` when `module_plan_route_set_version`, Module Plan `Route Version`, route-set checksum preimage versioning, or `module-plan-route-set-version-drift` is in scope.

For browser module-plan route-set algorithm proof, load `reports/browser-module-plan-route-set-algorithm-memory-2026-06-29.md` when `module_plan_route_set_checksum_algorithm`, Module Plan `Route Hash`, route-set checksum preimage algorithm labels, or `module-plan-route-set-algorithm-drift` is in scope.

For browser module-plan operator receipt proof, load `reports/browser-module-plan-operator-receipt-memory-2026-06-29.md` when `module_plan_operator_receipt_path`, `module_plan_operator_receipt_checksum`, `.module-plan.receipt` `operator_receipt_*` fields, assembly receipt/operator receipt agreement, or `module-plan-operator-receipt-drift` is in scope.

For browser parent-pool soup bundle proof, load `reports/browser-parent-pool-soup-bundle-memory-2026-06-29.md` when `browser-multi-parent-bundle` operator selection, `multi-parent-soup-*` generated ids, `soup.*` evidence files, module-plan operator-prefix route sets, `assembly_strategy=multi-parent-weighted-soup`, or browser assembly validation for soup routes is in scope.

For browser module-plan KV-cache proof, load `reports/browser-module-plan-kv-cache-memory-2026-06-28.md` when `module_plan_kv_cache_byte_budget`, `module_plan_kv_cache_page_count`, Module Plan `KV Budget` or `KV Pages`, runtime KV diagnostics, or `module-plan-kv-cache-drift` is in scope.

For browser module-plan output-limit proof, load `reports/browser-module-plan-output-limit-memory-2026-06-28.md` when `module_plan_output_byte_limit`, Module Plan `Output Limit`, generated-result caps, output-buffer boundaries, or `module-plan-output-limit-drift` is in scope.

For browser module-plan adapter-stack budget proof, load `reports/browser-module-plan-adapter-stack-budget-memory-2026-06-28.md` when `module_plan_adapter_stack_byte_budget`, Module Plan `Stack Budget`, generated auto-stack byte totals, or `module-plan-adapter-stack-budget-drift` is in scope.

For browser module-plan context-token proof, load `reports/browser-module-plan-context-token-memory-2026-06-28.md` when `module_plan_context_token_limit`, Module Plan `Context`, selector model-shape context parsing, or `module-plan-context-token-drift` is in scope.

For browser module-plan tokenizer proof, load `reports/browser-module-plan-tokenizer-memory-2026-06-28.md` when `module_plan_tokenizer_checksum`, Module Plan `Tokenizer`, tokenizer-aware genome/species checksums, selector tokenizer routing, or `module-plan-tokenizer-drift` is in scope.

For browser module-plan sampler-cap proof, load `reports/browser-module-plan-sampler-cap-memory-2026-06-28.md` when `module_plan_sampler_candidate_cap`, Module Plan `Sampler Cap`, fixed-buffer Top K clamping, or `module-plan-sampler-cap-drift` is in scope.

For browser module-plan prompt-limit proof, load `reports/browser-module-plan-prompt-limit-memory-2026-06-28.md` when `module_plan_prompt_byte_limit`, Module Plan `Prompt Limit`, source prompt byte transfer, total budget math, `module-plan-prompt-limit-drift`, or `prompt-limit` source smoke behavior is in scope.

For browser module-plan count drift proof, load `reports/browser-module-plan-count-drift-memory-2026-06-28.md` when selector `module_plan_module_count`, receipt `module_count`, module-plan cardinality, or `module-plan-count-drift` is in scope.

For browser assembly trace proof, load `reports/browser-assembly-trace-memory-2026-06-28.md` when the Module Plan Trace row, browser load checkpoints, generated all-root trace assertion, or ready-state sequencing is in scope.

For browser eval-case evidence checksum proof, load `reports/browser-eval-case-evidence-checksum-memory-2026-06-28.md` when selector admission eval evidence fields, promotion-ledger admission copies, generated assembly receipt eval digests, Model Provenance eval fields, or browser-smoke registry-backed provenance assertions are in scope.

For browser selector genome/fitness proof, load `reports/browser-selector-genome-fitness-memory-2026-06-28.md` when selector `genome_id`, genome lineage checksums, scoped fitness-vector checksums, Model Provenance genome/fitness rows, or ModelBreeder-inspired browser registry metadata are in scope.

For browser selector species-fit proof, load `reports/browser-selector-species-fit-memory-2026-06-28.md` when selector `species_id`, `species_strategy=selector-speciation-fit-v1`, `species_fit_status=browser-fit-bound`, `species_fit_checksum`, Model Provenance Species rows, or ModelBreeder speciation-fit browser registry metadata are in scope.

For browser selector novelty proof, load `reports/browser-selector-novelty-memory-2026-06-28.md` when selector `novelty_id`, `novelty_strategy=selector-novelty-sketch-v1`, `novelty_status=behavior-sketch-bound`, `novelty_checksum`, Model Provenance Novelty rows, or ModelBreeder behavior-sketch registry metadata are in scope.

For browser selector population proof, load `reports/browser-selector-population-memory-2026-06-28.md` when selector `population_id`, `population_strategy=selector-population-review-route-v1`, `population_status=population-review-bound`, `population_checksum`, Model Provenance Population rows, or ModelBreeder population-review registry metadata are in scope.

For browser selector mate-selection proof, load `reports/browser-selector-mate-selection-memory-2026-06-28.md` when selector `mate_selection_id`, `mate_selection_strategy=selector-mate-selection-route-v1`, `mate_selection_status`, `mate_selection_parent_count`, `mate_selection_checksum`, Model Provenance Mate Selection rows, or ModelBreeder parent-pool route metadata are in scope.

For browser selector phenotype-evidence proof, load `reports/browser-selector-phenotype-evidence-memory-2026-06-28.md` when selector `phenotype_evidence_id`, `phenotype_evidence_strategy=selector-phenotype-evidence-v1`, `phenotype_evidence_status=runtime-eval-bound`, `phenotype_evidence_checksum`, `provenance_manifest_checksum`, Model Provenance Phenotype rows, or ModelBreeder phenotype-evidence registry metadata are in scope.

For browser selector heritable-artifact proof, load `reports/browser-selector-heritable-artifact-memory-2026-06-28.md` when selector `heritable_artifact_id`, `heritable_artifact_strategy=selector-heritable-artifact-v1`, `heritable_artifact_status=served-artifact-bound`, `heritable_artifact_checksum`, Model Provenance Artifact rows, or ModelBreeder artifact-inheritance registry metadata are in scope.

For browser assembly eval-case drift proof, load `reports/browser-assembly-eval-case-drift-memory-2026-06-28.md` when generated assembly receipt eval digests, selector-to-assembly digest matching, Assembly Evidence failure states, or `assembly-eval-case-drift` smoke assertions are in scope.

For browser assembly evidence-file drift proof, load `reports/browser-assembly-evidence-file-drift-memory-2026-06-28.md` when `verifyAssemblyEvidenceFiles`, fetched evidence-file checksums, generated evidence routes, Assembly Evidence failure states, or `assembly-evidence-file-drift` smoke assertions are in scope.

For browser adapter-family receipt drift proof, load `reports/browser-adapter-family-receipt-drift-memory-2026-06-28.md` when `loadAdapterFamilyReceipt`, served adapter-family receipt bytes, post-evidence adapter-family failure state, or `adapter-family-receipt-drift` smoke assertions are in scope.

For browser adapter manifest drift proof, load `reports/browser-adapter-manifest-drift-memory-2026-06-28.md` when `validateAdapterManifest`, served adapter manifest bytes, post-receipt adapter failure state, or `adapter-manifest-drift` smoke assertions are in scope.

For browser adapter artifact drift proof, load `reports/browser-adapter-artifact-drift-memory-2026-06-28.md` when generated adapter artifact checksum matching, exact stack artifact route interception, post-manifest adapter failure state, or `adapter-artifact-drift` smoke assertions are in scope.

For browser adapter stack preflight proof, load `reports/browser-adapter-stack-prefetch-drift-memory-2026-06-28.md` when generated auto-apply stack bytes, full-stack artifact prefetch, pre-WASM stack verification, or `adapter-stack-prefetch-drift` smoke assertions are in scope.

For browser adapter stack Rust validation proof, load `reports/browser-adapter-stack-rust-validate-memory-2026-06-28.md` when `validate_adapter_delta`, generated auto-stack semantic preflight, validation-before-apply ordering, or WASM adapter ABI coverage is in scope.

For browser adapter stack Rust validation drift proof, load `reports/browser-adapter-stack-rust-validate-drift-memory-2026-06-28.md` when checksum-consistent ADP1 identity drift, `adapter-stack-rust-validate-drift`, validation failure state, or no-apply assertions are in scope.

For browser runtime assembly diagnostics proof, load `reports/browser-runtime-assembly-diagnostics-memory-2026-06-28.md` when Rust diagnostics assembly fields, `adapter_apply_count`, `last_adapter_checksum`, `assembly_state_checksum`, manual adapter sidecar assertions, or generated auto-stack runtime state assertions are in scope.

For browser frugal selector defaults, load `reports/browser-frugal-selector-default-memory-2026-06-27.md` when selector default metadata, q4_0 initial selection, combined-root first load behavior, or default-selection smoke assertions are in scope.

For browser selector byte budgets, load `reports/browser-selector-budget-memory-2026-06-27.md` when `entry.N.model_bytes`, registry fallback behavior, pre-WASM model byte transfer checks, or `selector-budget` smoke assertions are in scope.

For browser selector budget contracts, load `reports/browser-selector-budget-contract-memory-2026-06-27.md` when `selector_model_byte_budget`, registry-level budget validation, generated bundle registry fields, or selector-budget contract smoke evidence is in scope.

For browser auto assembly, load `reports/browser-auto-assembly-memory-2026-06-27.md` when selector adapter auto-apply fields, generated adapter-family startup apply, receipt-preferred sparse ASP1 auto selection, or `adapter-sidecar-registry-file` pre-generation assembly proof is in scope.

For browser auto-assembly byte budgets, load `reports/browser-auto-assembly-budget-memory-2026-06-27.md` when `adapter_auto_apply_byte_budget`, adapter manifest artifact bytes, pre-WASM adapter transfer checks, or constrained browser module assembly is in scope.

For browser text-sidecar byte budgets, load `reports/browser-text-sidecar-budget-memory-2026-06-27.md` when selector.registry, `.slm` manifests, adapter manifests, receipts, assembly evidence text, or sidecar pre-parse fetch limits are in scope.

For browser text-sidecar budget contracts, load `reports/browser-text-sidecar-contract-memory-2026-06-27.md` when selector registry header fields, generated registry contract validation, exact browser budget intake, or sidecar-budget-contract fallback smoke evidence is in scope.

For browser runtime manifests, load `reports/browser-runtime-manifest-memory-2026-06-27.md` when runtime WASM rebuild/copy flows, generated bundle runtime staging, browser boot sequencing, or manifest-drift smoke evidence is in scope.

For browser adapter stacks, load `reports/browser-adapter-stack-memory-2026-06-27.md` when generated adapter-family receipts, selector `adapter_auto_apply_stack_*` fields, ordered ADP1/ASP1/ALR1 startup apply, or adapter-stack smoke evidence is in scope.

For browser module plans, load `reports/browser-module-plan-memory-2026-06-27.md` when generated selector `module_plan_*` fields, served `.module-plan.receipt` files, pre-model-fetch plan verification, or generated-root adapter-stack smoke routes are in scope.

For browser module-plan resource envelopes, load `reports/browser-module-plan-resource-memory-2026-06-27.md` when `module_plan_resource_class`, `module_plan_model_byte_budget`, `module_plan_adapter_byte_budget`, constrained self-assembly routing, or pre-model-fetch plan budget checks are in scope.

For browser module-plan resource drift proof, load `reports/browser-module-plan-resource-drift-memory-2026-06-27.md` when `module-plan-resource-drift`, checksum-consistent receipt mutation, or no-generated-`.slm`-fetch proof is in scope.

For browser module-plan graph drift proof, load `reports/browser-module-plan-graph-drift-memory-2026-06-27.md` when `module-plan-graph-drift`, checksum-consistent graph-route mutation, or no-generated-`.slm`-fetch proof is in scope.

For browser module-plan stack drift proof, load `reports/browser-module-plan-stack-drift-memory-2026-06-27.md` when `module-plan-stack-drift`, checksum-consistent stack-member mutation, or no-generated-model-or-stack-artifact-fetch proof is in scope.

For browser module-plan role drift proof, load `reports/browser-module-plan-role-drift-memory-2026-06-27.md` when `module-plan-role-drift`, checksum-consistent role mutation, or no-generated-model-or-stack-artifact-fetch proof is in scope.

For browser module-plan display proof, load `reports/browser-module-plan-display-memory-2026-06-27.md` when the Module Plan panel, rendered verified receipt fields, generated model route display, stack route display, or panel smoke assertions are in scope.

For browser module-plan budget display proof, load `reports/browser-module-plan-budget-display-memory-2026-06-27.md` when the Module Plan panel's visible model/adapter byte-budget rows or budget smoke assertions are in scope.

For browser module-plan role display proof, load `reports/browser-module-plan-role-display-memory-2026-06-27.md` when `.module-plan.receipt` module roles, rendered role summaries, or role smoke assertions are in scope.

For browser module-plan assembly-slot proof, load `reports/browser-module-plan-slots-memory-2026-06-27.md` when `.module-plan.receipt` `module.N.assembly_slot` fields, rendered slot summaries, or `module-plan-slot-drift` assertions are in scope.

For browser module-plan dependency proof, load `reports/browser-module-plan-dependencies-memory-2026-06-27.md` when `.module-plan.receipt` `module.N.depends_on` fields, rendered dependency summaries, or `module-plan-dependency-drift` assertions are in scope.

For browser module-plan phase proof, load `reports/browser-module-plan-phases-memory-2026-06-27.md` when `.module-plan.receipt` `module.N.phase` fields, rendered phase summaries, or `module-plan-phase-drift` assertions are in scope.

For browser module-plan byte-count proof, load `reports/browser-module-plan-byte-counts-memory-2026-06-27.md` when `.module-plan.receipt` `module.N.byte_count` fields, rendered byte summaries, fetched text/model byte matching, adapter-stack artifact byte matching, or `module-plan-byte-drift` assertions are in scope.

For browser module-plan checksum proof, load `reports/browser-module-plan-checksums-memory-2026-06-27.md` when `.module-plan.receipt` `module.N.checksum` fields, rendered checksum summaries, stack artifact checksum matching, or `module-plan-checksum-drift` assertions are in scope.

Model-breeding references live under `wiki/runtime-mirust/research/model-breeding-reference-ideas-2026-06-26.md`; open it for compatible merge, sparse-lineage, adapter-ecology, low-rank ALR1/LoRA reference routing, source-backed browser ALR1 routing, population-search, federated/local-update, browser-constrained-assembly, UAIX-memory-strategy, sparse-mask breadcrumb, objective-vector, parent-relatedness, evolutionary-recipe, adaptive-search, and multi-objective-fitness routing.

ModelBreeder and zero-dependency references live under `wiki/runtime-mirust/research/modelbreeder-zero-dependency-reference-ideas-2026-06-28.md`; open it for genome/fitness/novelty/population/mate-selection/phenotype-evidence/speciation fields, public-copy voice routing, zero-dependency Wasm SIMD, hierarchical quantization, deterministic tokenizer/sampler, KV-cache, allocator, multimodal, and telemetry guidance.

## Active File Intake

Dropped files live only in `agent-file-handoff/Content/` and `agent-file-handoff/Improvement/`. There is no source-site Archive bucket for default resting memory.

## Implementation Boundary

The repository currently contains TinyRustLM, a zero-dependency Rust/WASM browser-local SLM runtime and UI. Future claims still require source inspection and current test evidence; report memory provides design pressure, not implementation proof.

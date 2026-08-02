---
title: Model Breeding Ecology Memory 2026-06-26
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/model-breeding-ecology-memory-2026-06-26/
status: planned_pending_publication
reviewed_utc: 2026-06-27T13:45:00Z
---

# Model Breeding Ecology Memory

This durable synthesis turns the 2026-06-26 Improvement batch into routing memory for future TinyRustLM work.

Model breeding in this project means a traceable candidate lifecycle: compatible parent artifacts, explicit lineage metadata, a bounded operator, deterministic conversion or merge output, evaluation sidecars, and a promotion record. It does not mean self-editing runtime behavior inside the browser app.

## Core Translation

- Breeding unit: a local `.slm` candidate or future adapter/delta package with checksums, tokenizer identity, tensor schema, quantization layout, parent hashes, operator metadata, and evaluation evidence.
- Compatibility gate: parameter-level merging requires the same base family, tensor names, shapes, tokenizer route, dtype or quantization semantics, and output-head contract.
- Heterogeneous path: when architecture or tokenizer compatibility breaks, use distillation or retraining into the `.slm` ABI instead of direct weight mixing.
- Operator lanes: model soups, task-vector addition, LoRA/adapters, TIES-style sign agreement, DARE-style sparse deltas, Model Breadcrumbs-style sparse masks, kinship-aware parent selection, evolutionary merge recipes, pruning, quantization, and post-merge fine-tuning route future work; current implemented slices include `sparse-delta-candidate` receipts with density, retention, and mask checksum fields, `adapter-delta`, `fuse-adapter-delta`, promotion ledgers, population reviews with objective-vector fields, parent-pool recipes with relatedness fields, sign-merge receipts that echo relatedness, multi-parent manifests that carry the relatedness summary, selector routing, and browser-verified adapter-family receipts plus manifests.
- Code beading: split model work into small durable beads such as source manifest, candidate manifest, compatibility result, operator run, eval sidecar, promotion record, and rollback record.
- 4Fs lens: Fast, Flexible, Frugal, and Federated are useful design adjectives for future model ecology choices, not canonical project law.

## Project Architecture Pressure

TinyRustLM should first make model lineage cheap to record before making model breeding powerful. The current `.slm` manifest and quality-gate system already has most of the right shape: checksums, source kind, admission status, quality boundary, and eval sidecars. The next durable increment is a candidate lineage schema that records parent artifact hashes and an operator contract without changing the browser inference path.

Potential future modules:

- `compatibility`: validates base family, tokenizer hash, tensor directory, shape agreement, quantization mode, tied-output flag, and vocab size before any merge operator runs.
- `lineage`: records parent ids, source hashes, operator version, parameter recipe, build tool hash, and evaluator route.
- `candidate_eval`: runs bounded task cases, latency, scratch, context, and size gates before any candidate becomes selectable.
- `adapter_delta`: stores future LoRA or adapter deltas as separate artifacts until the runtime has an explicit typed boundary for applying or fusing them.
- `breeding_operator`: offline tool only; it produces `.slm` or candidate artifacts that still pass the normal admission and manifest gates.
- `population_review`: validates a promotion ledger against admissions, scores candidates by quality, frugality, and quantization fit, records the weighted objective-vector contract plus per-entry objective checksums, then records the frontier route and parent-pool route.
- `parent_pool_recipe`: validates the population review, requires selected parents to share one direct-parameter contract, and records ranked roles, seed weights, relatedness metric/scope/pair count/status, shared relatedness checksum, and per-parent relatedness groups for recipe consumers.

## Report Cluster Synthesis

### Model Merging Math

`AI Model Merging Architectures Explained.md`, `Model merging refers to combining multiple trained neural.md`, and `Rust Tiny LLM Model Breeding Pipeline.md` route agents to weight-space fusion ideas: interpolation, soups, task arithmetic, TIES, DARE, alignment, and out-of-core merge execution. The project use is compatibility-first offline tooling.

### Adapters And LoRA

`Tiny-LLM Adapters and LoRA.md`, `lightweight multi-model LLM system in Rust.md`, and the on-device tiny-language-model reports route agents to parameter-efficient adaptation. The useful pattern is a frozen base artifact plus small signed deltas, not a dependency-heavy runtime jump.

### Tiny Model Ecology

`AI Evolution_ Small Models, Big Ecology.md`, the on-device reports, and 4Fs reports route agents to a population of small models where each candidate has bounded memory, latency, and evaluation evidence. This supports future model selector and cascade ideas only after single-model correctness stays strong.

### Teleodynamic Resource Loops

`Teleodynamic Evolution of AI Ecosystems.md` and related reports route agents to measurable resource behavior: context budget, scratch bytes, KV length, load time, and candidate fitness. Translate theory into counters, gates, and smoke tests.

### Mutualist Product Voice

`Mutualist Persistence.md`, `Aggressive Mutualism.md`, and the human motivation reports route agents to a constructive public voice: TinyRustLM grows by helping users inspect, swap, and improve local models. Public copy should follow `.uai/taboo.uai` and stay centered on proof, craft, lineage, and local agency.

## 2026-06-27 Implementation Notes

- Compatibility, lineage, blend, task-delta, sparse task-delta, adapter-delta, adapter-fuse, candidate manifests, multi-parent candidate manifests, promotion templates, multi-parent promotion templates, multi-parent admission records, runtime-smoke sidecars, selector admission records, promotion ledgers, population reviews, parent-pool recipes, sign-merge receipts, and selector registries now exist as no-crate `tinyrustlm-slm-pack` gates.
- Population review maps the population-based-training idea into a deterministic offline file: `promotion-ledger-plus-admission-records` becomes a ranked frontier candidate plus a parent pool for later recipes, with objective-vector metadata that names the weighted scoring dimensions.
- Parent-pool recipe turns that ranked review into a shared-contract parent recipe with normalized seed weights and deterministic relatedness identity; sign-merge receipts echo that identity, and multi-parent candidate manifests carry it forward.
- The browser runtime remains downstream of admitted registry routes only; population work stays offline until a candidate has passed the ordinary `.slm`, manifest, runtime-smoke, eval, admission, and ledger gates.

## 2026-06-27 Reference Routing Refresh

- The companion research page now routes diverse model-breeding references beyond the first merge set: FedAvg, evolution strategies, sparse receipt retention metrics, pruning masks, lottery-ticket sparsity, adapter families, and quantized adapter training.
- The 2026-06-27 research refresh adds Model Breadcrumbs, model kinship, evolutionary merge recipes, Mergenetic-style adaptive search, and multi-objective evolutionary merging as planning metadata; sparse masks, parent relatedness, and weighted population objective vectors now have first receipt-level forms, while resource budgets and recipe search remain future typed lanes.
- Use those references as future metadata and eval lanes: distributed parent updates, search budgets, old-task retention, task masks, compact candidate artifacts, and adapter manifests.
- Keep the current implementation boundary unchanged: offline tools produce evidence-bound `.slm` or adapter artifacts, while browser selection consumes only admitted registry routes.

## Implementation Sequence

1. Keep compatibility, lineage, operator receipts, manifests, promotion, admission, ledger, population review, parent-pool recipe, sign-merge, and multi-parent candidate files as the offline model-breeding path.
2. Extend planner/search work only when it can produce replayable recipe proposals, resource budgets, and eval sidecars that feed the same gates.
3. Require every produced candidate `.slm` to pass native validation, manifest validation, runtime-smoke, and fixture eval gates.
4. Add browser UI only after candidate provenance can be rendered as clean local model lineage.

## Hot Memory Hooks

- `.uai/report-synthesis.uai` carries the compact research cluster.
- `.uai/architecture.uai` routes future modules and compatibility boundaries.
- `.uai/coding-standards.uai` keeps breeding offline and manifest-driven.
- `.uai/operations.uai` records the report preservation and future checks.
- `.uai/short-term-memory.uai` points to this durable synthesis.
- `.uai/taboo.uai` controls site voice for the mutualist/model-breeding story.

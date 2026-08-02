# TinyRustLM Small-Model Research TDD Delta

## Scope

This is an additive test-first plan for the second July 11 research batch. It extends the response-quality and footprint plan at `docs/report-intake/2026-07-11/tinyrustlm-response-quality-footprint-tdd-plan-2026-07-11.md`. Where the two differ, current measured evidence and this reviewed delta govern the next model-selection and distillation slices.

The goal is not to make a fixed benchmark pass. The goal is a compact local assistant that remains useful on new conversation, common-sense, instruction, memory, and tool-routing tasks.

## Global No-Cheat Rules

1. Write the failing test before changing the implementation or training input.
2. Never add prompt-string branches, expected-answer maps, hidden retries, output repair, answer assembly, evaluator exceptions, or dataset leakage.
3. Freeze model revision, tokenizer, template, sampler, seed, adapter, runtime, and fixture hashes for every result.
4. Capture raw decoder bytes before presentation formatting.
5. Keep training, public development, generated shadow, sealed release, and human-review data physically and semantically separated.
6. Preserve failed runs and report negative evidence.
7. A source failure blocks conversion. A native failure blocks WASM. A browser failure blocks release.
8. The approved visual design and active-conversation behavior remain mandatory release gates.

## S0: Intake and Authority Integrity

### Tests first

- `S0-001 source-copy-sha256`: every active report byte length and SHA-256 matches its durable copy.
- `S0-002 report-disposition-complete`: every manifest report has one ledger entry, one proof-of-use statement, and one accepted/deferred/rejected status.
- `S0-003 prompt-is-not-evidence`: the disconnected-agent prompt is tagged as provenance and cannot satisfy an evidence count.
- `S0-004 memory-route-resolution`: all `.uai` report pointers resolve and the wiki checksum matches.
- `S0-005 stale-intake-count`: hot memory reflects the live handoff scan after cleanup.

### Exit gate

Twelve durable matches, twelve ledger dispositions, zero broken routes, and no report body copied into short-term memory.

## S1: Targeted Prompt-Plan Admission

### Tests first

- `S1-001 jsonl-schema`: all 96 records have stable ID, family, prompt, provenance, intended behavior, and exclusion metadata.
- `S1-002 id-and-text-uniqueness`: no duplicate ID, exact prompt, normalized prompt, or accidental template clone.
- `S1-003 fixed-eval-exclusion`: zero exact or normalized overlap with fixed, seeded, shadow, and sealed eval sources.
- `S1-004 fivegram-exclusion`: zero admitted five-token phrase collision above the declared threshold after boilerplate filtering.
- `S1-005 semantic-neighbor-exclusion`: embeddings or an approved deterministic proxy flag near-duplicates for manual disposition; no silent admission.
- `S1-006 family-balance`: exactly twelve prompts in each of the eight declared correction families.
- `S1-007 cognitive-liberty-balance`: lawful adult/helpful prompts materially outnumber boundary prompts and boundary prompts have benign neighbors.
- `S1-008 calculator-sparsity`: calculator/tool-routing examples stay within the declared 1 to 3 percent envelope in the expanded corpus.

### Exit gate

All 96 records are admitted or explicitly rejected with a reason. Any eval overlap blocks teacher generation.

## S2: Scalable Corpus and Provenance

### Tests first

- `S2-001 immutable-source-identity`: dataset owner, name, revision, file hash, license, row index, and transform version are mandatory.
- `S2-002 record-lineage`: every derived record traces to source records and transform hashes.
- `S2-003 source-removal`: deleting a source deterministically identifies and excludes every derivative from a rebuilt corpus.
- `S2-004 exact-ngram-semantic-dedup`: exact, normalized, n-gram, and semantic clusters produce deterministic dispositions.
- `S2-005 split-family-isolation`: no template family, semantic cluster, source conversation, or derivative crosses train/eval boundaries.
- `S2-006 linguistic-audit`: count and threshold refusal, apology, disclaimer, incapability, policy, system-prompt, and canned-uncertainty phrases by family.
- `S2-007 positive-boundary-ratio`: helpful records maintain the declared 20:1 minimum over pure refusals unless a reviewed family exception exists.
- `S2-008 corpus-manifest-reproducibility`: identical inputs produce byte-identical JSONL and manifest hashes.
- `S2-009 teacher-output-quarantine`: raw drafts are not admitted until schema, quality, license, and contamination review pass.
- `S2-010 bounded-memory-build`: corpus preparation streams records and reports peak memory instead of requiring the entire corpus in RAM.

### Pilot and scale gates

- Pilot: complete 572 public and 96 targeted prompts with full provenance and zero eval contamination.
- Scale checkpoint: at least 300,000 admitted examples before a broad production-behavior claim.
- Mature target: 1.5 to 4 million only if marginal quality improves and source/license review remains tractable.

Record count never overrides family quality or contamination failure.

## S3: Source-Model Screening

### Required candidates

- Qwen2.5-0.5B-Instruct: compact source candidate.
- Qwen2.5-1.5B-Instruct: current quality anchor.
- Granite 3.3 2B: optional later screen only if architecture, license, and opt-in footprint qualify.

### Tests first

- `S3-001 immutable-checkpoint`: config, tokenizer, generation config, and every weight shard are revision and SHA-256 bound.
- `S3-002 exact-template`: rendered prompt bytes and token IDs are captured for each case.
- `S3-003 fixed-raw-screen`: untouched one-call outputs for all critical families.
- `S3-004 seeded-variation`: multiple declared seeds and paraphrases expose brittle lucky outputs.
- `S3-005 multi-turn-state`: names, corrections, preferences, and task state survive at least four turns without invented memory.
- `S3-006 ambiguity-and-judgment`: the model asks only useful clarifications and gives practical tradeoffs when enough detail exists.
- `S3-007 cognitive-liberty-pairs`: direct lawful answers and narrow concrete-harm boundaries are tested as paired neighbors.
- `S3-008 tool-routing`: calculator-appropriate requests produce a valid tool decision or a correct simple answer without fabricated precision.
- `S3-009 capability-honesty`: no false browser, filesystem, network, memory, or identity claim.
- `S3-010 blind-human-rubric`: two blinded reviewers score coherence, relevance, common sense, nuance, and usefulness from 0 to 4.

### Source promotion gate

- Zero no-cheat contract violations.
- Zero catastrophic instruction, multi-turn, or lawful-adult failures in critical cases.
- No critical family mean below 3.0 and overall human usefulness at least 3.5 after rubric calibration.
- Refusal/disclaimer leakage within corpus and product thresholds.
- Basic arithmetic corruption checks pass or route deterministically to the calculator.
- Candidate fits a plausible declared artifact/working-set tier before expensive conversion work.

Any source that fails is rejected before `.slm` conversion.

## S4: Teacher Cache and Distribution Distillation

### Cache schema tests first

- `S4-001 teacher-identity`: checkpoint, tokenizer, template, sampler, dependencies, and execution device are hash bound.
- `S4-002 prompt-identity`: exact rendered bytes, token IDs, source record ID, and split are recorded.
- `S4-003 topk-order-and-uniqueness`: cached token IDs are unique and sorted by descending logit with stable tie handling.
- `S4-004 residual-tail-contract`: top-k probability mass and residual-tail representation reconstruct a normalized distribution within tolerance.
- `S4-005 dtype-roundtrip`: fp32 source logits and compressed cache values have measured error bounds.
- `S4-006 cache-resume`: interrupted generation resumes without duplicate or reordered records.
- `S4-007 cache-corruption`: truncated rows, wrong hashes, NaN/Inf, tokenizer drift, and revision drift fail closed.
- `S4-008 train-eval-firewall`: cache generation rejects any evaluation record.

### Trainer tests first

- `S4-009 kl-reference`: KL loss matches an independent small-vector implementation.
- `S4-010 assistant-mask`: loss applies only to intended assistant positions.
- `S4-011 tail-loss`: residual-tail treatment is finite, normalized, and differentiable.
- `S4-012 preservation-scope`: preservation loss applies only to explicitly marked records.
- `S4-013 adapter-disabled-oracle`: disabling adapters reproduces the frozen base logits.
- `S4-014 no-op-adapter`: zeroed adapter leaves output unchanged.
- `S4-015 destructive-adapter`: intentionally corrupt adapter is detected by the gate.
- `S4-016 deterministic-mini-run`: a tiny CPU fixture produces stable loss and adapter hashes within declared platform limits.

### Experiment matrix

Compare assistant-only LoRA, preservation-aware LoRA, upper-layer LoRA or DoRA, and top-k distribution distillation using identical data, seeds, steps, and gates. Full fine-tuning is allowed only after the corpus scale checkpoint and a written resource plan.

### Stop rules

- Stop an adapter family after two materially different recipes reproduce the same critical failures.
- Stop scaling records when shadow/sealed usefulness does not improve or linguistic leakage worsens.
- Never tune against sealed cases after opening them.

## S5: Quantization and `.slm` Conversion

### Tests first

- `S5-001 f32-source-parity`: complete logits match the pinned reference within calibrated tolerance.
- `S5-002 q8-parity`: full-vector cosine, max error, top-1, and top-k overlap meet the declared gate.
- `S5-003 mixed-profile-directory`: validator and runtime honor tensor-specific dtypes and reject malformed metadata.
- `S5-004 sensitivity-one-family`: restoring each tensor family from q4 to q8 records byte cost and logit/behavior recovery.
- `S5-005 embeddings-head-norm-protection`: protected families cannot silently downgrade.
- `S5-006 forced-multistep-divergence`: teacher-forced decode compares at least eight steps, not first token only.
- `S5-007 free-generation-regression`: source and converted candidates are blindly compared on the behavioral suite.
- `S5-008 deterministic-pack`: same source and recipe produce byte-identical `.slm` and manifest.
- `S5-009 external-quantizer-repack`: AWQ/GPTQ/HQQ/AutoRound output is accepted only after repack and independent parity.
- `S5-010 kv-policy`: context length, KV dtype, bytes per token, and truncation behavior are explicit and tested.

### Exit gate

The mixed profile must beat uniform q4 on full-logit and raw behavioral gates, fit its declared footprint tier, and preserve every critical source behavior. Aggregate similarity cannot excuse a critical semantic regression.

## S6: Deterministic Native and Browser Runtime

### Tests first

- `S6-001 scalar-oracle`: optimized native kernels match scalar Rust on deterministic vectors.
- `S6-002 simd-differential`: SIMD matches scalar across odd dimensions, tails, signs, scales, and alignment cases.
- `S6-003 typed-unsupported-op`: unsupported operation, tokenizer feature, layout, dtype, context, or memory requirement returns a stable typed error.
- `S6-004 no-silent-fallback`: backend loss or unsupported acceleration cannot silently change promotion evidence.
- `S6-005 lifecycle-state-machine`: create/load/generate/cancel/reset/unload/destroy transitions reject invalid ordering.
- `S6-006 cancellation-yield-bound`: cancellation latency is measured at explicit yield points and reported, not assumed.
- `S6-007 worker-ownership`: model state and generation stay in the dedicated worker; messages are versioned and bounded.
- `S6-008 wasm32-preflight`: artifact plus KV plus scratch plus staging memory is estimated before allocation.
- `S6-009 resident-vs-paged`: full-resident and paging fallback are measured on the same browser matrix.
- `S6-010 opfs-idb-semantics`: OPFS stores model pieces; IndexedDB stores journals/metadata; no mmap claim is made.
- `S6-011 native-wasm-output`: deterministic token IDs and stop reason match within the declared precision profile.
- `S6-012 diagnostics-split`: cold load, warm load, prefill, first token, decode, cancellation, and peak memory are separate fields.

### Browser matrix

Run current stable Chromium, Firefox, and Safari where supported, plus desktop and constrained mobile-class profiles. Memory64 and WebGPU are opt-in experimental lanes with independent evidence.

## S7: Behavioral and UI Promotion

### Tests first

- `S7-001 fixed-seeded-shadow-sealed-isolation`
- `S7-002 raw-single-call-witness`
- `S7-003 conversational-coherence-human-rubric`
- `S7-004 common-sense-practical-judgment`
- `S7-005 instruction-priority-and-untrusted-content`
- `S7-006 multi-turn-memory-conflict-and-correction`
- `S7-007 lawful-adult-directness-and-benign-neighbors`
- `S7-008 narrow-boundary-transparency`
- `S7-009 refusal-disclaimer-capability-leakage`
- `S7-010 deterministic-json-extraction-counts`
- `S7-011 calculator-routing-and-result-binding`
- `S7-012 no-network-prompt-egress`
- `S7-013 active-conversation-layout`: starter hero/actions disappear after the first submitted message.
- `S7-014 single-response-render`: one generated assistant turn has exactly one visible response body.
- `S7-015 history-scroll-and-composer`: history owns the center column, scroll remains stable, and composer stays usable.
- `S7-016 visual-lock-desktop-mobile`: approved shell, sidebars, colors, typography, and controls remain within baseline tolerances.

### Exit gate

No duplicate response, no starter controls above an active conversation, no critical behavioral failure, no hidden repair, and no visual-lock regression.

## S8: Distribution and Release

### Tests first

- `S8-001 content-id-and-one-mib-pieces`: manifest identity and current 1 MiB piece hashes are deterministic.
- `S8-002 signature-and-key-id`: signed manifest verifies and unknown/revoked keys fail closed.
- `S8-003 receipt-resume-and-atomic-promotion`: interrupted transfer resumes and never exposes a partial active artifact.
- `S8-004 tombstone-and-revocation`: revoked artifacts cannot be newly installed or resurrected by stale peers.
- `S8-005 authority-routing`: MiniModel, TinyRustLM, UAIX, MemoryEndpoints, NuGet, and optional HF metadata remain in their declared domains.
- `S8-006 public-api-boundary`: packages contain no proprietary conversion, quantization authoring, training, ranking, key, premium, or server internals.
- `S8-007 namespace-lock`: packages retain the approved `UAIX.Browser.*`, `UAIX.Browser.p2pLLM.*`, and `UAIX.Browser.p2pRuntime.*` families.
- `S8-008 deterministic-nuget`: repeated pack outputs have the declared deterministic metadata and content.
- `S8-009 symbols-sourcelink`: `.snupkg`, portable PDB, repository commit, and SourceLink verification pass.
- `S8-010 consumer-install`: clean C# samples restore and exercise validation, runtime, memory, and P2P public APIs.
- `S8-011 hf-human-approval`: no workflow can publish to Hugging Face without an explicit human release input and all artifact gates.
- `S8-012 searchable-metadata`: package descriptions, tags, links, licenses, readme, release notes, and dependency metadata are complete.

## Next Executable Slice

After this intake closes, execute in this order:

1. Make the 96-record targeted prompt-plan verifier fail on any schema, family, exact, normalized, or five-gram issue, then fix the plan.
2. Add semantic-neighbor and linguistic-audit tests before teacher generation.
3. Run the immutable Qwen2.5-0.5B source screen and compare it with the Qwen2.5-1.5B anchor.
4. Generate and review the 572 plus 96 pilot corpus when the teacher environment is healthy.
5. Implement the top-k teacher-cache contract before the next large distillation run.

The GPU currently requiring a reboot does not justify weakening tests or claiming a block. Corpus validation, source preparation, schemas, CPU fixtures, and deterministic tooling can continue independently.

## Execution Status - 2026-07-12

- The 572-record public rehearsal source re-passed immutable import verification.
- The 96-record targeted plan initially failed on two held-out five-gram collisions, then an apostrophe-equivalent short leak, then three distinct semantic neighbors. All were rewritten and the plan now passes collection verify-only with eight balanced families.
- Public-v2 replaces one semantic neighbor through the provenance-aware selector while preserving 572 records and both family quotas.
- A pinned MiniLM audit now compares all 668 prompts with 51 unique held-out prompts at cosine threshold `0.60`; the final report has zero findings. Failed reports remain preserved.
- The immutable Qwen2.5-0.5B source screen ran under concise-charter and minimal system prompts and failed critical practical, source-conflict, policy, and untrusted-memory cases. It is rejected before conversion.
- Focused corpus, collection, dataset, and trainer suites pass 32 tests.

The next executable work is teacher generation/review for the admitted 572 plus 96 pilot when the local endpoint is available, combined-output linguistic enforcement, and top-k teacher-cache support before expanded distillation.

## Execution Status - 2026-07-12 Foundations Review

- Qwen3.6 teacher generation completed for all 572 public and 96 targeted
  prompts under immutable manifests.
- Deterministic agent assistance now proposes 218 rewrites and 11 redundant-row
  rejections while leaving 439 useful originals unchanged.
- The combined 668-record pending audit has zero response-contract findings,
  zero exact or normalized duplicate-answer groups, and passes linguistic
  policy; all decisions remain pending and `training_authority` is false.
- The pinned MiniLM semantic-neighbor audit reports 20 pairs in 15 clusters,
  with 11 proposed rejections and zero automatic rejections.
- The detailed, checksum-bound checkpoint is
  `artifacts/reports/qwen3.6-agent-assisted-review-v5-foundations-assessment.md`.

The next executable work is explicit human review of every record and semantic
cluster. Export, Rust freeze, training, conversion, and promotion remain
unauthorized until that review and the post-export audits pass. Matched
sequence and top-k training remain deferred until supported compute returns;
the locked public UI remains unchanged.

## Execution Status - 2026-07-12 High-Risk And Dedup Review

- Fourteen hash-bound suggestion sources now propose 238 rewrites and 12
  redundant-row rejections while preserving 418 original answers.
- High-risk manual review strengthened policy analysis, ambiguity handling,
  practical first answers, health, sleep, veterinary, insurance, travel, and
  professional-scope guidance.
- The pending audit now detects mojibake and replacement-character artifacts
  as critical findings; direct UTF-8 parsing proves the current 668 candidates
  contain zero such artifacts.
- The authoritative `0.90` semantic gate remains 20 pairs in 15 clusters. An
  additional review-only `0.85` view covers 38 pairs in 25 clusters and binds
  all 12 proposed rejections without automatic action.
- Focused/full Python, intake, and filtered .NET checks pass 16/94/116/6.
- The detailed checksum-bound checkpoint is
  `artifacts/reports/qwen3.6-agent-assisted-review-v6-high-risk-dedup-assessment.md`.

The next executable work remains explicit human disposition of every record
and both semantic views, followed by approved-only export and re-audit. The
broader neighbor view cannot authorize rejection, training, conversion, or
promotion, and the locked public UI remains unchanged.

## Execution Status - 2026-07-12 Routine Quality Review

- Fifteen hash-bound suggestion sources now propose 276 rewrites and 12
  redundant-row rejections while preserving 380 original answers.
- Manual inspection added 38 corrections across education, work, family, and
  home, including category precision, conditional advice, privacy, household
  hazards, family variation, accessible teaching, and practical next steps.
- The first v11 composition attempt failed closed on two transposed source
  hashes and emitted no workbook; the corrected immutable composition accepts
  all 38 rows with exact source identity.
- The v15 pending audit has zero contract, exact/normalized duplicate,
  encoding, apology, disclaimer, false-capability, or hidden-reasoning
  findings; its only 12 findings remain intentional reject suggestions.
- The strict `0.90` and exploratory `0.85` semantic pair sets remain stable,
  text-free, review-only, and incapable of automatic rejection.
- Focused/full Python, intake, and filtered .NET checks pass 16/94/116/6.
- The detailed checksum-bound checkpoint is
  `artifacts/reports/qwen3.6-agent-assisted-review-v7-routine-quality-assessment.md`.

The next executable work is systematic inspection of the 380 untouched
originals, followed by explicit human disposition of all 668 records and both
semantic views. Approved-only export, re-audit, freeze, training, conversion,
and promotion remain closed, and the locked public UI remains unchanged.

## Execution Status - 2026-07-12 Routine Breadth Review

- Seventeen hash-bound suggestion sources now propose 357 rewrites and 12
  redundant-row rejections while preserving 299 original answers.
- Manual inspection of 97 original drafts added 81 corrections across cooking,
  sports, transportation, technology, hobbies, travel, fitness, music, and
  weather while deliberately retaining 16 already-useful drafts.
- Primary-source checks corrected the NYC subway versus Staten Island Railway
  distinction, conditional smart-thermostat savings, and blanket mobile-app
  force-closing advice; changing records and services now carry explicit time
  or authority boundaries.
- Both new immutable compositions accepted every exact-hash row on their first
  run with no duplicate, stale, malformed, or response-contract failure.
- The v17 pending audit has zero contract, exact/normalized duplicate,
  encoding, apology, disclaimer, false-capability, or hidden-reasoning
  findings; its only 12 findings remain intentional reject suggestions.
- The strict `0.90` and exploratory `0.85` semantic pair and cluster sets remain
  stable, text-free, review-only, and incapable of automatic rejection.
- Focused/full Python, intake, and filtered .NET checks pass 16/94/116/6.
- The detailed checksum-bound checkpoint is
  `artifacts/reports/qwen3.6-agent-assisted-review-v8-routine-breadth-assessment.md`.

The next executable work is systematic inspection of the 299 untouched
originals, followed by explicit human disposition of all 668 records and both
semantic views. Approved-only export, re-audit, freeze, training, conversion,
and promotion remain closed, and the locked public UI remains unchanged.

## Execution Status - 2026-07-12 Elementary Foundations Review

- Eighteen hash-bound suggestion sources now propose 402 rewrites and 13
  redundant-row rejections while preserving 253 original answers.
- Manual inspection covered all 144 elementary/science originals, added 45
  rewrites and one manual duplicate proposal, and deliberately retained 98
  already-useful answers.
- Corrections cover scientific uncertainty, unsafe chemical tasting, current
  vaquita evidence, states and layers of matter, climate scope, cultural
  generalization, recycling, heredity, plant life cycles, informal measures,
  pulleys, sound perception, and other elementary factual boundaries.
- The new source accepted all 46 exact-hash rows on its first immutable
  composition with no duplicate, stale, malformed, or response-contract
  failure.
- The v18 pending audit has zero contract, exact/normalized answer duplicate,
  encoding, apology, disclaimer, false-capability, or hidden-reasoning
  findings; its only 13 findings remain intentional reject suggestions.
- The strict `0.90` and exploratory `0.85` views remain 20 pairs/15 clusters
  and 38 pairs/25 clusters with zero automatic rejection. Twelve proposed
  rejects appear in the exploratory view; the new manual heredity duplicate is
  explicitly below that threshold and still requires direct human judgment.
- Focused/full Python, intake, and filtered .NET checks pass 16/94/116/6.
- The detailed checksum-bound checkpoint is
  `artifacts/reports/qwen3.6-agent-assisted-review-v9-elementary-foundations-assessment.md`.

The next executable work is systematic inspection of the 253 untouched
originals, followed by explicit human disposition of all 668 records and both
semantic views. Approved-only export, re-audit, freeze, training, conversion,
and promotion remain closed, and the locked public UI remains unchanged.

## Execution Status - 2026-07-12 Complete Agent Inspection

- Nineteen hash-bound suggestion sources now propose 428 rewrites and 14
  redundant-row rejections; all other 226 originals were inspected and
  deliberately retained, completing agent inspection coverage for 668/668
  drafts.
- This pass inspected all 42 targeted originals and 113 everyday public
  originals. It retained all 42 targeted rows and 86 everyday rows, proposed
  26 everyday rewrites, and proposed one redundant study-guidance rejection.
- Corrections cover current choking first aid, pet and aquarium care, pet
  grooming safety, shampoo claims, cooking and food-temperature precision,
  homework planning, family assumptions, tailoring and textiles, gifts and
  price comparison, beginner music theory, children's games, theater history,
  concert audio, recommendations, social etiquette, laptop shopping, road
  safety, and sun protection.
- The new 27-record source accepted every exact-hash row on its first immutable
  composition. The retained-record set is bound by SHA-256
  `d77e9f68ab7d2e416ce7cb7f98cfd87068128c8bcbdf28fbf3e14a56e6ce99b0`.
- The v20 pending audit has zero contract, exact/normalized answer duplicate,
  encoding, apology, disclaimer, false-capability, or hidden-reasoning
  findings; its only 14 findings are intentional rejection suggestions.
- Strict `0.90` and exploratory `0.85` semantic views remain 20 pairs/15
  clusters and 38 pairs/25 clusters with zero automatic action.
- A full-suite rerun exposed a Windows Parquet file-handle leak in the public
  prompt importer. The importer now closes `ParquetFile` in `finally`; its 5
  focused tests, a 10-run/50-test resource stress loop, and full 95-test Python
  discovery pass.
- Focused review, full Python, intake, and filtered .NET checks pass
  16/95/116/6.
- MemoryEndpoints marker
  `tinyrustlm-agent-assisted-review-v10-668-agent-inspected-20260712` has
  promoted, tier-isolated status and handoff readback with redaction intact.
- The detailed checksum-bound checkpoint is
  `artifacts/reports/qwen3.6-agent-assisted-review-v10-complete-agent-inspection-assessment.md`.

The next executable gate is explicit human disposition of all 668 records and
both semantic views. Agent inspection does not approve a record. Approved-only
export, re-audit, freeze, training, conversion, and promotion remain closed,
GPU-backed work remains deferred pending recovery, and the locked public UI
remains unchanged.

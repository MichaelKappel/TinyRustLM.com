# TinyRustLM Memory Distribution and Lifecycle Report

## Scope and evidentiary basis

This report was requested for `E:\Source\Rust\TinyRustLM.com`, with the active intake identified as `E:\Source\Rust\TinyRustLM.com\agent-file-handoff\Improvement` and the desired output target identified as `E:\Source\Rust\TinyRustLM.com\agent-file-handoff\Improvement\tinyrustlm-memory-distribution-and-lifecycle-report.md`. Direct inspection of that Windows path was not possible in this environment, so I could not verify the repository files on disk, compute hashes, inspect live `.uai` contents, or exercise the report-intake verifier, intake ledger, MemoryEndpoints crate, .NET wrapper, browser hosted-memory implementation, or MATM mappings directly. What follows is therefore a formal **design-and-repair report** grounded in the public TinyRustLM, MiRust, ModelBreeder, MemoryEndpoints, and MultiAgentMemory documentation, plus the requirements in your brief.

The public project materials already establish the architectural intent that matters. TinyRustLM exposes a browser-local runtime with a “Memory Deck” flow that binds an extracted `.uai` folder, and its runtime documentation explicitly treats “Reports, long-term memory, and `.uai` handoff files” as part of the project documentation surface. MiRust describes `.uai` as a **local handoff package for bounded cross-session continuity**, not runtime execution and not automatic synchronization. ModelBreeder’s related operational guidance says typed `.uai` files hold current operating truth, `/docs` holds durable source reports, and active handoff buckets hold new material waiting for review. MultiAgentMemory further describes repository `.uai/` files as the active startup memory suite, while MemoryEndpoints.com is the intended hosted boundary for mid-to-long-term workspace memory and related audit surfaces. citeturn2view0turn6view4turn7view0turn14search0turn21view0turn21view2

The publicly documented problem is also already visible: MiRust’s “Implementation memory handoff gap” records that the documented UAI startup path and the files actually present in a reviewed archive did not match, with the `.uai/` directory and named startup records missing, creating a risk that agents either trust stale README instructions or overload a single workspace record, and that the long-memory pointer ledger cannot be verified. Separately, MiRust’s “Agent File Handoff” page defines the **Improvement** bucket as the live intake source of truth for audit, QA, bug, strategy, and site-fix work, and it says intake is incomplete until every non-placeholder file is reviewed, dispositioned, given a processed outcome, used or blocked with reason, recorded in durable evidence, and removed or explicitly kept active. citeturn11view0turn26view0

That combination of intended design and documented drift leads to the correct conclusion: TinyRustLM needs a **deterministic, content-addressed, tier-aware memory lifecycle** in which intake discovery, hashing, classification, distillation, short-term referencing, durable publication, hosted distribution, supersession, and audit evidence are all first-class state transitions rather than implied side effects. ModelBreeder’s versioned-source guidance already points in this direction by requiring preservation of new editions under `/docs`, recording size and SHA-256, and forbidding silent replacement of older editions; its audit-packet guidance likewise requires immutable digests and explicitly forbids approvals that rely on floating names such as `latest`. NIST’s Secure Hash Standard is the appropriate foundation for the immutable digest requirement because it defines secure hash algorithms, including SHA-256, as mechanisms for producing digests that detect whether messages have changed. citeturn15view0turn15view1turn17view2

## Current-state diagnosis and design principles

The public documentation shows that the project already distinguishes three different memory roles, but they are not yet governed by one formal lifecycle. First, `.uai` is supposed to be concise, active startup continuity memory. Second, local durable memory belongs in project docs and long-term memory folders. Third, MemoryEndpoints.com is supposed to become the hosted MATM boundary for durable workspace memory, messages, redacted receipts, and protected audit readback. When those roles are not bound by one ledger and one set of identifiers, reports predictably linger in intake, conclusions get copied into the wrong tier, and retrieval becomes ambiguous. citeturn21view0turn21view1turn21view2turn22search0

The repair should be organized around five principles.

The first principle is **source-before-summary**. The source report is the only thing that enters the system from intake. Nothing may be marked complete until that source has a discovery record, immutable digest, disposition, and durable evidence trail. This matches the MiRust completion gate and the ModelBreeder rule to preserve new report editions under `/docs` with hash metadata rather than silently replacing older material. citeturn26view0turn15view0

The second principle is **short-term memory as reference, not duplication**. Because `.uai` is documented as current operating truth and bounded startup continuity rather than a raw archive, `.uai` should not hold full reports. It should hold terse conclusions, tasks, and constraints, each one pointing to a durable Markdown document and the original intake hash. That design closes the exact gap identified in the public handoff-drift report, where long-memory pointers were not reliably verifiable. citeturn7view0turn11view0turn21view2

The third principle is **tier isolation by type, not by convention**. If hosted short-term memory is mapped to `memoryType=status` and hosted long-term memory is mapped to `memoryType=handoff`, that distinction must be enforced in every wrapper, every search method, every test fixture, and every receipt. A caller performing a long-term-only search should not be able to omit the filter and “accidentally” receive status results; likewise a status-only search must not include handoff records unless the caller intentionally requests both tiers.

The fourth principle is **every transition leaves an audit artifact**. The public audit-packet guidance is directly relevant here: reviewability after the fact requires immutable identities, evidence versions, rationale, and rollback information. In this memory system, that means discovery receipts, distribution receipts, failure records, supersession records, and tombstones must all be durable, queryable, and attributable to one intake record. citeturn15view1

The fifth principle is **local continuity survives hosted failure**. TinyRustLM is explicitly browser-local in its runtime posture, and both the public MATM docs and the project docs emphasize that secrets stay outside public surfaces. The hosted boundary is therefore optional acceleration, not authority. If MemoryEndpoints is unavailable, local `.uai`, local durable memory, and the intake ledger must still remain correct and retryable. For browser reconnection after offline work, the right pattern is a local transactional outbox plus service-worker-assisted deferred synchronization, because IndexedDB is transactional and the Background Synchronization API is designed specifically to defer synchronization work until connectivity returns, while allowing the browser to retry limited failures. citeturn2view0turn21view0turn21view1turn18search0turn18search1turn17view0turn17view1

## Formal memory lifecycle

### Discovery, hashing, and duplicate detection

Discovery must scan **only** `agent-file-handoff/Improvement` as the active intake bucket for this report class, because the public MiRust handoff guidance defines the live directory listing of the active bucket as the intake source of truth and requires a visible disposition for every supplied file. Each discovered file gets a manifest entry immediately, before classification or parsing. citeturn26view0turn26view1

Each intake file must receive two hashes:

- `source_bytes_sha256`: SHA-256 over the exact raw bytes as discovered.
- `canonical_text_sha256`: SHA-256 over normalized text extracted from the file after line-ending normalization and UTF-8 normalization.

The byte hash is the immutable identity for exact-duplicate detection and provenance. The canonical-text hash is for edition comparison, stale-reference detection, and “same report, different line endings” scenarios. NIST’s SHA-256 basis is appropriate for message-change detection. citeturn17view2

Duplicate detection should produce three distinct outcomes rather than one blunt “duplicate” flag. If `source_bytes_sha256` already exists, the file is an **exact duplicate** and may skip re-distillation while still receiving a ledger outcome. If the byte hash differs but `canonical_text_sha256` matches, it is an **edition duplicate** with different packaging but identical textual content. If both hashes differ yet metadata indicates the same logical report lineage, it is a **new edition**, not a duplicate, and must continue through classification and distillation. This preserves the versioned-source rule that older editions remain evidence and are not silently overwritten. citeturn15view0

### Classification and distillation

Every non-placeholder intake file progresses to classification with these dimensions:

- `domain`: architecture, memory, QA, bug, strategy, security, release, documentation, or mixed.
- `urgency`: immediate, near-term, scheduled, archival.
- `confidence`: observed, inferred, speculative, conflicting.
- `expected_lifetime`: ephemeral, short, medium, long, permanent.

Those classes are needed because the public docs already distinguish active handoff material, active `.uai`, and durable long-term evidence, and the editorial evidence lifecycle explicitly includes status assignment, verification, publication, staleness review, correction, and retirement. citeturn26view2turn21view2

Distillation must extract structured claims rather than produce one freeform summary. The mandatory extraction buckets are:

- decisions;
- constraints;
- implementation tasks;
- test obligations;
- unresolved questions;
- rejected approaches;
- contradictions against prior durable conclusions.

Each extracted item gets its own `claim_id`, `claim_type`, `statement_text`, `evidence_span`, `confidence`, `privacy_class`, and `expected_lifetime`. This is the point where the system determines what is worthy of short-term activation and what belongs only in durable memory. The durable Markdown document remains the full reasoning artifact; `.uai` receives only the terse reference form.

### Distribution across local and hosted tiers

Distribution must be **fan-out with receipts**, not “write somewhere and assume success.” The system writes to up to four targets in this order:

1. local durable Markdown;
2. local `.uai` reference records;
3. hosted `status` records;
4. hosted `handoff` records.

The local durable document is authoritative for any retained conclusion. Local `.uai` may only be written after the durable document exists, because every short-term statement must trace to a durable reference. Hosted writes may only occur after the two local writes have succeeded. Intake files remain in the active bucket until local durable creation is verified and all intended hosted writes either succeed or generate explicit retryable failure records. This follows the public completion-gate logic that intake is incomplete until durable evidence exists and the file is either removed or explicitly kept active. citeturn26view0turn15view1

Hosted mapping should be strict. `memoryType=status` is for short-lived working continuity: concise state, active tasks, active constraints, active blockers, and active supersession alerts. `memoryType=handoff` is for long-lived transfer memory: reasoning-rich summaries, provenance, contradiction handling, review outcomes, and release-relevant architecture conclusions. MultiAgentMemory’s public boundary supports this general split because it distinguishes active `.uai` startup continuity from hosted mid-to-long-term memory, while `docs/long-term-memory/` remains the local durable store until hosted promotion is proven. citeturn21view0turn21view2

### Retrieval isolation, supersession, retention, and forgetting

Tier-specific retrieval must be implemented as distinct APIs:

- `search_status(...)` always injects `memory_type=status`.
- `search_handoff(...)` always injects `memory_type=handoff`.
- `search_any(...)` is reserved for explicit cross-tier diagnostics and must return the tier for every hit.

The Rust crate, .NET wrapper, browser implementation, and MATM adapters should expose `MemoryTier` as a required enum, never as an optional string. If a caller does not specify a tier, the operation should fail closed. That is the cleanest way to prevent status results from leaking into long-term-only searches and vice versa.

Supersession must be explicit and non-destructive. When a newer report contradicts an older conclusion, the older durable claim is marked `superseded`, the new claim is marked `active`, and a supersession record links them by `supersedes_claim_id`, `basis_report_id`, and `reason_code`. Short-term `.uai` and hosted `status` entries should be regenerated so that only the active claim remains visible in normal current-state views while the older durable record remains searchable for audit.

Retention should follow the classification lifetime. Ephemeral and short-lived status records should expire automatically unless renewed by active references. Durable Markdown handoff records should not expire automatically; instead they move through active, superseded, archived, and retired states. User-requested forgetting creates a tombstone, removes or redacts hosted records, removes `.uai` references, and either deletes or metadata-redacts durable local content according to policy. A forgotten record must not vanish without trace; the tombstone should preserve the minimum lawful metadata needed for audit: record id, reason, requester, effective UTC time, and purge receipts.

### Service failure, interruption, concurrency, and browser reconciliation

Local memory must always survive hosted failure. If MemoryEndpoints is unavailable, the system still writes the durable Markdown and `.uai` reference, records hosted distribution as `failed_retryable`, leaves the intake item active or partially processed, and emits a failure receipt that a later processor can retry idempotently. This is consistent with the project’s local-first posture and with the public MemoryEndpoints boundary language that treats the service as a memory surface rather than a hidden authority. citeturn21view0turn21view1

For browser-side offline work, use a transactional outbox in IndexedDB. IndexedDB’s transaction model is useful specifically because separate tabs would otherwise interfere with each other, and service-worker background sync is designed to defer synchronization until connectivity returns, with limited retries when a task fails. Because sync handlers restart from the beginning rather than resuming mid-flight, every hosted write must be idempotent by key and safe to replay. citeturn18search0turn17view0turn17view1

For multi-agent concurrency, each intake file should be claimed by a lease-bearing processing record keyed by the immutable byte hash, processor id, and phase. A worker crash should never force manual reconstruction. On startup, processors replay the ledger, find leases whose expiration time has passed, verify the last confirmed phase receipts, and resume from the earliest incomplete phase. All writes must use atomic temp-file-then-rename behavior locally, and hosted writes must carry an idempotency key derived from `(source_bytes_sha256, distribution_target, schema_version, claim_or_doc_id)`.

## Canonical schemas

The schemas below are the recommended minimum contract. They are designed so that every short-term statement can be traced back to a durable document and original intake hash, and so that all tiers can be deduplicated and superseded deterministically.

### Intake manifest record

```json
{
  "schema": "tinyrustlm.intake_manifest.v1",
  "intake_id": "intk_20260710_01H...",
  "repo_root": "E:\\Source\\Rust\\TinyRustLM.com",
  "intake_bucket": "agent-file-handoff/Improvement",
  "relative_path": "agent-file-handoff/Improvement/example-report.md",
  "discovered_at_utc": "2026-07-10T20:15:00Z",
  "discovered_by": "memory-intake-scanner",
  "source_file_name": "example-report.md",
  "source_media_type": "text/markdown",
  "byte_length": 18422,
  "source_bytes_sha256": "hex",
  "canonical_text_sha256": "hex",
  "duplicate_class": "none",
  "logical_lineage_key": "memory-distribution-report",
  "source_revision_hint": "unknown",
  "processing_state": "discovered",
  "privacy_class": "unclassified",
  "notes": null
}
```

### Distillation record

```json
{
  "schema": "tinyrustlm.distillation.v1",
  "distillation_id": "dist_01H...",
  "intake_id": "intk_20260710_01H...",
  "source_bytes_sha256": "hex",
  "classified_at_utc": "2026-07-10T20:17:00Z",
  "classified_by": "memory-distiller",
  "domain": ["memory", "architecture", "qa"],
  "urgency": "near-term",
  "confidence": "observed",
  "expected_lifetime": "long",
  "privacy_class": "internal_project",
  "claims": [
    {
      "claim_id": "clm_01H...",
      "claim_type": "constraint",
      "statement_text": "Intake must not be cleared before durable distribution is verified.",
      "evidence_anchor": {
        "source_section": "Acceptance criteria",
        "line_start": 80,
        "line_end": 86
      },
      "confidence": "observed",
      "contradicts_claim_ids": [],
      "rejected": false
    }
  ],
  "summary": {
    "decisions": [],
    "constraints": ["clm_01H..."],
    "implementation_tasks": [],
    "test_obligations": [],
    "unresolved_questions": [],
    "rejected_approaches": []
  }
}
```

### Short-term `.uai` reference record

```yaml
schema: tinyrustlm.uai_ref.v1
uai_ref_id: uai_01H...
tier: short_term
state: active
kind: constraint
statement: Intake must not be cleared before durable distribution is verified.
confidence: observed
priority: high
expected_expiry_utc: 2026-08-09T00:00:00Z
durable_doc_id: ltm_01H...
durable_doc_path: docs/long-term-memory/memory/2026-07-10-memory-distribution.md
durable_anchor: "#constraint-intake-clearance"
source_intake_id: intk_20260710_01H...
source_bytes_sha256: hex
canonical_text_sha256: hex
distillation_id: dist_01H...
supersedes_uai_ref_id: null
superseded_by_uai_ref_id: null
privacy_class: internal_project
public_safe_summary: Intake clearance is blocked until durable verification completes.
hosted_status_record_id: null
```

### Long-term memory document

```markdown
---
schema: tinyrustlm.long_term_memory.v1
doc_id: ltm_01H...
title: Memory distribution and lifecycle
state: active
domain:
  - memory
  - architecture
source_intake_ids:
  - intk_20260710_01H...
source_bytes_sha256:
  - hex
canonical_text_sha256:
  - hex
distillation_ids:
  - dist_01H...
supersedes_doc_ids: []
superseded_by_doc_id: null
privacy_class: internal_project
public_safe: false
created_at_utc: 2026-07-10T20:20:00Z
updated_at_utc: 2026-07-10T20:21:00Z
owner: memory-lifecycle-pipeline
review_status: verified
---

# Memory distribution and lifecycle

## Context

...

## Decisions

- ...

## Constraints

- ...

## Implementation tasks

- ...

## Test obligations

- ...

## Unresolved questions

- ...

## Rejected approaches

- ...

## Provenance

- intake: intk_20260710_01H...
- source hash: hex
- distillation: dist_01H...
```

### Hosted `status` record

```json
{
  "schema": "tinyrustlm.hosted_status.v1",
  "record_id": "hst_01H...",
  "memoryType": "status",
  "workspace": "TinyRustLM.com",
  "tier": "short_term",
  "status_kind": "constraint",
  "statement": "Intake must not be cleared before durable distribution is verified.",
  "public_safe_summary": "Intake clearance is blocked until durable verification completes.",
  "durable_doc_id": "ltm_01H...",
  "durable_anchor": "#constraint-intake-clearance",
  "source_intake_id": "intk_20260710_01H...",
  "source_bytes_sha256": "hex",
  "canonical_text_sha256": "hex",
  "distillation_id": "dist_01H...",
  "superseded": false,
  "expires_at_utc": "2026-08-09T00:00:00Z",
  "privacy_class": "internal_project",
  "idempotency_key": "hex",
  "distribution_receipt_id": "rcpt_01H..."
}
```

### Hosted `handoff` record

```json
{
  "schema": "tinyrustlm.hosted_handoff.v1",
  "record_id": "hdo_01H...",
  "memoryType": "handoff",
  "workspace": "TinyRustLM.com",
  "tier": "long_term",
  "title": "Memory distribution and lifecycle",
  "abstract": "Formal lifecycle for intake discovery, distillation, distribution, retrieval isolation, supersession, and auditability.",
  "durable_doc_id": "ltm_01H...",
  "durable_doc_path": "docs/long-term-memory/memory/2026-07-10-memory-distribution.md",
  "source_intake_ids": ["intk_20260710_01H..."],
  "source_bytes_sha256": ["hex"],
  "canonical_text_sha256": ["hex"],
  "claim_ids": ["clm_01H..."],
  "privacy_class": "internal_project",
  "public_safe": false,
  "supersedes_record_ids": [],
  "superseded_by_record_id": null,
  "retention_class": "long",
  "idempotency_key": "hex",
  "distribution_receipt_id": "rcpt_01H..."
}
```

### Supersession and tombstone records

```json
{
  "schema": "tinyrustlm.supersession.v1",
  "supersession_id": "sup_01H...",
  "supersedes_claim_id": "clm_old",
  "superseded_by_claim_id": "clm_new",
  "basis_intake_id": "intk_20260711_01H...",
  "basis_source_bytes_sha256": "hex",
  "reason_code": "contradictory_newer_evidence",
  "effective_at_utc": "2026-07-11T13:00:00Z",
  "recorded_by": "memory-supersession-engine"
}
```

```json
{
  "schema": "tinyrustlm.tombstone.v1",
  "tombstone_id": "tmb_01H...",
  "target_record_type": "handoff",
  "target_record_id": "hdo_01H...",
  "reason_code": "user_requested_forgetting",
  "effective_at_utc": "2026-07-12T09:00:00Z",
  "requested_by": "user",
  "local_purge_receipt_ids": ["rcpt_01H..."],
  "hosted_purge_receipt_ids": ["rcpt_01H..."],
  "metadata_retained": {
    "former_source_bytes_sha256": "hex",
    "former_doc_id": "ltm_01H..."
  }
}
```

### Processing receipts and failure records

```json
{
  "schema": "tinyrustlm.processing_receipt.v1",
  "receipt_id": "rcpt_01H...",
  "intake_id": "intk_20260710_01H...",
  "phase": "distributed",
  "target": "hosted_status",
  "target_id": "hst_01H...",
  "idempotency_key": "hex",
  "attempt": 1,
  "result": "success",
  "recorded_at_utc": "2026-07-10T20:22:00Z",
  "processor_id": "agent-a",
  "details": {
    "bytes_written": 912,
    "verified": false
  }
}
```

```json
{
  "schema": "tinyrustlm.failure_record.v1",
  "failure_id": "fail_01H...",
  "intake_id": "intk_20260710_01H...",
  "phase": "distributed",
  "target": "hosted_handoff",
  "idempotency_key": "hex",
  "attempt": 1,
  "result": "failed_retryable",
  "recorded_at_utc": "2026-07-10T20:22:10Z",
  "processor_id": "agent-a",
  "error_code": "network_unreachable",
  "error_summary": "Hosted handoff write failed after local durable write succeeded.",
  "next_retry_after_utc": "2026-07-10T20:27:10Z"
}
```

## State machine and recovery rules

The canonical state progression should be:

```text
discovered
  -> hashed
  -> classified
  -> distilled
  -> distributed
  -> verified
  -> archived
```

There are also side outcomes:

```text
hashed -> duplicate_exact
hashed -> duplicate_edition
classified -> rejected
distilled -> superseded
distributed -> failed_retryable
distributed -> failed_terminal
verified -> forgotten
verified -> superseded
archived -> restored
```

Legal transitions are straightforward. `discovered -> hashed` is legal after a manifest record exists. `hashed -> classified` is legal if the file is not an exact duplicate or if duplicate policy still requires reclassification. `classified -> distilled` is legal only after privacy classification is set. `distilled -> distributed` is legal only when at least one durable long-term document can be produced. `distributed -> verified` is legal only when the durable document, `.uai` reference, and all intended hosted writes have either succeeded or have explicit failure records acknowledged by policy. `verified -> archived` is legal only after the intake item has a final visible outcome. `verified -> superseded` is legal when a newer verified claim contradicts it. `verified -> forgotten` is legal only through a tombstone workflow.

Illegal transitions should fail loudly. `discovered -> distilled` is illegal because it skips hashing and classification. `hashed -> archived` is illegal because a report cannot disappear after hash acquisition without a disposition. `distilled -> archived` is illegal because short-term and durable distribution decisions have not yet been recorded. `distributed -> archived` is illegal if verification has not confirmed either success or visible retryable failure. `verified -> discovered` is illegal because states are monotonic; correction happens through supersession or restoration, not by rewinding history.

Crash recovery must be ledger-driven. On restart, processors read manifest, receipts, failure records, and leases. If a crash occurs before hashing, the item remains `discovered`. If it occurs after hashing but before classification, recovery resumes at `hashed`. If local durable writing succeeded but hosted writes did not, the item remains `distributed` with explicit failed targets and retries resume by idempotency key. If verification was not recorded, the item is not treated as complete even if files happen to exist; existence is not proof of semantic distillation. That follows directly from the public intake-completion rule that visible disposition and durable evidence are required before something can be treated as processed. citeturn26view0turn26view1turn26view2turn15view1

## TDD plan and measurable acceptance criteria

### Test fixtures

The test suite should be phase-based and data-driven. Each fixture should include the source file, expected manifest, expected state trace, expected durable outputs, expected `.uai` outputs, expected hosted payloads, and expected receipts.

| Fixture | Purpose | Expected outcome |
|---|---|---|
| exact-duplicate-report | Same bytes appear twice in intake | Second file gets ledger outcome `duplicate_exact`; no second durable doc; no silent discard |
| modified-report-same-content | Same text, different line endings or front matter | `source_bytes_sha256` differs, `canonical_text_sha256` matches; treated as edition duplicate |
| new-edition-report | Same logical lineage, changed content | New durable doc or superseding revision created; older doc preserved |
| contradictory-report | New report reverses prior conclusion | Supersession record created; old claim marked superseded; `.uai` refreshed |
| malformed-markdown | Bad headings/front matter | Manifest and failure record still created; item remains visible and retryable |
| missing-durable-reference | Distillation produces `.uai` candidate before durable doc exists | Verification fails; `.uai` write blocked |
| stale-hash | Stored source bytes hash no longer matches durable provenance | Verification fails with audit-visible discrepancy |
| cross-tier-leakage | `search_handoff()` returns `status` records or vice versa | Test must fail; wrappers must require explicit tier |
| network-failure | Hosted service unreachable | Local durable and `.uai` succeed; hosted failure receipt created; intake not silently cleared |
| duplicate-idempotency-key | Same hosted write replayed | Exactly one logical hosted record remains |
| concurrent-processors | Two agents claim same intake item | One lease wins; the other backs off without corrupting outputs |
| partial-hosted-write | Status write succeeds, handoff write fails | Separate receipts reflect mixed outcome; recovery retries only failed target |
| browser-offline-reconciliation | Offline browser creates queued hosted writes | IndexedDB outbox persists; background sync flushes when online; no duplicates |
| privacy-redaction | Input contains credentials or sensitive prompts | Public-safe fields omitted or redacted; hosted/public-safe records blocked as required |
| happy-path-end-to-end | Clean report with durable conclusions | Every artifact and receipt produced; final state `verified` or `archived` |

### Acceptance criteria

The system should not be considered fixed until all of the following are true in automated tests and repository verification runs:

- Every intake file in `agent-file-handoff/Improvement` receives an outcome ledger record, even if it is malformed, duplicate, blocked, or deferred.
- Every retained conclusion in `.uai` contains a durable reference, durable anchor, original intake id, and original source hash.
- Short-term `.uai` never duplicates a full report body; it stores concise statements and references only.
- Every durable document records immutable SHA-256 provenance for the source material, and verification can detect mismatch. citeturn17view2
- Tier-specific hosted searches stay isolated: `status` queries never return `handoff` records, and `handoff` queries never return `status` records.
- Reprocessing the same intake file is idempotent: no duplicate durable docs, no duplicate `.uai` entries, and no duplicate hosted logical records.
- If hosted distribution fails, the failure remains visible and retryable, local memory remains intact, and intake is not silently cleared.
- Superseded conclusions remain auditable through explicit supersession records rather than destructive overwrite.
- Browser offline work reconciles through a transactional outbox and replay-safe hosted writes, with no duplicate logical records after reconnect. citeturn18search0turn17view0turn17view1
- Secret material does not enter public-safe summaries, public documentation, or public repository memory surfaces. The public MATM docs explicitly require public-safe summaries only and say secrets, deployment credentials, and raw API keys belong outside public documentation and repository-facing surfaces. citeturn21view0turn21view1
- No report is silently abandoned; “processed” means reviewed, dispositioned, given a visible outcome, and tied to durable evidence, matching the public intake-completion rule. citeturn26view0turn26view1

## Recommended implementation contract for TinyRustLM

The shortest path to correctness is to formalize the memory stack as **one intake ledger driving three derived memory tiers**.

The canonical source of truth should be the **intake manifest plus durable long-term Markdown**. `.uai` becomes a generated, concise current-state reference layer. Hosted `status` and `handoff` become synchronized projections, not independent authorities. That aligns with the public distinction between active `.uai`, local durable docs, and hosted MATM memory, while also honoring the documented gap that current startup expectations and actual handoff artifacts can drift apart if there is no verifiable pointer chain. citeturn11view0turn21view0turn21view2

In practical terms, TinyRustLM should treat the lifecycle as:

```text
active intake report
  -> immutable manifest + hashes
  -> structured distillation
  -> durable long-term Markdown
  -> concise .uai reference entries
  -> hosted status/handoff projections
  -> verification receipts
  -> archive or keep-active decision
```

That contract resolves the exact anti-patterns named in your brief. It prevents “processed by filename only,” because no file reaches `verified` without phase receipts. It prevents copying whole reports to short-term memory, because `.uai` records are structurally reference-first. It prevents premature intake deletion, because intake remains active until durable verification completes. It prevents inconsistent routing, because each extracted claim has one durable home and zero or more derived projections. It prevents search leakage, because tier filters are explicit and mandatory. It prevents contradiction confusion, because newer evidence supersedes older claims through linked records instead of destructive edits. And it preserves auditability, because every short-term statement can point backward to a durable anchor and original intake hash, while every durable claim can point back to its discovery manifest and forward to every hosted projection. citeturn15view0turn15view1turn26view0turn26view2

The public documentation already contains most of the conceptual pieces: active `.uai` memory, durable docs, versioned source editions, visible disposition rules, audit packets, and a hosted MATM boundary. What is missing is the formal stitching. The recommended repair is therefore not a new memory concept; it is a **deterministic lifecycle and schema contract that makes the existing concepts enforceable, testable, and crash-recoverable**. citeturn14search0turn15view0turn15view1turn21view0turn21view2
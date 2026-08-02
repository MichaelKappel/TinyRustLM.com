# TinyRustLM Role-History Distillation Memory

Date: 2026-07-12

## Decision

The TinyRustLM distillation path now preserves actual multi-turn roles from
teacher collection through import, Rust freeze/validation, and LoRA
tokenization. This closes the structural defect where a role-history quality
campaign could be designed as conversations but flattened into isolated
prompt/answer pairs before training.

The implementation is verified, but the corpus is not approved. Forty-two
teacher drafts exist and all 42 still require explicit human review. No
adapter has been trained, no model has been promoted, no browser default has
changed, and no public UI or deployment file was modified.

## Dataset Contract

The existing `tinyrustlm.distillation_dataset_import.v1` path remains
backward compatible. Version 2 adds a required `history` array to each
reviewed record and preserves it as canonical
`tinyrustlm.role_history.v1` JSON.

The contract requires one to six complete turns. History begins with a user,
alternates user and assistant exactly, and ends with an assistant before the
active prompt. Empty content, partial turns, excessive history, hidden
reasoning, credentials, and likely secrets fail closed.
The source and frozen manifests bind history bytes, message counts, file
identities, and hashes.

Rust freeze and validation understand both dataset versions. Version 1 keeps
its original prompt/response byte behavior. Version 2 hashes and validates the
canonical history, combines history, active prompt, and reviewed response in
the frozen pair identity, and materializes every role message for exclusion
checks.

The Python trainer independently reopens and hash-checks that history. It
tokenizes system context, prior user/assistant messages, the active user, and
the target assistant through the pinned tokenizer template. Only the final
assistant target contributes loss.

## Contamination Boundary

The exact seven-case strict multi-turn evaluator remains excluded from
training with SHA-256
`161d50b3ac8821f9262350196b081dfe19ceb0c92a3d212b500aa1678e6d8066`.
All existing assistant-quality exclusions are also bound in the collection
control.

Collection, reviewed export, and Rust freeze now compare exclusions against
the complete role history plus the active prompt. Semantic matching uses only
message content; human-readable labels such as `user` or `current user` are
not allowed to manufacture false five-word overlaps. Exact benchmark answers,
expected terms, repair branches, and retries are absent from the curriculum.

## Curriculum

The tracked prompt plan contains 42 structured conversations across six task
families. Coverage includes:

- corrections and latest-user precedence
- references, pronouns, ellipsis, and ordering
- authoritative-source conflicts without invented resolution
- untrusted memory, document, email, note, report, and web text
- practical constraints and feasible fallbacks
- casual continuity and ambiguity clarification

Every record has at least one complete prior turn. Prompt-plan SHA-256 is
`4c41a109c71823f23bcdd5a46d127c0c3e7a92ad8eda3ada5c091db59f9fbfad`.
Teacher-system-prompt SHA-256 is
`90e9aced26e9650523d73f0e3eb0ef04b527116ef579c00421308f6a319187ef`.

The local Qwen3.6 teacher produced 42 hash-bound drafts. Collection resume and
verification pass, but the checkpoint status is explicitly
`collection-checkpoint-not-training-approved`. Draft bodies, raw teacher
responses, and review-session material remain ignored local evidence and are
not committed or posted to MemoryEndpoints.

## Review State

Deterministic triage marks 13 records high priority and 29 focused. Four
hash-bound rewrite suggestions were prepared, 38 records were deliberately
left untouched, and no rejection was proposed. Suggestions are review aids,
not decisions.

The human handoff contains three batches of 14 records. Current state is:

- resolved: 0
- pending: 42
- ready for merge: false
- training authority: false

The text-free progress receipt contains no prompt text, response text, record
identities, or record-level actions. The loopback review workstation provides
one-record-at-a-time decisions, stale-tab detection, and atomic saves; it has
no bulk approval operation.

## Verification

- Python tool suite: 125 passed, 9 skipped, 0 failed
- Rust workspace tests: pass
- `cargo fmt --all -- --check`: pass
- `cargo clippy -p tinyrustlm-slm-pack --all-targets -- -D warnings`: pass
- .NET package-boundary tests: 52 passed, 0 failed
- report-intake memory verifier: 120 hashed durable rows, 0 mismatches
- `git diff --check`: pass
- collection checkpoint revalidation: 42/42 pass

The test suite covers backward-compatible v1 import/training, v2 history
canonicalization and hashing, malformed/partial role rejection, full-history
contamination, teacher role serialization, history-preserving reviewed export,
and trainer target masking.

Redacted machine evidence:
`artifacts/reports/tinyrustlm-role-history-distillation-pipeline-2026-07-12.json`.

## Hosted Memory Distribution

The public-safe checkpoint is dogfooded in MemoryEndpoints goal scope under
marker `tinyrustlm-role-history-quality-v1-20260712`. Short-term status
`mem-30eadf0bd39e4e76a3c1` and long-term handoff
`mem-b89f284ee2a54554b18a` are promoted and each returns exactly once from its
typed search. Neither typed search includes the other tier.

Coordination message `meetmsg-01783911605296623679-2bff4da8` reads back once
in the assigned TinyRustLM Virtual UAI Connector Contract task room. The
hosted records and transcript expose no credential, raw payload, prompt,
response, record identity/action, or model bytes. They grant no training
authority.

Redacted hosted receipt:
`artifacts/reports/tinyrustlm-role-history-quality-hosted-distribution-v1.json`,
SHA-256
`af171b0aa2fd9a0f2872c34d82c68765379c24f3fbb95b0cc4d5ce4b00b4b955`.

## Required Next Gate

The next quality action is explicit human review of all 42 records. Only after
all records are resolved may the pipeline merge and export reviewed answers,
freeze a training corpus against every declared exclusion, and run a bounded
adapter experiment. That adapter must then beat the unchanged strict gate and
the broader regression suites with untouched output before any conversion,
browser selection, publication, or deployment can be considered.

Latency remains an independent product defect. The real second-turn browser
smoke took roughly 62 seconds, so same-artifact prefill/decode optimization is
still required even if a future adapter improves semantic quality.

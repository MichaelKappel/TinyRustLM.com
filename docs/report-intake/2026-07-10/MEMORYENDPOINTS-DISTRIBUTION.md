# MemoryEndpoints Distribution Evidence

## Route

- Service: `https://memoryendpoints.com`
- Public connector contract: `/api/matm/connector-contract`
- Public capability matrix: `/api/matm/live-capability-matrix`
- Memory submit: `/api/matm/memory-events/submit`
- Scoped search: `/api/matm/search`
- Review readback: `/api/matm/review-queue`
- Review decision: `/api/matm/review-queue/decide`
- Meeting transcript: `/api/matm/meeting-messages`
- Agent: `tinyrustlm-agent`
- Workspace: `workspace-47f4c72e6ed142f0a41d`
- Overarching project: `project-7474be75df6643b89953`
- TinyRustLM goal scope: `goal-tinyrustlm-hosted-memory`
- TinyRustLM goal room: `room-d3a35d3e963f696fd24d`
- Expansion project room: `room-0148ae1a609c2c282969`
- Protected authentication instructions: `E:/Source/Python/external-agent-codex-handoff-prompt.txt`; credential values are never copied into repository memory or evidence.

## Distribution Result

The report intake was distributed as one current short-term record and six reviewed long-term domain records. One earlier in-progress status record remains as superseded append-only audit history.

- `memoryType=status`: 1 current record plus 1 superseded audit record
- `memoryType=handoff`: 6 records
- Scope: `goal`
- Scope ID: `goal-tinyrustlm-hosted-memory`
- Batch search tag: `tinyrustlm-memory-intake-20260710`
- Final review queue: `pending=0`, `promoted=8`, `quarantined=0`, `rejected=0`
- Current-tag status readback: `visibleInSearch=true`, count `1`
- Batch status readback: count `2`, with the earlier record explicitly superseded by tag
- Handoff filtered readback: `visibleInSearch=true`, count `6`
- Status results all reported `memoryType=status`: true
- Handoff results all reported `memoryType=handoff`: true
- Status search excluded all six handoff subjects: true
- Handoff search excluded the status subject: true
- Bidirectional tier isolation: passed
- Raw credential exposure flags: false
- Raw payload exposure flags: false
- Detected review threats: 0

## Short-Term Record

| Subject | Event ID | Body hash | Review state | Search state |
|---|---|---|---|---|
| TinyRustLM hosted-memory intake current state | `mem-63b3af4bc10e45aaad19` | `ecd13bb4bb6728e003af793defcd8f322bbc787665cb2e636fe64ffb7abd5af7` | `promoted`, current tag `tinyrustlm-intake-current-v2` | `visibleInSearch=true` |
| TinyRustLM hosted-memory intake current state | `mem-3210f9bb335442d29b07` | `fd3a1a8e213d04dc3c35a124c230dcc601475055f3bdffbac66ddb1ae8f2d258` | `promoted`, superseded by `mem-63b3af4bc10e45aaad19` | `visibleInSearch=true`, audit history |

## Long-Term Records

| Domain subject | Event ID | Review ID | Body hash | Review state | Search state |
|---|---|---|---|---|---|
| TinyRustLM production deployment and relay | `mem-5be7083c306e4398829d` | `review-0a668eb44af549cc8b60` | `ee6da331b263ba96611721e75c62652baae30a585e732fa19680929f7829994c` | `promoted` | `visibleInSearch=true` |
| TinyRustLM retrieval and context packing | `mem-e1d95c5a58a5480eab2a` | `review-98a851b3f0bb44cc9428` | `39afe3d144a04d384e15400aa8fb166967c740ac080c08ca4cb07e386439877d` | `promoted` | `visibleInSearch=true` |
| TinyRustLM Rust and .NET connector | `mem-be63083a98194916aea7` | `review-894cfcdeae194eef8f2d` | `ea3ee05816b37f318aee600f52b3ca74378a7d9e7f801a4149ec943337cd306c` | `promoted` | `visibleInSearch=true` |
| TinyRustLM distributed synchronization and recovery | `mem-9a0ad9f9470344b2a861` | `review-58d992ea5fb345fd94c5` | `5e4f69eee2511e34cd6de9ea33e101c2c3d2eee43946f06cd060e54172d64f39` | `promoted` | `visibleInSearch=true` |
| TinyRustLM memory distribution and lifecycle | `mem-be75f327dfd241d0bd25` | `review-fac467d063c649f0bc35` | `8a1ebfd822a2cb7fd26421d7277c0225d2af64895c02137a0af4b155cc952959` | `promoted` | `visibleInSearch=true` |
| TinyRustLM security and threat model | `mem-444c95a4d89a47f585b9` | `review-0e19c89489db4a08b367` | `91dc3e0cc453b3563d72a15deb52aa0a0511b229f95c324605f5f8d543645763` | `promoted` | `visibleInSearch=true` |

## Review Acknowledgement Defect

The first promotion calls for retrieval, synchronization, and Rust/.NET returned `ok=true` and an operator status of `promoted`, but authoritative review-queue readback still showed those three reviews as pending with no decision timestamp or reviewer. Promoted search therefore returned only three of six handoff records.

The mismatch was reported through MemoryEndpoints itself:

- TinyRustLM goal-room defect message: `meetmsg-01783701482546712091-53722210`
- Expansion project-room defect message: `meetmsg-01783701482965783956-86a92fea`

The exact same logical decisions were retried with the exact same idempotency keys and unchanged payloads. The retry committed successfully. Review readback then reported seven promoted records and no pending records; promoted tier-filtered search returned the original status and all six handoffs. The later append-only completion status increased physical promoted history to eight while keeping one current status plus six current handoffs.

This remains a service correctness issue: a successful decision acknowledgement should bind to durable review state before returning success, or return a redacted retryable/no-op response. TinyRustLM must continue to verify review and search readback after every promotion instead of trusting the first mutation response alone.

## MemoryEndpoints Resolution

The MemoryEndpoints backend agent accepted the defect in the expansion project room. Its diagnosis was that relational backends inherited file-store review-decision behavior, so review promotion depended on whole-store load/save instead of a native row transaction. The backend fix added relational review-row conversion, relational review-queue readback, and a transaction that updates the exact review and memory rows before writing outbox and audit evidence.

- Source fix commit: `7a01328`
- Deployed source identity reported by the backend agent: `7a0132880fef03596f37cf3f9eb286cb5ad9f1db`
- Backend live proof: six public-safe handoffs promoted and read back as six promoted review rows plus six promoted search results on MySQL
- TinyRustLM post-deploy readback: all six expected handoff event IDs found, all six `reviewStatus=promoted`, current status `mem-63b3af4bc10e45aaad19` found exactly once, review queue `pending=0` and `promoted=8`, detected threats `0`, raw exposure flags false

The service defect is resolved in the deployed backend. TinyRustLM keeps the read-after-write and review-readback gate because it is still the correct distributed-systems contract.

## Evidence Boundary

- Local source report bodies remain under `docs/report-intake/2026-07-10/` as byte-exact backup.
- Hosted records contain reviewed public-safe summaries and source identities, not full report bodies.
- Local `.uai` remains the active startup continuity layer.
- Hosted search and review state are projections that must be checked after mutation.
- No `.slm` bytes, hidden prompts, raw private logs, proprietary implementation, or credential material were submitted.

# TinyRustLM Browser Memory and Notification Intake Manifest - 2026-07-12

This manifest preserves four disconnected-agent reports delivered through the TinyRustLM Improvement handoff. Two reports cover accountless browser AI memory and two cover disconnected-agent notifications. They are research input, not implementation authority. Live MemoryEndpoints contracts, current TinyRustLM source, and reproducible tests take precedence.

- Source intake: `agent-file-handoff/Improvement/`
- Durable backup: `docs/report-intake/2026-07-12/memory-connectors-and-notifications/`
- Preserved report files: 4
- Processing status: complete after checksum preservation, reviewed synthesis, TDD plan, `.uai` distribution, per-report dispositions, source cleanup, and verification
- Product boundary: optional MemoryEndpoints memory for TinyRustLM browser clients; no model bytes, credentials, hidden prompts, or private server internals
- UI boundary: the approved TinyRustLM look remains locked

## Durable Outputs

- `tinyrustlm-browser-memory-notification-synthesis-2026-07-12.md`
- `tinyrustlm-browser-memory-notification-tdd-plan-2026-07-12.md`
- `wiki/runtime-mirust/reports/tinyrustlm-browser-memory-notification-intake-memory-2026-07-12.md`

## Category Counts

- `browser-memory-connector`: 2
- `disconnected-agent-notification`: 2

## Preserved Reports

| File | Category | Bytes | SHA-256 | Source path | Durable path |
|---|---|---:|---|---|---|
| `Accountless Browser AI MATM Memory Connector.md` | `browser-memory-connector` | 35,935 | `d9a94002e830bface550afe3a50f2fe31883c191235677a52658ba4366b40849` | `agent-file-handoff/Improvement/Accountless Browser AI MATM Memory Connector.md` | `docs/report-intake/2026-07-12/memory-connectors-and-notifications/Accountless Browser AI MATM Memory Connector.md` |
| `Browser AI Memory Connector Architecture.md` | `browser-memory-connector` | 37,704 | `dd0ec1a6841dfada493998bad1979ee4c786a392721de25e4bd39a4069589fbb` | `agent-file-handoff/Improvement/Browser AI Memory Connector Architecture.md` | `docs/report-intake/2026-07-12/memory-connectors-and-notifications/Browser AI Memory Connector Architecture.md` |
| `Disconnected Agent Notification Architecture.md` | `disconnected-agent-notification` | 40,998 | `f52cc1698efcd2f42e32f68f37a9462ce83c2c6c8bf14d7eb0482d77428264ec` | `agent-file-handoff/Improvement/Disconnected Agent Notification Architecture.md` | `docs/report-intake/2026-07-12/memory-connectors-and-notifications/Disconnected Agent Notification Architecture.md` |
| `Disconnected-Agent Notifications for Self-Hosted MATM Coordination.md` | `disconnected-agent-notification` | 34,723 | `b571097d84b85c2834ec4b73eb9482d104d8126c8760c41ab6254e572b0ef5e1` | `agent-file-handoff/Improvement/Disconnected-Agent Notifications for Self-Hosted MATM Coordination.md` | `docs/report-intake/2026-07-12/memory-connectors-and-notifications/Disconnected-Agent Notifications for Self-Hosted MATM Coordination.md` |

Each source row maps to the same filename under the durable backup directory. Source and durable files were compared by byte length and SHA-256 before active-source cleanup.

## Live Contract Grounding

The intake was reviewed against live authenticated MemoryEndpoints readback rather than the reports' proposed generic APIs:

- `memoryendpoints.virtual_uai_contract.v1` reports `status=implemented`.
- The contract requires 12 records in deterministic startup order and a 64 KiB maximum per record.
- Replacing a logical record requires `expectedRevision`.
- The first-class routes are `/api/matm/uai-memory/packages`, `/api/matm/uai-memory/records`, and `/api/matm/uai-memory/startup`.
- TinyRustLM's provisioned virtual package was visible as `setup_required`, `readyForStartup=false`, with 0 of 12 active records during intake review.
- The existing `current-message` lane exposes durable items, response requirements, notification status, cursor metadata, and explicit acknowledgement.

These observations are evidence of available contracts, not evidence that the TinyRustLM browser adapter has completed the 12-record setup.

## Completion Contract

This batch is complete only when:

1. All four durable report copies match their byte lengths and SHA-256 values.
2. Every report has one ledger disposition and proof-of-use entry.
3. The synthesis distinguishes accepted findings from unsafe or obsolete suggestions.
4. The TDD plan binds each adopted behavior to a failing test and measurable exit gate.
5. Short-term `.uai` memory points to current decisions while long-term `.uai` memory points to this checksum-bound durable set.
6. No proposed OAuth, Service Worker, SSE, webhook, database, or API detail overrides the deployed MemoryEndpoints contract without separate implementation evidence.
7. Active source copies are removed only after durable verification and route checks pass.

# TinyRustLM Dogfood And Model Quality Research Manifest - 2026-07-14

This manifest preserves the twelve reports delivered through the TinyRustLM
Improvement handoff on July 14, 2026. Two independent reports cover each of six
lanes: campaign control plane, browser dogfood, MemoryEndpoints continuity,
evaluation and claims, P2P and catalog, and model distillation.

The reports are research input, not execution evidence. The human-approved
goal, current repository source, reviewed Rust contracts, exact local artifact
identities, and reproducible tests take precedence wherever a report speculates
or conflicts.

- Source intake: `agent-file-handoff/Improvement/`
- Durable backup: `docs/report-intake/2026-07-14/dogfood-quality-campaign/`
- Preserved report files: 12
- Prompt provenance: `2026-07-14-six-disconnected-dogfood-quality-research-prompts.md`
- Prompt provenance identity: 37,294 bytes; SHA-256 `908160ed55a1d49c5fc9e15b103f080a6899dad549a7707c7625a0cd218014ff`
- Prompt provenance boundary: preserved separately and not counted as report evidence
- Durable prompt route: `docs/research-prompts/2026-07-14-six-disconnected-dogfood-quality-research-prompts.md`
- Processing rule: preserve exact bytes, compare paired reports, correct claims against local authority, write tests first, route memory, verify, then remove processed active copies
- Processing status: complete; historical source identities and current durable
  identities are explicit, ledger outcomes and hot-memory routes are present,
  and active buckets are placeholder-only

## Durable Outputs

- `tinyrustlm-dogfood-quality-campaign-intake-synthesis-2026-07-14.md`
- `tinyrustlm-dogfood-quality-campaign-tdd-plan-2026-07-14.md`
- `wiki/runtime-mirust/reports/tinyrustlm-dogfood-quality-campaign-intake-memory-2026-07-14.md`

## Category Counts

- `campaign-control-plane`: 2
- `browser-dogfood`: 2
- `memory-continuity`: 2
- `evaluation-claims`: 2
- `p2p-catalog`: 2
- `model-distillation`: 2

## Preserved Inputs

| File | Source Path | Durable Path | Category | Bytes | Source SHA-256 | Durable Bytes | Durable SHA-256 |
|---|---|---|---|---:|---|---:|---|
| `Agent Continuity System Audit.md` | `agent-file-handoff/Improvement/Agent Continuity System Audit.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/Agent Continuity System Audit.md` | `memory-continuity` | 44,217 | `1262616b5ef484745abefbee0480062d8161fdb02005b166147d861412199c0c` | 44,117 | `997e392305f591822b9510974f260975fec05a828ee233966fbfa159178544fa` |
| `Browser Automation Campaign Architecture.md` | `agent-file-handoff/Improvement/Browser Automation Campaign Architecture.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/Browser Automation Campaign Architecture.md` | `browser-dogfood` | 36,451 | `08e14e018f314db96b85ea2cb7922f3b4306b8c390dee04dbfd75224a139c89a` | 36,331 | `389d9972f97b133bf64cc13bcd436f7061365d78fd5a154c496bf66f59220fcf` |
| `Evaluation philosophy and claim taxonomy.md` | `agent-file-handoff/Improvement/Evaluation philosophy and claim taxonomy.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/Evaluation philosophy and claim taxonomy.md` | `evaluation-claims` | 38,795 | `e0e323ad349a639bc3276635255a906c635b8ef741ea524a76de79fc74c40d72` | 38,619 | `463b20dd325693746ff091e778cb4c109255ebe608d2a7a626afbbdbfc0de990` |
| `LLM Evaluation System Architecture.md` | `agent-file-handoff/Improvement/LLM Evaluation System Architecture.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/LLM Evaluation System Architecture.md` | `evaluation-claims` | 58,752 | `7b37fc8c63775e2bb39f00f77232bb335924065227e1de9f161539e36d7a3a9a` | 58,540 | `8b71652162eff84596fd7c1e8b56e784bb56a1b0f7380aa98c1fa4952cbca596` |
| `P2P Fleet Architecture Design.md` | `agent-file-handoff/Improvement/P2P Fleet Architecture Design.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/P2P Fleet Architecture Design.md` | `p2p-catalog` | 48,294 | `e434228aff8b9cb92e2362a09b98c36af955c56dcb77fc2b4e47d9807c09de22` | 48,136 | `ebbb72ff47b8192ebd9a0fb2cb84155a57ce48aa3f2bd43d4aa124a8f133260f` |
| `Public Catalog Observations and Unknowns.md` | `agent-file-handoff/Improvement/Public Catalog Observations and Unknowns.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/Public Catalog Observations and Unknowns.md` | `p2p-catalog` | 32,533 | `79ccfba02550679988ef03c208ec7dd9e0f01cd345232e5fd76f80ce6be1581b` | 32,383 | `98fc04ac16a894a1248341cbcf3528e5f307fc85298a2722e9bbc001c86a0cd7` |
| `Public observation log and unavailable facts.md` | `agent-file-handoff/Improvement/Public observation log and unavailable facts.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/Public observation log and unavailable facts.md` | `memory-continuity` | 34,700 | `5ed0504ff122186ebdcd19c1d4c773934d1ea7bfa7c38187d64e4a077509b641` | 34,650 | `6880f038d1bfd9bc37853c5a8491d2b7784eb98ea4aaed5ff44c6c88049275af` |
| `Small-Model Distillation for Practical Conversation and Common Sense.md` | `agent-file-handoff/Improvement/Small-Model Distillation for Practical Conversation and Common Sense.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/Small-Model Distillation for Practical Conversation and Common Sense.md` | `model-distillation` | 39,352 | `4ee7041563c3d9787838142b98b30dd580b51337b3662d10f104c3903da98189` | 39,174 | `2dc248f1530994b5606969dfacfb5cbb89cf0c01ef76609bc5e6973fcf3a490b` |
| `Small-Model Distillation Technical Report.md` | `agent-file-handoff/Improvement/Small-Model Distillation Technical Report.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/Small-Model Distillation Technical Report.md` | `model-distillation` | 74,942 | `fcb2f7d31e59145d02715c63a1acf5877a075198f41f99a95a1757ae191992b6` | 74,694 | `25f6661e53f6239bd4e79104dc51b60b8c44949ace529409266abe31f6e0adc4` |
| `TinyRustLM Campaign Control Plane Design.md` | `agent-file-handoff/Improvement/TinyRustLM Campaign Control Plane Design.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/TinyRustLM Campaign Control Plane Design.md` | `campaign-control-plane` | 24,081 | `d61426c14e216af7ecb1f80fa8466f405f96278c4373c9caf37c61769003a53c` | 23,892 | `b769475d729f4d3dcbb7bfbf0a232519e64a4a8b16643b0c6e2248b5342e2311` |
| `TinyRustLM Observation Log.md` | `agent-file-handoff/Improvement/TinyRustLM Observation Log.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/TinyRustLM Observation Log.md` | `browser-dogfood` | 32,921 | `a6f9ee8d8b64d53288414db1347cc14719886de9453a8b4c9525b8ae6aedbf5f` | 32,739 | `d40562aaed9a5b9b89e65cda3c6ac412020e6f1890cea7d2514f766c612e2a8b` |
| `TinyRustLM Release Control Plane.md` | `agent-file-handoff/Improvement/TinyRustLM Release Control Plane.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/TinyRustLM Release Control Plane.md` | `campaign-control-plane` | 42,759 | `e93645637a2b400be4c982a8260c879b16d050a689638029ece1ef89b4425bac` | 42,587 | `96a9302b809bd9690caa33ac81fe365c2dbc5191003585caa21fbc427d7bb28e` |
| `2026-07-14-six-disconnected-dogfood-quality-research-prompts.md` | `agent-file-handoff/Improvement/2026-07-14-six-disconnected-dogfood-quality-research-prompts.md` | `docs/report-intake/2026-07-14/dogfood-quality-campaign/2026-07-14-six-disconnected-dogfood-quality-research-prompts.md` | `prompt-provenance` | 37,294 | `908160ed55a1d49c5fc9e15b103f080a6899dad549a7707c7625a0cd218014ff` | 37,294 | `908160ed55a1d49c5fc9e15b103f080a6899dad549a7707c7625a0cd218014ff` |

The source size and source hash columns preserve the intake identities already
recorded in the ledger. A 2026-07-15 audit found that Git text normalization
had changed the checked-in bytes of all twelve report bodies before this path
was protected; their current durable identities are therefore recorded
separately. Prompt provenance remained byte-identical. The original report
bytes are not reconstructed or falsely claimed to be present. The
`prompt-provenance` category is excluded from the report and paired-lane counts
so it cannot be mistaken for a thirteenth report. `.gitattributes` now protects
all `docs/report-intake/**` bodies from future normalization.

## Completion Contract

This intake batch is complete only when:

1. All twelve durable reports and prompt provenance match the listed durable
   sizes and hashes; historical source identities remain separately visible.
2. Paired findings are recorded as accepted, deferred, corrected, or rejected.
3. The TDD plan binds adopted findings to executable failure evidence.
4. Every report has exactly one disposition in `.uai/intake-outcome-ledger.uai`.
5. Hot-memory routes point to this manifest, synthesis, TDD plan, and durable memory node.
6. Active source copies are removed only after preservation, route, and ledger verification.
7. No report statement is promoted into a campaign pass, live proof, model claim, or deployment claim without a valid receipt.

# TinyRustLM MemoryEndpoints Production Deployment Memory

Date: 2026-07-10

Status: current, production-deployed, browser-verified

## Purpose

This is the durable implementation memory for the opt-in MemoryEndpoints.com connector on TinyRustLM.com. It records the deployed public package, real browser proof, locked-UI evidence, service coordination, rollback boundary, and security constraints. It supersedes same-day notes that said direct MemoryEndpoints browser CORS was blocked or that connector-enabled TinyRustLM.com deployment was still pending.

The connector remains optional. TinyRustLM continues to run user-selected `.slm` model bytes locally in Rust/WASM. Hosted memory stores public-safe summaries and references only; it is not a model host, prompt proxy, hidden inference route, or replacement for local `.uai` and Markdown memory.

## Production Result

- Public URL: `https://tinyrustlm.com/`
- Deployment ID: `20260710T173936Z`
- Successful promotion attempt: `20260710T174234Z`
- Remote document root: `/`
- Public connector route: direct browser CORS to `https://memoryendpoints.com/api/matm`
- Same-origin relay status: not deployed and not required for the proven direct-CORS path
- Model bytes uploaded: no
- Credential material deployed: no
- Rollback backups: retained for every replaced production file

The production package contains seven promoted files:

| Remote path | Bytes | SHA-256 |
| --- | ---: | --- |
| `/.htaccess` | 310 | `81bfde39ca1a25a50da1aef037241bf5746f5aba68c10d17a6295f3a9244dae1` |
| `/index.html` | 54,349 | `76f2f833082c1df0e474e20980c7278871e2fb49526c8e050a5c1cca347225d8` |
| `/app/index.html` | 54,341 | `ccae2d38661aff3a6f2cb0a08715ca334a911b025ad6e1b2e7ac4f5d972f6b28` |
| `/app/app.css` | 55,330 | `0869c58ea9851e85e68dcb7ec68b337617952ad1b0c3ee747f945cb9878657b5` |
| `/app/app.js` | 761,033 | `58caa6ba5c6bdf22853ba459e1159a10c7915a4f02bf4604a3f3a17deb41b072` |
| `/runtime/tinyrustlm.wasm` | 261,202 | `1155fa2ec9f56c06c3c658989c03f17b4ffe39f84a08c38d9b10a63b28cbea21` |
| `/runtime/tinyrustlm.wasm.manifest` | 264 | `d37e39311d4bd637e0fab25a9cf647893edd8cba520c7ab78fdb11afdf418b42` |

FTPS readback and independent HTTPS cache-busted reads matched these exact local hashes. `/app/*` now serves without the obsolete redirect to flat July 7 assets. The JavaScript cache key is `20260710-memoryendpoints-public1`.

Production guards were also read back through HTTPS:

- `/models/probe.slm`: HTTP 404
- `/.uai/index.uai`: HTTP 403
- `/agent-file-handoff/Improvement/probe.md`: HTTP 403
- `/workspace.uai`: HTTP 403

This preserves the no-project-server-model-bytes boundary and prevents repository memory/intake files from becoming public web content.

## Deployment Audit

The first promotion attempt uploaded and hash-verified all stage files but made no production promotion because the FTP server rejected a path-qualified `RNTO` with HTTP/FTP status 451. The failure report records `fail_rolled_back`; all final-file promotion flags are false.

A reversible rename probe established that this host requires a same-directory leaf name for `RNTO`. The second attempt reused the verified stages, renamed existing files to timestamped backups, promoted the seven files in dependency-safe order, switched `/index.html` last, and downloaded every final file for a second SHA-256 comparison.

Evidence:

- Failed/no-promotion audit: `artifacts/reports/tinyrustlm-production-deployment-20260710T173936Z.json`, SHA-256 `79a2e605c67ea1ba984ea622154ed2946d64bce93c66637c9a821a3e1bb0d6b8`
- Successful deployment: `artifacts/reports/tinyrustlm-production-deployment-20260710T173936Z-retry-20260710T174234Z.json`, SHA-256 `603a20dd56ea2e4294ab9f7617d33db16f65ceaad2349fe2961e8a8922caa1a3`
- Aggregate production evidence: `artifacts/reports/tinyrustlm-production-hosted-memory-verification.json`, SHA-256 `8a2ca4f93562b6161cb5c68c94a32b871b548e4820edafdb8e572af087c8df7b`

## Real Public-Browser Proof

The production browser test targeted `https://tinyrustlm.com/`, not a fixture origin or local development server. It selected a user-owned local file through the browser picker:

- File: `smollm2-135m-instruct-q8.slm`
- Bytes: 136,863,168
- SHA-256: `5d34a430eade5cd4417b23824317a0bc0f89dd99a4ee4ac02f13a5fe4abc7dc2`
- Runtime state: loaded locally in Rust/WASM

The same browser session proved:

- MemoryEndpoints is opt-in and reports `web memory connected`.
- Short-term memory submitted/searched as `memoryType=status` was found.
- Long-term memory submitted/searched as `memoryType=handoff` was found.
- Long-term search excluded the short-term marker.
- The visible model-context pill became `Web memory active`.
- Hosted memory reached the generation context.
- Real local `.slm` generation returned a nonempty response.
- `errorState=none` and the failure list was empty.
- The workspace credential did not enter localStorage.
- localStorage leak count was zero.
- 18 MemoryEndpoints requests were recorded only in redacted form.

Evidence: `artifacts/reports/tinyrustlm-production-memory-endpoints-live-smoke.json`, SHA-256 `cc301c6ef6cf7f2170a008d36d1f149a4913ba0e7701d287c28511fc42f0aabf`.

The public root contains the opt-in toggle, Web Memory Settings command, password-type workspace-key field, explicit short-term and long-term actions, hosted search, auth-header selector, and session-only secret handling. Non-secret connector settings may persist; the workspace key may not.

## Locked UI Proof

The public desktop and mobile pages were captured from TinyRustLM.com against the approved visual baseline. The comparison policy reported zero baseline failures. Manual inspection confirmed the existing dark local-AI workspace, sidebars, model strip, starter actions, generation controls, and mobile advanced panel remained coherent without overlap or unstyled fallback.

- Production visual report: `artifacts/reports/ui-lock-production/tinyrustlm-ui-lock-report.json`
- Report SHA-256: `2f2676533c071b7a4887811a30c981f4ed89ef95a7f9732b72d731eeafbaf18e`
- Desktop signature: `066f08b09a7f8c4e91592785d5ad8f360930e07daf87dc5b5cd13b7f580b2a6e`
- Desktop screenshot SHA-256: `03f625d248226f008572aa0a3de7741cfdde0fbf724c35ca39f814244abdf4f2`
- Mobile signature: `172dedd0c99849681271614e7c96c933d536f8a4de335937bfe73f708e93e0eb`
- Mobile screenshot SHA-256: `abe4327ca2c871dce0f9fcd2bbd5f1a22837eec5da887e8f5cf63f932ec250bf`

No look-and-feel redesign was part of this deployment.

## Quality Evidence Repair

The predeployment visual gate correctly failed closed because the current improved SmolLM2 q4 honest-eval sidecar no longer matched stale browser trust constants. The sidecar itself passed the real assistant-quality gate and contains improved summary, local-privacy, greeting, JSON-reason, and unseen-prompt responses.

The browser constants were synchronized to the current sidecar using the exact runtime checksum algorithm:

- Honest-eval file SHA-256: `1a893c703b925c4a874457b344330437bd1999e5f0c2c59b55836e42f994e5a6`
- Browser whole-sidecar checksum: `0xbd243a778966b07e`
- Browser eval-case evidence checksum: `0x164be6b370560627`

No gate was weakened, no canned browser answer was introduced, and no fixture assertion was changed to accept an invalid result. After synchronization, assistant-quality, prompt-card, and visual-lock browser paths passed through the real q4 Rust/WASM model.

## Test Evidence

- JavaScript syntax: app, browser smoke, visual capture, and optional relay worker passed.
- .NET package tests: 48/48.
- .NET core tests: 51/51.
- Rust MemoryEndpoints connector: 5/5.
- Rust browser harness: 8/8.
- Rust memory package: 7/7.
- Report-intake verifier: 92 durable hashed rows, zero active non-placeholder files, zero mismatches.
- SmolLM2 q4 assistant-quality gate: pass.
- Assistant-quality browser smoke: pass.
- Assistant prompt-card browser smoke: pass.
- Public-root browser modes: 10/10.
- Local exact-public-root MemoryEndpoints live smoke: pass.
- Public production MemoryEndpoints live smoke: pass.
- Public desktop/mobile visual lock: pass with zero baseline failures.
- Protected-value scan: zero exact credential hits.
- Generic credential assignment scan: zero hits.
- `git diff --check`: no whitespace errors; only expected line-ending notices.

## MemoryEndpoints Coordination

Agent and routing:

- Agent: `tinyrustlm-agent`
- Workspace: `workspace-47f4c72e6ed142f0a41d`
- Expansion project: `project-7474be75df6643b89953`
- Expansion project room: `room-0148ae1a609c2c282969`
- TinyRustLM goal: `goal-tinyrustlm-hosted-memory`
- TinyRustLM goal room: `room-d3a35d3e963f696fd24d`

The final public-safe evidence was posted and then read back from both room transcripts:

- Goal message: `meetmsg-01783708293173686051-c7455893`
- Project message: `meetmsg-01783708293599563088-a79930af`
- Goal readback count: 1
- Project readback count: 1
- Raw credential exposure: false
- Raw payload exposure: false

Coordination evidence: `artifacts/reports/tinyrustlm-memory-endpoints-production-coordination.json`, SHA-256 `4847fafb5af4d053ce397f80a94e3c1b439413fb46b57757b7b0fb345dc5c5db`.

No coordinator reply arrived during the bounded post/readback window. That is not a product blocker because the scoped messages are durable and the integration contract is independently proven.

## Security And Ownership Boundary

- Read the protected workspace credential only in process memory for an authorized request.
- Never store it in `.uai`, Markdown, JSON evidence, browser localStorage, URLs, query strings, hosted summaries, screenshots, package content, or logs.
- Persist only non-secret browser connector settings.
- Submit only public-safe summaries and references to MemoryEndpoints.
- Keep search scope and memory type explicit.
- Treat mutation acknowledgement as provisional until authenticated readback proves the durable record.
- Keep local `.uai` and durable Markdown as the offline authority and recovery source.
- Do not upload `.slm` model bytes to TinyRustLM.com or MemoryEndpoints as part of hosted memory.
- Do not deploy the optional same-origin relay unless a future policy requires it and its separate production verifier passes.

## Operational Route

Read `.uai/memory-endpoints-coordination.uai` before contacting MemoryEndpoints agents. Normal TinyRustLM work goes to the TinyRustLM goal room. Service defects and cross-project API decisions also go to the MemoryEndpoints expansion project room. The company welcome room remains dynamically discovered for initial routing.

Rollback uses the timestamped same-directory production backups retained by deployment `20260710T173936Z`. Restore only after verifying the requested backup hash and current final-file state; do not delete or overwrite backups during diagnosis.

## Current Truth

The objective represented by this connector slice is achieved in production: an internet browser can opt into MemoryEndpoints, use short-term and long-term hosted memory, inject selected hosted context into a real local `.slm` generation, and keep the credential out of persistent browser storage while TinyRustLM's approved UI remains locked.

Future retrieval-ranking, offline queue, conflict-resolution, device-sync, relay, and richer lifecycle work may improve the product, but those extensions do not negate the current production connector result and must not be misreported as prerequisites for this verified slice.

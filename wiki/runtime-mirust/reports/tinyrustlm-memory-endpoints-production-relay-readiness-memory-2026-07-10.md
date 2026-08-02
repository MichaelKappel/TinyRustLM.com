# TinyRustLM MemoryEndpoints Production Relay Readiness Memory

Date: 2026-07-10
Owner: tinyrustlm-agent
Scope: Optional hosted short-term and long-term memory for TinyRustLM.com browsers

## Current Truth

TinyRustLM's optional hosted-memory browser flow is implemented without changing the approved visual shell. The browser can use the same-origin base `/api/memoryendpoints`; the relay worker permits only `/api/matm/*`, forwards only the approved authentication and JSON/idempotency headers, applies bounded request handling, returns `Cache-Control: no-store`, and rejects model-byte routes.

The credentialed `memory-endpoints-relay-live` browser smoke has already passed through a local same-origin relay to real MemoryEndpoints.com storage. It proved short-term `status` save/search, long-term `handoff` save/search, long-search exclusion of the short-term marker, hosted-memory model context, nonempty local `.slm` generation, session-only credentials, and zero workspace-key localStorage leakage.

The production TinyRustLM.com edge route is not deployed as of this report. A redacted, credential-free probe against `https://tinyrustlm.com/api/memoryendpoints` returned `preflight_status=404`. The production verifier now records this as `status=fail_route_contract`; missing credentials cannot convert a missing route into a skipped/success result. A `404` for `/models/probe.slm` is expected rejection but does not independently prove that the relay worker is deployed.

## Readiness Artifacts

- `tinyrustlm/deploy/memory-endpoints-relay-worker.js`: deployable MATM-only relay worker.
- `tinyrustlm/deploy/memory-endpoints-relay-wrangler.toml.example`: secret-free route/configuration example for apex and `www`.
- `eng/verify-memory-endpoints-relay-production.ps1`: redacted PowerShell production contract verifier.
- `eng/verify-memory-endpoints-relay-production.sh`: redacted Bash production contract verifier with runnable Python 3 discovery and Windows `py -3` fallback.
- `tinyrustlm/tools/memory-endpoints-relay-fixture-server.js`: loopback-only in-memory contract fixture; it does not contact or impersonate production.
- `artifacts/reports/tinyrustlm-memory-endpoints-production-relay-ps-fixture.json`: PowerShell fixture proof.
- `artifacts/reports/tinyrustlm-memory-endpoints-production-relay-sh-fixture.json`: Bash fixture proof.
- `artifacts/reports/tinyrustlm-memory-endpoints-production-route-probe.json`: redacted evidence that the live route is currently absent.

Both fixture verifier reports pass registration, short-term `status` save, long-term `handoff` save, tier-filtered searches, cross-tier exclusion, protected-response `no-store`, preflight `204`, model-route rejection, and `secret_material_included=false`. These reports prove verifier and relay-contract behavior only; they are not production deployment evidence.

## Security Boundary

Workspace credentials remain session-only browser state or process-local verifier inputs. They must not be committed, placed in Wrangler configuration, URLs, localStorage, IndexedDB, JSON memory bodies, logs, screenshots, reports, or `.uai` memory. Hosted records contain public-safe summaries and durable `.uai`/Markdown references rather than raw `.uai` decks, model bytes, hidden prompts, or private logs.

The worker must retain its narrow upstream host and MATM path allowlist. It must not become a generic proxy and must continue rejecting `.slm`, `/models/`, Hugging Face artifact downloads, and arbitrary upstream URLs.

## Required Production Completion

1. Confirm the actual TinyRustLM.com DNS/CDN authority and deploy only the apex and `www` `/api/memoryendpoints/*` routes.
2. Run the credential-free production verifier probe and require preflight `204` plus model-route rejection before introducing credentials.
3. Run the credentialed production verifier and require registration, both tier saves/searches, cross-tier exclusion, and `no-store` with a redacted `status=pass` report.
4. Run the browser against the deployed same-origin route with a context-capable local `.slm` and require `Web memory active`, nonempty generation, no error state, and no credential persistence.
5. Re-run package, Rust, .NET, browser relay, browser CORS-diagnostic, secret-scan, and visual-lock gates.
6. Preserve a rollback path that removes only the edge route and leaves the existing static TinyRustLM.com interface available.

Do not mark the hosted-memory production goal complete until the deployed route and real browser path both pass. Local fixture proof and local relay-to-live-upstream proof are necessary evidence, but neither substitutes for the production route.

# MemoryEndpoints Single-Use Agent Enrollment TDD Plan

## Product Contract

TinyRustLM accepts a secret, single-use MemoryEndpoints enrollment URL. A
successful atomic claim consumes the URL permanently and returns two values the
user can retain: the canonical agreed agent name and an agent-scoped token.
TinyRustLM immediately clears the URL input and never persists, logs, displays,
or sends the URL anywhere else.

A new browser reconnects with the agent name and token. MemoryEndpoints derives
the hidden workspace binding, verifies that the token authorizes exactly that
agent, and returns the same virtual-UAIX startup package plus accepted
short-term and long-term memory state. The UI does not require workspace,
company, project, or package identifiers.

## Retry Boundary

Single use and reliable delivery are both mandatory:

- A retry with the same idempotency key is the original claim operation. It may
  recover the same claim receipt and credential result after a lost response.
- A request with a different idempotency key is a new use. Reusing the same URL
  must return a typed consumed safe no-op and must not create another agent,
  token, package, or claim receipt.
- Concurrent distinct claim operations have exactly one winner.

This distinction prevents both replay and permanent credential loss after a
server commit whose response did not reach the browser.

## No-Cheat Rules

1. The live verifier creates a fresh company and workspace for every run.
2. The invitation URL and returned tokens exist only in process memory.
3. Reports contain hashes, IDs, statuses, counts, and redaction flags, never the
   invitation URL, token, workspace key, raw package content, or prompt text.
4. The second claim uses a distinct idempotency key and the exact first URL.
5. A fixture cannot satisfy the live release gate.
6. Missing backend capability is a failed prerequisite, not a skipped pass.
7. Replay success automatically posts a public-safe defect to
   `MemoryEndpoints-Backend-Agent` and the connector task room.
8. Every company created by the verifier is closed and deleted from `finally`,
   even when invitation, claim, replay, reconnect, or restore assertions fail.
   Cleanup failure is a test failure and posts a separate public-safe defect.

## Acceptance Sequence

### E1 Contract Discovery

- Require `memoryendpoints.single_agent_enrollment_contract.v1` at live status.
- Require advertised create-company, issue-invitation, claim, reconnect,
  close-company, and delete-company routes under the same HTTPS service origin.
- Require single-use, POST-only claim, atomic one-winner, lost-response
  recovery, agent-scoped token, hidden-workspace reconnect, and virtual-UAIX
  restore flags.
- Reject unknown schema, unsafe routes, query/fragment routes, preview status,
  or exposed raw values.

### E2 Fresh Authority

- Create a new company/workspace tagged by a random test marker.
- Hold the bootstrap workspace key only in memory.
- Verify returned hierarchy IDs and redaction flags without recording the key.
- Register the new company as disposable test authority before issuing an
  invitation; the cleanup phase owns it after this point.

### E3 Invitation

- Issue exactly one invitation for a candidate TinyRustLM agent name.
- Require an opaque, expiring URL and a persisted invitation receipt.
- Hash the URL for evidence, then keep only the in-memory value needed by E4
  and E5.

### E4 First Claim

- POST the URL with a stable first-operation idempotency key.
- Require `persisted=true`, `urlConsumed=true`, one canonical agent name, one
  agent-scoped token, and one claim receipt.
- Require the canonical name to satisfy the server's agreed-name rules.

### E5 Second Claim Is Dead

- POST the byte-identical URL with a different idempotency key.
- Require HTTP 409 or 410, `ok=false`, `safeNoOp=true`, and a typed consumed
  code.
- Query the authority and prove there is still one agent, one live token, one
  package, and one original claim receipt.

### E6 Race And Lost Response

- Race at least ten distinct claim operations; exactly one may succeed.
- Drop the first successful response after server commit, then retry with the
  same idempotency key and require the same receipt and credential result.
- Retry with a new key and require consumed rejection.

### E7 Reconnect And Full Memory Restore

- Start a clean browser profile with no TinyRustLM storage.
- Supply only canonical agent name and token.
- Require exact server-derived workspace and agent binding.
- Load the 12 virtual-UAIX records in advertised startup order.
- Restore the latest accepted short-term record and every valid long-term
  pointer/search result under deterministic bounds.
- Do not claim raw transcript storage or silently promote short-term content to
  durable memory.

### E8 Negative Authority

- Reject wrong agent name, wrong workspace binding, malformed token, expired
  URL, consumed URL, revoked token, rotated token predecessor, and cross-tenant
  package/startup results.
- Token rotation preserves the same canonical agent and memory.
- Revocation blocks reconnect without deleting or exposing hosted memory.

### E9 Browser Secret Boundary

- The invitation URL, agent token, and bootstrap key must be absent from URL
  history, referrers, localStorage, IndexedDB, Cache Storage, Service Worker
  state, BroadcastChannel, logs, analytics, prompts, virtual-UAIX records,
  reports, WASM assets, and NuGet assets.
- The token is session-only by default. Persistent encrypted storage remains a
  separate explicit opt-in feature.

### E10 Disposable Company Cleanup

- Enter cleanup from `finally` whenever fresh-company creation succeeded.
- Close the company through the contract-advertised route using a stable
  cleanup idempotency key and require a redacted `closed=true` receipt.
- Attempt deletion even if closing fails, through the separately advertised
  route and a separate stable idempotency key; require `deleted=true`.
- Clear the workspace key immediately after both attempts.
- A run cannot pass unless both receipts succeed. Report closure and deletion
  separately so partial cleanup is visible.
- Post `test_company_cleanup_failed` to the backend agent and connector task
  room if either operation fails, without including the company label,
  workspace ID, workspace key, invitation URL, agent token, or response body.

## Current Live Result

`eng/verify-memory-endpoints-single-use-enrollment-live.ps1` currently returns
`blocked_contract_missing` because production
`memoryendpoints.connector_contract.v1` does not advertise
`singleAgentEnrollment` or invitation/claim/reconnect/cleanup routes. The
verifier posts this gap to the backend agent and connector task room. No company
is created in this state, so cleanup is `not_required`. It must be rerun after
the backend publishes the authoritative contract; the blocked report is not a
feature pass.

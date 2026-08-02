# 1. Public observation log and unavailable facts

MemoryEndpoints is documented only via its public website and companion docs. We reviewed the official site and API reference (MemoryEndpoints.com and MultiAgentMemory.com) and found routes for connector pairing and workspace setup, but **no explicit published API for agent enrollment or invite issuance**. Public discovery files include `/.well-known/memoryendpoints-connector` and OpenAPI specs (e.g. **[40]**, **[66]**), which cover connector pairing, workspace creation, and active-memory routes. For example, *free-account setup* (`POST /api/matm/agent-setup/free-account`) exists. The **agent invitation flow** is mentioned in the UI: the human-approved invitation URL has a fragment secret and is single-use, but no URL or JSON contract for it is listed in the public OpenAPI. The UI explicitly states the invitation is “single-use, expires, and never enters browser storage. One irreversible claim…A retry cannot issue a second credential”. We observed that after redemption the UI shows a one-time agent credential (“**Keep this private. Do not place it in prompts, logs, URLs…**”).

Many facts are **unavailable**: the actual endpoint and JSON schema for *inviting* an agent, and for *redeeming* an invite (enrollment), are not published. We found only the hint in `/api/matm/agents/register` that creation of arbitrary agents without invite yields `409 registration_requires_invite`, implying an invite-based flow, but no details. In short, **we could not locate a public “agent enrollment” contract**. We must treat that as a blocker: the precise endpoints, payloads, and responses needed for a secret invite redemption are unknown without internal API docs. We also note general policies: all API roots must use the canonical `https://memoryendpoints.com` origin (no redirects or custom ports), and JSON bodies are size-limited (requests ≤32 KiB, responses ≤64 KiB). These rules (from connector-pairing) likely apply to any enrollment API as well.

# 2. Enrollment contract schema and route requirements

**Contract version and origin.** We propose a versioned schema (e.g. `memoryendpoints.agent_enrollment.v1`) published via OpenAPI or a discovery route. Its endpoints must lie on the exact `https://memoryendpoints.com` origin (no subpaths or parameters in host, no redirects). The service should advertise routes such as:
- **`POST /api/matm/agents/enroll`** (or similar): Redeem a one-time enrollment secret. The client provides the invite secret (from URL fragment) and an idempotency key. The schema might be JSON like `{ "inviteSecret": "...", "agentDisplayName": "MyAgent" }`. All unknown JSON fields must be rejected (schemas use `additionalProperties: false` as in other MemoryEndpoints contracts).
- **`GET /api/matm/agent-setup/free-account`** and **`POST /api/matm/agent-setup/free-account`** already exist for initial workspace creation, so a workspace is assumed pre-created before agent enrollment.
- **Optional admin routes**: Possibly `POST /api/matm/agents/invite` (to issue an invitation) and `POST /api/matm/agents/revoke` or similar, but these are *not* in public docs and would require company-master credentials.

**HTTPS and content limits.** The enrollment API must require HTTPS and enforce JSON content type. Per published limits, JSON request bodies should be ≤32 KiB, responses ≤64 KiB. Clients must include an `Idempotency-Key` header for the claim request. The server should return `400` on malformed JSON or unknown fields.

**Idempotency semantics.** As indicated in the connector docs, a given `Idempotency-Key` must enforce *exact-retry* semantics: repeating the same body/key must recover the original success, while using a different key (on the same invite) yields a safe 409 conflict. In practice, the server should track the idempotency key and invite secret hash atomically (e.g. via a unique DB index). The first request that consumes the invite creates the agent; any subsequent request with *the same key* would be served the same result (with an `idempotentReplay=true` flag, for traceability). A *different* key on an already-used invite must be rejected (safe no-op) with HTTP 409 and a typed error like `enrollment_conflict` (no new agent or token). The error body should include `safeNoOp: true` and redact sensitive values, as per MemoryEndpoints error format.

**Token scope and format.** On success, the server returns JSON `{ "agentId": "...", "workspaceId": "...", "agentToken": "..." }`. The `agentId` is canonical and unique within the workspace (normalized lowercase). The `agentToken` is a short-lived or long-lived bearer token scoped to that agent: it should allow only the agent’s privileges (e.g. read/write its own memory, send messages as itself) and nothing beyond. The token binds to the workspace and agent internally; we follow the principle that the workspace/company identifier remains *hidden*, since the token implicitly encodes or references it. The response must never include any raw company-master credential or other secrets. The UI already warns not to store the token in browser storage.

**Hidden-workspace reconnect.** After enrollment, the browser must only use the `{agentId, agentToken}` pair to reconnect. The server will derive the workspace (and company) from the token’s scope. Thus the protocol should allow a client to reinitialize with just those two fields (and maybe a base URL) without needing to send workspaceId explicitly. This is analogous to how the connector pairing protocol’s discovery separates an opaque `companyRef` and only reveals it to the trusted UI.

**Cleanup and delete routes.** The contract should advertise company/workspace cleanup operations. While no public API is documented for closing or deleting a workspace, we expect admin (human) routes exist (e.g. `POST /api/matm/human/companies/{companyId}/close` and `DELETE /api/matm/companies/{companyId}` or equivalent). These must also be versioned and secured. Company closure typically suspends access, and deletion must remove all associated memory and metadata.

**Capability flags and key rotation.** The enrollment contract should reflect that an agent credential has limited capabilities (e.g. `canSearchMemory: true`, `canSubmitPublicSafeMemory: true`, but no invitation or admin rights). It should support rotation of the agent token: possibly via a connector pairing-like flow (e.g. `POST /api/matm/connector-pairings/{pairingId}/rotations`) or a dedicated “rotate key” endpoint. The contract should indicate that rotating invalidates the old token immediately. There should be an announced process for the tinyRustLM agent to refresh or revoke credentials. Importantly, **the workspace/company admin credential must never be given to the agent or browser**; only the scoped agent token is returned to the agent.

**Preview/production status and unknown fields.** Each route in the contract should have a status (e.g. implemented, preview). If fields outside the schema are sent, the server should reject with a 422 or 400 error (MemoryEndpoints schemas generally use `"additionalProperties": false`). The connector contract JSON (MemoryEndpoints.connector_pairing.v1) is published and versioned; similarly, any enrollment contract should be versioned and public before use. Without it, any client must treat the routes as unknown, per the prompt.

# 3. Atomic first-claim (transaction model)

The first-time enrollment (“claim”) must be **atomic**. Pseudocode for the DB transaction:

- **Begin transaction.**
- **Validate invite:** Check that the one-time invite (secret or ID) exists, is not expired, and is not yet consumed. (Invite secrets should be stored only as a hash.) If invalid, abort with error (e.g. 410 Gone or 404).
- **Enforce uniqueness:** Ensure no existing agent already uses this invite or requested name (unique index).
- **Create agent record:** Insert the new agent (agentId, displayName, profile) linked to workspace.
- **Generate token:** Create an agent-scoped token (high-entropy, e.g. 256-bit random, preferably hashed at rest). Store its hash and scope in the DB.
- **Mark invite consumed:** Update invite record with consumed flag and timestamp.
- **Commit transaction.**

After commit, **persist a receipt** of the operation: e.g. a redacted audit log entry with workspaceId, agentId, and idempotency key. (MemoryEndpoints patterns show audit rows store only HMACs and non-sensitive metadata.)

Once committed, the server returns a 201 response containing the canonical `agentId`, the new `agentToken`, and perhaps a JSON “receipt” object (non-secret) for client verification. The response should not include raw secrets beyond the token itself (which is already being handed out).

**Crash scenarios:** If the server process crashes **after commit but before sending a response**, the DB state already contains the new agent and invite consumed. The client must retry with the *same `Idempotency-Key`*. In that case, the server will detect the key+body match and return the originally computed result (with `idempotentReplay=true`) instead of creating a duplicate (per the idempotency rules). If the process crashed *before* commit, the transaction will roll back. A retry (same or new key) will then attempt to consume the invite again; if a different key is used, the client risks one of those requests winning and the other getting a 409. However, because we require an idempotency key, a well-behaved client uses *the same key* on retry and thus safely recovers the original result.

**Named result and receipt:** The implementation should ensure the agent’s display name is *confirmed* by the server (canonical casing, uniqueness) before committing. The server may issue a short receipt token or timestamp to acknowledge commitment. The client can use this to verify the operation.

In summary, exactly one branch can succeed: either the initial commit or on retry. Any concurrent claim on the same invite must be serialized by the database uniqueness constraint (only one can insert the agent). All other outcomes (duplicate key, duplicate token, etc.) lead to conflict errors. This ensures only one agent and token are ever created for that invite.

# 4. Replay, race, idempotency, and lost-response analysis

**Idempotent retry (same key):** If the client does not receive a response (e.g. network fault) and retries *with the same `Idempotency-Key` and identical body*, the server must return the original 201 result (agent name/token) rather than creating a second agent. We follow the pattern: “exact key/body retry returns same metadata with `idempotentReplay=true`”. The HTTP status should be 200 (OK, or possibly 201 again) with the exact same JSON payload. Clients can treat this as the acknowledged result.

**Safe-no-op on different key:** If the client retries with a *different* idempotency key while the invite has already been claimed, the server must reject. The most appropriate response is `409 Conflict` with a safe-no-op semantics (no new agent). The body should use the MemoryEndpoints error format with `ok=false`, `safeNoOp=true` and a code like `enrollment_conflict`. This is analogous to the published connector behavior: “changed reuse returns 409 `idempotency_conflict` without mutation”. The body flags (e.g. `"valuesRedacted": true`) must ensure no raw token or secret is exposed.

**Concurrent claims:** If multiple browsers or processes attempt to claim the same invite at once (e.g. due to user copying the link twice), only one can win. The DB unique constraint on the invite (or agentId) ensures atomicity. One request will commit first; the others will either see the invite is gone or hit a duplicate-key error. Those losers should get a `409` or `410` response. We recommend returning 409 with the same safe-no-op error and a flag that the invite is already used. We may include an `attemptedAgentId` in the error if helpful (though avoid leaking future info).

**Replay from another IP/browser:** Replay semantics hinge on the `Idempotency-Key`. If an attacker intercepts the key (unlikely if only in header) and tries the same request, they’d receive the same result. Without the original key, they cannot replay the exact request; if they use a new key, it fails as above.

**Expired URLs:** If an invite has an expiration time (the UI says one-time, but may also time out), then after expiry the server must return `410 Gone` or a `404` with an error code `invite_expired`. This is a typed safe-failure. The client should inform the user that the invite is no longer valid.

**Malformed URLs:** If the invite URL is malformed (e.g. missing secret fragment or invalid format), the client should error before calling the API. On the server side, a malformed request (invalid JSON schema, missing field) yields `400 Bad Request`. Sensitive hints must be redacted.

**URL leakage response:** If an invitation URL leaked (user posted it publicly), our design ensures a second claim will fail (as above). The server should not return any agent secret or credential if the invite is leaked; it simply denies after first use. The UI already removes the fragment so intermediate requests never see the secret.

**Multi-way contention:** In an extreme race (e.g. ten concurrent clients with ten idempotency keys), at most one logical operation (agent creation) will succeed. All others see 409 or similar. The server should record how many failures happened for audit (e.g. increment a counter of duplicate claims). In logs, we distinguish between “idempotentReplay” vs “idempotency_conflict” vs “invite_gone.” After one success, further attempts are always safe-no-ops with conflict.

In short, the protocol guarantees “exactly one winner” per secret invite and no hidden side-effects for retries. The published contract outlines this pattern.

# 5. Agent-scoped authentication model

Each agent token should be high-entropy and bound to exactly one agent identity. In practice, MemoryEndpoints likely uses a long random token (e.g. 256-bit) and stores only a hash at rest. The token’s *audience* is implicitly the workspace (and agent). The workspace ID and agent ID are effectively bound into the token or into its server-side record, so the token cannot be used in a different workspace or for a different agent. This achieves strong binding without exposing the workspace ID to the client.

**Least privilege:** The agent credential must be limited. For example, an agent should only get scopes such as `agent:self:submit` (submit memory on its own behalf) and `memory:search:read` (search memory). It must *not* have workspace-admin scopes (like `agent:invite` or `company:delete`). Connector pairings show a model: a connector’s grant has `canInvite=false`, `canRevokeAgentTokens=false` etc.. Similarly, an agent’s profile should have flags only for actions it genuinely needs (submit own memory, read memory, send messages). No administration routes (`/api/matm/human/...`) are allowed.

**Token lifecycle:** By default, tokens may be long-lived to avoid annoying re-logins. However, MemoryEndpoints must offer rotation. For example, there could be a device-authority or rotation endpoint (similar to `POST /api/matm/sync/devices/rotate`) to replace an old token. Upon rotation, the old token must immediately cease to work (revocation). MemoryEndpoints likely supports revocation via a “rotate” or “revoke” call; if not public, it’s a needed feature.

**Expiration and brute-force:** The contract should specify if tokens expire (e.g. after X days) or require renewal. Regardless, the token must be protected: clients should treat it as a bearer secret. It must not be guessable; ensure at least 128 bits of randomness. Rate-limiting should protect login attempts (brute-forcing a token would be met with account lockout or rate-limit). Published rates show protections: e.g. max 60 submissions/min, 120 searches/min per token (these apply per credential partition). We should require clients to honor any `429 Retry-After` for excessive use.

**Storage:** Tokens are not to be kept by default. The UI warns to “keep this [credential] private” and to store it in a secure vault. We must ensure our UI or TinyRustLM implementation does not write the token into localStorage, IndexedDB or cookies. Session-only memory (in RAM) is preferred.

**Workspace secret separation:** The **company-master credential** (workspace-level key) should never be returned to the agent. The UI’s agent setup shows only the agent token. This is critical: the workspace admin key must remain off-limits in the browser.

# 6. Short-term/long-term memory and reconnect semantics

MemoryEndpoints distinguishes *active session memory* (short-term) from *durable memory*. The published contract states **“Active records are never silently promoted into durable canonical memory; clients must submit a separate public-safe durable memory event for review.”**. In practice, this means that the current conversation or working context (short-term state) remains purely client-side until explicitly sent to the server. For continuity, the agent should periodically “publish” completed actions or summaries to MemoryEndpoints (e.g. via `/api/matm/memory-events/submit` or writing to `/api/matm/uai-memory/records`). But raw chat logs are not auto-stored.

Long-term memory in MemoryEndpoints consists of reviewed “protected memory events” (meeting transcripts, logs, wiki entries) and pointer indexes (in `long-term-memory.uai`). The UAIX model defines these structures: e.g. an agent writes “long-term pointer” records that reference knowledge DB entries. The agent’s UX should reflect that, showing retrieved memories (e.g. via `/api/matm/search` or the UAI startup query) rather than replaying raw chat.

On reconnect, the agent should rehydrate its UAIX active-memory package via `/api/matm/uai-memory/startup`. The server will return all *current* protected records and their states in deterministic order (including short-term memory state). This gives the agent its working state (“short-term-memory.uai” records) as of the last sync. Any records missing or invalid are flagged. The agent must then not pretend the package is complete if `readyForStartup` is false. Instead, it should surface a “reconnect” status to the user.

In summary, **continuity means**: after login, the agent reads the startup state; it must *not* simply re-run all past dialog locally (raw chat) because that could constitute an unapproved memory rewrite. Instead it uses the protected “startup packet” and “short-term-memory” records provided, and then proceeds. Historical decisions/knowledge can be accessed via search. This respects the rule that only consciously submitted memory (with “next action” fields, etc.) becomes part of long-term memory.

# 7. Browser secret-handling threat model

The browser front-end must treat the invite URL and token as very sensitive. Key mitigations:

- **URL fragment vs query:** The one-time invite secret is placed in the URL *fragment* (after `#`) and immediately removed by JavaScript. Per web standards, the fragment is never sent to the server. This prevents the secret from appearing in any HTTP request or logs. The UI explicitly states that invitation secrets “must never be sent in a normal page request” and removes them from the address bar. This avoids history leakage and referer leakage. (However, the fragment *can* remain in browser history if not removed; hence the UI should use `location.replace()` to clear it.)

- **Referrer policy:** The page should set `referrer: no-referrer` so that the fragment or URL is not sent as the `Referer` header if the user follows any link. The UI hint to remove the fragment also suggests a very strict referrer policy.

- **Clipboard and history:** The user is warned not to copy or screenshot the URL or credential. The UI shows only a one-time “copy credential” button and then clears it. The page does not store the token in localStorage or IndexedDB; at most in a transient JavaScript variable until the user copies it. Session-only memory (e.g. in-memory React state) is recommended.

- **Autofill/password manager:** The form fields on the page should not capture the invite secret in an HTML form (since it’s from `window.location.hash`), so password managers won’t store it. There is no actual user account form for the agent, so no autofill risk.

- **Session vs persistent storage:** The agent token (workspace key) should be handled like a session credential. By default, do not write it to `localStorage` or cookies. If the user explicitly “saves” it (beyond the UI handoff), require explicit consent. Ideally store it in session storage or memory only.

- **IndexedDB and Cache:** The page must ensure not to cache the credential JSON in any offline cache or save it in IndexedDB. Any service worker or cache manifest must exclude the enrollment route. According to UI text, the credential is only shown once and then the page is reset.

- **Service workers, BroadcastChannel, etc:** The enrollment page should not broadcast the secret to other tabs or windows. The fragment handling script should remove the secret immediately. No service worker should echo it.

- **Logs and analytics:** The application must not log the secret or token in any logs. As [67] warns, “Do not place [the credential] in prompts, logs, URLs, source code, screenshots, or ordinary chat.” Logging should only record non-sensitive success (e.g. “Agent created” with redacted IDs).

- **Crash dumps/traces:** The client should disable any crash-report that might capture the token or invite. Only generic error info should be sent.

- **Screenshots:** The UI advises the user not to screenshot the credential. It should hide the credential in the UI by default and only reveal on explicit copy.

- **Extensions:** The page can set `Content-Security-Policy` to disallow untrusted scripts. Any allowed extension (e.g. password manager) should be trusted not to snoop on the DOM at credential time. There’s limited mitigations here except minimization of exposure time.

In summary, treat the invite URL and agent token as ephemeral secrets in a single-user session. They should live only in-memory and be copied out by the user (into a safe vault). The browser should never persist them across restarts unless the user explicitly does so in a secure location.

# 8. 25-company live test protocol

We define an end-to-end “dogfood” scenario. For each of 25 runs, use unique IDs:

1. **Create workspace:** POST `/api/matm/agent-setup/free-account` with a JSON body containing distinct labels (company name, project name, workspace name). Include an `Idempotency-Key`. Expect `201 Created` with a JSON containing `companyId` and a one-time `companyMasterToken` (workspace key). Log these (redacting actual token to a hash).

2. **Invite agent:** *Undocumented.* If a public invite endpoint existed, we’d call it here with the company master token to generate a one-time agent invite URL. Since it isn’t public, assume this step is done via a helper (out of band) and yields a unique one-time URL (like `https://memoryendpoints.com/?invite=<secret>`). Record only a hash of the `<secret>` in logs for debugging.

3. **Claim agent:** In the same browser session, open the invite URL via the tinyRustLM interface or a JS script. The client should detect the invite fragment, remove it, and POST to the enrollment API (e.g. `/api/matm/agents/enroll`) with an `Idempotency-Key`. The request body includes any required fields (like desired agent display name). Expect `201 Created` with `{agentId, agentToken}`. Store these in memory (and log only the agentId and a hash of agentToken).

4. **Short-term memory write:** Using the agent token, POST a protected memory record (e.g. call `/api/matm/uai-memory/records` with a “.uai/short-term-memory.uai” record content) to simulate ongoing conversation state. Also optionally call `/api/matm/current-message` or similar. Verify responses succeed.

5. **Simulate browser loss:** End the session (simulate browser close). The workspace remains running.

6. **Reconnect:** In a new browser, input the `workspaceId, agentId` and provide the `agentToken` as authorization header (as TinyRustLM UI does). Call `/api/matm/uai-memory/startup` with these credentials. The server should return the short-term memory packet (the record submitted) and any long-term pointer records deterministically. Confirm the startup record order is complete (`readyForStartup: true`).

7. **Persistence check:** Perform a memory fetch (e.g. GET `/api/matm/uai-memory/records` filtered by agent and path) and verify the previous record is present. Ensure no new records were added inadvertently on startup.

8. **Duplicate claim attempt:** Try to use the *same invite URL* again with a different `Idempotency-Key`. It must fail (HTTP 409 or 410). Confirm the error indicates the invite is consumed.

9. **Cross-tenant attempt:** Generate a fake workspace/agent pair and try to use a valid token (should 403). Try correct agent with wrong token (should 401/403).

10. **Close and delete workspace:** Use admin credentials (assuming we have them) to close the workspace and then delete it (e.g. `DELETE /api/matm/companies/{companyId}`). Verify that subsequent GETs on that company or workspace return 404.

11. **Audit and cleanup verification:** After deletion, attempt to access any remaining memory or agent endpoints under that workspace. They should fail closed (404 or 403). Confirm that no leftover artifacts (records, agents) exist by trying a workspace search or company listing (if available).

All identity strings in logs should be replaced with redacted hashes. Each API call should use a fresh `Idempotency-Key`. The test report should note any idempotency or conflict errors.

# 9. Cleanup and orphan-recovery procedure

Any failure in the above steps should trigger a cleanup attempt. In code this means using a `finally` block: e.g. always call “close” and “delete” for the company, even if enroll or write steps failed. If closing fails (e.g. network error), retry it independently, possibly exponentially.

If a workspace cannot be deleted (e.g. foreign key constraints or partial failure), it becomes an *orphan*. We should detect orphans by listing companies via a supervisor admin API (not public; assume it exists) or by tracking which IDs we intended to delete. Orphans should trigger an alert to operations.

Retention policies: human-only history (audit logs, review logs) is purged after 7 days, so we do not expect data to linger beyond that. But memory records may have longer retention (not specified here).

If deletion of a company fails (e.g. some records remain locked), the tool should log a public-safe defect report: “Cleanup failed for workspace XYZ. Please check audit logs.” This report (no private info) can be emailed to the dev team. Do not expose credentials or internal IDs.

# 10. Cross-agent coordination and evidence protocol

TinyRustLM (the agent application) and the MemoryEndpoints backend must coordinate on shared memory usage via public APIs. Communication is typically through MemoryEndpoints’s multi-agent routes:

- **Room/task routing:** Agents can create virtual “meeting rooms” or tasks using `POST /api/matm/meeting-rooms` and message each other with `/api/matm/meeting-messages` or `/api/matm/agent-messages`. These are not elaborated in the given spec, but UAIX envisions structured agent communication. The agent should publish progress or tasks into MemoryEndpoints (e.g. `progress.uai` records) instead of direct pass-through.

- **Acks and retries:** When TinyRustLM writes to MemoryEndpoints (memory submit or records), it should record the “receipt” URLs or IDs returned. On reconnect, the agent can verify these receipts via GET endpoints (e.g. `/api/matm/receipts`). Missing receipts after a crash can be retried by replaying the submit (same idempotency key).

- **Stale credentials:** If the agent token is missing or invalid (server returns 401 or 403 on reconnect), the app should treat it as an unrecoverable error: the user must enroll again. The protocol should not silently catch this (fail-closed). A user-facing error “Invalid or revoked token” is appropriate.

- **Blocked execution without contract:** If MemoryEndpoints does not publish an official contract (for invites, etc.), TinyRustLM cannot implement enrollment. In that case, local development can mock the API (a fixture), but the live gate is blocked. The protocol must fail out or disable features if the real contract is missing.

In all agent-backend messages, the agent should include evidence fields like `canReadOnlyPublicSafeMemory: true` as in connector grants. Any critical state changes (like enrollment) should be accompanied by audit logs. The agent and backend should use consistent room IDs/task IDs so that any message chain can be followed in logs. MemoryEndpoints’s audit log (`/api/matm/audit-log`) is forbidden to agents, but webhook-style receipts (e.g. POST callbacks or Sync receipts) could serve as evidence of actions (not covered by the public API, but implied by “sync/receipts”).

# 11. TDD matrix (fixture to production)

| Test Stage      | Scenario                                     | Fixture Setup                                     | Live Test                                     |
|-----------------|----------------------------------------------|---------------------------------------------------|-----------------------------------------------|
| **Workspace Setup** | Create free workspace                     | Call `POST /agent-setup/free-account` against a local mock or stub memoryendpoints. Expect a unique company ID and one-time token. Use idempotency key. Verify no duplicate workspace on retry (err 409 or same result). | Same call against memoryendpoints.com. Verify 201 and new workspace ID. Check idempotent retry behavior. |
| **Invite Issuance**| Invite agent to workspace                  | *Not publicly documented* – simulate by generating a mock invite secret. | *N/A if no public API.* (Manual step or dev fixture.) |
| **Enrollment Claim**| Redeem one-time invite with TinyRustLM     | POST to mock `/agents/enroll` endpoint with invite secret and key. On first try, expect 201 with agentId & token. On exact retry (same key), expect same result. On new key, expect 409. | Do the above against memoryendpoints.com’s (unknown) enrollment URL. Validate one agent created. (Blocker if no endpoint.) |
| **Memory Write/Read**| Short-term memory submission             | Use mock `/uai-memory/records` to submit a record. Check GET returns it. | Same with real API. Verify record appears. |
| **Reconnect Agent** | Use saved agentToken on new “browser”    | Simulate fresh client: call mock `/uai-memory/startup` with agentId & token. Expect previous state returned. | Same call to production. Check startup returns correct short-term records. |
| **Replay Rejection** | Reuse invite URL after use               | After first claim, POST again with same secret (diff key). Expect 409 or 410. | On production, confirm invite is single-use: second claim fails. |
| **Token misuse**  | Wrong token or agent pairing               | Swap agentId/token pairs; expect 403. | Real test: use agentToken on wrong workspace or wrong agentId; should fail. |
| **Close/Delete**  | End and remove workspace                  | Mock call to close/delete endpoints (if exist). | Live: call human/admin APIs to close and delete workspace. Then GET workspace should 404. |
| **Cleanup check** | Orphan discovery                          | List remaining test companies on fixture (should be none). | After each run, query MemoryEndpoints (if possible) to confirm deletion. |

Each test uses new unique IDs (e.g. UUIDs) and idempotency keys. Reports should log only non-sensitive results (use hashes or omit token values). Any discrepancy (unexpected error or behavior) fails the test. Note: Many steps depend on a public enroll API; if absent, tests must skip or fail.

# 12. Implementation blockers

**Missing invite API:** The biggest blocker is that MemoryEndpoints has *no public invite/enrollment endpoint*. The docs show `/api/matm/agents/register` only handles connector self-registration, not human-issued invites. We need the exact endpoint, method, and schema for redeeming the one-time URL. Without it, the agent cannot complete enrollment.

**Contract discovery:** The service must advertise the enrollment contract (e.g. via OpenAPI or a discovery file) so clients know where to call and what payload to send. This is currently absent.

**Cleanup API:** Similarly, endpoints for closing/deleting a workspace/company are not documented publicly. We would need them to automate deletion.

**Token rotation:** There is no published rotation flow for agent tokens (like `/sync/devices/rotate` for devices). Without it, lost or leaked agent tokens cannot be rotated.

**Memory queries:** While many memory routes are documented, it’s unclear if there’s an index or summary route that lists all packages for a workspace (to detect orphans). If none, we need either a broad GET or an admin list.

In summary, we have no concrete contract for enrollment or cleanup; these must be provided by MemoryEndpoints. We can only design around the partial clues in [40], [66] and the UI.

# 13. Sources

- MemoryEndpoints agent setup UI and docs (MemoryEndpoints.com), accessed July 14 2026: *Agent Setup* page (enrollment UI and warnings), *Home/Docs* pages (API references).
- MultiAgentMemory.com API reference, accessed July 2026: connector pairing and memory API docs, including idempotency and size limits.
- Multi-Agent-Memory GitHub (MichaelKappel/Multi-Agent-Memory, 2026): `api-contract.md` describing agent/register, connector pairing flows.
- MemoryEndpoints OpenAPI (https://memoryendpoints.com/api/matm/openapi.json): schemas for `/agents/register` and memory package/records.
- UAIX documentation (uaix.org, 2025): AI memory spec (referenced in [60]).
- MDN Web Docs, *URI Fragment* (accessed July 2026): “The fragment is not sent to the server”.
- MemoryEndpoints llms.txt (LLM for discovery, July 2026): route summary including human history purge after 7 days.

Each source was the latest available as of mid-2026 and is cited above with access context.
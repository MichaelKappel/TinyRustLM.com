# TinyRustLM Browser Memory and Notification TDD Plan

## Scope

This plan covers the optional database-backed UAIX active-memory exception and dependable disconnected-agent check-ins. It extends the existing MemoryEndpoints distributed-sync tests. It does not replace local `.uai` memory for clients with a durable filesystem, does not expose MemoryEndpoints internals, and does not redesign the locked UI.

## Global No-Cheat Rules

1. Add the failing test before implementation.
2. Use live or contract-faithful fixtures; do not hard-code success responses.
3. Never persist credentials to satisfy restart tests.
4. Never report synchronization without an authoritative receipt and readback.
5. Never auto-resolve revision conflicts merely to make convergence tests pass.
6. Never weaken redaction, prompt-injection, tenant, size, or exact-field validation.
7. Never make SSE, WebSocket, Service Worker, or a callback the only durable delivery path.
8. Preserve raw failed evidence and the locked UI.

## I0: Intake Integrity

### Tests first

- `I0-001 source-copy-sha256`: all four report bytes and hashes match the manifest.
- `I0-002 one-disposition-per-report`: all four sources have one ledger outcome and proof of use.
- `I0-003 memory-route-resolution`: short-term and long-term `.uai` pointers resolve; the wiki checksum matches.
- `I0-004 active-bucket-clean`: processed sources are removed only after preservation passes.
- `I0-005 research-is-not-runtime-proof`: report API examples cannot satisfy implementation evidence.

### Exit gate

Four durable matches, four dispositions, zero broken routes, and placeholder-only active intake.

## M1: Live Virtual-UAIX Contract

### Tests first

- `M1-001 exact-contract-schema`: accept only `memoryendpoints.virtual_uai_contract.v1` at implemented status.
- `M1-002 exact-routes`: require first-class package/record/startup routes and reject invented or missing routes.
- `M1-003 twelve-required-records`: require 12 unique logical paths and exact startup order.
- `M1-004 record-size-limit`: enforce the advertised 64 KiB maximum before network send.
- `M1-005 validation-flags`: require public-safe, secret-marker, prompt-injection, and optimistic-concurrency claims.
- `M1-006 exposure-flags`: any raw credential or raw payload exposure flag fails closed.
- `M1-007 unknown-field-policy`: schema drift produces a typed unsupported-contract error.

### Exit gate

Rust, C#, and browser parse one shared fixture identically and reject every mutated negative fixture.

## M2: Stable Identity and Credential Boundary

### Tests first

- `M2-001 workspace-scoped-agent-name`: agent ID and agreed name persist as non-secret workspace metadata.
- `M2-002 separate-device-session-ids`: device and tab/session identities never replace the stable agent identity.
- `M2-003 registration-readback`: package use begins only after exact agent ID/name binding is confirmed.
- `M2-004 lost-local-identity`: cleared browser metadata requires authenticated recovery/rebind; no silent new identity.
- `M2-005 session-only-default`: reload clears the workspace key while keeping non-secret settings.
- `M2-006 no-secret-persistence`: localStorage, IndexedDB, BroadcastChannel, URL, prompt, console, reports, WASM, and packages contain no key.
- `M2-007 encrypted-remember-opt-in`: optional remembered ciphertext cannot unlock without a user-held secret and is disabled by default.
- `M2-008 logout-and-rotation`: rotation invalidates auth context and logout clears session authority without fabricating remote deletion.

### Exit gate

Identity recovers deterministically and secret scans find zero credential copies.

## M3: Package Setup and Startup

### Tests first

- `M3-001 setup-required-at-zero`: a 0/12 package remains `setup_required` and cannot produce active context.
- `M3-002 one-record-per-write`: create each logical record independently with exact required content fields.
- `M3-003 deterministic-startup-packet`: startup packet enumerates the same 12 paths in contract order.
- `M3-004 post-write-confirmation`: every write verifies persisted, visible-to-sender, IDs, path, revision, and content hash.
- `M3-005 startup-completeness`: startup activates only at 12/12 valid records.
- `M3-006 missing-invalid-record`: missing, duplicated, oversized, unknown, or invalid required records fail closed.
- `M3-007 date-free-hot-content`: hot records reject chronological log dumps and secret-like material.
- `M3-008 long-term-pointer-only`: long-term record points to reviewed memory/knowledge routes and does not copy raw history.
- `M3-009 no-silent-promotion`: active record writes cannot promote durable memory without a separate reviewed event.

### Exit gate

Fresh setup reaches ready status only after exact readback of all 12 records.

## M4: Revision Updates and Conflict UX

### Tests first

- `M4-001 expectedRevision-required`: replacing a record without `expectedRevision` fails locally.
- `M4-002 stale-revision-blocked`: stale writes produce a typed conflict and preserve both candidate identities.
- `M4-003 no-last-write-wins`: no code path silently overwrites the hosted head.
- `M4-004 protected-role-no-auto-merge`: identity, maintenance, totem, taboo, talisman, and persona content require review.
- `M4-005 reviewed-rebase`: a replacement rebased on the current revision receives a new authoritative readback.
- `M4-006 multi-device-race`: concurrent devices expose the loser as conflict rather than hidden convergence.
- `M4-007 conflict-ui-lock`: conflict controls stay inside the existing advanced memory surface and preserve visual baselines.

### Exit gate

All stale-parent paths remain explicit, reversible, and receipt-bound.

## M5: Offline, Restart, and Multi-Tab

### Tests first

- `M5-001 saved-local-not-synced`: offline write displays `saved locally; synchronization pending`.
- `M5-002 stable-outbox-identity`: retries preserve event ID, hash, idempotency key, and expected parent.
- `M5-003 pull-before-push`: reconnect applies authoritative startup/revision state before sending queued writes.
- `M5-004 receipt-recovery`: timeout after server acceptance recovers by receipt lookup rather than duplicate mutation.
- `M5-005 web-lock-single-writer`: three tabs produce one network writer.
- `M5-006 broadcast-body-free`: follower notices contain no record body or credential.
- `M5-007 leader-loss-takeover`: a follower safely resumes from persisted state.
- `M5-008 indexeddb-loss`: authenticated startup reconstructs hosted active memory after local eviction.
- `M5-009 private-mode-warning`: volatile storage is explicit and does not claim durable local recovery.

### Exit gate

Offline/restart/multi-tab tests pass without duplicate writes, hidden conflicts, or credentials at rest.

## N1: Durable Current-Message Polling

### Tests first

- `N1-001 cursor-monotonicity`: commit the cursor only after items are validated and stored.
- `N1-002 bounded-pagination`: drain `hasMore` pages under hard item, byte, and time limits.
- `N1-003 adaptive-backoff`: activity reduces polling delay; idle and failures increase it with jitter and ceilings.
- `N1-004 reconnect-catchup`: missed signals recover every retained item after the durable cursor.
- `N1-005 cursor-reset-required`: retention gaps trigger full state/routing resync, never guessed completion.
- `N1-006 duplicate-event-id`: duplicate delivery is idempotent and conflicting duplicate content is quarantined.
- `N1-007 target-and-scope`: items for another target, workspace, or route fail closed.
- `N1-008 safe-summary-only`: no raw credential, raw payload, hidden prompt, or model content enters notification storage.

### Exit gate

Polling alone provides complete dependable check-in behavior while the browser is open.

## N2: Response and Acknowledgement Semantics

### Tests first

- `N2-001 viewed-vs-response-required`: viewed acknowledgement does not satisfy `responseRequired`.
- `N2-002 routed-response-evidence`: a required response is posted to the assigned meeting room and read back before ack.
- `N2-003 idempotent-ack`: duplicate acknowledgements return the same completed state.
- `N2-004 lost-ack-response`: a committed ack with a dropped response is recovered without repeating substantive work.
- `N2-005 stale-unread-reconciliation`: already-evidenced responses can reconcile old unread notifications without reposting.
- `N2-006 quarantine-malformed`: malformed or poison items cannot crash the check-in loop.
- `N2-007 per-device-visibility`: personal coordination remains visible across the agent's devices unless explicitly claimable work says otherwise.

### Exit gate

No required response is silently dismissed and no completed response is duplicated.

## N3: Optional Real-Time Hint Channel

### Tests first

- `N3-001 hint-has-no-work-body`: SSE or long-poll hint carries only head/cursor metadata.
- `N3-002 hint-channel-not-authority`: dropping every hint still passes cursor catch-up.
- `N3-003 reconnect-last-event-id`: stream resumption triggers authoritative pull and never skips inbox sequence.
- `N3-004 proxy-timeout-fallback`: stream failure falls back to adaptive polling.
- `N3-005 no-url-bearer`: stream URLs, logs, and referrers never contain workspace credentials.
- `N3-006 measured-need-gate`: SSE implementation is deferred unless polling latency or load misses a declared budget.

### Exit gate

Hints improve measured latency without changing durability or credential boundaries.

## S1: Security and Retrieval

### Tests first

- `S1-001 exact-origin-cors-and-csp`
- `S1-002 tenant-agent-binding-negative-cases`
- `S1-003 prompt-injection-marker-rejection`
- `S1-004 retrieved-context-untrusted-guard`
- `S1-005 bounded-context-and-deterministic-ranking`
- `S1-006 extension-and-xss-boundary-documentation`
- `S1-007 no-service-worker-secrecy-claim`
- `S1-008 hard-forget-honesty`
- `S1-009 redacted-diagnostics-and-receipts`

### Exit gate

Security claims match what the browser and live service can actually prove.

## Cross-Language and Browser Matrix

The shared deterministic contract must be exercised in:

- Rust unit and fixture tests;
- C# wrapper and clean NuGet consumer tests;
- browser unit tests for IndexedDB, identity, records, startup, conflicts, and polling;
- public Chromium/Edge, Firefox, and Safari tests where supported;
- offline, restart, three-tab, two-device, revoked-device, rotated-key, stale-cursor, and lost-storage scenarios;
- desktop and mobile visual-lock screenshots.

## First Executable Slice

Implement in this order:

1. Strict contract parsing and shared fixtures.
2. Read-only package and startup inspection.
3. Workspace-scoped agent name persistence and binding readback.
4. Test-generated 12-record setup and exact startup activation.
5. Expected-revision updates and conflict state.
6. Durable `current-message` cursor polling and response-required acknowledgement.
7. Cross-browser restart, multi-tab, and reconnect proof.
8. Optional SSE hints only after a measured need.

No step may claim completion from a fixture alone when a live service route is required.

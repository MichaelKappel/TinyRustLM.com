# Accountless Browser AI MATM Memory Connector

## Executive conclusion

A secure **optional MATM memory connector** for a browser-only AI is feasible, but only if it is designed around one hard fact: in a browser, **no client-side storage mechanism can be treated as a safe long-term secret vault**, and **no background runtime is reliable enough to be the sole continuity mechanism**. Current browser guidance and the current OAuth guidance for browser-based applications both point in the same direction: keep sensitive tokens out of JavaScript-visible persistent storage when possible, prefer the most isolated architecture available, and treat local caches as recoverable working copies rather than a security boundary. Meanwhile, current UAIX guidance is explicit that hot `.uai` memory remains the compact first-load continuity layer, and durable memory systems such as MATM remain background until reviewed and promoted into current authority. citeturn28view0turn29view0turn30view0turn33view0turn34view2

For this use case, I recommend a **hybrid, local-first but server-backed architecture**: keep a compact **local active bundle** in IndexedDB for outage tolerance and offline usefulness; keep **authoritative cross-device active state** in the external MATM service; use a **stable agent ID plus server-enforced namespace isolation**; coordinate duplicate tabs with **Web Locks** and **BroadcastChannel**; and default to **session-only token handling** with optional user-consented “remember on this device” mode that stores only **encrypted token material** and never raw secrets. Because current browser and OAuth guidance does not support strong claims that browser persistence can fully protect secrets from XSS or filesystem theft, the connector should treat persistent token storage as a user-risk tradeoff, not a transparent default. citeturn19search0turn19search1turn28view0turn29view2turn30view0turn11search2

The most important modeling choice is to **avoid creating two separate concepts called “active memory” and “short-term memory.”** Current UAIX guidance increasingly describes hot `.uai` memory as a **typed, date-free current-state layer** and durable MATM memory as a **pointer-backed, review-gated background layer**. In database terms, the right abstraction is a single **Active State domain** with retention policies and supporting logs, not two overlapping stores with nearly identical semantics. citeturn33view0turn33view1turn34view2turn25view0turn25view1

## UAIX semantics and the minimum database record model

Current UAIX material consistently treats `.uai` files as **bounded typed memory records** that belong to a declared package scope, are read in a defined order, and are updated through reviewed changes rather than raw chat accumulation. Recent UAIX pages also emphasize that hot `.uai` records are **current-state memory only**, should remain **date-free**, and should continue to work even when a durable memory system is unavailable. The startup packet acts as the active read-order index, `progress.uai` carries reviewed current status, `receiver-brief.uai` defines what the next actor is receiving and what is blocked, `next-actions.uai` captures ordered next steps, and `next-recursive-prompt.uai` is explicitly a **derived** resume artifact rather than a second source of truth. citeturn33view0turn33view1turn8search0turn25view0turn25view1turn9view1

UAIX also still exposes `short-term-memory.uai` as a current working-truth surface in some public text, but the newer wizard and package guidance place more weight on the **typed hot `.uai` set**—especially `startup-packet.uai`, `progress.uai`, `decisions.uai`, `next-actions.uai`, `receiver-brief.uai`, and `long-term-memory.uai` as a pointer ledger. That means the safest interpretation for a database-backed connector is not “one row per file” and not “pretend the database is a filesystem,” but rather “preserve the **semantics** of typed current-state records, review status, authority boundaries, read order, and promotion rules.” citeturn2view1turn33view1turn34view2turn24search5turn24search7

The **minimum recommended database record model** is therefore seven logical record types:

- **Governing instructions**: the authoritative operating rules for lifecycle, safety policy, read-order policy, protected anchors, tool/action constraints, and promotion rules. This is the database analog of `memory-maintenance.uai`, the default instruction anchors, and active hard constraints. It should be treated as privileged state, versioned, rarely changed, and never auto-merged. citeturn9view0turn5view2turn24search4  
- **Agent identity**: stable agent ID, agreed display name, namespace, tenant boundary, actor boundary, declared authority, and sharing boundary. This maps directly to the role of `identity.uai`, which current UAIX guidance describes as naming the package, owner, source authority, namespace, sensitivity boundary, and actor boundary. citeturn6view0turn6view2  
- **Active state**: one current record for the live objective and continuity bundle. This record should hold the active objective, current focus, blockers, ordered next actions, recent verified changes, unresolved risk references, “pause reason / resume condition,” and the current recovery pointer set. This is the single non-redundant home for what many systems ambiguously split into “active” versus “short-term” memory. Its job is to be startup-continuity truth, not a historical log. citeturn24search14turn25view0turn33view1  
- **Decision log**: append-only durable decisions with effect, boundary, source, review status, and supersession links. This matches UAIX’s treatment of `decisions.uai` as durable decisions rather than all intermediate discussion. citeturn5view4turn24search7  
- **Issue and risk log**: unresolved questions, blockers, risks, escalations, and no-op triggers, with owner and review route. Current UAIX guidance uses `open-questions.uai` and, in the file matrix, a `risk-register.uai` for unresolved decisions, risks, and owner questions. citeturn5view1turn24search1  
- **Handoff record**: what the next agent or session is receiving, what is expected, what is blocked, what must be checked first, and where to report back. This is the semantic role of `receiver-brief.uai`; it should be a distinct record because handoff semantics are not the same as the steady-state objective. citeturn25view1  
- **Recovery pointer ledger**: checkpoint references, startup packet revision, receipt references, durable-memory endpoints, and other recovery routes. Current UAIX guidance is explicit that long-term memory records should be **pointer-only**, especially for MATM endpoint configuration. citeturn34view2turn34view3

That model preserves UAIX meaning without claiming that a row *is* a file. The database becomes the **authoritative record substrate**; a UAIX package, when needed, becomes a **projection/export format** generated from those records. That keeps the semantics intact while avoiding filesystem theater. citeturn33view1turn34view2turn26search9

## Recommended connector architecture

The recommended connector is a **capability-isolated browser adapter** with four layers: a UI layer, a same-origin worker layer, a local cache layer, and a remote MATM layer. The UI never handles raw durable-memory credentials after initial configuration if the worker can take custody; the worker owns fetch mediation, outbox replay, and token presentation; IndexedDB holds the local cache and offline mutation queue; and the remote MATM service holds the authoritative shared state for cross-device continuity. This design follows the current browser/OAuth guidance that workers can improve token isolation relative to the main window, while also respecting the fact that neither workers nor browser storage fully defeat malicious code that can run in the origin. citeturn29view0turn29view2turn30view0

A **service worker** is useful here, but only for request mediation and offline support. It should **not** be treated as reliable background execution. MDN and Chrome guidance are clear that service workers can be stopped when idle, pages can be frozen or discarded, periodic background sync is limited in browser support, and background behavior depends on browser intervention. So the right mental model is “wake when needed,” not “always-on broker.” The connector should therefore persist enough local active state to survive the loss of worker state, and it should rehydrate quickly on the next foreground interaction. citeturn13search1turn13search8turn13search10turn12search1turn12search10

The remote MATM side should be modeled as **optional durable shared memory**, not as a replacement for the local continuity layer. That matches UAIX’s current split-memory posture: hot `.uai` memory remains the first-load continuity layer and should still function when long-term memory is unavailable; MATM is an authenticated mid-term and long-term background layer whose contents remain background until reviewed and promoted. That principle carries over cleanly to the browser connector: the local bundle is the outage-resilient recovery image; the MATM store is the cross-device and cross-session memory plane. citeturn33view0turn34view2turn34view3

A concrete connector manifest can look like this:

```json
{
  "version": "1.0",
  "connector": {
    "enabled": true,
    "provider": "external-matm",
    "label": "Example MATM",
    "base_url": "https://memory.example.com",
    "documentation_url": "https://memory.example.com/docs",
    "endpoints": {
      "save": "/v1/memory/save",
      "retrieve": "/v1/memory/retrieve",
      "search": "/v1/memory/search",
      "update": "/v1/memory/update",
      "supersede": "/v1/memory/supersede",
      "expire": "/v1/memory/expire",
      "promote": "/v1/memory/promote",
      "distribute": "/v1/memory/distribute",
      "acknowledge": "/v1/memory/acknowledge",
      "current_message": "/v1/memory/current-message",
      "redacted_receipt": "/v1/memory/receipt"
    },
    "auth": {
      "mode": "oauth_pkce",
      "token_persistence": "session_only",
      "dpop": true,
      "scopes": [
        "memory.read",
        "memory.write",
        "memory.search",
        "memory.ack"
      ]
    },
    "agent": {
      "stable_agent_id": "agt_01JYQ6X8P4X4S7R4K7M1R0N2V5",
      "display_name": "Atlas",
      "tenant_id": "tenant_acme",
      "namespace": "tenant_acme/agents/agt_01JYQ6X8P4X4S7R4K7M1R0N2V5"
    },
    "local_cache": {
      "active_bundle_store": "indexeddb",
      "outbox_store": "indexeddb",
      "receipt_store": "opfs_optional",
      "persist_requested": true
    }
  }
}
```

This shape intentionally mirrors current UAIX MATM pointer-ledger expectations, which call for update, search, current-message, acknowledgement, optional redacted receipt, documentation, and credential-storage fields, while keeping credentials outside the package itself. citeturn34view0turn34view2turn34view3

## Browser storage and security boundary

For this connector, **IndexedDB should be the default local store** for structured active-state caches, revision metadata, outbox entries, and non-secret receipts. MDN notes that IndexedDB is the browser’s standard larger client-side object store, works asynchronously, and in privacy modes is typically only in-memory until the private session closes. The OAuth browser-app guidance also notes that IndexedDB is shared across tabs and between browsing contexts and service workers, which is useful for continuity but means it is **not** an isolation boundary for secrets. citeturn10search5turn10search9turn30view0

**OPFS should be optional, not foundational.** It is useful for larger local artifacts such as encrypted receipts, frozen export bundles, or large redacted search snapshots, but it remains origin-partitioned browser storage under quota/eviction rules, is deleted with site data, and WebKit notes that it is unavailable in Safari Private Browsing. That makes OPFS a good supplement for bulk local artifacts, not the sole continuity layer for an accountless browser AI. citeturn10search0turn10search2turn23search10turn10search1

**localStorage and sessionStorage should not be used for tokens.** MDN documents that `localStorage` is persistent across browser sessions and shared by origin, while `sessionStorage` is tab-scoped. OWASP is more direct: do not store authentication tokens, session IDs, JWTs, refresh tokens, or similar credentials in localStorage or sessionStorage because any JavaScript running in the origin can read them. If the connector must remember anything sensitive on-device, it should remember only **ciphertext** and require a user action to unlock it. citeturn11search7turn11search5turn11search8turn11search2

**Web Crypto helps, but only within limits.** Non-extractable `CryptoKey` objects and IndexedDB persistence of keys can reduce straightforward exfiltration, and OWASP explicitly allows encrypted IndexedDB only when the key is not itself recoverable from the browser—for example, a user-supplied passphrase or a non-extractable key. But the current OAuth browser-app draft is equally explicit that browser standards do not guarantee that non-exportable keys are truly protected from underlying filesystem theft, and filesystem malware remains out of scope for the web app to prevent. So Web Crypto should be used to reduce risk, not to claim full secret safety. citeturn15search0turn15search1turn15search4turn30view0

The connector should therefore draw a hard storage boundary.

**Safe to cache locally**: reviewed active-state summaries; ordered next actions; unresolved risk summaries; decision receipts; handoff stubs; ETags and revisions; encrypted offline outbox payloads; the stable agent ID and public metadata; DPoP public key material; non-sensitive documentation pointers; and any MATM pointer-ledger metadata that current UAIX already treats as non-secret route information. citeturn34view2turn34view3turn31search2turn31search3

**Must never appear in JavaScript bundles, HTML templates, URLs, query strings, fragments, source maps, logs, telemetry, or model prompts**: raw access tokens, refresh tokens, PATs, client secrets, session cookies, one-time codes, password equivalents, and any data whose disclosure would grant the AI or another party additional authority. Current UAIX guidance says credentials are not memory and must never print passwords, tokens, keys, cookies, or one-time secrets; OAuth security guidance documents leakage risks through browser history and `Referer`; and OWASP’s MCP and LLM guidance warns that secrets in model memory, prompts, or protocol logs are retrieval risks. citeturn33view0turn21search0turn21search1turn21search2turn35search14turn35search2

The hosting origin should also be hardened. The memory API must use **HTTPS only**; CORS should allow only the exact application origin; CSP should strictly limit script and connection sources; and the app should ideally be deployed as a **single application per origin**, because current OAuth browser-app guidance explicitly recommends one application per origin and notes that this simplifies correct use of origin-based browser protections, CORS, and CSP. citeturn14search14turn14search0turn14search2turn21search18turn30view0

Cross-origin isolation is **optional hardening, not a baseline requirement**. MDN documents that cross-origin isolation depends on COOP and COEP and is required for certain shared-memory APIs such as SharedArrayBuffer. For this connector, you do not need cross-origin isolation to make IndexedDB, workers, or the basic connector work; use it only if the app can afford the embed/subresource constraints that COOP/COEP introduce. citeturn13search3turn13search7turn13search19turn11search3

## Agent identity, authentication, and recovery

The identity model should separate **who the configured agent is** from **which browser instance is currently operating it**. I recommend three IDs: a **stable agent ID** that survives devices and sessions; a **device ID** that survives within one browser profile on one device; and a **session ID** that is freshly generated per launch or per tab leadership cycle. This division is not just bookkeeping. It lets the server isolate active memory by agent, rotate device trust independently, and detect duplicate-tab or duplicate-device writers without confusing identity continuity with runtime continuity. That is consistent with UAIX’s emphasis on identity, namespace, actor boundary, read order, and current reviewed status as separate concerns. citeturn6view0turn6view2turn25view1turn33view1

Authentication should use the most secure pattern the memory provider can support:

### Preferred pattern

If the external memory service offers browser-friendly OAuth, use **Authorization Code + PKCE**, short-lived access tokens, and narrow scopes. The current OAuth browser-app guidance ranks **BFF** highest for security, **token-mediating backend** next, and **pure browser-only OAuth client** last among the main browser patterns. For a truly browser-only AI with no app backend, a full BFF is often unavailable, but a provider-hosted token mediation pattern is still preferable if the vendor offers it. citeturn28view0

### Browser-only pattern

If the app must hold tokens directly, keep them **in memory by default**, ideally inside a worker-controlled context, and use **sender-constrained tokens** when the provider supports them. RFC 9449 defines DPoP for sender-constrained OAuth tokens, and the current browser-app guidance recommends sender-constrained tokens as a security enhancement even though they do not solve every browser-only threat. citeturn27search0turn27search1turn30view0

### Lowest-common-denominator PAT fallback

If the external service only supports a personal access token or equivalent pasted secret, default to **session-only mode**. Offer “remember on this device” only behind an explicit warning and only by storing encrypted token material in IndexedDB, protected by a user-entered passphrase that is **never persisted**. This is the one mode that aligns best with OWASP’s rule that secrets in IndexedDB need a key not recoverable from the browser itself. citeturn11search2turn15search4

Token scopes should be aggressively narrow: `memory.read`, `memory.write`, `memory.search`, `memory.ack`, plus an optional `memory.promote` if the service wants a stronger boundary around durable promotion. They should also be **namespace-constrained** to exactly one `{tenant_id, stable_agent_id}` pair. The connector must never rely on client-side filtering to keep one configured agent from reading another agent’s memory; the server has to enforce that boundary, because browser code from the same origin can be subverted by XSS. Current OAuth browser-app guidance emphasizes reducing token authority and using resource indicators or scope minimization where possible. citeturn30view0turn11search4

Rotation and logout should be explicit and fast. On rotation, the server should revoke old credentials or stop accepting the old DPoP binding; the client should clear worker state, invalidate the offline outbox’s auth context, and require re-auth before replay. On logout, the connector should wipe session tokens immediately; on shared-device logout it should also wipe IndexedDB, OPFS receipts, cached search results, and device-bound encrypted ciphertext unless the user deliberately chooses a “retain non-sensitive local continuity bundle” option. The shared-device risk is real because browser history, browser profile files, and persistent origin storage can all survive the current page session. citeturn21search0turn30view0turn10search1turn11search14

Duplicate tabs should be handled with **coordination, not wishful thinking**. MDN documents that Web Locks allows same-origin tabs or workers to coordinate access to a named resource, and BroadcastChannel allows same-origin tabs and workers to communicate. Use a lock such as `"agent-sync:<stable_agent_id>"` so that only one tab becomes the **writer leader** for network sync, while other tabs remain readers and can request leadership if the leader disappears. This avoids write-stampedes and inconsistent outbox replay without pretending Web Locks is a server-side security control. citeturn19search0turn19search1turn19search8

## API design, manifest schema, and conflict behavior

The remote API should expose operations for **save, retrieve, semantic search, update, supersede, expire, promote, distribute, and acknowledge**, and each request should carry the minimum control metadata needed for lifecycle, review, idempotency, and conflict detection. Current HTTP guidance supports optimistic concurrency with ETag and `If-Match`, and newer HTTP guidance also recognizes the `Idempotency-Key` header as a way to make non-idempotent operations fault-tolerant. citeturn31search0turn31search1turn31search2turn32search11turn32search14

A recommended record envelope is:

```json
{
  "record_id": "mem_01JYQ8B6A8G0VV1P7E76C6F7AQ",
  "record_type": "active_state",
  "tenant_id": "tenant_acme",
  "stable_agent_id": "agt_01JYQ6X8P4X4S7R4K7M1R0N2V5",
  "scope": {
    "kind": "agent",
    "thread_id": null
  },
  "authority": {
    "level": "authoritative",
    "review_status": "accepted_current",
    "source_refs": [
      {
        "kind": "user_instruction",
        "ref": "turn_2026-07-12T18:34:00Z_0007"
      }
    ]
  },
  "lifecycle": {
    "state": "current",
    "ttl_seconds": 2592000,
    "supersedes": null,
    "promoted_from": null,
    "expires_at_utc": null
  },
  "sensitivity": {
    "classification": "internal",
    "prompt_eligible": true,
    "telemetry_eligible": false,
    "log_eligible": false
  },
  "revision": {
    "etag": "\"v42-7a9d9d\"",
    "base_etag": "\"v41-c3a921\""
  },
  "idempotency_key": "a52b53f8-61b2-4b39-b7cb-3cb87a4be9ba",
  "payload": {
    "objective": "Finalize connector architecture",
    "current_focus": "Storage boundary and auth model",
    "next_actions": [
      "Define conflict rules",
      "Publish E2E browser tests"
    ],
    "blockers": [],
    "recent_verified_changes": [
      "UAIX mapping approved"
    ],
    "unresolved_risk_refs": [
      "risk_01JYQ91KQ6V7V1EJ9V1XQ1KEX2"
    ],
    "recovery_pointer_refs": [
      "ptr_01JYQ92T1A8B57W2KRY0C5G3M4"
    ]
  }
}
```

The **record types** should at minimum be `governing_instructions`, `agent_identity`, `active_state`, `decision`, `issue_or_risk`, `handoff`, and `recovery_pointer`. Each record should include `scope`, `ttl_seconds`, `review_status`, `authority`, `source_refs`, `sensitivity`, and `revision`. That gives enough structure to map the current UAIX roles without duplicating concepts or losing review boundaries. citeturn6view0turn25view0turn25view1turn34view2

A recommended endpoint surface is:

```json
{
  "save":        "POST   /v1/memory/save",
  "retrieve":    "POST   /v1/memory/retrieve",
  "search":      "POST   /v1/memory/search",
  "update":      "PATCH  /v1/memory/{record_id}",
  "supersede":   "POST   /v1/memory/{record_id}:supersede",
  "expire":      "POST   /v1/memory/{record_id}:expire",
  "promote":     "POST   /v1/memory/{record_id}:promote",
  "distribute":  "POST   /v1/memory/{record_id}:distribute",
  "acknowledge": "POST   /v1/memory/{record_id}:acknowledge"
}
```

`retrieve` should return the assembled **active bundle** for startup: governing instructions, identity, current active state, recent decisions, open risks, latest handoff, and recovery pointers. `search` should be semantic and metadata-filtered, and by default should search **decisions, issue/risk records, handoffs, and promoted durable memory**, but **not** raw governing instructions, secrets, or credentials. That matches both UAIX’s promotion model and current production memory systems, which commonly separate living context from longer-term searchable memory and support TTL-managed retrieval. citeturn34view2turn36search0turn36search7turn36search8

Conflict behavior should be strict for high-authority records and permissive only for append-only evidence. Concretely:

- Use **ETag + `If-Match`** for `governing_instructions`, `agent_identity`, and `active_state`. If the base revision is stale, return **412 Precondition Failed** with the current record and a machine-readable conflict summary. citeturn31search0turn31search1turn31search2  
- Use **append-only writes** for `decision`, `issue_or_risk` comments, and `acknowledge` receipts. These can be idempotent by client-generated `record_id` or `Idempotency-Key`. citeturn32search11turn32search14  
- Use **409 Conflict** for semantic contradictions that are not just stale revisions—for example, an attempt to promote a quarantined record or distribute a handoff to an agent outside the allowed namespace. citeturn31search19turn11search13  

The `distribute` operation should not mean “spray memory everywhere.” It should mean “make a reviewed record available to another approved scope,” such as a second device of the same configured agent or a downstream recovery surface. The server must require both namespace compatibility and explicit scope permission for this step, because cross-device and cross-agent sharing are different trust acts. That recommendation follows directly from UAIX’s emphasis on declared boundaries, review status, and background-until-promoted durable memory. citeturn34view2turn25view1turn6view0

## Privacy threat model and UX flows

The dominant threats for this connector are **XSS**, **prompt injection and downstream secret leakage**, **token persistence in browser-visible storage**, **browser-history and referrer leakage**, **extension access**, **private-browsing volatility**, **storage eviction**, **shared-device exposure**, and **origin confusion**. OWASP’s browser, MCP, and LLM guidance aligns with the OAuth browser-app draft here: once malicious code runs inside the origin, it can often either read browser-visible storage directly or act “as the app” to obtain new tokens, and secrets placed in prompts, protocol logs, or model-visible state become exfiltration targets. citeturn11search4turn15search4turn28view0turn30view0turn35search1turn35search2turn35search14

Installed extensions materially change the risk picture. Chrome and MDN both document that extension content scripts can read and modify page content when granted host permissions. That means a user who enables a high-permission extension on a shared or unmanaged browser is accepting a materially weaker local trust boundary. The connector should say this plainly in the setup flow instead of implying that “encrypted local storage” defeats extension risk. citeturn20search0turn20search1turn20search2

Private browsing requires explicit UX, not silent degradation. MDN says IndexedDB in privacy modes may last only until the incognito session closes, and WebKit states that OPFS is unavailable in Safari Private Browsing. The connector should detect privacy-mode limitations where possible and surface a warning such as: “Memory works for this session, but this browser mode will not retain durable local continuity after the private session ends.” citeturn10search5turn23search10

A good UX flow has five moments.

**Connector setup**: the app asks whether to enable external memory at all, shows the provider label and documentation link, shows exactly which scopes are requested, and asks the user to choose between **session-only** mode and an explicit **remember on this device** mode. The copy should say that the AI itself does not create a user account; it uses the external memory account only if the user enables it. This matches the accountless design while making the risk boundary visible. citeturn34view2turn28view0

**Agent identity setup**: the user sets or confirms the agreed display name; the connector generates the stable agent ID if one does not already exist; and the UX shows the effective namespace and tenant boundary in human-readable form. Because current UAIX guidance treats identity, namespace, and actor boundary as first-class current-state facts, that identity cannot be hidden inside free-form chat context. citeturn6view0turn6view2

**Offline mode**: when the endpoint is unreachable, the UI should switch to “local continuity mode,” continue to operate on the last known active bundle, queue non-destructive updates, and clearly label which actions are pending sync. Because background execution is unreliable, offline mode should be foreground-driven and opportunistic, not based on promises that a background worker will finish later. citeturn13search10turn12search1turn13search8

**Recovery after lost local state**: when the browser profile is cleared or a new device is used, the connector should recover by re-authenticating to the memory provider, re-establishing the stable agent ID and namespace, downloading the current active bundle, and replaying no local assumptions that lack receipts. This is where the remote MATM copy earns its keep: it restores continuity when local browser storage has been evicted, cleared, or lost. citeturn10search1turn22search0turn34view2

**Logout on a shared device**: the UI should offer two buttons, not one: **Sign out** and **Sign out and erase local memory**. On shared devices, the second should be the default emphasis. That is the safest response to persistent origin storage, browser history exposure, and the lack of guaranteed encryption at rest for browser-managed storage. citeturn30view0turn21search0turn11search14

## Outage recovery, performance ceilings, and end-to-end tests

Outage recovery should be treated as a first-class design requirement because both UAIX and browser guidance point to the same conclusion: the local continuity layer must remain useful when the durable endpoint is unavailable. The connector should therefore persist exactly three local artifacts: the **last acknowledged active bundle**, an **outbox of pending mutations** with idempotency keys and base revisions, and a **receipt store** that marks which mutations the server has already accepted. When the endpoint comes back, the worker or foreground sync routine replays the outbox in order. If the server rejects a write with `412 Precondition Failed`, the connector should fetch the new current record, run record-type-specific merge logic, and ask for human review only when the conflict touches identity, governing instructions, or the active objective. citeturn33view0turn31search0turn31search1turn31search2

To keep the connector fast and resilient, the local active bundle should stay deliberately small and current-state-only. UAIX’s current wizard guidance is clear that hot records should be concise, date-free, and not turn into chronological history dumps. In practice, that means keeping the startup bundle to the minimum needed for coherent continuation and pushing bulky history into searchable durable memory. That structure improves token efficiency and lowers eviction pressure at the same time. citeturn33view0turn34view2

A sensible implementation budget is: one **current active bundle**, one **recent-decision window**, one **open-risk window**, and one **latest-handoff record** per configured agent, with all other durable history retrievable on demand. I recommend keeping the assembled startup payload under about **64–128 KB serialized**, limiting the recent decision and issue windows to the most relevant **25–100 records**, and treating semantic search results as ephemeral caches rather than permanent local datasets. Those figures are implementation recommendations rather than standards requirements, but they fit the current UAIX and browser guidance toward compact startup continuity and cautious local storage. citeturn33view0turn10search1

The end-to-end test plan should cover three browser families and the failure modes they are known to stress:

**Across Chrome/Edge, Firefox, and Safari**, verify: initial setup; OAuth PKCE flow or PAT entry; session-only versus remembered mode; IndexedDB continuity after reload; private-browsing degradation; service worker wake-and-resume; storage persistence request behavior; and exact-origin CORS/CSP enforcement. MDN and WebKit document meaningful differences here—especially around privacy-mode storage, persistent storage, and browser-managed eviction. citeturn10search5turn22search0turn23search10turn23search3

**Across tabs**, verify: only one writer leader acquires the Web Lock; BroadcastChannel state-change propagation; leader loss and takeover; stale-tab replay rejection; and duplicate-tab prevention for queued writes. Also verify that `sessionStorage` isolation does not accidentally split identity from the IndexedDB-backed active bundle. citeturn19search0turn19search1turn11search5

**Across devices**, verify: same stable agent ID on a second device can recover the authoritative active bundle; a different configured agent under the same tenant cannot read that bundle; device-bound rotation does not strand the active state; and logout on device A does not silently revoke device B unless that is the chosen provider policy. The isolation assertion is especially important because same-origin browser coordination does not extend across devices, browsers, or servers. citeturn19search0turn30view0

**For token rotation and revocation**, verify: old DPoP-bound or bearer credentials stop working immediately after rotation; replayed outbox entries remain idempotent; `401` and `403` responses trigger the right re-authentication path; and no raw credential appears in logs, crash reports, or analytics events during failure handling. That last point follows from OWASP’s current guidance around token mismanagement and secret exposure. citeturn27search0turn32search14turn35search14

**For tenant isolation**, run explicit negative tests: agent A under tenant X cannot retrieve, search, acknowledge, or distribute records for agent B under tenant X unless a deliberate sharing scope exists; tenant X cannot see tenant Y even if record IDs are guessed; and stale front-end cache entries are rejected by the server if the namespace does not match the authenticated token context. The browser cannot provide this guarantee by itself; the remote MATM service must enforce it. citeturn14search13turn14search0turn30view0

The overall recommendation is therefore straightforward: build the connector as a **local-first startup continuity layer plus an optional server-backed MATM memory plane**, treat browser persistence as **useful but never fully trusted**, keep raw credentials **out of durable browser-visible storage by default**, and model the data around **typed current-state records and promotion rules**, not around fake filesystem metaphors. That design matches both the current public UAIX record and the current browser security reality. citeturn33view0turn34view2turn28view0turn30view0
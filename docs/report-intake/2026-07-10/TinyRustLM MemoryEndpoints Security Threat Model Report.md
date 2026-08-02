# TinyRustLM MemoryEndpoints Security Threat Model Report

**Intended output file:** `E:\Source\Rust\TinyRustLM.com\agent-file-handoff\Improvement\tinyrustlm-memoryendpoints-security-threat-model-report.md`

## Scope and assumptions

This report threat-models the **optional, explicitly opt-in MemoryEndpoints.com storage connector** for TinyRustLM agents that can run in a browser and reach the internet. It is written as an **architecture-driven security report** for the codebase rooted at `E:\Source\Rust\TinyRustLM.com`. The repository contents themselves were not accessible in this environment, so every finding below should be bound to the actual routes, components, workers, and storage adapters in that tree before implementation or release.

The design assumptions are strict. The connector is **off by default**. A workspace key is a **session-only secret**. It must never enter `localStorage`, `sessionStorage`, IndexedDB, the Cache API, service-worker caches, URLs, browser history, referrers, analytics, source maps, logs, crash output, screenshots captured by the product, model prompts, or hosted memory records. Those constraints are justified by the web platform itself: `localStorage` persists across browser sessions, `sessionStorage` is accessible to JavaScript in the origin for the lifetime of a page session, the Cache API and service-worker infrastructure can persist request/response data, and any JavaScript executing in the origin can read browser storage unless secrets are moved out of script reach into an `HttpOnly` cookie or a BFF-style backend session. citeturn1search4turn1search8turn4search3turn4search11turn4search15turn13search3

The same constraints also follow from modern browser and extension behavior. Browser extensions with host permissions or `activeTab` can inject scripts, read and modify page DOM, and some extension APIs can capture the visible tab, which means a pure browser environment cannot be treated as a high-trust endpoint for long-lived approvals or persistent secrets. Sensitive material in URLs is also fundamentally unsafe because it can leak into browser history, logs, and referrer data. citeturn6search1turn6search3turn6search4turn5search22turn5search1turn5search5turn13search23

Accordingly, this report recommends a **same-origin relay pattern** with **server-side session state**, **capability-scoped authorization**, **short-lived approvals**, **strict anti-CSRF measures**, **no production cross-origin browser access**, and a **native local-endpoint path** for any future higher-trust workflow that would otherwise tempt the product toward unsafe browser persistence. That recommendation aligns with OWASP guidance not to treat browser storage as safe for tokens, not to rely on CORS as authentication, and not to place sensitive tokens in URLs. citeturn13search3turn2search13turn13search23

## System, assets, trust boundaries, attackers, and entry points

The system being modeled is:

**TinyRustLM browser UI** → **same-origin relay worker** → **MemoryEndpoints upstream API** → **memory retrieval / save / delete / share** → **optional insertion of retrieved memory into model context**.

The most important assets and trust boundaries are the following.

| Asset | Why it matters | Primary trust boundary |
|---|---|---|
| Workspace key | Root secret for connecting a user/workspace to hosted memory | User input boundary, browser runtime, relay memory, upstream auth boundary |
| Relay session | The effective authenticated state after a connection is established | Browser ↔ relay boundary |
| CSRF / tab nonce | Proof that state-changing requests came from the intended page context | DOM/runtime ↔ relay boundary |
| Memory records | Can include sensitive user content and attacker-controlled text | Upstream data boundary, display boundary, model-context boundary |
| Memory provenance metadata | Determines whether content can be trusted, superseded, restored, or shared | Relay ↔ upstream authorization boundary |
| Approval records | Decide whether an application/device/origin may access memory operations | User-consent boundary, app identity boundary |
| Workspace / user / agent / project identifiers | Scope every authorization decision | Object-level authorization boundary |
| Admin policy | Highest-impact control plane for workspace security posture | Admin-only boundary |
| Logs, metrics, traces, analytics | Common accidental exfiltration path for secrets and memory content | App ↔ observability boundary |
| Build artifacts, dependencies, CI secrets | Supply-chain path to compromise browser code, worker code, or deployment | Source ↔ build ↔ deploy boundary |

The core attackers are also clear. They include a web attacker trying XSS/DOM injection, a cross-site attacker trying CSRF or CORS abuse, a malicious extension or compromised browser, a malicious or careless user with legitimate access trying cross-workspace access or deletion, a botnet trying brute force or resource exhaustion, a relay-abuse attacker trying to turn the worker into an open proxy or SSRF primitive, and a supply-chain attacker compromising Rust crates, JavaScript packages, NuGet dependencies, CI workflows, or deployment provenance. These are all realistic classes for browser applications, APIs, agent systems, and build pipelines. citeturn0search1turn0search8turn2search2turn3search3turn12search4turn14search1turn14search4

Entry points that must be explicitly reviewed in the TinyRustLM tree include the connect form, relay endpoints for memory search/save/delete/share/context use, any policy administration route, any route that can proxy or transform upstream requests, any UI surface that displays memory content, and every pipeline step that builds browser bundles or deploys the worker. Production browsers and CDNs also add hidden entry points such as storage mechanisms, caches, logs, and observability pipelines. Cloudflare’s current platform behavior matters here because Workers observability is enabled by default for new Workers and logs are persisted unless configured otherwise, while custom Logpush fields can include request headers, response headers, and cookies. That makes “do not log secrets” a release-critical configuration requirement, not a documentation preference. citeturn13search22turn13search2turn13search0turn13search6

## Authentication, authorization, approval, and credential lifecycle design

### Authentication architecture

The recommended authentication design is:

1. The user explicitly opens a **MemoryEndpoints connect panel** inside the existing TinyRustLM memory panel.
2. The workspace key is entered into a **masked field** using `type="password"`, `autocomplete="off"` on the field and form, and `spellcheck="false"` to reduce browser suggestion and third-party spellcheck leakage. This is not a complete defense, but it materially reduces accidental disclosure through browser UX features. citeturn5search0turn5search4turn5search12
3. The browser sends the workspace key **once**, over HTTPS, in a `POST` request body to a same-origin route such as `POST /memory/connect`. The key is **never** placed in the URL, query string, fragment, analytics payload, or client-side persistent storage. OWASP explicitly warns that sensitive tokens in URLs leak into logs and browser history. citeturn13search23turn5search1turn5search13
4. The relay validates the key with the upstream service and then creates a **server-side session**. The browser receives only:
   - an **`HttpOnly; Secure; SameSite=Strict` session cookie** for the relay session; and
   - a **per-tab synchronizer token / tab nonce** in the response body, held **in memory only** by the page runtime.
   
   This follows OWASP session guidance for browser apps and avoids script-readable persistent token storage. citeturn13search3turn2search21
5. The **raw workspace key** may exist only in **volatile relay memory** for the active server-side session if the upstream API requires it on each request. It must never be persisted to disk, logs, analytics, crash reports, build artifacts, or stored memory. Operationally, the relay should store only a **non-reversible fingerprint** for audit correlation, such as an HMAC-based fingerprint with a server-held log key.
6. State-changing requests must present **both** the `HttpOnly` session cookie and the **per-tab CSRF token** in a custom header, plus pass **Origin** and **Fetch Metadata** checks. OWASP and MDN both support this layered approach because SameSite alone is not enough and Origin alone is not authentication. citeturn2search2turn2search6turn2search10turn2search13turn2search21
7. **Step-up authentication** is required for the highest-risk operations: delete or supersede memory, cross-agent sharing outside a narrow preapproved scope, workspace policy administration, risk-category changes, and any attempt to enable an “always approve” mode. WebAuthn or passkeys are the right fit because they use asymmetric cryptography and are specifically designed to resist phishing better than shared-secret approaches. citeturn11search0turn11search3turn11search5turn11search17

### Authorization model and capabilities

Authorization should be **deny by default**, **capability-based**, and enforced on **every object access**, not just at session creation. OWASP’s API guidance remains directly applicable here: broken object-level authorization happens when APIs trust object identifiers instead of re-checking access for each object. citeturn7search3turn7search7turn7search11turn13search16

The capability model should separate the following permissions exactly as requested:

| Capability | What it allows | Default risk level | Mandatory guardrails |
|---|---|---|---|
| `connect` | Establish a relay session to a workspace | Medium | Explicit user action, short idle timeout, no persistence of workspace key |
| `search_short_term_memory` | Read recent/working memory only | Medium | Scope by workspace, user, agent, project; result limits; no implicit model insertion |
| `search_long_term_memory` | Read durable memory collections | High | Same scopes plus provenance filtering and sensitivity labels |
| `save_short_term_memory` | Write transient or working memory | Medium | Content validation, provenance stamping, size limits |
| `save_long_term_memory` | Persist durable memory | High | Provenance, moderation, retention policy, poisoning checks |
| `delete_or_supersede_memory` | Tombstone, supersede, or hard-delete memory | Very High | Step-up auth, immutable audit event, restore window by default |
| `share_memory_with_another_agent` | Copy or reference memory into another agent scope | Very High | Explicit source and target scope, policy check, provenance retained |
| `use_memory_in_model_context` | Permit retrieved memory to enter model context | Very High | Treat memory as untrusted, prompt-injection controls, content filters |
| `administer_workspace_policy` | Change approvals, risk categories, revocation, scopes | Critical | Step-up auth, passkey required, break-glass logging, dual control recommended |

Every request must carry and the server must enforce the tuple:

`workspace_id + user_id + agent_id + project_id + capability + session_id + app_identity_id + device_identity_id + policy_version`.

No client-controlled identifier may be trusted by itself, and opaque IDs are for lookup efficiency only, not authorization. citeturn7search3turn7search7turn7search18

### Application risk categories and approval choices

Approval is where this design can fail catastrophically if it becomes too convenient. The product should classify requesting applications and origins into risk categories and cap the maximum approval type accordingly.

| Application category | Typical examples | Default max approval | Notes |
|---|---|---|---|
| Renderers of untrusted remote content | Browsers, webviews, email clients, chat clients | **Session** | High warning. No category-wide or device-wide auto-approval. |
| Signed local interactive apps | Native desktop TinyRustLM endpoint, managed helper app | **Always approve for specific signed app** | Only if identity tuple matches exactly and step-up auth is completed |
| Signed local automation tools | Schedulers, CLI tools, local orchestrators | **One-time** or narrowly scoped **always approve for specific signed app** | No wildcard data scopes; require operator identity |
| Admin tools | Policy editors, audit and revocation consoles | **One-time** | Step-up every use; never device-wide |
| Managed dedicated device mode | Single-user, encrypted, locked-down workstation with remote revoke | **Device-wide trusted mode** for low/medium operations only | Never for admin policy changes, cross-workspace share, or unrestricted delete |
| Explicit block | Any app/origin that fails identity checks or falls outside policy | **Deny** | Default outcome on mismatch |

Browsers and email clients deserve **prominent risk warnings** even if a user personally wants them always approved. That is not paternalism; it is a consequence of the execution model. Browser extensions can read and modify pages and, under some permissions, capture a visible tab. Email is a major phishing and malicious-link vector, and mainstream products like Gmail and Outlook explicitly warn or block external content and suspicious links because message content and linked pages are attacker-controlled. Therefore “always approve” in those categories creates a path where malicious content can ride a previously trusted renderer into memory actions. That conclusion is partly an inference, but it is well supported by the platform behavior and vendor security guidance. citeturn6search1turn6search3turn5search22turn10search0turn10search2turn10search7turn10search11turn10search19turn10search23

### Application identity and update behavior

An approval record should bind to an **identity tuple**, not a display name:

- executable signing identity
- publisher name
- binary hash
- install path
- application category
- browser origin as exact `scheme + host + port`
- browser extension identity where relevant
- local-endpoint device identity
- workspace scope
- capability scope
- policy version

Approval behavior on change should be strict:

| Change detected | Approval response |
|---|---|
| Binary hash changes, signer unchanged, install path unchanged | Downgrade prior “always approve” to **session approval** until user re-approves |
| Signer changes | Immediate revoke and block until a fresh approval is performed |
| Install path changes unexpectedly | Revoke and require re-approval |
| Browser origin changes in any way | Immediate revoke |
| Extension ID changes | Immediate revoke |
| Device identity changes or attestation fails | Immediate revoke |
| Capability set expands | Require fresh approval with step-up auth |
| Risk category increases | Revoke and re-approve; previous approval cannot silently float upward |

### Session lifetime, revocation, inactivity, and device loss

Because browser session restoration is not a trustworthy revocation mechanism, the relay must enforce server-side timeouts. NIST’s session guidance distinguishes inactivity and overall session timeouts, and recommends bounded inactivity windows rather than indefinite sessions. A strong baseline here is:

- **Standard memory session:** 15 minutes inactivity, 8 hours absolute
- **High-risk operations window:** 5 minutes inactivity, 1 hour absolute
- **Admin policy session:** passkey step-up for each entry, 5 minutes inactivity, 30 minutes absolute

For device loss or suspected compromise, the workspace admin must be able to see active sessions, revoke a single session, revoke all sessions for a workspace, revoke all approvals for a device, and require a fresh connect + step-up on next use. `Clear-Site-Data` should be returned on logout and forced revocation responses so the browser is instructed to purge cookies, cache, and storage for the origin. citeturn1search11turn1search7turn7search10turn7search2turn4search22

### Multi-tab and stale-credential handling

Using only a session cookie lets multiple tabs inherit access too easily. The safer design is **session cookie + per-tab nonce**. A newly opened tab has no nonce by default. It can acquire one only by an explicit user “adopt session” action from a still-authenticated tab, using an in-memory channel such as `BroadcastChannel` and then a server-issued **child tab token** tied to the same session version. Every request must include the current tab token. A session version counter should increment on logout, revoke, privilege change, or step-up expiry so stale tabs fail closed.

### UI integration requirement

All security controls should preserve TinyRustLM’s approved look and feel. That means adding the connect field, step-up prompts, session status, and risk banners **inside the existing memory panels and approval controls**, using the current spacing, typography, and interaction patterns. The product should avoid introducing a visually separate “security subsystem.” The experience should feel native to TinyRustLM while still making high-risk decisions unmistakable.

## Threat findings, scoring, mitigations, and residual risk

This report uses a simple internal scoring model:

- **Severity:** 1 negligible, 2 low, 3 moderate, 4 high, 5 critical
- **Likelihood:** 1 unlikely, 2 possible, 3 plausible, 4 likely, 5 expected
- **Residual risk:** post-mitigation view

| ID | Threat | STRIDE | Severity | Likelihood | Required mitigations | Residual risk |
|---|---|---|---:|---:|---|---|
| T-01 | Browser compromise or malicious extension steals workspace key or session material | S, I, E | 5 | 4 | In-memory only; `HttpOnly` cookie; no persistent browser storage; passkey step-up; warnings for browser category; native endpoint preferred for durable approvals | Medium-High |
| T-02 | XSS or DOM injection reads runtime state or drives memory actions | T, I, E | 5 | 3 | Strict CSP with nonce/hash; Trusted Types; no `innerHTML`; sanitize untrusted content; dependency review | Medium |
| T-03 | CSRF against the same-origin relay | S, T | 4 | 3 | `SameSite=Strict`; synchronizer token; `Origin` + `Sec-Fetch-Site`; JSON-only POST/DELETE; no state change via GET | Low |
| T-04 | CORS misconfiguration exposes sensitive routes | I, E | 4 | 3 | No CORS in production same-origin mode; exact allowlist only for dev; never wildcard with credentials; `Vary: Origin` when needed | Low |
| T-05 | Workspace-key theft and replay | S, E | 5 | 4 | One-time connect exchange; server-side session; short TTL; tab binding; revoke-all; key rotation workflow; audit fingerprint only | Medium |
| T-06 | Accidental credential logging at browser, CDN, worker, upstream, or CI layer | I, R | 5 | 3 | Never in URL; log allowlist; secret redaction; observability hardening; crash scrubber; source-map restrictions; CI secret scanning | Low-Medium |
| T-07 | Relay becomes an open proxy | T, E | 4 | 3 | Fixed route map; fixed upstream host; method and path allowlists; response-type allowlist; no arbitrary destination parameter | Low |
| T-08 | SSRF or upstream-host manipulation | T, I, E | 5 | 2 | Compile-time host allowlist; canonical path map; manual redirect handling; no user-controlled scheme/host/port | Low |
| T-09 | Model-byte or file exfiltration through relay | I | 5 | 2 | JSON/text only; deny binary, `Range`, attachments, archives, model files; response size caps; no file proxying | Low |
| T-10 | Oversized body and resource exhaustion | D | 4 | 4 | App-level size limits well below platform max; rate limiting; concurrency caps; timeouts; streaming early reject | Low-Medium |
| T-11 | Malicious memory contents contain prompt injection, HTML, scripts, or deceptive instructions | T, I, E | 5 | 4 | Treat all memory as untrusted; plain-text render; sanitize display; provenance labels; context filtering; user confirmation on risky downstream actions | Medium |
| T-12 | Cross-workspace, cross-user, cross-agent, or cross-project access | S, T, I, E | 5 | 3 | Per-object authorization on every request; scope tuple enforcement; deny by default; immutable audit | Low-Medium |
| T-13 | Incorrect “always approve” policies for browsers, email, local endpoint apps, and automation | E | 4 | 3 | Risk categories; approval ceilings; step-up to expand trust; browsers/email capped to session by default | Medium |
| T-14 | Shared computer or “non-sensitive device” auto-approval misuse | I, E | 4 | 3 | Device-wide trusted mode only on dedicated managed device; no shared-device mode; remote revoke; lock-screen requirement | Medium |
| T-15 | Weak revocation, session termination, inactivity timeout, or device-loss handling | I, E | 5 | 3 | Central session inventory; revoke-one/revoke-all; short idle timeout; `Clear-Site-Data`; force reauth after policy changes | Low-Medium |
| T-16 | Multi-tab races and stale credentials | T, E | 3 | 4 | Per-tab nonce, session versioning, logout broadcast, stale-tab rejection, optimistic concurrency for updates | Low |
| T-17 | Browser history, autocomplete, clipboard, screenshots, or accessibility-tree exposure | I | 4 | 4 | No URL secrets; masked field; `autocomplete="off"`; `spellcheck="false"`; no copy-back; no value mirroring; screenshot warnings | Medium-High |
| T-18 | Supply-chain compromise in crates, NuGet, JavaScript, worker deployment, or CI | T, E | 5 | 3 | Lockfiles; RustSec/cargo-audit/cargo-deny; dependency review; provenance/SLSA; hardened CI; secret scanning | Medium |
| T-19 | Memory poisoning, unauthorized deletion, or provenance forgery | T, R, I | 5 | 3 | Signed provenance; append-only event stream; tombstone/supersede by default; restore window; moderation/quarantine | Medium |
| T-20 | Denial-of-service and brute-force abuse | D | 4 | 4 | Per-IP/session/workspace rate limits; bot challenge; backoff; anomaly alerting; upstream protection with 429 and bans | Low-Medium |

The client-side findings are the most load-bearing because they explain why the connector must remain opt-in and why browser approvals must be conservative. Browser storage persists, service-worker and Cache APIs persist request/response objects, extension content scripts can read and modify page DOM, and sensitive URL data leaks into history and logs. For those reasons, the browser must hold only an ephemeral tab nonce in script memory while the durable authenticated state sits server-side in an `HttpOnly` cookie and relay session. citeturn1search4turn1search8turn4search3turn4search11turn4search15turn6search1turn13search3turn5search1turn13search23

The relay-facing web risks are also straightforward. CSRF defenses should be layered with SameSite cookies, synchronizer tokens, `Origin` checks, and Fetch Metadata checks. Production same-origin deployments should return **no CORS headers at all** unless a specific controlled cross-origin development case exists, because CORS is not authentication and wildcard origins do not work with credentials anyway. citeturn2search2turn2search6turn2search10turn2search14turn2search16turn2search17turn2search21turn2search13

The worker-abuse findings matter because the easiest failure mode for a memory relay is to become a generalized fetch primitive. SSRF guidance is clear that user-controlled destinations must be eliminated or tightly allowlisted. Cloudflare Workers also have platform-specific request behavior and hard limits that should not be mistaken for sufficient application-level protection; request body limits can be very large depending on plan, so the relay must enforce much smaller body limits and reject oversized requests long before the platform limits are reached. citeturn0search8turn0search7turn0search3turn12search1turn12search4turn12search17

The agent-memory findings require an AI-specific treatment. OWASP’s agent, RAG, and prompt-injection guidance all converge on the same rule: retrieved external data must be treated as untrusted input, separated from instructions, sanitized before display, filtered before entering model context, and never allowed to directly drive privileged tool invocation. That applies exactly to malicious memory containing HTML, scripts, deceptive instructions, or prompt-injection text. citeturn14search0turn14search1turn14search4turn14search8turn14search22

## Worker policy, CORS posture, logging schema, and operational controls

### Exact secure-header policy for the worker

The relay should emit the following headers.

**For HTML document responses serving the TinyRustLM UI:**

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'nonce-{RANDOM_PER_RESPONSE_NONCE}' 'strict-dynamic'; style-src 'self' 'nonce-{RANDOM_PER_RESPONSE_NONCE}'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; require-trusted-types-for 'script'; trusted-types tinyrustlm; upgrade-insecure-requests; block-all-mixed-content
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), microphone=(), midi=(), payment=(), screen-wake-lock=(), serial=(), usb=(), web-share=(), xr-spatial-tracking=(), publickey-credentials-get=(self)
Cache-Control: no-store
Pragma: no-cache
```

**For JSON API responses from the relay:**

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Type: application/json; charset=utf-8
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cross-Origin-Resource-Policy: same-origin
Cache-Control: no-store
Pragma: no-cache
```

**For logout, revoke, and forced disconnect responses:**

```http
Clear-Site-Data: "cache", "cookies", "storage"
Cache-Control: no-store
Pragma: no-cache
```

These choices are grounded in mainstream browser security guidance. CSP is the primary client-side XSS containment control, strict nonce-based CSP is materially stronger than host allowlists, Trusted Types reduces DOM XSS surface, `nosniff` prevents MIME confusion, `X-Frame-Options` and `frame-ancestors` defend against clickjacking, HSTS forces HTTPS, `Permissions-Policy` explicitly disables unnecessary browser APIs, `Referrer-Policy: no-referrer` avoids leaking route context, and `Cache-Control: no-store` is the correct directive when a response must not be stored. citeturn0search2turn1search1turn1search5turn1search9turn8search1turn8search9turn9search0turn9search1turn5search6turn4search1turn4search14

### CORS and request-policy posture

Production should be **same-origin only**. That means the secure default is:

- no `Access-Control-Allow-Origin`
- no `Access-Control-Allow-Credentials`
- no cross-origin browser callers
- `405` or `403` for stray `OPTIONS` on sensitive routes unless an explicitly supported preflight path exists

If a controlled development workflow requires cross-origin access, the relay may support it **only** under an explicit environment flag and **only** for an exact allowlist of origins. In that narrow case:

```http
Access-Control-Allow-Origin: https://dev.example.invalid
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: POST, GET, DELETE
Access-Control-Allow-Headers: Content-Type, X-Tiny-CSRF, X-Tiny-Tab
Access-Control-Max-Age: 0
Vary: Origin
```

There must be no wildcard origin with credentials, and CORS must never be treated as authentication. citeturn2search0turn2search4turn2search16turn2search17turn2search13

The relay should enforce the following request policy:

| Control | Requirement |
|---|---|
| Allowed routes | Exact route allowlist only; no generic `/proxy`, `/fetch`, or URL-forwarding endpoint |
| Allowed methods | `POST` for connect/search/save/share/context, `DELETE` or `POST` for delete/supersede, `GET` only for non-sensitive metadata |
| Allowed request content types | `application/json` only for state-changing routes |
| Browser headers required | Valid `Origin`, `Sec-Fetch-Site: same-origin` or same-site only when explicitly allowed, valid CSRF/tab header |
| Browser headers rejected or ignored | User-supplied `Authorization` after connect, `X-Forwarded-*`, `Forwarded`, `Host`, `Range`, `Origin` mismatches, `Sec-*` anomalies |
| Worker→upstream forwarded headers | Freshly generated minimal set only: upstream auth header, `Content-Type`, `Accept`, request ID |
| Worker→upstream forbidden pass-through | Browser `Cookie`, `Origin`, `Referer`, `X-Forwarded-*`, `Forwarded`, `Host`, `Range`, bearer/session values unrelated to upstream |
| Response types | `application/json` and optionally `text/plain`; reject binary or archive content |
| Request body limits | Connect ≤ 8 KiB, search ≤ 32 KiB, save short-term ≤ 64 KiB, save long-term ≤ 128 KiB, share/delete/admin ≤ 16 KiB |
| Response body limits | Search/context ≤ 1 MiB, metadata ≤ 64 KiB |
| Timeouts | Upstream timeout ≤ 10 s normal, ≤ 3 s admin metadata; abort on slow responses |
| Redirects | Manual handling only; follow only same exact upstream origin if absolutely required |

The point of these controls is to prevent the relay from accidentally inheriting dangerous browser and proxy semantics. Platform docs show that Workers have their own caching and request behaviors, and the cache layer can apply globally if enabled. The relay should be intentionally boring: no arbitrary destinations, no broad header forwarding, no opaque binary proxying, and no cacheable secret-bearing traffic. citeturn13search25turn4search6turn4search18turn0search7turn0search8

### Credential lifecycle and rotation design

The lifecycle should work as follows:

1. **Connect**  
   User enters `<WORKSPACE_KEY_PLACEHOLDER>` once, relay validates upstream, session starts.

2. **Active use**  
   Relay keeps the raw workspace key only in volatile session memory if needed for upstream calls. Browser retains only an in-memory tab token plus the `HttpOnly` session cookie.

3. **Rotation**  
   If the upstream workspace key is rotated, the relay invalidates any session whose stored key fingerprint no longer matches the active key version. Sessions fail closed and require reconnect.

4. **Revocation**  
   Revocation can be initiated by the user, a workspace admin, or an incident response action. Revocation clears the relay session, invalidates all child tab tokens, emits `Clear-Site-Data`, and blocks downstream use.

5. **Timeout**  
   Server-side idle and absolute timeouts always win over any browser notion of “session restore.”

6. **Device loss or suspicious activity**  
   Revoke all sessions for the device identity, all approvals for that device, and optionally all workspace sessions if compromise scope is unclear.

### Redacted structured logging schema

The relay should use allowlisted structured logs only. Never log raw request or response bodies for memory routes, never log prompts, never log upstream auth headers, never log cookies, and never log the workspace key or any reversible derivative.

A recommended event schema is:

```json
{
  "ts_utc": "2026-07-10T00:00:00Z",
  "event_type": "memory.search",
  "event_outcome": "allowed",
  "request_id": "req_01...",
  "session_id_fingerprint": "hmacsha256:...",
  "workspace_fingerprint": "hmacsha256:...",
  "user_fingerprint": "hmacsha256:...",
  "agent_fingerprint": "hmacsha256:...",
  "project_fingerprint": "hmacsha256:...",
  "app_category": "browser",
  "app_identity": {
    "publisher": "TinyRustLM",
    "signing_identity": "N/A for browser origin",
    "binary_hash": null,
    "install_path_hash": null,
    "browser_origin": "https://tinyrustlm.example.invalid",
    "extension_id": null,
    "device_id_fingerprint": "hmacsha256:..."
  },
  "capability": "search_short_term_memory",
  "route": "/memory/search",
  "method": "POST",
  "http_status": 200,
  "csrf_check": "pass",
  "origin_check": "pass",
  "fetch_site": "same-origin",
  "policy_version": "2026-07-10",
  "request_bytes": 842,
  "response_bytes": 15340,
  "latency_ms": 91,
  "risk_score": 23,
  "rate_limit_bucket": "workspace_search",
  "decision_reason": "policy_allow",
  "secret_redaction_applied": true,
  "body_logged": false,
  "prompt_logged": false
}
```

OWASP’s logging guidance supports two critical ideas used here: logs frequently become a confidentiality problem because they capture secrets and PII, and logging should be structured, security-relevant, and consciously minimized. Cloudflare’s platform behavior also matters: Workers logs can persist by default, custom HTTP request log fields can include headers and cookies, and tail events perform some redaction but should not be treated as a reason to log secrets in the first place. citeturn1search2turn13search6turn13search12turn13search22turn13search0turn13search1

## Verification, incident response, negative tests, and release-blocking acceptance criteria

### Security-focused TDD and penetration-test plan

The test strategy should combine unit tests, integration tests, browser tests, worker tests, and adversarial penetration tests. At minimum, the TDD suite should cover:

| Test class | What to prove |
|---|---|
| Authorization unit tests | Every capability is denied by default and granted only under matching scope tuple |
| Session tests | No browser route stores the workspace key in `localStorage`, `sessionStorage`, IndexedDB, Cache API, service-worker caches, or URL |
| CSRF tests | State-changing routes reject missing/invalid CSRF token, foreign `Origin`, and cross-site `Sec-Fetch-Site` |
| CORS tests | Production emits no ACAO headers; dev-origin echo works only for explicit allowlist |
| SSRF/open-proxy tests | No route accepts arbitrary destination URLs, hosts, schemes, or ports |
| Size-limit tests | Oversized bodies receive `413` before upstream fetch |
| Content-safety tests | Memory rendered as text, not HTML; injected scripts never execute |
| Prompt-injection tests | Retrieved memory cannot silently trigger tool use or policy changes |
| Multi-tab tests | Stale tabs fail after logout, revoke, or privilege change |
| Revocation tests | Revoke-one, revoke-all, and logout clear session state and stop all subsequent access |
| Logging tests | No secret-bearing headers, cookies, bodies, prompts, or raw memory content enter logs |
| Supply-chain gates | Dependency review, vulnerability scan, lockfile drift, reproducible build/provenance checks |

### Negative tests that must stay permanently green

The following negative tests should be added as release gates because they directly prove forbidden routes and headers remain blocked:

1. `POST /memory/connect?workspaceKey=<WORKSPACE_KEY_PLACEHOLDER>` must fail; the route must not accept secrets in query strings.
2. Any route that accepts `url=`, `target=`, or `host=` parameters for upstream fetch must fail or not exist.
3. Requests with mismatched `Origin` or `Sec-Fetch-Site: cross-site` to state-changing routes must fail.
4. `GET` requests must never mutate state.
5. Browser requests attempting to set or influence upstream `Host`, `Forwarded`, `X-Forwarded-*`, `Range`, or alternate destination headers must fail or be ignored safely.
6. Production responses must not contain `Access-Control-Allow-Origin: *` or `Access-Control-Allow-Credentials: true`.
7. Responses from memory routes must include `Cache-Control: no-store`.
8. Connect and search routes must never write request bodies into logs or analytics.
9. The workspace key must not appear in rendered DOM after connect, form rehydration, error banners, toast messages, accessibility live regions, or crash telemetry.
10. HTML memory content such as `<script>`, `<img onerror=...>`, or deceptive markdown links must render inert as plain text or sanitized safe markup.
11. A previously approved “always approve” signed application must revert to session approval when its binary hash changes.
12. A changed browser origin or extension ID must invalidate prior approval immediately.
13. A revoked session cookie combined with an old tab token must fail.
14. A valid session cookie without the current tab token must fail on state-changing routes.
15. A memory search result marked “untrusted” must not enter model context unless `use_memory_in_model_context` is explicitly granted.

### Incident-response and revocation procedure

The incident procedure should be deterministic:

1. **Triage and classify** whether the event is credential theft, XSS/DOM compromise, extension/browser compromise, cross-workspace access, poisoning, deletion, or resource-abuse.
2. **Contain immediately** by revoking the affected session, device approvals, or all workspace sessions depending on scope.
3. **Preserve evidence** using redacted structured logs, audit events, provenance chains, and deployment metadata. Do not preserve raw secrets.
4. **Invalidate approvals** for any changed binary hash, changed origin, changed extension ID, or suspicious device identity.
5. **Rotate the upstream workspace key** if compromise touched any part of the connect flow or relay volatile secret handling.
6. **Quarantine suspicious memory** by marking records untrusted and withholding them from model context until reviewed.
7. **Review recent memory mutations and shares** using append-only provenance data and restore tombstoned records where needed.
8. **Patch and redeploy** with a new policy version and fresh build provenance.
9. **Force reauthentication** and, where relevant, passkey step-up on the next sensitive operation.
10. **Retrospective**: add a new regression test before closing the incident.

### Release-blocking security acceptance criteria

The following should block release of MemoryEndpoints support until all are true:

- The connector is **off by default** and requires explicit user opt-in.
- The workspace key is never stored in `localStorage`, `sessionStorage`, IndexedDB, Cache API, service-worker caches, or URLs.
- The browser never receives a durable bearer token for upstream use; authenticated state is server-side.
- State-changing routes require `HttpOnly` session + CSRF/tab token + `Origin`/Fetch Metadata checks.
- Production deploys with **no cross-origin browser access** to sensitive routes.
- The relay exposes **no arbitrary fetch/proxy behavior** and permits only fixed upstream routes.
- The worker sets the required security headers and `Cache-Control: no-store`.
- The worker observability/logging configuration is hardened so secret-bearing data is not persisted.
- Per-object authorization enforces workspace, user, agent, and project scope on every request.
- `use_memory_in_model_context` is a separate permission and memory is treated as untrusted input.
- Delete/supersede/share/admin paths require step-up auth and immutable audit events.
- Browsers and email clients cannot receive silent durable approvals without a high-risk override flow, and the default policy caps them at session approval.
- Device-wide trusted mode exists only for dedicated managed devices and excludes admin policy changes.
- Revocation, rotate-all, revoke-one, and forced logout flows are fully implemented and tested.
- Supply-chain controls are active for Rust, JavaScript, NuGet-equivalent dependencies, CI workflows, and deployment provenance.
- Penetration tests for XSS, CSRF, CORS drift, open-proxy abuse, SSRF, prompt injection, provenance forgery, and brute-force behavior pass.

The final residual-risk judgment is this: **the browser remains a medium residual-risk environment even after strong controls**, because compromised endpoints and malicious extensions are outside the application’s full control. By contrast, the same MemoryEndpoints functionality can reach a substantially lower residual-risk posture when mediated by a signed, managed, non-rendering local endpoint application with device identity, passkey step-up, and centralized revocation. That is the key strategic conclusion of this threat model.
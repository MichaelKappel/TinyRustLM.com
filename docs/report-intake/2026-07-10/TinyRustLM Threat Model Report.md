# **TinyRustLM Security Threat Model Report: Optional MemoryEndpoints.com Storage Connector**

**Document Reference:** TR-MEMSEC-2026-001  
**Version:** 1.0.0-PROD-SEC  
**Date:** July 10, 2026  
**Classification:** Internal Security Review / Confidential  
**Target Path:** E:\\Source\\Rust\\TinyRustLM.com\\agent-file-handoff\\Improvement\\tinyrustlm-memoryendpoints-security-threat-model-report.md

## **Executive Summary**

The TinyRustLM architecture operates as a high-performance, private, browser-local language model compiled to WebAssembly (WASM). Historically, this architecture guaranteed absolute data privacy by air-gapping the execution environment from external networks. To expand the agent's contextual capabilities and provide continuity across sessions, the architecture introduces an optional, explicitly opt-in integration with MemoryEndpoints.com for both short-term and long-term vector memory storage.  
As a private-first local runner, adding external network connectivity introduces a massive alteration to the established trust boundary. The integration exposes the browser-based runtime to new attack surfaces, including cross-site scripting (XSS), server-side request forgery (SSRF) at the relay edge, and indirect prompt injection through malicious external payloads1. This exhaustive threat model deconstructs the attack surface of the optional storage connector, designs a capability-based permission architecture, specifies strict application identity requirements, and analyzes twenty distinct security threat vectors using a structured analysis. The resulting architectural mandates and security-focused penetration-testing plan serve as a release-blocking gate for the integration.  
To preserve the approved TinyRustLM look and feel, the UI implementation adheres to strict visual guidelines. The typography utilizes strictly monospaced fonts for controls, cryptographic hashes, and data structures to emphasize technical precision, paired with clean, sans-serif layouts for explanations and warnings. The palette maintains a dark terminal aesthetic featuring a deep slate background, high-contrast green indicators for secure states, amber warnings for permission elevation, and red for critical error states. Any added security elements, such as the explicit opt-in toggle, the multi-capability security checkbox list, and prominent risk warnings, are integrated directly into the existing connector panel utilizing the established spacing, subtle borders, and responsive focus outlines.

## **System Architecture and Trust Boundaries**

The integration introduces a complex data flow operating across multiple distinct trust boundaries. The primary design constraint dictates that the connector must remain explicitly opt-in, and workspace keys must remain session-only. Keys must never enter localStorage, IndexedDB, service-worker caches, URLs, logs, crash outputs, or any persistent browser state3.  
The architecture partitions the runtime into isolated zones. The user's browser window represents an untrusted runtime environment containing the main TinyRustLM UI and the WASM agent inference core. Because the Document Object Model (DOM) is highly susceptible to manipulation by browser extensions and cross-site scripting attacks, sensitive cryptographic operations are relegated to a secure, DOM-isolated Web Worker5. The Web Worker manages ephemeral key storage using non-exportable CryptoKey objects and handles all cryptographic signing for outbound requests7.  
Requests originating from the Web Worker do not communicate directly with the upstream database. Instead, they traverse a same-origin relay proxy hosted on a CDN edge layer. This relay enforces route restrictions, filters payloads, and applies strict security headers. Finally, the relay establishes an encrypted, mutually authenticated TLS connection to the upstream MemoryEndpoints.com storage facility, which houses the multi-tenant vector databases9.

### **Assets, Threat Actors, and Trust Boundaries**

The primary assets requiring protection include the workspace keys, the agent memory records, and the model weights and context. Workspace keys are the cryptographic credentials used to authenticate and authorize requests to the MemoryEndpoints.com workspace pools. The agent memory records consist of the user's short-term and long-term historical records, frequently containing highly sensitive personally identifiable information, proprietary source code, and reasoning traces. The model weights and context represent the client-side TinyRustLM parameters and the active system prompts injected into the context window, which dictate the agent's behavior and safety boundaries.  
The threat landscape encompasses several distinct classes of adversaries. External web attackers may attempt Cross-Site Request Forgery (CSRF), browser history sniffing, or unauthorized cross-origin data extraction. Malicious browser extensions or compromised DOM dependencies represent a severe insider threat, utilizing injected JavaScript to attempt credential theft, clipboard hijacking, and session hijacking7. Network-level adversaries focus on path-interception, open proxy abuse, or exploiting edge workers with misconfigured logging that captures sensitive credentials in transit11. Finally, malicious upstream actors or indirect prompt injectors aim to poison retrieved long-term memories with hostile instructions, attempting to hijack the agent's execution flow, exfiltrate data, or alter the local environment12.  
The architecture relies on the rigorous enforcement of trust boundaries. The boundary between the DOM and the Web Worker is critical; the main window is treated as a highly exposed, hostile environment. The Web Worker lacks DOM access, isolating sensitive key material from the main JavaScript execution thread5. The boundary between the browser and the same-origin relay enforces cross-origin controls via CORS and same-origin tokens, preventing malicious external sites from abusing the local proxy. The egress boundary between the relay proxy and MemoryEndpoints.com strictly validates destination hosts to prevent Server-Side Request Forgery (SSRF) and proxy abuse, ensuring traffic only flows to authorized upstream endpoints1.

## **Capability-Based Permission Model**

To enforce the principle of least privilege, the architecture demands a cryptographic, capability-based permission model. Permissions are not stored as boolean flags in local files or simplistic JSON structures; they are represented as attenuated cryptographic tokens utilizing a Macaroon-style architecture with fine-grained restrictions. When a session is initiated, the workspace master key generates a root token. As the agent requests specific connections, the user interface attenuates this token by appending specific cryptographic caveats.

| Capability Identifier | Description | Cryptographic Restrictions and Caveats |
| :---- | :---- | :---- |
| cap:connect | Initiates the channel to the remote store and conducts capability handshakes. | Session-bound; cryptographically bound to a specific browser Origin. |
| cap:search\_st | Searches the local memory cache stored within the active browser tab. | Restricted exclusively to client-side memory-only vectors. |
| cap:search\_lt | Queries the remote vector database at MemoryEndpoints.com via semantic search. | Read-only; strict maximum limits enforced on vector return counts. |
| cap:save\_st | Saves ephemeral context and temporary sliding-window history locally. | Restricted to ephemeral main memory structures. |
| cap:save\_lt | Inserts or indexes new vector memory blocks into the remote database. | Write-only; enforces stringent payload schema and type validation. |
| cap:delete\_mem | Permanently deletes or marks a memory vector as tombstoned/updated. | Enforces strict identifier validation; requires explicit user confirmation. |
| cap:share\_agent | Forwards retrieved memory blocks to another active agent run within the workspace. | Restricted strictly to signed peer agent identities within the tenant. |
| cap:inject\_ctx | Permits the injection of retrieved memories into the LLM context window. | Sanitizes memories to neutralize Document-Authored Control-Signal Impersonation15. |
| cap:admin\_policy | Modifies access control lists, key rotation policies, and global storage settings. | Strictly restricted to administrator credentials; cannot be delegated to agents. |

This capability model prevents the confused deputy problem. If an untrusted autonomous agent or an automated script attempts to write unauthorized data to the upstream memory, the Secure Web Worker validates the message signature against the active Macaroon caveats. If the token lacks the explicitly granted cap:save\_lt capability, the Web Worker rejects the payload before it ever touches the network stack, ensuring that compromised agent logic cannot bypass the user's explicit authorization choices.

## **Application Risk Categories and Approval Choices**

Security profiles vary drastically depending on the container, application, and trust boundaries surrounding the TinyRustLM instance. Clear risk categories and a non-fatiguing, cryptographic UI confirmation mechanism dictate how and when an application can access the MemoryEndpoints.com connector.  
Browsers and generic web origins represent a critical risk category. Browsers are inherently noisy environments, highly exposed to untrusted third-party scripts, and plagued by malicious extensions. A rogue extension can read inputs directly from the DOM, scrape visual data via screenshots, and hijack clipboard actions10. Furthermore, the lack of robust native process isolation in certain web environments increases the vulnerability to side-channel attacks aimed at the WASM linear memory8. Due to this extreme exposure, explicit, high-visibility warning flags are mandatory for all browser-based execution. The system programmatically disables "Always Approve" auto-approval policies for generic browser origins. Even if a user desires automatic approval for convenience, the architecture overrides this preference, forcing session-based or one-time approvals to mitigate the inherent volatility of the web environment.  
Email clients and collaboration hubs represent an equally critical risk category, governed by different threat mechanics. Email clients automatically ingest arbitrary data from completely untrusted third parties. If an agent operating within an email client possesses auto-approve permissions to read and write memories, it falls victim to zero-click prompt injection attacks, commonly referred to as "EchoLeak" vulnerabilities12. An incoming email containing a maliciously crafted, invisible prompt can silently command the agent to search long-term memory and exfiltrate the contents to an external endpoint without any user interaction. Consequently, the architecture strictly enforces prompt-gated user approval for these environments. Always-approve policies are strictly forbidden for email handlers, requiring a human-in-the-loop to validate the agent's intent before executing memory-retrieval or transmission operations.  
Signed local endpoint applications represent a medium risk category. These are compiled executables possessing valid publisher certificates, running from secure operating system paths. While they are significantly less exposed to web-based DOM exploits and malicious extensions, they remain vulnerable to local privilege escalation or advanced memory dumping techniques if the host operating system is compromised. Conversely, automation tools and headless scripts represent a high risk category. These tools frequently execute repetitive loop patterns without a human-in-the-loop. If their logic is hijacked by adversarial input, they risk entering infinite execution loops, triggering rate-limiting locks, or facilitating rapid, automated memory exfiltration2.  
To accommodate these varying risk levels, the system offers granular UI approval options. The default stance is "Deny," which aborts execution and returns a permission-denied state. "One-Time Approval" grants a single capability for a single transactional request, dropping the capability immediately after execution. "Session Approval" grants the requested capability for the duration of the current agent execution session, automatically terminating upon page reload, window closing, or after fifteen minutes of inactivity20.  
For trusted environments, "Always Approve for a Specific Signed Application" cryptographically binds the permission to a verified binary hash, publisher signature, and install path. Any modification to the binary invalidates this permission immediately. "Category Approval" permits a cluster of low-risk capabilities, such as read-only short-term search, for a verified application class. Finally, "Device-Wide Trusted Mode" permits secure hardware-bound authorization using a TPM or secure enclave key for non-sensitive, sandboxed memory spaces, requiring biometric or hardware verification.

## **Application Identity Requirements**

To prevent spoofing attacks, the system must definitively establish the identity of the requesting application. An unauthorized script named "Browser" or a malicious origin masquerading as a trusted utility must not be granted access based on its display name. TinyRustLM validates applications against a multi-layered identity manifest that incorporates cryptographic proofs rather than relying on user-provided strings.  
The application identity manifest requires the executable signing identity, capturing the certificate details of the publisher. It records the exact publisher name and the SHA-256 binary hash of the executable. For local deployments, it records the expected installation path on the host filesystem. For web-based deployments, it strictly records the browser origin, and if applicable, the specific extension identity. For high-security environments, it binds the application to a local-endpoint device identity using a hardware-certified public key.  
The system handles identity state changes with aggressive revocation mechanisms. When a local helper application undergoes a routine software update, its SHA-256 binary hash inherently changes. The client UI immediately detects this mismatch, revokes the associated "Always Approve" policy, reverts the application's status to "Deny" or "Prompt-Once", and displays a prominent security warning requiring the user to re-verify and re-authorize the modified application. Similarly, if a connection request arrives from a different web origin, it is treated as a critical trust boundary crossing. No permissions are carried over across subdomains or new domains, effectively neutralizing origin-spoofing and subdomain takeover exploitation21.

## **Exhaustive Threat Analysis**

The introduction of the optional MemoryEndpoints.com connector significantly expands the attack surface. The following structured analysis details twenty specific threat vectors, exploring the abuse cases, severity, likelihood, and the architectural mitigations enforced to satisfy the strict "no cheating" requirements.

### **Client-Side and Browser Integrity Threats**

The compromise of the browser environment via malicious extensions represents a critical severity threat with a high likelihood of occurrence. A rogue browser extension can seamlessly inject scripts, monitor standard form fields, and read persistent storage mechanisms like localStorage or IndexedDB to extract workspace keys7. To mitigate this, the connector enforces explicitly opt-in connections and stores keys exclusively in-memory inside a DOM-isolated, private-scope Web Worker. By utilizing the WebCrypto API with the extractable: false flag, the architecture ensures that even if JavaScript executes in the main thread context, it cannot extract the raw key material8. The residual risk is low, limited strictly to advanced CPU-level memory dumping or total physical device compromise.  
Cross-site scripting (XSS) and DOM injection attacks present a similar critical severity threat. If an XSS vulnerability allows an attacker to execute arbitrary JavaScript within the TinyRustLM UI, the attacker will attempt to read credentials from memory or intercept session buffers17. The mitigation strategy relies on a strict Content Security Policy (CSP) that explicitly blocks unsafe-inline scripts. Because the workspace key is sequestered inside the Web Worker and communicates strictly via structured postMessage cloning, the key is never exposed to the DOM or the main JavaScript heap5. While attackers may attempt to request operations through the message channel, they cannot exfiltrate the raw cryptographic keys, reducing the residual risk to a low level.  
Cross-Site Request Forgery (CSRF) against the same-origin relay is a high-severity threat. Malicious external sites could attempt to trigger state-changing requests to the relay endpoints by abusing active, ambient browser cookies or sessions. The architecture neutralizes this by enforcing strict SameSite=Strict cookie policies and requiring a custom HTTP header dynamically generated in-memory. Because cross-origin HTML forms cannot append custom headers, the CSRF attack fails at the preflight or request stage, rendering the residual risk negligible.  
CORS misconfigurations pose a high-severity threat of information disclosure. If a relay or upstream server implements a wildcard Access-Control-Allow-Origin: \* policy, malicious origins can silently read memory synchronizations or extract proprietary models. The relay enforces strict origin validation and never permits wildcards in conjunction with credentials. The system maintains a strict allowlist of authenticated TinyRustLM subdomains23, ensuring that cross-origin read access is fundamentally blocked at the network edge.  
Workspace-key theft and replay attacks represent a critical severity threat. If an attacker successfully sniffs the key in transit or steals it from a compromised client, they could replay it from a hostile network to access the upstream store. The architecture mitigates this by requiring the Web Cryptography API to derive ephemeral, session-bound client signatures for every request. The upstream MemoryEndpoints.com server verifies the primary workspace key alongside these dynamic client-device signatures and Macaroon caveats, ensuring that a stolen static key cannot be replayed without the corresponding ephemeral signing context.

### **Infrastructure and Network Threats**

Accidental credential logging across the browser, CDN, worker, upstream, or CI layers is a high-severity, high-likelihood threat. Keys, prompts, or sensitive memory payloads are frequently and accidentally logged in plain-text during edge worker crashes, server console outputs, or CI build artifacts. The mitigation mandates the redaction of all keys and memory payloads before any logging mechanism processes them. The architecture utilizes automated token scrubbing libraries and explicitly forbids the temporary logging of tokens for debugging purposes. By adhering strictly to a redacted structured logging schema, the residual risk of credential leakage via telemetry is minimized.  
Open-proxy abuse of the same-origin relay is a high-severity threat where attackers attempt to use the relay as a generic proxy to route spam or attack traffic to external targets, masking their original IP address1. The relay strictly restricts routing to pre-defined MemoryEndpoints.com IP and domain ranges. It explicitly rejects all destination overrides or dynamic routing headers provided in client requests, blocking generic proxying attempts and neutralizing the threat.  
Server-Side Request Forgery (SSRF) and upstream-host manipulation share a similar risk profile. Attackers manipulate the upstream host variables in requests to force the relay to fetch internal corporate resources or cloud metadata endpoints14. The relay architecture hardcodes the target endpoint in the edge worker code and aggressively strips dynamic routing headers like X-Forwarded-Host. By eliminating the ability for the client to influence the destination URI, the SSRF attack vector is effectively closed.  
Model-byte exfiltration through the relay is a high-severity threat where an attacker utilizes a prompt injection to trick the local WASM model into encoding its own proprietary weights or parameters into a memory block and syncing it upstream. The architecture mitigates this by restricting output sizes, enforcing strict schema validation on memory formats, and utilizing entropy analysis to strip dense binary byte streams from text-based synchronization payloads. The residual risk remains low, requiring highly sophisticated semantic filtering by the attacker to bypass the entropy checks.  
Oversized body and resource-exhaustion attacks threaten the availability of the system. Massive payloads can exhaust browser tab memory, cause linear memory overflows that crash the WASM engine, or overwhelm Relay Worker compute allocations25. The mitigation enforces a strict, non-negotiable two-megabyte payload size limit at both the Relay edge and the local Web Worker. Oversized payloads are dropped instantly before parsing or memory allocation occurs, efficiently mitigating denial-of-service attempts.

### **Data Integrity and Contextual Threats**

Malicious memory containing prompt injection, scripts, HTML, or deceptive instructions represents a critical severity threat. Retrieved long-term memory may contain HTML scripts designed for DOM injection or instructions crafted to hijack the model via indirect prompt injection techniques such as Document-Authored Control-Signal Impersonation (DACSI)15. The system treats all retrieved memory as completely untrusted, hostile data. It performs strict DOM sanitization using libraries like DOMPurify and utilizes instruction isolation templates in the LLM prompt builder to structurally separate retrieved data from core system commands16. Despite these mitigations, prompt injections require ongoing safety tuning and heuristic updates, leaving a medium residual risk.  
Cross-workspace, cross-user, cross-agent, and cross-project access flaws represent a critical elevation of privilege threat. Flaws in multi-tenant authorization could allow a compromised agent to query or overwrite another user's stored memories. The upstream architecture cryptographically isolates tenants, enforcing strict workspace-level token claims that are verified at every API gateway layer. Agent signatures must match the requested project scope precisely, ensuring that lateral movement between projects is cryptographically impossible.  
Incorrect "always approve" policies for browsers, email clients, and local endpoint applications pose a critical threat. Over-permissive flags execute commands silently without user intervention, a critical flaw when processing emails containing invisible malicious payloads12. The architecture programmatically disables "always approve" choices for highly exposed environments like web browsers and email clients. It enforces explicit confirmation prompts for high-stakes capabilities, ensuring a human-in-the-loop validates the action before execution.  
Shared or non-sensitive computer auto-approval mode vulnerabilities occur when a secondary user accesses active workspace memories because the previous user left an auto-approval session active on a shared workstation. The mitigation relies on the strict in-memory storage of keys, coupled with a mandatory short-duration inactivity timeout (e.g., fifteen minutes) and an absolute session limit (e.g., eight hours). This ensures that unattended sessions degrade quickly and safely.  
Revocation, session termination, inactivity timeout, and device loss scenarios require robust handling. If a session persists indefinitely on a lost device, unauthorized access to the long-term memory store is guaranteed. The architecture mandates immediate session termination upon manual logout or inactivity. Furthermore, it implements a signaling mechanism to send an invalidation broadcast to the upstream database, wiping the tokens globally and neutralizing the lost device's access.

### **State Synchronization and Supply Chain Threats**

Multi-tab races and stale credentials create a medium-severity tampering threat. Multiple browser tabs accessing the store with different key states can corrupt memory synchronization indices or overwrite valid records. Because keys are strictly isolated per tab instance and not shared via localStorage, the architecture utilizes BroadcastChannel mechanisms to synchronize state update notifications across tabs without transmitting the raw keys themselves4. It also employs standard transactional numbering on memory endpoints to prevent race conditions during concurrent writes.  
Browser history, autocomplete, clipboard, screenshots, and accessibility-tree exposure threaten credential confidentiality. Operating system-level facilities can expose keys if input fields aren't protected or if memories are copied to the clipboard by rogue background processes. The UI disables autocomplete and history caching on credential inputs, forces the type="password" attribute, and redacts sensitive fields from screenshots and accessibility trees using advanced CSS and ARIA masking techniques. However, because operating system security boundaries are ultimately outside the browser's control, a medium residual risk remains.  
Supply-chain threats in Rust crates, NuGet packages, JavaScript NPM modules, worker deployment, and CI pipelines present a high-severity threat30. A compromised dependency could seamlessly leak workspace keys or maliciously manipulate memory contents during compilation or runtime. The mitigation enforces strict cryptographic hash-locking for all dependency manifests and mandates automated static analysis in the CI/CD pipelines. While this reduces exposure, the inherent reliance on third-party code maintains a medium residual risk requiring continuous vendor monitoring.  
Memory poisoning, unauthorized deletion, and provenance forgery allow an attacker to insert false memory records or modify metadata to corrupt the agent's logic or destroy audit traces2. To prevent RAG poisoning, the architecture cryptographically signs memory blocks on the client using a local key before upstream ingestion. The upstream database validates these metadata signatures to guarantee provenance, ensuring that an attacker cannot forge the origin or integrity of a memory block without compromising the local signing keys.  
Finally, denial-of-service and brute-force behavior aim to exhaust system quotas. An attacker flooding the API with mock synchronization requests can lock out the legitimate user by triggering rate limits. The architecture enforces strict, client-specific rate limiting at the Relay Worker edge, coupled with exponential backoff inside the client retry logic, ensuring that brute-force floods are absorbed at the CDN layer without impacting upstream availability.

## **Exact Secure-Header Policy for the Worker**

To secure the Same-Origin Relay and mitigate client-side vulnerability surfaces, a strict secure-header policy is enforced at the worker edge. The Cloudflare Worker appends specific security headers to every response while aggressively stripping internal routing headers that could assist an attacker in infrastructure reconnaissance9.

Rust  
use worker::\*;

fn set\_secure\_headers(mut headers: Headers) \-\> Result\<Headers\> {  
    // 1\. Enforce strict, minimal Content Security Policy (CSP)  
    // Limits execution to self, allows WASM evaluation, restricts connections to the approved endpoint.  
    headers.set("Content-Security-Policy", "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://MemoryEndpoints.com; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; block-all-mixed-content;")?;  
      
    // 2\. Eliminate access to dangerous browser-level hardware features  
    headers.set("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), xr-spatial-tracking=(), interest-cohort=()")?;  
      
    // 3\. Prevent framing to neutralize clickjacking attacks  
    headers.set("X-Frame-Options", "DENY")?;  
      
    // 4\. Force strict MIME-type checking to prevent sniffing attacks  
    headers.set("X-Content-Type-Options", "nosniff")?;  
      
    // 5\. Disable legacy browser XSS filters in favor of the robust CSP  
    headers.set("X-XSS-Protection", "0")?;  
      
    // 6\. Strict HSTS policy ensuring encrypted transit for two years, including subdomains  
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")?;  
      
    // 7\. Prevent referrer leakage to external systems during navigation  
    headers.set("Referrer-Policy", "no-referrer")?;  
      
    // 8\. Custom security header to defeat standard automated scanner tools  
    headers.set("X-TinyRustLM-Security-Hardened", "2026-ACTIVE")?;

    Ok(headers)  
}

fn strip\_fingerprinting\_headers(mut headers: Headers) \-\> Result\<Headers\> {  
    // Remove headers that disclose infrastructural stack information to thwart reconnaissance  
    let \_ \= headers.remove("via");  
    let \_ \= headers.remove("server");   
    let \_ \= headers.remove("x-powered-by");  
    let \_ \= headers.remove("x-aspnet-version");  
    let \_ \= headers.remove("x-fastly-request-id");  
    let \_ \= headers.remove("x-cache");  
    let \_ \= headers.remove("x-timer");  
    Ok(headers)  
}

This configuration ensures that the browser strictly isolates the application environment. By denying frame ancestors and restricting fetch targets, the relay minimizes the effectiveness of cross-site leaks and unauthorized origin interactions11.

## **Credential Lifecycle and Rotation Design**

The lifecycle of the Workspace Key is structured around a zero-trust in-memory pattern. The architecture guarantees that the credential never touches persistent media and undergoes secure degradation when inactive. The ingestion process begins when the key is read directly from the UI text input element into a Uint8Array. Immediately following this ingestion, the raw string character array inside the JavaScript heap is programmatically cleared, and the text input node's value is forcefully set to an empty string.  
Because WebAssembly lacks native ASLR and stack canaries, a memory corruption vulnerability within a C or Rust dependency could theoretically allow an attacker to dump the WASM linear memory and extract credentials32. To eliminate this risk, the Rust WASM module must implement explicit zeroization for any buffers temporarily holding the key8.

Rust  
use zeroize::Zeroize;

fn ingest\_secret\_key(mut key\_buffer: Vec\<u8\>) {  
    // Convert key buffer into a WebCrypto non-exportable key...  
    // Manually scrub the vector containing raw credentials to prevent linear memory extraction  
    key\_buffer.zeroize();  
}

Following ingestion, the key is imported via the crypto.subtle.importKey() API as an AES-GCM or HMAC key, utilizing the crucial extractable: false flag. The resulting CryptoKey object is handed over to the Secure Web Worker via the postMessage() interface. Because the key is non-exportable, no JavaScript execution running in the main thread—even via a successful XSS payload—can extract the raw byte material from the object7. All communication to MemoryEndpoints.com is subsequently conducted entirely within the isolated Web Worker context.  
The lifecycle is bound by strict timeout parameters. If the agent remains inactive for fifteen minutes, the worker initiates an internal termination sequence, zeroing the active context and destroying the reference to the CryptoKey. Furthermore, all sessions enforce an absolute maximum lifetime of eight hours. Upon reaching this limit, the worker deletes the credentials and halts all synchronization loops, forcing the user to manually re-establish the secure connection.

## **Redacted Structured Logging Schema**

Accidental credential leaks across CDNs, edge servers, and development environments represent a pervasive industry threat. To combat this, the architecture defines a structured logging schema that explicitly restricts the types of data captured in telemetry. The schema enforces structural rules: credential fields must be blocked at the ingestion parser, sensitive identifiers must be hashed using high-entropy algorithms with a local salt, and semantic data—including chat history, prompts, and model bytes—must be replaced with standard redaction markers such as \[REDACTED\_SECURITY\_SECRET\].

JSON  
{  
  "$schema": "https://json-schema.org/draft/2020-12/schema",  
  "title": "RedactedSecurityLog",  
  "type": "object",  
  "properties": {  
    "timestamp": { "type": "string", "format": "date-time" },  
    "transaction\_id": { "type": "string" },  
    "agent\_id\_hash": { "type": "string" },  
    "workspace\_id\_hash": { "type": "string" },  
    "event\_type": { "type": "string" },  
    "capability\_invoked": { "type": "string" },  
    "status": { "type": "string", "enum": \["SUCCESS", "DENIED", "EXHAUSTED", "ERROR"\] },  
    "request\_metadata": {  
      "type": "object",  
      "properties": {  
        "masked\_client\_ip": { "type": "string" },  
        "user\_agent\_category": { "type": "string" },  
        "egress\_domain": { "type": "string" }  
      },  
      "required": \["masked\_client\_ip", "user\_agent\_category", "egress\_domain"\]  
    },  
    "payload\_stats": {  
      "type": "object",  
      "properties": {  
        "payload\_size\_bytes": { "type": "integer" },  
        "vector\_dimensions": { "type": "integer" }  
      },  
      "required": \["payload\_size\_bytes"\]  
    }  
  },  
  "required": \["timestamp", "transaction\_id", "agent\_id\_hash", "event\_type", "status", "payload\_stats"\]  
}

This strict JSON schema ensures that operational metrics, such as payload sizes and event statuses, are preserved for infrastructure monitoring while mathematically guaranteeing that no sensitive memory context or cryptographic key material enters the observability pipeline.

## **Incident Response and Revocation Procedure**

The architecture integrates an automated incident response framework designed to minimize exposure duration in the event of an active workspace key compromise. The procedure is divided into four rapid phases: detection, containment, forensics, and recovery.  
Detection relies on automated edge monitoring. The system triggers an immediate security alert if a single session token initiates requests from multiple distinct geographical IP ranges concurrently, indicating a likely token theft. Similarly, alerts trigger if persistent capability checks fail repeatedly, suggesting an attacker is probing the boundaries of a constrained token, or if a sudden spike in deletion invocations indicates an unauthorized mass purge attempt.  
Containment requires immediate master revocation. An administrator or the automated detection system triggers the invalidation of the workspace session at MemoryEndpoints.com and the Same-Origin Relay backend, blacklisting the token globally. Concurrently, the Same-Origin Relay issues a Server-Sent Event (SSE) or WebSocket broadcast to all active client runtimes. Upon receiving this kill signal, the client UI executes an emergency termination:

JavaScript  
// Emergency termination of the active isolated worker upon kill signal  
secureWorker.terminate();  
console.warn("Security session terminated by administrator. Local memory contexts purged.");

During the forensics phase, incident responders examine the structured, sanitized edge logs to identify the affected transaction IDs. By analyzing the capability\_invoked and payload\_stats fields, responders can assess the scope of the breach without exposing the underlying sensitive PII data. Finally, the recovery phase prompts the user to perform a manual workspace enrollment, enforcing fresh API credential generation and returning the UI state to a secure, disconnected baseline.

## **Security-Focused TDD and Penetration-Test Plan**

To verify that the implementation is hardened against the identified threat vectors before deployment, rigorous automated test suites are integrated into the CI/CD pipeline. These tests encompass Rust unit tests for memory zeroization and JavaScript integration tests for network boundary enforcement.  
The Rust unit tests ensure that sensitive buffers in the WASM environment are reliably scrubbed, preventing extraction via memory dumping techniques.

Rust  
\#\[cfg(test)\]  
mod tests {  
    use super::\*;  
    use zeroize::Zeroize;

    \#\[test\]  
    fn test\_credential\_zeroize\_on\_clear() {  
        let mut key\_vec: Vec\<u8\> \= vec\!\[115, 101, 99, 114, 101, 116\];   
          
        // Validate the vector is initialized correctly  
        assert\_eq\!(key\_vec, vec\!\[115, 101, 99, 114, 101, 116\]);  
          
        // Execute manual zeroization  
        key\_vec.zeroize();  
          
        // Assert the vector holds strictly zeroes, mitigating heap extraction  
        for byte in key\_vec.iter() {  
            assert\_eq\!(\*byte, 0);  
        }  
    }  
}

The JavaScript integration tests act as negative security gates, explicitly attempting to perform forbidden actions against the relay architecture to ensure the mitigations hold firm under adversarial pressure.

JavaScript  
const assert \= require('assert');  
const fetch \= require('node-fetch');

describe('TinyRustLM Same-Origin Relay Security Verification', () \=\> {  
    const relayUrl \= 'https://tinyrustlm.com/api/relay';

    it('Negative Test: Reject direct CORS wildcards', async () \=\> {  
        const res \= await fetch(relayUrl, {  
            method: 'OPTIONS',  
            headers: { 'Origin': 'https://attacker.com' }  
        });  
          
        const allowOrigin \= res.headers.get('access-control-allow-origin');  
        assert.notStrictEqual(allowOrigin, '\*', 'Security Violation: CORS wildcard detected');  
        assert.notStrictEqual(allowOrigin, 'https://attacker.com', 'Security Violation: Untrusted origin allowed');  
    });

    it('Negative Test: Block SSRF loopback injection', async () \=\> {  
        const payload \= {  
            destination: 'http://127.0.0.1:8500/admin', // Attempt unauthorized loopback access  
            capability: 'cap:search\_lt',  
            payload: {}  
        };

        const res \= await fetch(relayUrl, {  
            method: 'POST',  
            headers: {   
                'Content-Type': 'application/json',  
                'X-TinyRustLM-Relay-CSRF': 'active-session-token-123'  
            },  
            body: JSON.stringify(payload)  
        });

        assert.strictEqual(res.status, 403, 'Security Violation: SSRF loopback request not blocked');  
    });

    it('Negative Test: Reject oversized request payload (Exhaustion defense)', async () \=\> {  
        // Generate a 5MB oversized payload to trigger the resource limit  
        const hugePayload \= 'A'.repeat(5 \* 1024 \* 1024);

        const res \= await fetch(relayUrl, {  
            method: 'POST',  
            headers: {   
                'Content-Type': 'application/json',  
                'X-TinyRustLM-Relay-CSRF': 'active-session-token-123'  
            },  
            body: JSON.stringify({ payload: hugePayload })  
        });

        assert.strictEqual(res.status, 413, 'Security Violation: Oversized request not rejected');  
    });

    it('Verify Secure Headers are strictly present', async () \=\> {  
        const res \= await fetch(relayUrl);  
          
        assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');  
        assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');  
        assert.strictEqual(res.headers.get('referrer-policy'), 'no-referrer');  
        assert.strictEqual(res.headers.get('x-xss-protection'), '0');  
        assert.ok(res.headers.get('content-security-policy').includes("default-src 'none'"));  
    });  
});

## **Release-Blocking Security Acceptance Criteria**

Before the optional MemoryEndpoints.com storage connector can be merged into the main branch or deployed to production, the codebase must fulfill a strict set of release-blocking security criteria. These requirements ensure that the foundational security posture of the local-first architecture is not compromised by the network integration.  
The implementation must achieve zero-storage attestation, requiring automated code reviews to verify that no lines of code reference localStorage, IndexedDB, sessionStorage, or caching APIs for the storage of key credentials. The connector must demonstrate explicit opt-in compliance, defaulting entirely to a disconnected state and requiring manual user interaction to toggle the connection and input credentials. The system must prove WASM heap isolation; penetration tests must confirm that WebAssembly heap data buffers containing credential fragments are cleared immediately after a sync cycle is finalized, effectively mitigating memory dump risks33.  
Furthermore, the integration requires a clean dependency scan, exhibiting zero critical or high vulnerabilities in the Rust crates via cargo audit or NPM modules via npm audit. The worker header audit must pass, ensuring that the automated test suite verifies all security headers are present on relay requests and infrastructure fingerprinting headers are fully stripped. The SSRF blocking verification must prove that any attempt to pass loopback, link-local, or private subnets to the relay results in immediate termination and access logging. Finally, diagnostic logs must be audited to confirm no plain-text key logging occurs, strictly adhering to the redacted schema guidelines.  
To ensure the security controls fit the existing TinyRustLM aesthetic without confusing the user, the integration of the connector configuration panel must follow this explicit structural blueprint:  
\+---------------------------------------------------------------------------------+  
| CONNECTORS | | | | \[ \] Enable MemoryEndpoints.com Storage | | (Explicitly opt-in. Enables long-term vector sync features) | | | | \+-------------------------------------------------------------------------+ | | | WORKSPACE SECURE LOGIN | | | | Workspace Key: \[ \*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\* \] | | | | | | | | CAPABILITY SCOPING | | | | \[x\] Connect (Required) \[ \] Save Long-Term (Index) | | | | \[x\] Search Short-Term (Read) \[ \] Delete or Purge (Write) | | | | \[x\] Search Long-Term (Read) \[ \] Admin Policy (Write) | | | \+-------------------------------------------------------------------------+ | | | | ( \! ) PROMINENT SECURITY WARNING | | Generic browser origins are subject to XSS exploits and extension sniffing. | | "Always Approve" policies are disabled for web contexts. Read/Write actions | | will require manual session authorization prompts. | | | \+---------------------------------------------------------------------------------+

#### **Works cited**

1. Turning Cloudflare Into an SSRF Engine, Reaching What You Were Never Meant to See, [https://riversecurity.eu/turning-cloudflare-into-an-ssrf-engine-reaching-what-you-were-never-meant-to-see/](https://riversecurity.eu/turning-cloudflare-into-an-ssrf-engine-reaching-what-you-were-never-meant-to-see/)  
2. Threat modeling agentic AI: a scenario-driven approach, [https://christian-schneider.net/blog/threat-modeling-agentic-ai/](https://christian-schneider.net/blog/threat-modeling-agentic-ai/)  
3. ASP.NET Core Blazor WebAssembly state management | Microsoft Learn, [https://learn.microsoft.com/en-us/aspnet/core/blazor/state-management/webassembly?view=aspnetcore-10.0](https://learn.microsoft.com/en-us/aspnet/core/blazor/state-management/webassembly?view=aspnetcore-10.0)  
4. State Persistence \- Reatom, [https://www.reatom.dev/handbook/persist/](https://www.reatom.dev/handbook/persist/)  
5. Using Web Workers \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/Web\_Workers\_API/Using\_web\_workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)  
6. Introduction to Web Workers in JavaScript \- Listen and Send Messages \- Auth0, [https://auth0.com/blog/speedy-introduction-to-web-workers/](https://auth0.com/blog/speedy-introduction-to-web-workers/)  
7. Update on Web Cryptography \- WebKit, [https://webkit.org/blog/7790/update-on-web-cryptography/](https://webkit.org/blog/7790/update-on-web-cryptography/)  
8. The Memory Gap in WASM-to-WebCrypto Bridges. And how to build a high-assurance browser encrypter in 2026? : r/cryptography \- Reddit, [https://www.reddit.com/r/cryptography/comments/1q444bn/the\_memory\_gap\_in\_wasmtowebcrypto\_bridges\_and\_how/](https://www.reddit.com/r/cryptography/comments/1q444bn/the_memory_gap_in_wasmtowebcrypto_bridges_and_how/)  
9. Set security headers · Cloudflare Workers docs, [https://developers.cloudflare.com/workers/examples/security-headers/](https://developers.cloudflare.com/workers/examples/security-headers/)  
10. WebAssembly as an Attack Surface: New Browser Exploitation | by zerOiQ | MeetCyber, [https://medium.com/meetcyber/webassembly-as-an-attack-surface-new-browser-exploitation-b7acfbd2801f](https://medium.com/meetcyber/webassembly-as-an-attack-surface-new-browser-exploitation-b7acfbd2801f)  
11. Adding Security Headers on Cloudflare \- DEV Community, [https://dev.to/madsstoumann/adding-security-headers-on-cloudflare-2dag](https://dev.to/madsstoumann/adding-security-headers-on-cloudflare-2dag)  
12. Prompt Injection Risks in Agentic AI Systems \- TechAhead, [https://www.techaheadcorp.com/blog/prompt-injection-risks-in-agentic-ai/](https://www.techaheadcorp.com/blog/prompt-injection-risks-in-agentic-ai/)  
13. DualView: Preventing Indirect Prompt Injection in Personal AI Agents \- arXiv, [https://arxiv.org/html/2607.03821v1](https://arxiv.org/html/2607.03821v1)  
14. SSRF vulnerability in @opennextjs/cloudflare proactively mitigated for all Cloudflare customers · Changelog, [https://developers.cloudflare.com/changelog/post/2025-06-17-open-next-ssrf/](https://developers.cloudflare.com/changelog/post/2025-06-17-open-next-ssrf/)  
15. Document-Authored Control-Signal Impersonation: A Low-Cost Indirect Prompt Attack on RAG Safety Boundaries \- arXiv, [https://arxiv.org/html/2606.09005v1](https://arxiv.org/html/2606.09005v1)  
16. Prompt injection is the new SQL injection, and guardrails aren't enough \- Cisco Blogs, [https://blogs.cisco.com/ai/prompt-injection-is-the-new-sql-injection-and-guardrails-arent-enough](https://blogs.cisco.com/ai/prompt-injection-is-the-new-sql-injection-and-guardrails-arent-enough)  
17. Exam Questions 312-50v12 \- Hackzone, [https://hackzone.in/blog/wp-content/uploads/2024/10/312-50v12\_4.pdf](https://hackzone.in/blog/wp-content/uploads/2024/10/312-50v12_4.pdf)  
18. Swivel: Hardening WebAssembly against Spectre \- USENIX, [https://www.usenix.org/system/files/sec21fall-narayan.pdf](https://www.usenix.org/system/files/sec21fall-narayan.pdf)  
19. Indirect Prompt Injection at Scale | by Micheal Lanham | May, 2026 \- Medium, [https://medium.com/@Micheal-Lanham/indirect-prompt-injection-at-scale-2643e089fe3a](https://medium.com/@Micheal-Lanham/indirect-prompt-injection-at-scale-2643e089fe3a)  
20. Authentication State Persistence \- Firebase \- Google, [https://firebase.google.com/docs/auth/web/auth-state-persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence)  
21. Mastering Cross-Window Communication | by Divyansh Singh \- Medium, [https://medium.com/@rgndunes/mastering-cross-window-communication-2c8f65d6ad93](https://medium.com/@rgndunes/mastering-cross-window-communication-2c8f65d6ad93)  
22. Discussion of Please Stop Using Local Storage \- DEV Community, [https://dev.to/rdegges/please-stop-using-local-storage-1i04/comments](https://dev.to/rdegges/please-stop-using-local-storage-1i04/comments)  
23. Web Workers 101 \- Chris Ng, [https://chrisrng.svbtle.com/web-workers-101](https://chrisrng.svbtle.com/web-workers-101)  
24. \[Security\] Server-Side Request Forgery (SSRF) and Cloudflare API Token Leakage via Path Traversal in Artifacts Endpoint · Issue \#6741 · ChatGPTNextWeb/NextChat \- GitHub, [https://github.com/ChatGPTNextWeb/NextChat/issues/6741](https://github.com/ChatGPTNextWeb/NextChat/issues/6741)  
25. WebAssembly and Security: a review \- arXiv, [https://arxiv.org/html/2407.12297v1](https://arxiv.org/html/2407.12297v1)  
26. SecWasm: Information Flow Control for WebAssembly \- Page has been moved, [https://www.cse.chalmers.se/\~andrei/sas22.pdf](https://www.cse.chalmers.se/~andrei/sas22.pdf)  
27. Indirect Prompt Injection Attacks: Real Examples and How to Prevent Them \- Mindgard AI, [https://mindgard.ai/blog/indirect-prompt-injection-examples](https://mindgard.ai/blog/indirect-prompt-injection-examples)  
28. \[Security\] Web Surfer agent vulnerable to indirect prompt injection via page title · Issue \#7457 · microsoft/autogen \- GitHub, [https://github.com/microsoft/autogen/issues/7457](https://github.com/microsoft/autogen/issues/7457)  
29. browser sessionStorage. share between tabs? \- Stack Overflow, [https://stackoverflow.com/questions/20325763/browser-sessionstorage-share-between-tabs](https://stackoverflow.com/questions/20325763/browser-sessionstorage-share-between-tabs)  
30. WasmSec-WebAssembly Security Papers, [https://wasm-papers.github.io/](https://wasm-papers.github.io/)  
31. Threat Modeling AI Systems: Why STRIDE Is Not Enough \- SecurifyAI, [https://securifyai.co/blog/threat-modeling-ai-systems/](https://securifyai.co/blog/threat-modeling-ai-systems/)  
32. Security \- WebAssembly, [https://webassembly.org/docs/security/](https://webassembly.org/docs/security/)  
33. Wemby's Web: Hunting for Memory Corruption in WebAssembly, [https://www.ias.cs.tu-bs.de/publications/wemby.pdf](https://www.ias.cs.tu-bs.de/publications/wemby.pdf)  
34. Memory hygiene concerns when bridging WASM (Argon2id) and the Web Crypto API(SubtleCrypto) : r/learnjavascript \- Reddit, [https://www.reddit.com/r/learnjavascript/comments/1q45201/memory\_hygiene\_concerns\_when\_bridging\_wasm/](https://www.reddit.com/r/learnjavascript/comments/1q45201/memory_hygiene_concerns_when_bridging_wasm/)  
35. How does \#onmessage and \#postmessage work to communicate between main thread and HTML5's webworkers? \- Stack Overflow, [https://stackoverflow.com/questions/38532535/how-does-onmessage-and-postmessage-work-to-communicate-between-main-thread-and](https://stackoverflow.com/questions/38532535/how-does-onmessage-and-postmessage-work-to-communicate-between-main-thread-and)
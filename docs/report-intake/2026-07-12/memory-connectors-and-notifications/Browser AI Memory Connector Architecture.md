# **Secure Optional MATM Memory Connector for Browser-Only AI Architecture**

## **Introduction to the Stateless Browser Agent Paradigm**

The deployment of artificial intelligence models directly within the browser represents a significant paradigm shift in edge computing. By leveraging technologies such as WebAssembly, WebGL, and WebGPU, runtimes like the UAIX.LmRuntime framework facilitate the execution of quantized Large Language Models (LLMs) entirely on the client device1. This architecture, particularly when utilizing the UAIX.LmRuntime.LocalEndpoint facade for application integration, guarantees localized data processing, deterministic greedy generation, and strict session isolation without relying on provider API brokers2.  
However, this localized execution environment introduces profound challenges regarding state persistence and behavioral continuity. A purely browser-based agent operates within a highly ephemeral container subject to unpredictable lifecycle interventions. Background tab suspension, private browsing data purges, and aggressive origin-based storage eviction render the browser an inherently hostile environment for long-term data retention4. Consequently, a browser-only AI possesses no reliable filesystem, no host-level agent account, and no intrinsic mechanism for cross-device state synchronization.  
Standard AI architectural guidance strictly discourages the reliance on hosted short-term memory, advocating instead for local active-memory packages that ensure resilience and continuous availability during network outages6. Nevertheless, the browser-only use case constitutes an explicit exception to this rule. To prevent behavioral state decay in long-horizon tasks—where critical decision-relevant context is pushed beyond the model's finite context window—the system requires a robust, externalized memory infrastructure7. This necessitates the design of a secure, optional Multi-Agent Transactive Memory (MATM) connector. This connector allows the stateless browser AI to interface with an external Memory-as-a-Service (MaaS) endpoint using a configured account token and a mutually agreed-upon agent identity, effectively bridging the gap between ephemeral client execution and durable cognitive state.

## **UAIX Active-Memory Semantics and Database Serialization**

Historically, memory implementations in OpenClaw and similar agent harnesses have relied heavily on literal filesystem abstractions. Long-term durable facts, preferences, and governing instructions were persisted in a monolithic MEMORY.md file, while short-term conversational context was logged in date-stamped YYYY-MM-DD.md working files8. When an agent required historical context, it utilized a two-step reactive process involving memory\_search to find relevant markdown chunks and memory\_get to read specific file ranges8.  
Migrating this architecture to a browser-only AI backed by a NoSQL or relational MaaS database requires a fundamental semantic translation. Pretending that database rows are literal markdown files is an architectural anti-pattern that creates severe latency bottlenecks and retrieval inefficiencies. Instead, the memory must be decomposed into discrete, highly structured semantic records.

### **Resolving the Redundancy of Active Versus Short-Term Memory**

A critical step in this translation is eliminating the redundant conceptual boundaries between "active memory" and "short-term memory." In traditional architectures, "active memory" often denotes a proactive system feature—a blocking sub-agent that executes before the main reply to inject relevant context into the prompt6—while "short-term memory" simply refers to recent conversation logs.  
In a database-backed MATM architecture, memory is treated as a unified, continuous topological space9. The concept of "active" no longer describes a storage tier; rather, it describes a transient retrieval state. Memory records are dynamically queried and loaded into the active context window based on their semantic relevance, cryptographic lineage, and timestamp priority, rendering arbitrary distinctions between short-term and mid-term storage obsolete.

### **Defining the Minimum Record Structure**

To govern the agent's behavioral state securely and effectively, the database schema must encapsulate specific operational mandates without relying on monolithic text blobs. The architecture necessitates the following minimum record types, implemented as discrete database rows or JSON documents:

| Semantic Classification | Record Purpose and Characteristics |
| :---- | :---- |
| **Governing Instructions** | Immutable or highly persistent directives defining the agent's baseline identity, behavioral constraints, and tonal alignment. These records are never aged out automatically. |
| **Identity Profile** | Cryptographically verified .uaix profile evidence establishing the agent's operational boundaries, capabilities, and authorized interaction scopes1. |
| **Active Objective** | The current multi-turn goal or task hierarchy the agent is attempting to fulfill, allowing the agent to resume execution immediately following a browser restart. |
| **Recent Decisions** | Action-sensitive memories detailing conditional logic, safe-to-act timing, and approval requirements (e.g., waiting for user confirmation before executing a secure payload)8. |
| **Unresolved Risks** | Quarantined context that failed initial provenance checks, triggered anomaly detection, or requires explicit human audit prior to integration into the active prompt10. |
| **Handoffs** | Protocol packets detailing the rules of engagement for supervised agent-to-agent collaboration or the delegation of tasks to external service routines10. |
| **Recovery Pointers** | Checkpoint references enabling the agent to resume a suspended task across duplicate browser tabs or following an unexpected out-of-memory crash. |

These classifications ensure that the database representation directly supports the active-memory sub-agent's requirement to construct prompt injections dynamically, without parsing unstructured markdown files.

## **Browser Security and Lifecycle Constraints**

Operating a secure MATM connector entirely within a web browser necessitates a rigorous defense against the unique threat vectors inherent to the web platform. The architecture must align with the STRIDE threat model, systematically addressing Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege within the constraints of the client device11.

### **Local Storage Boundaries: IndexedDB Versus OPFS**

The connector requires a local caching mechanism to buffer memory operations and sustain functionality during transient network outages. The two primary candidates for browser-based persistence are IndexedDB and the Origin Private File System (OPFS).  
While OPFS provides high-performance, byte-level file access and is frequently utilized for large binary workloads such as compiled SQLite databases or WebAssembly model weights, it presents specific security and operational drawbacks for this architecture. Research indicates that OPFS access patterns can be exploited via Website Fingerprinting timing attacks (e.g., the FROST attack), which monitor Solid State Drive (SSD) contention to extract tracking signals across origins13. Furthermore, OPFS lacks native querying capabilities, secondary indexes, and asynchronous transactional structures, requiring developers to implement complex two-tier caching architectures to manage metadata14.  
Consequently, IndexedDB is the mandated storage boundary for the MATM memory cache. IndexedDB natively supports the storage of complex JSON objects, provides transactional integrity, and utilizes composite indexes for efficient semantic and temporal querying16. While its raw throughput is lower than OPFS, it is vastly superior for managing the highly structured, relational metadata required by the memory connector.

### **Managing Storage Eviction and Browser Lifecycle Suspensions**

Browser engines aggressively govern local storage consumption to protect device resources and prevent fingerprinting. Storage limits vary wildly: Chromium-based browsers may permit an origin to utilize up to 60% of the total disk, whereas Firefox calculates quotas based on either 10% of the disk or a hard 10 GiB group limit4. Safari enforces even stricter limits, particularly for non-browser embedded web views, which are capped at approximately 15% of the disk4.  
Crucially, when a browser detects storage pressure, it executes a total eviction. Data eviction is an all-or-nothing event; the browser deletes the entire storage bucket for an origin—including IndexedDB, Cache API, and OPFS data—without warning or partial cleanup5. Furthermore, if the user operates within Private Browsing or Incognito modes, the storage is fundamentally volatile and is guaranteed to be purged upon session termination4.  
To survive these lifecycle constraints, the architecture must treat IndexedDB strictly as an ephemeral, best-effort cache rather than a durable source of truth. All authoritative memory state mutations must be synchronized with the external MaaS endpoint. The connector must gracefully degrade to a stateless mode if IndexedDB is unexpectedly wiped, dynamically fetching active objectives and governing instructions from the network upon initialization.

### **Defending Against XSS, Extension Access, and Token Theft**

The browser execution environment dictates that any JavaScript running in the main thread is highly susceptible to Cross-Site Scripting (XSS) vulnerabilities and unauthorized access by malicious browser extensions18. A successful XSS attack could result in the total compromise of the agent's identity, the exfiltration of sensitive memory trajectories, and the theft of the external MaaS OAuth token.  
To mitigate these threats, the architecture enforces strict isolation boundaries. OAuth access tokens, refresh tokens, and raw cryptographic key materials must never be stored in localStorage or sessionStorage, as these APIs are synchronously accessible to any script executing on the page18.  
Instead, the architecture relies on a Service Worker to manage the authentication lifecycle. The Service Worker independently initiates the OAuth 2.0 Authorization Code flow with Proof Key for Code Exchange (PKCE), intercepts the authorization code, and executes the token exchange20. The resulting access token is retained exclusively within the Service Worker's isolated closure memory. The main frontend application never possesses the token; it simply routes its memory API requests through the Service Worker, which transparently appends the authorization bearer header before dispatching the network request18.  
For local data encryption within IndexedDB, the connector relies on the Web Crypto API. The system generates an AES-GCM symmetric master key configured with the extractable: false flag. This ensures that while the key resides in the browser's cryptographic keystore and can be used to encrypt and decrypt the IndexedDB cache, the raw key material can never be exported or read by JavaScript, entirely neutralizing the threat of key exfiltration via XSS19.

### **Strict Content Security Policy and Cross-Origin Isolation**

The deployment must enforce a rigorous Content Security Policy (CSP). The connect-src directive must be heavily restricted to the specific domain of the MaaS provider and authorized WebSocket signaling servers. This prevents an injected script from communicating with arbitrary third-party command-and-control servers.  
If the local AI execution utilizes multi-threaded WebAssembly (requiring SharedArrayBuffer for tensor math), the browser mandates Cross-Origin Isolation via the Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP) headers. This isolation prevents Spectre-style timing attacks from reading memory across processes, further protecting the agent's internal state during generation.

### **Telemetry and Embedding Constraints**

Given the sensitivity of the memory context, strict rules govern data handling. Information retrieved from the MATM connector must be classified as highly confidential. Raw memory payloads, user prompts, and recalled summaries must never be embedded in JavaScript application bundles, encoded into URL query parameters, transmitted in plain-text telemetry logs, or appended to unencrypted crash reports12.  
When injecting retrieved memory into the local LLM prompt, the context must be explicitly demarcated to prevent prompt injection attacks. Recalled memories are fenced within untrusted metadata tags (e.g., \<active\_memory\_plugin\>...\</active\_memory\_plugin\>) and accompanied by a strict system warning dictating that the contents are historical context and must not be treated as executable commands or overriding instructions6.

## **Agent Identity Establishment and Recovery**

A browser-only AI faces the unique challenge of maintaining a persistent identity without the benefit of a host operating system account or a traditional user authentication portal. The agent must independently establish, verify, and recover its identity across multiple sessions, overlapping browser tabs, and diverse physical devices.

### **Identity Generation and Display Names**

Upon the initial execution of the agent in a pristine browser environment, the system initiates an identity bootstrapping protocol. The agent and the human operator agree upon an arbitrary display name and an operating persona.  
To formalize this identity, the connector generates an asymmetric cryptographic key pair (e.g., ECDSA P-256) via the Web Crypto API, utilizing the extractable: false parameter for the private key. This key pair is mathematically bound to a newly generated, stable Agent ID (a UUIDv4). The public key, the Agent ID, and the initial display name are transmitted to the MaaS provider during the initial handshake. This public key serves as the foundational root of trust for the agent. Subsequently, every memory record, update, and protocol packet submitted to the MATM network is digitally signed using the non-extractable private key, completely satisfying the non-repudiation requirement of the STRIDE model12.

### **Token Scopes and Tenant Isolation**

When requesting an access token from the MaaS authorization server, the Service Worker negotiates specific, fine-grained OAuth scopes to enforce the principle of least privilege. The required scopes include:

* memory:write \- Authorized exclusively for the agent's own unique partition, preventing the modification of global records.  
* memory:read:self \- Permits the retrieval of the agent's private historical context and active objectives.  
* memory:read:mesh \- Permits querying public, anonymized MATM population trajectories to leverage collective intelligence, while explicitly blocking access to the private active memory of other specific agents24.

Tenant isolation is strictly enforced at the server level. The MaaS backend validates the authorization bearer token against the requested agent\_id parameter within the API payload. Any discrepancy between the token's subject identity and the target record's owner results in an immediate HTTP 403 Forbidden response, neutralizing the threat of Information Disclosure and Elevation of Privilege across shared network topologies.

### **Managing Duplicate Tabs and Shared-Device Risks**

Browser environments inherently support parallel execution across multiple tabs. If an end-user opens the agent interface in three separate tabs simultaneously, executing three independent active-memory sub-agents would result in API rate-limiting, data corruption, and conflicting state mutations.  
To resolve this race condition, the connector implements a leader election algorithm utilizing the BroadcastChannel API. Upon initialization, all tabs communicate via a shared channel to elect a single "Leader" tab. The Leader assumes exclusive responsibility for maintaining the active WebSocket connection to the MaaS endpoint and coordinating all memory synchronization operations. Follower tabs delegate their memory read/write requests to the Leader via message passing. If the user closes the Leader tab, a new election is triggered, and a new Leader is established within milliseconds without interrupting the user experience.  
On shared physical devices, the primary risk involves a secondary user accessing the agent's IndexedDB cache or active session. To mitigate this shared-device risk, the connector relies on the ephemeral nature of the in-memory Service Worker token. When the browser is closed, the session memory is cleared, effectively locking the agent's connection to the MaaS provider until a new authentication flow is manually initiated by the authorized user.

### **Token Rotation, Logout, and Lost Local State**

Security best practices mandate continuous token rotation to limit the lifespan of compromised credentials. The Service Worker autonomously manages this lifecycle. Upon receiving an HTTP 401 Unauthorized response indicating token expiration, the Service Worker intercepts the failure, utilizes its secure refresh token to obtain a new access token via the /token endpoint, and transparently replays the original memory API request20. This ensures the agent maintains a continuous cognitive state without disrupting the user's conversational flow.  
During an explicit user-initiated logout, the architecture executes an aggressive teardown routine. The Service Worker transmits a revocation request to the MaaS authorization server, invalidating all active refresh and access tokens. Simultaneously, the client application executes a destructive deleteDatabase() command against the local IndexedDB cache and abandons the Web Crypto key references, ensuring zero remanence of sensitive behavioral data on the physical disk.  
If a returning user authenticates on a device where the IndexedDB cache was previously evicted by the browser's storage manager, the agent detects the lost local state during initialization. The Service Worker triggers an immediate "Recovery Sync," pulling all active objectives, unresolved risks, and recent decisions from the MaaS provider to reconstruct the agent's working memory dynamically.

## **API Definitions and Memory Lifecycle Management**

The MATM memory connector interacts with the external database via a strictly defined API surface. This API translates the fluid, cognitive requirements of the AI into structured, transactional network requests. The API accommodates the complete lifecycle of a Cognitive Memory Block (CMB), supporting retrieval, promotion, expiration, and semantic search27.

### **Detailed API Specifications**

| API Endpoint & Verb | Functional Description and Mandatory Attributes |
| :---- | :---- |
| **POST /v1/memory/records** (Save) | Inserts a new memory record. The payload includes the structured CAT7 fields, a client-generated UUIDv4, and an idempotency\_key to prevent duplicate entries during unstable network retries. |
| **GET /v1/memory/records/{id}** (Retrieve) | Fetches a specific memory record by its unique identifier. Enforces scope validation to ensure the requesting token matches the record's ownership. |
| **POST /v1/memory/search** (Semantic Search) | Executes a hybrid search against the database, combining dense vector similarity (semantic meaning) with exact keyword matching8. The request payload includes vector embeddings generated locally by the browser's lightweight embedding model. |
| **PUT /v1/memory/records/{id}** (Update) | Modifies an existing record. Requires an If-Match HTTP header containing the current revision ETag to enforce optimistic concurrency control, rejecting stale updates. |
| **POST /v1/memory/records/{id}/supersede** (Supersede) | Creates a new memory block that explicitly replaces an older one. The system maintains a lineage graph (recording parents and ancestors) to ensure traceability, claim-grounding, and rollback capabilities9. |
| **DELETE /v1/memory/records/{id}** (Expire) | Executes a soft-delete on a record. Additionally, the database engine utilizes the intrinsic ttl\_timestamp attribute to automatically age out ephemeral conversational context without requiring explicit client requests. |
| **POST /v1/memory/promote** (Promote) | Elevates a short-term conversational observation into a durable, long-term governing instruction. This replicates the offline "dreaming" sweeps of traditional active memory, executing the promotion securely on the server side8. |
| **POST /v1/mesh/publish** (Distribute) | Anonymizes and broadcasts a successful action-observation trajectory to the MATM shared repository. This enables consumer agents across the network to retrieve procedural knowledge and improve task efficiency without repetitive discovery24. |
| **POST /v1/mesh/acknowledge** (Acknowledge) | Registers an agent's formal adoption of a distributed skill or protocol packet. Requires the attachment of audit evidence and verified rollback metadata to prevent the blind adoption of unsafe external capabilities10. |

### **JSON Schema Specification Example**

The following JSON payload illustrates a compliant MATM save request. This schema demonstrates the mapping of nuanced UAIX active-memory semantics into a highly structured database record, complete with lifecycle and authority attributes:

JSON  
{  
  "record\_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",  
  "agent\_id": "agent-883a-4f91",  
  "semantic\_class": "decision",  
  "action\_class": "act",  
  "sensitivity\_classification": "confidential",  
  "lifecycle": {  
    "created\_at": 1783861800,  
    "ttl\_timestamp": 1783948200,  
    "revision": 1  
  },  
  "cat7\_payload": {  
    "focus": "API payload formatting",  
    "issue": "Postgres authentication error during connection",  
    "intent": "Preemptively format database calls to avoid failure",  
    "motivation": "Ensure zero-downtime execution",  
    "commitment": "Use SSL mode require for all future connections",  
    "perspective": "Database driver enforces strict TLS protocols",  
    "mood": { "valence": 0.8, "arousal": 0.5 }  
  },  
  "authority": {  
    "source\_reference": "user\_prompt",  
    "signature": "3045022100e...a9f",  
    "trust\_level": "verified"  
  },  
  "lineage": {  
    "parent\_id": "b32b10a-...",  
    "superseded\_by": null  
  },  
  "idempotency\_key": "req-99482-abc"  
}

### **Optimistic Concurrency and Multi-Device Conflict Arbitration**

In multi-device scenarios—such as a user interacting with the AI via a mobile browser while simultaneously maintaining an open desktop session—the external MaaS database serves as the definitive source of truth. The system manages state alignment via optimistic concurrency.  
When a record is retrieved, it includes a revision number or ETag. If the desktop session attempts an update or supersede operation using an outdated ETag (because the mobile session already mutated the record), the MaaS API rejects the request with an HTTP 409 Conflict. The desktop client intercepts this response, fetches the latest authoritative state from the server, merges the data, and transparently prompts the local LLM to re-evaluate the context before proceeding.

### **Offline Behavior and the IndexedDB Outbox Pattern**

A fundamental vulnerability of purely web-based architectures is network instability. If the MaaS endpoint becomes temporarily unreachable, the browser-only AI must not suffer a catastrophic failure.  
The connector is designed to degrade gracefully. When the Service Worker detects a network failure (either via navigator.onLine transitioning to false or repeated HTTP timeout errors), it intercepts all outbound API requests and routes them to the local IndexedDB cache.

* **Reads:** The agent continues to execute semantic searches and record retrievals against the local IndexedDB dataset. While the agent loses real-time access to the global MATM population data, its personal identity, critical governing instructions, and recent active objectives remain fully available.  
* **Writes:** All save, update, supersede, and promote operations are cryptographically signed locally and pushed into a dedicated "Outbox" queue within IndexedDB. The agent proceeds with its conversational responses as if the network operations succeeded.

Upon regaining connectivity, the Service Worker initiates a background synchronization routine. It sequentially drains the Outbox queue, transmitting the deferred memory records to the MaaS endpoint. If the server detects a timestamp collision or a branching lineage graph during this sync, the agent employs MATM conflict resolution logic, arbitrating the discrepancy based on timestamp priority, source credibility weighting, and explicit user intent30.

## **Implementation Deliverables and UX Flows**

Deploying the MATM memory connector effectively requires careful consideration of the user experience, operational limits, and configuration mechanics.

### **UX Flows and Diagnostic Visibility**

Because active memory systems inherently capture and transmit highly contextual personal data, the User Experience (UX) flow must enforce explicit consent and transparency14.

1. **Onboarding:** Prior to activation, the user is presented with a concise consent interface detailing that behavioral memory will be encrypted, stored locally in IndexedDB, and synchronized to an external MaaS provider for persistence.  
2. **Live Diagnostics:** To prevent the AI from acting as an opaque black box, the chat interface must support diagnostic slash commands. Invoking /verbose on appends a latency and status line after the agent's reply, while /trace on reveals the exact summarized memory text that the sub-agent injected into the background context6. Executing /trace raw allows the operator to inspect the exact untrusted \<active\_memory\_plugin\> XML boundaries injected into the LLM prompt6.  
3. **Data Deletion:** The interface must provide a distinct "Wipe Memory" function. Triggering this flow executes an Expire command against all associated records on the MaaS server and immediately runs the destructive deleteDatabase() sequence on the local IndexedDB cache.

### **Manifest and Settings Schema**

The operational behavior of the connector is governed by a strict JSON configuration manifest. This manifest defines the storage boundaries, network latency budgets, and prompt injection styles:

JSON  
{  
  "connector": "matm-maas-adapter",  
  "version": "1.0.0",  
  "enabled": true,  
  "storage": {  
    "local\_boundary": "indexeddb",  
    "encryption\_algorithm": "aes-256-gcm",  
    "key\_extractable": false,  
    "eviction\_policy": "lru\_best\_effort"  
  },  
  "network": {  
    "endpoint": "https://api.maas.provider/v1",  
    "timeoutMs": 15000,  
    "setupGraceTimeoutMs": 30000,  
    "offline\_queueing": true  
  },  
  "agent\_behavior": {  
    "queryMode": "recent",  
    "promptStyle": "balanced",  
    "maxSummaryChars": 220,  
    "circuitBreakerMaxTimeouts": 3  
  }  
}

The inclusion of the setupGraceTimeoutMs parameter is critical for browser-based execution. During a "cold start" (e.g., immediately after the user launches the browser), the system requires significant time to initialize WebAssembly runtimes, compile shaders, and load dense embedding matrices into memory. The grace timeout provides an extended budget, preventing the active-memory sub-agent from falsely reporting a network failure while the browser is simply warming up its local execution environment6.

### **Performance Limits and the Privacy Threat Model**

The performance of the connector is inherently bound by the browser's execution limits. While IndexedDB can handle tens of thousands of records, deep semantic vector searches over large datasets in JavaScript will eventually block the main thread if not carefully managed. Consequently, the local embedding model must be heavily quantized, and vector searches should ideally be executed within a dedicated Web Worker to maintain UI responsiveness17.  
The privacy threat model acknowledges that while the Service Worker and Web Crypto API provide robust defenses against XSS, they cannot defend against host-level malware or physical device compromise. If a sophisticated attacker gains root access to the user's operating system, they can extract the browser's underlying profile directory, bypass the origin isolation, and dump the IndexedDB contents. Therefore, the sensitivity classification of stored memories must dictate the agent's behavior; highly confidential data (e.g., passwords or API keys) should never be committed to the memory stream, relying instead on explicit, ephemeral user inputs.

## **End-to-End Testing Matrix**

To guarantee the architectural integrity, security, and reliability of the MATM memory connector, the implementation must pass a rigorous, multidimensional end-to-end testing matrix prior to deployment.

1. **Cross-Browser Storage Eviction:** Simulate the browser hitting its aggressive disk quota limit (e.g., 60% in Chrome, 15% in Safari WKWebView)4. Trigger a manual eviction of the IndexedDB cache via the developer tools. Verify that the agent detects the loss, automatically issues a Recovery Sync to the MaaS endpoint, and seamlessly reconstructs its active working memory without halting the conversation.  
2. **Duplicate Tab Race Conditions:** Open the browser-only AI in three parallel tabs simultaneously. Submit a memory-altering prompt in Tab A. Verify that Tab B and Tab C immediately reflect the updated state via BroadcastChannel synchronization, and explicitly confirm via network interception that only the elected Leader tab executed the outbound API call.  
3. **Token Rotation and Refresh Resiliency:** Intercept the network traffic and artificially inject an HTTP 401 Unauthorized response to simulate an expired access token. Verify that the Service Worker intercepts the failure, utilizes the refresh token to negotiate a new bearer token, and transparently replays the failed memory API call without requiring the user to re-authenticate or losing the chat context20.  
4. **Tenant Isolation and Authorization Spoofing:** Attempt to forge a Retrieve API request utilizing Agent A's valid OAuth token to read a record\_id known to belong to Agent B. Verify that the MaaS backend strictly returns an HTTP 403 Forbidden, successfully evaluating the token subject against the requested record's ownership boundaries.  
5. **XSS Exploitation Simulation:** Inject a simulated, malicious Cross-Site Scripting payload directly into the main DOM via the browser console. Confirm that the script is physically incapable of accessing the OAuth bearer token (safely isolated within the Service Worker) and cannot extract the AES-GCM master encryption key (secured by the Web Crypto API's extractable: false parameter)19.  
6. **Offline Conflict Arbitration:** Disconnect the client device from the network. Modify an identical memory record locally via the browser AI, and remotely via a separate, connected desktop client. Reconnect the browser to the network, triggering the background Outbox sync. Verify that the agent intercepts the resulting HTTP 409 Conflict, parses the differing ETags, and successfully resolves the branched lineage graph according to the MATM conflict arbitration logic30.

#### **Works cited**

1. UAIX.LmRuntime.Backends.Cuda \- NuGet Package Security Analys, [https://socket.dev/nuget/package/uaix.lmruntime.backends.cuda/overview/3.3.28](https://socket.dev/nuget/package/uaix.lmruntime.backends.cuda/overview/3.3.28)  
2. UAIX.LmRuntime — Local GGUF and LLaMA runtime packages for .NET, [https://lmruntime.com/](https://lmruntime.com/)  
3. UAIX.LmRuntime Package Answer Index | Install, Boundaries, and NuGet Links, [https://lmruntime.com/answer-engine-optimization/](https://lmruntime.com/answer-engine-optimization/)  
4. Storage quotas and eviction criteria \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/Storage\_API/Storage\_quotas\_and\_eviction\_criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)  
5. The Browser Storage API \+ Cheat Sheet | by Tanvi Dadwal | Medium, [https://medium.com/@tanvidadwal799/the-browser-storage-api-cheat-sheet-be6e4afff0c0](https://medium.com/@tanvidadwal799/the-browser-storage-api-cheat-sheet-be6e4afff0c0)  
6. Active memory \- OpenClaw Docs, [https://docs.openclaw.ai/concepts/active-memory](https://docs.openclaw.ai/concepts/active-memory)  
7. Active Memory: Defeating Behavioral State Decay | StartupHub.ai, [https://www.startuphub.ai/ai-news/ai-research/2026/active-memory-defeating-behavioral-state-decay](https://www.startuphub.ai/ai-news/ai-research/2026/active-memory-defeating-behavioral-state-decay)  
8. Memory overview \- OpenClaw Docs, [https://docs.openclaw.ai/concepts/memory](https://docs.openclaw.ai/concepts/memory)  
9. Mesh Memory Protocol: Semantic Infrastructure for Multi-Agent LLM Systems \- arXiv, [https://arxiv.org/html/2604.19540v1](https://arxiv.org/html/2604.19540v1)  
10. NeuralWikis Exchange \- AI-Agent Knowledge Exchange, [https://neuralwikis.com/](https://neuralwikis.com/)  
11. What Is the STRIDE Threat Model? Beginner's Guide \- 2026 \- Practical DevSecOps, [https://www.practical-devsecops.com/what-is-stride-threat-model/](https://www.practical-devsecops.com/what-is-stride-threat-model/)  
12. Threat Modeling Explained: STRIDE in Practice \- Strobes Security, [https://strobes.co/blog/threat-modeling-explained-stride/](https://strobes.co/blog/threat-modeling-explained-stride/)  
13. The browser feature that turns SSD timing into a tracking signal, [https://webiano.digital/the-browser-feature-that-turns-ssd-timing-into-a-tracking-signal/](https://webiano.digital/the-browser-feature-that-turns-ssd-timing-into-a-tracking-signal/)  
14. 3x faster project loads with the origin private file system \- Between the Barndoors, [https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/](https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/)  
15. Browser storage APIs for personal projects with Web Storage, IndexedDB, and OPFS, [https://ics.media/en/entry/260603/](https://ics.media/en/entry/260603/)  
16. Instant Performance with IndexedDB RxStorage | RxDB \- JavaScript Database, [https://rxdb.info/rx-storage-indexeddb.html](https://rxdb.info/rx-storage-indexeddb.html)  
17. LocalStorage vs. IndexedDB vs. Cookies vs. OPFS vs. WASM-SQLite | RxDB \- JavaScript Database, [https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html)  
18. Overcome Token Storage and Security Challenges of OAuth2 \- Infinum, [https://infinum.com/blog/secure-token-storage-oauth2/](https://infinum.com/blog/secure-token-storage-oauth2/)  
19. How do you make End-to-End encryption as seamless as possible for the User? \- Reddit, [https://www.reddit.com/r/webdev/comments/1qupl6m/how\_do\_you\_make\_endtoend\_encryption\_as\_seamless/](https://www.reddit.com/r/webdev/comments/1qupl6m/how_do_you_make_endtoend_encryption_as_seamless/)  
20. OAuth 2.0 for Browser-Based Apps \- IETF, [https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-10.html](https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-10.html)  
21. draft-ietf-oauth-browser-based-apps-14, [https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps-14](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps-14)  
22. Cryptography Executed in Web Browsers – Achieving Convenient End-to-End Security for Lock Access Control, [https://uu.diva-portal.org/smash/get/diva2:1805402/FULLTEXT01.pdf](https://uu.diva-portal.org/smash/get/diva2:1805402/FULLTEXT01.pdf)  
23. Quelle: strip-inbound-meta.ts (Sprache JAVA) \- Formatika, [https://www.formatika.de/index.jsp?content=source\&detail=products/Sources/formale%20Sprachen/JAVA/openclaw/src/auto-reply/reply/strip-inbound-meta.ts](https://www.formatika.de/index.jsp?content=source&detail=products/Sources/formale+Sprachen/JAVA/openclaw/src/auto-reply/reply/strip-inbound-meta.ts)  
24. Multi-Agent Transactive Memory \- arXiv, [https://arxiv.org/pdf/2606.19911](https://arxiv.org/pdf/2606.19911)  
25. sym-bot/sym: Ask the mesh, answer as one. SYM turns the AI agents you already run into one collective intelligence \- GitHub, [https://github.com/sym-bot/sym](https://github.com/sym-bot/sym)  
26. Storing OAuth Tokens | FusionAuth Docs, [https://fusionauth.io/articles/oauth/oauth-token-storage](https://fusionauth.io/articles/oauth/oauth-token-storage)  
27. Symbolic-Vector Attention Fusion for Collective Intelligence \- arXiv, [https://arxiv.org/pdf/2604.03955](https://arxiv.org/pdf/2604.03955)  
28. Memory \- OpenClaw Docs, [https://docs.openclaw.ai/cli/memory](https://docs.openclaw.ai/cli/memory)  
29. Multi-Agent Transactive Memory \- arXiv, [https://arxiv.org/html/2606.19911v1](https://arxiv.org/html/2606.19911v1)  
30. IAAR-Shanghai/Awesome-AI-Memory \- GitHub, [https://github.com/IAAR-Shanghai/Awesome-AI-Memory](https://github.com/IAAR-Shanghai/Awesome-AI-Memory)  
31. Securing LLM-Agent Long-Term Memory Against Poisoning: Non-Malleable, Origin-Bound Authority with Machine-Checked Guarantees \- arXiv, [https://arxiv.org/pdf/2606.24322](https://arxiv.org/pdf/2606.24322)
# **Architecture and Protocol Design for Disconnected-Agent Notifications**

## **Executive Recommendation**

The coordination of autonomous and human-in-the-loop artificial intelligence agents within a self-hosted, multi-tenant environment presents profound distributed systems challenges. Because these agents operate across diverse form factors—ranging from ephemeral browser sessions and command-line interfaces to background desktop services—and frequently reside behind restrictive corporate firewalls, Network Address Translation (NAT) gateways, and transparent proxies, the architecture cannot rely on traditional synchronous push mechanisms. The absence of a stable IP address, the inability to open inbound firewall rules, and the strict requirement to avoid third-party cloud message brokers mandate a paradigm shift in how coordination services manage state and deliver assignments.  
The recommended architecture is a Hybrid Pull-Push Protocol backed by a Brokerless Transactional Inbox. This design enforces a strict separation of concerns between the notification that work exists (an ephemeral, data-less signal) and the durable delivery of that work (a stateful, cursor-based pull mechanism).  
Within this paradigm, all routing decisions, memory updates, and work assignments are committed to a durable MySQL inbox table within the exact same database transaction as the core business logic. This completely eliminates the dual-write inconsistencies that plague systems relying on independent databases and external message brokers1. When the transaction successfully commits, the coordination service pushes an immediate, lightweight signal via Server-Sent Events (SSE) to any actively connected agent4. Upon receiving this signal, or when a disconnected agent wakes from sleep and re-establishes network connectivity, the agent utilizes an adaptive cursor-based polling mechanism to pull the full payload, claim the work via a visibility lease, and explicitly acknowledge its completion5.  
This decoupling ensures that ephemeral network drops do not result in lost messages, circumvents the requirement for inbound ports on the agent, and guarantees at-least-once delivery with strict concurrency controls using advanced relational database locking semantics.

## **Inbound Port Viability Analysis**

A foundational architectural question in peer-to-peer and agent coordination is whether the central service can push messages by establishing a direct inbound TCP or HTTP connection to the agent. Comprehensive analysis indicates that an inbound port is entirely unviable as a universal delivery mechanism, and must be rejected as the primary transport due to insurmountable security, networking, and lifecycle barriers.  
The primary obstacle is NAT traversal and dynamic IP addressing. The vast majority of desktop and command-line agents reside behind IPv4 NAT gateways. Establishing direct inbound connections to these agents would require complex STUN, TURN, or ICE infrastructure to punch through the NAT, which introduces unacceptable latency, fragility, and infrastructure overhead for a self-hosted coordination service. Furthermore, agent IP addresses are highly dynamic. If a disconnected agent goes to sleep on a corporate network and wakes up on a public Wi-Fi network, it will miss inbound pushes until it successfully registers its new IP address with the coordination service. During the time the machine is asleep or the agent process is stopped, any inbound connection attempt will result in a TCP timeout, forcing the central service to implement complex buffering and retry queues that merely reinvent durable polling mechanisms.  
Transport Layer Security (TLS) presents another critical barrier. Authenticated agents must communicate over encrypted channels to prevent interception and manipulation. However, issuing and validating publicly trusted TLS certificates for dynamic, internal agent IP addresses or local hostnames is practically impossible, as Certificate Authorities like Let's Encrypt require public DNS validation. Without valid TLS, the agent's listener is vulnerable to man-in-the-middle (MITM) attacks and downgrade exploits. Furthermore, browser-based agents are constrained by strict sandbox limitations; web applications fundamentally cannot bind to local network interfaces or open listening ports to accept inbound connections. Port conflicts also arise frequently in desktop environments, where an agent attempting to bind to a static port may clash with existing developer tools or enterprise software.  
Most critically, allowing agents to register arbitrary callback IP addresses and ports opens a severe Server-Side Request Forgery (SSRF) vulnerability vector7. A malicious tenant could register an internal IP address (such as 127.0.0.1 or the 169.254.169.254 cloud metadata endpoint) as their agent's listener. When the coordination service attempts to push a notification, it would unknowingly scan or exploit its own internal subnet, potentially leaking highly sensitive infrastructure credentials or accessing internal administrative panels9. While defensive measures like IP allow-listing and DNS resolution checks exist, they are frequently bypassed by attackers using DNS rebinding techniques, where a domain resolves to a safe external IP during the validation phase but switches to a restricted internal IP during the execution phase9.  
*(Inference)*: Based on these compounding factors, outbound connections initiated by the agent must remain the bedrock of the architecture. While an optional inbound webhook can be supported for strict server-to-server integrations running in controlled environments, it cannot serve as the default or sole delivery mechanism.

## **Transport Comparison and Evaluation**

To facilitate robust outbound-only communication, various transport mechanisms must be evaluated based on connection lifecycle, latency, infrastructure overhead, and reliability under adverse network conditions.

| Transport Mechanism | Connection Lifecycle | Latency Profile | Infrastructure Overhead | Architectural Evaluation |
| :---- | :---- | :---- | :---- | :---- |
| **Cursor-Based Polling** | Ephemeral | High (bounded by interval) | High (HTTP overhead per poll) | Highly reliable fallback. Eliminates offset-based pagination drift by using a stable sequence identifier5. |
| **Adaptive Polling** | Ephemeral | Variable | Medium | Optimizes resource usage by scaling the polling interval mathematically based on activity, saving battery and bandwidth13. |
| **Conditional HTTP Requests** | Ephemeral | High | Medium | Utilizes ETag or Last-Modified headers to return 304 Not Modified, reducing payload transfer but still incurring HTTP handshake costs. |
| **Long Polling** | Held Open | Low (1 RTT after event) | High (Connection churn) | Holds the request open until data arrives, but requires constant TCP reconnects after each event, limiting scalability15. |
| **Server-Sent Events (SSE)** | Persistent (Push) | Near Zero | Low (Unidirectional streaming) | **Recommended Default.** Streams text over standard HTTP, benefits from native browser reconnects, and traverses proxies easily4. |
| **WebSockets** | Persistent (Duplex) | Near Zero | Medium (Custom routing needed) | Provides bidirectional streaming, but the framing overhead and load-balancer state requirements are unnecessary for a pull-heavy model4. |
| **Authenticated Webhooks** | Ephemeral (Inbound) | Low | High (SSRF mitigation, TLS) | **Optional.** Highly efficient for server-to-server agents with static IPs, but requires rigorous cryptographic challenge-response verification17. |
| **Local Wake Daemon** | OS Managed | Low | Very High | Integrates deeply with OS services (systemd, launchd) to wake sleeping processes. Excluded due to the requirement for dependency-free deployment. |

### **Recommended Default: Server-Sent Events with Cursor Pull**

Server-Sent Events (SSE) represent the optimal default transport for connected agents. SSE streams unidirectional text data over standard HTTP/1.1 or HTTP/2, circumventing the complex handshake and custom framing requirements of WebSockets. SSE is vastly superior for notification delivery because it benefits from native browser and HTTP client auto-reconnect logic, requires only the text/event-stream content type, and traverses restrictive corporate proxies that frequently terminate WebSocket upgrades4. Because the flow of work assignments is strictly server-to-client, the bidirectional nature of WebSockets introduces unnecessary complexity4.

### **Fallback Transport: Adaptive Polling**

When an agent is disconnected, or if SSE connections are severed by aggressive middleboxes that do not support long-lived HTTP streams, the agent must seamlessly fall back to Adaptive Polling13. Rather than hammering the server with static intervals, the polling interval scales logarithmically based on the duration since the last received event. The algorithm utilizes the first derivative of the sensor signal—in this case, the frequency of inbox events—to adjust the sampling frequency19. If the agent processes a message, the interval drops to one second. If no messages arrive, the interval increases up to a defined ceiling, minimizing network congestion while guaranteeing eventual discovery14.

### **Optional Transport: Authenticated Webhooks**

For server-based agents operating in stable, publicly routable environments, authenticated webhooks eliminate polling entirely. However, the coordination service must mandate a strict challenge-response handshake upon registration to mitigate SSRF, and restrict callbacks to HTTPS-only URLs outside of private IP ranges18.

## **Notification vs. Durable Delivery: The Hybrid Model**

A critical architectural distinction must be drawn between the "notification that work exists" and the "durable delivery of that work." Attempting to push the full JSON payload over a persistent connection like SSE or WebSockets introduces severe distributed systems vulnerabilities.  
If the server streams a payload and the TCP connection drops mid-frame, or if the agent process crashes immediately after receipt but before processing is complete, the message is permanently lost. This violates the requirement for reliable coordination. Furthermore, transmitting massive payloads over persistent streams blocks event loop threads, fragments the connection, and complicates load balancing4.  
The recommended hybrid model resolves this by mandating that every event is first committed to a durable inbox in the database3. The flow operates as follows: First, the coordination service commits the AI assignment, routing decision, or memory update to the MySQL database. Second, the service emits an immediate, stateless "wake-up" ping over the SSE channel to any connected agent. This ping contains no sensitive data—only a signal that the inbox cursor has advanced (e.g., event: new\_work\\n\\ndata: {"cursor\_hint": 1045}). Third, upon receiving the ping, the agent initiates a standard, authenticated HTTP GET request using its durable cursor to fetch the data.  
Disconnected agents miss the SSE ping entirely. However, because the system relies on a pull-based cursor for recovery, this missed signal is inconsequential. The disconnected agent simply resumes fetching from its last known cursor the moment it regains network connectivity, inherently recovering all missed events in strict sequential order5.

## **Database Mechanics and Transactional Boundaries**

To avoid the dual-write problem—where an application updates an internal state but crashes before publishing the notification to an external message broker—this architecture utilizes the Transactional Inbox/Outbox pattern, strictly requiring no external broker1. The MySQL database acts as both the single source of truth and the queue itself.  
By persisting events into an inbox table as part of the exact same database transaction that updates the core business logic, the system achieves perfect atomicity. If the transaction succeeds, the event is guaranteed to be in the inbox; if it fails, neither the business state nor the event is persisted1. This eliminates the need for complex distributed transactions or saga patterns3.

### **The Concurrency Model: SKIP LOCKED**

To allow multiple instances of a single agent, or multiple distributed coordination server workers, to pull from the inbox concurrently without deadlocking, the protocol utilizes the SELECT ... FOR UPDATE SKIP LOCKED clause available in MySQL 8.0+25.  
When an agent claims work, it executes a query to lock a specific number of rows. Standard SELECT FOR UPDATE queries force concurrent workers to hang and wait for the first worker to finish its transaction, turning a parallel system into a sequential bottleneck26. By appending SKIP LOCKED, the database instructs concurrent queries to simply ignore rows that are already locked by another transaction, instantly grabbing the next available set of rows27. This enables massive horizontal scalability without lock contention29.

### **Gap Lock Mitigation and Indexing**

*(Unresolved Tradeoff Resolution)*: A documented failure mode of SKIP LOCKED in MySQL InnoDB occurs under the default REPEATABLE READ isolation level. To prevent phantom reads, InnoDB utilizes next-key locks, which acquire "gap locks" on the index intervals between records25. These gap locks can inadvertently block concurrent INSERT statements attempting to write new events into the inbox, causing severe performance degradation and deadlocks25.  
To mitigate this behavior, the architecture mandates rigorous indexing and querying strategies. The inbox query must filter on an exact, indexed match for the recipient\_id. By utilizing a composite primary key or a highly selective secondary index (recipient\_id, status, sequence\_number), gap locking is restricted to a negligible subset of rows25. Furthermore, if deadlocks persist under extreme throughput, the specific connection executing the polling query must issue SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED. This safely disables gap locking entirely for the read phase, relying strictly on record locks, which allows continuous concurrent inserts32.

## **State Machine and Lifecycle**

The lifecycle of an inbox message is governed by a strict state machine, ensuring that no work is lost, duplicated, or permanently stalled.

1. **Pending**: The initial state when a transaction commits. The event is available for claiming once the available\_at timestamp is reached.  
2. **Claimed**: An agent has executed a pull request using SKIP LOCKED. The event is assigned a visibility lease (claim\_expires\_at), which temporarily hides it from other workers6. The attempts counter is incremented.  
3. **Completed**: The agent has successfully processed the payload and submitted an acknowledgment. The event is logically marked complete and subsequently hard-deleted or archived to conserve storage.  
4. **Quarantined (Dead-Letter)**: If the agent crashes repeatedly while attempting to process the message, the visibility lease will expire multiple times. Once the attempts counter exceeds the configured threshold, the message transitions to a quarantined state, requiring administrative intervention6.

## **Sequence Analysis**

The protocol flow handles both nominal execution and crash recovery seamlessly.  
During nominal execution, the coordination service commits a new event to the MySQL database and broadcasts an SSE ping to the connected agent. The agent, upon receiving the ping, executes a POST /inbox/claim request, providing its current sequence cursor. The coordination service locks the next available rows using SKIP LOCKED, updates their status to claimed, sets the visibility lease to 60 seconds, and returns the payload to the agent. The agent processes the work, updates its internal state, and issues a POST /inbox/{event\_id}/ack. The service marks the row as completed.  
In a crash recovery scenario, the agent requests the payload and receives it, but the agent process crashes mid-execution. The coordination service receives no acknowledgment. A background scavenger daemon within the coordination service continuously scans the inbox for rows where the status is claimed but the claim\_expires\_at timestamp has passed in the past. The scavenger resets the status of these abandoned rows back to pending and clears the lease6. When the agent restarts, it polls the inbox and safely receives the exact same event again, ensuring at-least-once delivery.  
For externally hosted agents utilizing webhooks, the sequence incorporates a cryptographic challenge. When the agent attempts to register its webhook URL, the coordination service halts the registration and fires a synchronous HTTP POST to the provided URL containing a randomized challenge token. The receiving agent computes an HMAC-SHA256 signature of the token using its private secret and returns it in the HTTP response. The service validates the signature; if it matches, the URL is trusted, neutralizing blind SSRF attacks by proving the endpoint is intentionally configured to receive coordination traffic18.

## **Schema Proposal**

The database schema orchestrates the entire protocol lifecycle, prioritizing indexing for efficient SKIP LOCKED execution.

| Column | Type | Description |
| :---- | :---- | :---- |
| id | BIGINT AUTO\_INCREMENT | Internal physical primary key. |
| event\_id | VARCHAR(64) | Global unique identifier (UUIDv7 or ULID) ensuring client-side idempotency29. |
| tenant\_id | VARCHAR(64) | Workspace or tenant isolation boundary for multi-tenant security. |
| recipient\_id | VARCHAR(64) | The target agent identifier. |
| sequence\_number | BIGINT | A monotonically increasing integer per recipient, acting as the durable cursor. |
| deduplication\_key | VARCHAR(128) | Unique constraint (tenant, recipient, key) preventing identical generation logic from spanning duplicates. |
| priority | INT | Sorting priority, where 0 indicates urgent, 1 indicates normal, and 2 indicates bulk processing. |
| status | VARCHAR(20) | Enum representing pending, claimed, completed, or quarantined. |
| payload | JSON | The actual assignment, message, routing decision, or memory update payload. |
| available\_at | TIMESTAMP | Supports delay scheduling (defaults to current time). |
| expires\_at | TIMESTAMP | Time-to-live for ephemeral work that loses value if delayed. |
| claim\_expires\_at | TIMESTAMP | The expiration time of the current visibility lease. |
| attempts | INT | Number of delivery attempts, used to trigger the dead-letter queue transition. |
| correlation\_id | VARCHAR(64) | Maps the event back to upstream company, workspace, project, or meeting-room entity IDs. |

## **Concrete API Contract**

The application programming interface enforces strict RESTful principles and semantic versioning.

### **1\. Subscribe (SSE)**

GET /api/v1/agents/{agent\_id}/subscribe Establishes the persistent Server-Sent Events stream. The server pushes heartbeat pings every 30 seconds to prevent stateful firewalls and proxies from terminating the idle connection, alongside data-less event notifications.  
Example HTTP Response:

HTTP  
HTTP/1.1 200 OK  
Content-Type: text/event-stream  
Cache-Control: no-cache

event: heartbeat  
data: {}

event: inbox\_updated  
data: {"cursor\_hint": 1045}

### **2\. Poll After Cursor**

GET /api/v1/agents/{agent\_id}/inbox?after\_cursor=1040\&limit=10 Returns all events sequentially following the provided cursor. This endpoint acts exclusively as a read-only synchronization mechanism and does not mutate the state of the events or claim leases, making it highly cacheable and safe for redundant polling12.  
Example JSON Payload:

JSON  
{  
  "events": \[  
    {  
      "event\_id": "evt\_01HGW...",  
      "sequence\_number": 1041,  
      "priority": 0,  
      "correlation\_id": "msg\_99x",  
      "payload": {  
        "type": "meeting\_room\_post",  
        "room\_id": "rm\_8",  
        "content": "Please analyze the attached logs."  
      },  
      "expires\_at": "2026-07-13T00:00:00Z"  
    }  
  \],  
  "next\_cursor": 1041,  
  "has\_more": false  
}

### **3\. Claim (Visibility Lease)**

POST /api/v1/agents/{agent\_id}/inbox/claim The agent explicitly requests to claim a batch of pending events. The coordination service utilizes the SKIP LOCKED query to lock the rows, updates the status to claimed, sets the claim\_expires\_at timestamp to 60 seconds in the future, increments the attempts counter, and returns the batch to the agent6.

### **4\. Acknowledge (ACK)**

POST /api/v1/agents/{agent\_id}/inbox/{event\_id}/ack Upon successful processing of the payload, the agent submits this request to signal completion. The coordination service updates the row status to completed and nullifies the JSON payload to conserve database storage, retaining only the metadata for audit trails.

### **5\. Release (NACK)**

POST /api/v1/agents/{agent\_id}/inbox/{event\_id}/release If the agent determines it cannot currently process the event—for example, due to a missing external dependency or temporary rate limiting on a downstream API—it explicitly releases the lease. This instantly resets the status back to pending and clears the claim\_expires\_at timestamp, allowing the event to be immediately re-consumed by another available worker6.

### **6\. Webhook Callback Registration**

POST /api/v1/agents/{agent\_id}/callbacks Registers an optional inbound webhook endpoint for externally hosted, static-IP agents. This endpoint enforces the mandatory challenge-response validation protocol18.

## **Cryptography, Security, and Least Privilege**

Identity verification and payload integrity are paramount in a multi-tenant environment. Agent identities are authenticated via short-lived JSON Web Tokens (JWTs) generated from a centralized Identity Provider. Long-running desktop and CLI agents store an encrypted refresh token in secure, OS-level local storage (such as the Windows Credential Manager or macOS Keychain). This refresh token continuously grants access to a rotated symmetric key utilized for signature generation.  
To guarantee message authenticity and prevent tampering, all outbound webhooks from the coordination service to the agent, and all critical API calls from the agent to the service, are cryptographically signed using the IETF RFC 9421 HTTP Message Signatures standard36. This formalizes what was previously a fragmented landscape of ad-hoc signature schemes.  
Under RFC 9421, the signature is computed over a canonicalized byte structure of the payload and specific HTTP headers39. The signature base explicitly covers the @method, @path, and @authority pseudo-headers. This strict coverage prevents an attacker from intercepting a valid signature for a harmless /release endpoint and maliciously applying it to the /ack endpoint, as the path mismatch would immediately invalidate the signature. Furthermore, the payload body is protected via the Content-Digest header—a SHA-256 hash of the JSON body—which is subsequently included in the signature base, ensuring absolute payload integrity39.  
Replay attacks are mathematically neutralized by incorporating an expires parameter directly into the signature base39. The coordination service enforces a strict 5-minute validity window. Any request received outside this window is summarily rejected, even if the cryptography is mathematically sound41. To protect against replay attacks occurring within that 5-minute window, the coordination service tracks the specific event\_id and rejects duplicate claims.  
Finally, access is strictly governed by least-privilege scopes. Agents are issued tokens mapped to precise capability schemas. An agent assigned exclusively to Project A is issued an agent:project\_A:read scope. If the agent's host environment is compromised and the token exfiltrated, the blast radius is rigidly confined to that specific agent's inbox and memory state, preventing lateral movement across the multi-tenant architecture.

## **Race Conditions and Distributed State Resolution**

The architecture natively resolves the complex race conditions inherent in disconnected, asynchronous systems.  
**Notification Before Transaction Commit:** Because the event insertion and the core business logic execute within the exact same database transaction, the application tier strictly emits the SSE ping only after the SQL COMMIT returns successfully1. If the business transaction rolls back due to a constraint violation, no signal is broadcast, and no row exists in the inbox.  
**Reconnect During Delivery:** If an agent's network connection drops while it is downloading a large payload from the /claim endpoint, the database has already marked the row as claimed. The agent will not receive the payload, but the visibility lease will continue to tick down. Once the lease expires, the scavenger process reverts the event to pending, and the agent will successfully claim it on the next poll3.  
**Duplicate Delivery and Lost Acknowledgments:** If an agent successfully processes an event but loses network connectivity precisely before the /ack request reaches the server, the visibility lease will eventually expire on the server3. The event returns to pending status, and a second worker will inevitably claim it. To prevent downstream state corruption, agents are mandated to maintain a local SQLite or in-memory LRU cache of recently processed event\_ids, ensuring idempotent execution24.  
**Out-of-Order Receipt:** The pull-based /inbox endpoint strictly orders queries by sequence\_number ASC28. Even if multiple agent threads are processing messages concurrently, the database query guarantees monotonic delivery, preventing older memory updates from overwriting newer states.  
**Two Processes Using One Agent Identity:** If a user runs the CLI agent on two laptops simultaneously using the identical authentication identity, the SKIP LOCKED semantics resolve the concurrency elegantly. Laptop A will lock rows 1-5, and Laptop B will seamlessly skip those and lock rows 6-10. Work is load-balanced across the duplicate instances without manual intervention or deadlocking26.  
**Agent Offline Longer Than Retention:** Rows older than the global retention policy (e.g., 30 days) are moved to cold storage and deleted from the active inbox to preserve database performance. When a severely delayed agent finally connects, its requested cursor will be determined invalid because it points to purged data. The coordination service responds with a 410 Gone error, forcing the agent to trigger a "full state sync" protocol. The agent must download its current baseline memory state rather than attempting to sequentially play back 30 days of stale event deltas12.

## **Threat Model, Failure-Mode Analysis, and Chaos Testing**

A comprehensive threat model identifies key failure modes and establishes robust mitigation strategies, which must be verified through rigorous chaos engineering.

| Threat / Failure Mode | Architectural Mitigation Strategy | Chaos Testing Validation |
| :---- | :---- | :---- |
| **Database Outage** | The agent's HTTP /inbox request receives a 5xx status. The agent enters exponential backoff. No events are lost because upstream systems fail the primary transaction. | Terminate the primary MySQL instance during load testing. Assert that agents back off and resume cleanly upon failover. |
| **SSE Connection Drop** | The agent falls back to Adaptive Polling. The durable cursor ensures it fetches all missed events exactly once upon reconnecting5. | Inject TCP resets via proxies. Assert that the agent switches to polling and recovers the sequence correctly. |
| **Poison Pill Payload** | If an agent continually crashes while parsing a malformed payload, the lease expires repeatedly. Upon reaching attempts \> 5, the server transitions the event to quarantined (Dead-Letter) to prevent infinite crash loops29. | Deploy a deliberately malformed payload. Assert that the agent crashes, the lease expires, and the event moves to Quarantine after 5 attempts. |
| **Rogue Agent Denial of Service** | An agent maliciously spamming /claim without acknowledging events will exhaust its global concurrency limit. The server rejects leases for agents with excessively high unacknowledged claim counts. | Simulate an agent executing 1000 claims. Assert the server returns 429 Too Many Requests. |
| **Replay Attack on Webhook** | Mitigated via RFC 9421 HTTP Message Signatures with an enforced 5-minute expiration window and unique content-digest validation39. | Intercept a valid webhook payload and replay it 6 minutes later. Assert the signature verification rejects the payload. |

### **Operational Metrics**

To guarantee observability, the coordination service must emit specific telemetry to monitoring platforms like Prometheus or Datadog6. Crucial metrics include the inbox\_depth\_per\_agent, which tracks the number of pending rows; a high depth indicates a disconnected, failing, or overwhelmed agent. The lease\_expiration\_rate tracks the frequency of events reverting from claimed to pending, where spikes serve as a primary indicator of agent processing crashes or severe network drops. Finally, delivery\_latency\_ms measures the time delta between the available\_at timestamp and a successful /ack, providing a clear SLA indicator.

## **Phased Implementation Plan**

The deployment of this architecture requires a deliberate, phased rollout to manage risk and validate assumptions in production environments.  
**Phase 1: Database Foundation and Core API** The initial phase focuses on deploying the agent\_inbox MySQL schema, ensuring the composite primary keys and SKIP LOCKED polling queries are optimized. The core REST endpoints (/inbox, /claim, /ack, /release) are implemented. Agent SDKs are updated to utilize standard, fixed-interval cursor-based polling to establish baseline functionality.  
**Phase 2: Real-time Signaling via SSE** The second phase integrates Server-Sent Events (SSE) into the coordination service. Agent SDKs are modified to maintain a persistent SSE connection. When connected, the agent drops its polling interval to zero, relying entirely on the instantaneous SSE pings to trigger the /inbox fetch, dramatically reducing API latency and database load.  
**Phase 3: Adaptive Disconnected Polling** The third phase implements the mathematical decay functions within the agent SDK. When SSE connections inevitably fail and no events are detected, the SDK smoothly scales the polling interval exponentially (e.g., from 10 seconds up to 5 minutes)13. This optimizes mobile battery life and reduces proxy congestion for deeply disconnected agents.  
**Phase 4: Cryptographic Hardening and Webhooks** The final phase rolls out RFC 9421 HTTP Message Signatures across all HTTP exchanges, securing the payloads against tampering39. The optional Webhook registration endpoint is deployed for server-side agents, strictly enforcing the CRC challenge-response flow to lock down SSRF vulnerabilities18. Finally, the background scavenger jobs for dead-letter queuing and quarantine management are activated, completing the autonomous coordination loop.

#### **Works cited**

1. Transactional Outbox Pattern \- MikroORM, [https://mikro-orm.io/docs/transactional-outbox](https://mikro-orm.io/docs/transactional-outbox)  
2. The Outbox Pattern: Ensuring Data Consistency in Microservices | CodeWiz, [https://codewiz.info/blog/outbox-pattern-data-consistency/](https://codewiz.info/blog/outbox-pattern-data-consistency/)  
3. The Transactional Outbox Pattern: A Rigorous Examination for Distributed Systems Engineers \- Medium, [https://medium.com/@nustianrwp/the-transactional-outbox-pattern-a-rigorous-examination-for-distributed-systems-engineers-9c189836f470](https://medium.com/@nustianrwp/the-transactional-outbox-pattern-a-rigorous-examination-for-distributed-systems-engineers-9c189836f470)  
4. engineering-handbook/content/hld/trade-offs/10-polling-vs-websockets.md at main \- GitHub, [https://github.com/handbook-academy/engineering-handbook/blob/main/content/hld/trade-offs/10-polling-vs-websockets.md](https://github.com/handbook-academy/engineering-handbook/blob/main/content/hld/trade-offs/10-polling-vs-websockets.md)  
5. 5 API Pagination Techniques You Must Know (2026), [https://www.getknit.dev/blog/api-pagination-techniques](https://www.getknit.dev/blog/api-pagination-techniques)  
6. Transactional Outbox with RabbitMQ (Part 1): Building Reliable Event Publishing in Microservices \- DEV Community, [https://dev.to/sagarmaheshwary/transactional-outbox-with-rabbitmq-part-1-building-reliable-event-publishing-in-microservices-2of](https://dev.to/sagarmaheshwary/transactional-outbox-with-rabbitmq-part-1-building-reliable-event-publishing-in-microservices-2of)  
7. What is SSRF (Server-side request forgery)? Tutorial & Examples | Web Security Academy, [https://portswigger.net/web-security/ssrf](https://portswigger.net/web-security/ssrf)  
8. What Is Server-Side Request Forgery (SSRF)? \- JumpCloud, [https://jumpcloud.com/it-index/what-is-server-side-request-forgery-ssrf](https://jumpcloud.com/it-index/what-is-server-side-request-forgery-ssrf)  
9. What is SSRF (server-side request forgery)? | Tutorial & examples \- Snyk Learn, [https://learn.snyk.io/lesson/ssrf-server-side-request-forgery/](https://learn.snyk.io/lesson/ssrf-server-side-request-forgery/)  
10. Server Side Request Forgery (SSRF) \- Security \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/SSRF](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/SSRF)  
11. Server Side Request Forgery (SSRF): Attacks & Prevention \- Vectra AI, [https://www.vectra.ai/topics/server-side-request-forgery](https://www.vectra.ai/topics/server-side-request-forgery)  
12. How to implement cursors for pagination in an api \- Stack Overflow, [https://stackoverflow.com/questions/18314687/how-to-implement-cursors-for-pagination-in-an-api](https://stackoverflow.com/questions/18314687/how-to-implement-cursors-for-pagination-in-an-api)  
13. Adaptive Polling Mechanisms \- Emergent Mind, [https://www.emergentmind.com/topics/adaptive-polling](https://www.emergentmind.com/topics/adaptive-polling)  
14. NetAP-ML: Machine Learning-Assisted Adaptive Polling Technique for Virtualized IoT Devices \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC9920277/](https://pmc.ncbi.nlm.nih.gov/articles/PMC9920277/)  
15. WebSockets vs Server-Sent-Events vs Long-Polling vs WebRTC vs WebTransport | RxDB \- JavaScript Database, [https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html)  
16. Understanding Polling, Long Polling, SSE, and WebSockets: When to Use What. | by Gaurav Kumar, [https://itstheanurag.medium.com/understanding-polling-long-polling-sse-and-websockets-when-to-use-what-63bf294460f2](https://itstheanurag.medium.com/understanding-polling-long-polling-sse-and-websockets-when-to-use-what-63bf294460f2)  
17. HMAC: What It Is, How It Works, and When It Is the Wrong Tool \- Ayhan Sipahi | sph.sh, [https://sph.sh/en/posts/hmac-explainer-when-to-use/](https://sph.sh/en/posts/hmac-explainer-when-to-use/)  
18. Slack Connector | Prismatic Docs, [https://prismatic.io/docs/components/slack/](https://prismatic.io/docs/components/slack/)  
19. A novel adaptive sampling algorithm for cyber-physical systems in: International Review of Applied Sciences and Engineering Volume 15 Issue 2 (2023), [https://www.akjournals.com/view/journals/1848/15/2/article-p161.xml](https://www.akjournals.com/view/journals/1848/15/2/article-p161.xml)  
20. A Comprehensive Analysis of Bandwidth Request Mechanisms in IEEE 802.16 Networks, [http://www.eng.usf.edu/\~chang5/papers/10/tvt\_david.pdf](http://www.eng.usf.edu/~chang5/papers/10/tvt_david.pdf)  
21. How to set up Zoom webhooks to Tines, [https://explained.tines.com/en/articles/9925238-how-to-set-up-zoom-webhooks-to-tines](https://explained.tines.com/en/articles/9925238-how-to-set-up-zoom-webhooks-to-tines)  
22. Transactional Outbox: Where Microservices Architecture And Post-Office Meets | Medium, [https://alexandreolive.medium.com/transactional-outbox-a-place-where-microservices-architecture-and-post-office-meets-75c31725ce24](https://alexandreolive.medium.com/transactional-outbox-a-place-where-microservices-architecture-and-post-office-meets-75c31725ce24)  
23. A guide to REST API pagination \- Merge.dev, [https://www.merge.dev/blog/rest-api-pagination](https://www.merge.dev/blog/rest-api-pagination)  
24. How to Implement the Outbox Pattern with MySQL \- OneUptime, [https://oneuptime.com/blog/post/2026-03-31-mysql-outbox-pattern/view](https://oneuptime.com/blog/post/2026-03-31-mysql-outbox-pattern/view)  
25. Mind the Gap | dorkusmalorkus.dev \- Programming Blog, [https://dorkusmalorkus.dev/posts/outbox\_publisher\_challenges](https://dorkusmalorkus.dev/posts/outbox_publisher_challenges)  
26. When to use SKIP LOCKED clause \- Medium, [https://medium.com/@suryanshshrivastava\_75738/when-to-use-skip-locked-clause-bccc76a64ddb](https://medium.com/@suryanshshrivastava_75738/when-to-use-skip-locked-clause-bccc76a64ddb)  
27. Solid Queue & understanding UPDATE SKIP LOCKED | BigBinary Blog, [https://www.bigbinary.com/blog/solid-queue](https://www.bigbinary.com/blog/solid-queue)  
28. How to Use MySQL for Job Queue Management \- OneUptime, [https://oneuptime.com/blog/post/2026-03-31-mysql-use-mysql-for-job-queue-management/view](https://oneuptime.com/blog/post/2026-03-31-mysql-use-mysql-for-job-queue-management/view)  
29. \[Show PHP\] PHPOutbox: Stop losing events with the Transactional Outbox Pattern \- Reddit, [https://www.reddit.com/r/PHP/comments/1sfjjac/show\_php\_phpoutbox\_stop\_losing\_events\_with\_the/](https://www.reddit.com/r/PHP/comments/1sfjjac/show_php_phpoutbox_stop_losing_events_with_the/)  
30. How to Troubleshoot MySQL Lock Contention \- OneUptime, [https://oneuptime.com/blog/post/2026-03-31-mysql-how-to-troubleshoot-mysql-lock-contention/view](https://oneuptime.com/blog/post/2026-03-31-mysql-how-to-troubleshoot-mysql-lock-contention/view)  
31. Analyze Deadlock in Activiti/Flowable | nLeo.me, [https://nleo.me/en/2022/12/08/flowable\_deadlock.html](https://nleo.me/en/2022/12/08/flowable_deadlock.html)  
32. Mastering SKIP LOCKED in MySQL \- Kir Shatrov, [https://kirshatrov.com/posts/fast-skip-locked](https://kirshatrov.com/posts/fast-skip-locked)  
33. MySQL | System Design Interview \- AlgoMaster.io, [https://algomaster.io/learn/system-design-interviews/mysql](https://algomaster.io/learn/system-design-interviews/mysql)  
34. InnoDB locks \- Personal blog of Yzmir Ramirez, [https://rimzy.net/category/innodb-locks/](https://rimzy.net/category/innodb-locks/)  
35. Gmail API pagination and sync explained | Docs \- Nylas Documentation, [https://developer.nylas.com/docs/cookbook/email/gmail-api-pagination-sync/](https://developer.nylas.com/docs/cookbook/email/gmail-api-pagination-sync/)  
36. draft-hardt-httpbis-signature-key-07 \- HTTP Signature Keys \- IETF Datatracker, [https://datatracker.ietf.org/doc/draft-hardt-httpbis-signature-key/](https://datatracker.ietf.org/doc/draft-hardt-httpbis-signature-key/)  
37. NSign (/ˈensaɪn/) is a set of .Net libraries for HTTP Message Signatures (RFC 9421). \- GitHub, [https://github.com/Unisys/NSign](https://github.com/Unisys/NSign)  
38. HTTP Signature Keys \- IETF, [https://www.ietf.org/archive/id/draft-hardt-httpbis-signature-key-07.html](https://www.ietf.org/archive/id/draft-hardt-httpbis-signature-key-07.html)  
39. Understanding HTTP Message Signatures | Blog Notes, [https://blog.vitalvas.com/post/2025/12/12/understanding-http-message-signatures/](https://blog.vitalvas.com/post/2025/12/12/understanding-http-message-signatures/)  
40. Why Stripe webhook signature verification fails (and how to debug it properly) \- Reddit, [https://www.reddit.com/r/webdev/comments/1r8cbn1/why\_stripe\_webhook\_signature\_verification\_fails/](https://www.reddit.com/r/webdev/comments/1r8cbn1/why_stripe_webhook_signature_verification_fails/)  
41. Debugging Webhook Signature Verification Failures in Stripe, GitHub, and Shopify, [https://leo88.medium.com/debugging-webhook-signature-verification-failures-in-stripe-github-and-shopify-f758e8bacbbc](https://leo88.medium.com/debugging-webhook-signature-verification-failures-in-stripe-github-and-shopify-f758e8bacbbc)  
42. Receive Stripe events in your webhook endpoint, [https://docs.stripe.com/webhooks](https://docs.stripe.com/webhooks)  
43. The Transactional Outbox Pattern: Reliable Event Publishing \- James Carr, [https://james-carr.org/posts/2026-01-15-transactional-outbox-pattern/](https://james-carr.org/posts/2026-01-15-transactional-outbox-pattern/)
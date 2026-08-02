# **Integration Architecture and Security Specification for the TinyRustLM P2P Companion**

## **1\. Public-Site Observation Log**

An exhaustive technical reconnaissance of the public-facing web properties and authoritative documentation was conducted to establish a baseline for integrating a native peer-to-peer (P2P) companion application. All observations were recorded on July 13, 2026, utilizing both wide-desktop (1920x1080) and narrow-mobile (390x844) viewport simulations. The investigation focused on identifying existing runtime constraints, network routing boundaries, and product positioning.  
The primary domain, TinyRustLM.com (and its technical documentation host, MiRust.com), currently functions as a systems-oriented framework guide rather than a robust cloud inference platform. The existing architecture relies on a browser-local WebAssembly (WASM) runtime capable of executing a custom .slm (Small Language Model) container format1. The runtime exhibits severe hardware constraints, explicitly enforcing a 128 MiB transfer ceiling for any single raw memory allocation and confining execution to the main browser thread via scalar CPU operations2. The site explicitly states it does not execute local models or provide enterprise cloud inference1. Furthermore, the model directory consists predominantly of deterministic smoke-test fixtures (e.g., TinyLM-16M deterministic smoke — q8\_0) utilizing 17 million parameters for ABI and parser regression testing, rather than production-ready conversational assistants4.  
Observations of MiniModel.org revealed a domain historically associated with unrelated software repositories, necessitating a complete architectural pivot to serve as a decentralized model catalog5. Investigations into UAIX.org indicated infrastructure tied to internet exchanges and localized ISP routing, emphasizing the critical distinction between standard HTTP web traffic and the complex NAT (Network Address Translation) traversal required for direct P2P artifact seeding6.  
The evaluation was strictly limited to public endpoints. No access was granted to local source code, unpublished companion builds, browser automation artifacts, internal system designs, private APIs, or cryptographic credentials. The subsequent architectural design operates within these verified constraints, bridging the documented WASM limitations with the expansive capabilities of a native P2P companion.

## **2\. Product Responsibility Map**

To preserve the polished, unified user experience of the web interface while enabling heavy cryptographic validation and decentralized networking, the architecture mandates a strict separation of concerns across the three primary product pillars.

| System Component | Core Responsibilities | State and Data Ownership |
| :---- | :---- | :---- |
| **TinyRustLM.com** | Functions as the primary conversational interface and WebAssembly inference fallback. Manages the user interface, DOM transitions, and chat rendering pathways. Acts as a thin client when communicating with the local companion bridge. | Owns the presentation state, transcript rendering logic, and in-memory chat session. Explicitly barred from holding long-lived cryptographic pairing tokens in the main JavaScript thread to prevent cross-site scripting (XSS) theft. |
| **MiniModel.org** | Operates as the decentralized model catalog and rendezvous index. Surfaces model metadata, quantization profiles, parameter counts, and cryptographic artifact hashes. Tracks real-time P2P seed availability. | Owns global model metadata, quality tier classifications, and the Distributed Hash Table (DHT) bootstrap indices required for initial P2P discovery. Never hosts the multi-gigabyte weight files directly. |
| **Desktop Companion** | Functions as a headless background daemon managing native P2P networking, model chunking, and verified persistent local storage. Bypasses the 128 MiB browser WASM limit to execute large models. Exposes a secure loopback bridge. | Owns local .slm artifact storage, cryptographic validation routines, P2P network telemetry, NAT traversal state, and the secure generation of local session tokens. |

This strict demarcation ensures that TinyRustLM.com remains a lightweight, visually appealing chat application, delegating all heavy I/O, storage, and networking operations to the native daemon, while MiniModel.org acts solely as the discovery vector.

## **3\. End-to-End Journey Maps and State Transitions**

The integration architecture defines a progressive upgrade path. Users begin in a highly constrained, privacy-preserving browser environment and manually opt-in to heavier local execution and decentralized sharing through explicit, plain-language consent.

### **Comprehensive User Journeys**

The initial interaction begins with the user's first public website visit to TinyRustLM.com. The browser application silently probes the local system via a secure loopback request to detect a companion daemon. Upon a connection timeout or failure, the application gracefully degrades to a browser-only chat state. In this state, the user is restricted to interacting with small .slm models that fit within the 128 MiB WebAssembly allocation ceiling3. The WASM runtime loads the artifact, allocates the forward scratch buffer and Key-Value (KV) cache, and executes main-thread inference without accessing the local filesystem2.  
When a user attempts to load a model exceeding these constraints, the UI prompts them to install the desktop companion. Once the native application is installed and executed, it binds to a local loopback port. The web UI detects the open socket but requires authorization, initiating the process for connecting an existing companion. The companion surfaces a one-time pairing code via its minimal native interface or terminal7. The user inputs this code into TinyRustLM.com, which exchanges it for a secure, short-lived session token, linking the browser profile to the daemon.  
With the bridge authenticated, the user navigates to find a MiniModel catalog model. Upon selecting a model, the system checks local storage. If absent, the companion initiates the downloading from peers journey. The daemon chunks the file, verifies cryptographic receipts, and reassembles the .slm artifact locally. Alternatively, the user may execute the importing a local .slm journey by pointing the web UI to a file on their local disk, which the companion ingests and validates.  
Post-download, the user faces a critical branching path regarding data sharing, choosing between converting privately versus preparing for P2P. The UI presents plain-text outcomes. Selecting Convert model only for me isolates the artifact strictly for local inference, halting all outbound peer connections while providing a clear path to change this setting later. Selecting Convert model for P2P authorizes the companion to allocate shared storage and advertise the artifact.  
If P2P is enabled, the daemon begins enabling two seed lanes, attempting to bind standard TCP ports and establish WebRTC/UDP fallbacks for NAT traversal. The system independently conducts verifying local health (checking file checksums) and obtaining outside proof (requesting an external rendezvous node to initiate an inbound connection to the host). Only when the external node successfully connects does the system transition to publishing an announcement, broadcasting the user's IP to the DHT.  
Once the model is ready, the loading into chat journey transfers execution context to the daemon, bypassing the browser's WASM runtime entirely. The user can seamlessly converse with the heavy model. At any point, the user can execute stopping/revoking sharing, which instantly terminates the P2P seed lanes, sends a revocation broadcast to the tracker, and demotes the model to local-only status while retaining the artifact on disk.  
Administrative journeys include changing browsers, which requires the user to repeat the one-time pairing protocol because pairing tokens are securely isolated to the specific browser profile's Web Worker9. During upgrading, a native mismatch state pauses interactions until the user downloads the latest companion binary. Finally, uninstalling while retaining models allows the user to remove the daemon and networking stack while leaving the verified .slm files untouched in their local application data directory for future use.

### **Explicit Interaction State Model**

To synchronize the React-based web UI with the asynchronous Rust daemon, the architecture relies on a strict, deterministic state machine. The UI must never infer network health solely from loopback success.

| System State | User-Facing Label | Primary Action | Technical Detail & Disclosed Diagnostics |
| :---- | :---- | :---- | :---- |
| **Browser-only** | "Running in Browser" | "Install Desktop App" | Standard WASM fallback active. Loopback probe failed to find the daemon. |
| **Companion detected but unpaired** | "App Detected – Needs Pairing" | "Connect to App" | Loopback socket is open, but the browser profile lacks a valid cryptographic session token. |
| **Paired and ready** | "Connected to Desktop" | "Browse Models" | Bridge authenticated. WebSocket multiplexing active via Web Worker. |
| **Native mismatch** | "Update Required" | "Update App" | Protocol version mismatch between the web client and the daemon API schema. |
| **Model absent** | "Model Not Downloaded" | "Download Model" | The selected catalog hash is not found in the verified local artifact store3. |
| **Importing** | "Downloading... (45%)" | "Cancel" / "Pause" | Active P2P chunk transfer. The UI surfaces real-time event-stream progress. |
| **Resumable** | "Download Paused" | "Resume Download" | Transfer interrupted due to network loss or user action. Local chunks retained via Merkle tree. |
| **Validating** | "Verifying Model" | None (Disabled) | Cryptographic SHA-256 checksum validation of the .slm container in progress2. |
| **Loaded** | "Ready to Chat" | "Start Chat" | Model mapped into companion memory. KV cache and logits buffers allocated. |
| **Lane starting** | "Preparing to Share" | "Cancel Sharing" | Companion is actively attempting NAT traversal and UPnP/STUN resolution. |
| **Locally reachable** | "Converting (Local Only)" | "Convert model for P2P" | Network is bound to localhost, but not yet externally verifiable by the network. |
| **Outside proof needed** | "Testing Connection" | "View Network Diags" | Daemon is awaiting an inbound connection from an external validation node. |
| **Announcement eligible** | "Ready for P2P" | "Publish Announcement" | Outside proof succeeded. Awaiting explicit user consent to broadcast DHT location. |
| **Advertised** | "Sharing (2 Lanes)" | "Stop Sharing" | Actively seeding to peers. Re-verified periodically to ensure NAT stability. |
| **Stale** | "Connection Lost" | "Reconnect" | Outside proof failed after previously succeeding. P2P traffic halted to prevent blackholing. |
| **Revoked** | "Sharing Stopped" | "Convert model for P2P" | User explicitly revoked P2P sharing. The artifact remains local and offline. |
| **Failed** | "Operation Failed" | "Retry" / "View Logs" | Unrecoverable error (e.g., corrupted artifact, disk full). Exposes JSON diagnostics block. |

## **4\. Local Bridge Threat Model and Recommended Protocol**

The secure loopback bridge represents the most critical attack surface in the architecture. Permitting a public web application to communicate with a locally running native service exposes the user's machine to Cross-Site Request Forgery (CSRF), DNS rebinding attacks, and unauthorized local privilege escalation. The browser must never receive broad filesystem or service control by default.

### **Private Network Access (PNA) and CORS Preflight Constraints**

Modern browsers, driven by the W3C WebAppSec working group and implemented heavily in Chrome (versions 138-146+), enforce strict Local Network Access (LNA) and Private Network Access (PNA) specifications11. These specifications are designed to prevent malicious public websites from pivoting into private networks or exploiting localhost services.  
To establish the bridge, TinyRustLM.com must be served from a Secure Context (HTTPS)14. When the web application attempts to fetch data from the local companion, the browser intercepts the request and issues a CORS preflight OPTIONS request. This preflight carries a specific header: Access-Control-Request-Private-Network: true16.  
The companion daemon must strictly inspect the Origin header of this preflight. If the origin exactly matches https://tinyrustlm.com, the daemon must respond with Access-Control-Allow-Private-Network: true alongside standard CORS headers (Access-Control-Allow-Origin)17. If the origin is unrecognized, the daemon must drop the request. Furthermore, Chrome's LNA implementation allows mixed-content exemptions—meaning an HTTPS website can communicate with an HTTP 127.0.0.1 endpoint—provided the user grants the explicit browser-level LNA permission prompt or the fetch call is annotated with targetAddressSpace: "local"11. This exemption is critical, as requiring end-users to install and trust self-signed TLS certificates for localhost degrades the user experience and introduces severe Certificate Authority (CA) vulnerabilities21.

### **DNS Rebinding Defenses**

A DNS rebinding attack occurs when a malicious website alters its DNS records mid-session, dropping the Time-To-Live (TTL) and rebinding its domain resolution from a public IP to 127.0.0.123. The browser, believing it is communicating with the same origin, bypasses the Same-Origin Policy and sends requests to the local companion. Recent vulnerabilities in AI agent infrastructure, such as CVE-2026-11624 affecting the Model Context Protocol (MCP), demonstrate that failing to validate origin headers on localhost services leads to arbitrary local code execution25.  
To mitigate this, the companion daemon must strictly validate the HTTP Host header on every incoming request26. The server must categorically reject any request where the Host header does not exactly match 127.0.0.1:\<port\> or localhost:\<port\>. It must never rely on 0.0.0.0 wildcard binding semantics as an access-control boundary, as this exposes the daemon to the entire local area network27.

### **Port Discovery and Binding Strategy**

Binding to a static port introduces the risk of conflicts if another local service occupies the port, while utilizing purely ephemeral ports (dynamic ports ranging from 49152 to 65535\) prevents the web application from reliably locating the daemon28.  
The companion daemon should attempt to bind to a primary fixed discovery port (e.g., TCP 27142). If this port is occupied, the daemon degrades to a randomized ephemeral port. To facilitate discovery without relying on exhaustive browser-based port scanning—which triggers security alerts and degrades performance—the daemon writes its active ephemeral port to a secure local configuration file or registry key accessible only to the user's OS profile. As an alternative to native file reads, the web application can utilize a highly restricted port-scanning fallback limited to a narrow, pre-defined range (e.g., 27142–27152), ensuring rapid discovery without anomalous network behavior.

### **Cryptographic Pairing and Token Rotation**

To prevent rogue iframes, malicious browser extensions, or XSS payloads on TinyRustLM.com from commandeering the companion, a strict token-based authentication protocol is mandated.  
Upon the initial connection, the companion generates a one-time cryptographic pairing challenge. Following patterns established by secure local AI agents, this challenge is displayed natively in the companion's minimal GUI or terminal7. The user manually inputs this code into the web UI. This out-of-band verification proves physical possession of the machine.  
The pairing exchanges the one-time code for a long-lived refresh token and a short-lived session token (e.g., 15-minute expiry). The system implements Refresh Token Rotation based on OAuth 2.0 Best Current Practices32. Upon session expiration, the refresh token is used to acquire a new pair, and the old refresh token is immediately invalidated. If the daemon detects the reuse of an invalidated refresh token—indicating potential token theft—the entire token family is instantly revoked, halting replay attacks33.  
Crucially, the web application must never expose the long-lived refresh token to the main JavaScript thread, where it is vulnerable to XSS exfiltration9. The token lifecycle, rotation logic, and authenticated bridge requests must be encapsulated within a dedicated, opaque Web Worker10. Furthermore, because cryptographic pairing is tied to the local storage of the specific browser profile, utilizing private browsing mode or multiple browser profiles will legitimately require the user to repeat the one-time pairing process, ensuring strict identity isolation. The daemon must also enforce strict request limits (rate limiting) to prevent local denial-of-service attempts.

## **5\. Center-Column Active-Conversation Specification**

The chat interaction model must elegantly mask the immense technical complexity of local WASM execution versus Companion offloading, while strictly preserving the locked visual language of TinyRustLM.com.

### **Viewport and Composer Dynamics**

The initial empty state populates the center column with introductory prompt cards and model selection dropdowns. Upon the first message dispatch (first send), the view transitions aggressively. The introductory cards instantly unmount, allowing the full-height conversation history to dominate the viewport. The composer anchors firmly to the bottom of the screen.  
Auto-scrolling behavior must be mathematically precise. The interface utilizes CSS Scroll Anchoring (overflow-anchor: auto). If the user's viewport is locked to the bottom pixel boundary, incoming streamed tokens auto-scroll the page. However, if the user scrolls upward by even one pixel during generation, the auto-scroll must be aggressively disabled to prevent jarring layout shifts. In this state, a discrete "New tokens generating..." floating action button appears, allowing the user to snap back to the bottom. On mobile viewports, the application operates in a strict single-column mode. Sidebars detailing memory status, active peer connections, and token generation rates are hidden behind a modal overlay or off-canvas drawer, ensuring no overlapping columns obscure the text.

### **Render Cycle and State Synchronization**

A critical flaw in many AI interfaces is the "duplicate response" rendering trap, often caused by React's strict mode lifecycle or state-flushing conflicts during rapid token streaming. The architecture dictates a single rendering path for both streamed and final model outputs. The application must decouple the React render cycle from the incoming WebSocket/Server-Sent Events (SSE) token stream. Streamed tokens are buffered in a mutable reference (useRef) or within the Web Worker state. The DOM is updated via a synchronized, throttled commit phase (e.g., every 50ms), ensuring a model response renders exactly once regardless of component re-renders.  
Given the severe hardware constraints of local generation, executing a generation cancellation is a highly privileged action. Pressing "Stop" must issue an explicit AbortController signal across the bridge to the daemon. This signal clears the generation state, resets the KV context, and halts the autoregressive decoding loop, freeing compute resources immediately3. Contextual actions such as Retry, Copy, and Regenerate are strictly attached to the individual message payloads in the DOM. Model switching dynamically updates the memory status overlay, indicating whether the new artifact requires a cold load from disk or is already resident in RAM. During the initial model load, the interface suppresses the chat view, displaying deterministic loading progress based on the daemon's parsing stages (manifest fetch, tensor materialization, scratch allocation)3.

## **6\. MiniModel Catalog Information Architecture**

MiniModel.org will shift from a generic landing page to a highly structured, data-dense P2P catalog. It must differentiate itself from metadata-only aggregators by indexing tangible, locally verifiable .slm artifacts and exposing real network telemetry.

### **Index Architecture and Availability**

A model is only listed in the primary conversational search results if its cryptographic manifest is verified and at least one active, outside-reachable P2P seed lane is confirmed by the tracker. The presentation must strictly separate test fixtures from conversational models. Artifacts matching the TinyRustLM deterministic smoke family4, which carry no trained-assistant quality claims and exist solely for parser regression, must be filtered out of default searches and restricted to a specialized "Developer / Diagnostic" toggle. The architecture explicitly forbids presenting Hugging Face search results as downloadable .slm peers; every listing must represent a real swarm.

### **Resource and Provenance Verification**

The information hierarchy for each catalog listing must prioritize technical honesty.

1. **Identity & Provenance**: Displays the precise Model Name, Source Revision, Cryptographic Checksum (SHA-256), and License.  
2. **Resource Constraints**: Details the parameter count, quantization profile (e.g., Q4\_0, Q8\_0, F32), exact artifact byte size, and the calculated RAM/VRAM context requirements based on the SLM1 tensor shapes2.  
3. **Network Telemetry**: Surfaces the global peer count and the currently reachable P2P seed lanes in real-time.  
4. **Quality Boundary**: Discloses explicit limitations, safety guardrails, and the last verified time of the artifact1. Users can inspect the raw cryptographic manifest and receipt prior to download.

If a model's peer count drops to zero, the listing remains searchable, but the primary action button degrades from "Download via P2P" to "Awaiting Peers," accurately reflecting the stale state. If a manifest is cryptographically revoked by the author, the model is prominently marked "Revoked," and P2P chunk routing is disabled at the tracker level to prevent the spread of compromised weights.

## **7\. Desktop Companion Command/Dashboard Scope**

The desktop companion is strictly bounded as a headless networking and execution daemon. It is designed as a thin client over the core Rust service APIs, avoiding state machine duplication with the web UI.  
The scope of the native Graphical User Interface (GUI) is intentionally minimized to a compact operational dashboard, housed within a system tray or menu bar dropdown. Its sole responsibilities are service lifecycle management (Start/Stop daemon), fixed port configuration, storage quota management, manual pairing code generation, and diagnostic log exporting. A Command-Line Interface (CLI) remains fully supported and acceptable for headless server environments, automated testing, and CI/CD integrations. Commands map 1:1 with the tray dashboard (e.g., tinyrustlm-daemon start, tinyrustlm-daemon pair \--generate).  
A strict non-competition rule is enforced: the companion GUI must never include a conversational chat interface or duplicate the product surface. All user interactions, prompt engineering, and conversational history must be routed through the TinyRustLM.com web bridge. The native tray application does not manage its own state machine for P2P downloads; rather, it subscribes to the same internal Rust event bus that the local HTTP bridge exposes to the web UI, ensuring perfect synchronization.

## **8\. Error, Recovery, and Support Model**

Local AI execution and decentralized networking introduce highly volatile failure states, ranging from out-of-memory faults to interrupted downloads and corrupt peer chunks. The architecture mandates a strategy of diagnosing by stage rather than by symptom, ensuring recoverable errors do not trigger cascading failures3.  
If a P2P chunk fails validation against the cryptographic receipt during an import, the chunk is silently discarded and requested from an alternative peer. If the local disk exceeds its allocated quota, the state shifts to Failed with a recoverable "Free up space" prompt, while retaining all verified chunks safely in the Resumable state via Merkle tree verification.  
Model admission errors are handled gracefully. If the custom .slm container header fails parsing due to a shape mismatch or an unsupported attention mechanism (e.g., grouped-query attention rejected by older runtimes)2, the load transaction is cleanly rolled back without crashing the daemon. The UI alerts the user that the artifact is incompatible with the current runtime version. Generation errors, such as exceeding context capacity or UTF-8 decode failures, clear the immediate generation state while retaining the accepted model in memory where safe3. A full model reload is only triggered if the model-owned state is explicitly suspect.  
Upon any unrecoverable failure, the system captures an immutable diagnostic payload containing the runtime/WASM hash, model internal checksum, browser user-agent, device memory envelope, and UTC time3. This payload can be explicitly copied by the user for support ticketing without exposing private conversational transcripts.

### **MemoryEndpoints Integration (Optional)**

Short- and long-term agent memory (conversation recall) is treated as an optional authenticated service, strictly decoupled from model seeding. While model bytes and P2P routing remain purely local and decentralized, users opting into MemoryEndpoints utilize the web UI to manage external API calls for storing and retrieving embedded context vectors. Enrollment credentials for the memory service are maintained distinctly from the P2P configuration and the local browser pairing tokens. The native companion daemon remains entirely unaware of the MemoryEndpoints service, ensuring the local application requires no external cloud telemetry or accounts to function.

## **9\. Accessibility and Responsive Requirements**

The integration must uphold strict WCAG 2.1 AA accessibility standards across the complex, multi-state web application, ensuring the transition from a standard website to a local daemon bridge is seamless for all users.  
For screen reader users, the Importing state and local bridge connection updates must utilize aria-live="polite" regions to announce progress naturally (e.g., "Download paused", "Converting for P2P"). During text generation, the rapid stream of tokens must not continuously interrupt the screen reader. Instead, a visually hidden aria-live region announces "Model generating response" when execution begins, and reads the final payload only upon completion.  
For users with prefers-reduced-motion: reduce configured at the OS level, all smooth auto-scrolling transitions in the center column are converted to instant DOM updates. Infinite loading spinners are replaced with deterministic textual progress percentages. The pairing flow, model selection, and execution controls are fully accessible via the Tab key, with focus management gracefully shifting to the chat composer upon a successful Loaded state. On mobile viewports, long model names in the MiniModel catalog intelligently truncate in the middle of the string (e.g., TinyLM-16M...moke-q8\_0) to preserve vital suffix identifiers like quantization formats.

## **10\. Detailed Browser, Integration, and Security Test Matrix**

Rigorous automated testing is required to validate the interaction between public web constraints and local system capabilities.

| Test Category | Test Vector | Acceptance Criteria |
| :---- | :---- | :---- |
| **Bridge Security** | CSRF / Malicious Origin | An attacker origin attempts to hit http://127.0.0.1:27142. The companion rejects the request due to Origin mismatch and missing one-time pairing token. |
| **Bridge Security** | DNS Rebinding Attack | Attacker domain resolves to 127.0.0.1. Request arrives with a valid session token but malicious Host header. Companion rejects connection instantly26. |
| **Bridge Security** | Chrome LNA Preflight | Browser initiates LNA OPTIONS request. Companion responds with Access-Control-Allow-Private-Network: true. Final request succeeds16. |
| **Concurrency** | Multiple Tabs | User opens TinyRustLM.com in three tabs. The Web Worker multiplexes the connection. State is synchronized. Model loads exactly once in the companion. |
| **Lifecycle** | Companion Restart | Daemon is killed during generation. UI transitions to Stale / Failed. Upon restart, UI detects daemon, utilizes refresh token, and restores Paired and ready state. |
| **P2P Integrity** | Stale Proof | A node loses external internet but maintains loopback. The outside NAT traversal proof fails. The UI instantly removes the "Advertised" status. |
| **Execution** | Duplicate Response | Network latency delays the stream. The user spam-clicks "Regenerate". The UI AbortController cancels previous requests. Only one render path stays active. |
| **UX / Interrupts** | Canceled Operations | User clicks "Cancel" during a 90% complete import. State shifts to Resumable. Verifying local health confirms the retained chunks are valid. |

## **11\. Prioritized Implementation Plan**

The integration will be executed in four distinct phases to ensure stability, isolate security boundaries, and provide measurable milestones.

| Phase | Focus Area | Deliverables | Measurable Acceptance Criteria |
| :---- | :---- | :---- | :---- |
| **Phase 1** | Local Bridge Authentication | Headless companion daemon, LNA-compliant local server, one-time pairing protocol, Web Worker token storage, Refresh Token Rotation. | TinyRustLM.com pairs with the daemon, persists the session, and withstands automated CSRF/Rebinding test vectors. |
| **Phase 2** | State Synchronization & Execution | UI state machine mapping, execution offloading via authenticated bridge, AbortController cancellation integration. | User can execute a heavy model loaded in the companion from the web UI, with full stream rendering and cancellation support. |
| **Phase 3** | P2P Networking & Storage | DHT bootstrap, chunked .slm storage, cryptographic validation, NAT traversal (STUN/TURN) outside-reachability proof logic. | Companion successfully downloads an artifact from a peer, passes local health checks, and advertises itself only when outside reachability is proven. |
| **Phase 4** | Catalog & UX Polish | MiniModel.org indexing architecture, center-column UX refinement, scroll anchoring, mobile layouts, accessibility ARIA implementation. | End-to-end journey is fully functional. Accessibility compliance passes automated Lighthouse and screen-reader audits. |

## **12\. Facts Requiring Local Code or Application Access**

Because this architectural specification relies exclusively on an analysis of public repositories, technical documentation, and known browser standards, certain implementation details remain blind spots that require access to internal source code or executable environments to finalize:

1. **Exact WebAssembly Memory Layouts**: The precise memory profiling required for the WASM fallback (scratch buffers, KV cache overhead) versus native execution must be measured to determine exactly when the web UI should force a companion upgrade rather than attempting local browser execution.  
2. **SLM1 Parsing Offsets**: The exact byte-level layout of the custom 108-byte header and 64-byte tensor directory required for the companion's chunked P2P verification logic.  
3. **NAT Traversal Success Rates**: The real-world viability of the two-lane seed hosting logic heavily depends on internal telemetry regarding ISP symmetric NAT handling, which cannot be accurately modeled from public documentation alone.  
4. **Internal IPC Mechanisms**: How the headless daemon communicates with the system tray GUI (e.g., named pipes, Unix domain sockets) requires OS-specific code inspection to ensure privilege escalation vulnerabilities are mitigated.

## **13\. Direct Links to Current Authoritative Sources and Public Observations**

The following references form the technical foundation for the observations and architectural decisions detailed in this report:

* MiRust Architecture, Framework Principles, and WASM Constraints: https://mirust.com/framework/  
  \[cite: 1\]  
* TinyRustLM Implementation, Evidence, and SLM1 Format Gaps: https://mirust.com/implementation/  
  \[cite: 2\]  
* TinyRustLM Operational Contracts and Diagnostic Stages: https://mirust.com/implementation-operations/  
  \[cite: 3\]  
* MiRust Model Artifact Directory and Test Fixtures: https://mirust.com/models/  
  \[cite: 4\]  
* UAIX.org / AS-ITS-UAIX ISP Routing Data: https://bgp.he.net/irr/as-set/AS-ITS-UAIX  
  \[cite: 6\]  
* Chrome Private Network Access (PNA) Preflights and CORS: https://developer.chrome.com/blog/private-network-access-preflight  
  \[cite: 16\]  
* Chrome Local Network Access (LNA) / Mixed Content Exemptions: https://developer.chrome.com/blog/local-network-access  
  \[cite: 11\]  
* W3C Mixed Content and Secure Contexts (Localhost Rules): https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure\_Contexts  
  \[cite: 14\]  
* DNS Rebinding Attack Mechanics and CVE References: https://pentesterlab.com/glossary/dns-rebinding  
  \[cite: 23, 24, 25\]  
* Refresh Token Rotation (Auth0/OAuth 2.0 BCP) and Web Worker Storage: https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation  
  \[cite: 9, 10, 32, 33\]

#### **Works cited**

1. Framework \- MiRust, [https://mirust.com/framework/](https://mirust.com/framework/)  
2. Implementation \- MiRust, [https://mirust.com/implementation/](https://mirust.com/implementation/)  
3. Implementation operations \- MiRust, [https://mirust.com/implementation-operations/](https://mirust.com/implementation-operations/)  
4. Models \- MiRust, [https://mirust.com/models/](https://mirust.com/models/)  
5. minimodel | RubyGems.org | your community gem host, [https://rubygems.org/gems/minimodel/versions/0.4.0](https://rubygems.org/gems/minimodel/versions/0.4.0)  
6. AS-ITS-UAIX \- bgp.he.net, [https://bgp.he.net/irr/as-set/AS-ITS-UAIX](https://bgp.he.net/irr/as-set/AS-ITS-UAIX)  
7. The Ultimate Guide to OpenClaw Control UI Pairing Required \- Skywork.ai, [https://skywork.ai/skypage/en/openclaw-control-ui-pairing/2048627316205768704](https://skywork.ai/skypage/en/openclaw-control-ui-pairing/2048627316205768704)  
8. mobilecli 0.2.0 \- Docs.rs, [https://docs.rs/crate/mobilecli/0.2.0](https://docs.rs/crate/mobilecli/0.2.0)  
9. Token Storage \- Auth0 Docs, [https://auth0.com/docs/secure/security-guidance/data-security/token-storage](https://auth0.com/docs/secure/security-guidance/data-security/token-storage)  
10. Best Practices for Storing Access Tokens in the Browser \- Medium, [https://curity.medium.com/best-practices-for-storing-access-tokens-in-the-browser-6b3d515d9814](https://curity.medium.com/best-practices-for-storing-access-tokens-in-the-browser-6b3d515d9814)  
11. New permission prompt for Local Network Access | Blog \- Chrome for Developers, [https://developer.chrome.com/blog/local-network-access](https://developer.chrome.com/blog/local-network-access)  
12. Local Network Access \- GitHub Pages, [https://wicg.github.io/local-network-access/](https://wicg.github.io/local-network-access/)  
13. Local network access restrictions \- Chrome Platform Status, [https://chromestatus.com/feature/5152728072060928](https://chromestatus.com/feature/5152728072060928)  
14. Secure contexts \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure\_Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)  
15. Intent to Ship: Restrict "private network requests" for subresources to secure contexts. \- Google Groups, [https://groups.google.com/a/chromium.org/g/blink-dev/c/cPiRNjFoCag](https://groups.google.com/a/chromium.org/g/blink-dev/c/cPiRNjFoCag)  
16. Private Network Access: introducing preflights | Blog \- Chrome for Developers, [https://developer.chrome.com/blog/private-network-access-preflight](https://developer.chrome.com/blog/private-network-access-preflight)  
17. CORS \- Misconfigurations & Bypass \- HackTricks, [https://hacktricks.wiki/en/pentesting-web/cors-bypass.html](https://hacktricks.wiki/en/pentesting-web/cors-bypass.html)  
18. How Access-Control-Allow-Private-Network Can Solve Cross-Origin Blocks, [https://www.paulserban.eu/blog/post/how-access-control-allow-private-network-can-solve-cross-origin-blocks/](https://www.paulserban.eu/blog/post/how-access-control-allow-private-network-can-solve-cross-origin-blocks/)  
19. Mixed content \- Security \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed\_content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)  
20. local-network-access/explainer.md at main \- GitHub, [https://github.com/WICG/local-network-access/blob/main/explainer.md](https://github.com/WICG/local-network-access/blob/main/explainer.md)  
21. Use HTTPS for local development | Articles \- web.dev, [https://web.dev/articles/how-to-use-local-https](https://web.dev/articles/how-to-use-local-https)  
22. Certificates for localhost \- Let's Encrypt, [https://letsencrypt.org/docs/certificates-for-localhost/](https://letsencrypt.org/docs/certificates-for-localhost/)  
23. DNS Rebinding: Definition & Security Context | PentesterLab Glossary, [https://pentesterlab.com/glossary/dns-rebinding](https://pentesterlab.com/glossary/dns-rebinding)  
24. DNS Rebinding Attack: How Malicious Websites Exploit Private Networks, [https://unit42.paloaltonetworks.com/dns-rebinding/](https://unit42.paloaltonetworks.com/dns-rebinding/)  
25. CVE-2026-11624: Model Context Protocol (MCP) DNS Rebinding Vulnerability — AI Agent Infrastructure at Risk, [https://threat-modeling.com/cve-2026-11624-mcp-dns-rebinding/](https://threat-modeling.com/cve-2026-11624-mcp-dns-rebinding/)  
26. Technical Advisory – Ollama DNS Rebinding Attack (CVE-2024-28224) \- NCC Group, [https://www.nccgroup.com/research/technical-advisory-ollama-dns-rebinding-attack-cve-2024-28224/](https://www.nccgroup.com/research/technical-advisory-ollama-dns-rebinding-attack-cve-2024-28224/)  
27. REST/WebUI Lacks Host Validation and Remains Exposed to DNS Rebinding \- GitHub, [https://github.com/nicolargo/glances/security/advisories/GHSA-hhcg-r27j-fhv9](https://github.com/nicolargo/glances/security/advisories/GHSA-hhcg-r27j-fhv9)  
28. What is localhost? | Localtonet Blog, [https://localtonet.com/blog/what-is-localhost](https://localtonet.com/blog/what-is-localhost)  
29. Ephemeral port \- Wikipedia, [https://en.wikipedia.org/wiki/Ephemeral\_port](https://en.wikipedia.org/wiki/Ephemeral_port)  
30. Ephemeral ports \- IBM, [https://www.ibm.com/docs/en/rsct/3.2?topic=considerations-ephemeral-ports](https://www.ibm.com/docs/en/rsct/3.2?topic=considerations-ephemeral-ports)  
31. ArmorerLabs/Armorer-Gauntlet: Put your coding agents in your pocket \- GitHub, [https://github.com/ArmorerLabs/Armorer-Gauntlet](https://github.com/ArmorerLabs/Armorer-Gauntlet)  
32. Refresh Token Rotation: Best Practices for Developers \- Serverion, [https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/](https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/)  
33. Refresh Token Rotation \- Auth0 Docs, [https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)  
34. Terms \- MiRust, [https://mirust.com/terms/](https://mirust.com/terms/)
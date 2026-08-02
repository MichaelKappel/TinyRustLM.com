# **Implementation-Grade Release Architecture for TinyRustLM: Offline Coherence, Service-Worker Lifecycles, and Rollback**

## **1\. Executive Release and Offline-Lifecycle Recommendation**

The deployment and application lifecycle architecture for the TinyRustLM progressive web application (PWA) requires a paradigm shift from traditional mutable web deployments to a strictly immutable, content-addressed release model. Because the application relies on a complex matrix of client-side execution contexts—including Rust-compiled WebAssembly (WASM), Web Workers, Service Workers, Cache Storage, and the Origin Private File System (OPFS)—any mismatch between asset generations during runtime will result in catastrophic execution panics.  
The primary recommendation dictates that the static hosting environment must decouple asset uploading from application activation. Every dependency, including WASM modules, JavaScript execution contexts, CSS stylesheets, and service-worker scripts, must be published as an immutable resource uniquely identified by its cryptographic content hash. The application is only activated when a single, mutable entry point—the index.html file—is atomically updated to point to a fully verified, uploaded generation of assets. This approach mathematically eliminates the risk of a client fetching a new HTML shell that attempts to execute an older, cached WASM module.  
Furthermore, TinyRustLM must implement a rigorously versioned service-worker lifecycle. The service worker functions as the authoritative local network proxy and cache manager. It must be explicitly programmed to cache and serve only the exact graph of assets defined by a specific release identity. To preserve user privacy and prevent local memory exhaustion, model weights, user prompts, and local MemoryEndpoints data must reside strictly in OPFS and IndexedDB, remaining explicitly excluded from the Service Worker's Cache Storage.  
Finally, because the W3C Service Worker specification dictates that errors during the installation phase must remain recoverable, the architecture must support a "Last-Known-Good" (LKG) rollback mechanism. By retaining previously verified immutable assets on the hosting origin for a defined retention period, the deployment system can instantly revert the application to a functional state simply by rolling back the index.html pointer, ensuring that interrupted updates or defective releases never strand the user in a corrupted state.

## **2\. Standards and Browser Behavior Matrix**

The implementation of offline-first web applications relies heavily on a constellation of W3C and WHATWG standards. However, browser vendors exhibit significant variance in their adherence to these standards, particularly regarding storage eviction, background execution, and security isolation. The following matrix details the critical standards and the observed implementation behaviors that dictate the TinyRustLM architecture.

| Feature / Standard | Chromium Implementation | WebKit / Safari Implementation | Firefox Implementation | Architectural Implication |
| :---- | :---- | :---- | :---- | :---- |
| **Service Worker Update** (updateViaCache) | Honors updateViaCache: 'none' to bypass HTTP cache for update checks1. | Honors updateViaCache: 'none', though requires explicit client-side refresh handling2. | Honors updateViaCache: 'none'1. | Registration must explicitly set updateViaCache: 'none' to prevent edge networks from serving stale worker scripts2. |
| **Storage Eviction** (Tracking Prevention) | Evicts based on heuristic storage pressure; utilizes an LRU strategy for non-persistent origins3. | Enforces a strict 7-day script-writeable storage cap. Installed PWAs (Home Screen) are explicitly exempt4. | Evicts based on group limits (eTLD+1) and global disk quotas3. | The application must strongly encourage users to "Install" the PWA; otherwise, Safari will silently delete locally downloaded model weights after 7 days of inactivity4. |
| **Persistent Storage** (navigator.storage.persist) | Automatically granted based on internal engagement heuristics or PWA installation3. | Granted automatically only for home-screen installed PWAs3. | Displays a mandatory user-facing prompt requesting permission to store persistent data3. | The initialization sequence must handle the asynchronous prompt gracefully and inform the user of its necessity for offline model retention. |
| **WASM Streaming** (instantiateStreaming) | Requires exact application/wasm MIME type and CORS same-origin5. | Requires exact application/wasm MIME type5. | Requires exact application/wasm MIME type5. | The static host must be strictly configured to serve .wasm files with the correct MIME type; fallback compilation is prohibitively slow for large models. |
| **Module Workers** (type: "module") | Supported for both Dedicated and Service Workers6. | Supported7. | Supported7. | Enables modern ES module imports within the service worker, allowing a clean architectural separation of caching logic and routing. |
| **Cross-Origin Isolation** (COOP / COEP) | Requires require-corp or credentialless for SharedArrayBuffer availability8. | Requires require-corp8. | Requires require-corp or credentialless8. | Strict security headers are mandatory for high-performance Rust WASM multi-threading. Third-party assets lacking CORP headers will be blocked. |

The variance in Intelligent Tracking Prevention (ITP) between WebKit and other engines represents a critical architectural constraint. If a user downloads a multi-gigabyte language model on an iOS device but fails to add the application to their home screen, WebKit will actively purge the OPFS and IndexedDB storage after seven days of inactivity4. Therefore, the application's onboarding flow must verify the installation status and utilize navigator.storage.persist() to secure a permanent storage allocation3.

## **3\. Release Identity and Immutable Asset Graph**

To guarantee that an update keeps the exact dependency identities coherent, a release identity must be mathematically bound to the source code. The complete release identity is defined as a cryptographic hash (e.g., SHA-256) encompassing the clean worktree state, the Rust toolchain version, the dependency lockfile, the compiled WASM module, JavaScript bundles, CSS stylesheets, HTML shells, worker scripts, icons, the web manifest, and the deployment security-header contract.  
Every executable or style dependency must be incorporated into an immutable asset graph. HTTP caching standards define the Cache-Control: immutable directive, which informs the browser that a resource will never change during its freshness lifetime, eliminating the latency of conditional revalidation10. To leverage this, every asset must embed its content hash directly into its filename (e.g., core.\[sha256\].wasm, app.\[sha256\].js).  
The use of mutable query-string ambiguity (e.g., app.js?v=1.0.0) is strictly prohibited. Query strings are frequently stripped by intermediary proxies, ignored by aggressive browser cache heuristics, and introduce severe ambiguity when resolving relative module imports. A content-hashed filename guarantees that a specific URI always resolves to the exact same bytes.  
While Subresource Integrity (SRI) provides a cryptographic guarantee that fetched resources have not been manipulated in transit12, the root index.html cannot be content-addressed, as it serves as the stable entry point for the user. Therefore, index.html must include strict SRI attributes for all initial script and style loads. The release identity is instantiated when the browser parses index.html, verifying the embedded SRI hashes, which subsequently bootstrap the exact matching WASM and service-worker files. The signed deployment manifest serves as the authoritative source of truth for these hashes during the build phase, while the service-worker cache manifest enforces them during offline execution.

## **4\. Per-Artifact Atomic Publication State Machine**

Static hosting environments generally process file uploads sequentially and do not offer global transactional atomicity across multiple files. If a user loads the application while a deployment is midway through, they risk receiving a new index.html that references a WASM file that has not yet been uploaded. To mitigate this unavoidable mixed-generation window, the deployment system must execute a strict dependency-first publication state machine.

| Deployment Phase | Action Executed | mixed-generation State |
| :---- | :---- | :---- |
| **1\. Preflight & Inventory** | Scans remote host for existing assets and validates hosting credentials. | Safe. No changes made. |
| **2\. Stage (Dependency-First)** | Uploads all new content-addressed assets (WASM, JS, CSS). | Safe. New assets do not overwrite existing files due to unique hashes. |
| **3\. Hash Readback** | Verifies presence, length, and cryptographic hash of all uploaded assets via HTTPS. | Safe. index.html still points to the previous stable generation. |
| **4\. HTML/Pointer Commit** | Uploads the mutable index.html, sw.js, and manifest.json. | **Critical Window**. Sequential update of pointers. Cache headers must prevent stale reads. |
| **5\. Public Readback** | Streams the live index.html and sw.js to verify cache headers and SRI hashes. | Safe. New generation is now live and coherent. |
| **6\. Browser Smoke Test** | Headless browser executes a local WASM instantiation to confirm execution. | Safe. Validates runtime integrity. |
| **7\. Orphan Cleanup** | Purges retired generations (excluding explicitly retained LKG assets). | Safe. Only unreferenced assets are removed. |

During the "Stage" phase, any conditional requests made by active users will simply receive the older, fully coherent index.html and its associated assets11. The references remain safe because the older immutable assets are deliberately retained on the host until the "Orphan Cleanup" phase, which only executes after the new generation is proven stable.

## **5\. Service-Worker Install, Wait, Activate, Retire, and Recovery Model**

The service-worker lifecycle is designed to act as a resilient local proxy, but improper management of its states (install, waiting, activate) introduces severe update hazards. The W3C specification mandates that errors during the installation phase must be recoverable1.  
The service worker registration must specify the scope precisely (e.g., /) and include updateViaCache: 'none' to guarantee that the browser bypasses the HTTP cache when checking for updates to the script1. The service worker script (sw.js) must contain an inline, immutable constant defining its release identity hash. When the browser detects a byte-difference in sw.js, the new worker enters the install phase.  
During install, the new worker must invoke event.waitUntil() to suspend the lifecycle until all required immutable assets for the new release are downloaded and placed into a version-specific cache namespace (e.g., tiny-rust-lm-shell-\[hash\]). If any download fails or a hash mismatch occurs, the promise rejects, the installation aborts, and the existing active worker safely retains control14.  
The application must actively avoid an update taking over before all required assets verify. Therefore, the implementation must never blindly execute self.skipWaiting() or clients.claim() upon installation1. Forcing an update via skipWaiting while the user is interacting with the chat interface would immediately swap the underlying network routing, leading to race conditions between the new JavaScript execution context and the older, memory-resident WASM module. Instead, the waiting worker must remain dormant. The old worker is retired only when the user authorizes a reload, triggering a coordinated activation sequence.

## **6\. Cache Namespaces and Resource-Specific Fetch Policies**

The Service Worker Cache API provides granular programmatic control over HTTP responses, but it must be meticulously architected to prevent namespace collisions and data leaks14. TinyRustLM requires strict separation of concerns through isolated cache namespaces and resource-specific fetch policies.

> 1. **Release Shell Namespace (tiny-rust-lm-shell-v{HASH}):** Contains index.html, JavaScript bundles, WASM modules, CSS, and icons.  
   * *Fetch Policy:* **Cache-Only** (after successful installation). Because these assets are cryptographically immutable and verified during the install phase, subsequent network requests are unnecessary and waste bandwidth.  
> 2. **Public Metadata Namespace (tiny-rust-lm-metadata):** Contains public model catalogs, schema definitions, and community settings.  
   * *Fetch Policy:* **Stale-While-Revalidate**. The service worker serves the cached metadata instantly for fast UI rendering, while asynchronously fetching an updated version in the background to update the cache for the next load.  
> 3. **Excluded Resources (No Cache Storage):** User prompts, chat histories, diagnostics, and MemoryEndpoints data must never enter Cache Storage.  
   * *Fetch Policy:* **Network-Only** (with explicit IndexedDB fallback for local persistence). Prompts must bypass the Service Worker cache to guarantee privacy and ensure that sensitive user data is not inadvertently exposed through cache inspection APIs. Cache keys must proactively exclude secret query parameters or credential-bearing URLs.  
> 4. **Excluded Resources (OPFS):** Large language model weights (e.g., .gguf files).  
   * *Fetch Policy:* **Bypass SW**. Model bytes are managed explicitly via the Origin Private File System (OPFS). The Service Worker must not intercept or cache these files, as doing so would duplicate multi-gigabyte payloads in browser memory and trigger severe quota violations.

## **7\. Multi-Tab, PWA, Update, and Last-Known-Good Rollback Behavior**

Users frequently operate web applications across multiple browser tabs or installed PWA windows. If an update occurs independently in one tab while another remains open, a split-brain scenario emerges where two different application generations attempt to read and write to the same IndexedDB schema.  
To coordinate updates, TinyRustLM must utilize the BroadcastChannel API. When a new service worker signals that it is in the waiting state, a designated "leader" tab broadcasts an UPDATE\_PENDING message. All active tabs display a synchronized version notification: "A new version is available. Save your work and reload." When the user voluntarily authorizes the update, the leader broadcasts an EXECUTE\_UPDATE command. All tabs must synchronously save their unsaved local state to IndexedDB, disable user input to prevent data corruption, and command the waiting worker to execute skipWaiting(). Once the worker confirms activation, all tabs execute a forced reload.  
To protect against defective updates that evade deployment smoke tests, the architecture must support a Last-Known-Good (LKG) rollback. The LKG is not an unversioned, vulnerable cache; it is a specific, previously verified immutable release identity bound by cryptography. If a critical runtime error occurs (e.g., a WASM instantiation panic), rollback authorization is triggered on the hosting provider by reverting the index.html pointer to the exact LKG hash. The service worker must be programmed with a security exception to permit downgrades exclusively to explicitly recognized LKG hashes, bypassing standard version increment checks. Upon detecting an authorized downgrade, the service worker restores the retained LKG cache namespace and immediately retires the defective higher-version cache. Retired model-byte routes or insecure headers are never restored.

## **8\. Offline Capability and Truthful Status Matrix**

The application must provide a transparent and truthful representation of its offline semantics. Simulating live network services or obfuscating connectivity failures degrades operator trust. The UI must clearly differentiate between the availability of the network, the presence of the local language model, and the status of peer-to-peer (P2P) or companion dependencies.

| Status Condition | UI Representation | Allowed Operations |
| :---- | :---- | :---- |
| **Offline, Model Cached** | "Offline: Local Model Active" | Full chat inference, prompt execution, and local history saving via OPFS and IndexedDB. |
| **Offline, No Model** | "Offline: No Model Available" | View chat history, manage settings, delete local data. Inference is strictly disabled. |
| **Online, Companion Disconnected** | "Companion App Unreachable" | Standard local inference. Hardware-accelerated companion endpoints (e.g., loopback MemoryEndpoints) are disabled. |
| **Defective Release** | "Application Error: Pending Rollback" | Hard reload prompted. Cache repair sequence initiated. All other functions locked. |

To implement this truthfully, the application utilizes the navigator.onLine API as a baseline, complemented by active WebSocket or Server-Sent Events (SSE) heartbeat checks for local companion applications. If a catalog metadata fetch fails while offline, the application falls back to the previously cached metadata but explicitly tags the UI as displaying "Stale Metadata," preventing the user from assuming the catalog is current.

## **9\. Security Headers, Isolation, SRI, and Network Closure**

For WebAssembly threads to function, they require SharedArrayBuffer memory sharing. To mitigate speculative execution vulnerabilities (such as Spectre), browsers strictly restrict SharedArrayBuffer to cross-origin isolated environments8. Therefore, the static host must enforce rigid isolation headers.  
The required isolation headers include Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp8. While credentialless is an alternative for COEP, require-corp is mandated to enforce strict network closure, ensuring that no third-party assets can be loaded without explicit authorization.  
A stringent Content Security Policy (CSP) must be applied to lock down the execution environment16.

* default-src 'none'; establishes a deny-by-default baseline.  
* script-src 'self' 'wasm-unsafe-eval'; is strictly required for the browser to compile and execute the Rust WASM payload16.  
* worker-src 'self'; restricts the loading of Web Workers and Service Workers exclusively to the origin, replacing older fallback behaviors16.  
* connect-src 'self' http://127.0.0.1:\* ws://127.0.0.1:\*; permits fetches only to the origin and the local loopback companion, explicitly allowing MemoryEndpoints operations while blocking all unauthorized telemetry or tracking16.  
* object-src 'none'; and base-uri 'none'; prevent plugin injection and base URL hijacking.

Subresource Integrity (SRI) guarantees that fetched scripts match expected hashes12. However, SRI validates the response payload, not the URL. Furthermore, CORS configurations can complicate SRI validation. The service worker's fetch handler must enforce integrity checks by ensuring that any request for an immutable asset strictly matches the cache digest. If a network request is hijacked or corrupted (e.g., by a captive portal redirect), the browser's native SRI check on the HTML tag will discard the payload before execution, triggering an error event that the application catches to initiate a secure cache repair protocol. Unexpected third parties, source maps in production, and unauthorized CSP reporting endpoints are eliminated through this strict network closure.

## **10\. Bounded Remote Cleanup and Model-Byte Absence Proof**

Unbounded remote cleanup scripts (e.g., recursive rm \-rf operations) in deployment pipelines represent a severe supply-chain risk, frequently causing accidental deletions of unrelated directories or catastrophic total-site erasure. The deployment cleanup phase for TinyRustLM must be strictly bounded using a finite allowlist.  
The deployment manifest generates a complete list of all currently active asset hashes and the explicitly retained LKG hashes. The remote cleanup script queries the static host's inventory. For every file present, it evaluates whether the file is a recognized application asset type (e.g., .js, .css, .wasm) and whether its filename hash matches an active or LKG release. If the file is a recognized type but the hash is obsolete, it is deleted. If the file is an unknown type, an unexpected directory name, or presents symlink/reparse anomalies, the script must immediately halt. It must throw a visible deployment error without logging sensitive names and must never recursively delete arbitrary directories.  
To provide mathematical proof of model-byte absence on the static host, the deployment system executes a pre-flight file-size and MIME-type traversal. Any file in the deployment artifact exceeding a strict application-asset threshold (e.g., \>50MB) or matching known model extensions (.gguf, .bin) aborts the deployment. This guarantees that model bytes are never hosted or proxied by project domains.

## **11\. Public HTTPS Readback and Browser Verification**

A release is not considered successful simply because a deployment script generated a ZIP file or reported a successful upload. Network edge layers, CDN caching tiers, and propagation delays frequently introduce state inconsistencies or strip critical security headers.  
TinyRustLM must generate a Public Readback Receipt. A verification script running outside the deployment network must stream every public response to verify:

* **Expected Release Identity:** The streamed byte payload hashes exactly to the expected SHA-256 identity.  
* **Cache Headers:** Immutable assets contain Cache-Control: max-age=31536000, immutable11. The index.html and sw.js contain Cache-Control: no-cache, no-store, must-revalidate.  
* **Security Headers:** CSP, COOP, COEP, and CORP are present, syntactically valid, and strictly enforce isolation.  
* **MIME Types:** .wasm is explicitly served as application/wasm5.  
* **Canonical Origin:** No redirects or hidden route concealments exist.

Following HTTPS readback, an automated headless browser matrix (incorporating fresh instances of Chromium, Firefox, and WebKit) executes a rigorous verification protocol. This matrix tests desktop and mobile viewports, first online loads, warm loads, simulated network loss (offline loads), interrupted installations, and cache corruption recovery scenarios. It must also verify accessibility constraints, ensuring keyboard navigation functions correctly and that reduced-motion preferences are honored without duplicating assistant rendering.

## **12\. Secret Scanning and Privacy Contract**

The privacy contract of TinyRustLM explicitly dictates that user prompts, generated tokens, and model bytes must never leave the local browser environment. To enforce this contract architecturally, rigorous secret and privacy scanning must be integrated into every phase of the lifecycle.  
Prior to deployment, entropy scanners must inspect the source code, built assets, source maps, and manifests to prevent the accidental inclusion of workspace identifiers, API keys, credentials, or invitation URLs. During execution, the service worker's fetch event handler acts as a secondary firewall, explicitly dropping and refusing to process any outbound Request whose destination is not in the explicit connect-src allowlist.  
A periodic internal audit within the application lifecycle checks browser storage mechanisms. If any object resembling a user prompt, model route, or unversioned payload is detected in the Service Worker Cache, the application must execute a self-repair by invoking the Clear-Site-Data mechanism. The server response must include the header Clear-Site-Data: "cache", "cookies", "storage", "executionContexts". The inclusion of "executionContexts" forces a hard termination of the active service worker and clears DOM-accessible storage, ensuring that memory-resident data cannot recreate the compromised state18.

## **13\. Versioned Receipt Graph and Phase Invalidation**

The build and deployment pipeline must produce a Directed Acyclic Graph (DAG) of versioned receipts to avoid redundant computation, isolate invalidation triggers, and provide a verifiable audit trail.

* **Build Receipt:** Cryptographically binds the inputs (source code revision, clean worktree state, Rust toolchain version) to the emitted asset hashes.  
* **Package Receipt:** Confirms the construction of the immutable asset graph and the structural parity of the generated index.html.  
* **Deployment Receipt:** Confirms the atomic promotion of assets to the remote staging or production environment.  
* **Public Readback Receipt:** Confirms public availability, correct MIME types, and the presence of strict security headers across the CDN.  
* **Browser/Offline Receipt:** Confirms successful WASM execution, SW installation, and offline cache population across the browser matrix.  
* **Cleanup Receipt:** Verifies the bounded deletion of obsolete assets without remote recursion.

Binding inputs to versions ensures that a change in a browser-test suite does not require rebuilding identical Rust assets. Conversely, if an infrastructure change alters a CDN caching header, the Deployment and Readback Receipts are invalidated, forcing a re-verification of the public edge, but the original Build Receipt remains entirely valid.

## **14\. TDD Backlog and Clean Removal Plan**

Executing this architecture requires a strictly ordered Test-Driven Development (TDD) backlog to ensure that the theoretical constraints hold true in practice.

> 1. **Asset-Graph Validation:** Assert that the Rust/WASM build emits mathematically deterministic hashes for identical source inputs.  
> 2. **Release Identities:** Assert that index.html correctly embeds these hashes with valid SRI attributes.  
> 3. **Static Local Server:** Validate COOP, COEP, and WASM MIME types locally before remote deployment.  
> 4. **Service-Worker Lifecycle Fixtures:** Test the strict transition from install to waiting to activate, ensuring skipWaiting is only called upon explicit BroadcastChannel authorization.  
> 5. **Mixed-Generation Tests:** Simulate a mid-deployment client request to ensure the older index.html successfully resolves older, retained immutable assets.  
> 6. **Offline Tests:** Disconnect the network interface and assert that the application launches successfully from Cache Storage and accurately accesses OPFS models.  
> 7. **Rollback Verification:** Revert the index.html pointer and assert that the service worker downgrades gracefully, restoring the LKG cache namespace.

Because TinyRustLM is pre-publication, all legacy caching strategies, obsolete unpublished shells, development routes, and unversioned service workers must be aggressively purged. A clean publication plan dictates that the new service worker include a one-time activation script that iterates through caches.keys() and executes caches.delete(key) for any cache not matching the new, strictly versioned release identity schema. Stop rules must be defined to halt deployment instantly if any unpublished shell fails to clear.

## **15\. Unknowns Requiring Hosting Credentials or Authorized Live Deployment**

While this report defines a robust, standards-compliant theoretical architecture, several operational facts require direct access to the live hosting infrastructure and credentials to verify definitively:

> 1. **Whole-Site Atomicity Support:** Does the specific static host (e.g., Cloudflare Pages, AWS CloudFront, Vercel) support atomic symlink updates or directory-level deployment transactions? If whole-release atomicity is natively supported by the provider, the "mixed-generation window" modeled in Section 4 can be eliminated at the infrastructure level.  
> 2. **Header Override Capabilities:** Can the CDN rules engine definitively enforce Cross-Origin-Embedder-Policy: require-corp on all edge nodes, or are there routing edge cases (such as custom 404 error pages or rate-limiting responses) that strip these security headers, thereby breaking WASM multithreading?  
> 3. **WASM MIME Type Defaults:** Does the hosting provider natively map the .wasm extension to application/wasm, or does it require a custom .htaccess or edge-routing rule override?5.  
> 4. **Edge Purge Latency:** What is the exact cache invalidation latency across the CDN edge nodes when the mutable index.html is updated? The deployment pipeline must block the generation of the "Browser Verification Receipt" until edge invalidation is globally complete to prevent the headless tests from reading stale pointers.  
> 5. **HTTP/103 Early Hints Support:** Does the CDN infrastructure support RFC 8297 103 Early Hints to allow the server to send Link: \<asset\>; rel=preload headers while the index.html is still being processed? Implementing this can significantly reduce the latency of bootstrapping the WASM module19.

*This report restricts its guidance to the structural, architectural, and deployment mechanics of progressive web platform lifecycles. It does not evaluate the internal logic of the Rust application, the viability of the language models, or legal compliance regarding user data sovereignty.*

#### **Works cited**

> 1. Service Workers Nightly \- W3C, [https://www.w3.org/TR/service-workers/](https://www.w3.org/TR/service-workers/)  
> 2. Service Workers 1 \- W3C, [https://www.w3.org/TR/2017/WD-service-workers-1-20171102/](https://www.w3.org/TR/2017/WD-service-workers-1-20171102/)  
> 3. Storage quotas and eviction criteria \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/Storage\_API/Storage\_quotas\_and\_eviction\_criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)  
> 4. Tracking Prevention in WebKit, [https://webkit.org/tracking-prevention/](https://webkit.org/tracking-prevention/)  
> 5. WebAssembly Web API \- W3C, [https://www.w3.org/TR/wasm-web-api-1/](https://www.w3.org/TR/wasm-web-api-1/)  
> 6. Worker() constructor \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker)  
> 7. "modules" | Can I use... Support tables for HTML5, CSS3, etc \- CanIUse, [https://caniuse.com/\#search=modules](https://caniuse.com/#search=modules)  
> 8. same origin-domain \- HTML, [https://html.spec.whatwg.org/multipage/browsers.html](https://html.spec.whatwg.org/multipage/browsers.html)  
> 9. Cross-Origin-Embedder-Policy \- HTML Standard, Edition for Web Developers, [https://html.spec.whatwg.org/dev/browsers.html](https://html.spec.whatwg.org/dev/browsers.html)  
> 10. RFC 8246 \- HTTP 不可变响应 \- HTML, [https://htmlspecs.com/http/rfc8246.html](https://htmlspecs.com/http/rfc8246.html)  
> 11. RFC 8246: HTTP Immutable Responses, [https://www.rfc-editor.org/rfc/rfc8246.html](https://www.rfc-editor.org/rfc/rfc8246.html)  
> 12. Subresource Integrity \- W3C, [https://www.w3.org/TR/2014/WD-SRI-20140318/](https://www.w3.org/TR/2014/WD-SRI-20140318/)  
> 13. Service Workers \- W3C, [https://www.w3.org/TR/2015/WD-service-workers-20150625/](https://www.w3.org/TR/2015/WD-service-workers-20150625/)  
> 14. Service Workers \- W3C, [https://www.w3.org/TR/2014/WD-service-workers-20140508/](https://www.w3.org/TR/2014/WD-service-workers-20140508/)  
> 15. PWA Advanced Implementation Guide \- Service Worker Cache Strategies, Push, and Background Sync | hidekazu-konishi.com, [https://hidekazu-konishi.com/entry/pwa\_advanced\_implementation\_guide.html](https://hidekazu-konishi.com/entry/pwa_advanced_implementation_guide.html)  
> 16. Content Security Policy Level 3 \- W3C, [https://www.w3.org/TR/CSP3/](https://www.w3.org/TR/CSP3/)  
> 17. Fetch Standard, [https://www.w3.org/TR/cors/](https://www.w3.org/TR/cors/)  
> 18. Clear Site Data \- W3C, [https://www.w3.org/TR/clear-site-data/](https://www.w3.org/TR/clear-site-data/)  
> 19. Web Performance Checklist for Core Web Vitals \- LCP, INP, and CLS \- Hidekazu Konishi, [https://hidekazu-konishi.com/entry/web\_performance\_checklist\_core\_web\_vitals.html](https://hidekazu-konishi.com/entry/web_performance_checklist_core_web_vitals.html)  
> 20. HTTP/2 Support \- Gunicorn, [https://gunicorn.org/guides/http2/](https://gunicorn.org/guides/http2/)
# **TinyRustLM Release Architecture: Defensible Publication and Atomic Activation on Constrained Hosting**

## **Primary Recommendation and Falsification Hypothesis**

The fundamental architectural recommendation for TinyRustLM is to abandon the pursuit of server-side atomic directory transactions over constrained FTPS hosting in favor of a Client-Mediated Atomic Activation model. This architecture shifts the responsibility for deployment consistency away from an unreliable remote file system and places it securely within the deterministic execution environment of the client's browser, specifically leveraging the Service Worker lifecycle and content-addressed asset publication.

Under this model, the six core payload files (model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2) will undergo a justified format change to include immutable cryptographic hashes in their deployment identifiers (e.g., model.\[hash\].slm2). The composition.acg2 file transitions into an authoritative, cryptographically bound manifest. The final release marker is reduced solely to the index.html file and the service-worker.js script, which serve as minimal pointers that atomically pivot the client's local state to the new dependency graph.

By offloading the atomicity requirement to the browser's Service Worker installation phase and Cache Storage mechanisms, the constrained hosting environment is only required to provide eventual consistency and basic static file serving. This negates the need for complex, unsupported remote atomic state transitions, entirely mitigating the risk of exposing a mixed or falsely successful release.

The strongest reason this architecture could fail lies in the potential for aggressive temporal tearing on edge caching networks, particularly affecting first-time visitors who lack an installed Service Worker. This hypothesis posits that if the constrained hosting environment or an unmanaged upstream Content Delivery Network (CDN) exhibits severe temporal tearing—where the index.html pointer is updated and served to the client, but the newly referenced hashed files are not yet fully propagated or available on the disk—a cold-load user will receive a valid HTML file but encounter HTTP 404 errors for the corresponding payloads. This would result in a fractured initial experience that the Service Worker cannot intercept, as it has not yet been registered.

To falsify the viability of the client-mediated activation model, an engineer must execute the following experiment: Publish a new release pointer (index.html) referencing locked or non-existent cryptographic assets via a simulated, artificially delayed FTPS upload sequence, then immediately initiate a cold-cache browser navigation to the site. If the resulting failure state permanently corrupts the user's LocalStorage or IndexedDB cache, rendering the application unrecoverable even upon a subsequent hard refresh when the files eventually become available, then the client-mediated activation model is unsafe for this specific web application framework, and an alternative server-side promotion mechanism must be mandated.

## **Taxonomy of Evidence and Assertions**

To establish a rigorous and defensible foundation for the architectural decisions that follow, the operational context must be explicitly categorized into distinct evidentiary tiers. This separation prevents the conflation of verified protocol behavior with unverified local assumptions.

**Project-Supplied Facts:** The application, TinyRustLM, is a prerelease browser-local small-language-model assistant requiring Rust and WebAssembly (WASM) execution, supplemented by a Windows .NET companion for supported acquisition operations. The sole current deployment composition strictly utilizes six files: model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2, which bind exact artifact identities. Canonical source code repositories are strictly located under E:\\Source\\Rust\\TinyRustLM.com, while model payloads reside exclusively in D:\\LLMs\\TinyRustLM. There is no established qualified default model or proven live initial seed in the supplied engineering checkpoint, and MiniModel.org is explicitly authorized to supply initial server seeds. A previous unfinished local review identified a path where the main deployment flow attempted to publish the final release marker through a helper process that ultimately rejected marker writes.

**Externally Verified Facts:** The File Transfer Protocol (FTP), specifically the RNFR (Rename From) and RNTO (Rename To) command sequence defined in RFC 959, initiates a rename operation but inherently lacks protocol-level guarantees for filesystem atomicity, particularly across virtual directories or distributed mount points1. HTTP caching semantics, governed by RFC 9111, dictate that client and intermediary caches must validate stale responses, while RFC 8246 introduces the immutable directive, permitting clients to bypass conditional revalidation entirely during the asset's freshness lifetime4. Service Worker lifecycles, as defined by W3C specifications, strictly isolate the installation of new assets from the active execution thread; a new worker remains in a waiting state until all client tabs controlled by the previous worker are fully closed, unless the skipWaiting() method is explicitly invoked by the developer6.

**Locally Unverified Conditions:** The exact capabilities of the current FTPS server to handle concurrent data connections, enforce exclusive file locks, or execute cross-directory RNTO commands without yielding transient 404 Not Found errors to concurrent HTTP readers remain unmeasured. The propagation delay, configuration, and edge-caching behavior of any potential Content Delivery Network positioned in front of the constrained FTPS host are currently unknown.

**Hypotheses:** It is hypothesized that by architecturally separating the asset upload phase (writing hashed, immutable binary blobs) from the activation phase (updating the HTML and Service Worker pointers), the deployment process will mathematically eliminate all risks of serving a mixed-version release to an active runtime.

**Recommendations:** The project must implement a justified format change to transition the exact artifact identities of the six core files to incorporate cryptographic hashes within their filenames, rendering all deployed binary blobs strictly immutable and content-addressed.

## **1\. The Consistency Requirement for Browser-Local LLM Execution**

The consistency model required for a client-executed small-language-model assistant is uniquely stringent. In traditional server-rendered web applications, visual tearing or a temporarily missing CSS file results in a degraded but often recoverable user experience. However, a WebAssembly runtime executing a quantized neural network relies on exact memory alignments, precisely mapped vocabulary token offsets, and strict prompt templating structures.

The application encompasses the execution environment (HTML, JavaScript, WebAssembly binary, and the Service Worker), the admission metadata (the model catalog and seed configurations), and the binary model payloads themselves (the six .slm2 through .acg2 files). Distinguishing between availability, integrity, and correct activation is paramount to defining this consistency requirement. Availability simply dictates that a server responds to an HTTP GET request with a 200 OK status. Integrity guarantees that the payload delivered matches the exact byte sequence generated by the compiler or model conversion tool. Correct activation ensures that the client initializes a cohesive, internally consistent graph of these dependencies without any cross-version contamination.

A dangerous state manifests when these dependencies are fractured across version boundaries. Consider a scenario where a user's browser successfully fetches a newly deployed tokenizer.tokenizer2 file but retains an older, cached version of model.slm2. The token IDs generated by the user's input prompt will misalign with the expected embedding matrices within the neural network architecture. This misalignment inevitably leads to catastrophic hallucinations, out-of-bounds memory panics within the WebAssembly linear memory space, or silent execution failures that freeze the browser tab9. Similarly, if the compiled WASM executable expects an updated sampling.sampling2 binary format but receives a legacy structure, the parsing logic will fail instantly. These states are fundamentally broken; they corrupt the end-user experience and often require manual intervention to purge browser caches.

Conversely, a merely stale state is entirely safe. Prolonged staleness occurs when a new release has been successfully published to the server, but a user's browser loads the HTML, WASM, and all six payload files from the previous, superseded version. Because the dependency graph remains internally cohesive and historically accurate, the application will function flawlessly, albeit without the latest features or model weights. In distributed, heavily cached web architectures, engineering for safe staleness is vastly preferable to risking transient inconsistency.

The release marker serves as the singular mechanism that signals the active state of the application to the client. In naive publication tooling, attempting to upload all files directly into a single active directory means the release marker is implicitly, and dangerously, defined by the timestamp of the final uploaded file. True consistency requires that the release marker is treated as an explicit, atomic pointer that is updated only after all dependency bytes are successfully written, flushed to disk, and cryptographically verified via readback.

## **2\. Comparative Analysis of Publication Capabilities**

When engineering teams are constrained to FTPS-oriented hosting and lack access to modern CI/CD orchestration, they frequently attempt to synthesize atomic deployments using legacy file transfer commands. A comparative analysis of these mechanisms reveals critical limitations that dictate the necessity of client-side mediation.

Atomic directory and symlink switching is the gold standard in POSIX-compliant environments. A symbolic link pointing to a release directory can be updated atomically using the renameat() system call, ensuring that concurrent web server processes read either the entirety of the old release or the entirety of the new release. However, the standard File Transfer Protocol (RFC 959\) does not support symlink manipulation2. Engineers often attempt to emulate this behavior using the RNFR (Rename From) and RNTO (Rename To) command sequence. The FTP client sends RNFR current, receives a 350 Pending response, and sends RNTO old, followed by RNFR new and RNTO current, awaiting 250 Success codes for each operation3.

While some modern FTP servers implement this sequence seamlessly, there is absolutely no guarantee that the operation is isolated from concurrent HTTP read requests. An ordinary FTP rename does not prove atomicity. If a client HTTP request arrives precisely between the two RNTO commands, the web server will likely return a 404 Not Found error, causing the web application to crash. Furthermore, if the FTP server relies on virtual directories distributed across physical storage nodes or network-attached storage, the RNTO command may trigger a non-atomic background copy rather than a rapid metadata pointer swap, drastically widening the race condition window13.

Modern object stores, such as Amazon S3, solve this by supporting conditional writes using If-None-Match and ETags15. This optimistic concurrency control ensures that a release marker is only updated if its previous state matches expected parameters, completely preventing race conditions among concurrent publishers. Constrained FTPS hosting entirely lacks this capability. An FTPS upload is a blind, unconditional overwrite. If two engineers attempt to publish to the same file simultaneously, their data streams will collide, resulting in interleaved byte sequences, corrupted binaries, or unpredictable overwrites.

A minimal server-side promotion endpoint involves deploying a tiny, custom script (e.g., PHP or Node.js) to the hosting environment that accepts a verified webhook to update an internal symlink or database pointer. While effective, this requires the host to support dynamic server-side execution environments, which violates the premise of relying strictly on constrained static hosting.

Consequently, the most defensible approach utilizes immutable versioned asset URLs combined with an atomic small pointer. By publishing content-addressed assets (where the filename includes the file's hash), files are never overwritten; they are only appended to the storage medium. The release marker is a single, small HTML or JSON file that points to these immutable assets. While uploading the small pointer file is technically not atomic at the filesystem level, the operation takes milliseconds, reducing the race condition window to near zero. More importantly, even if a user downloads a partially written pointer file, the strict parsing requirements of HTML or JSON ensure the client will simply reject the malformed file and retry, rather than executing a mixed state.

## **3\. Necessity of Remote Transactions vs. Client-Mediated Validation**

The central architectural question is whether a full remote transaction on the server is strictly necessary. The analysis proves that it is not. By utilizing content-addressed assets and shifting the validation burden to the client, the requirement for server-side transactional guarantees can be safely eliminated.

FTPS operates by negotiating a secure TLS channel over the control connection, followed by establishing encrypted data channels for file transfers16. While the protocol provides strong transport confidentiality and integrity via TLS cryptographic verification16, it offers zero transactional semantics. If a TCP connection drops midway through uploading the 300MB model.slm2 file, the server retains a truncated, useless binary. FTPS cannot provide transactional rollbacks, global exclusion, or definitive final-marker ordering.

Because the hosting environment cannot mathematically guarantee atomic state transitions, the atomicity must be engineered into the client. The mathematical proof of safety for client-mediated validation operates as follows:

First, asset identity is inextricably bound to its byte content. A file named model.f83a2b1c.slm2 must always contain the exact byte sequence that hashes to f83a2b1c. Second, the manifest (composition.acg2) contains the exact cryptographic hashes of all required dependencies. Third, the browser's Service Worker fetches the manifest, identifies the required assets, and issues network requests for the content-addressed files.

If a file is missing due to a dropped FTP connection (yielding an HTTP 404\) or truncated due to a partial overwrite (yielding a hash mismatch upon client-side calculation), the Service Worker instantly and deterministically rejects the entire update transaction. Because the Service Worker manages a completely separate, versioned Cache Storage bucket for the incoming release, the existing active cache remains untouched and pristine. The client gracefully degrades, continuing to serve the previous stale version from the old cache, and no mixed or corrupted state is ever exposed to the WebAssembly runtime. Observable failure behavior is thus reduced to a silent background update failure, rather than a catastrophic foreground application crash.

## **4\. Publication Sequence, Mutations, and Concurrency**

To safely publish a release without triggering errors for active clients or corrupting the canonical repository, the sequence of operations must strictly isolate the payload upload phase from the pointer transition phase. The exact publication order must be adhered to without deviation.

The process begins with the Blob Upload Phase. The content-addressed artifacts (model.\[hash\].slm2, tokenizer.\[hash\].tokenizer2, etc.) are transferred over FTPS. Because these filenames are globally unique by definition, they do not interfere with any live traffic or existing files. Next, the Verification Readback Phase mandates that the publishing agent downloads the byte-range headers (or the full files, if byte-range requests are unsupported by the host) from the live HTTP endpoint. This independent verification ensures that the bytes resting on the server's disk match the local hash calculations, confirming that no corruption occurred during the FTPS transit.

Following blob verification, the Manifest Upload Phase transfers the composition.\[hash\].acg2 file, which is subjected to the same strict HTTP readback verification.

Only after all dependencies and the manifest are definitively verified does the system execute the last mutation: committing the release marker. This involves uploading the index.html file and the service-worker.js script. These files contain a hardcoded reference to the new composition.\[hash\].acg2. Once these files overwrite their predecessors, the release is considered live.

To exclude concurrent publishers across different hosts—a critical requirement given FTPS's lack of conditional writes—an opportunistic locking file mechanism must be employed. Before any uploads begin, the publishing client must attempt to write a file named publish.lock containing a unique, randomly generated session UUID. The client then immediately downloads this file via HTTP. If the downloaded UUID matches the generated UUID, the lock is successfully acquired. If it does not match, a concurrent publisher has overwritten the lock in the intervening milliseconds, and the local process must immediately abort. While this mechanism is subject to minute race conditions, it is the simplest defensible concurrency control available on constrained infrastructure.

Cleanup operations must only occur after the release marker has been successfully validated. To avoid deleting assets still actively in use by clients with stale browser tabs or users in the midst of downloading, the system must retain the superseded payloads for a minimum of one full deployment cycle. Once a replacement is validated, the cleanup routine queries the server directory, identifies files not referenced by the current or immediately preceding composition.acg2 manifests, and issues FTP DELE commands to remove them11. This satisfies the requirement to retire superseded payloads while maintaining operational safety.

## **5\. Read-Only Preparation from Canonical Source**

The transition from the local development environment to the live deployment must be sterile. The local environment must not accidentally publish uncommitted code, hardcoded developer secrets, or mismatched binary layouts. Avoiding source snapshots and making the cost proportional to the risk requires strict reliance on Git plumbing commands and deterministic hashing.

### **Clean Source Identity and Workspace Verification**

Before the deployment sequence initializes, the automation script must verify that the Git workspace located in E:\\Source\\Rust\\TinyRustLM.com is completely clean. Relying on high-level git status output parsing is notoriously brittle and subject to user configuration overrides. The deployment script must utilize low-level plumbing commands to definitively assert workspace integrity18.

The exact assertion requires two distinct checks. First, checking for uncommitted modifications to tracked files requires executing git diff-index \--quiet HEAD19. This command directly compares the index against the working tree and exits with a non-zero status if any differences exist. Second, checking for untracked files that might inadvertently leak into the build requires testing the output of git ls-files \--other \--exclude-standard for emptiness18. If either of these checks fails, the deployment must abort immediately. This guarantees that every deployed artifact corresponds exactly to an immutable Git commit hash, preventing unreplicable deployments.

### **Dependency Closure and Bounded Hashing**

The dependency closure is strictly limited to the source repository and the model payload directory. The local publisher script must calculate the SHA-256 hashes of the exact files residing in D:\\LLMs\\TinyRustLM. To ensure the exact byte layout is preserved, the hashing mechanism must stream the binary files as raw bytes, explicitly disabling any tools that might alter line endings or normalize character encodings during the read process.

The manifest identity must be established by structuring the composition.acg2 as a JSON-like or structured binary manifest that explicitly maps logical file roles to their immutable, hashed identities.

&nbsp;

&nbsp;

&nbsp;

JSON

{  
&nbsp;&nbsp;"schema\_version": "2.0.1",  
&nbsp;&nbsp;"commit": "a1b2c3d4e5f6...",  
&nbsp;&nbsp;"timestamp": "2026-09-19T14:55:50Z",  
&nbsp;&nbsp;"assets": {  
&nbsp;&nbsp;&nbsp;&nbsp;"model": "model.f83a2b1c.slm2",  
&nbsp;&nbsp;&nbsp;&nbsp;"tokenizer": "tokenizer.c4d5e6f7.tokenizer2",  
&nbsp;&nbsp;&nbsp;&nbsp;"template": "template.9a8b7c6d.template2",  
&nbsp;&nbsp;&nbsp;&nbsp;"sampling": "sampling.1e2f3a4b.sampling2",  
&nbsp;&nbsp;&nbsp;&nbsp;"prompt": "prompt.5c6d7e8f.prompt2"  
&nbsp;&nbsp;}  
}

### **Secret Exclusion**

Credentials for FTPS hosting must never reside within the E:\\Source\\Rust\\TinyRustLM.com repository. They must be injected at runtime via a local environment variable file (e.g., %USERPROFILE%\\.config\\tinyrustlm\\deploy.env) that is explicitly excluded from version control globally via the developer's \~/.gitignore\_global. During the execution of the deployment script, all logging mechanisms must aggressively mask any string matching the FTPS password or the host tuple from standard output to prevent accidental leakage into terminal histories or CI logs.

## **6\. Predecessor Validation, Cache Behavior, and Recovery**

Managing the lifecycle of a web application deployed to constrained hosting requires meticulous orchestration of HTTP caching headers and Service Worker events to handle predecessor validation, CDN propagation, and old browser tabs.

### **Cache-Control and CDN Propagation**

Constrained hosting environments often lack fine-grained edge caching controls, making the explicit management of HTTP headers critical. Because the payload files (\*.slm2) and the manifest (composition.\[hash\].acg2) are content-addressed and guaranteed never to change, they must be served with aggressive caching headers. The immutable directive (RFC 8246\) explicitly instructs browsers and intermediary CDNs that the response will never be updated while it is fresh. This entirely bypasses conditional validation requests (such as If-None-Match or If-Modified-Since) when a user reloads the tab, saving massive amounts of bandwidth and latency4.

The ideal header configuration for these immutable assets is Cache-Control: public, max-age=31536000, immutable4. Conversely, the release pointers (the index.html and service-worker.js files) must never be cached by shared intermediaries and must force client revalidation on every request. They should be served with Cache-Control: no-cache, no-store, must-revalidate23.

If the underlying FTPS hosting environment is so constrained that it does not allow the configuration of custom HTTP headers via .htaccess or similar server configuration files, the Service Worker must intercept the fetch events for the WebAssembly runtime and manually inject the caching logic into the Cache Storage API, effectively simulating the immutable directive purely on the client side.

### **Service Worker Lifecycle and Old Browser Tabs**

The transition of the Service Worker is the most delicate phase of atomic activation. When a new service-worker.js file is detected by the browser (triggered because it is served with no-cache and its byte content has changed), it initiates the install event6.

During this install phase, the new Service Worker reads the newly published composition.\[hash\].acg2, parses the required asset hashes, and downloads the new payload files into a specifically versioned cache bucket (e.g., tinyrustlm-cache-v2).

Crucially, W3C specifications dictate that the new Service Worker will enter a waiting state as long as any browser tabs are currently controlled by the old Service Worker6. Developers frequently use the self.skipWaiting() command to force the new worker to take control immediately28. However, forcing an immediate takeover while a user is actively generating language model tokens in WebAssembly can cause the WASM runtime to fatally crash if it attempts to lazily load a missing memory page or stream an asset that has suddenly been purged or altered by the new worker31.

To safely handle old tabs, skipWaiting() must not be invoked blindly. The application architecture must detect the waiting worker via the controllerchange event and display a subtle, non-intrusive UI prompt to the user: "A new version of TinyRustLM is ready. Please refresh to apply."8. This ensures the user is in a safe state before the runtime environment is swapped.

### **Rollback and Failed-Promotion Recovery**

If a deployment inadvertently introduces a critical regression, a rollback is executed by simply reverting the Git commit locally, recalculating the index.html pointer to reference the previous known-good composition.\[hash\].acg2, and republishing the HTML and Service Worker files.

Because superseded payloads are intentionally retained for one release cycle, the previous assets remain fully available on the server. If a client attempts to load the rolled-back HTML, the Service Worker will detect the older manifest, verify the assets are still available (either in its local Cache Storage or via a fast network fetch), and successfully initialize the prior stable state. Reconciling this recovery capability with the project's strict current-only retention policy means that the file deletion routines (via FTP DELE commands) must ensure a minimum delta is respected (e.g., keeping exactly version N and N-1 active on disk) rather than strictly maintaining only version N at all times.

## **7\. Credential Isolation and Target Discovery**

The target hosting identity must be strictly separated from the public source evidence. The deployment tooling requires a configuration tuple comprising \[FTP\_HOST, FTP\_PORT, FTP\_USER, FTP\_TLS\_MODE, HTTP\_READBACK\_URL\].

To prevent a wrong hosting tuple or an unrelated site from being published to, a minimal discovery procedure must be executed prior to deployment that guarantees secret exclusion while verifying environmental correctness.

The discovery procedure operates as follows:

> 1. The publisher reads the configuration tuple from the isolated environment file.  
> 2. It initiates an FTPS control connection to FTP\_HOST.  
> 3. It performs an AUTH TLS handshake, negotiating the cipher suite and establishing a secure control channel16.  
> 4. It authenticates, navigates to the target directory, and issues a PWD (Print Working Directory) and a LIST command to verify read/write access12.  
> 5. It uploads a zero-byte probe file named discovery\_\[timestamp\].tmp.  
> 6. It issues an HTTP GET request to HTTP\_READBACK\_URL/discovery\_\[timestamp\].tmp.  
> 7. If the HTTP readback returns a 200 OK, the mapping between the FTPS write path and the public HTTP read URL is definitively verified.  
> 8. The script deletes the probe file and reports "Discovery Successful: \[HTTP\_READBACK\_URL\]" to the console, without ever logging the username, password, or internal IP addresses.

## **8\. Remediation for Deficient Hosting Capabilities**

If the discovery procedure or subsequent operational monitoring reveals that the hosting environment lacks necessary capabilities, the system must gracefully degrade rather than leaving the engineering team blocked indefinitely.

**Failure:** The FTPS server strictly prohibits concurrent data connections, causing data channel lockups during multi-file uploads.**Fallback:** The publisher must queue all uploads serially, extending the overall deployment time but preserving connection stability. The client-mediated Service Worker architecture effortlessly handles this temporal delay, as clients simply ignore the slow, partial uploads until the HTML pointer updates at the very end of the process.

**Failure:** The hosting strips all custom HTTP headers, returning default text/plain MIME types or omitting Cache-Control directives entirely. **Fallback:** The Service Worker must intercept the fetch event specifically for WebAssembly.instantiateStreaming requests9. Modern browsers strictly require an application/wasm MIME type for streaming compilation to succeed37. If the constrained host returns an invalid type, the Service Worker buffers the response into an ArrayBuffer, instantiates the WASM module via the fallback WebAssembly.instantiate() method, and forcefully injects the correctly typed response into the Cache Storage. This mitigates the server-side misconfiguration at the cost of slight client-side memory overhead during the initial installation.

**Failure:** The server requires MiniModel.org for the initial server seeds because its disk quotas cannot host large binary payloads.**Fallback:** The composition.acg2 manifest format inherently supports absolute URLs. The publisher modifies the local build step to point the asset URIs directly to https://MiniModel.org/seeds/... while maintaining strict cryptographic hash validation within the manifest. This ensures the constrained host only serves the lightweight HTML/JS shell, offloading the heavy bandwidth requirements to the authorized seed provider.

## **Required Decision Artifacts**

### **Local-Versus-Live Status Vocabulary**

To maintain precise communication regarding deployment state, the following vocabulary must be strictly utilized:

| Status Term | Definition | Implication |
| :---- | :---- | :---- |
| **Workspace Clean** | Local Git repository has zero uncommitted changes (verified via git diff-index). | Code is ready for hash generation. |
| **Hashed** | Local payload binaries have been appended with SHA-256 identities. | Assets are immutable. |
| **Blobs Live** | Content-addressed files are successfully written via FTPS. | Files exist on server but are invisible to clients. |
| **Verified** | HTTP GET requests confirm the live server bytes match local hashes. | Transport integrity is proven. |
| **Pointer Pivoted** | index.html and service-worker.js have been overwritten. | The release is actively serving to new clients. |
| **Superseded** | An asset is no longer referenced by the current or N-1 manifest. | Asset is eligible for FTPS DELE cleanup. |

### **Architecture Decision Matrix**

&nbsp;

| Capability Requirement | Option 1: FTPS Rename (RNFR/RNTO) | Option 2: Active Server Scripts (PHP/Node) | Option 3: Client-Mediated SW Validation (Recommended) |
| :---- | :---- | :---- | :---- |
| **Atomicity Guarantee** | Unreliable across distributed FS; creates 404 windows2. | High (if using DB pointers or local Symlinks). | Absolute (cryptographically validated locally on the client). |
| **Host Support Needed** | Built-in but implementation varies widely. | Requires specific runtime (often unavailable on constrained hosts). | Requires only static HTTP file serving. |
| **Mixed-State Risk** | High (if TCP connections drop midway). | Low. | Zero (Service Worker rejects partial updates during install). |
| **Rollback Speed** | Slow (requires re-upload or complex backward renames). | Fast. | Instant (HTML Pointer update only). |
| **Cache Efficiency** | Poor (relies on continuous ETag tracking). | Moderate. | Perfect (Immutable content addressing bypasses revalidation). |

### **Publication State Machine**

| Current State | Input / Trigger | Transition / Action | Target State | Failure Condition |
| :---- | :---- | :---- | :---- | :---- |
| IDLE | User invoke | Check Git integrity; calculate payload hashes. | PREPARED | Uncommitted files present in workspace. |
| PREPARED | Acquire FTPS Lock | Write publish.lock via FTPS; Readback via HTTP. | LOCKED | Lock UUID mismatch (Concurrent publisher active). |
| LOCKED | Begin Upload | FTPS STOR content-addressed blobs sequentially. | BLOBS\_LIVE | FTPS control connection timeout. |
| BLOBS\_LIVE | Verify Blobs | HTTP GET blobs; assert bytes match local hash. | BLOBS\_VERIFIED | 404 Not Found or cryptographic hash mismatch. |
| BLOBS\_VERIFIED | Upload Manifest | FTPS STOR composition.\[hash\].acg2. | MANIFEST\_LIVE | FTPS error. |
| MANIFEST\_LIVE | Upload Pointers | FTPS STOR service-worker.js & index.html. | PUBLISHED | FTPS error. |
| PUBLISHED | Cleanup | FTP DELE orphaned N-2 assets; delete lock file. | IDLE | Cleanup failure (non-critical, leaves stale bytes on disk). |

### **Failure and Concurrency Table**

&nbsp;

| Scenario | System State | Resolution | Operator Action |
| :---- | :---- | :---- | :---- |
| Network drops during payload upload. | Orphaned blobs exist on server. HTML Pointer remains unchanged. | Clients remain securely on old version. | Retry publication. Orphaned files deleted in next successful cleanup. |
| Two engineers deploy simultaneously from Cicero, IL. | First writer acquires publish.lock. | Second writer aborts with "Lock conflict" upon HTTP readback. | Wait for lock release, re-pull latest HEAD, retry deployment. |
| Pointer updates, but CDN edge caches old manifest. | HTML points to new manifest, but CDN serves stale composition.acg2. | Service worker hash check fails against new HTML requirement. SW aborts the update. | Clear CDN edge cache manually or wait for standard TTL expiration. |
| FTPS server rejects TLS Session Resumption. | Control channel drops during data transfer. | Script fails to upload large binaries. | Configure FTPS client to disable session reuse or force clear data channels17. |

### **Pseudocode for the Chosen Protocol (Client-Mediated Publisher)**

FUNCTION PublishRelease(source\_dir, payload\_dir, host\_config): // Phase 1: Local assertions (Git Plumbing) IF NOT Execute("git diff-index \--quiet HEAD") THEN ABORT "Workspace dirty. Commit changes to canonical source." END IF

&nbsp;

&nbsp;

&nbsp;

// Phase 2: Cryptographic mapping and closure  
LET manifest \= NEW Object  
FOR each file IN \[model, tokenizer, template, sampling, prompt\]:  
&nbsp;&nbsp;&nbsp;&nbsp;LET file\_bytes \= Read(payload\_dir \+ file.name)  
&nbsp;&nbsp;&nbsp;&nbsp;LET file\_hash \= SHA256(file\_bytes)  
&nbsp;&nbsp;&nbsp;&nbsp;LET new\_name \= file.base \+ "." \+ file\_hash \+ "." \+ file.ext  
&nbsp;&nbsp;&nbsp;&nbsp;manifest.assets.add(new\_name, file\_hash)  
END FOR

LET manifest\_bytes \= Serialize(manifest)  
LET manifest\_hash \= SHA256(manifest\_bytes)  
LET manifest\_name \= "composition." \+ manifest\_hash \+ ".acg2"

// Phase 3: Lock acquisition via Discovery Tuple  
LET lock\_id \= UUID()  
FTPS\_Write("publish.lock", lock\_id)  
IF HTTP\_Read(host\_config.url \+ "/publish.lock") \!= lock\_id THEN  
&nbsp;&nbsp;&nbsp;&nbsp;ABORT "Concurrent publication detected across hosts."  
END IF

// Phase 4: Immutable uploads and verification  
FOR each new\_name IN manifest.assets:  
&nbsp;&nbsp;&nbsp;&nbsp;FTPS\_Write(new\_name, Read(payload\_dir \+ original\_file))  
&nbsp;&nbsp;&nbsp;&nbsp;IF SHA256(HTTP\_Read(host\_config.url \+ "/" \+ new\_name)) \!= manifest.assets\[new\_name\] THEN  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;FTPS\_Delete("publish.lock")  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ABORT "Readback verification failed. Server bytes corrupted."  
&nbsp;&nbsp;&nbsp;&nbsp;END IF  
END FOR

// Phase 5: Manifest and Pointer atomic activation  
FTPS\_Write(manifest\_name, manifest\_bytes)

LET html \= Read(source\_dir \+ "index.html")  
html \= RegexReplace(html, "composition\\.\[a-f0-9\]+\\.acg2", manifest\_name)

// Critical Last Mutations  
FTPS\_Write("index.html", html)  
FTPS\_Write("service-worker.js", Read(source\_dir \+ "service-worker.js"))

// Phase 6: Finalization and cleanup  
CommitReleaseEvidence(manifest\_hash)  
CleanupOldReleases(host\_config, keep=2)  
FTPS\_Delete("publish.lock")

RETURN "Deployment Successful"

### **Prioritized Experiment Matrix**

&nbsp;

| Hypothesis | Controlled Variables | Exact Inputs / Selection Rule | Procedure | Observable Outputs | Suggested Thresholds (Justification) | Failure Interpretation | Next Action |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| FTPS server enforces strict connection limits preventing parallel uploads. | Network latency, Payload size (10MB-300MB). | FTPS endpoint, 5 parallel asynchronous STOR requests. | Execute publisher script with concurrency limit of 5\. Monitor control channel. | Server returns 150 or 421 Too many connections. | \< 3 concurrent connections (Constrained hosts often limit IPs to 2-3 sockets). | Limit is IP-based or session-based. | Hardcode the FTPS publisher concurrency limit to 2 or serialize entirely. |
| Server strips custom HTTP Cache-Control headers. | File extensions (.slm2, .acg2). | HTTP GET requests to uploaded content-addressed blobs. | Inspect HTTP response headers via cURL. | Presence/absence of Cache-Control: immutable. | Header must be present to prevent 304 revalidations4. | Host does not support .htaccess or custom headers. | Implement Service Worker Cache Storage API injection to simulate immutability locally. |
| Server returns incorrect MIME types for WASM execution. | Target file engine.wasm. | HTTP GET request to engine.wasm. | Inspect Content-Type header. | Returns application/wasm or text/plain. | Must be application/wasm for instantiateStreaming37. | Host uses default fallback MIME types for unknown extensions. | Implement Service Worker ArrayBuffer fallback for WASM instantiation9. |
| CDN Edge caching causes temporal tearing on pointers. | index.html TTL configurations. | Upload new index.html, immediately GET from multiple geographic nodes. | Compare received index.html payload hashes across nodes. | 100% geographic consistency within 5 seconds. | CDN ignores no-cache directives or caches aggressively. | Mandate Cache-Busting query parameters on HTML fetches or accept slow rollouts. |  |

### **Implementation Sequence and Ship Criteria**

To operationalize this architecture without prolonged downtime or data loss, the following implementation sequence must be executed:

> 1. **Stop Doing:** Immediately cease using all FTP RNFR/RNTO directory swapping scripts. They provide a false sense of security, generate phantom 404 errors during transition windows3, and the unfinished local review has already proven the marker writes are unreliable under this paradigm.  
> 2. **Step 1:** Modify the local build scripts to physically rename the 6 core payload files in D:\\LLMs\\TinyRustLM, appending their SHA-256 hashes before the file extension.  
> 3. **Step 2:** Rewrite service-worker.js to strictly enforce cryptographic integrity. It must parse the new composition.acg2 structure, explicitly fetch the hashed assets, and definitively abort the install phase if any file hash mismatches, utilizing the Cache API to isolate the update26.  
> 4. **Step 3:** Implement the dry-run credentials and discovery script, ensuring TLS session resumption issues are bypassed by properly configuring the FTPS client to handle constrained host state dropping17.  
> 5. **Step 4:** Implement the publisher pseudocode logic exactly as defined, utilizing git diff-index for workspace validation.

**Explicit Ship/No-Ship Criteria:**

* **SHIP IF:** The automated publisher script can successfully upload a deployment from a clean Git tree, independent HTTP readbacks verify byte-for-byte matching, and a cold browser instance successfully downloads the model, instantiating the WASM environment seamlessly from MiniModel.org seeds or local caches.  
* **NO-SHIP IF:** The Service Worker fails to detect a corrupted or truncated file injected manually into the server directory. The client-side integrity validation is the absolute bedrock of this architecture; if it fails, the deployment is fundamentally unsafe.  
* **NO-SHIP IF:** Execution of WebAssembly.instantiateStreaming fails in the browser due to improper MIME types on the server, and the Service Worker lacks the fallback ArrayBuffer interception logic9.

### **Unresolved Local Measurements**

* **FTPS Data Channel Timeouts:** Constrained hosts aggressively terminate idle control channels during large data transfers (e.g., uploading the 300MB model.slm2). The local publisher script must measure whether it needs to send periodic NOOP commands on the control channel or leverage TCP keep-alives to prevent premature termination.  
* **MIME-Type Configuration Boundaries:** It is currently unknown if the constrained host allows .wasm and .slm2 files to be mapped to correct MIME types via server-side configuration files. If the server rigidly defaults to application/octet-stream or text/plain, the Service Worker fallback routine becomes a strict dependency.

### **Compact Experiment-Lesson Template**

To preserve compact experiment lessons and maintain canonical artifacts for experiment output in the source tree, engineers must document findings using the following required template format.

**Question:** Does the FTPS host enforce connection limits that prevent parallel uploading of the model payloads?**Exact Inputs:** FTPS endpoint, valid credentials, 5 parallel asynchronous STOR requests for binary files ranging from 10MB to 300MB.**Method:** Execute the publisher script with a concurrency limit of 5\. Monitor control channel responses (expected 150 File status okay; about to open data connection).**Result:** Server returns 421 Too many connections (3) from this IP on the fourth simultaneous thread.**Uncertainty:** It is unknown if the limit is strictly IP-based (affecting the entire Cicero, Illinois office) or session-based (affecting only the specific FTPS client instance).**Decision:** Hardcode the FTPS publisher concurrency limit to a safe maximum of 2\.**Reusable Lesson:** Constrained FTPS hosting requires serial or heavily throttled upload pipelines; rely purely on client-side Service Worker isolation to hide upload latency from the end-user.**Evidence Identity:** Git commit b4c9e8a stored in bounded log experiments/ftps\_concurrency\_01.md.

#### **Works cited**

> 1. SourcePro®: RWFtpsClient Class Reference \- Perforce Support, [https://help.perforce.com/sourcepro/current/HTML/sourceproref/classRWFtpsClient.html](https://help.perforce.com/sourcepro/current/HTML/sourceproref/classRWFtpsClient.html)  
> 2. 28 Repository Access Using Protocols \- Oracle Help Center, [https://docs.oracle.com/en/database/oracle/oracle-database/26/adxdb/repository-access-using-protocols.html](https://docs.oracle.com/en/database/oracle/oracle-database/26/adxdb/repository-access-using-protocols.html)  
> 3. List of FTP server return codes \- Grokipedia, [https://grokipedia.com/page/List\_of\_FTP\_server\_return\_codes](https://grokipedia.com/page/List_of_FTP_server_return_codes)  
> 4. Cache-Control header \- HTTP \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)  
> 5. Cache-Control \- Expert Guide to HTTP headers, [https://http.dev/cache-control](https://http.dev/cache-control)  
> 6. Service Workers Nightly \- W3C, [https://www.w3.org/TR/service-workers/](https://www.w3.org/TR/service-workers/)  
> 7. Service Workers \- W3C, [https://www.w3.org/TR/2015/WD-service-workers-20150625/](https://www.w3.org/TR/2015/WD-service-workers-20150625/)  
> 8. Service Workers Explained: An Interactive Guide \- CodeSmith, [https://www.codesmith.in/post/service-workers-caching-strategies-explained](https://www.codesmith.in/post/service-workers-caching-strategies-explained)  
> 9. MatriXSSed: A New Taxonomy for XSS in the Modern Web, [https://openreview.net/pdf?id=iRQkdpfW02](https://openreview.net/pdf?id=iRQkdpfW02)  
> 10. Web Dev Tech Stack Reference | RanzLappen, [https://ranzlappen.com/references/web-dev-tech-stack/](https://ranzlappen.com/references/web-dev-tech-stack/)  
> 11. Introduction, [https://www.mcours.net/cours/pdf/info/tcpip\_pdf\_gratuit.pdf](https://www.mcours.net/cours/pdf/info/tcpip_pdf_gratuit.pdf)  
> 12. interNet Services V3.4B \- User Guide \- BS2000 Documentation, [https://bs2manuals.ts.fujitsu.com/download/manual/20883](https://bs2manuals.ts.fujitsu.com/download/manual/20883)  
> 13. EFT™ v8 Event Rules User Guide, [https://hstechdocs.helpsystems.com/manuals/globalscape/pdfs/8/eftv8event\_rules\_user\_guide.pdf](https://hstechdocs.helpsystems.com/manuals/globalscape/pdfs/8/eftv8event_rules_user_guide.pdf)  
> 14. Globalscape EFT v8.2 Event Rules Guide \- Fortra, [https://hstechdocs.helpsystems.com/manuals/globalscape/pdfs/8/eftv820eventrulesguide.pdf](https://hstechdocs.helpsystems.com/manuals/globalscape/pdfs/8/eftv820eventrulesguide.pdf)  
> 15. AWS S3 Storage Provider · Issue \#9449 · dotnet/orleans \- GitHub, [https://github.com/dotnet/orleans/issues/9449](https://github.com/dotnet/orleans/issues/9449)  
> 16. FTPS \- Grokipedia, [https://grokipedia.com/page/FTPS](https://grokipedia.com/page/FTPS)  
> 17. In-Depth Guide to TLS Cryptography | PDF | Transport Layer Security, [https://www.scribd.com/document/95259083/tls](https://www.scribd.com/document/95259083/tls)  
> 18. How to check if there's nothing to be committed in the current branch?, [https://stackoverflow.com/questions/5139290/how-to-check-if-theres-nothing-to-be-committed-in-the-current-branch](https://stackoverflow.com/questions/5139290/how-to-check-if-theres-nothing-to-be-committed-in-the-current-branch)  
> 19. Diff \- Git repositories on gerrit, [https://gerrit.googlesource.com/gerrit/+/v2.13-rc1%5E2..v2.13-rc1/](https://gerrit.googlesource.com/gerrit/+/v2.13-rc1%5E2..v2.13-rc1/)  
> 20. Pods/RealmSwift/build.sh \- GitLab, [https://gitlab.virtual.uniandes.edu.co/ISIS3510\_202010\_Team16/ios-flutter/blob/c80b525a2e1d110ff9a705cc715465bbfb09b7ba/Pods/RealmSwift/build.sh](https://gitlab.virtual.uniandes.edu.co/ISIS3510_202010_Team16/ios-flutter/blob/c80b525a2e1d110ff9a705cc715465bbfb09b7ba/Pods/RealmSwift/build.sh)  
> 21. HTTP Caching: Cache-Control, ETag, and CDN Strategies for 2026, [https://www.devtoolnow.com/guides/http-caching-cache-control-etag-cdn](https://www.devtoolnow.com/guides/http-caching-cache-control-etag-cdn)  
> 22. Static Site CDN: JAMstack Delivery Principles \- CDN Blog, [https://blog.blazingcdn.com/en-us/static-site-cdn-jamstack-delivery-principles](https://blog.blazingcdn.com/en-us/static-site-cdn-jamstack-delivery-principles)  
> 23. Difference between no-cache and must-revalidate for Cache-Control?, [https://stackoverflow.com/questions/18148884/difference-between-no-cache-and-must-revalidate-for-cache-control](https://stackoverflow.com/questions/18148884/difference-between-no-cache-and-must-revalidate-for-cache-control)  
> 24. How do we control web page caching, across all browsers?, [https://stackoverflow.com/questions/49547/how-do-we-control-web-page-caching-across-all-browsers](https://stackoverflow.com/questions/49547/how-do-we-control-web-page-caching-across-all-browsers)  
> 25. A Web Developer's Guide to Browser Caching | by Amir Boroumand, [https://medium.com/@steelcityamir/a-web-developers-guide-to-browser-caching-cc41f3b73e7c](https://medium.com/@steelcityamir/a-web-developers-guide-to-browser-caching-cc41f3b73e7c)  
> 26. Service Worker and Cache API from first principles \- Adrian Zawadzki, [https://adrianzawadzki.dev/blog/service-worker-cache-api/](https://adrianzawadzki.dev/blog/service-worker-cache-api/)  
> 27. Why my Service Worker is always waiting to activate? \- Stack Overflow, [https://stackoverflow.com/questions/48859119/why-my-service-worker-is-always-waiting-to-activate](https://stackoverflow.com/questions/48859119/why-my-service-worker-is-always-waiting-to-activate)  
> 28. What Is a PWA and When Should You Build One?, [https://kudoflix.com/blog/2026/08/26/pwa/](https://kudoflix.com/blog/2026/08/26/pwa/)  
> 29. Zombie Service Workers: A Survival Guide to Taming the Undead, [https://www.mabdullahz.com/blog/zombie-service-workers](https://www.mabdullahz.com/blog/zombie-service-workers)  
> 30. Service Worker Update Safety for AFH Web Apps | AFH Manager, [https://afhapp.com/blog/service-worker-update-safety-adult-family-home-web-apps/](https://afhapp.com/blog/service-worker-update-safety-adult-family-home-web-apps/)  
> 31. Offline Support and Progressive Web Apps (PWAs) \- DEV Community, [https://dev.to/zeeshanali0704/frontend-system-design-offline-support-and-progressive-web-apps-pwas-4k8m](https://dev.to/zeeshanali0704/frontend-system-design-offline-support-and-progressive-web-apps-pwas-4k8m)  
> 32. Planet WebKit, [https://planet.webkit.org/](https://planet.webkit.org/)  
> 33. Changelog — What's New in amux (AI Agent Orchestration), [https://amux.io/changelog/](https://amux.io/changelog/)  
> 34. WS\_FTP Pro User's Guide 6.5 | PDF | File Transfer Protocol \- Scribd, [https://www.scribd.com/document/756796391/ws-ftp-65](https://www.scribd.com/document/756796391/ws-ftp-65)  
> 35. Globus Toolkit JIRA Archive \- Computer Sciences, [https://pages.cs.wisc.edu/\~matyas/gt-jira-archive/](https://pages.cs.wisc.edu/~matyas/gt-jira-archive/)  
> 36. UDN Search, [http://udn.realityripple.com/search?q=Using](http://udn.realityripple.com/search?q=Using)  
> 37. HTTP Reference \- OneUtil, [https://oneutil.dev/http](https://oneutil.dev/http)  
> 38. Xb2.NET Reference Documentation, [http://www.sqlexpress.net/xb2net/Xb2NET.htm](http://www.sqlexpress.net/xb2net/Xb2NET.htm)  
> 39. Log messages 0x80eXXXXX \- IBM, [https://www.ibm.com/docs/en/datapower-gateway/10.6.0?topic=messages-log-0x80exxxxx](https://www.ibm.com/docs/en/datapower-gateway/10.6.0?topic=messages-log-0x80exxxxx)
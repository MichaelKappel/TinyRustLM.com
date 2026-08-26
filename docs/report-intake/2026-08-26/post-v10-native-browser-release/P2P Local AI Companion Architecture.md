# **Architectural Specification for P2P-First and Deterministic Local Conversion of SLM2 Compositions**

## **1\. Executive Acquisition Architecture**

The deployment of the TinyRustLM prelaunch environment relies on a foundational separation of concerns between web-based metadata discovery and local physical execution. The web property, MiniModel.org, serves exclusively as a catalog and discovery platform. It provides cryptographic manifests, licensing metadata, and routing topologies, but it is strictly prohibited from proxying, caching, or distributing model bytes. The overarching architecture mandates that the acquisition of model bytes must occur through one of two concrete, strictly ordered paths executed entirely by the local companion application: Direct Peer-to-Peer (P2P) Import, or Deterministic Local Conversion.  
The sole target artifact of either operational path is a single, unified SLM2 composition. The architecture categorically rejects legacy formats, hidden fallback mechanisms to remote inference, silent route retries, or partial format migrations. Technical debt in the form of accepted unverified bytes or compatibility aliases is not permitted. If a requested operation fails, it must fail transparently, exposing the exact typed failure mechanism to the user, allowing them to understand the physical reality of the acquisition state.  
The primary acquisition route attempts to locate a qualified matching SLM2 composition directly from verified local or wide-area peers. A peer is deemed "qualified" only when the transferred bytes mathematically bind to the exact source provenance, licensing data, and structural integrity constraints defined in the catalog manifest. A superficial P2P byte match without these accompanying cryptographic bindings is inherently unqualified and must be rejected to prevent ecosystem pollution.  
When no exact qualified peer composition exists, the deterministic route selection algorithm forces a fallback to the local-conversion branch. This branch commands the companion to acquire the pinned public source repository directly from the origin, verify the source revision against the catalog's cryptographic lock, and execute a one-shot, deterministic conversion routine. This conversion generates the SLM2 composition alongside its private numerical evidence bytes, keeping the generated artifacts entirely outside of the source Git tree.  
Throughout this lifecycle, the browser context remains completely isolated from model bytes, tensor data, and user prompts. All acquisition, processing, and inference occur within the native local companion process. Communication between the unprivileged web catalog and the privileged companion is brokered via a strictly authenticated, origin-bound, and Private Network Access (PNA)-compliant loopback connection. Using the roughly 598 MB Qwen3 candidate size as a baseline for resource planning, the system guarantees high-throughput, memory-safe handling of large tensor sets without browser-induced memory constraints.

## **2\. End-User State Machine and Truthful Status Vocabulary**

The user journey transitions through a rigid, deterministic state machine, ensuring the user is continuously and accurately informed of the physical reality of the acquisition process. The system strictly forbids masking network operations behind ambiguous indeterminate loading spinners or utilizing instruction-file script downloads as a proxy for actual installation. The vocabulary presented to the user maps exactly to the internal state transitions, providing a truthful representation of system activity.  
The acquisition state machine operates across clearly defined phases, mapped directly to actionable user interface elements.

| Internal State | Truthful UI Vocabulary | Description and Progress Units |
| :---- | :---- | :---- |
| IDLE | "Select Model" | The user explores the catalog. No local state is altered. Capabilities are discovered. |
| INTENT\_REGISTERED | "Waking Local Companion" | The browser transmits an intent command to the companion over the secure loopback channel. |
| PEER\_DISCOVERY | "Searching for Verified Peers" | The companion queries the localized P2P network for announcements of the exact composition hash. Timeout is strictly bounded. |
| P2P\_IMPORT\_ACTIVE | "Importing Directly from ![][image1] Peers" | Qualified peers are identified. Progress units reflect active peer counts, total bytes, bytes transferred, and pieces validated. |
| SOURCE\_PIN\_RESOLUTION | "Verifying Public Source Locks" | (Fallback state). The companion fetches public repository metadata and verifies the commit hash against catalog locks. |
| LFS\_FETCH | "Downloading Raw Tensors" | The companion processes Git LFS pointers and acquires the raw source weights1. Progress reflects byte counts. |
| CONVERSION\_ACTIVE | "Converting to Local SLM2" | Deterministic logic translates raw source into the unified SLM2 composition. Progress reflects tensor serialization and quantization completion. |
| VERIFICATION | "Verifying Cryptographic Proofs" | The completed SLM2 composition is hashed and validated against the original catalog manifest. |
| ATOMIC\_PROMOTION | "Installing Local Model" | The verified SLM2 file is atomically moved from volatile staging to the durable activation directory. |
| READY | "Open Chat" | The SLM2 composition is loaded into memory, and the inference engine is prepared for immediate loopback execution. |

Cancellation may be triggered by the user during any state prior to ATOMIC\_PROMOTION. Transitioning to a CANCELED state guarantees the immediate termination of network sockets, destruction of staging buffers, and release of all file locks. If a fatal error occurs, the system transitions to a FAILED state featuring actionable, typed failures (e.g., ERR\_INSUFFICIENT\_STORAGE, ERR\_LFS\_POINTER\_MISMATCH, ERR\_PEER\_CORRUPTION). A closed failed candidate cannot be offered or reused; the state machine must be re-initialized from IDLE.

## **3\. Catalog, Composition, Peer, and Claim Identities**

The integrity of the local-first ecosystem relies entirely on an unbroken chain of cryptographic bindings at the catalog level. MiniModel.org provides signed metadata structures that establish absolute trust from the public identity of a model down to the exact P2P piece hashes.  
The catalog metadata is designed as a hierarchical cryptographic manifest that explicitly rejects aliases pointing to different bytes.

| Identity Component | Cryptographic Mechanism | Description and Constraints |
| :---- | :---- | :---- |
| **Public Model Identity** | Namespace string | A human-readable identifier (e.g., creator/model-name) used for catalog presentation. |
| **Source Revision Lock** | Git Commit SHA-1 | The exact commit hash freezing the public source repository at a known state. |
| **Source LFS Locks** | Dictionary of SHA-256 Hashes | Maps expected Git LFS pointer hashes to their file paths, preventing LFS substitution attacks1. |
| **Composition Identity** | SHA-256 (![][image2]) | The definitive hash representing the exact deterministic output of the conversion process applied to the Source Revision Lock. |
| **Member Manifest** | JSON Schema | Defines the internal structure of the SLM2 file, including architecture identities, minimum runtime requirements, and profile contexts. |
| **Piece Set** | Merkle Root Hash | The root hash of the chunk pieces required for P2P routing, intrinsically binding the network payload to the Composition Identity. |
| **Provenance & License** | Signed Metadata Claims | Cryptographic proofs establishing the legal and structural boundaries of the model, strictly bound to ![][image2]. |
| **Quality Claim** | Numerical Vector | Independent evidence of numerical conformance and model quality, calculated during conversion. |

Peers within the localized network are required to announce their possession of specific Composition Identities (![][image2]). These peer announcements are intentionally designed to be expiring; they carry a timestamp and a strict time-to-live (TTL) to prevent stale network pollution. A peer is forbidden from announcing an alias or a legacy format. The announcement must exactly match the SLM2 ID required by the catalog manifest. The companion strictly rejects broad aliases to prevent catalog fragmentation and structural downgrade attacks. Only an exact, currently qualified peer composition match may initiate the import protocol.

## **4\. P2P Piece/Import Protocol**

The Direct P2P Import branch is engineered for the high-throughput, resilient transfer of large model artifacts (such as the 598 MB Qwen3 baseline) directly between consenting local endpoints. The protocol strictly prohibits mixing pieces from files with divergent identities or accepting unqualified peer bytes.  
The SLM2 composition is divided into fixed piece boundaries (e.g., exactly 2 MB chunks), which serve as the fundamental unit of transfer, cryptographic validation, and durable storage.  
Before a transfer lane is opened, the protocol mandates complete identity agreement. The requesting companion and the providing peer execute an ephemeral handshake to confirm exact mutual agreement on the Composition Identity and the Piece Merkle Root. If the identities mismatch in any capacity, the connection is instantly severed.  
Upon successful identity agreement, the resumable multi-peer direct import commences with bounded concurrency. The companion dynamically assigns peer/lane identities, limiting the number of simultaneous active lanes (e.g., maximum 4 concurrent peers, 2 lanes per peer) to prevent local network saturation and socket exhaustion.  
Data is acquired using standard HTTP range requests or custom binary frames mapped exactly to the fixed piece boundaries. As a piece traverses the network and arrives in memory, a per-piece SHA-256 hash is computed in real-time. This hash undergoes range validation against the expected hash provided by the catalog's Piece Set Merkle tree.  
To ensure resilience, a durable journal operates as a write-ahead log on the companion's local filesystem. This journal tracks the strict state of every piece (EMPTY, DOWNLOADING, VERIFIED), allowing the import to gracefully pause, survive a crash, and resume from the precise byte boundary of the last verified piece without unnecessary network overhead.  
If a piece fails range validation, the protocol engages corruption quarantine. The malicious or malformed piece is instantly zeroed in memory, and the offending peer/lane identity is penalized and disconnected. Once all individual pieces reflect a VERIFIED state in the durable journal, the protocol executes a final whole-member verification. A sequential read of the entire staged file computes the global SHA-256 hash, proving total structural integrity prior to atomic promotion.

## **5\. Deterministic Local-Conversion Branch**

When the deterministic route selection algorithm concludes that no exact qualified peer composition exists, the local companion executes the deterministic local-conversion branch. The user must be informed exactly which operation is occurring without invisible route retries or "best-of-N" guessing games.  
The local-conversion process transforms a raw, publicly accessible repository into a highly optimized, qualified local asset. The companion utilizes the Source Revision Lock from the catalog manifest to fetch the specific immutable commit from the public repository.  
Upon repository resolution, the companion encounters Git LFS pointers. According to the Git LFS specification, these pointers are small UTF-8 text files formatted with specific keys, notably the oid sha256:... and the size of the underlying asset1. The companion parses these pointers and performs a rigorous Source-file lock verification, cross-referencing the parsed OID against the Source LFS Locks detailed in the catalog. If a pointer substitution attack is detected, or if the source drifts from the immutable revision, the conversion immediately halts.  
Simultaneously, the companion performs a Source-card and License review. If the license ambiguity prevents legal local compilation, or if the metadata explicitly marks the source as unqualified for local execution, the process must stop and issue a typed failure.  
Prior to engaging the heavy computational workload of conversion, the companion executes strict storage and RAM preflights. Utilizing the minimum runtime requirements from the member manifest, the system verifies adequate persistent storage for both the raw LFS tensor weights and the final SLM2 composition, while ensuring sufficient system memory exists to prevent Out-Of-Memory (OOM) operating system kills during quantization. If computational resources are severely constrained, explicit user consent is requested via the interface.  
Upon passing preflight, the companion executes the deterministic acquisition of the raw weights and engages one-shot execution. The conversion algorithm is strictly deterministic; given the same Source Revision Lock, it will invariably produce the exact same SLM2 Composition Identity across all supported operating systems and architectures.  
Upon successful conversion, the companion generates independent numerical quality evidence to prove the local compilation achieved numerical conformance. This private evidence byte sequence, alongside the newly minted SLM2 model, stays entirely outside Git, preserving the integrity of the original source tree. The final artifact is then registered for installation and atomic promotion.

## **6\. Secure Loopback Companion Handshake and API**

Because the browser site (MiniModel.org) must never touch model bytes or natural language prompts, it must securely orchestrate actions by communicating with the locally installed TinyRustLM companion. This necessitates a robust loopback strategy that aggressively navigates modern browser security constraints, particularly the W3C Private Network Access (PNA) specification5.  
The loopback port discovery must occur without downloading execution scripts. The browser achieves this by attempting a bounded series of fetch() requests to predetermined loopback ports (e.g., 127.0.0.1:41908). Modern browsers heavily restrict requests originating from a public web context directed at the user's local or loopback address space to prevent Cross-Site Request Forgery (CSRF) against insecure local services5.  
To comply with PNA and establish a secure context, the catalog must be hosted on HTTPS8. Before sending a state-mutating command, the browser dispatches an HTTP OPTIONS preflight request to the companion's loopback port9. This request includes the Access-Control-Request-Private-Network: true header5.  
The local companion process inspects the Origin header. If the origin matches the strictly allowlisted catalog domain, the companion replies with standard CORS headers (Access-Control-Allow-Origin) alongside the critical PNA enforcement header: Access-Control-Allow-Private-Network: true5. If the PNA header is absent, the browser securely blocks the subsequent request9.  
To prevent malicious websites from pivoting through the user agent via DNS rebinding, the companion enforces severe host header validation. The companion drops any HTTP request where the Host header is not exactly 127.0.0.1 or localhost18. Furthermore, relying on the 0.0.0.0 IP address as a bypass vector is strictly prohibited, as modern browser specifications have deprecated this vulnerability22.  
The initial PNA-cleared handshake establishes an ephemeral challenge/response session token. This token is mandated for all subsequent WebSocket upgrades (ws://127.0.0.1:PORT) and state-mutating HTTP POST requests. While browsers historically permit ws:// to loopback from HTTPS pages24, the upgrade request relies on the ephemeral token, ensuring the WebSocket session is inherently tied to the authenticated browser origin. Token storage is ephemeral, held only in the browser's memory, with a strict expiration TTL to prevent replay attacks. For highly destructive actions (e.g., deleting a model), the companion requires user-presence approval via an out-of-band native OS notification, ensuring a compromised browser tab cannot execute silent exploitation.  
The system specifically addresses TLS tradeoffs. Serving legitimate HTTPS on localhost requires users to manually install trust certificates11, which violates the user experience constraints. Therefore, the architecture relies on the browser's documented exception that treats 127.0.0.1 and localhost as potentially trustworthy secure contexts for the purposes of mixed-content checks, provided PNA headers are respected7.  
The bounded typed API adheres to the principle of least privilege. No API endpoint may accept arbitrary commands, arbitrary filesystem paths, or unrestricted URLs from the page.

| API Endpoint | HTTP Method | Payload Schema | Description |
| :---- | :---- | :---- | :---- |
| /api/v1/capability | GET | None | Returns companion version, hardware profile, and PNA support. |
| /api/v1/intent | POST | {"slm2\_id": "sha256:...", "catalog\_hash": "...", "source\_lock": "..."} | Registers user intent. Rejects arbitrary file paths. |
| /api/v1/acquire | POST | {"slm2\_id": "sha256:...", "route\_preference": "P2P\_FIRST"} | Commands the state machine to begin acquisition. |
| /api/v1/progress | WS / GET | {"slm2\_id": "sha256:...", "token": "..."} | Streams typed progress blocks. |
| /api/v1/cancel | POST | {"slm2\_id": "sha256:..."} | Immediately halts acquisition and purges staging buffers. |
| /api/v1/activate | POST | {"slm2\_id": "sha256:..."} | Loads the cryptographically verified composition for inference. |

## **7\. Transactional Storage and Activation**

Model files present a unique storage challenge due to their massive size. Managing their lifecycle requires transactional guarantees across the filesystem to prevent orphan files, corrupted buffers, and disk exhaustion. The architecture evaluates the dichotomy between keeping model bytes in the browser's Origin Private File System (OPFS) versus retaining companion-owned native storage.  
The OPFS provides a sandboxed virtual file system isolated to the web origin27. OPFS offers high-performance byte-by-byte access via the createSyncAccessHandle() method29. However, this synchronous method is explicitly restricted to Dedicated Web Workers to prevent blocking the main browser thread27. Furthermore, OPFS is subject to browser eviction policies, quotas, and clears when a user deletes site data27.  
Given that the TinyRustLM architecture requires a native companion application to execute P2P networking and hardware-accelerated inference, routing a 598 MB model byte payload through a browser Service Worker into OPFS introduces immense serialization overhead and risks arbitrary browser quota eviction27. Therefore, the architecture mandates companion-owned native storage.  
Transactional guarantees are implemented directly on the host OS:

> 1. **Content-Addressed Directories**: Models are durably stored in directories named identically to their SLM2 Composition Identity (e.g., \~/.tinyrustlm/models/sha256\_abc123/). This guarantees immutable activation pointers and structurally eliminates naming collisions.  
> 2. **Staging and fsync**: During import or conversion, data is heavily buffered and written to a .staging file extension. Upon mathematical verification, an fsync system call forces the operating system to flush all hardware caches, ensuring the file is durably written to the physical platter or NAND flash.  
> 3. **Crash Recovery**: If the companion abruptly terminates, the staging directory isolates the corrupted artifacts, allowing the durable journal to accurately orchestrate resumption.  
> 4. **Garbage Collection and Deletion**: Deletion utilizes strict reference tracking. A model cannot be deleted if a user has pinned it or if an active loopback inference session holds an open file handle. Unpinned models exceeding an inactivity TTL trigger automated garbage collection to recover disk space, deleting the content-addressed directory atomically.

## **8\. Privacy and Network Contract**

The TinyRustLM architecture enforces a rigid privacy and network contract, mathematically ensuring the confidentiality of user interactions and local processing.  
Project sites (MiniModel.org) exist purely to distribute catalog metadata; they absolutely cannot receive prompt text, model bytes, or conversational history. Peer endpoints in the localized network receive only the protocol-required data necessary to negotiate piece boundaries, namely the target ![][image2] and the Piece Merkle Root. They do not receive user identities, geolocation data, or natural language context.  
When local conversion dictates a fallback to the public source, the public source acquisition is explicit. The user is informed that a connection to a third-party repository (e.g., Hugging Face or GitHub) is occurring to acquire the immutable revision.  
There is zero implicit telemetry. The companion strictly prohibits silent phone-home diagnostics. Local logs and crash receipts are aggressively sanitized; they record state transitions, PNA handshake outcomes, and piece validation failures, but they categorically exclude chat tokens, raw local file paths, prompts, and invitation URLs.

## **9\. Cancellation, Resumption, and Crash Recovery**

The architecture treats cancellation, power loss, and application crashes as expected operational realities, rather than fatal edge cases.  
If the user commands a cancellation via the interface, the state machine triggers an immediate, ungraceful teardown. Active network sockets are closed, memory buffers are zeroed, and file locks are released. The durable journal marks the current piece as aborted.  
For resumption and crash recovery, the durable journal acts as the absolute source of truth. When the companion restarts, it scans the content-addressed staging directory and reads the journal. Any piece that was marked DOWNLOADING during the crash is considered tainted and is discarded. The companion seamlessly requests only the pieces marked EMPTY, utilizing HTTP range requests or P2P chunk boundaries to resume the 598 MB transfer exactly where the last successful fsync occurred.  
In the deterministic conversion branch, a crash during LFS tensor fetching allows for standard Git LFS resume functionality based on the OID and file size parameters1. However, a crash during the matrix quantization and serialization phase requires a complete restart of the conversion algorithm, as intermediate tensor states are held entirely in volatile RAM to protect the disk lifespan.

## **10\. Hostile-Input and Fault-Injection Matrix**

The companion operates in a zero-trust environment, defending against hostile peers, compromised catalogs, and local operating-system-level privilege escalation.

| Attack Vector | Threat Description | Architectural Mitigation Strategy |
| :---- | :---- | :---- |
| **Malicious Catalog** | Catalog manifest provides an incorrect Source Revision Lock pointing to malware. | Conversion engine executes in a systemd DynamicUser sandbox with ProtectSystem=strict32 (Linux) or Restricted SID35 (Windows). |
| **Expired Peer Proof** | A peer announces a qualified composition but serves a legacy format or different file. | Per-piece Merkle verification against the catalog identity drops the connection and permanently blacklists the peer. |
| **Wrong Piece / Mixed Identities** | A peer attempts to inject chunks from an alias or different architecture. | Identity agreement handshake and per-piece hashing guarantee absolute rejection of mixed identity pieces. |
| **Decompression Bomb** | Git LFS raw source contains a recursively compressed archive designed to exhaust RAM. | RAM and storage preflights enforce strict upper bounds. Streaming conversion halts if the output size exceeds the theoretical maximum. |
| **LFS Pointer Substitution** | The remote repository swaps the LFS pointer to a malicious tensor1. | The companion parses the UTF-8 pointer and validates the hash against the Source LFS Locks prior to payload fetch1. |
| **DNS Rebinding** | A malicious site pivots through the browser to hit 127.0.0.1 and initiate model deletion. | Strict Host header validation18, PNA CORS preflight enforcement14, and ephemeral tokens block CSRF. |
| **Origin Spoofing** | A script attempts to spoof the MiniModel.org origin in the HTTP header. | Browsers enforce the Origin header securely; it cannot be modified programmatically via standard fetch(). |
| **Companion Impostor** | Malware binds to the local loopback port before the companion starts. | The companion utilizes exclusive bind flags. If the port is taken, it alerts the user and refuses to operate, preventing interception. |
| **Path Traversal** | API payload attempts to write to ../../etc/shadow or C:\\Windows. | The API completely rejects arbitrary paths. All storage operates solely on content-addressed SHA-256 identities within the isolated companion directory. |

To enforce stringent operating system sandboxing during the deterministic conversion phase, Linux deployments rely heavily on systemd service hardening33. The companion utilizes the DynamicUser=yes directive, dynamically allocating a UNIX user ID for the conversion process that is instantly destroyed upon termination, ensuring no artifacts are left behind34. Combined with ProtectSystem=strict and PrivateTmp=true, the host filesystem is rendered entirely read-only to the conversion engine32. On Windows platforms, the process executes under a local service account with a Restricted Service SID, applying the principle of least privilege to restrict memory quotas and bypass traverse checking35.

## **11\. Accessible Product Acceptance Criteria**

The user experience mandates strict accessibility, transparency, and explicit physical action.  
The primary action must be an actual icon/text command button (e.g., "Acquire Local Model"). The architecture strictly prohibits the downloading of instruction text, JSON handoff files, or PowerShell setup scripts as a workaround. The product must perform the requested operation natively through the installed companion or clearly state one concrete prerequisite if the companion is missing.  
Interface elements must be fully compatible with keyboard navigation and screen-reader technologies utilizing standard ARIA attributes. Long human-readable model names must truncate gracefully without breaking grid layouts, but the full name must be accessible via tooltips or screen-reader announcements.  
Storage disclosures and estimated time to completion (derived from the catalog manifest and local bandwidth heuristics) must be surfaced prior to user commitment. When a typed failure occurs, actionable recovery instructions (e.g., "Clear 2 GB of disk space and try again") must be presented. Finally, no UI element may present a marketing claim (e.g., "High Quality") prior to the successful generation and verification of the independent numerical quality evidence generated during conversion.

## **12\. Staged Implementation and Proof Plan**

The deployment follows a rigorous, phased proof ladder to ensure cryptographic stability and secure network boundaries prior to public availability. The plan distinguishes clearly between what Continuous Integration (CI) can prove and what requires staging environments.

| Phase | Methodology | Scope of Proof | Limitations |
| :---- | :---- | :---- | :---- |
| **Protocol Unit Tests** | Automated CI | Proves deterministic mathematical conversion against synthetic tensors. Validates Merkle tree assembly and per-piece hashing logic. | Cannot simulate OS socket exhaustion or filesystem latency. |
| **Hostile Integration Tests** | Local Harness in CI | Proves the fault-injection matrix. Mock malicious peers attempt to inject corrupted chunks; mock browsers attempt to bypass PNA with missing Origin headers12 or 0.0.0.0 bindings22. | Simulates network boundaries but not physical firewall interference. |
| **Loopback Real Conversion** | Isolated VM | Proves a single end-to-end integration where a controlled UI connects via PNA, authenticates, and commands the local deterministic conversion of a small benchmark model (e.g., TinyLlama). | Hardware constrained by the VM capabilities. |
| **Direct Outside Peer Import** | Physical Subnet Test | Proves real-world P2P chunking of the 598 MB Qwen3 candidate between two distinct physical nodes. Validates the durable journal and atomic promotion. | Does not prove complex NAT traversal across wide-area networks. |
| **Browser Activation** | Manual QA | End-to-end verification that the promoted SLM2 model can be loaded into memory and successfully process a multi-turn chat interaction through the loopback WebSocket. | Requires human validation of UX accessibility and truthful state transitions. |

## **13\. Unknowns Requiring Local or Authorized Network Access**

Several environmental variables remain unknown and require active local telemetry (explicitly opted-in by developers) or authorized network probing during the beta rollout phase:

* **PNA Enforcement Variations**: While the W3C specification for Private/Local Network Access is progressing5, the exact behavior of edge-case browsers, custom enterprise proxy configurations, or aggressive local antivirus suites intercepting 127.0.0.1 traffic may induce unexpected preflight failures45.  
* **NAT Traversal and Local Discovery**: The efficacy of mDNS or local UDP broadcasts for localized peer discovery may be heavily restricted by corporate firewall policies, VPN topologies, or modern OS network classifications (e.g., Windows "Public" versus "Private" network profiles).  
* **Storage Latency Bounds**: The precise performance impact of frequent synchronous fsync operations during piece-wise P2P imports on low-tier mechanical HDDs versus modern NVMe drives requires real-world profiling. This is critical to ensure the durable journaling mechanism does not inadvertently block the main event loop or induce UI stuttering.

## **14\. Annotated Primary-Source Bibliography with Dates**

The foundational protocols governing this architecture rely heavily on recent evolutions in browser network security, local storage specifications, and OS-level privilege sandboxing.

* 5 WICG Private Network Access (PNA) / Local Network Access Explainer and Specs (2021-2024): Details the W3C incubator specification aimed at protecting local and private network devices from malicious web requests. Replaces the older CORS-RFC1918 concept. Requires HTTPS secure contexts and explicit CORS preflights (Access-Control-Request-Private-Network) before allowing a public site to fetch from localhost or 127.0.0.1.  
* 46 MDN Web Docs: Local Network Access and loopback-network (Updated continuously): Documents the Permissions-Policy header loopback-network and the targetAddressSpace property required to navigate mixed-content checks when a secure site talks to a local endpoint.  
* 1 Git LFS Pointer Specification (GitHub / Atlassian documentation, various dates): Specifies the exact format of Git LFS pointers—small UTF-8 text files containing the version URL, the SHA-256 oid, and the file size. Critical for the companion's deterministic conversion branch to verify LFS locks before downloading massive tensor files.  
* 24 WebSocket Security on Loopback (HackerNews, StackOverflow, Chromium Issues): Highlights the historical and current behavior of browsers allowing ws://127.0.0.1 connections from secure https:// contexts, which forms the basis for the companion's real-time progress and chat streaming API.  
* 9 CORS Preflight and PNA Headers (MDN, Chrome Developers, ByteMinds, 2022-2024): Explains the mechanics of the HTTP OPTIONS preflight request and the necessity of responding with Access-Control-Allow-Private-Network: true alongside standard CORS headers to satisfy browser security requirements.  
* 27 File System Access API and OPFS (MDN, web.dev, W3C, 2022-2023): Details the Origin Private File System, standardized around March 2023\. Documents the high-performance createSyncAccessHandle() method and its strict limitation to Dedicated Web Workers, as well as the browser quota restrictions that informed the decision to use companion-owned native storage instead.  
* 18 DNS Rebinding and 0.0.0.0 Vulnerabilities (Oligo Security, AppCheck, Chromium Issues, 2022-2024): Outlines how attackers use DNS rebinding to attack local services. Documents the critical mitigation strategy of validating the Host header and the recent industry-wide deprecation of the 0.0.0.0 IP address as a local bypass vector (highlighted by the "0.0.0.0 Day" vulnerability disclosure in 2024).  
* 32 Systemd DynamicUser and Sandboxing (Lennart Poettering / 0pointer, Arch Linux Wiki, 2017-present): Details the DynamicUser=yes directive introduced in systemd 235, which dynamically allocates and destroys UNIX user IDs for services. Combined with ProtectSystem=strict, it provides the robust, least-privilege filesystem sandboxing required for the Linux deterministic conversion branch.  
* 35 Securing Windows Service Accounts and SIDs (Microsoft Learn, FireDaemon, Alaniz): Documents the creation of local service accounts and the use of Restricted Service Security Identifiers (SIDs) in Windows, providing the equivalent least-privilege sandboxing mechanism for Windows-based companion deployments.

#### **Works cited**

> 1. git-lfs/docs/spec.md at main \- GitHub, [https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md](https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md)  
> 2. git-lfs-pointer \- crates.io: Rust Package Registry, [https://crates.io/crates/git-lfs-pointer](https://crates.io/crates/git-lfs-pointer)  
> 3. Git-LFS \- JEDI Documentation, [https://jointcenterforsatellitedataassimilation-jedi-docs.readthedocs-hosted.com/en/latest/inside/developer\_tools/gitlfs.html](https://jointcenterforsatellitedataassimilation-jedi-docs.readthedocs-hosted.com/en/latest/inside/developer_tools/gitlfs.html)  
> 4. Git LFS \- large file storage | Atlassian Git Tutorial, [https://www.atlassian.com/git/tutorials/git-lfs](https://www.atlassian.com/git/tutorials/git-lfs)  
> 5. private-network-access/explainer.md at main \- GitHub, [https://github.com/WICG/private-network-access/blob/main/explainer.md](https://github.com/WICG/private-network-access/blob/main/explainer.md)  
> 6. Private Network Access \- GitHub Pages, [https://wicg.github.io/private-network-access/](https://wicg.github.io/private-network-access/)  
> 7. Local Network Access \- GitHub Pages, [https://wicg.github.io/local-network-access/](https://wicg.github.io/local-network-access/)  
> 8. Restrict "private network requests" for subresources from public, [https://chromestatus.com/feature/5436853517811712](https://chromestatus.com/feature/5436853517811712)  
> 9. Private Network Access preflight requests for subresources, [https://chromestatus.com/feature/5737414355058688](https://chromestatus.com/feature/5737414355058688)  
> 10. Secure Contexts \- W3C, [https://www.w3.org/TR/secure-contexts/](https://www.w3.org/TR/secure-contexts/)  
> 11. CORS error on request to localhost dev server from remote site, [https://stackoverflow.com/questions/66534759/cors-error-on-request-to-localhost-dev-server-from-remote-site](https://stackoverflow.com/questions/66534759/cors-error-on-request-to-localhost-dev-server-from-remote-site)  
> 12. Cross-Origin Resource Sharing (CORS) \- HTTP \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)  
> 13. Private Network Access preflight requests for subresources, [https://groups.google.com/a/chromium.org/g/blink-dev/c/72CK2mxD47c](https://groups.google.com/a/chromium.org/g/blink-dev/c/72CK2mxD47c)  
> 14. Private Network Access: introducing preflights | Blog, [https://developer.chrome.com/blog/private-network-access-preflight](https://developer.chrome.com/blog/private-network-access-preflight)  
> 15. PNA (Private Network Access) in Chrome restrictions nightmare, [https://support.google.com/chrome/thread/387728146/pna-private-network-access-in-chrome-restrictions-nightmare?hl=en](https://support.google.com/chrome/thread/387728146/pna-private-network-access-in-chrome-restrictions-nightmare?hl=en)  
> 16. CORS extension “Private Network Access” \- INNOQ, [https://www.innoq.com/en/blog/2022/02/cors-private-network-access/](https://www.innoq.com/en/blog/2022/02/cors-private-network-access/)  
> 17. Bridge mode blocked by Chromium Private Network Access (PNA, [https://github.com/abhigyanpatwari/GitNexus/issues/686](https://github.com/abhigyanpatwari/GitNexus/issues/686)  
> 18. What Is DNS Rebinding And How It Works? \- Payatu, [https://payatu.com/blog/dns-rebinding/](https://payatu.com/blog/dns-rebinding/)  
> 19. DNS Rebinding Attacks \- AppCheck Ltd, [https://appcheck-ng.com/dns-rebinding-attacks-past-present-future/](https://appcheck-ng.com/dns-rebinding-attacks-past-present-future/)  
> 20. Preventing DNS Rebinding Attacks · nccgroup/singularity Wiki \- GitHub, [https://github.com/nccgroup/singularity/wiki/Preventing-DNS-Rebinding-Attacks](https://github.com/nccgroup/singularity/wiki/Preventing-DNS-Rebinding-Attacks)  
> 21. DNS Rebinding Protections | pfSense Documentation, [https://docs.netgate.com/pfsense/en/latest/services/dns/rebinding.html](https://docs.netgate.com/pfsense/en/latest/services/dns/rebinding.html)  
> 22. 0.0.0.0 Day: Exploiting Localhost APIs From the Browser, [https://www.oligo.security/blog/0-0-0-0-day-exploiting-localhost-apis-from-the-browser](https://www.oligo.security/blog/0-0-0-0-day-exploiting-localhost-apis-from-the-browser)  
> 23. Private Network Access (PNA) Bypass Allows Access to localhost on, [https://issues.chromium.org/40058874](https://issues.chromium.org/40058874)  
> 24. Certificates for localhost \- Hacker News, [https://news.ycombinator.com/item?id=17358339](https://news.ycombinator.com/item?id=17358339)  
> 25. \[bug\]: chan\_pjsip changes SSRC on WebRTC channels, which is, [https://github.com/asterisk/asterisk/issues/1535](https://github.com/asterisk/asterisk/issues/1535)  
> 26. New permission prompt for Local Network Access | Blog, [https://developer.chrome.com/blog/local-network-access](https://developer.chrome.com/blog/local-network-access)  
> 27. Origin private file system \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API/Origin\_private\_file\_system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)  
> 28. The File System Access API: simplifying access to local files, [https://developer.chrome.com/docs/capabilities/web-apis/file-system-access](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)  
> 29. FileSystemFileHandle: createSyncAccessHandle() method \- Web APIs, [https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle)  
> 30. The origin private file system | Articles \- web.dev, [https://web.dev/articles/origin-private-file-system](https://web.dev/articles/origin-private-file-system)  
> 31. The Origin Private File System now works on Safari : r/rust \- Reddit, [https://www.reddit.com/r/rust/comments/1lu5k1f/the\_origin\_private\_file\_system\_now\_works\_on\_safari/](https://www.reddit.com/r/rust/comments/1lu5k1f/the_origin_private_file_system_now_works_on_safari/)  
> 32. Sandboxing Services with Systemd | Lincoln Loop, [https://lincolnloop.com/blog/sandboxing-services-systemd/](https://lincolnloop.com/blog/sandboxing-services-systemd/)  
> 33. systemd/Sandboxing \- ArchWiki, [https://wiki.archlinux.org/title/Systemd/Sandboxing](https://wiki.archlinux.org/title/Systemd/Sandboxing)  
> 34. Avoiding complexity with systemd | Michael Maclean, [https://mgdm.net/weblog/systemd/](https://mgdm.net/weblog/systemd/)  
> 35. Securing Applications with Least Privileged Service Accounts, [https://techcommunity.microsoft.com/blog/coreinfrastructureandsecurityblog/securing-applications-with-least-privileged-service-accounts/570955](https://techcommunity.microsoft.com/blog/coreinfrastructureandsecurityblog/securing-applications-with-least-privileged-service-accounts/570955)  
> 36. Securing FireDaemon Pro and Windows Services, [https://www.firedaemon.com/post/securing-firedaemon-windows-services](https://www.firedaemon.com/post/securing-firedaemon-windows-services)  
> 37. Sandboxing Systemd Services \- ejaaskel, [https://ejaaskel.dev/sandboxing-systemd-services/](https://ejaaskel.dev/sandboxing-systemd-services/)  
> 38. F40 Change Proposal: Systemd Security Hardening (System-Wide), [https://discussion.fedoraproject.org/t/f40-change-proposal-systemd-security-hardening-system-wide/96423](https://discussion.fedoraproject.org/t/f40-change-proposal-systemd-security-hardening-system-wide/96423)  
> 39. Dynamic Users with systemd \- 0pointer.net, [https://0pointer.net/blog/dynamic-users-with-systemd.html](https://0pointer.net/blog/dynamic-users-with-systemd.html)  
> 40. Best Practice in Securing Windows Service Accounts, [https://www.alaniz.io/blog/securing-windows-service-accounts](https://www.alaniz.io/blog/securing-windows-service-accounts)  
> 41. Security Identifiers \- Microsoft Learn, [https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-security-identifiers](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-security-identifiers)  
> 42. Understanding CORS: A Practical Guide \- ByteMinds, [https://www.byteminds.co.uk/blog/understanding-cors-a-practical-guide](https://www.byteminds.co.uk/blog/understanding-cors-a-practical-guide)  
> 43. WICG/private-network-access \- GitHub, [https://github.com/wicg/private-network-access](https://github.com/wicg/private-network-access)  
> 44. WICG/local-network-access \- GitHub, [https://github.com/WICG/local-network-access](https://github.com/WICG/local-network-access)  
> 45. Public \--\> Private CORS requests failing in some situations due to PNA, [https://issues.chromium.org/40226712](https://issues.chromium.org/40226712)  
> 46. Permissions-Policy: loopback-network directive \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/loopback-network](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/loopback-network)  
> 47. Local network access \- Security \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local\_network\_access](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access)  
> 48. Connecting to Chrome with AutoHotkey | Amazing deep-dive into, [https://www.the-automator.com/connecting-to-chrome-with-autohotkey/](https://www.the-automator.com/connecting-to-chrome-with-autohotkey/)  
> 49. Websocket doesn't work in server 127.0.0.1:8000 \- Stack Overflow, [https://stackoverflow.com/questions/45474041/websocket-doesnt-work-in-server-127-0-0-18000](https://stackoverflow.com/questions/45474041/websocket-doesnt-work-in-server-127-0-0-18000)  
> 50. Supercharged OPFS Database with RxDB, [https://rxdb.info/rx-storage-opfs.html](https://rxdb.info/rx-storage-opfs.html)  
> 51. File System API \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)  
> 52. CVE-2026-11624: Model Context Protocol DNS Rebinding Flaw, [https://www.sentinelone.com/vulnerability-database/cve-2026-11624/](https://www.sentinelone.com/vulnerability-database/cve-2026-11624/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAWCAYAAAAmaHdCAAABA0lEQVR4Xu2TvwqBURjGX2VhIKVkNCplkEFZyKBsVnaLUq7AamFgYjJZZJYrcAXcgE2yWBjwPM7BOScfq8GvfnU67+l7n/PnE/nzjQLcwat2AQNGPQSXRp3OjfoTHxzBMzzBnF2+U4UzsRtYROAEtkR1Gor6sEkb1pw5izTswzjcwC1MGHU/HOt1nrBDQ487otI0n1WRqKikTOxJD2b0OAUPcAXDei4PB3r8lsd5sBth9Cm8wLKeY8qP52Fu5QETMAkTFeXLVngDjJl1C6Au6mzWsOvULNytmMRE3RQ/9HErjMrXF3QLmg7cw6Qzf6cEj/J6xnylFWuFgjfF38DzPP78IjcPdC+qWO+lEwAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAAaCAYAAADv/O9kAAACu0lEQVR4Xu2WS6iNURTHl7xfcaUQ5VGIayJRysAAkUeSAUkpeQzuAAOiKAMDCRERAyJ5ZEiEJBkoA1IMSB0SZUCKCYX/zzq7b5/93Xu6g8Pdl/OvX/f0rb2/u/f61n/tbdZUU039T1otPoqfEV/E5niQtN7K4z5Ez5hzWowME7qDeogz4oeYl8RiDRR3xHsxIYlNFY/FCzE2iWWrFvFIVMTo2lCNxoi34rrol8TQNPFJHDNPZvaaIb6Kq6JXEotFNVAV+9JAVYPEPfFMDK8N5ak15j7dlgYS7bD6dggbpyqojqwV/P1dzElisShtSrw9fweNEK/EazEqiWWn4G8WzMI7Et6vWMf+RsEyvI/3Zq1G+RttMrfM0TSQoxrl7/7ipnkSSWbWaqS/l5m/Z7t1g6OsUef3FPMecUr0TmIca3vENbHRPE5iForzVaab24z4STFR7BI3xAIxW1wWx624GbLec2KdWC6uiBXWyaR31t8ssj1/c5PbID6L/VbeNDc4ksVG5pqf7yycqmBjPc2TikWw0BJxQZwwtw7ro8rYEDpgbkk2xxWapFTELDHYPLl1bbZWvLPyvZuXxWIcz8OYb+JNFe7o3M+xyuQwIRKJvGjeGxCVMtT86z21osI49p6I+WKSeGDF4rEPX5J3Ab95xm+SSX/i/5OIUL1Lf8/sQrGh51buHSQirjDiVAKJYMO3rTgKqbCQuPHmSeEvCv2JkwQx96W57bpU3Akemt/fg1rFTvOSRSz+kBUNMf6C3AJvWXGKEKOCKOvF5sm5K2ZW4yQIi9Sz7F8Ri99qvrFV4qBYJMZZ0eiOmHs29AaaI2MR/eG+FZbg+SWxVwwx/8JY7qzYIg6b95xsFLwdi6QMs3IzHGDe8BBj+kQxRAML8VAdfS2zDf9JsXmOsrY08K+Lzr1S7LYMmllTTWWmXwjalk16vy1QAAAAAElFTkSuQmCC>
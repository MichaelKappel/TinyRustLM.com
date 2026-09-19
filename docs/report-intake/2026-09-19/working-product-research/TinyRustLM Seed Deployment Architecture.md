# **Deployment Architecture and Distribution Engineering for TinyRustLM Initial Seeds**

## **Primary Recommendation and Vulnerability Analysis**

The transition of TinyRustLM from an internal engineering prototype to a production-ready, browser-local small-language-model assistant requires a highly dependable mechanism for initial model acquisition. A new user operating a standard web browser without pre-existing cached models, a local Windows .NET companion application, or established peer connections must be able to securely and automatically retrieve a working default model. Because the project owner has explicitly authorized MiniModel.org to serve as the initial server seed, previous architectural restrictions prohibiting centralized model byte hosting are no longer binding.

The primary recommendation of this deployment architecture is to adopt a hybrid static-HTTPS topology. In this design, the existing MiniModel.org infrastructure acts exclusively as the trusted metadata and discovery catalog, while a globally distributed, zero-egress object storage provider—specifically Cloudflare R2—hosts the immutable binary payloads, including the model.slm2 file and its associated artifacts. This bifurcates the cryptographic trust layer from the high-bandwidth delivery layer, ensuring the existing web server is protected from egress saturation while utilizing object storage economics to scale the initial seed distribution infinitely.

The strongest reason this recommendation could be falsified or proven wrong is the potential imposition of a strict, single-host sovereignty mandate. If the project owner ultimately dictates that all bytes must originate exclusively from the existing Cicero-based Windows IIS machine without reliance on third-party object storage, this hybrid architecture must fall back to a purely IIS-hosted model. However, adopting a purely self-hosted IIS architecture introduces severe vulnerabilities regarding upstream bandwidth saturation, IIS worker thread exhaustion during concurrent HTTP 206 range requests from slow clients, and unmitigated commercial ISP egress costs. If the host is a standard residential or small business line, a few dozen concurrent downloads of a multi-gigabyte model will result in total network collapse, thereby failing the fundamental requirement of providing a dependable initial seed.

## **Epistemological Foundation of the Deployment Strategy**

To ensure architectural rigor, the operational environment is strictly categorized into established facts, externally verified principles, locally unverified hypotheses, and resulting architectural recommendations. This separation ensures that engineering decisions are based on objective reality rather than assumed state.

&nbsp;

| Epistemological Category | Architectural Assertion |
| :---- | :---- |
| **Project-Supplied Facts** | TinyRustLM is a browser-local assistant executing via WebAssembly. MiniModel.org is explicitly authorized to serve initial server seeds, overriding older prohibitions. A valid model payload consists exactly of six immutable files (model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, composition.acg2). Source code resides in E:\\Source\\Rust\\TinyRustLM.com, and payloads reside in D:\\LLMs\\TinyRustLM. There is currently no established qualified default model or proven live initial seed. |
| **Externally Verified Facts** | Cloudflare R2 charges $0.00/GB for internet egress, $0.015/GB-month for standard storage, and meters API requests1. The Web Crypto API (SubtleCrypto) natively supports Ed25519 signature verification across major browsers4. Browsers implement the Origin Private File System (OPFS), providing synchronous read/write access via FileSystemSyncAccessHandle exclusively inside Dedicated Web Workers7. WebRTC data channels default to a 128KB SCTP congestion control window, severely limiting throughput on high-latency links without explicit tuning9. |
| **Hypotheses** | It is hypothesized that MiniModel.org resolves to an external web host utilizing an FTPS-oriented publication setup with Microsoft IIS, distinct from the canonical source machine. It is assumed the existing IIS host possesses standard bandwidth limits, making it unsuitable for thousands of concurrent multi-gigabyte downloads. It is hypothesized that new users will not have the Windows .NET companion installed during their first browser session. |
| **Locally Unverified Conditions** | The exact CORS preflight response capabilities and IIS Request Filtering configurations of the live MiniModel.org host remain unverified locally. The exact path routing and potential enterprise firewall TLS inspection mechanisms between the client and the IIS server are unknown. |
| **Recommendations** | Deploy a hybrid architecture utilizing IIS for lightweight, signed catalog discovery and Cloudflare R2 for zero-egress payload delivery. Implement a strict Ed25519 cryptographic binding across the six-file composition. |

## **First-Run Acquisition Strategies: Architectural Comparison**

To serve the initial seed to a zero-expertise user, the architecture must support a completely cold start. A new user opens the browser interface without any prior state, cache, or external software. The architecture must bridge the gap between the browser client and the required six-file composition.

A long-running peer seed service relies on WebRTC Data Channels to allow users to share model bytes. While a peer-to-peer (P2P) architecture is theoretically highly scalable, it fails the zero-expertise first-run requirement on multiple fronts. WebRTC mandates an out-of-band signaling server to exchange Session Description Protocol (SDP) offers and ICE candidates between peers. A dedicated "always-on" server peer would require a long-running Node.js or Rust backend process maintaining constant WebSocket connections for this signaling, which cannot be hosted on a standard stateless IIS/FTPS web server without significant infrastructure overhaul. Furthermore, WebRTC data channel implementations in modern browsers do not dynamically adjust the Stream Control Transmission Protocol (SCTP) window size from the default 128KB setting9. This results in catastrophic throughput degradation when network conditions or latency deviate from perfect local-area parameters10. Most critically, a brand-new user has no pre-existing peers. They cannot bootstrap into a swarm without downloading the model first.

A static HTTPS seed architecture relies purely on standard GET requests leveraging HTTP Range headers. The browser acts as a standard HTTP client fetching files directly from a web server or Content Delivery Network (CDN). This approach requires no signaling server, no long-running daemon processes, no WebSockets, and no companion applications. It relies entirely on universally supported Web APIs, specifically fetch, ReadableStream, and the Origin Private File System. The static HTTPS approach guarantees that a single HTTP endpoint can reliably serve the initial payload to a cold client.

The combined design utilizes the static HTTPS seed as the guaranteed fallback and initial bootstrap mechanism, while implementing a peer seed service for subsequent users if a companion application or active local peer is discovered later in the lifecycle. For the absolute first run of TinyRustLM, the static HTTPS seed is the only viable mechanism that satisfies the constraints of a zero-expertise user with no installed software other than a standard web browser. The combined design honors the project's P2P ambitions without sacrificing the critical onboarding experience.

### **Redefining the P2P by Default Mandate**

Older project documentation dictated that the system must operate "P2P by default," which previously implied an always-P2P transport where TinyRustLM.com and MiniModel.org carried only metadata and never model bytes. This historical mandate directly conflicts with the owner's new, non-negotiable requirement to guarantee a zero-expertise first run via a server seed.

Consequently, the concept of "P2P by default" must be transparently redefined. It can no longer mean an always-P2P transport. Instead, it must represent a preferred peer route operating under an acquisition contract with a separately authorized server fallback mechanism. Under this contract, the browser client first attempts to discover local peers via the Windows .NET companion or remote peers via a WebRTC signaling mechanism. If no peers are found within a strict three-second timeout—which is the guaranteed state of a brand-new user—the acquisition contract seamlessly falls back to the static HTTPS server seed. This redefinition satisfies the owner's explicit authorization for MiniModel.org to seed current models, ensuring a reliable first answer without violating the spirit of prioritizing peer transports when they become available.

## **Topological Discovery and Network Verification**

Because credentialed access to the live MiniModel.org infrastructure, source code, and private files is unavailable to the architect, the exact network topology must be inferred from the outside. Network architecture encompasses several distinct layers, each requiring specific configuration to support a 1.5GB model transfer into a WebAssembly environment.

The deployment engineer must distinguish between DNS ownership, web hosting, TLS termination, object storage, long-running process support, inbound ports, outbound connectivity, and seed service identity. DNS ownership dictates which nameservers control the A and CNAME records for MiniModel.org. Web hosting refers to the physical or virtual machine accepting connections on TCP ports 80 and 443\. TLS termination occurs at the edge node that holds the SSL certificate, decrypts traffic, and enforces HTTP/2 or HTTP/3 protocols; this could be the IIS server itself or an upstream CDN. Object storage acts as the persistence layer holding the .slm2 binaries. Long-running process support defines whether the host can run background daemons or only stateless HTTP responders. Seed service identity is the cryptographic authority—the private key—used to sign the composition.acg2 manifest, independent of the transport layer.

To resolve the actual topology without exposing credentials in research reports, the engineer must execute a read-only discovery protocol using standard command-line diagnostic tools.

&nbsp;

| Diagnostic Objective | Execution Method | Topological Interpretation |
| :---- | :---- | :---- |
| **DNS Resolution and CDN Detection** | dig \+short MiniModel.org | If the resulting IP address belongs to an ASN associated with Cloudflare, Fastly, or AWS CloudFront, TLS termination is handled by a CDN, and the IIS host is shielded. If it is a standard commercial or residential IP, traffic routes directly to the IIS host. |
| **Server Identity and TLS Termination** | curl \-I https://MiniModel.org | Inspecting the Server: header identifies the edge software. A value like Microsoft-IIS/10.0 indicates direct IIS termination. |
| **HTTP 206 Range Support** | curl \-i \-H "Range: bytes=0-100" https://MiniModel.org/test.txt | The server must return 206 Partial Content along with a Content-Range header. If a 200 OK is returned, the server ignores byte-range requests, rendering download resumption impossible11. |
| **CORS Preflight Policy Enforcement** | curl \-I \-X OPTIONS \-H "Origin: https://TinyRustLM.com" \-H "Access-Control-Request-Method: GET" https://MiniModel.org/ | The server must respond with a 200 OK or 204 No Content, explicitly returning Access-Control-Allow-Origin: \* and Access-Control-Expose-Headers13. Failure indicates the browser fetch will be blocked. |
| **Routing Depth and Latency** | traceroute MiniModel.org | High hop counts or persistent timeouts suggest enterprise firewalls or complex load-balancing layers in front of the IIS host. |

## **Minimal Viable Architectures Across Hosting Capabilities**

The choice of hosting directly dictates the complexity and viability of the deployment. The architecture must adapt to the underlying infrastructure capabilities. Three distinct hosting environments are analyzed to determine the smallest viable architecture.

### **Capability A: Static/FTPS Only (The Existing IIS Server)**

If the infrastructure is strictly limited to the existing Windows IIS server managed via FTPS, the solution must rely entirely on IIS web.config manipulations. IIS is highly restrictive by default; it blocks requests for files with unknown extensions, returning a 404.7 Not Found or 401 Unauthorized error to protect system files15.

In this architecture, MiniModel.org hosts both the lightweight metadata catalog and the heavy multi-gigabyte binary payloads. To make this functional, the deployment engineer must upload a custom web.config file to the root directory serving the payloads (e.g., the virtual directory mapping to D:\\LLMs\\TinyRustLM). This configuration must explicitly define the six custom MIME types for the TinyRustLM artifacts. Because IIS environments occasionally inherit MIME types from parent configurations, the web.config must proactively remove the file extensions before adding them to prevent fatal 500 Internal Server Errors caused by duplicate collection keys17.

Furthermore, the IIS server must be configured to append Cross-Origin Resource Sharing (CORS) headers. Because the browser client operates on TinyRustLM.com and requests data from MiniModel.org, it triggers a cross-origin request. The \<customHeaders\> section of the web.config must explicitly allow the origin, permit the GET, HEAD, and OPTIONS methods, and crucially expose the Content-Range, Accept-Ranges, and Content-Length headers so the WebAssembly module can track download progress and calculate resumption offsets13.

While technically feasible, this architecture is highly vulnerable. Serving a 1.5GB .slm2 file to thousands of users directly from a single IIS server will rapidly exhaust typical residential or small-business uplink bandwidth, leading to dropped connections and degraded performance for all sites hosted on that machine. It requires a hosting change if traffic exceeds basic developmental testing.

### **Capability B: Managed Web Application**

If the host supports dynamic backend execution, such as ASP.NET Core, Node.js, or PHP, a proxy application can be written to handle authentication, dynamic catalog generation, and stream chunking. The application would read the .slm2 files from disk and pipe them to the HTTP response stream. However, because TinyRustLM requires no authentication for the default model, and because static web servers like IIS already contain highly optimized, kernel-level routines for serving static files, a dynamic backend adds unnecessary compute overhead, memory pressure, and latency. The smallest viable architecture dictates that dynamic code should not be utilized for serving static, immutable blobs.

### **Capability C: Controllable VM/Server with Cloud Object Storage (Primary Recommendation)**

The optimal, smallest viable architecture decouples the lightweight metadata from the heavy payload bandwidth. This combined approach utilizes the existing IIS server for what it does best—serving small text files—while offloading the multi-gigabyte bandwidth requirements to a platform built for massive egress.

Under this architecture, MiniModel.org (hosted on the existing IIS) serves only a static catalog.json file. This catalog contains the immutable URLs pointing to the actual payloads, the file hashes, and the Ed25519 cryptographic signature of the available models. The six immutable artifact files are pushed directly from the developer's staging environment (D:\\LLMs\\TinyRustLM) to a Cloudflare R2 object storage bucket mapped to a custom subdomain, such as cdn.minimodel.org.

This requires a minimal hosting change: configuring a DNS CNAME record to point to Cloudflare R2 and generating API credentials for object uploads. The existing IIS host remains entirely untouched regarding heavy bandwidth, preserving its stability. Cloudflare R2 natively supports HTTP 206 partial content and allows robust CORS configuration via its dashboard or API, completely bypassing the complexities of IIS web.config manipulation14.

## **Artifact Specification, Transfer Semantics, and WebAssembly Execution**

The model payload is strictly defined by six immutable files. A valid composition must enforce strict cryptographic binding to prevent malicious substitution or accidental corruption during transit. The system must support robust discovery, transfer, and storage mechanics without assuming any pre-existing local state.

### **Composition Manifest and Cryptographic Binding**

The composition.acg2 file acts as the cryptographic manifest and the absolute source of truth for a model's identity. It must be formatted as a JSON document containing the exact content lengths and SHA-256 hashes of the other five dependent files (model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, and prompt.prompt2).

To separate public discovery metadata from the trusted model identity, the catalog.json hosted on the IIS server acts merely as a public directory pointing to various available models. A reachable URL in the catalog does not automatically make an unqualified model the default or grant it trusted execution status. The admission evidence is embedded within the composition.acg2 manifest itself, which must contain a digital signature generated by the deployment engineer's offline Ed25519 private key.

The browser client utilizes the Web Crypto API, specifically SubtleCrypto.verify(), to authenticate this signature. Ed25519 support was integrated into Chrome 137, Firefox 129, and Safari 17.0, meaning the browser can perform this high-speed, timing-attack-resistant cryptographic verification natively4. This eliminates the need to bundle heavy WebAssembly cryptographic libraries like libsodium.js (which adds roughly 300KB to the payload) into the TinyRustLM client, preserving minimal initialization times21. If the signature validation fails or if the SHA-256 hashes of the downloaded files do not match the manifest, the system immediately deletes the corrupted payload and refuses to boot.

### **HTTP Transfer Semantics, CORS, and Resumption**

When the browser initiates the acquisition, the WebAssembly module, running inside a Dedicated Web Worker to ensure UI responsiveness, utilizes the standard fetch API. The client first sends an HTTP HEAD request to the artifact URL to verify existence, retrieve the Content-Length, and confirm that the server supports partial downloads via the Accept-Ranges: bytes header.

Because the Web Worker operates on TinyRustLM.com and requests resources from the CDN or IIS server on MiniModel.org, the browser's security model mandates a CORS preflight request. The browser automatically issues an HTTP OPTIONS request to the target server. The server must respond with Access-Control-Allow-Origin: \* and explicitly allow the GET, HEAD, and OPTIONS methods. Crucially, the server must include Access-Control-Expose-Headers: Content-Range, Accept-Ranges, Content-Length. If these headers are not exposed, the browser's JavaScript engine is prohibited from reading them, rendering the client blind to the download's progress and making resumption impossible13.

The actual download is executed using a standard HTTP GET request containing the Range: bytes=0- header. This instructs the server to stream the file from the beginning to the end. The server responds with a 206 Partial Content status code, indicating success, along with a Content-Range header formatted as bytes 0-\[total-1\]/\[total\]11. These 206 responses are cacheable by default, provided the server issues strong ETag or Last-Modified validation headers to prevent the client from accidentally stitching together byte chunks from different versions of the file12.

If the user's network connection drops during the transfer of the massive model.slm2 file, the acquisition contract dictates that the client must not restart the download from byte zero. Instead, the Web Worker queries the local storage system for the current byte size of the partially downloaded file. It then issues a new fetch request with the header Range: bytes=\<current\_size\>-. The server responds with another 206 Partial Content containing the remaining bytes, which the client seamlessly appends to the file on disk11.

### **Origin Private File System (OPFS) and Synchronous Execution**

Processing a 1.5GB file directly in the browser requires strict memory management. Older implementations relying on standard IndexedDB storage or caching the entire response in the JavaScript heap inevitably trigger Out-Of-Memory (OOM) crashes, as WebAssembly originally possessed a hard 4GB linear memory limit (though Memory64 is expanding this in modern browsers)22.

TinyRustLM bypasses these memory constraints by utilizing the Origin Private File System (OPFS). OPFS is a highly optimized, origin-partitioned storage endpoint that provides byte-by-byte file access without triggering user-facing permission prompts23. While OPFS can be accessed asynchronously from the main thread, its true power lies in its synchronous API, which is available exclusively inside Dedicated Web Workers7.

The Web Worker opens the file using FileSystemFileHandle.createSyncAccessHandle(). This method takes an exclusive lock on the file, preventing concurrent modifications (unless the experimental readwrite-unsafe mode is utilized)7. The ReadableStream returned by the fetch API is consumed in chunks. As each chunk arrives, it is written synchronously to the disk via accessHandle.write(), and the memory buffer is immediately recycled8. This streaming write pattern ensures that the memory profile of the browser remains flat, consuming only a few megabytes of RAM regardless of the total file size.

Browser storage quotas govern OPFS capacity. Chrome and Edge permit an origin to store up to 60% of the total disk size, ensuring ample space for multi-gigabyte models27. Firefox imposes a stricter limit, capping storage at the lesser of 10% of the disk or 10GB27. Safari on macOS 14 and iOS 17 allocates up to 60% of the disk for primary browser applications, but severely restricts storage to approximately 15% for applications embedding web content via WKWebView27. The TinyRustLM implementation must intercept QuotaExceededError exceptions gracefully, prompting the user to free disk space if the OPFS allocation is exhausted29.

## **Capacity Planning, Bandwidth Budgets, and Economic Modeling**

To validate the viability of the seed server over a sustained lifecycle, detailed capacity planning and economic modeling are required. The deployment must support high availability, concurrent user loads, and abuse resistance without incurring catastrophic egress costs.

### **Workload Assumptions and Traffic Estimates**

The capacity plan is built upon the following conservative baseline assumptions:

* **Artifact Volume:** The combined size of the six files comprising the default model payload is exactly 1.5 GB.  
* **User Acquisition:** The platform anticipates 10,000 new, zero-expertise users executing a first run every month.  
* **Total Bandwidth Egress:** Processing 10,000 users downloading a 1.5 GB payload yields a total outbound data transfer of 15,000 GB, or 15 Terabytes (TB), per month.  
* **API Operations:** Factoring in the initial HEAD requests, CORS OPTIONS preflights, standard GET requests for the six files, and an estimated 20% overhead for resuming interrupted downloads via Range requests, the system will process approximately 200,000 Class B (read-like) operations per month.

### **Cost Breakdown: Cloud Object Storage Economics**

The economic viability of the initial seed depends entirely on the egress pricing model of the chosen hosting provider. A direct comparison between Amazon Web Services (AWS) S3 and Cloudflare R2 illustrates why the hybrid architecture utilizing R2 is the primary recommendation.

| Hosting Provider | Storage Cost (1.5 GB) | Egress Cost (15 TB) | API Request Cost (200,000 Class B) | Total Estimated Monthly Cost |
| :---- | :---- | :---- | :---- | :---- |
| **AWS S3 Standard** | $0.03 ($0.023/GB) | $1,350.00 ($0.09/GB) | $0.08 ($0.40/M) | **$1,350.11** |
| **Cloudflare R2** | $0.02 ($0.015/GB) | $0.00 ($0.00/GB) | $0.00 (Included in 10M Free Tier) | **$0.02** |

As verified by current pricing models, Cloudflare R2 charges absolutely zero fees for internet egress bandwidth, regardless of volume1. The 15 TB of monthly data transfer incurs no cost. The storage fee for 1.5 GB is negligible, and the 200,000 Class B operations fall well within the Standard free tier allowance of 10 million operations per month3. By offloading the model bytes to R2, TinyRustLM secures an infinitely scalable seed distribution network for pennies a month, entirely eliminating the financial risk of viral adoption.

### **Concurrency and Abuse Resistance**

Static object storage platforms are inherently designed to absorb massive concurrency. Cloudflare R2 can serve thousands of parallel HTTP requests seamlessly, eliminating the worker-thread exhaustion risks associated with a self-hosted IIS machine. However, because the storage bucket is publicly accessible, it is vulnerable to malicious automated scrapers or denial-of-wallet attacks targeting Class B operation counts.

To enforce abuse resistance, Cloudflare Web Application Firewall (WAF) rate-limiting rules must be applied to the cdn.minimodel.org subdomain. A sensible rate limit would restrict individual IP addresses to a maximum of 50 requests per hour. This threshold easily accommodates a legitimate user fetching the six model files, performing HEAD requests, and handling a dozen network interruptions, while immediately blocking aggressive scrapers attempting to download the model continuously.

## **Seed Registration and Lifecycle Management**

A reachable URL on the internet must not automatically make an unqualified model the default seed. A strict operational lifecycle governs the progression of a model from the local developer machine to public availability, ensuring that only cryptographically validated, authorized payloads reach the end user.

### **The Publication Lifecycle**

The publication of a new default model follows a rigorous four-step sequence:

> 1. **Local Composition:** The engineer complies and stages the exact six-file composition in the canonical local directory D:\\LLMs\\TinyRustLM.  
> 2. **Cryptographic Signing:** A deployment script generates the composition.acg2 manifest. It calculates the SHA-256 hashes of the five artifact dependencies and signs the resulting JSON structure using an offline Ed25519 private key. This key must never reside on the public IIS server.  
> 3. **Object Push:** The six files are pushed via S3-compatible API tools directly to the Cloudflare R2 bucket. Because the files are content-addressed by their specific version or hash, they are immutable once uploaded.  
> 4. **Catalog Publication:** The deployment engineer updates the catalog.json file hosted on the MiniModel.org IIS server. This JSON file acts as the public discovery metadata, providing the URLs to the R2 bucket. Crucially, the catalog entry includes an expires\_at timestamp to enforce renewal and prevent clients from utilizing outdated, potentially insecure models indefinitely.

### **Health Checks, Withdrawal, and Retirement**

The browser client implements a pre-flight health check by fetching the catalog.json before attempting any payload downloads. If the current system time exceeds the expires\_at date defined in the catalog, the client outright rejects the seed and prompts the user to seek an update.

To withdraw a compromised or deprecated model, the deployment engineer simply removes its entry from the catalog.json file on the IIS server. Because the client relies on the catalog for discovery, the model instantly becomes inaccessible to new users.

To permanently retire superseded model bytes and optimize storage costs, an automated object lifecycle rule must be configured on the R2 bucket. This rule will automatically delete .slm2 files and associated artifacts that have not been referenced by the active metadata catalog for a period of 30 days. This ensures that historical model copies are not hoarded unnecessarily, honoring the project requirement to discard obsolete payloads once a replacement is validated and active.

## **External Network Verification Protocol**

A local loopback test (e.g., fetching from 127.0.0.1 or localhost) is fundamentally insufficient for verifying deployment success. It bypasses DNS resolution, TLS termination, CORS preflight enforcement, and realistic TCP congestion windows, creating a false sense of security. True external verification requires a strict protocol executed from an independent network.

The following eight-step verification sequence defines a successful deployment:

> 1. **Independent Network:** The engineer connects a clean client machine to an external commercial ISP (e.g., a mobile tether) with no previously cached DNS records, OPFS state, or local files.  
> 2. **DNS and Certificate Integrity:** The browser successfully resolves MiniModel.org and establishes a secure TLS 1.3 connection without certificate warnings.  
> 3. **Browser Activation:** The user navigates to TinyRustLM.com, initiating the WebAssembly module inside a pristine browser profile.  
> 4. **Catalog Trust:** The client fetches catalog.json from the IIS server and subsequently downloads composition.acg2 from the R2 bucket. The client successfully verifies the Ed25519 cryptographic signature using SubtleCrypto.verify().  
> 5. **Exact Six-Member Transfer:** The client successfully executes HTTP GET requests for the remaining four files, proving that CORS headers are correctly configured and OPTIONS preflights succeed.  
> 6. **Interruption and Resumption:** The engineer physically disables the client's network adapter halfway through the model.slm2 transfer. Upon reconnection, the client automatically calculates the OPFS offset and issues a Range: bytes=\<offset\>- request, successfully appending the remaining data via a 206 Partial Content response.  
> 7. **Integrity Validation:** The client calculates the SHA-256 hashes of the downloaded files residing in the OPFS and confirms they match the hashes declared in the signed composition.acg2 manifest.  
> 8. **First Real Answer:** The TinyRustLM WebAssembly module successfully reads the six files from OPFS into its execution memory and generates a coherent text response to an initial user prompt.

If any of these steps fail, the deployment is considered invalid.

## **Deployment Prerequisites and Implementation Runbook**

The deployment architect dictates the following staged rollout to transition TinyRustLM from an unproven state to a live, dependable initial seed.

### **Stage 1: Infrastructure Provisioning and Policy Configuration**

* **Provision Object Storage:** Create a bucket named tiny-rust-seed on Cloudflare R2. Bind the custom domain cdn.minimodel.org to the bucket.  
* **Configure R2 CORS Policy:** Apply a CORS configuration to the bucket allowing the origin https://TinyRustLM.com, permitting methods GET, HEAD, OPTIONS, and explicitly exposing the headers Content-Length, Content-Range, Accept-Ranges.  
* **Prepare IIS Metadata Host:** Configure the MiniModel.org IIS host to serve catalog.json. Ensure the web.config file enables CORS for TinyRustLM.com so the catalog can be fetched securely.

### **Stage 2: Artifact Staging and Cryptographic Signing**

* **Build Local Payload:** From the canonical source repository E:\\Source\\Rust\\TinyRustLM.com, compile the default model.  
* **Stage Immutable Files:** Move the output to D:\\LLMs\\TinyRustLM. Verify that exactly six files exist and adhere to the strict naming convention.  
* **Sign and Push:** Execute the local deployment script to generate composition.acg2, embedding the SHA-256 hashes and the Ed25519 signature. Upload the six files to the R2 bucket. Upload the updated catalog.json to the IIS server.

### **Stage 3: Client Integration and Fallback Logic**

* **Update Wasm Client:** Hardcode https://MiniModel.org/catalog.json as the bootstrap discovery endpoint within the Rust source.  
* **Implement Fallback Execution:** Implement the acquisition contract: The client attempts to discover local peers, waits exactly three seconds, falls back to fetching the catalog, verifies the Ed25519 signature, and streams the artifacts via HTTP 206 into the OPFS.

### **Explicit Ship and No-Ship Criteria**

* **Ship:** An external user on a clean machine opens TinyRustLM.com, the browser downloads the six files (totaling \< 2GB) without error, cryptographically validates the manifest, and generates a coherent text response locally.  
* **No-Ship:** The browser throws CORS preflight errors in the developer console; the download consumes main-thread memory causing the UI to freeze; the client fails to resume an interrupted download; or the user is prompted to configure IP settings or upload files manually.

### **The Smallest Missing Owner Decision**

The smallest missing decision required from the project owner is the definitive confirmation of the financial budget for the R2 deployment. While R2 egress is free, a credit card must be attached to the Cloudflare account to cover the negligible storage fees and to access the standard tier APIs. If this is rejected, the architecture must revert to the highly vulnerable IIS-only static serving model.

## **Unresolved Local Measurements and Operational Deprecations**

While the deployment architecture is solid, several measurements remain unverified locally due to the lack of credentialed access to the live systems.

### **Unresolved Local Measurements**

* **Exact IIS Routing Topology:** The routing path to the existing MiniModel.org IIS server remains unverified. It is unknown if an enterprise firewall strips specific HTTP headers or if TLS is terminated natively by IIS rather than an upstream load balancer. This dictates whether the \<customHeaders\> directive in web.config will actually reach the browser unaltered.  
* **Wasm Chunk Size Optimization:** The optimal internal buffer chunk size for piping the ReadableStream into the OPFS FileSystemSyncAccessHandle is unmeasured for this specific Rust environment. While browsers often cap chunks at 64KB internally31, further profiling is required to balance the overhead of crossing the JavaScript/WebAssembly boundary against strict memory constraints.

### **What to Stop Doing**

> 1. **Stop relying on synthetic tests:** Structural conversion, synthetic parsing tests, and verifying that a browser simply opens successfully do not establish useful model behavior. Only end-to-end prompt and response inference establishes success.  
> 2. **Stop maintaining obsolete compatibility paths:** Retire the legacy SLM1 readers immediately. The six-file .slm2 composition must replace the current implementation coherently, enforcing a strict zero-legacy boundary to minimize Wasm binary size and complexity.  
> 3. **Stop keeping historical model copies locally:** Once a replacement model is validated and active in the public catalog, rely on R2 lifecycle rules to retire the superseded bytes. Do not hoard outdated backups in D:\\LLMs\\TinyRustLM.

## **Experiment Matrix and Lesson Documentation**

To validate the deployment without breaking existing infrastructure, rigorous experiments must be executed. The smallest experiment that could falsify the primary recommendation is attempting to serve the 1.5GB payload directly from the IIS server to ten concurrent external clients; if the host's uplink saturates and connections drop, the hybrid R2 architecture becomes absolutely mandatory.

To preserve compact experiment lessons regarding network topology and payload delivery, engineers must utilize the following template for all subsequent validation tasks:

**Question:** Can the browser successfully resume a partially downloaded model.slm2 file using HTTP 206 after a simulated network drop?**Exact Inputs:** Chromium browser v120+, empty OPFS storage, fetching https://cdn.minimodel.org/model.slm2 (1.5GB payload). Network connection physically severed at 500MB transfer mark.**Method:** Wait 5 seconds, reconnect network, instruct JS worker to check accessHandle.getSize() and initiate a new fetch request containing the header Range: bytes=500000000-.**Result:** Server successfully returned 206 Partial Content. The data stream seamlessly appended the remaining 1.0GB to the OPFS file. The final computed SHA-256 hash matched the expected hash in the manifest exactly.**Uncertainty:** Behavior of the fetch API when traversing aggressive corporate proxies that intentionally strip Range headers is currently untested and remains an edge case.**Decision:** Standardize on Range based resumption for all files larger than 10MB to guarantee delivery.**Reusable Lesson:** HTTP 206 resumption relies critically on the server explicitly returning Access-Control-Expose-Headers: Content-Range during the initial CORS preflight. Without this specific configuration, the browser client cannot verify the resumption offset, causing the download to fail permanently.**Evidence Identity:** exp-net-206-resume-001 (Git Commit SHA binding the experiment receipt).

#### **Works cited**

> 1. Cloudflare R2 pricing: zero egress, storage & operations, [https://egresscost.com/cloudflare/](https://egresscost.com/cloudflare/)  
> 2. Cloudflare R2 Pricing vs AWS S3, Azure, GCS (2026) \- shattered.io, [https://shattered.io/cloudflare-r2-vs-aws-s3-pricing-2026/](https://shattered.io/cloudflare-r2-vs-aws-s3-pricing-2026/)  
> 3. R2 pricing \- Cloudflare Developer Docs, [https://developers.cloudflare.com/r2/pricing/](https://developers.cloudflare.com/r2/pricing/)  
> 4. Ed25519 Support in Chrome: Making the Web Faster and Safer, [https://ipfsfoundation.org/ed25519-support-in-chrome-making-the-web-faster-and-safer-2/](https://ipfsfoundation.org/ed25519-support-in-chrome-making-the-web-faster-and-safer-2/)  
> 5. SubtleCrypto: verify() method \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify)  
> 6. SubtleCrypto: sign() method \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign)  
> 7. FileSystemFileHandle: createSyncAccessHandle() method \- Web APIs, [https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle)  
> 8. OPFS \- A Real File System in the Browser \- Apurv Khare, [http://apurvkhare.com/articles/frontend/web-storage/opfs](http://apurvkhare.com/articles/frontend/web-storage/opfs)  
> 9. WebRTC data channels always use the default SCTP window size, [https://bugzilla.mozilla.org/show\_bug.cgi?id=1051685](https://bugzilla.mozilla.org/show_bug.cgi?id=1051685)  
> 10. Performance Evaluation of WebRTC Data Channels, [https://tuhat.helsinki.fi/ws/portalfiles/portal/167373638/Eskola\_webrtc.pdf](https://tuhat.helsinki.fi/ws/portalfiles/portal/167373638/Eskola_webrtc.pdf)  
> 11. 206 Partial Content \- HTTP \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/206](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/206)  
> 12. 206 Partial Content \- The Status Code, [https://www.thestatuscode.com/2xx/206](https://www.thestatuscode.com/2xx/206)  
> 13. CORS support for HTTP Range Requests on dataset files, [https://discuss.huggingface.co/t/cors-support-for-http-range-requests-on-dataset-files/172172](https://discuss.huggingface.co/t/cors-support-for-http-range-requests-on-dataset-files/172172)  
> 14. Cross-Origin Resource Sharing (CORS) \- Cloudflare Docs, [https://developers.cloudflare.com/cache/cache-security/cors/](https://developers.cloudflare.com/cache/cache-security/cors/)  
> 15. Getting IIS to serve any file type \- Info Support, [https://www.infosupport.com/getting-iis-to-serve-any-file-type/](https://www.infosupport.com/getting-iis-to-serve-any-file-type/)  
> 16. mimeMap Element for staticContent \[IIS Settings Schema\], [https://learn.microsoft.com/en-us/previous-versions/iis/settings-schema/ms689529(v=vs.90)](https://learn.microsoft.com/en-us/previous-versions/iis/settings-schema/ms689529\(v=vs.90\))  
> 17. Adding MIME types \- C1 CMS, [https://docs.c1.orckestra.com/Configuration/Adding-MIME-types](https://docs.c1.orckestra.com/Configuration/Adding-MIME-types)  
> 18. Add Mime Types to an app (web.config manipulation) | OutSystems, [https://www.outsystems.com/forums/discussion/72311/factory-configuration-how-to-add-mime-types-to-an-app-web-config-manipulatio/](https://www.outsystems.com/forums/discussion/72311/factory-configuration-how-to-add-mime-types-to-an-app-web-config-manipulatio/)  
> 19. How to serve static files (for CORS / OPTION request) in IIS?, [https://stackoverflow.com/questions/28200507/how-to-serve-static-files-for-cors-option-request-in-iis](https://stackoverflow.com/questions/28200507/how-to-serve-static-files-for-cors-option-request-in-iis)  
> 20. Configure CORS · Cloudflare R2 docs, [https://developers.cloudflare.com/r2/buckets/cors/](https://developers.cloudflare.com/r2/buckets/cors/)  
> 21. WebAssembly Crypto in 2026: Benchmarking Browser Encryption, [https://bitatlas.com/blog/wasm-crypto-browser-performance-2026](https://bitatlas.com/blog/wasm-crypto-browser-performance-2026)  
> 22. Memory64: Unlocking WebAssembly's True Potential with 16GB of, [https://www.scichart.com/blog/memory64-unlocking-webassemblys-true-potential-with-16gb-of-in-browser-memory/](https://www.scichart.com/blog/memory64-unlocking-webassemblys-true-potential-with-16gb-of-in-browser-memory/)  
> 23. Origin private file system \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API/Origin\_private\_file\_system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)  
> 24. How to Handle Files Synchronously in the Browser | R3gardless.dev, [https://r3gardless.dev/en/blog/2026-03-20-sync-file-handling-in-browser/](https://r3gardless.dev/en/blog/2026-03-20-sync-file-handling-in-browser/)  
> 25. The Current State Of SQLite Persistence On The Web: May 2026, [https://powersync.com/blog/sqlite-persistence-on-the-web](https://powersync.com/blog/sqlite-persistence-on-the-web)  
> 26. Streams Standard, [https://streams.spec.whatwg.org/](https://streams.spec.whatwg.org/)  
> 27. Storage quotas and eviction criteria \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/Storage\_API/Storage\_quotas\_and\_eviction\_criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)  
> 28. Safari storage quota accuracy · Issue \#40394 · mdn/content \- GitHub, [https://github.com/mdn/content/issues/40394](https://github.com/mdn/content/issues/40394)  
> 29. Supercharged OPFS Database with RxDB, [https://rxdb.info/rx-storage-opfs.html](https://rxdb.info/rx-storage-opfs.html)  
> 30. Cloudflare R2 Pricing 2026: Free Tier, Costs & Raff Comparison, [https://rafftechnologies.com/learn/compare/raff-object-storage-vs-cloudflare-r2](https://rafftechnologies.com/learn/compare/raff-object-storage-vs-cloudflare-r2)  
> 31. \[help\] Fetch and ReadableStream : r/Deno \- Reddit, [https://www.reddit.com/r/Deno/comments/16v8lsn/help\_fetch\_and\_readablestream/](https://www.reddit.com/r/Deno/comments/16v8lsn/help_fetch_and_readablestream/)
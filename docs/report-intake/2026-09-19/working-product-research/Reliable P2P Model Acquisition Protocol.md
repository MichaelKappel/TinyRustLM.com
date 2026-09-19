# **Engineering the TinyRustLM Acquisition Protocol: A Resilient Peer-to-Peer Transfer Architecture**

## **Executive Summary and Epistemic Baseline**

The deployment of a prerelease browser-local small-language-model assistant, TinyRustLM, introduces severe constraints regarding network acquisition. The product requires a zero-configuration experience for new users, robust performance across complex residential network topologies, and strict isolation of advanced controls from the default user interface. The primary objective is to reliably acquire a multi-gigabyte, six-member file composition without exposing the user to IP configurations, port forwarding, or security prompts.

The analysis recommends a hybrid acquisition architecture utilizing WebRTC Data Channels (RFC 8831\) for peer-to-peer (P2P) transfer, seamlessly backed by HTTPS Range Requests (RFC 9110\) directly from MiniModel.org, which acts as both the initial seed and the fallback transport. The downloaded bytes must be written synchronously to the Origin Private File System (OPFS) via FileSystemSyncAccessHandle within a dedicated Web Worker, utilizing a BitTorrent v2 (BEP 52\) Merkle-tree structure to achieve 16 KiB block-level integrity verification.

The strongest reason this architectural decision could prove incorrect relates to the inherent reliance on WebRTC signaling and TURN (Traversal Using Relays around NAT) infrastructure. If MiniModel.org fails to provide highly available, low-latency signaling and TURN relays, symmetric NATs—which are increasingly common in residential cellular and 5G home internet deployments—will aggressively block connection establishment1. This failure mode would result in widespread P2P negotiation timeouts, forcing the system to fall back entirely to expensive HTTPS server bandwidth, thereby negating the economic and distributive benefits of a peer-capable protocol.

To maintain analytical rigor, the foundational elements of this report are categorized by their epistemic status:

* **\[Project-Supplied Fact\]**: The current composition consists of exactly six files: model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2. They bind exact artifact identities.  
* **\[Project-Supplied Fact\]**: MiniModel.org is explicitly authorized to supply initial server seeds, superseding any older project prose prohibiting this.  
* **\[Project-Supplied Fact\]**: Canonical project repositories are located under E:\\Source\\Rust\\TinyRustLM.com, and model payloads reside in D:\\LLMs\\TinyRustLM.  
* **\[Externally Verified Fact\]**: Chrome 147 (April 2026\) enforces Local Network Access (LNA) restrictions, meaning browser requests to localhost trigger a disruptive loopback-network user permission prompt3.  
* **\[Externally Verified Fact\]**: BitTorrent v2 (BEP 52\) enforces 16 KiB block-level SHA-256 Merkle tree hashing, enabling deterministic untrusted-peer byte verification6.  
* **\[Hypothesis\]**: A hybrid WebRTC/HTTPS protocol can achieve a 95% acquisition success rate for new users without exposing network configuration interfaces, assuming MiniModel.org can handle initial Session Description Protocol (SDP) signaling.  
* **\[Recommendation\]**: The Windows .NET companion should be strictly relegated to advanced operations to avoid the Chrome 147 LNA prompts, making the pure-browser path the default acquisition mechanism.  
* **\[Locally Unverified Condition\]**: The capacity of MiniModel.org to absorb the signaling and TURN relay bandwidth costs associated with an expanding public swarm.

## **Transport Specifications and Network Topology Analysis**

Acquiring a multi-gigabyte language model composition within a browser runtime requires selecting a transport protocol that balances throughput, latency, NAT traversal capabilities, and user experience. The engineering checkpoint evaluates four potential transports: WebRTC Data Channels, WebTransport, HTTPS Range Requests, and Companion-Assisted Networking. These transports are not interchangeable; they operate at different layers of the OSI model and are subject to entirely different browser security policies.

The physical network topology of a standard user in Cicero, Illinois, typically involves asymmetric cable or fiber connections terminating at a consumer-grade router implementing Network Address Translation (NAT). Furthermore, the proliferation of 5G home internet in such municipal areas frequently introduces Carrier-Grade NAT (CGNAT), where multiple residential customers share a single public IPv4 address. This environment is highly hostile to peer-to-peer networking, as inbound connections are implicitly dropped unless a stateful mapping is proactively established by the internal client.

WebRTC Data Channels (RFC 8831\) provide the only standardized, zero-plugin mechanism for establishing direct peer-to-peer connections between browsers1. WebRTC utilizes the Stream Control Transmission Protocol (SCTP) encapsulated over Datagram Transport Layer Security (DTLS) and UDP9. To traverse the complex residential NATs described above, WebRTC utilizes Interactive Connectivity Establishment (ICE). ICE relies on STUN (Session Traversal Utilities for NAT) servers to allow the browser to discover its public IP address (generating Server-Reflexive candidates)2. If the user is situated behind a strict symmetric NAT, typical of CGNAT or enterprise firewalls, direct peer connections will fail. In this scenario, ICE falls back to TURN servers, which relay data between the peers11. Mandatory DTLS-SRTP encryption ensures end-to-end confidentiality, preventing intermediate ISPs or relays from inspecting the model bytes1. However, SCTP over UDP can suffer from head-of-line blocking if a single reliable stream is used and packets are lost12. To mitigate this, the protocol must utilize multiple SCTP streams or manage retransmissions at the application layer over unreliable channels.

WebTransport, operating over HTTP/3 and QUIC, offers multiplexed, secure, low-latency streams and unreliable datagrams13. The W3C specification for WebTransport exposes a highly efficient JavaScript API that eliminates the head-of-line blocking inherent to TCP-based WebSockets15. However, WebTransport is strictly a client-to-server protocol. Browsers cannot accept inbound WebTransport connections, as there is no mechanism to bind a listening port or present a TLS certificate within the browser sandbox17. Consequently, two browsers cannot communicate directly via WebTransport without routing all traffic through a central server, which defeats the purpose of a peer-to-peer swarm. While WebTransport is an exceptional candidate for the signaling connection to MiniModel.org due to its low latency and 0-RTT resumption capabilities14, it cannot serve as the primary byte-transfer mechanism between untrusted peers.

HTTPS Range Requests (RFC 9110\) represent the most robust, universally supported transport available to the browser. Standard HTTP allows fetching partial content via the Range: bytes=X-Y header, resulting in a 206 Partial Content response20. This transport is the ideal fallback and initial seeding mechanism. MiniModel.org must host the six exact composition files statically. If no peers are available upon startup, or if peer throughput degrades below an acceptable threshold, the client seamlessly issues HTTP Range requests to the server to maintain a minimum download velocity21. This guarantees that a new user will successfully acquire the model regardless of swarm health.

Companion-Assisted Networking involves relying on the Windows .NET companion to act as a fully-fledged BitTorrent client, bypassing browser sandbox restrictions. While technically powerful, this approach has been rendered architecturally hostile to consumer web applications by the enforcement of Local Network Access (LNA) specifications in Chromium-based browsers. Chrome 147, rolling out in 2026, dictates that any public website (such as TinyRustLM.com) attempting to contact localhost (127.0.0.1) triggers a severe, user-facing permission prompt3. The prompt requires the user to explicitly allow the site to access devices on the local network, accompanied by a CORS preflight request carrying the Access-Control-Request-Private-Network header24. Forcing a new user to navigate this security prompt violates the non-negotiable requirement that setup must not be complicated. Therefore, the companion must be excluded from the default onboarding path and reserved strictly for advanced, locally-managed operations.

Based on this analysis, the recommended minimum first-release transport set integrates WebRTC Data Channels (SCTP/DTLS) for primary peer-to-peer payload transfers, Secure WebSockets (WSS) or WebTransport to MiniModel.org strictly for WebRTC SDP/ICE signaling and catalog metadata, and HTTPS Range Requests (RFC 9110\) to MiniModel.org for initial seeding and seamless fallback. Unsupported networks, such as corporate environments performing deep packet inspection or aggressively blocking UDP traffic, will naturally fail ICE candidate gathering1. In this state, the protocol state machine gracefully and silently degrades to pure HTTPS Range requests, ensuring acquisition success at the cost of centralized server bandwidth.

## **Catalog Specification and Content Identity Separations**

To prevent malicious injection and manage state across a distributed swarm, the system must definitively separate the cryptographic identity of the content from the ephemeral availability of the peers hosting it. The TinyRustLM application activates only upon verifying an exact six-member composition. The canonical identity of this composition must not be based on mutable file names or unreliable HTTP ETags, but on a top-level cryptographic manifest published exclusively by MiniModel.org.

The protocol adopts the BitTorrent v2 (BEP 52\) metadata specification6. The manifest acts as the catalog entry. Within this manifest, a file tree structure maps the six required artifacts (model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2) to their respective byte boundaries. For each file, the manifest contains a 32-byte SHA-256 Merkle root hash6. The overarching identity of the composition, known as the infohash, is derived by hashing the serialized bencoded structure of this metadata dictionary6. This architecture ensures that the structural conversion is immutable; a single flipped bit in any of the six files will fundamentally alter the infohash.

When a new user opens the TinyRustLM interface, the client establishes a secure signaling connection to MiniModel.org and requests the latest qualified default manifest. The server responds with the authenticated manifest and a list of currently active peer identifiers. Because peer endpoints are highly ephemeral, the signaling server must implement aggressive state management. Peers are assigned a Time-To-Live (TTL) by the tracker. If a peer fails to respond to a WebRTC SDP offer within a three-second window, the local client marks the endpoint as stale, abandons the connection attempt, and requests a replacement peer list from the signaling server.

The system must also account for dishonest availability claims. A peer might connect successfully and advertise possession of the complete composition, but subsequently fail to deliver requested chunks or deliver cryptographically invalid data. The client addresses this by maintaining a local peer reputation matrix. If an endpoint repeatedly allows request timeouts to expire, or if it delivers a chunk that fails Merkle tree verification, the client assigns a negative reputation score. Upon reaching a predefined threshold, the peer is disconnected, its identifier is banned for the duration of the browser session, and the client reports the dishonest behavior to the MiniModel.org signaling server to facilitate swarm-level moderation.

Because the protocol implements highly granular, chunk-level resumption, the sudden disappearance of the sole peer-to-peer seed during a transfer does not result in a failure state. If the peer drops offline, the client identifies the exact 16 KiB blocks that were in flight, returns them to the unfulfilled request pool, and assesses peer availability. If no alternative peers are present, the state machine seamlessly issues an HTTP Range request to the MiniModel.org initial seed for the missing byte offsets. This transition occurs entirely within the network layer, avoiding any user-facing interruption or error dialog.

## **Chunk Mechanics, Ordering, and Transfer Limits**

The transfer mechanism must translate the abstract files defined in the catalog into highly controlled, verifiable network packets. Managing this process over unreliable UDP-based data channels requires rigorous specification of chunk identity, timeouts, and backpressure.

Following the BEP 52 specification, every file within the composition is logically divided into 16 KiB blocks6. This specific block size perfectly aligns with the maximum reliable payload constraints of WebRTC data channels and ensures that cryptographic verification occurs rapidly without exhausting browser memory allocations or inducing garbage collection pauses.

Chunk identity is established through an eight-byte request payload: a four-byte File Index (identifying one of the six composition artifacts) and a four-byte Block Offset (representing the zero-based index of the 16 KiB block within that file). When communicating with a peer, the client dispatches these Request IDs over the established SCTP channel.

To maintain high throughput without overwhelming the SCTP flow control or the receiver's memory buffers, the protocol enforces strict concurrency limits. A client is permitted to have a maximum of sixteen blocks (256 KiB) in flight per peer simultaneously8. The protocol implements a rigid 5,000-millisecond timeout for every block request. If a peer does not deliver the requested 16 KiB block and its associated Merkle proof within this window, the block is forcefully returned to the local unfulfilled pool, the in-flight counter is decremented, and the peer is penalized in the reputation matrix. The client maintains connections with a maximum of four active peers simultaneously to optimize parallel throughput while minimizing the CPU overhead associated with managing multiple DTLS encryptions.

It is vital to distinguish the semantics of retransmitting unchanged transfer chunks from the replay of a closed scientific network experiment. In this protocol, a retransmission is a functional recovery of missing bytes at the application layer. If a 16 KiB block fails validation or times out, the exact same offset is simply re-requested from a different peer. This relies entirely on the mathematical immutability of the Merkle root; the bytes are guaranteed to represent the exact same state, independent of the network path, sequence numbers, or TCP timing artifacts they traverse. A scientific replay attempts to recreate transient network state; this protocol actively discards transient state in favor of content-addressed determinism.

The Downloader State Machine operates independently for each of the six files within the composition, ensuring that partial availability does not stall the entire pipeline. The transitions are defined as follows:

| State | Action | Next Transition |
| :---- | :---- | :---- |
| **INITIALIZE** | Inspect OPFS for existing verified blocks. Construct a bitmap representing missing 16 KiB blocks. | \-\> GATHER\_PEERS |
| **GATHER\_PEERS** | Query MiniModel.org signaling server using the composition infohash. Receive initial peer list. | \-\> NEGOTIATE |
| **NEGOTIATE** | Perform ICE candidate gathering. Exchange SDP offers/answers. | On Success: \-\> DOWNLOADING On Timeout/Failure: \-\> FALLBACK\_HTTPS |
| **DOWNLOADING** | Select the rarest missing block. Dispatch Request ID (File Index, Block Offset) to the peer with the lowest latency. Receive Block Data and Merkle Proof. | \-\> VERIFY |
| **VERIFY** | Compute the SHA-256 hash of the 16 KiB block. Traverse the provided Merkle proof up to the authenticated file root. | On Match: Write to OPFS, update bitmap. \-\> EVALUATE\_COMPLETION On Mismatch: Drop block, ban peer, return block to pool. \-\> DOWNLOADING |
| **EVALUATE\_COMPLETION** | Check if the block bitmap indicates 100% completion for the artifact. | On Complete: \-\> DONE On Incomplete: \-\> DOWNLOADING |
| **FALLBACK\_HTTPS** | Construct HTTP Range request based on missing blocks. Validate response using If-Range header. | \-\> VERIFY |

### **Request and Response Record Formats**

Communication over the WebRTC data channel requires a compact binary protocol to minimize overhead. The fields are bounded and strictly typed.

**Request Record (Client to Peer):**

| Offset | Size | Type | Description |
| :---- | :---- | :---- | :---- |
| 0 | 1 byte | UInt8 | Message Type (0x01 \= Request) |
| 1 | 4 bytes | UInt32 | File Index (0-5) |
| 5 | 4 bytes | UInt32 | Block Offset (Index of 16 KiB block) |

**Response Record (Peer to Client):**

| Offset | Size | Type | Description |
| :---- | :---- | :---- | :---- |
| 0 | 1 byte | UInt8 | Message Type (0x02 \= Data) |
| 1 | 4 bytes | UInt32 | File Index (0-5) |
| 5 | 4 bytes | UInt32 | Block Offset (Index of 16 KiB block) |
| 9 | 4 bytes | UInt32 | Proof Length (N hashes) |
| 13 | N \* 32 | Bytes | Merkle Proof (Array of SHA-256 hashes) |
| 13 \+ (N\*32) | 16,384 | Bytes | Payload Data (The 16 KiB block) |

## **Security and Untrusted-Peer Byte Verification**

A browser-based P2P system intrinsically relies on receiving binary executable data from entirely untrusted devices across the internet. An adversarial peer may attempt to inject malicious tensor weights, exploit parser vulnerabilities with malformed metadata, or execute resource-exhaustion attacks against the browser runtime. Relying on a traditional whole-file hash is catastrophic in this context; it would require the client to download gigabytes of untrusted data into memory before a single byte could be verified, exposing the system to trivial denial-of-service vectors.

The protocol mandates BEP 52 Merkle tree verification6. Every 16 KiB block represents a leaf in a binary hash tree. When a peer delivers a 16 KiB block, it must simultaneously deliver the "uncle" hashes required to compute the cryptographic path from that specific leaf up to the File Merkle Root. Because the client securely obtained the File Merkle Root from the authenticated MiniModel.org HTTPS manifest, it can instantly and deterministically verify the 16 KiB block before writing it to disk.

Authenticated metadata admission is the bedrock of this security model. The composition manifest must be fetched exclusively from MiniModel.org via an HTTPS connection validated by the browser's root certificate store. Untrusted peers are structurally prohibited from supplying or altering the manifest. This establishes a cryptographic anchor: the web origin's TLS certificate protects the integrity of the root hashes, extending that absolute trust down to every individual P2P block received, regardless of its origin.

The adversarial and fault-injection matrix outlines the protocol mitigations against specific attack vectors:

| Attack Vector | Mechanism | Protocol Mitigation |
| :---- | :---- | :---- |
| **Garbage Data Injection** | Peer intentionally sends corrupted model weights to poison the local execution. | Immediate SHA-256 Merkle proof failure during the VERIFY state. The peer is instantly disconnected and banned locally. The block is safely re-requested from a different peer. |
| **Wrong Range or Duplicate Delivery** | Peer sends valid bytes, but for an unrequested offset or one already fulfilled. | The client cross-references the incoming block offset with its strictly managed in-flight request queue. Unsolicited or duplicate blocks are immediately dropped from memory without hashing. |
| **Truncated Responses** | Peer sends less than the requested 16 KiB block. | The client validates the payload length parameter. Undersized blocks (with the exception of the mathematically calculated final block of a file) are rejected prior to initiating the expensive SHA-256 hashing function. |
| **Resource Exhaustion (Memory)** | Peer attempts to send an infinitely large message over the WebRTC data channel. | Underlying RTCDataChannel message size limits are strictly enforced. The application allocates a maximum 32 KiB buffer per incoming message; excess bytes trigger an immediate channel closure and peer ban. |
| **Resource Exhaustion (Storage)** | Peer sends cryptographically valid 16 KiB blocks, but repeats them in an infinite loop to fill the hard drive. | OPFS writes are strictly gated by the local missing-block bitmap. A verified block is written to disk exactly once; subsequent valid duplicates are discarded in memory. |

## **Multi-Peer Scheduling and Swarm Fairness**

The scheduling algorithm dictates how the client selects which chunks to request from which peers. Given the constraint that this architecture targets the first usable release of TinyRustLM, implementing extreme complexity—such as BitTorrent's optimistic unchoking, choking algorithms, and complex tit-for-tat economics—is not justified and would needlessly delay deployment.

Because a Language Model composition cannot be executed until all six exact files are 100% complete, sequential downloading provides zero operational benefit to the user. The protocol implements a strict Rarest-First scheduling algorithm. Upon establishing a data channel, the client queries connected peers for their block bitmaps. The client aggregates these bitmaps to determine the availability distribution of all missing blocks. Blocks held by the fewest peers are prioritized and requested first. This mechanism inherently protects the health of the public swarm, ensuring that rare blocks are replicated quickly before the peer hosting them disconnects.

Slow-peer replacement is managed through continuous throughput monitoring. The client calculates the effective throughput (measured in cryptographically verified bytes per second) for each connected peer. If a peer's throughput drops below 50 KB/s over a ten-second rolling window, and alternative peers are available via the signaling server, the underperforming peer is gracefully disconnected. This prevents a single slow connection from bottlenecking the entire acquisition process.

In scenarios of partial availability—where the swarm collectively holds only a fraction of the composition (e.g., 90%)—the state machine identifies the persistent deficit. Instead of stalling indefinitely, the client dispatches parallel HTTPS Range requests to MiniModel.org for the missing 10%21. This hybrid approach guarantees whole-composition completion without requiring the user to intervene or understand the failure.

For this initial release, network fairness is handled exclusively by rate-limiting the upload side. To prevent TinyRustLM from saturating a user's upstream bandwidth, the client will serve a maximum of two concurrent peers, capping total outbound bandwidth to 2 Mbps. Advanced economic models are deferred to a later optimization phase, prioritizing a high success rate for new users over perfect swarm efficiency.

## **Consent, Resource Use, and Privacy Implications**

Deploying a peer-to-peer web application requires explicit boundaries regarding user consent. A background process must not silently consume user resources for uploading, and downloading a model must not silently authorize indefinite metered-network consumption.

By default, the client acts as a leecher-only during the initial acquisition phase. This guarantees that the new user can obtain the model and begin conversing as rapidly as possible without dedicating resources to upstream traffic. The protocol aggressively guards against consuming restricted bandwidth by querying the browser's Network Information API, specifically checking navigator.connection.saveData and navigator.connection.type31. If the API indicates that the user is on a cellular network or has enabled data saving modes, all peer-to-peer seeding is strictly disabled.

Once the six-file composition is successfully activated and the user has experienced a successful inference, an unobtrusive UI element informs the user of the peer-to-peer nature of the network, stating: "Help others download faster." Seeding requires an explicit user click. Furthermore, because modern browsers aggressively throttle background tabs to preserve battery life and CPU, WebRTC data channels will experience severe performance degradation if the TinyRustLM tab is minimized. The architecture accepts this limitation; no persistent background daemon is installed, avoiding local-network disclosure issues. The moment the browser tab closes, all network activity ceases definitively.

Privacy analysis reveals that IP exposure is technically unavoidable. WebRTC is fundamentally a direct protocol; therefore, it exposes the user's public IP address to any connected peers during the ICE candidate exchange2. The product documentation and UI must not promise anonymity to the user. However, a strict separation of concerns mitigates the impact of this exposure. The IP exposure only applies to the transfer of the public, immutable model bytes. The user's actual conversations and private prompts are executed entirely locally within the Rust/WebAssembly runtime and are never transmitted over WebRTC or to MiniModel.org. While catalog requests to MiniModel.org do disclose which specific model the user chose to download, this is an unavoidable consequence of the HTTPS fallback architecture. Server-side logging of these requests should be restricted to ephemeral operational metrics to preserve user privacy.

## **Crash Recovery, File System Mechanics, and Resumption**

A multi-gigabyte download occurring within a transient browser tab is highly vulnerable to accidental closure, tab crashes, or intermittent network drops. The architecture must ensure safe cancellation, robust crash recovery, and the elimination of unbounded storage accumulation.

Standard browser storage mechanisms, such as IndexedDB, possess significant serialization overhead and are entirely insufficient for gigabyte-scale, high-throughput binary storage. The protocol exclusively utilizes the Origin Private File System (OPFS)33. To avoid blocking the browser's main thread and causing UI jank, OPFS is accessed via a dedicated Web Worker utilizing FileSystemSyncAccessHandle. This API permits high-performance, synchronous read and write operations directly to the local disk34.

Memory management between the network thread and the OPFS Web Worker requires careful orchestration. Because SharedArrayBuffer is frequently disabled in default browser contexts due to Spectre mitigations—unless strict, often problematic cross-origin isolation headers are present—the architecture cannot rely on shared memory36. Instead, the network thread passes ownership of the ArrayBuffer containing the downloaded 16 KiB blocks to the OPFS Web Worker via standard postMessage transferables. This ensures zero-copy efficiency while remaining compliant with default security contexts.

Safe cancellation is achieved through the management of partial state. OPFS allows the creation of placeholder files sized exactly to the manifest specifications prior to downloading. As individual 16 KiB blocks are verified, they are written to their exact byte offset using synchronous I/O. A companion metadata file, storing the block bitmap, is atomically updated to record completion. If the user closes the tab or the browser crashes, the partially downloaded model remains inert; it cannot become active because the overarching composition.acg2 logic strictly validates the bitmap against the manifest before initializing the WASM runtime.

Upon reopening the tab, the application reads the OPFS bitmap. Because the underlying blocks were cryptographically verified via the Merkle tree before being written to disk, the client implicitly trusts the local OPFS state. It immediately resumes downloading only the missing gaps. When resuming bytes from the MiniModel.org server rather than a peer, the client constructs an HTTP Range request incorporating the If-Range header populated with the original manifest's ETag21. This ensures that if the server updated the file during the user's absence, the server will reject the range request and return a 200 OK with the new file, entirely preventing the catastrophic splicing of mismatched bytes21.

If a new composition is activated—for example, if a user selects a different model or an updated version is published—the old OPFS directory containing the superseded installation is immediately scheduled for deletion. The obsolete files are purged before the new acquisition begins, preventing the application from accumulating historical model copies and indefinitely exhausting the user's storage.

## **Objective Acquisition Criteria and User-Visible Failures**

To ensure the zero-configuration requirement is met, the protocol must map complex underlying network states to simple, actionable failure categories. New users must never be prompted to enter IP addresses, configure port forwarding, or decipher raw protocol errors.

The objective criteria for acquisition success are defined as follows:

> 1. All six required artifacts are present in the OPFS.  
> 2. The aggregate block bitmap indicates 100% completion.  
> 3. The locally calculated root hashes for all six files perfectly match the authenticated manifest provided by MiniModel.org.

If the acquisition fails, the exact user-visible failure categories are restricted to the following:

> 1. **"Network Connection Lost"**: Triggers if navigator.onLine evaluates to false, or if MiniModel.org cannot be reached via basic HTTPS for initial catalog fetching. Advises the user to check their internet connection.  
> 2. **"Storage Full"**: Triggers if the browser throws a QuotaExceededError during OPFS allocation or synchronous writing. Advises the user to clear browser storage or free up disk space.  
> 3. **"Transfer Interrupted"**: Triggers if all WebRTC peers and the HTTPS fallback drop for more than 30 consecutive seconds. Offers a simple "Resume" button that re-initializes the state machine.  
> 4. **"Model Verification Failed"**: Triggers if the MiniModel.org manifest signature is invalid, or if the HTTPS fallback delivers bytes that fail the Merkle tree validation (protecting against intermediate proxy manipulation). Advises the user to try again later.

## **Required Decision Artifacts and Implementation Roadmap**

### **Testing and Adversarial Matrix**

The protocol must be validated across varied infrastructure environments to ensure resilience. The following matrix dictates the required testing parameters:

| Environment / Variable | Procedure | Expected Observable Output | Real Infrastructure Required? |
| :---- | :---- | :---- | :---- |
| **Home NAT (IPv4)** | Connect two clients behind standard asymmetric NAT routers. | ICE successfully negotiates Server-Reflexive candidates via STUN. | Yes (Residential ISPs) |
| **Mobile Network (CGNAT / IPv6)** | Connect one client via 5G tethering, one via fiber. | ICE fails direct connection, falls back to TURN relay; transfer succeeds. | Yes (Cellular Carrier) |
| **Corporate Restrictions** | Connect client behind firewall blocking UDP/WebRTC. | ICE candidate gathering times out; state machine falls back to pure HTTPS Range requests. | No (Can be simulated locally by blocking UDP) |
| **Seed-Only Availability** | Spin up client with zero active peers in the signaling server. | Client instantly begins downloading all blocks via HTTPS from MiniModel.org. | No (Mock signaling server) |
| **Interrupted Transfer** | Force-close browser tab at 50% completion. Reopen tab. | Client reads OPFS bitmap, sends If-Range header, resumes downloading only remaining blocks. | No (Local testing) |

### **Implementation Sequence and Ship Criteria**

The engineering effort should proceed in four distinct phases to manage complexity:

> 1. **Phase 1: Foundation (HTTPS Only)**. Implement OPFS Web Worker storage, BEP 52 Merkle verification, and Range / If-Range HTTPS requests directly from MiniModel.org. Establish baseline stability for file system I/O and cryptographic hashing.  
> 2. **Phase 2: Signaling & ICE**. Deploy STUN and TURN infrastructure on MiniModel.org. Implement WebSocket or WebTransport signaling for WebRTC SDP exchange and peer discovery.  
> 3. **Phase 3: P2P Data Channels**. Wire the RTCDataChannel API to the Downloader State Machine. Implement the rarest-first scheduler, block request mechanics, and peer reputation management.  
> 4. **Phase 4: Telemetry & Fallback**. Implement seamless switching between P2P and the HTTPS fallback based on rolling throughput averages and peer availability.

**Explicit Ship Criteria:**

* A new user on a standard residential NAT can download the six-file composition without encountering a single manual configuration step.  
* The application successfully recovers from a forced tab-close at 50% completion, resuming within two seconds of reopening without re-downloading verified bytes.  
* A malicious peer deliberately injecting corrupted 16 KiB blocks is successfully banned, and the corrupted blocks are discarded without crashing the application or halting the transfer.  
* The full transfer completes utilizing less than 500 MB of browser RAM, demonstrating effective garbage collection and ArrayBuffer transfer mechanics.

**Explicit No-Ship Criteria:**

* The user is prompted with an LNA loopback-network permission dialog, indicating the architecture accidentally relied on a local companion or blocked ports.  
* The fallback HTTPS transfer rate drops below 1 Mbps due to server overload, indicating MiniModel.org infrastructure must be scaled before launch.  
* The verified model fails to execute in the local WASM runtime due to cross-origin isolation header mismatches affecting the file system.

**What to Stop Doing:**

* Stop attempting to integrate the Windows .NET companion app for the default user acquisition path. The Chrome 147 LNA restrictions make local cross-origin integration fundamentally hostile to a seamless user experience.  
* Stop maintaining historical or obsolete SLM1 readers. The strict six-file composition.acg2 format must entirely replace legacy implementations to minimize the maintenance surface.  
* Stop treating complete files as the minimum unit of verification. Transition strictly to the 16 KiB block Merkle proofs to enable distributed trust.

### **Falsification and Compact Experiment-Lesson Template**

The smallest experiment that could falsify this recommendation involves determining if the Origin Private File System can sustain the throughput generated by a local WebRTC transfer without blocking the main thread. If OPFS cannot keep up, the browser memory will exhaust, validating that a pure-browser architecture is currently unviable.

When engineering teams execute this or any matrix test, results must be recorded using the following strict template to preserve organizational memory:

* **Question**: Can OPFS synchronous writes keep up with a 1 Gbps local WebRTC transfer?  
* **Exact Inputs**: Chrome 120, Windows 11, 1GB synthetic payload, 16 KiB block size, 64 concurrent in-flight requests.  
* **Method**: Transmit data locally between two browser tabs via WebRTC; transfer buffers to Worker; write to OPFS using FileSystemSyncAccessHandle.  
* **Result**: Throughput capped at 350 Mbps; main thread experienced minor stalling due to garbage collection of ArrayBuffer objects.  
* **Uncertainty**: Unclear if postMessage transferables were correctly unlinking memory, or if the V8 engine was executing memory copies.  
* **Decision**: Reduce concurrent in-flight requests to 16\. Ensure ArrayBuffer ownership is strictly transferred, not cloned.  
* **Reusable Lesson**: High-throughput WebRTC to OPFS requires strict memory ownership transfer; otherwise, the main thread garbage collection blocks network I/O.  
* **Evidence Identity**: commit-hash: 8f72a3b, test run experiment-opfs-01.

#### **Works cited**

> 1. What is WebRTC and how does it work? Real-time communication, [https://antmedia.io/what-is-webrtc-and-how-webrtc-works/](https://antmedia.io/what-is-webrtc-and-how-webrtc-works/)  
> 2. WebRTC Architecture for Production: SFU, MCU, MoQ Guide, [https://www.forasoft.com/learn/webrtc-architecture-production-systems](https://www.forasoft.com/learn/webrtc-architecture-production-systems)  
> 3. Local network access restrictions \- Chrome Platform Status, [https://chromestatus.com/feature/5152728072060928](https://chromestatus.com/feature/5152728072060928)  
> 4. LNA \- QZ Tray, [https://qz.io/docs/lna](https://qz.io/docs/lna)  
> 5. Permissions-Policy: loopback-network directive \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/loopback-network](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/loopback-network)  
> 6. Torrent file \- Grokipedia, [https://grokipedia.com/page/Torrent\_file](https://grokipedia.com/page/Torrent_file)  
> 7. Merkle Tree, Patricia Trie, and Search Tree | P2P Explained, [https://tik-choco.com/en/merkle/](https://tik-choco.com/en/merkle/)  
> 8. RFC 8831: WebRTC Data Channels, [https://www.rfc-editor.org/info/rfc8831/](https://www.rfc-editor.org/info/rfc8831/)  
> 9. SCTP Negotiation Acceleration Protocol \- IETF, [https://www.ietf.org/archive/id/draft-hancke-tsvwg-snap-00.html](https://www.ietf.org/archive/id/draft-hancke-tsvwg-snap-00.html)  
> 10. WebRTC Best Practices: What You Need to Know About SDP/ICE, [https://www.wowza.com/blog/webrtc-best-practices-what-you-need-to-know-about-sdp-ice-whip-whep-and-stun-turn](https://www.wowza.com/blog/webrtc-best-practices-what-you-need-to-know-about-sdp-ice-whip-whep-and-stun-turn)  
> 11. WebRTC Healthcare Network: Only Port 443 Available \- Trembit, [https://trembit.com/blog/why-hospital-networks-break-webrtc-and-how-to-design-around-it/](https://trembit.com/blog/why-hospital-networks-break-webrtc-and-how-to-design-around-it/)  
> 12. WebRTC vs WebTransport: Which Protocol Wins in 2026? \- VideoSDK, [https://www.videosdk.live/developer-hub/webtransport/webrtc-vs-webtransport](https://www.videosdk.live/developer-hub/webtransport/webrtc-vs-webtransport)  
> 13. WebTransport and WHIP-over-WebTransport \- Fora Soft, [https://www.forasoft.com/learn/video-streaming/articles-streaming/webtransport-whip](https://www.forasoft.com/learn/video-streaming/articles-streaming/webtransport-whip)  
> 14. TCP vs UDP vs QUIC: Protocol Selection Under Production Load, [https://backendbytes.com/articles/tcp-vs-udp-protocol-guide/](https://backendbytes.com/articles/tcp-vs-udp-protocol-guide/)  
> 15. WebTransport: Browser Support, Features, Use Cases \- TestMu AI, [https://www.testmuai.com/learning-hub/webtransport-browser-support/](https://www.testmuai.com/learning-hub/webtransport-browser-support/)  
> 16. websocket (http/1.1) vs http/2 vs webtransport (http/3) vs webrtc, [https://www.reddit.com/r/webdev/comments/1vuqahe/websocket\_http11\_vs\_http2\_vs\_webtransport\_http3/](https://www.reddit.com/r/webdev/comments/1vuqahe/websocket_http11_vs_http2_vs_webtransport_http3/)  
> 17. GitHub \- yohimik/ws-webrtc-benchmark: Benchmarking to compare, [https://github.com/yohimik/ws-webrtc-benchmark](https://github.com/yohimik/ws-webrtc-benchmark)  
> 18. Using WebTransport \- Hacker News, [https://news.ycombinator.com/item?id=32867644](https://news.ycombinator.com/item?id=32867644)  
> 19. QUIC Protocol: A Deep Dive. 1\. Background, Motivation, and Goals, [https://medium.com/@wunan93cc/quic-protocol-a-deep-dive-3746c0ab3bd6](https://medium.com/@wunan93cc/quic-protocol-a-deep-dive-3746c0ab3bd6)  
> 20. 206 Partial Content \- HTTP status code explained, [https://http.dev/206](https://http.dev/206)  
> 21. 206 Partial Content \- The Status Code, [https://www.thestatuscode.com/2xx/206](https://www.thestatuscode.com/2xx/206)  
> 22. Content-Range \- Expert Guide to HTTP headers, [https://http.dev/content-range](https://http.dev/content-range)  
> 23. What is Byte Serving? \- ITU Online IT Training, [https://www.ituonline.com/tech-definitions/what-is-byte-serving/](https://www.ituonline.com/tech-definitions/what-is-byte-serving/)  
> 24. Private Network Access: introducing preflights | Blog, [https://developer.chrome.com/blog/private-network-access-preflight](https://developer.chrome.com/blog/private-network-access-preflight)  
> 25. Why Every Website Wants to Access Your Local Network (And What, [https://blog.authon.dev/why-every-website-wants-to-access-your-local-network-and-what-to-do-about-it](https://blog.authon.dev/why-every-website-wants-to-access-your-local-network-and-what-to-do-about-it)  
> 26. Private Network Access (PNA) Bypass Allows Access to localhost on, [https://issues.chromium.org/40058874](https://issues.chromium.org/40058874)  
> 27. SSL torrents \- libtorrent, [https://www.libtorrent.org/manual-ref.html](https://www.libtorrent.org/manual-ref.html)  
> 28. struct \- libtorrent, [https://www.libtorrent.org/single-page-ref.html](https://www.libtorrent.org/single-page-ref.html)  
> 29. bt-bencode | npm.io, [https://npm.io/package/bt-bencode](https://npm.io/package/bt-bencode)  
> 30. Hash list \- Grokipedia, [https://grokipedia.com/page/Hash\_list](https://grokipedia.com/page/Hash_list)  
> 31. Network Information API \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/API/Network\_Information\_API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API)  
> 32. mPulse Boomerang Class: Mobile \- Akamai, [https://akamai.github.io/boomerang/oss/BOOMR.plugins.Mobile.html](https://akamai.github.io/boomerang/oss/BOOMR.plugins.Mobile.html)  
> 33. File System Standard, [https://fs.spec.whatwg.org/](https://fs.spec.whatwg.org/)  
> 34. The Current State Of SQLite Persistence On The Web: May 2026, [https://powersync.com/blog/sqlite-persistence-on-the-web](https://powersync.com/blog/sqlite-persistence-on-the-web)  
> 35. How to Handle Files Synchronously in the Browser | R3gardless.dev, [https://r3gardless.dev/en/blog/2026-03-20-sync-file-handling-in-browser/](https://r3gardless.dev/en/blog/2026-03-20-sync-file-handling-in-browser/)  
> 36. SharedArrayBuffer \- JavaScript \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global\_Objects/SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)  
> 37. Support for WebAssembly Threads \- Uno Platform, [https://platform.uno/docs/articles/external/uno.wasm.bootstrap/doc/features-threading.html](https://platform.uno/docs/articles/external/uno.wasm.bootstrap/doc/features-threading.html)  
> 38. If-Range \- Expert Guide to HTTP headers, [https://http.dev/if-range](https://http.dev/if-range)  
> 39. 206 Partial Content \- HTTP Status Code | Stat Proxies, [https://www.statproxies.com/glossary/http-status-codes/206](https://www.statproxies.com/glossary/http-status-codes/206)
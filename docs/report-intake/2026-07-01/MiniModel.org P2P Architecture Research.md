# **Architectural Blueprint for MiniModel.org: A Decentralized Peer-to-Peer Exchange for Local AI Models**

The proliferation of Small Language Models (SLMs) and edge-optimized artificial intelligence represents a paradigm shift in computational deployment. As machine learning models become increasingly compact and efficient, the reliance on centralized, cloud-based inference and storage infrastructures introduces unnecessary latency, immense bandwidth costs, and severe vulnerabilities regarding data privacy and platform censorship. MiniModel.org is conceptualized to address these systemic inefficiencies by establishing a decentralized, Rust-first peer-to-peer (P2P) exchange specifically tailored for local AI model packages. The non-negotiable architectural imperative of this system is strict decentralization: under no circumstances will the core system host, serve, or execute model weights on centralized proprietary servers. Instead, the infrastructure must empower users to seamlessly discover, download, cryptographically verify, and import AI models—standardized under the proprietary .slm extension—entirely within their local environments.  
Designing a decentralized infrastructure of this magnitude requires the meticulous selection and orchestration of networking protocols, Network Address Translation (NAT) traversal mechanisms, chunking strategies, and cryptographic trust models. The system must operate reliably across diverse user environments, functioning seamlessly behind highly restrictive corporate firewalls, within lightweight browser runtimes, and via headless server daemon implementations. The following report provides an exhaustive, multi-dimensional analysis of the optimal architectural foundation for MiniModel.org. It meticulously compares leading Rust-native P2P frameworks, proposes a comprehensive Minimum Viable Product (MVP) architecture, defines a robust multi-tiered trust model, formulates a deterministic NAT traversal strategy, and establishes a multi-platform deployment strategy spanning CLI, desktop, and web integrations.

## **The Core Networking Layer: Comparative Analysis of Rust-Native P2P Frameworks**

The foundational layer of MiniModel.org requires a high-performance, asynchronous networking stack capable of locating remote peers, establishing secure direct connections, multiplexing data streams, and handling the inherent unreliability of distributed nodes. The Rust ecosystem provides three primary pathways for this implementation: the mature but highly complex rust-libp2p stack, dedicated BitTorrent protocol implementations such as rqbit and cratetorrent, and the emerging, highly optimized Iroh framework.

### **Rust-libp2p: High Modularity and Consequent Complexity**

rust-libp2p serves as the standard specification for modular peer-to-peer networking stacks and has been historically utilized by major decentralized systems, including IPFS, Ethereum, and Polkadot.1 The defining characteristic of libp2p is its extreme modularity; it provides a vast array of pluggable protocols for transport mechanisms (TCP, QUIC, WebSockets), stream multiplexing (Yamux, Mplex), cryptographic security handshakes (Noise, TLS), and peer discovery (Kademlia DHT, mDNS).2  
However, libp2p's extensive configurability acts as a substantial double-edged sword when deploying a targeted, consumer-facing file-sharing application.3 Building a reliable P2P architecture requires developers to manually wire together these disparate modules, leading to a steep learning curve and a high probability of misconfiguration.3 For instance, establishing a successful direct connection through restrictive firewalls in libp2p requires the manual orchestration of the Direct Connection Upgrade through Relay (DCUtR) protocol, AutoNAT for address reachability detection, and a predefined network of Circuit Relay v2 nodes.5 Empirical data and developer testimonials suggest that libp2p's DCUtR achieves approximately a 60% success rate for direct connection establishment, struggling significantly when symmetric NATs or endpoint-dependent mapping firewalls are involved, ultimately forcing the system to fall back on highly resource-intensive central relays.1  
Furthermore, because libp2p attempts to "boil the ocean" by supporting a massive array of legacy transport protocols, its core architecture often suffers from abstraction overhead.10 Maintaining a DHT, reliable synchronization, and transport protocols concurrently within the libp2p ecosystem is a monumental engineering undertaking that frequently results in systems remaining in a perpetual prototype state.10

### **BitTorrent Implementations: Bulk Data Transfer Legacies**

BitTorrent remains the globally proven standard for decentralized P2P file sharing, relying on a distributed network of seeders and leeches coordinated via tracker servers and the Mainline Distributed Hash Table (DHT).11 Rust implementations of the protocol, such as cratetorrent and rqbit, provide the requisite building blocks for parsing .torrent metadata, exchanging pieces with peers, and leveraging HTTP/UDP trackers for peer discovery.13 Advanced clients like rqbit offer memory-efficient caching using ARC algorithms and asynchronous I/O driven by the Tokio runtime, while cratetorrent focuses on implementing the core BitTorrent V1 protocol with future milestones aimed at V2 compatibility.13  
While BitTorrent is undeniably effective for bulk data transfer, its foundational protocol architecture presents severe limitations for a modern, programmatic AI exchange like MiniModel.org. The BitTorrent V1 protocol lacks native stream multiplexing, relies heavily on unencrypted or weakly encrypted TCP connections, and utilizes coarse-grained SHA-1 hashing.11 This coarse hashing mechanism complicates the incremental verification of data at a highly granular level, which is critical when distributing executable or memory-mapped AI tensor files. Furthermore, integrating BitTorrent within a seamless, embedded desktop or web application requires substantial overhead in managing tracker lifecycle states, managing swarm topologies, and implementing custom choking/unchoking algorithms manually.13

### **Iroh: Deterministic Connections and QUIC-Native Architecture**

Iroh represents a modern, highly focused evolution in P2P networking. The development team—many of whom are former IPFS and libp2p engineers—deliberately discarded the modular complexity of libp2p in favor of a tightly focused, opinionated stack optimized strictly for establishing direct, reliable connections.4 Built natively on the noq QUIC implementation, Iroh provides authenticated end-to-end encryption, concurrent multiplexed streams with built-in priority management, and the complete elimination of head-of-line blocking out of the box.17  
The paramount advantage of Iroh over both libp2p and BitTorrent is its deterministic approach to NAT traversal and connection establishment. Drawing architectural inspiration from Tailscale, Iroh achieves a roughly 90% success rate in establishing direct connections across diverse, real-world network conditions.3 It abstracts the complexities of hole punching entirely; dialing a peer by their public Ed25519 NodeId automatically triggers a cascade of direct connection attempts, coordinated reflective lookups via a shared relay, and seamless connection upgrades without any manual user configuration.18 When direct connections fail entirely due to insurmountable network topology, Iroh provides a zero-configuration fallback to an encrypted relay network, ensuring that data transmission is always successful.3

| Feature Dimension | rust-libp2p | BitTorrent (Rust Crates) | Iroh |
| :---- | :---- | :---- | :---- |
| **Transport Protocol** | Pluggable (TCP, QUIC, WebSocket) | Primarily TCP, uTP | Native QUIC (noq) |
| **NAT Traversal** | DCUtR, AutoNAT (\~60% success rate) | UPnP, manual port forwarding | Tailscale-style hole punching (\~90% success rate) |
| **Cryptographic Identity** | PeerId (Multihash format) | Infohash (SHA-1 legacy) | NodeId (Ed25519 Public Key) |
| **Multiplexing** | Yamux / Mplex (requires abstraction overhead) | None at the protocol level | Native QUIC streams |
| **Relay Fallback** | Manual Circuit Relay v2 setup required | None (fails if ports are closed) | Automatic, encrypted DERP-style relays |
| **Developer Complexity** | High (steep learning curve, explicit wiring) | Medium (manual swarm state management) | Low (opinionated, functional out-of-box) |

**Architectural Recommendation:** MiniModel.org must adopt **Iroh** as its core networking layer. The absolute necessity of a seamless user experience—where non-technical AI developers can download and share models without configuring router port forwards or managing DHT routing tables manually—makes Iroh's 90% NAT traversal success rate and automated relay fallback indispensable.18 Integrating libp2p-iroh wrappers or attempting to rebuild NAT traversal over TCP would severely delay the MVP and degrade connection reliability.1

## **Advanced NAT Traversal Strategy and Connectivity Assurance**

A decentralized exchange designed to distribute multi-gigabyte machine learning models will rapidly collapse if peers cannot efficiently route data directly to one another. The vast majority of end-users typically reside behind Carrier-Grade NAT (CGNAT) deployed by ISPs, or restrictive corporate firewalls that explicitly block inbound traffic.1 Relying solely on centralized relays for the transmission of massive AI models would incur prohibitive bandwidth costs for the MiniModel organization and severely bottleneck the network. Therefore, MiniModel.org will leverage Iroh's sophisticated traversal pipeline to guarantee connectivity while strictly maximizing direct P2P throughput.1

### **The Mechanics of Simultaneous Outbound Hole Punching**

When a MiniModel client attempts to download an .slm file from a remote seeder, both peers initially establish a connection to a shared Iroh relay server using persistent, multiplexed connections (often traversing over standard HTTPS/WebSocket ports to effortlessly bypass egress filtering and deep packet inspection).18 The relay server serves a vital dual purpose: it acts as a low-latency control plane to coordinate the hole punching process, and it passively observes the "reflective address" (the external public IP and port mapped by the edge router's NAT) of each connecting client.18  
Once these reflective addresses are exchanged via the secure relay channel, both endpoints execute a simultaneous outbound connection protocol.18 By transmitting UDP datagrams to each other's reflective addresses at precisely the same moment, the state tables of both endpoints' NAT routers register an outbound 5-tuple (source IP, source port, destination IP, destination port, protocol).7 When the incoming packets from the remote peer arrive, the local NAT perceives them as legitimate, expected responses to the freshly initiated outbound traffic, effectively "punching a hole" through the firewall and establishing a direct, high-bandwidth UDP/QUIC path.7 As soon as this direct path is confirmed, the relay connection is gracefully stepped back, and all subsequent data flows purely peer-to-peer.18

### **Encrypted Relay Fallback for Symmetric NATs**

In approximately 10% of real-world networking scenarios—typically involving highly restrictive symmetric NATs that assign randomized, unpredictable external ports for every distinct destination IP—simultaneous hole punching will deterministically fail.8 In these specific scenarios, libp2p typically drops the connection or requires explicit UPnP mapping.8 Iroh, conversely, provides a robust, automatic fallback mechanism.18  
Upon detecting a hole-punching failure, the clients seamlessly shift the QUIC datagram routing over the pre-established WebSocket connection to the Iroh relay server.20 Crucially, the relay server operates entirely blindly.20 It acts as a rudimentary packet router, forwarding UDP datagrams tunneled inside the HTTP connections based solely on destination NodeId tags.20 Because the QUIC protocol inherently encapsulates the TLS 1.3 cryptographic handshake, all application-layer data—including the model weights and associated metadata—remains strictly end-to-end encrypted.20 The relay cannot read, inspect, or tamper with the payload, preserving the strict zero-trust requirement of the MiniModel infrastructure.22

## **Data Chunking, Verification, and the .slm Format**

Distributing monolithic AI models across a trustless, decentralized network presents a severe vulnerability: if a peer downloads a 4GB model file and only verifies the SHA-256 hash upon completion, a single maliciously modified byte from an attacker results in the entire payload being discarded, wasting immense bandwidth, time, and computational resources. MiniModel.org must implement incremental data verification and a structured file format that guarantees instant execution and total safety upon completion.

### **BLAKE3 Verified Streaming via Iroh-Blobs**

Instead of attempting to reinvent chunk exchange algorithms from scratch, MiniModel.org will utilize iroh-blobs, a specialized protocol layer designed explicitly for transferring content-addressed data over QUIC using BLAKE3 verified streaming.23  
Within this architecture, a model file is not treated as a monolithic, opaque entity, but rather as a highly structured binary tree of cryptographic hashes. The BLAKE3 algorithm splits the input model data into uniform chunks—defaulting to 1 KiB blocks—and arranges them as the leaves of a Merkle-like binary tree.25 The intermediate chunk hashes recursively accumulate upward to produce a single 32-byte Root Hash, which serves as the immutable, content-addressed Content Identifier (CID) for the entire .slm model.25  
During network transfer, the seeding node streams both the raw data chunks and the corresponding intermediate tree hashes across the QUIC connection.25 The receiving MiniModel client recalculates the hashes incrementally on the fly, verifying the data stream concurrently with the download.25 If a malicious or corrupted peer attempts to inject poisoned data, the mathematical verification will fail precisely at the 1 KiB boundary.28 This allows the receiver to instantly sever the connection, discard the malicious chunk, and request the valid chunk from an alternate peer.28 This protocol provides an exceptionally fast ![][image1] verification overhead while completely eliminating the coarse-grained vulnerabilities inherent to traditional BitTorrent piece hashing.28  
Furthermore, the iroh-blobs implementation natively supports arbitrary range requests based on the BLAKE3 topology.25 Because chunks are mapped algorithmically to the tree, a client can request specific byte ranges (e.g., retrieving only the metadata header of the model) without downloading the entire multi-gigabyte file, requiring only a minimal overhead of intermediate hashes to verify the requested subsequence.25

### **Multi-Provider Concurrent Downloading**

A critical requirement for acceptable user experience is the ability to saturate the user's download bandwidth. Relying on a single P2P provider creates severe bottlenecks if the seeder is on a slow connection. MiniModel.org will leverage the multi-provider concurrent downloading capabilities of the Iroh Downloader component.23  
Utilizing the SplitStrategy API within the Downloader, the MiniModel client orchestrates simultaneous fetching across a decentralized swarm.30 If five disparate peers hold the same .slm root hash, the client utilizes a ConnectionPool to divide the range requests across the active QUIC connections.32 By pulling different segments of the BLAKE3 tree concurrently, the client dramatically accelerates the retrieval of multi-gigabyte models, aggregating the outbound bandwidth of multiple seeders into a single, high-speed inbound stream.31

### **The .slm Package Structure and SafeTensors Integration**

The proprietary .slm file format utilized by MiniModel.org will not be a newly invented, untested serialization method, but rather a branded extension of the highly secure Hugging Face **SafeTensors** standard.33  
Historically, AI models were distributed using Python's pickle module (e.g., PyTorch .pt files).34 However, pickle files are fundamentally executable bytecodes; loading an untrusted .pt file from a decentralized network allows arbitrary remote code execution upon deserialization, rendering the P2P distribution of raw PyTorch models inherently dangerous and unacceptable for consumer applications.34  
SafeTensors entirely resolves this critical vulnerability by strictly decoupling metadata from the tensor data and stripping all executable capabilities.33 The format is mathematically constrained and divided into a contiguous layout:

1. **Header Integer:** An 8-byte unsigned little-endian 64-bit integer, ![][image2], representing the exact byte size of the subsequent JSON header.34  
2. **JSON Header:** An ![][image2]\-byte UTF-8 string containing the critical metadata (including tensor names, strictly defined data types such as F16 or BF16, multi-dimensional shapes, and absolute byte offsets pointing to the data payload).33  
3. **Raw Tensor Data:** The remainder of the file consists of a contiguous byte-buffer containing the multi-dimensional array weights, formatted strictly in C-contiguous (row-major) order, explicitly forbidding empty holes or unindexed bytes between data blocks.34

By mapping the .slm extension to the SafeTensors standard, MiniModel.org ensures that model weights can be distributed across a trustless P2P network with absolute safety. Furthermore, the separate JSON header interacts perfectly with Iroh-blobs range requests; a MiniModel client can download just the first ![][image3] bytes of a remote .slm file to inspect its architectural shape, parameter count, and hardware compatibility before committing massive bandwidth to retrieving the multi-gigabyte tensor buffer.33

### **Zero-Copy Execution via the Rust Candle Framework**

SafeTensors was specifically engineered to enable zero-copy loading, a feature that is highly synergistic with Rust's memory management paradigms. Using the memmap2 crate, the MiniModel client can map the downloaded .slm file directly into the operating system's virtual memory space without allocating additional RAM.35  
For local inference execution, the architecture will deeply integrate **Candle**, a minimalist Machine Learning framework written entirely in Rust by Hugging Face.38 Candle is designed to operate without the immense overhead of PyTorch, eliminating the Python Global Interpreter Lock (GIL) and enabling lightweight serverless inference.38 Candle natively integrates with SafeTensors via the VarBuilder::from\_mmaped\_safetensors API.36 When a user imports a downloaded .slm file, Candle reads the JSON metadata, constructs the neural network topology, and maps the tensor struct keys directly to the memory-mapped weights.36 This allows Candle to execute inference (utilizing CPU, CUDA, Metal, or WebGPU backend targets) without ever copying the raw bytes from the storage disk into active RAM, resulting in near-instantaneous model loading times regardless of the underlying file size.36

## **Peer Discovery, Identity, and the Trust Ecosystem**

In a completely decentralized network lacking centralized indexing servers, the architecture must resolve the dual challenges of peer discovery (locating which IP addresses hold a specific model) and establishing trust (cryptographically verifying that the model is authentic and non-malicious).

### **DHT Discovery via BitTorrent Mainline and Pkarr**

MiniModel.org will explicitly avoid bootstrapping a proprietary distributed hash table (DHT). Maintaining a DHT from scratch is a massive, highly complex undertaking susceptible to partition errors, routing loops, and eclipse attacks.10 Instead, the architecture will leverage the BitTorrent **Mainline DHT**, the largest, most battle-tested, and robust distributed network in existence, currently maintaining over 10 million active nodes globally.39  
To seamlessly integrate Iroh-based nodes with the Mainline DHT, the MiniModel client will implement **Pkarr** (Public-Key Addressable Resource Records).42 Pkarr utilizes BitTorrent's BEP44 specification to store mutable, cryptographically signed items within the DHT.39

1. **Identity Derivation:** A user's identity is defined by an Ed25519 cryptographic keypair. Their public key effectively serves as their decentralized, sovereign domain name.39  
2. **Record Publishing:** When a user wishes to seed a model, the MiniModel daemon generates a self-signed DNS-like packet containing their Iroh NodeId, IP routing addresses, and active ALPN protocols. This record is then published into the Mainline DHT via the Pkarr client.39  
3. **Peer Resolution:** When another client wishes to connect, they query the Mainline DHT for the specific public key associated with the seeder, retrieve the signed routing record, verify the cryptographic signature locally to ensure authenticity, and initiate the Iroh QUIC connection using the discovered addressing data.39

Because BEP44 records are inherently ephemeral and drop from the DHT after several hours to prevent state bloat, the local MiniModel daemon will periodically republish its addressing records to the network to maintain perpetual discoverability.39

### **Multi-Tiered Trust Model: Signed Catalogs vs. Static Registries**

Relying solely on 32-byte BLAKE3 root hashes for trust is insufficient; human users cannot memorize or effectively verify raw cryptographic hashes. Furthermore, malicious actors could pollute the network by naming a highly degraded or backdoored model Llama-3-8B-Instruct.slm.  
To solve this naming and trust resolution issue, MiniModel.org will employ a **Signed Catalog Architecture**, conceptually similar to OS-level driver update mechanisms like the Microsoft Update Catalog.45

* **Static Bootstrap Registries vs. Signed Catalogs:** A static bootstrap registry hardcodes model hashes into the client application binary. While highly secure, this requires releasing a new software update every time a new AI model is released, which is fundamentally unscalable. Conversely, a Signed Catalog allows dynamic updates without compromising security.45  
* **Catalog Mechanics:** The core MiniModel organization maintains a canonical, highly curated repository of verified models. Instead of hosting the multi-gigabyte .slm files themselves, the organization publishes a small, digitally signed JSON catalog file (e.g., minimodel-verified.json.sig) on high-availability web servers.45  
* **Cryptographic Mapping:** This catalog maps human-readable model names, version parameters, architecture specifications, and safety alignments directly to their verified BLAKE3 root hashes.  
* **Client Verification:** When the MiniModel client is installed, it ships with the organization's root public key permanently pinned in the binary. Upon launch, the client automatically syncs the latest signed catalog.45 The client verifies the digital signature; if valid, it inherently trusts the mapped BLAKE3 hashes within the catalog.45 Any alteration to the catalog—even a single modified byte—invalidates the signature, preventing man-in-the-middle injection attacks.45

### **Dynamic Discovery via Iroh-Gossip**

While the Signed Catalog secures official models, a decentralized exchange must also foster permissionless, community-driven discovery. For peer-to-peer discovery beyond the official catalog, the architecture will implement **Iroh-Gossip**.48  
Utilizing highly efficient epidemic broadcast trees based on the academic PlumTree and HyParView papers, Iroh-Gossip allows individual nodes to subscribe to specific topical channels (e.g., models/uncensored, models/experimental, models/loras).48 Peers actively broadcast newly published model hashes and descriptions to their immediate neighbors, who in turn propagate the message across the swarm. This creates a highly resilient, decentralized pub-sub network for discovering emerging, community-trained models in real-time, completely circumventing the need for a central indexing authority.50

## **Recommended MVP Architecture Lifecycle**

The culmination of these disparate protocols and cryptographic primitives results in a highly resilient, entirely decentralized Minimum Viable Product (MVP) architecture. The entire lifecycle of an .slm package operates without routing through a single centralized model server.

### **The Publishing Flow (Seeder Generation)**

1. An AI developer trains, fine-tunes, or quantizes a machine learning model and exports it using the SafeTensors library, renaming the output file to model.slm.51  
2. The developer imports the file into the local MiniModel application. The background iroh-blobs protocol mathematically chunks the file and calculates the 32-byte BLAKE3 root hash.25  
3. The local MiniModel daemon binds an Iroh endpoint and begins serving this root hash via the Iroh Router, explicitly listening on the iroh-blobs ALPN identifier.25  
4. The application announces its availability to the global network. It generates a BEP44 signed record containing its Iroh NodeId and current IP details, and publishes this record into the Mainline DHT via the Pkarr protocol.40  
5. If the model is an official release, its hash is submitted for inclusion in the organizational Signed Catalog. If it is a community-driven release, the hash and descriptive metadata are broadcast to the network via the Iroh-Gossip protocol.48

### **The Retrieval Flow (Consumer Execution)**

1. A user searches for an AI model via the MiniModel client interface. The client parses the verified Signed Catalog (or monitors the Gossip network) to resolve the human-readable model name to its immutable BLAKE3 root hash.  
2. The client invokes the iroh\_mainline\_content\_discovery module to query the Mainline DHT, discovering the specific NodeIds of remote peers currently seeding that exact BLAKE3 hash.16  
3. The client initiates Iroh QUIC connections to the discovered NodeIds. Iroh performs STUN-like reflection via shared relays and executes simultaneous hole punching to establish direct P2P connections.18 If hole punching fails due to symmetric NAT constraints, traffic seamlessly falls back to the encrypted relay tunnel.18  
4. The client utilizes the Iroh Downloader with a configured SplitStrategy to request concurrent byte-ranges from multiple connected peers simultaneously, maximizing bandwidth saturation.23  
5. As the 1 KiB chunks arrive over the QUIC streams, they are instantaneously cryptographically verified against the BLAKE3 Merkle tree structure.25  
6. Once the download completes and the root hash is mathematically satisfied, the .slm file is mapped directly into memory via the memmap2 crate and executed by the Rust Candle ML framework for local, high-performance inference.36

## **Application Ecosystem and Deployment Strategy**

To achieve widespread, mainstream adoption, MiniModel.org cannot exist merely as a complex, headless command-line daemon. It requires an ergonomic, highly accessible suite of applications spanning the terminal, the desktop operating system, and the web browser. The Rust-first mandate of the architecture enables immense, cross-platform code reuse across these environments.

| Target Platform | UI Technology | Core Logic Integration | P2P Networking Capability |
| :---- | :---- | :---- | :---- |
| **CLI** | clap crate, Terminal UI | Rust Native (Direct binary compilation) | Full (Iroh QUIC, Hole Punching, Relays) |
| **Desktop App** | Tauri 2.0 (React/Svelte) | Rust Backend via IPC Commands | Full (Iroh QUIC, Hole Punching, Relays) |
| **Web Browser** | WebAssembly (WASM) | wasm-bindgen | Limited (WebTransport, HTTP Relays) |

### **1\. The Core Rust Daemon (minimodel-core)**

The central nervous system of the architecture is a headless, platform-agnostic Rust crate (minimodel-core). This crate encapsulates the Iroh endpoint generation, the Mainline DHT tracker client, the BLAKE3 blob storage database, and the Candle inference engine integrations. By strictly separating the core networking and ML logic from the user interface, the exact same engine powers all distribution methods without duplicating effort.

### **2\. The Command Line Interface (CLI)**

The CLI acts as the primary tool for power users, backend developers, and automated headless servers. Compiled directly to native machine code, it offers the lowest possible latency and minimal memory overhead. Utilizing standard Rust parsing crates like clap, the CLI interacts directly with minimodel-core to execute commands such as minimodel fetch \<hash\>, minimodel serve./local-model.slm, and minimodel run \<hash\>.

### **3\. The Desktop Application via Tauri 2.0**

For mainstream users, expecting terminal proficiency is entirely unrealistic. MiniModel.org will deploy a cross-platform Graphical User Interface (GUI) desktop application utilizing the **Tauri 2.0** framework.53  
Unlike Electron frameworks, which bundle an entire Chromium instance and a heavyweight Node.js runtime resulting in massive bundle sizes (\~85MB) and high baseline memory consumption (\~120MB idle), Tauri leverages the operating system's native webview libraries (e.g., WebView2 on Windows, WebKit on macOS).54 This architectural decision results in remarkably lightweight binaries (\~2.5MB), sub-two-second startup times, and minimal memory footprint (\~80MB idle).54 This is paramount for an AI application, as it leaves crucial system RAM and VRAM entirely available for local model inference rather than UI rendering.54  
Within this architecture, the Tauri application consists of a modern web frontend (built with React, Vue, or Svelte) and a persistent Rust backend process.

* **Backend Daemon:** The src-tauri Rust binary runs the minimodel-core daemon continuously in the background, maintaining the persistent Iroh network connections, DHT routing tables, and handling the computationally heavy Candle ML execution.  
* **Inter-Process Communication (IPC):** The web frontend communicates with the Rust backend using Tauri Commands. Functions in Rust are explicitly annotated with the \#\[tauri::command\] macro, allowing the frontend JavaScript to invoke asynchronous operations like invoke('start\_download', { hash: "..." }) with strict type safety.55  
* **Streaming Data Events:** For continuous data streams, such as rendering download progress bars or streaming real-time token generation during LLM inference, the Rust backend utilizes the Tauri Event system. The backend emits JSON payloads (e.g., app.emit("download-progress", \&progress)) directly to the frontend event listeners, allowing responsive, reactive UI updates.56

### **4\. Browser Integration and Sandbox Limitations**

Bringing true P2P networking to the browser remains the final, most complex frontier, heavily constrained by severe browser security sandbox limitations. While the Iroh networking stack can be compiled to WebAssembly using the wasm32-unknown-unknown target and wasm-bindgen, raw TCP and UDP sockets are completely blocked in browser environments.57  
**Networking Workarounds and HTTP Relays:** Browsers cannot initiate arbitrary QUIC connections or perform traditional UDP hole punching.60 The modern web alternative is WebTransport, which is built on HTTP/3.59 However, WebTransport requires valid TLS certificates, which standard P2P nodes operating on residential IPs do not possess.60 Therefore, establishing direct browser-to-browser connections or browser-to-desktop connections without complex certificate management is currently infeasible in a pure P2P paradigm.  
To enable web users to interact with MiniModel.org without a local software installation, the architecture will utilize Pkarr HTTP Relays and Iroh WebSocket relays.3

* The browser client will query Pkarr nodes via the standard browser fetch() API to resolve addressing records from the DHT via HTTP proxies.43  
* The browser will connect to the broader Iroh network exclusively by dialing into public Iroh Relay servers via WebSockets, essentially tunneling the P2P traffic through the centralized proxy.3 While this compromises the pure P2P ethos slightly, it is a mandatory architectural concession for browser accessibility until WebTransport certificate constraints evolve.

**Inference in the Browser via WebGPU:** Once the .slm file is downloaded into the browser's virtual filesystem (utilizing the Origin Private File System for persistent storage), Candle can perform local inference. Because standard CPU execution within the WASM sandbox is notoriously slow and limited to 4GB of RAM, Candle provides an experimental backend utilizing **WebGPU**.61 Compiling Candle with the wgpu Rust crate allows the WASM application to bypass the CPU and dispatch highly parallelized tensor multiplication kernels directly to the user's local graphics card from within the browser sandbox.61 This enables near-native inference speeds for tiny SLM models directly on the web page, drastically lowering the barrier to entry.61

## **Failure Modes, Attack Vectors, and Resilience Strategies**

A decentralized architecture is inherently chaotic and hostile. Nodes go offline unpredictably, network topologies shift constantly, and malicious actors actively attempt to exploit vulnerabilities. The MiniModel architecture must proactively anticipate and mitigate these failure modes.

### **1\. The "Dead Torrent" Problem (Data Starvation)**

The most critical failure mode in any P2P network is data unavailability. If all active seeders of a specific .slm hash go offline, the model becomes completely inaccessible, fracturing the user experience.

* **Mitigation Strategy:** MiniModel.org will deploy community-funded "Seedboxes" or "Always-On Nodes." These headless server nodes will statically pin the BLAKE3 hashes listed in the official Signed Catalog, ensuring that critical foundation models and dependencies are always available. Unlike centralized hosting, these seeders operate transparently as standard network peers; if the organizational seedboxes go down, organic community peers will continue seeding the file seamlessly without interrupting the network fabric.

### **2\. Relay Exhaustion and CGNAT Lockout**

If an unexpectedly high percentage of users operate behind symmetric NATs or corporate firewalls that block UDP traffic, hole punching will fail frequently. This forces massive, multi-terabyte AI model data streams to route entirely through the Iroh fallback relays.18 This could rapidly exhaust the bandwidth capabilities of the public relay infrastructure, leading to massive network throttling.

* **Mitigation Strategy:** The architecture must empower users to easily self-host and configure custom Iroh relay servers.21 Corporate environments, university networks, or dedicated community groups could deploy local relays to handle heavy internal traffic routing, alleviating pressure on the global public relays. Furthermore, the multi-provider SplitStrategy algorithm explicitly prioritizes direct connections; if one connection degrades due to relay saturation, the Downloader shifts the block requests to peers with successful direct UDP connections.30

### **3\. Sybil Attacks and Mainline DHT Pollution**

Malicious actors could execute a Sybil attack by spinning up thousands of virtual nodes, publishing fraudulent Pkarr records to the Mainline DHT.39 These shadow nodes might claim to possess popular .slm files but serve garbage data, attempting a distributed denial-of-service (DDoS) attack on network bandwidth.

* **Mitigation Strategy:** The intrinsic mathematical properties of the iroh-blobs BLAKE3 verified streaming entirely nullify this attack vector.25 Because the incoming data stream is verified incrementally at the 1 KiB chunk level against the trusted root hash, garbage data is detected instantaneously upon packet arrival.28 The MiniModel client immediately drops the connection to the poisoned peer, blacklists its NodeId locally, and requests the missing chunk from a different peer. Furthermore, the Signed Catalog ensures that clients only ever query the DHT for cryptographically authenticated root hashes, completely preventing phishing attacks via deceptive or spoofed model names.45

### **4\. Storage Exhaustion via Malicious Gossip**

The Iroh-Gossip network, being a permissionless pub-sub system, is vulnerable to spam. Attackers could flood the models/experimental topic with thousands of massive, randomly generated model hashes, causing clients that automatically cache new models to exhaust their local disk space.48

* **Mitigation Strategy:** The architecture will enforce strict client-side validation on Gossip channels. The client will only ever automatically download the JSON header of a SafeTensors .slm file (the first ![][image3] bytes).33 It will parse the header to ensure the tensor shapes and parameter counts match the advertised description. The actual multi-gigabyte tensor payload will only be downloaded upon explicit manual approval by the user, entirely mitigating automated storage exhaustion attacks.

## **Conclusion**

The MiniModel.org architecture proposed in this exhaustive analysis provides a highly resilient, scalable, and fundamentally secure framework for the decentralized exchange of local AI models. By explicitly eschewing centralized hosting infrastructure in favor of Iroh's deterministic, QUIC-based peer-to-peer networking and Tailscale-inspired NAT traversal, the system guarantees high connectivity rates across even the most restrictive network topologies.  
The adoption of the BLAKE3-based iroh-blobs protocol ensures that multi-gigabyte models can be downloaded concurrently from multiple untrusted providers with mathematically proven incremental integrity. Packaging models in the robust SafeTensors standard completely prevents arbitrary code execution vulnerabilities, enabling the Rust-native Candle framework to achieve highly efficient, zero-copy inference execution directly on the edge. Finally, by anchoring organizational trust in Signed Catalogs and distributing the core logic through lightweight Tauri desktop binaries and WebGPU-accelerated browser environments, MiniModel.org successfully marries the absolute security and resilience of decentralized networks with the seamless, performant user experience expected of modern consumer software.

#### **Works cited**

1. Show HN: connet – A P2P reverse proxy with NAT traversal \- Hacker News, accessed June 30, 2026, [https://news.ycombinator.com/item?id=42575841](https://news.ycombinator.com/item?id=42575841)  
2. Playing with decentralized p2p network & Rust Libp2p Stacks | by Hiraq Citra M \- Medium, accessed June 30, 2026, [https://medium.com/lifefunk/playing-with-decentralized-p2p-network-rust-libp2p-stacks-2022abdf3503](https://medium.com/lifefunk/playing-with-decentralized-p2p-network-rust-libp2p-stacks-2022abdf3503)  
3. Comparing Iroh & Libp2p: Simplifying P2P Connectivity \- Iroh, accessed June 30, 2026, [https://www.iroh.computer/blog/comparing-iroh-and-libp2p](https://www.iroh.computer/blog/comparing-iroh-and-libp2p)  
4. What's relation of rust-libp2p and the libp2p in this project · n0-computer iroh · Discussion \#1277 \- GitHub, accessed June 30, 2026, [https://github.com/n0-computer/iroh/discussions/1277](https://github.com/n0-computer/iroh/discussions/1277)  
5. Iroh: peer-2-peer, but it works : r/rust \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/rust/comments/1hxlen4/iroh\_peer2peer\_but\_it\_works/](https://www.reddit.com/r/rust/comments/1hxlen4/iroh_peer2peer_but_it_works/)  
6. libp2p::tutorials::hole\_punching \- Rust \- Docs.rs, accessed June 30, 2026, [https://docs.rs/libp2p/latest/libp2p/tutorials/hole\_punching/index.html](https://docs.rs/libp2p/latest/libp2p/tutorials/hole_punching/index.html)  
7. Hole Punching \- libp2p, accessed June 30, 2026, [https://libp2p.io/docs/hole-punching/](https://libp2p.io/docs/hole-punching/)  
8. What's the state of dcutr? · libp2p rust-libp2p · Discussion \#5910 \- GitHub, accessed June 30, 2026, [https://github.com/libp2p/rust-libp2p/discussions/5910](https://github.com/libp2p/rust-libp2p/discussions/5910)  
9. NAT Traversal rust-libp2p, accessed June 30, 2026, [https://discuss.libp2p.io/t/nat-traversal-rust-libp2p/1316](https://discuss.libp2p.io/t/nat-traversal-rust-libp2p/1316)  
10. The Wisdom of Iroh \- LambdaClass Blog, accessed June 30, 2026, [https://blog.lambdaclass.com/the-wisdom-of-iroh/](https://blog.lambdaclass.com/the-wisdom-of-iroh/)  
11. Comparing Peer to Peer Protocols, accessed June 30, 2026, [https://blog.mauve.moe/posts/protocol-comparisons](https://blog.mauve.moe/posts/protocol-comparisons)  
12. Any resources to learn P2P Networking programming in Rust? \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/rust/comments/sctxrc/any\_resources\_to\_learn\_p2p\_networking\_programming/](https://www.reddit.com/r/rust/comments/sctxrc/any_resources_to_learn_p2p_networking_programming/)  
13. rbit \- Rust \- Docs.rs, accessed June 30, 2026, [https://docs.rs/rbit](https://docs.rs/rbit)  
14. vimpunk/cratetorrent: A BitTorrent V1 engine library for Rust (and currently Linux) \- GitHub, accessed June 30, 2026, [https://github.com/vimpunk/cratetorrent](https://github.com/vimpunk/cratetorrent)  
15. ikatson/rqbit: A bittorrent client in Rust \- GitHub, accessed June 30, 2026, [https://github.com/ikatson/rqbit](https://github.com/ikatson/rqbit)  
16. iroh\_mainline\_content\_discovery \- Rust \- Docs.rs, accessed June 30, 2026, [https://docs.rs/iroh-mainline-content-discovery](https://docs.rs/iroh-mainline-content-discovery)  
17. n0-computer/iroh: IP addresses break, dial keys instead. A library that adds QUIC \+ NAT Traversal to your apps. \- GitHub, accessed June 30, 2026, [https://github.com/n0-computer/iroh](https://github.com/n0-computer/iroh)  
18. NAT Traversal \- iroh, accessed June 30, 2026, [https://docs.iroh.computer/concepts/nat-traversal](https://docs.iroh.computer/concepts/nat-traversal)  
19. Libp2p-iroh \- PeerId based Dialing (behind any NAT) \- Ecosystem and Community, accessed June 30, 2026, [https://discuss.libp2p.io/t/libp2p-iroh-peerid-based-dialing-behind-any-nat/3672](https://discuss.libp2p.io/t/libp2p-iroh-peerid-based-dialing-behind-any-nat/3672)  
20. iroh on QUIC Multipath, accessed June 30, 2026, [https://www.iroh.computer/blog/iroh-on-QUIC-multipath](https://www.iroh.computer/blog/iroh-on-QUIC-multipath)  
21. Iroh: A library to establish direct connection between peers \- Hacker News, accessed June 30, 2026, [https://news.ycombinator.com/item?id=44379173](https://news.ycombinator.com/item?id=44379173)  
22. Relays \- Iroh Docs, accessed June 30, 2026, [https://docs.iroh.computer/concepts/relays](https://docs.iroh.computer/concepts/relays)  
23. iroh\_blobs \- Rust \- Docs.rs, accessed June 30, 2026, [https://docs.rs/iroh-blobs/latest/iroh\_blobs/](https://docs.rs/iroh-blobs/latest/iroh_blobs/)  
24. iroh-blobs \- crates.io: Rust Package Registry, accessed June 30, 2026, [https://crates.io/crates/iroh-blobs](https://crates.io/crates/iroh-blobs)  
25. Blobs \- Iroh Docs, accessed June 30, 2026, [https://docs.iroh.computer/protocols/blobs](https://docs.iroh.computer/protocols/blobs)  
26. The new BLAKE3 hazmat API \- Iroh, accessed June 30, 2026, [https://www.iroh.computer/blog/blake3-hazmat-api](https://www.iroh.computer/blog/blake3-hazmat-api)  
27. About the new plans · n0-computer iroh · Discussion \#707 \- GitHub, accessed June 30, 2026, [https://github.com/n0-computer/iroh/discussions/707](https://github.com/n0-computer/iroh/discussions/707)  
28. I am a contributor to Iroh ( https://github.com/n0-computer/iroh ), an open sour... | Hacker News, accessed June 30, 2026, [https://news.ycombinator.com/item?id=43690337](https://news.ycombinator.com/item?id=43690337)  
29. iroh\_blobs::protocol \- Rust \- Docs.rs, accessed June 30, 2026, [https://docs.rs/iroh-blobs/latest/iroh\_blobs/protocol/index.html](https://docs.rs/iroh-blobs/latest/iroh_blobs/protocol/index.html)  
30. iroh-blobs 0.90 \- New Request Types and Features, accessed June 30, 2026, [https://www.iroh.computer/blog/iroh-blobs-0-90-new-features](https://www.iroh.computer/blog/iroh-blobs-0-90-new-features)  
31. feat: multi-provider fan-in · Issue \#4 · n0-computer/iroh-blobs \- GitHub, accessed June 30, 2026, [https://github.com/n0-computer/iroh-blobs/issues/4](https://github.com/n0-computer/iroh-blobs/issues/4)  
32. iroh-blobs 0.95 \- New features, accessed June 30, 2026, [https://www.iroh.computer/blog/iroh-blobs-0-95-new-features](https://www.iroh.computer/blog/iroh-blobs-0-95-new-features)  
33. SafeTensors Format: A Guide to Secure ML Model Serialization \- DataCamp, accessed June 30, 2026, [https://www.datacamp.com/blog/safetensors-format](https://www.datacamp.com/blog/safetensors-format)  
34. safetensors \- Rust \- Docs.rs, accessed June 30, 2026, [https://docs.rs/safetensors/](https://docs.rs/safetensors/)  
35. dset \- Rust \- Docs.rs, accessed June 30, 2026, [https://docs.rs/dset](https://docs.rs/dset)  
36. Candle \- Hugging Face, accessed June 30, 2026, [https://huggingface.co/docs/transformers/community\_integrations/candle](https://huggingface.co/docs/transformers/community_integrations/candle)  
37. candle\_core::safetensors \- Rust \- Docs.rs, accessed June 30, 2026, [https://docs.rs/candle-core/latest/candle\_core/safetensors/index.html](https://docs.rs/candle-core/latest/candle_core/safetensors/index.html)  
38. huggingface/candle: Minimalist ML framework for Rust \- GitHub, accessed June 30, 2026, [https://github.com/huggingface/candle](https://github.com/huggingface/candle)  
39. GitHub \- pubky/pkarr: Public Key Addressable Resource Records (sovereign TLDs), accessed June 30, 2026, [https://github.com/pubky/pkarr](https://github.com/pubky/pkarr)  
40. Nuhvi/pkarr \- Public Key Addressable Resource Records \- GitHub, accessed June 30, 2026, [https://github.com/nuhvi/pkarr](https://github.com/nuhvi/pkarr)  
41. DHT \- iroh, accessed June 30, 2026, [https://docs.iroh.computer/connecting/dht-discovery](https://docs.iroh.computer/connecting/dht-discovery)  
42. pkarr \- crates.io: Rust Package Registry, accessed June 30, 2026, [https://crates.io/crates/pkarr](https://crates.io/crates/pkarr)  
43. pkarr \- Rust \- Docs.rs, accessed June 30, 2026, [https://docs.rs/pkarr](https://docs.rs/pkarr)  
44. Iroh global node discovery, accessed June 30, 2026, [https://www.iroh.computer/blog/iroh-global-node-discovery](https://www.iroh.computer/blog/iroh-global-node-discovery)  
45. Catalog Files and Digital Signatures \- Windows drivers | Microsoft Learn, accessed June 30, 2026, [https://learn.microsoft.com/en-us/windows-hardware/drivers/install/catalog-files](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/catalog-files)  
46. Microsoft update catalog gives non secure updates : r/Windows10 \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/Windows10/comments/rm2tay/microsoft\_update\_catalog\_gives\_non\_secure\_updates/](https://www.reddit.com/r/Windows10/comments/rm2tay/microsoft_update_catalog_gives_non_secure_updates/)  
47. FIX: Log reader agent generates access violation exception for P2P or transactional replication with partitioning tables in SQL Server \- Microsoft Support, accessed June 30, 2026, [https://support.microsoft.com/en-us/topic/kb4575939-fix-log-reader-agent-generates-access-violation-exception-for-p2p-or-transactional-replication-with-partitioning-tables-in-sql-server-7bc9c2e5-0124-d635-673f-55aa44e116b2](https://support.microsoft.com/en-us/topic/kb4575939-fix-log-reader-agent-generates-access-violation-exception-for-p2p-or-transactional-replication-with-partitioning-tables-in-sql-server-7bc9c2e5-0124-d635-673f-55aa44e116b2)  
48. n0-computer/iroh-gossip \- GitHub, accessed June 30, 2026, [https://github.com/n0-computer/iroh-gossip](https://github.com/n0-computer/iroh-gossip)  
49. Gossip Broadcast \- Iroh Docs, accessed June 30, 2026, [https://docs.iroh.computer/connecting/gossip](https://docs.iroh.computer/connecting/gossip)  
50. pubsub peer discovery protocol · Issue \#3649 · n0-computer/iroh \- GitHub, accessed June 30, 2026, [https://github.com/n0-computer/iroh/issues/3649](https://github.com/n0-computer/iroh/issues/3649)  
51. Safetensors \- Hugging Face, accessed June 30, 2026, [https://huggingface.co/docs/safetensors/index](https://huggingface.co/docs/safetensors/index)  
52. Iroh content discovery experiments, accessed June 30, 2026, [https://www.iroh.computer/blog/iroh-content-discovery](https://www.iroh.computer/blog/iroh-content-discovery)  
53. I built a local-first desktop app with Tauri 2.0 and Rust \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/tauri/comments/1pykzt6/i\_built\_a\_localfirst\_desktop\_app\_with\_tauri\_20/](https://www.reddit.com/r/tauri/comments/1pykzt6/i_built_a_localfirst_desktop_app_with_tauri_20/)  
54. Starting Desktop Application Development: An Introduction To Tauri \- DEV Community, accessed June 30, 2026, [https://dev.to/debajyotisarkarhome/starting-desktop-application-development-an-introduction-to-tauri-2095](https://dev.to/debajyotisarkarhome/starting-desktop-application-development-an-introduction-to-tauri-2095)  
55. Calling Rust from the Frontend \- Tauri, accessed June 30, 2026, [https://v2.tauri.app/develop/calling-rust/](https://v2.tauri.app/develop/calling-rust/)  
56. Calling the Frontend from Rust | Tauri, accessed June 30, 2026, [https://v2.tauri.app/develop/calling-frontend/](https://v2.tauri.app/develop/calling-frontend/)  
57. WebAssembly and Browsers \- Iroh Docs, accessed June 30, 2026, [https://docs.iroh.computer/languages/wasm-browser](https://docs.iroh.computer/languages/wasm-browser)  
58. Iroh & the Web, accessed June 30, 2026, [https://www.iroh.computer/blog/iroh-and-the-web](https://www.iroh.computer/blog/iroh-and-the-web)  
59. Build Web Assembly · Issue \#1803 · n0-computer/iroh \- GitHub, accessed June 30, 2026, [https://github.com/n0-computer/iroh/issues/1803](https://github.com/n0-computer/iroh/issues/1803)  
60. Tracking: WebAssembly support for iroh · Issue \#2799 · n0-computer/iroh \- GitHub, accessed June 30, 2026, [https://github.com/n0-computer/iroh/issues/2799](https://github.com/n0-computer/iroh/issues/2799)  
61. WebGPU support · Issue \#344 · huggingface/candle \- GitHub, accessed June 30, 2026, [https://github.com/huggingface/candle/issues/344](https://github.com/huggingface/candle/issues/344)  
62. LLMs running in the browser | Kevin Scott, accessed June 30, 2026, [https://thekevinscott.com/llms-in-the-browser/](https://thekevinscott.com/llms-in-the-browser/)  
63. WGPU suited for games running in the browser? : r/rust\_gamedev \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/rust\_gamedev/comments/1lwm4jo/wgpu\_suited\_for\_games\_running\_in\_the\_browser/](https://www.reddit.com/r/rust_gamedev/comments/1lwm4jo/wgpu_suited_for_games_running_in_the_browser/)  
64. Hashing multiple blobs with BLAKE3 \- Iroh, accessed June 30, 2026, [https://www.iroh.computer/blog/hashing-multiple-blobs-with-BLAKE3](https://www.iroh.computer/blog/hashing-multiple-blobs-with-BLAKE3)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAaCAYAAAD/nKG4AAAERklEQVR4Xu2XXaiURRjHn9BA0Uop8ANFjHOjHUHxW1ROoqKFIVIgaN1pXkRiH4p6syIhEohYUJYRXWRQgRdqigouFCUGioEkfhBFKBUpBQqSZf8f887Zeeed9+xuLscN9g8/lp2Zdz6eeZ5nZsw66uj/oqFiUFzYhnpEPBgX3oseFYvFs2KCGJCvLmiy+NDcRLwwHv08EJS1g2aIjy0/16bFouaL0+KIWJVxTFwS02tNcxojToonsv+TxK/irqiaM1q7abV41/6jh/HRTvGDFY1C3XvihpgS1WHg3aISlfPNAWtfYw0WB8WKuKKeWNg74ro5F02JUPxdvG35sOoWF7LfWB9Z+xoLrRRfW5PhuE78k/2Wabj4VpwXjwXlm8RhSyf2djfW4+KymBtXlKlLXBXfixFRXShvrB/FqKwMA2GoLb5RpDJjkfSfM/fdVEsfHvTdI5aLseJhsV5sFkNqzXpF/VJzbRHRMk0ss/J10c8JK59/QRVzifiNqDwWu3DN8sbil/9MKKXYWITvC+aM3iPGiTfFcTEya4M4WS+KHeYOGNpfEWvFT+YMHIr+94pt4mfxvLl8RPut4g+xsLd1XsyRk7Huic0gVXMhWNaZF/W0+1I8lJUx6V+s3I1jYy0yd0jM8w3MecCn5hZH0oWj4nMxMGtDEv5bLDA3drywJeJFc/O5ac5bfB7yG0q6SInyqhW9vyDfEYmbBN6X9pjzwEpQxuRSO+0VGsuHbJzzEBP+y5zR/Zz41gvPZexXgrJQa8zNH6PSz5NBnT+Yyr5lbDyXNNOn/MTC0EqJPMA96zer3aVQM8YibxBK/n8oJuyN4Y/0qtXaYYTbYnb2v0xsaLwZnHh8W+b9jM28yvJar+iUzvsyFi5PUmUxr0Z1zRjLj5XaRW8s8hN6Svwp3hcvm7v7vWTF8AtFeJIiwvDl9xNxysqvBw2Hoe/Mh0BK3LvIM1xK49suSZ+TlFMopdBYfiwSMDf+UBwujNGd/X/L3EnGqckm1l2IpcNtvLnxKuY8lgODPkMxNjkudcIWxI2cifKui41BQuXZssvcYLG8t5BcUwqNhRiLiy9PDS8mz/OKV4D3nH3mPIR3qYfwj+cXyuercNPJdbfMvUg4XOIrAuNxEhK+DYvOuJwxaf8e5G34nTmDlbk/5Rg5Hoy3IUc/oQUYyJ+2E8U34pD4wJyxX7e8IZ4Wd6z2vYecicelVBHnLO85/tLJWvZbMRRJB6z5mai8rrgY4srsIjsy2sqNFIoEyoBxHqqnYeaSauwteB+GnhOVE1JfWPlrgbJUuNI/EZC6+HJgcBmn734RO/mVubtOK0TOqVp64YRaQydXA8IRtmc04hQtE278maXzWrPiVk84bbC81xG+Z8RGa83iuswldsbrVzF58g60YiG88zAKRjubQY6baa3pn00g1+Kp90VM4DUxK65oQ3Hjb1Xa6KijjjpqO/0LR/za6xafiXsAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABHElEQVR4XmNgGAWUAkcgfg3E/6F4BxBzIsnzAfEuJHkQXgfE3EhqUAAjEM8C4l9A/BOILVGlwSAIiNcwoFqEFQgC8UIgzmeA2DyFAWIBMigC4mg0MaxAH4j7gVgSiK8D8RMgVkSSZwHi2VB1BAHIxnQou4EB4rocuCwDgwgDxOUgHxAEfUBsDGXrAPF7ID4BxPxQMRsgngxl4wWw8ALZDgIgLy0H4n9A7AEVA7mapPBCDnCQISDDQIaCYo+s8IIBkPdA3gR514mByPACuQYUFqboEkAQwwCJiGtA3IkmhxWghxcyEGeAJBOQgUSFF8gLoKzBhS4BBQ1A/BaINdHEUYALEH9hQOQ1UBbyRlEBAaBkAsqrBMNrFIyCIQMA260zNBT6yKgAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAaCAYAAAD8K6+QAAACSklEQVR4Xu2WTUgVURTH/1GLIlGiDxEFMVpUVC5aCS1DEcJVoCi4ddPKsKjVbFr0sbIgyFy0FEQRCcpVFLRoEy78QFpJBK2kRQtX9v93Znj3Xodm5r2XEdwf/MB35jrvnjn3nHlAJBI5KI7RUfqCPqIX6SFvxcFwin6ge6k79JK3AriTXsv8Si97K1La6AIdpx20l76nt/FvkhND9Ads44l/6Tdd9CM9H15wuUXvBzE9pc+0J4gXoYfyJAzWQUInYNXYoO3eVfueGXokiHu8og/hV0eVU2K6QRWu0qdhsCLH6UtYVZ7BqjbirQDG6GQQ28cD2D9Pw24qhulr2pItKkkzEjsLq8ZR2kd36RvYHMhQIa45n3Pppluw5L7AElUDK16VZiQ2SKfSv5WMklJySlKcoHPYfzxzuUC3UZs0Op6t3opyNCOxhF53PusYak86lmoX7fU5CvpL6CyrQmpWTcafsBtp6px01rnoC3RNveg6QGdz4lJHq4isvzqdmCqjAaJBomFWqr9U6mV614kp0SVYcpqYeZyhj2HvPddFupkTlzpiRbj95ZKgtp9S/aWpp/5SeV2ys60jWYVGj6LeX/fCIDlHv9Hv9C3sRf5HtJF12JMK0btNk7IKjSaWwO+vDB39bPTPo0R/aZyvwJ6S+x47Td+hNonK0khi+k5V40p4IUV72YXNglKozKuwBNWYqtQabJBU/UlVT2Lq10/wf//pHofdRbD20E+/wv5y0U20qZu0H7UXdVXqSey/QGP9RhiMRCKRSOQv8AsY8mxI7nUf5QAAAABJRU5ErkJggg==>
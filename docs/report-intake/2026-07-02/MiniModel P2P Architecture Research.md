# **Architecture and Governance Report: MiniModel.org Metadata-Only P2P Exchange**

## **System Context and the Teleodynamic AI Ecosystem**

The rapid expansion of machine learning has precipitated a critical divergence in model deployment strategies. While massive, centralized parameter networks dominate cloud infrastructure, a distinct engineering discipline has emerged focused on local, resource-bounded execution. This paradigm is encapsulated by the framework of "teleodynamic learning," which defines intelligence through five strict commitments: two adaptive timescales, an endogenous resource coupling, a local action objective, an emergent structural halt, and diagnosable phase structure1. A system adhering to these commitments operates within strictly bounded physical and computational environments, necessitating highly modular, compact neural architectures.  
The TinyRustLM application serves as the primary execution engine for this ecosystem. Operating as a browser-local Rust runtime, it utilizes a WebAssembly (Wasm) Application Binary Interface (ABI), a scalar transformer path, and traits engineered as ports to manage closed domains via explicit message passing2. However, distributing the model artifacts required for this ecosystem presents a fundamental challenge. Traditional centralization, wherein a single server provides gigabytes of tensor data, incurs unsustainable bandwidth costs and exposes the host to profound legal liabilities regarding copyright infringement.  
To resolve this bottleneck, the MiniModel.org architecture establishes a strictly metadata-only exchange. Operating under the absolute mandate that the server must never host, serve, proxy, or execute user model bytes, MiniModel.org functions solely as a cryptographic directory. The product lifecycle dictates that a developer downloads a source model from a conventional repository (such as the Hugging Face Hub), utilizes TinyRustLM to convert the artifact into the optimized .slm (SLM1) format, validates the structural integrity locally, and computes a cryptographic Merkle tree of the file2. The developer then publishes exclusively the signed metadata and the Merkle root to MiniModel.org. Subsequent users retrieve this metadata from the catalog endpoint and import the actual tensor bytes directly from consenting peers across a decentralized network.  
This report comprehensively details the architectural design, schema specifications, cryptographic verification mechanisms, and stringent legal compliance boundaries required to successfully deploy and govern MiniModel.org.

## **Architectural Topology and the Separation of Planes**

The fundamental security and legal posture of MiniModel.org relies on a strict bifurcation between the control plane and the data plane. The control plane manages identity, discovery, and cryptographic proofs, while the data plane manages the physical transmission of tensor weights.

# **\================================================================================ MINIMODEL.ORG DISTRIBUTED ARCHITECTURE**

\[ EXTERNAL REPOSITORIES \] \[ MINIMODEL.ORG (CONTROL PLANE) \] \+-----------------+ \+---------------------------+  
| Hugging Face / | | Static Host / CDN | | Source Registry | | \- No weight storage | \+--------+--------+ | \- Max payload \< 5MB |  
| (1) Source Download \+-------------+-------------+ v | (4) Publish \+-----------------------------------+ | Signed  
| PUBLISHER NODE (Peer A) | | Manifest | \+-----------------------------+ | v | | TinyRustLM Composer | | \+---------------------------+ | | \- SLM1 Converter | | | catalog/models.v0.json | | | \- Ed25519 Key Generator | | | \- Publisher PubKey | | | \- Merkle Tree Builder |--+ | \- SLM1 Schema & Meta | | \+-----------------------------+ | | \- Merkle Root Hash | | \[ Local SLM1 Model Bytes \] | | \- DHT/Tracker Pointers | \+-----------------^-----------------+ \+-------------+-------------+  
| | | (6) P2P Byte Transfer | (5) Discover | (WebRTC / libtorrent) | Metadata v v \+-----------------------------------+ \+---------------------------+  
| IMPORTER NODE (Peer B) | | MiniModel.MiRust.com | | \+-----------------------------+ | | \- Dev Docs & Governance | | | TinyRustLM Runtime | | | \- Abuse/Takedown Routes | | | \- P2P Client | | | \- Teleodynamic Research | | | \- Merkle Verifier \<--+ \+---------------------------+ | | \- Zero-Copy SLM1 Loader | | \+-----------------------------+ | \[ Assembled SLM1 Model Bytes\] \+-----------------------------------+  
The workflow enforces the metadata-only rule at every stage. Upon downloading a source artifact, the Publisher Node (Peer A) transcodes the model into the SLM1 binary format. This local transformation ensures the model aligns with the specific memory planning, quantization, and tokenizer boundaries required by the TinyRustLM WebAssembly ABI2. Peer A computes a SHA-256 Merkle root covering the entire SLM1 file and cryptographically signs a lightweight JSON manifest containing this root.  
When Peer A pushes the manifest to MiniModel.org, the server validates the signature and schemas but categorically rejects any payload containing binary tensor data. When an Importer Node (Peer B) queries the system, it contacts https://MiniModel.org/catalog/models.v0.json to retrieve the signed manifest. Equipped with the Merkle root and network pointers (such as a Distributed Hash Table locator), Peer B initiates a direct connection to Peer A or other swarm participants to retrieve the model bytes, verifying each incoming block against the trusted root hash4.

## **Server Constraints: Engineering the Inability to Host Bytes**

To mathematically and technically prove that project servers avoid touching model bytes, the infrastructure must be fortified with rigid ingestion limits. The architecture cannot rely on policy alone; it must rely on physical network constraints.  
Standard large language models range from several gigabytes to hundreds of gigabytes, and even the most aggressively quantized edge models typically exceed 15 megabytes2. Therefore, the reverse proxy layer (e.g., Nginx, HAProxy, or an API Gateway) fronting MiniModel.org is configured with a hard client body size limit of exactly 5 megabytes. Any HTTP request exceeding this threshold is terminated at the socket level with a 413 Payload Too Large error, making it physically impossible for a user to upload a functioning machine learning model to the server.  
Furthermore, the API endpoints enforce strict Content-Type: application/json parsing. The ingestion logic relies on a strictly typed deserialization pipeline that parses the incoming JSON against predefined schemas. If a malicious actor attempts to embed base64-encoded tensor data within a JSON string field, the schema validator enforces maximum string length limits on all metadata properties. For example, the merkle\_root string is hard-capped at 64 hexadecimal characters, and the publisher\_signature is capped at the standard Ed25519 base64 length. Any extraneous data causes immediate validation failure. Consequently, the backend database, operating as a document store, only ever commits highly structured, verifiable text.

## **Cryptographic Identity and the Trust Model**

The viability of a decentralized distribution network relies entirely on resolving the trust deficit between unknown peers. MiniModel.org resolves this by establishing a cryptographic trust hierarchy based on Public Key Infrastructure (PKI), entirely abandoning traditional email-based authentication.

### **Ed25519 Identity Generation**

Upon initialization, the TinyRustLM application generates a unique Ed25519 keypair on the user's local hardware1. The private key is secured within the user's local keystore and is never transmitted across the network. The derived public key becomes the persistent cryptographic identity of the publisher within the MiniModel ecosystem. Whenever a user compiles a new SLM1 model and wishes to index it, the local client constructs the manifest and hashes the entire JSON structure. The client then signs this hash using the private key, appending the base64-encoded signature to the payload.

### **The Verification Triad**

The trust model operates on a triad of relationships, ensuring that while the network is decentralized, the data remains mathematically proven.

1. **MiniModel.org to Publisher:** The server places no trust in the qualitative safety or performance of the model. It solely trusts the cryptographic mathematics. Upon receiving a manifest, the server statelessly hashes the payload and verifies the signature against the provided public key. If the signature matches, the server trusts that the entity holding the private key authorized the publication of the metadata.  
2. **Importer to MiniModel.org:** The importing peer trusts that MiniModel.org accurately serves the models.v0.json catalog and has not maliciously altered the publisher's public key or the associated Merkle root. To mitigate the risk of a compromised catalog server, clients can optionally cross-reference public keys against external identity registries or developer websites.  
3. **Importer to Peer Swarm (Zero-Trust):** This is the most critical juncture. The importer places absolute zero trust in the peers providing the model chunks. Because the importer retrieved a cryptographically signed Merkle root from the trusted control plane, it treats the data plane as actively hostile. Every piece of binary data received from the swarm is hashed and verified against the Merkle tree before it is written to disk or loaded into the TinyRustLM execution memory3.

## **Schema Architecture: Learning from SafeTensors and GGUF**

To design the metadata schemas for MiniModel.org, it is imperative to analyze the structural paradigms of contemporary tensor formats, specifically SafeTensors and GGUF, and adapt them for peer-to-peer decoupling.  
The SafeTensors format was engineered by Hugging Face to resolve the severe security vulnerabilities inherent in Python's pickle serialization, which allowed arbitrary code execution during model loading8. SafeTensors enforces a strictly read-only design by decoupling a JSON header from a contiguous binary buffer of tensor data. The JSON header describes tensor names, shapes, data types (e.g., F16, BF16), and exact byte offsets10. To prevent denial-of-service (DOS) attacks during parsing, the header size is strictly capped at 100 megabytes, and the format ensures that byte offsets never overlap, allowing for highly efficient, zero-copy memory mapping directly to the GPU or CPU8.  
Concurrently, the GGUF (GGML Unified Format) format revolutionized local inference by establishing a highly extensible, single-file deployment structure13. Unlike earlier iterations that relied on rigid hyperparameter lists, GGUF utilizes a typed key-value metadata block14. This allows for the inclusion of tokenizer vocabularies, architecture details, and complex quantization metrics (such as Q4\_K, which uses super-blocks of 32 weights with 6-bit scales and minimums, resulting in 4.5 bits-per-weight) without breaking backwards compatibility6. Furthermore, GGUF aligns tensor data to 32-byte boundaries by default, facilitating seamless mmap loading14.  
The SLM1 format, tailored for the TinyRustLM WebAssembly environment, synthesizes the JSON header philosophy of SafeTensors with the key-value extensibility and quantization support of GGUF2. However, MiniModel.org introduces a radical departure: it physically severs the header from the data. The manifest schemas hosted on the catalog represent the isolated headers, enriched with cryptographic proofs for network retrieval.

### **Metadata-Only Catalog Design**

The catalog endpoint serves as the primary discovery mechanism. It is exposed as a statically generated, highly cacheable JSON array, allowing importing clients to scan for required models based on architecture, quantization, or publisher identity.

| Field Name | Data Type | Structural Purpose and Validation Constraints |
| :---- | :---- | :---- |
| catalog\_version | String | Defines the schema iteration (e.g., "v1.0"). Used by TinyRustLM to ensure parser compatibility. |
| last\_updated | ISO 8601 | Server-generated timestamp of the last catalog compilation. |
| entries | Array | A paginated list of summary metadata for available SLM1 models. |
| entries\[\].model\_id | String | A deterministic UUID or Content Identifier (CID) derived from the SHA-256 hash of the full manifest. |
| entries\[\].name | String | A human-readable identifier, restricted to alphanumeric characters and hyphens to prevent injection attacks. |
| entries\[\].publisher\_pubkey | String | The Ed25519 public key of the entity that signed the manifest, allowing clients to build reputation graphs. |
| entries\[\].manifest\_url | String | The precise URI pointing to the full, signed manifest document hosted on the MiniModel infrastructure. |
| entries\[\].tags | Array of Strings | Categorical identifiers reflecting model capabilities (e.g., "instruct", "teleodynamic", "Q4\_K")1. |

### **Manifest Schema Proposal**

The manifest is the cryptographic core of the system. It replaces the contiguous byte buffer found in GGUF or SafeTensors with a Merkle root and network locators. When an importer parses this document, they possess the exact memory layout of the model before downloading a single byte.

| Field Name | Data Type | Structural Purpose and Validation Constraints |
| :---- | :---- | :---- |
| manifest\_version | String | The schema iteration for the manifest structure. |
| model\_metadata | Object | High-level architectural parameters (e.g., context window, layer count, embedding dimensions) modeled after GGUF key-value pairs15. |
| tensor\_schema | Array of Objects | An exact mapping of the model's physical layout. Defines tensor names, multidimensional shapes, and data types (dtype). This mirrors the SafeTensors header logic10. |
| merkle\_root | String (Hex) | The singular SHA-256 root hash of the complete BEP 52 Merkle tree for the SLM1 binary3. |
| piece\_length | Integer | The exact size of each network transfer chunk in bytes (strictly enforced at 16,384 bytes for block alignment)3. |
| total\_size | Integer | The total aggregate byte size of the model, used for local storage allocation and bandwidth warnings10. |
| peer\_sources | Array of Objects | A collection of routing instructions and locators for peer discovery (defined below). |
| publisher\_signature | String (Base64) | The Ed25519 cryptographic signature encompassing all preceding fields, proving provenance and preventing tampering. |

### **Peer-Source Schema Proposal (Peer Offer Proofs)**

To bridge the control plane and the data plane, the manifest must contain instructions directing the TinyRustLM network client to the active swarm. This schema contains purely routing information, ensuring no model weights are stored.

| Field Name | Data Type | Structural Purpose and Validation Constraints |
| :---- | :---- | :---- |
| protocol | String | Identifies the transport mechanism required by the peer (e.g., bittorrent-v2, webrtc-swarm). |
| locator | String | The connection string. For BitTorrent, this is typically a magnet URI utilizing the urn:btmh: format17. For WebRTC, this dictates the signaling server endpoint. |
| offer\_proof | String | A time-stamped cryptographic signature by the publisher indicating recent activity. This optional field allows the index to prune abandoned or dead swarms, maintaining high catalog fidelity. |

## **Chunking and Merkle Verification (The P2P Layer)**

The foundational vulnerability of decentralized file distribution is supply-chain poisoning, wherein malicious peers deliberately introduce corrupted or altered bytes into a swarm18. If an altered tensor block is loaded into local memory, it could theoretically execute arbitrary behavior or silently degrade the intelligence of the model. MiniModel.org neutralizes this vector by adopting the stringent cryptographic verification architecture formalized in BitTorrent v2 (BEP 52\)3.

### **The BEP 52 Merkle Tree Architecture**

Legacy decentralized protocols relied on flat lists of SHA-1 hashes, one for each piece of the file3. For massive files, such as multi-gigabyte language models, storing a hash for every piece results in unwieldy metadata files that violate the strict size limitations of the MiniModel API. Furthermore, SHA-1 is cryptographically deprecated due to collision vulnerabilities17.  
BEP 52 solves this by implementing a SHA-256 Merkle hash tree4.

1. **Block Alignment:** The SLM1 file is segmented into strictly aligned 16 KiB blocks. This alignment is highly beneficial for multi-megabyte tensor files, ensuring that piece boundaries map cleanly to the underlying data structures without fragmented overlaps3.  
2. **Leaf Generation:** Every 16 KiB block is independently hashed using SHA-256, forming the bottom layer (the leaves) of the Merkle tree17.  
3. **Tree Construction:** The algorithm pairs adjacent leaf hashes, hashes the concatenation, and repeats this process upwards through the piece layers until it culminates in a single, 32-byte Root Hash.  
4. **Metadata Efficiency:** MiniModel.org only stores this single 32-byte Root Hash in the merkle\_root field of the manifest17. Consequently, the metadata payload remains infinitesimally small, regardless of whether the SLM1 artifact is 100 megabytes or 100 gigabytes.

### **Zero-Trust Dynamic Verification Flow**

When the TinyRustLM client initiates an import, it connects to the P2P swarm using the locator provided in the manifest. The client immediately requests the intermediate piece layers of the Merkle tree from connected peers3. Before requesting any actual tensor data, the client hashes these intermediate layers and verifies that they perfectly resolve to the trusted Root Hash retrieved from MiniModel.org.  
Once the tree is verified, the client begins streaming the 16 KiB data blocks from the swarm. As each block arrives in local memory, the client hashes it and verifies it against the previously validated intermediate hashes3. If a hash mismatch occurs, the client immediately drops the corrupted block, severs the TCP or WebRTC connection to the offending peer, and re-requests the block from an alternate source. This guarantees that the TinyRustLM runtime will only ever execute mathematically pristine weights, ensuring absolute supply-chain integrity over a zero-trust transport layer.

## **User Consent and Peer-to-Peer Privacy**

Because the physical transfer of the model relies on the resources of the users rather than a centralized cloud, the architecture inherently shifts bandwidth costs and IP address exposure to the edge. This raises significant privacy and consent obligations.  
In peer-to-peer networks, clients communicate by exchanging IP addresses and port numbers, meaning every participant in a swarm is visible to other participants, as well as to monitoring entities22. Furthermore, acting as a node in a decentralized network can consume substantial uplink bandwidth, which may incur costs for users on metered connections. Traditional torrent clients often default to background seeding, a practice that is unacceptable for an enterprise-grade AI ecosystem.  
The MiniModel architecture dictates that the TinyRustLM client must implement a rigid, blocking consent flow prior to initiating any network activity. When a user requests an import, the UI must present an explicit disclosure screen:

1. **Storage and Bandwidth Impact:** The system displays the exact storage footprint required, parsed directly from the manifest's total\_size field.  
2. **IP Visibility Disclosure:** The application must prominently warn the user that engaging with the decentralized swarm will expose their IP address to other network participants23.  
3. **Active Seeding Consent:** Participation in seeding (uploading chunks to other peers) must be strictly opt-in. The default state must configure the client as a leecher, terminating the swarm connection the moment the file validation concludes. Users must affirmatively toggle a setting to contribute their uplink bandwidth to the network.

By pushing consent enforcement to the client application, MiniModel.org ensures that its ecosystem operates transparently, mitigating the risk of inadvertent data consumption or privacy breaches.

## **Legal Boundaries, Liability, and Compliance Engineering**

The single greatest threat to the MiniModel.org architecture is legal liability. The history of decentralized file sharing is littered with devastating litigation. To survive, the system must be engineered to navigate the perilous legal doctrines of secondary copyright liability—specifically contributory infringement and inducement25.  
*Disclaimer: The following analysis constitutes an architectural policy framework designed to minimize system risk. It does not constitute individualized legal advice. Organizations deploying or interacting with this architecture should consult qualified legal counsel to ensure compliance with specific jurisdictional obligations.*

### **Navigating the Inducement Precedent**

The legal destruction of early P2P indexers was not predicated on the mere hosting of tracking software, but on the active promotion of copyright infringement. The landmark U.S. Supreme Court decision in *Metro-Goldwyn-Mayer Studios Inc. v. Grokster, Ltd.* established the inducement doctrine, holding that a platform is liable if it distributes a system with the explicit object of promoting its use to infringe copyright, as evidenced by clear expression or affirmative steps to foster infringement25.  
This precedent was applied with lethal force against BitTorrent search engines in *Columbia Pictures Industries v. Fung*, known as the IsoHunt case26. The Ninth Circuit Court of Appeals upheld a massive contributory copyright infringement ruling against IsoHunt and its operator, Gary Fung, ultimately resulting in a $110 million settlement and the permanent shutdown of the service29.  
The court identified several fatal architectural and operational decisions made by IsoHunt that established inducement liability:

1. **Active Curation and Promotion:** IsoHunt actively curated lists such as "Top 20 Box Office Movies" and featured them prominently on their homepage, encouraging users to upload infringing torrents for those specific titles31.  
2. **File Modification:** IsoHunt did not merely index files; the server actively modified user-uploaded torrent files by injecting additional backup trackers, thereby technically optimizing the swarms for greater illicit download success28.  
3. **Direct Communication:** The operator personally responded to forum posts requesting specific copyrighted material and urged users to download infringing files31.

To ensure immunity, MiniModel.org must structurally distance itself from the IsoHunt precedent. The architecture mandates absolute neutrality. The catalog API must return search results purely chronologically or via direct query matches. The platform must categorically refuse to implement algorithms that generate "Trending," "Most Downloaded," or "Top 10" lists, as these could inadvertently curate and promote proprietary, leaked, or copyrighted models. Furthermore, the ingestion API must treat every incoming manifest as an immutable cryptographic object; the server is strictly forbidden from appending its own peer locators or modifying the user's peer\_sources28. MiniModel.org acts solely as an automated, passive information location tool.

### **DMCA Safe Harbor Integration**

By operating as an automated metadata index, MiniModel.org positions itself to claim protection under the Digital Millennium Copyright Act (DMCA) Safe Harbors, specifically 17 U.S.C. § 512(d), which limits liability for providers of "Information Location Tools" (such as directories, indexes, and pointers)27. While some platforms seek shelter under Section 230 of the Communications Decency Act, courts generally hold that Section 230 contains an exception for intellectual property claims, making the DMCA the primary mechanism for copyright defense34.  
To maintain this safe harbor, the architecture and operations must comply with strict statutory prerequisites:

1. **Registered Agent:** MiniModel.org must designate a DMCA agent to receive notifications of claimed infringement and formally register this agent with the U.S. Copyright Office33.  
2. **Lack of Actual Knowledge:** The platform must not possess actual knowledge of infringing activity, nor ignore "red flags" indicating apparent infringement. By utilizing automated JSON validation and avoiding active curation, the system limits its awareness solely to the structured metadata32.  
3. **No Direct Financial Benefit:** The platform must not derive direct financial benefit specifically attributable to infringing activity, assuming the right and ability to control such activity exists.  
4. **Expeditious Takedown Workflow:** Upon receiving a compliant takedown notice, the platform must act expeditiously to remove or disable access to the metadata pointer.

### **Abuse and Takedown Process Flow**

Because MiniModel.org does not possess the tensor bytes, it cannot delete the physical files from the local drives of the swarm participants. The takedown process is strictly limited to disabling discovery on the control plane.

1. **Intake and Validation:** A rightsholder (e.g., an AI laboratory whose proprietary weights were leaked) submits a DMCA notice to the designated agent (e.g., abuse@minimodel.org), identifying the specific manifest URL and the infringing cryptographic identity. The legal operations team verifies the notice contains the required statutory elements (electronic signature, identification of the work, statement of good faith)35.  
2. **Execution (Delisting):** The system administrators issue a delisting command to the backend database. The target manifest is immediately purged from the models.v0.json index array, and the physical manifest file is deleted from the public CDN endpoints.  
3. **Swarm Isolation:** The moment the manifest is delisted, the discovery mechanism is destroyed for all future users. While the platform cannot reach into the data plane to halt ongoing transfers, the TinyRustLM client periodically polls the catalog. If the client detects that a manifest has been struck down for legal abuse, the software can be programmed to sever active connections linked to that specific Merkle root, effectively starving the rogue swarm.  
4. **Counter-Notice:** The platform notifies the original publisher (if contact protocols are established via their public key) to allow for the submission of a counter-notification, enabling the potential restoration of the index pointer under DMCA procedures.

### **Required No-Endorsement Boundary Wording**

To further insulate the project from secondary liability and explicitly define user responsibilities, MiniModel.org must conspicuously embed legal boundary wording across the UI, API responses, and documentation portals.  
**Standard Legal Boundary Wording:**  
*"MiniModel.org operates exclusively as a decentralized directory and cryptographic metadata index for modular AI components. MiniModel.org does not host, serve, proxy, execute, or store machine learning model weights, tensor data, or executable binaries. All model manifests, schemas, and peer discovery pointers are generated and published autonomously by independent, third-party users. The presence of a manifest on this directory does not constitute an endorsement, verification of safety, or assertion of copyright clearance by MiniModel.org. Users initiating peer-to-peer data transfers do so entirely at their own risk and are solely responsible for ensuring that their acquisition, local execution, and distribution of model weights comply with all applicable licenses, terms of service, and local laws."*

## **Developer Documentation Outline**

A decentralized architecture is only as resilient as the developer ecosystem surrounding it. The source-of-truth boundary dictates that MiniModel.org operates the API, while comprehensive developer documentation, governance policies, and implementation evidence are hosted independently on MiniModel.MiRust.com2.  
**Table of Contents: MiniModel.MiRust.com**

1. **Introduction to Teleodynamic Modular AI**  
   * Defining the five commitments of Teleodynamic Learning and their implications for local execution1.  
   * The architectural necessity of P2P distribution for resource-bounded AI2.  
   * The Source-of-Truth Boundary: Differentiating the MiRust research platform from the MiniModel metadata index2.  
2. **The SLM1 Model Format**  
   * Anatomy of an SLM1 file: Aligning tensor schemas with the WebAssembly ABI.  
   * Comparative analysis against SafeTensors (JSON decoupling, zero-copy mapping)8.  
   * Comparative analysis against GGUF (key-value metadata, quantization types like Q4\_K and IQ3\_S)6.  
3. **Publishing to MiniModel.org**  
   * Generating an Ed25519 cryptographic identity locally via TinyRustLM.  
   * Converting Hugging Face source models into the SLM1 format.  
   * Constructing the SHA-256 Merkle Tree (BEP 52 standard) and aligning 16 KiB piece blocks3.  
   * Signing the JSON Manifest and submitting via POST /api/v1/manifests.  
4. **Importing and P2P Networking**  
   * Querying the catalog/models.v0.json endpoint for discovery.  
   * Parsing the Tensor Schemas for local memory allocation.  
   * Initiating WebRTC / libtorrent swarm connections.  
   * Executing real-time cryptographic block validation against the Merkle Root.  
5. **Governance, Compliance, and Security**  
   * Understanding the absolute Metadata-Only guarantee.  
   * Handling user consent, IP privacy, and bandwidth disclosures in client applications.  
   * DMCA Safe Harbor guidelines, Grokster/IsoHunt precedent avoidance, and Takedown reporting procedures25.

## **Acceptance Criteria for the "Metadata-Only" Guarantee**

To ensure the architecture successfully meets the product goal while remaining hermetically sealed against legal and operational liabilities, the system must satisfy a series of rigorous acceptance criteria across technical, legal, and operational domains.

| Domain | ID | Acceptance Criterion | Validation Methodology |
| :---- | :---- | :---- | :---- |
| **Technical** | TC-01 | **Zero-Byte Ingestion Limit:** API ingestion endpoints must reject any payload exceeding 5MB, physically preventing the upload of functioning model weights. | Verified via Load Balancer configurations and automated integration tests pushing 6MB mock payloads. |
| **Technical** | TC-02 | **Format Enforcement:** The API must reject non-JSON payloads and JSON payloads containing unrecognized or excessively long string fields. | Verified via strict JSON Schema validation middleware on all ingestion routes. |
| **Technical** | TC-03 | **Cryptographic Verification:** The server must reject any manifest where the Ed25519 signature fails to mathematically resolve against the payload hash and the provided public key. | Verified via unit testing utilizing deliberately corrupted signatures and mismatched public keys. |
| **P2P Client** | PC-01 | **Root Trust Validation:** The local TinyRustLM client must only accept P2P model chunks that cryptographically resolve to the Merkle Root provided in the MiniModel manifest3. | Verified by injecting intentionally poisoned chunks into a local test swarm; the client must drop the chunks and sever the peer connection. |
| **P2P Client** | PC-02 | **Explicit User Consent:** The local client must halt all outbound network activity until the user affirmatively clicks "Accept" on the bandwidth consumption and IP exposure warning screen. | Verified via UI/UX workflow testing and packet sniffing (e.g., Wireshark) to ensure zero network transmission prior to consent. |
| **Legal** | LC-01 | **Safe Harbor Compliance:** A designated DMCA agent must be registered with the U.S. Copyright Office and listed prominently on MiniModel.MiRust.com33. | Verified via a public directory search of the U.S. Copyright Office database. |
| **Legal** | LC-02 | **No Curation / Algorithmic Neutrality:** The catalog API must return results purely based on search parameters or chronological order, with no algorithmic promotion of specific models. | Verified via rigorous code review of the database querying logic; ensuring no "trending" or "promoted" sorting mechanisms exist that could trigger inducement liability28. |
| **Operational** | OP-01 | **Takedown Efficacy:** Upon execution of a takedown command by administrators, the targeted manifest must be instantaneously purged from the live models.v0.json index array and API caches. | Verified via simulated DMCA workflow exercises in the staging environment. |

The MiniModel.org architecture achieves a highly resilient, decentralized distribution mechanism for modular AI by strictly separating cryptographic metadata from tensor bytes. By leveraging the robust Merkle-tree verification protocols of BitTorrent v23 alongside the non-executable metadata layouts pioneered by modern formats like SafeTensors and GGUF10, the system guarantees data integrity in a zero-trust environment. Crucially, by architecturally enforcing a metadata-only boundary through hard payload limits and strict adherence to DMCA Information Location Tool safe harbors33, the platform shields itself from the catastrophic secondary liabilities that have historically dismantled peer-to-peer networks26. The result is a legally defensible control plane that empowers developers to scale the teleodynamic AI ecosystem without the bottlenecks of centralized infrastructure.

#### **Works cited**

1. The five commitments of Teleodynamic Learning \- MiRust, [https://mirust.com/five-commitments-of-teleodynamic-learning/](https://mirust.com/five-commitments-of-teleodynamic-learning/)  
2. Research \- MiRust, [https://mirust.com/research/](https://mirust.com/research/)  
3. The BitTorrent Protocol Specification v2 : r/programming \- Reddit, [https://www.reddit.com/r/programming/comments/6safyl/the\_bittorrent\_protocol\_specification\_v2/](https://www.reddit.com/r/programming/comments/6safyl/the_bittorrent_protocol_specification_v2/)  
4. Net::BitTorrent \- metacpan.org, [https://metacpan.org/pod/Net::BitTorrent](https://metacpan.org/pod/Net::BitTorrent)  
5. features \- libtorrent, [https://www.libtorrent.org/features-ref.html](https://www.libtorrent.org/features-ref.html)  
6. GGUF · Hugging Face, [https://huggingface.co/docs/hub/gguf](https://huggingface.co/docs/hub/gguf)  
7. MiRust site guide 1.1.0 \- MiRust, [https://mirust.com/mirust-site-guide-1-1-0/](https://mirust.com/mirust-site-guide-1-1-0/)  
8. SafeTensors Format: A Guide to Secure ML Model Serialization \- DataCamp, [https://www.datacamp.com/blog/safetensors-format](https://www.datacamp.com/blog/safetensors-format)  
9. SafeTensors: Efficient Serialization Format for Deep Learning | by Nishtha kukreti | Medium, [https://medium.com/@nishthakukreti.01/safetensors-efficient-serialization-format-for-deep-learning-57364317be43](https://medium.com/@nishthakukreti.01/safetensors-efficient-serialization-format-for-deep-learning-57364317be43)  
10. GitHub \- safetensors/safetensors: Simple, safe way to store and distribute tensors, [https://github.com/safetensors/safetensors](https://github.com/safetensors/safetensors)  
11. safetensors package \- github.com/nlpodyssey/safetensors \- Go Packages, [https://pkg.go.dev/github.com/nlpodyssey/safetensors](https://pkg.go.dev/github.com/nlpodyssey/safetensors)  
12. reading safetensors in zig, [https://yobibyte.github.io/safetensors.html](https://yobibyte.github.io/safetensors.html)  
13. GGUF Format: A Complete Guide to Local LLM Inference \- DataCamp, [https://www.datacamp.com/tutorial/gguf-format-a-complete-guide](https://www.datacamp.com/tutorial/gguf-format-a-complete-guide)  
14. GGUF \- Wikipedia, [https://en.wikipedia.org/wiki/GGUF](https://en.wikipedia.org/wiki/GGUF)  
15. GGUF file format \- ggml, [https://ggml-org-ggml.mintlify.app/formats/gguf](https://ggml-org-ggml.mintlify.app/formats/gguf)  
16. ggml/docs/gguf.md at master · ggml-org/ggml \- GitHub, [https://github.com/ggml-org/ggml/blob/master/docs/gguf.md](https://github.com/ggml-org/ggml/blob/master/docs/gguf.md)  
17. Libtorrent 2.0 Is Released With BitTorrent 2.0 Support \- LinuxReviews, [https://linuxreviews.org/Libtorrent\_2.0\_Is\_Released\_With\_BitTorrent\_2.0\_Support](https://linuxreviews.org/Libtorrent_2.0_Is_Released_With_BitTorrent_2.0_Support)  
18. Torrent Poisoning Protection with a Reverse Proxy Server \- MDPI, [https://www.mdpi.com/2079-9292/12/1/165](https://www.mdpi.com/2079-9292/12/1/165)  
19. DMCA Safe Harbors for Virtual Private Server Providers Hosting BitTorrent Clients \- Duke Law Scholarship Repository, [https://scholarship.law.duke.edu/context/dltr/article/1264/viewcontent/DMCA\_Safe\_Harbors\_for\_Virtual\_Private\_Server\_Providers\_\_\_Wang.pdf](https://scholarship.law.duke.edu/context/dltr/article/1264/viewcontent/DMCA_Safe_Harbors_for_Virtual_Private_Server_Providers___Wang.pdf)  
20. Support BitTorrent v2 spec: BEP 52 \#175 \- anacrolix/torrent \- GitHub, [https://github.com/anacrolix/torrent/issues/175](https://github.com/anacrolix/torrent/issues/175)  
21. What is the purpose of using different hash functions for the leaves and internals of a hash tree? \- Cryptography Stack Exchange, [https://crypto.stackexchange.com/questions/2106/what-is-the-purpose-of-using-different-hash-functions-for-the-leaves-and-interna](https://crypto.stackexchange.com/questions/2106/what-is-the-purpose-of-using-different-hash-functions-for-the-leaves-and-interna)  
22. What is torrenting? Everything you need to know\! \- RapidSeedbox, [https://www.rapidseedbox.com/blog/torrenting-and-torrent-definition](https://www.rapidseedbox.com/blog/torrenting-and-torrent-definition)  
23. Five Ways to Download Torrents Anonymously (Evidence-Based) \- LifeTips, [https://lifetips.alibaba.com/tech-efficiency/five-ways-to-download-torrents-anonymously](https://lifetips.alibaba.com/tech-efficiency/five-ways-to-download-torrents-anonymously)  
24. Breadcrumbs in the Digital Forest: Tracing Criminals through Torrent Metadata with OSINT, [https://www.researchgate.net/publication/399477273\_Breadcrumbs\_in\_the\_Digital\_Forest\_Tracing\_Criminals\_through\_Torrent\_Metadata\_with\_OSINT](https://www.researchgate.net/publication/399477273_Breadcrumbs_in_the_Digital_Forest_Tracing_Criminals_through_Torrent_Metadata_with_OSINT)  
25. Columbia Pictures Industries, Inc. v. Fung \- Ninth Circuit Court of Appeals, [https://cdn.ca9.uscourts.gov/datastore/opinions/2013/03/21/10-55946.pdf](https://cdn.ca9.uscourts.gov/datastore/opinions/2013/03/21/10-55946.pdf)  
26. Columbia Pictures Industries, Inc. v. Fung \- Wikipedia, [https://en.wikipedia.org/wiki/Columbia\_Pictures\_Industries,\_Inc.\_v.\_Fung](https://en.wikipedia.org/wiki/Columbia_Pictures_Industries,_Inc._v._Fung)  
27. Columbia Pictures Industries v. Fung, No. 10-55946 (9th Cir. 2013\) \- Justia Law, [https://law.justia.com/cases/federal/appellate-courts/ca9/10-55946/10-55946-2013-03-21.html](https://law.justia.com/cases/federal/appellate-courts/ca9/10-55946/10-55946-2013-03-21.html)  
28. Columbia Pictures Industries v. Fung: IsoHunt Found Liable for Contributory Infringement | Cowan, DeBaets, Abrahams & Sheppard LLP, [https://cdas.com/columbia-pictures-industries-v-fung-isohunt-found-liable-for-contributory-infringement-2/](https://cdas.com/columbia-pictures-industries-v-fung-isohunt-found-liable-for-contributory-infringement-2/)  
29. isoHunt closes: the BitTorrent hunter is hunted down \- Seward & Kissel LLP, [http://www.sewkis.com/wp-content/uploads/isoHunt-closes-the-BitTorrent-Dine.pdf](http://www.sewkis.com/wp-content/uploads/isoHunt-closes-the-BitTorrent-Dine.pdf)  
30. Goodbye Gary Fung and Isohunt \- Hugh Stephens Blog, [https://hughstephensblog.net/2016/08/16/goodbye-gary-fung-and-isohunt/](https://hughstephensblog.net/2016/08/16/goodbye-gary-fung-and-isohunt/)  
31. No Reprieve for isoHunt in Copyright-Aiding Suit | Courthouse News Service, [https://www.courthousenews.com/no-reprieve-for-isohunt-in-copyright-aiding-suit/](https://www.courthousenews.com/no-reprieve-for-isohunt-in-copyright-aiding-suit/)  
32. Torrent Sites Induce Infringement and Lose DMCA Safe Harbor-Columbia v. Fung \- Technology & Marketing Law Blog, [https://blog.ericgoldman.org/archives/2009/12/torrent\_sites\_i.htm](https://blog.ericgoldman.org/archives/2009/12/torrent_sites_i.htm)  
33. DMCA SAFE HARBORS: AN ANALYSIS OF THE STATUTE AND CASE LAW \- Greenberg Traurig, LLP, [https://www.gtlaw.com/-/media/files/webinars/ian-ballon-may-19/dmca-safe-harbors-an-analysis-of-the-statute-and-case-law.pdf](https://www.gtlaw.com/-/media/files/webinars/ian-ballon-may-19/dmca-safe-harbors-an-analysis-of-the-statute-and-case-law.pdf)  
34. Talkin' 'Bout AI Generation 251 TALKIN' 'BOUT AI GENERATION: COPYRIGHT AND THE GENERATIVE-AI SUPPLY CHAIN “Does gener \- James Grimmelmann, [https://james.grimmelmann.net/files/articles/talkin-bout-ai-generation.pdf](https://james.grimmelmann.net/files/articles/talkin-bout-ai-generation.pdf)  
35. Columbia Pictures Indus., Inc. v. Fung \- 2009 WL 6355911 (C.D. Cal. 2009), [https://via.library.depaul.edu/cgi/viewcontent.cgi?referer=\&httpsredir=1\&article=1092\&context=jatip](https://via.library.depaul.edu/cgi/viewcontent.cgi?referer&httpsredir=1&article=1092&context=jatip)  
36. Terms \- MiRust, [https://mirust.com/terms/](https://mirust.com/terms/)
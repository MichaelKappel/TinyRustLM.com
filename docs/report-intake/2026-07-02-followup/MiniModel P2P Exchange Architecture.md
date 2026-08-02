# **Architecture Decision Record and Phased Implementation Plan for MiniModel P2P Model Exchange**

The proliferation of small, specialized language models necessitates decentralized distribution strategies that mitigate the extreme egress costs and copyright liabilities associated with centralized hosting. The MiniModel project is tasked with establishing a secure, high-performance model exchange and catalog layer for TinyRustLM .slm (Small Language Model 1\) models. The foundational architectural constraint strictly dictates that the central infrastructure, hosted at MiniModel.org, must function exclusively as a metadata registry and trust anchor. Project servers may publish documentation, JSON schemas, cryptographic public keys, and model manifests, but they must never execute, proxy, cache, or serve user model bytes1. Model artifacts must be distributed entirely through user-owned local files or via peer-to-peer (P2P) transfers from consenting peers, with every import cryptographically bound to a checksum and verified locally by a Rust implementation before the TinyRustLM runtime can load it1.  
The following report establishes the architecture decision record, protocol evaluations, manifest design, and phased implementation roadmap to achieve these objectives while maintaining a Rust-first ecosystem.

## **Architecture Decision Record**

The selected architecture pairs a metadata registry inspired by The Update Framework (TUF) hosted on MiniModel.org with the Iroh-blobs protocol operating over QUIC for the decentralized data plane. The centralized MiniModel server will host cryptographically signed JSON manifests that define the artifact identity, licensing, and P2P routing parameters of a model5. Clients will fetch this manifest over standard HTTPS, verify the Ed25519 signatures and metadata properties, and extract the BLAKE3 root hash of the target .slm artifact. The client will then utilize the iroh-blobs protocol, a Rust-native content-addressed transfer mechanism, to fetch the actual model bytes directly from peers8.  
This architectural synthesis provides an optimal balance of high-performance transport and strict supply-chain verification. The iroh-blobs protocol inherently enforces content addressing, meaning the client requests data by its hash rather than its location, physically preventing malicious peers from serving poisoned models without immediate detection8. Furthermore, Iroh's Magicsock networking layer provides zero-configuration NAT traversal (hole punching) and relay fallbacks, which eliminates the need for complex firewall configurations on the user side10. By keeping the metadata on the centralized server and the heavy data transfer on the P2P layer, the architecture strictly adheres to the mandate that servers never serve user model bytes while offering a frictionless, secure user experience.

## **Protocol Comparison for P2P Model Exchange**

To identify the optimal data plane for the MiniModel ecosystem, several distributed systems and transfer protocols were evaluated against the project's strict criteria: Rust-native implementation, robust security, content-addressing, and NAT traversal capabilities.

| Protocol / Stack | Implementation Language | Transport Mechanism | Verification Mechanism | NAT Traversal & Peer Discovery | Architectural Suitability |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Rust-Native QUIC (Quinn)** | Pure Rust | QUIC (UDP multiplexed) | None built-in (Requires custom application layer logic) | None built-in (Requires custom signaling) | **Low.** While Quinn is a highly performant, async-friendly transport addressing TCP shortcomings like head-of-line blocking13, it is too low-level. It requires building chunking, Merkle verification, and peer discovery entirely from scratch. |
| **Iroh-blobs** | Pure Rust | QUIC (built on Quinn) | BLAKE3 Verified Streaming (1KiB chunks) | Magicsock (QUIC Address Discovery, Home Relays, Tickets) | **Highest.** Purpose-built for content-addressed blob transfer in Rust8. Verifies data incrementally during streaming. Uses explicit tickets rather than global broadcasting, fitting the consent model perfectly. |
| **Rust-libp2p** | Rust | Configurable (TCP, QUIC, WebRTC) | Multihash / CID | Kademlia DHT, AutoNAT, Relay | **Medium.** Extremely modular but heavily bloated with legacy abstractions. The Kademlia DHT broadcasts peer availability globally, which leaks metadata and complicates the requirement for explicit user consent15. |
| **Pear / Hypercore** | JavaScript / C / Node.js | TCP / UDP | Flat in-order Merkle tree (BLAKE2b hashes) | Hyperswarm (DHT \+ Hole punching) | **Low.** Excellent BitTorrent-style log replication and NAT traversal18. However, the ecosystem is heavily Node.js-centric, which violates the strict Rust-first constraint for memory safety and zero-copy integration. |
| **BitTorrent (Standard)** | Various (C++, Rust) | TCP / uTP | SHA-1 / SHA-256 piece hashes | Mainline DHT, Centralized Trackers | **Low.** Lacks modern verified streaming efficiency, relies heavily on external trackers, and introduces chunking overhead that is unoptimized for large machine learning tensor data. |

A deeper technical analysis reveals that while rust-libp2p offers a comprehensive suite of networking protocols, its architectural philosophy leans toward building global, interconnected graphs16. This conflicts with MiniModel's requirement for explicitly consented, curated P2P transfers. The Kademlia DHT in libp2p broadcasts peer availability globally, which may inadvertently expose user IP addresses and model usage metrics to passive observers.  
The Hypercore and Pear ecosystem offer a highly compelling append-only log structure that natively supports sparse downloading and excellent peer discovery via Hyperswarm20. However, integrating this heavily JavaScript-oriented stack into a memory-safe, Rust-first ML runtime would require extensive Foreign Function Interface (FFI) bridging, introducing complexity, performance overhead, and potential security vulnerabilities at the language boundary.  
The iroh-blobs protocol resolves these architectural tensions. It is a pure-Rust library that treats blobs as opaque byte sequences identified solely by a 32-byte BLAKE3 root hash8. It operates using shareable "tickets"—small tokens containing the BLAKE3 hash, a peer's Ed25519 NodeID, and relay routing information. This enables a "cozy network" approach where connections are formed explicitly rather than broadcast globally8. This aligns perfectly with the requirement that users must understand consent, source, and trust before transferring model bytes.

## **Secure MiniModel Manifest Design**

The manifest serves as the cryptographic anchor connecting the centralized metadata on MiniModel.org with the decentralized .slm artifacts. The design is heavily inspired by The Update Framework (TUF) and the Software Package Data Exchange (SPDX) specifications7. The manifest must protect against rollback, mix-and-match, and path traversal attacks while explicitly declaring licensing and liability boundaries24.

### **Manifest JSON Schema Recommendation**

The following schema defines the required fields for a secure MiniModel manifest. It utilizes a standardized JSON format to ensure broad compatibility while enforcing strict cryptographic boundaries.

JSON  
{  
  "schema\_version": "1.0.0",  
  "manifest\_id": "urn:minimodel:tiny-rust-lm:llama-3-8b-instruct-slm1",  
  "artifact": {  
    "kind": "SLM1",  
    "byte\_count": 4294967296,  
    "checksums": {  
      "blake3\_root": "a1b2c3d4e5f6...",   
      "tokenizer\_sha256": "f6e5d4c3b2a1...",  
      "config\_sha256": "1a2b3c4d5e6f..."  
    },  
    "chunk\_merkle\_fields": {  
      "chunk\_size\_bytes": 1024,  
      "tree\_depth": 22  
    }  
  },  
  "legal\_and\_compliance": {  
    "spdx\_expression": "(MIT OR Apache-2.0)",  
    "license\_route": "https://minimodel.org/licenses/llama-3-8b-instruct-slm1",  
    "model\_card\_route": "https://minimodel.org/models/llama-3-8b-instruct-slm1/card",  
    "liability\_acknowledgment": "No endorsement. User assumes all responsibility for model execution and copyright compliance. Consent required for P2P transfer."  
  },  
  "routing\_and\_peers": {  
    "default\_p2p\_enabled": true,  
    "peer\_source\_fields": \[  
      {  
        "node\_id": "ed25519-public-key-of-peer",  
        "relay\_url": "https://relay1.minimodel.org",  
        "iroh\_ticket": "blob-ticket-string..."  
      }  
    \]  
  },  
  "trust\_and\_admission": {  
    "source\_identity": "huggingface:author\_name",  
    "admission\_evidence": "URL-to-audit-log-or-transparency-record",  
    "timestamp": "2026-07-02T18:30:02Z",  
    "expiration": "2026-08-02T18:30:02Z"  
  },  
  "signatures": \[  
    {  
      "key\_identity": "ed25519-minimodel-catalog-key",  
      "signature": "base64-encoded-signature"  
    }  
  \]  
}

The blake3\_root serves as the immutable identifier for the iroh-blobs fetch operation. The 1KiB chunk\_size\_bytes ensures alignment with Iroh's incremental verified streaming, allowing the client to drop poisoned chunks instantly before writing to memory. Separate checksums for the tokenizer and config prevent mix-and-match attacks where an attacker swaps a benign tokenizer for one that initiates path traversal during vocabulary loading.  
The spdx\_expression utilizes standard SPDX syntax to ensure automated license compliance pipelines can parse the model's restrictions23. Expressions can be combined using logical operators such as AND, OR, and WITH (for license exceptions), allowing precise legal definitions28. The explicit liability acknowledgment acts as a programmable barrier requiring explicit user consent in the CLI or GUI before network connections are opened.  
TUF-inspired timestamp and expiration fields mitigate rollback and indefinite freeze attacks7. If an attacker attempts to serve an outdated, vulnerable manifest, the local verifier will reject it based on the expired timestamp. Threshold Ed25519 signatures ensure that even if a single catalog signing key is compromised, the attacker cannot forge a valid manifest without meeting the required quorum7.

## **P2P Conversion and Sharing Pipeline**

To populate the MiniModel P2P network, models typically originating from standard machine learning hubs, such as Hugging Face, must be converted into the SLM1 format and seeded via the Iroh protocol. This pipeline bridges the gap between traditional centralized artifact storage and decentralized, verified execution.  
The conversion process begins when a developer downloads a PyTorch or Safetensors model from a centralized hub. The Safetensors format is heavily preferred as it is inherently safer than pickled Python data, utilizing a secure JSON header for tensor metadata and a restricted deserialization process to prevent arbitrary code execution vulnerabilities33. A local Rust utility parses the Safetensors file, applies the desired quantization scheme (e.g., Q4\_K\_M or dynamic\_int8), and serializes the data into the highly optimized, zero-copy SLM1 binary format tailored specifically for the TinyRustLM runtime1.  
Following conversion, the utility processes the resulting .slm file through a BLAKE3 hasher. This generates the 32-byte root hash and the external chunk metadata required for Iroh's verified streaming8. The developer then generates a candidate JSON manifest incorporating the hash, SPDX license data, and the source identity. To make the model available to the network, the developer initializes an Iroh provider node locally. The node binds to a UDP port and communicates with a Magicsock home relay to establish its public routing availability, generating an iroh\_ticket containing its public Ed25519 key and relay URL8. The developer submits the candidate manifest and the ticket to the MiniModel catalog. Following an automated admission review verifying formatting and licenses, the catalog signs the manifest and publishes it, establishing the developer's local machine as the initial seed for the P2P swarm.

## **Local Verification and Import Flow**

The client-side Rust implementation serves as the primary enforcement mechanism for supply-chain security. The verifier flow dictates the exact sequence of state transitions and cryptographic operations required before a model can be executed by TinyRustLM.  
The client initiates the flow by retrieving the manifest from MiniModel.org over TLS. The Rust verifier parses the JSON and strictly validates the schema. It must sanitize all inputs to prevent path traversal vulnerabilities—such as those previously identified in Rust TUF clients (e.g., CVE-2026-6968 in the tough crate), where malicious metadata could overwrite files outside intended directories via absolute paths or symlinks24. The verifier extracts the signatures array and checks them against the pinned Ed25519 public keys of the MiniModel catalog. It then verifies the expiration timestamp. If the manifest is expired or the signature threshold is unmet, the import halts immediately to prevent rollback attacks7.  
Once cryptographic trust is established, the interface prompts the user with the SPDX expression and liability acknowledgment. The user must explicitly accept the terms and authorize the P2P network dialect, fulfilling the requirement that users understand consent, source, and liability. Using the verified BLAKE3 root hash and the provided Iroh ticket, the local Iroh QUIC endpoint initiates a connection. The Magicsock layer handles NAT traversal, attempting direct UDP hole punching, and falling back to a specified relay if necessary10.  
As the QUIC stream delivers the .slm bytes, Iroh's underlying BLAKE3 verified streaming mechanism evaluates each 1KiB chunk against the intermediate hashes of the BLAKE3 Merkle tree8. If a peer attempts to inject malicious tensor data, the specific chunk fails validation, the peer is disconnected, and the connection is blacklisted. Once the bytes are fully assembled locally, the TinyRustLM loader parses the SLM1 binary format header1. It verifies the internal tensor metadata, structural bounds, and confirms that the separate tokenizer and configuration checksums match the manifest. Upon total success, the verifier writes a strongly typed, cryptographic import receipt to the local disk using a zero-allocation binary serializer like postcard. TinyRustLM will refuse to load any .slm file lacking a valid, locally signed import receipt, enforcing a strict execution boundary1.

## **Threat Model and Supply Chain Security**

The hybrid architecture introduces unique threat vectors spanning centralized metadata compromise, P2P network manipulation, and local client exploitation. The design relies heavily on TUF principles and content-addressed storage to mitigate these risks.

| Threat Category | Specific Attack Vector | Architectural Mitigation |
| :---- | :---- | :---- |
| **Centralized Metadata** | **Rollback / Freeze Attacks:** An attacker compromises the catalog and serves a legitimate, but severely outdated manifest containing known vulnerabilities7. | The mandatory expiration field and TUF-style versioning prevent the client from accepting outdated metadata7. Threshold signatures ensure a single compromised key cannot forge metadata31. |
| **Centralized Metadata** | **Mix-and-Match Attacks:** An attacker presents clients with a view of a repository that includes files that did not exist there together at the same time26. | The manifest binds the artifact checksum, tokenizer checksum, and configuration checksum together, preventing arbitrary swapping of model components. |
| **P2P Network** | **Data Poisoning:** Malicious peers attempt to serve corrupted bytes or malware embedded within the tensor data. | The BLAKE3 root hash is secured via the signed manifest. Any deviation in the bytes served by a peer is caught instantly during the 1KiB chunk verification via verified streaming8. |
| **P2P Network** | **Eclipse Attacks:** An attacker attempts to isolate a client by surrounding them with malicious nodes. | Iroh utilizes a closed, explicitly dialed "cozy network" via tickets10. Clients only dial the specific node\_id listed in the signed manifest. Random inbound peers cannot push data to the client. |
| **Local Client** | **Path Traversal:** Malicious metadata instructs the client to write files to arbitrary system directories (e.g., ../../etc/passwd)24. | The local verifier must strictly sanitize all file paths. The system relies on cryptographically bound local import receipts rather than arbitrary file paths for execution1. |

## **Legal and Liability Boundaries**

Distributing machine learning models—especially those subject to varying open-source or acceptable-use licenses—carries distinct legal implications. The architecture enforces strict liability boundaries to protect the MiniModel project and its users.

| Liability Concern | Architectural Enforcement |
| :---- | :---- |
| **Endorsement & Liability** | MiniModel.org acts purely as a metadata directory. The presence of a manifest does not constitute an endorsement of the model's safety, accuracy, or copyright status2. |
| **License Preservation** | The manifest enforces the inclusion of an spdx\_expression. By relying on the standardized SPDX vocabulary, downstream users and automated compliance tools can clearly parse licensing obligations without ambiguity23. |
| **User Responsibility** | Because MiniModel servers never proxy the bytes, the actual data transfer occurs directly between users. The client software must present an explicit consent prompt detailing the source peer and the license before establishing a connection. |
| **Takedown Compliance** | MiniModel.org must maintain a published takedown procedure for DMCA or safety violations. If a takedown is executed, the manifest is revoked and removed from the catalog. Because the client requires a valid manifest to initiate the download, removing the manifest effectively halts all new P2P discovery for that model. |

## **Documentation Strategy**

Clear separation of documentation concerns prevents confusion between the governance of the catalog and the execution of the models. The project must maintain distinct documentation hubs tailored to specific audiences1.

| Domain | Target Audience | Content Scope | Omissions |
| :---- | :---- | :---- | :---- |
| **MiniModel.org** (The Catalog Layer) | Model consumers, dataset providers, legal compliance teams, researchers. | Manifest JSON schemas, API endpoints for fetching metadata, TUF root key publication, acceptable use policies, DMCA/takedown contact routes, and the directory of available models. | Must not contain runtime compilation guides, Rust benchmarks, or local execution tutorials. |
| **MiniModel.MiRust.com** (The Developer Layer) | Systems engineers, Rust developers, enterprise architects3. | Core MiRust framework concepts, TinyRustLM architecture, SLM1 binary format specifications1, Iroh-blobs integration tutorials, memory management strategies, and the Safetensors conversion pipeline. | Should not host the model manifests or manage the P2P networking catalog. |

## **Automated Test Plan and Implementation Checklist**

Attempting to build the entire P2P ecosystem simultaneously introduces unmanageable risk. The architecture must be rolled out in strategic phases, supported by a rigorous suite of automated tests to ensure the resilience of the Rust-first ecosystem.

### **Phased Roadmap and Implementation Checklist**

| Phase | Goal | Implementation Checklist |
| :---- | :---- | :---- |
| **Phase 1: Local Bootstrapping** | Establish the cryptographic primitives and core SLM1 verification logic without centralized routing. | 1\. Initialize iroh::Endpoint and BlobsProtocol for inbound/outbound transfer9. 2\. Implement the SLM1 binary parser to validate tensor bounds1. 3\. Construct the local receipt generator using postcard for zero-allocation binary serialization. |
| **Phase 2: Metadata Registry** | Launch MiniModel.org as the central TUF-inspired trust anchor. | 1\. Define the Rust struct for the Manifest using serde with strict deserialization bounds. 2\. Integrate ed25519-compact or aws-lc-rs for high-performance signature verification41. 3\. Integrate Iroh Magicsock relays globally to ensure NAT traversal12. |
| **Phase 3: Swarm Scaling** | Ensure high availability of popular models via decentralized seeding. | 1\. Implement "opt-in" community seeding in the CLI. 2\. Develop the interactive prompt that renders the spdx\_expression and requires explicit y/N consent prior to network dialing. 3\. Implement asynchronous progress bars utilizing Iroh's DownloadProgress streams43. |
| **Phase 4: Advanced Provenance** | Provide enterprise-grade verifiable builds and provenance. | 1\. Integrate in-toto attestations and Sigstore transparency logs into the admission\_evidence field3. 2\. Automate SPDX license validation against the SPDX License List27. |

### **Automated Testing Methodology**

To validate the security constraints, the system requires continuous integration testing across multiple threat vectors:

| Test Category | Testing Methodology & Scenarios |
| :---- | :---- |
| **Manifest Validation** | **Malformed JSON:** Feed fuzz-tested, malformed JSON structures into the manifest parser to ensure it fails gracefully without panicking. **Path Traversal:** Inject manifests containing ../ sequences in the model\_id to verify the parser strictly rejects them, mitigating CVE-2026-6968 style attacks24. |
| **Tamper Detection** | **Poisoned Peer Simulation:** Create a mock Iroh provider that serves correct metadata but flips a single bit in a random 1KiB chunk during transfer. The test must verify that the client catches the BLAKE3 hash mismatch, drops the connection, and reports an error without persisting corrupted data8. |
| **Network Resilience** | **Bad Peer Metadata:** Provide an invalid iroh\_ticket or unreachable relay\_url. Ensure the Magicsock implementation times out gracefully without blocking the main async runtime12. |
| **Artifact Lifecycle** | **Execution Prevention:** Attempt to load an .slm file into TinyRustLM that lacks a valid import receipt, ensuring the runtime throws a definitive security exception, proving the execution boundary1. |

The architecture designed for the MiniModel P2P exchange successfully isolates the centralized metadata infrastructure from the heavy, liability-prone transfer of model bytes. By leveraging iroh-blobs for verified streaming over QUIC and wrapping it in a TUF-inspired, strictly typed Rust manifest, the system achieves enterprise-grade supply chain security. It completely mitigates risks associated with malicious proxies, rollback attacks, and arbitrary code execution during import. This phased implementation plan ensures that the MiniModel ecosystem can scale sustainably, maintaining uncompromising performance and security for the TinyRustLM community.

#### **Works cited**

1. Framework \- MiRust, [https://mirust.com/framework/](https://mirust.com/framework/)  
2. Terms \- MiRust, [https://mirust.com/terms/](https://mirust.com/terms/)  
3. Enterprise \- MiRust, [https://mirust.com/enterprise/](https://mirust.com/enterprise/)  
4. Research \- MiRust, [https://mirust.com/research/](https://mirust.com/research/)  
5. tuf/docs/METADATA.md at develop · lixuefeng2/tuf \- GitHub, [https://github.com/lixuefeng2/tuf/blob/develop/docs/METADATA.md](https://github.com/lixuefeng2/tuf/blob/develop/docs/METADATA.md)  
6. Metadata — TUF documentation \- Read the Docs, [https://theupdateframework.readthedocs.io/en/v0.18.1/api/tuf.api.metadata.html](https://theupdateframework.readthedocs.io/en/v0.18.1/api/tuf.api.metadata.html)  
7. The Update Framework Specification, [https://theupdateframework.github.io/specification/latest/](https://theupdateframework.github.io/specification/latest/)  
8. Blobs \- Iroh Docs, [https://docs.iroh.computer/protocols/blobs](https://docs.iroh.computer/protocols/blobs)  
9. iroh\_blobs \- Rust \- Docs.rs, [https://docs.rs/iroh-blobs/latest/iroh\_blobs/](https://docs.rs/iroh-blobs/latest/iroh_blobs/)  
10. AltSendme | Best of JS, [https://classic.bestofjs.org/projects/alt-sendme](https://classic.bestofjs.org/projects/alt-sendme)  
11. WillSearch – GuardianDB. A peer-to-peer database for the Decentralized Web., [https://www.willsearch.com.br/](https://www.willsearch.com.br/)  
12. The Architecture Behind Datum Desktop | Datum Cloud Blog, [https://www.datum.net/blog/introducing-datum-desktop](https://www.datum.net/blog/introducing-datum-desktop)  
13. quinn \- Rust \- Docs.rs, [https://docs.rs/quinn/latest/quinn/](https://docs.rs/quinn/latest/quinn/)  
14. GitHub \- quinn-rs/quinn: Async-friendly QUIC implementation in Rust, [https://github.com/quinn-rs/quinn](https://github.com/quinn-rs/quinn)  
15. AutoNATv2 implementation for rust-libp2p · Issue \#1421 · filecoin-project/devgrants \- GitHub, [https://github.com/filecoin-project/devgrants/issues/1421](https://github.com/filecoin-project/devgrants/issues/1421)  
16. The Wisdom of Iroh \- LambdaClass Blog, [https://blog.lambdaclass.com/the-wisdom-of-iroh/](https://blog.lambdaclass.com/the-wisdom-of-iroh/)  
17. guardian-db \- Lib.rs, [https://lib.rs/crates/guardian-db](https://lib.rs/crates/guardian-db)  
18. GitHub \- holepunchto/hyperbee: An append-only B-tree running on a Hypercore, [https://github.com/holepunchto/hyperbee](https://github.com/holepunchto/hyperbee)  
19. Dat (software) \- Grokipedia, [https://grokipedia.com/page/Dat\_(software)](https://grokipedia.com/page/Dat_\(software\))  
20. Holepunch hiring Senior Node.js Software Engineer (100% Remote, Worldwide), [https://himalayas.app/companies/holepunch/jobs/senior-node-js-software-engineer-100-remote-worldwide](https://himalayas.app/companies/holepunch/jobs/senior-node-js-software-engineer-100-remote-worldwide)  
21. GitHub \- holepunchto/hypercore: Hypercore is a secure, distributed append-only log., [https://github.com/holepunchto/hypercore](https://github.com/holepunchto/hypercore)  
22. Mathias Buus Madsen on Building Apps Without AWS Using Peer-to-Peer and Pear Runtime \- Semaphore, [https://semaphore.io/blog/mathias-buus-madsen](https://semaphore.io/blog/mathias-buus-madsen)  
23. Software Package Data Exchange \- Wikipedia, [https://en.wikipedia.org/wiki/Software\_Package\_Data\_Exchange](https://en.wikipedia.org/wiki/Software_Package_Data_Exchange)  
24. CVE-2026-6968 Detail \- NVD, [https://nvd.nist.gov/vuln/detail/CVE-2026-6968](https://nvd.nist.gov/vuln/detail/CVE-2026-6968)  
25. CVE-2026-6967 Detail \- NVD, [https://nvd.nist.gov/vuln/detail/CVE-2026-6967](https://nvd.nist.gov/vuln/detail/CVE-2026-6967)  
26. Security | TUF \- The Update Framework, [https://theupdateframework.io/docs/security/](https://theupdateframework.io/docs/security/)  
27. spdx-tutorial/README.md at master \- GitHub, [https://github.com/david-a-wheeler/spdx-tutorial/blob/master/README.md](https://github.com/david-a-wheeler/spdx-tutorial/blob/master/README.md)  
28. Annex D SPDX license expressions (Normative), [https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/](https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/)  
29. SPDX License Expressions \- Fedora Docs, [https://docs.fedoraproject.org/en-US/legal/spdx/](https://docs.fedoraproject.org/en-US/legal/spdx/)  
30. Handling License Info \- SPDX, [https://spdx.dev/learn/handling-license-info/](https://spdx.dev/learn/handling-license-info/)  
31. Secure Software Updates via TUF — Part 2 | by Prashanth Mulgundmath | Medium, [https://medium.com/@mulgundmath/secure-software-updates-via-tuf-part-2-412c6a2b10ab](https://medium.com/@mulgundmath/secure-software-updates-via-tuf-part-2-412c6a2b10ab)  
32. PEP 458 – Secure PyPI downloads with signed repository metadata \- Python Enhancement Proposals, [https://peps.python.org/pep-0458/](https://peps.python.org/pep-0458/)  
33. Model formats \- Hugging Face, [https://huggingface.co/docs/diffusers/using-diffusers/other-formats](https://huggingface.co/docs/diffusers/using-diffusers/other-formats)  
34. Load safetensors \- Hugging Face, [https://huggingface.co/docs/diffusers/main/using-diffusers/using\_safetensors](https://huggingface.co/docs/diffusers/main/using-diffusers/using_safetensors)  
35. Common AI Model Formats \- Hugging Face, [https://huggingface.co/blog/ngxson/common-ai-model-formats](https://huggingface.co/blog/ngxson/common-ai-model-formats)  
36. Convert Hugging Face Safetensors to MediaPipe Task | Gemma \- Google AI for Developers, [https://ai.google.dev/gemma/docs/conversions/hf-to-mediapipe-task](https://ai.google.dev/gemma/docs/conversions/hf-to-mediapipe-task)  
37. tough \- Rust \- Docs.rs, [https://docs.rs/tough](https://docs.rs/tough)  
38. CVE-2022-29173: No protection against rollback attacks in go-tu… | O3 Security, [https://o3.security/vulnerability/CVE-2022-29173](https://o3.security/vulnerability/CVE-2022-29173)  
39. Secure Software Updates via TUF — Part 1 | by Prashanth Mulgundmath | Medium, [https://medium.com/@mulgundmath/secure-software-updates-via-tuf-part-1-f9bbb34bcbbc](https://medium.com/@mulgundmath/secure-software-updates-via-tuf-part-1-f9bbb34bcbbc)  
40. n0-computer/iroh-blobs: Blobs layer for iroh \- GitHub, [https://github.com/n0-computer/iroh-blobs](https://github.com/n0-computer/iroh-blobs)  
41. Cryptography — list of Rust libraries/crates // Lib.rs, [https://lib.rs/cryptography](https://lib.rs/cryptography)  
42. Labels · n0-computer/iroh · GitHub, [https://github.com/n0-computer/iroh/labels/feat](https://github.com/n0-computer/iroh/labels/feat)  
43. iroh-blobs v0.90 \- The Upgrade Guide, [https://www.iroh.computer/blog/iroh-blobs-0-90-changes](https://www.iroh.computer/blog/iroh-blobs-0-90-changes)  
44. Route away from experimental to 1.0 · Issue \#274 · sigstore/sigstore-rs \- GitHub, [https://github.com/sigstore/sigstore-rs/issues/274](https://github.com/sigstore/sigstore-rs/issues/274)
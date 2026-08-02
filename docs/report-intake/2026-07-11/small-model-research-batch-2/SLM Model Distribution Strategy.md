# **Strategic Ecosystem Distribution and Provenance Architecture for Small Language Models (.slm)**

The proliferation of micro language models and edge-native local inference necessitates a highly resilient, mathematically verifiable, and operationally transparent distribution architecture. Operating strictly within the technical constraints of the browser sandbox, strict WebAssembly (WASM) memory ceilings, and decentralized peer-to-peer (P2P) topologies requires a distribution framework that treats Small Language Models (SLMs) not as opaque files, but as verified, content-addressed artifacts. This analysis provides the exhaustive technical specifications required for validation, local inference, safe browser storage, NuGet packaging, and P2P sharing, meticulously engineered to protect proprietary authoring boundaries while fostering an open developer ecosystem.

## **Ecosystem Authority Map and Proprietary Boundaries**

Establishing a resilient distribution ecosystem requires mathematically defining the boundaries between public interfaces and private commercial orchestration. The system adheres to a strict fail-closed philosophy, ensuring that public validation layers consume only immutable, cryptographically verified assets while proprietary intelligence remains completely obscured from the ecosystem edge.

| Distribution Domain | Publicly Verifiable Ecosystem Interfaces | Isolated Private Intellectual Property |
| :---- | :---- | :---- |
| **Model Artifacts** | Custom .slm v1 containers, public quantization formats (f32, q8\_0, q4\_0), 108-byte header specifications, tensor schemas1. | Trained weights (premium), model-authoring datasets, proprietary tuning recipes, offline breeding logic. |
| **Distribution & P2P** | BEP-52 style SHA-256 chunk hashing, peer announcements, Kademlia Distributed Hash Table (DHT) discovery2. | Premium routing paths, commercial optimization logic, enterprise orchestration, bandwidth telemetry backends. |
| **Provenance** | SLSA v1.0 attestations, in-toto JSON envelopes, Software Bill of Materials (SBOMs), deterministic build receipts4. | License-server internals, evaluation/provenance authoring internals, private signing material, credential pipelines. |
| **Runtime & Memory** | Raw WebAssembly (WASM) ABI, 128 MiB transfer limits, explicit error code contracts, scalar execution boundaries6. | Optimizer logic, adapter auto-assembly heuristics, structural policy selectors, dynamic resident-set tuning, model ranking. |
| **Packaging** | NuGet dependencies, SourceLink integration, public symbols (.snupkg), version tags, ecosystem metadata8. | Internal conversion implementations, quantization authoring tools, continuous integration and deployment (CI/CD) orchestration internals. |

This boundary enforcement guarantees that developers can securely validate, load, and execute .slm models locally without possessing the capacity to reconstruct the commercial intelligence that generated them. Authority is intentionally fragmented across the architecture: MiniModel.org acts as the primary metadata index and ecosystem hub, TinyRustLM governs the execution runtime and container format, and UAIX.org serves strictly as the underlying routing and ISP network without conflating authority10.

## **Content-Addressed Identity and Idempotent Resolution**

Traditional distribution architectures rely on filenames or uniform resource locators (URLs) to identify assets, exposing the system to substitution attacks and mirror drift. Within the MiniModel and P2P ecosystem, identity is strictly content-addressed, rendering filenames entirely irrelevant to the trust model.  
The core identity of any .slm artifact is defined by a SHA-256 hash of the complete, uncompressed binary container. However, for efficient P2P distribution, this macroscopic hash is insufficient. The architecture implements a Merkle tree of SHA-256 hashes constructed over standardized 16 KiB blocks of the artifact, heavily inspired by the BitTorrent v2 (BEP-52) specification2. The root hash of this Merkle tree serves as the immutable, permanent identity of the model.  
This content-addressed architecture guarantees idempotency that survives untrusted mirrors. When a client requests a model, it queries the network for the Merkle root. Regardless of whether the responding peer has renamed the file or modified its local headers, the incoming 16 KiB blocks are continuously validated against the cryptographic proof provided in the manifest. If the calculated hash of the block does not match the expected leaf in the Merkle tree, the block is instantly discarded. This allows the system to pull data safely from zero-trust environments, guaranteeing that the assembled model in local storage is bit-for-bit identical to the authorized commercial release.

## **Public .slm Artifact Manifest Schema**

The TinyRustLM ecosystem utilizes a highly optimized .slm v1 container format. The parser validates a 108-byte header, an embedded tokenizer section (supporting BTOK or BPE1), and 64-byte tensor directory entries mapped to specific data types and shapes1. Crucially, the internal checksum embedded within this container at byte offset 100 is non-cryptographic; it is designed merely to detect accidental corruption during local memory transfers1. Consequently, an external cryptographic manifest is absolutely required to establish authenticity and provenance.  
The public .slm manifest utilizes the Supply-chain Levels for Software Artifacts (SLSA) v1.0 specification, encapsulated within an in-toto Statement/v1 JSON envelope4. This decoupled metadata strategy permits automated policy engines to evaluate runtime compatibility, context tiers, and quantization profiles before initiating any memory allocation or network transfer6.

JSON  
{  
  "\_type": "https://in-toto.io/Statement/v1",  
  "subject": \[  
    {  
      "name": "tinylm-16m-q8\_0.slm",  
      "digest": {  
        "sha256": "c3919e6d7244890e9b3c2b5e40c37f8d322467d859c15b8155700f20408db950"  
      }  
    }  
  \],  
  "predicateType": "https://slsa.dev/provenance/v1",  
  "predicate": {  
    "buildDefinition": {  
      "buildType": "https://tinyrustlm.com/buildtypes/slm-conversion/v1",  
      "externalParameters": {  
        "sourceRevision": "a1b2c3d4e5f67890abcdef1234567890abcdef12",  
        "conversionProfile": "q8\_0",  
        "tokenizerIdentity": "BPE1",  
        "contextTier": 512  
      },  
      "resolvedDependencies": \[  
        {  
          "uri": "pkg:generic/tinylm-16m-f32.safetensors",  
          "digest": { "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }  
        }  
      \]  
    },  
    "runDetails": {  
      "builder": {  
        "id": "https://github.com/placeholder-org/tinyrustlm-ci"  
      },  
      "metadata": {  
        "invocationId": "7346829103",  
        "startedOn": "2026-07-11T12:00:00Z",  
        "finishedOn": "2026-07-11T12:05:00Z"  
      }  
    },  
    "artifactMetadata": {  
      "license": "O-UDA-1.0",  
      "tensorInventory": {  
        "count": 142,  
        "alignment": 64  
      },  
      "promptFormat": "\<|im\_start|\>user\\n{prompt}\<|im\_end|\>\\n\<|im\_start|\>assistant\\n",  
      "capabilities": \["Runtime execution smoke", "Parser and ABI regression"\],  
      "quantization": "q8\_0",  
      "bytes": 17160000,  
      "runtimeCompatibility": "tinyrustlm-runtime-0.1.0",  
      "evaluationReceipt": "https://minimodel.org/evals/c3919e6d7244890e9b3c2b5e40c37f8d322467d859c15b8155700f20408db950.json"  
    }  
  }  
}

This manifest provides a comprehensive provenance chain. The resolvedDependencies field explicitly links the quantized artifact to its foundational trained source, ensuring that lineage can be audited without exposing the raw premium weights to the public internet. The schema explicitly declares the prompt format, runtime compatibility, and tensor alignment required for precise local execution.

## **Signed Metadata and Zero-Trust Key Rotation**

Preserving the integrity of the ecosystem requires a cryptographically sound signature strategy for the aforementioned manifests. Traditional public key infrastructure poses immense risks; distributing a long-lived private signing key across automated commercial orchestration systems exposes the intellectual property to catastrophic credential leakage.  
The architecture instead deploys a keyless signing infrastructure mirroring the Sigstore model (Fulcio and Rekor) tailored to the .slm ecosystem12. During the automated release process, the secure build environment generates a short-lived ephemeral keypair. An OpenID Connect (OIDC) token is utilized to prove the identity of the specific continuous integration runner to an internal Certificate Authority. The authority issues a short-lived certificate bound to that ephemeral key, appending the record to a cryptographic transparency log.  
The manifest is signed using this ephemeral key within a Dead Simple Signing Envelope (DSSE)14. Because the signing key expires within minutes of the artifact's generation, key rotation is rendered obsolete by design. The transparency log provides immutable proof that the signature was generated during the precise window of the certificate's validity12. Consequently, private signing material is never stored permanently, model-encryption keys are entirely avoided, and license-server internals remain isolated behind the commercial perimeter.

## **Peer-to-Peer Distribution Semantics**

The MiniModel.org product ecosystem leverages a robust peer-to-peer network to distribute the bandwidth costs of multi-megabyte language models and improve availability at the network edge. The system integrates standard P2P discovery algorithms with the strict security requirements of executable machine intelligence.

### **DHT Announcement and Peer Reputation**

Peer discovery relies on a Kademlia Distributed Hash Table (DHT), where model identities (Merkle roots) and peer addresses are mapped using an XOR distance metric3. When a local client successfully validates and commits a new .slm model to its local storage, it generates an announcement to the DHT, advertising itself as a seed for that specific content hash.  
The importation and validation of models occur concurrently. As a client begins fetching 16 KiB chunks from discovered peers, it computes the SHA-256 hash of each chunk and compares it against the Merkle tree provided in the SLSA manifest2. The peer reputation system operates on a zero-tolerance policy. If a peer provides a chunk that fails the cryptographic check, the connection is instantly severed, the invalid chunk is purged from temporary memory, and the offending peer's IP address is locally blacklisted from further routing requests.

### **Deduplication, Resumption, and the Share-Kit**

The custom SLM1 format requires 64-byte alignment for tensor payloads1. This deterministic structure heavily benefits the P2P deduplication mechanics. Different quantized versions of the same model family (e.g., a q4\_0 and a q8\_0 variant) will often share identical tokenizer blocks or embedding matrices. Because the P2P layer operates on content-addressed chunks rather than full files, clients downloading multiple quantization variants will automatically deduplicate identical chunks, drastically reducing bandwidth consumption2.  
To accelerate network growth, developers can integrate a WebAssembly-based share-kit into their browser applications. When an end-user runs a model locally, the share-kit optionally leverages WebRTC to serve cached chunks to other peers in the swarm. Network resumption is inherently supported; if a user closes their browser mid-download, the next session simply scans the local storage, verifies the hashes of existing chunks, and requests only the missing blocks from the DHT.

### **Supersession, Tombstones, and Revocation**

The decentralized nature of P2P networks complicates artifact revocation. To address models that exhibit critical hallucinations, security vulnerabilities, or licensing violations, the ecosystem employs a tombstone mechanic.  
When a model must be revoked, the authoritative MiniModel signature system publishes a cryptographically signed tombstone manifest to the index. When peers query the DHT or the MiniModel index for the original model hash, they receive the tombstone instead. The tombstone explicitly instructs the client to halt all sharing of the specified hash and provides a supersession pointer to a patched version of the model. Because all clients require a valid, non-revoked SLSA manifest to initiate the model-load transaction, the revoked artifact is swiftly starved of network participation and organically flushed from the swarm.

## **Safe Browser Storage and Atomic Promotion**

Executing .slm files within the browser requires navigating stringent memory limitations. The TinyRustLM implementation defines strict allocation formulas: forward scratch memory requires 4 × (10H \+ 3F \+ C) bytes, and the Key-Value (KV) cache strictly requires 2 × L × C × K × D × 4 bytes6. For a standard TinyLM-16M shaped model, the KV cache alone demands precisely 8,388,608 bytes, and the total host transfer can reach up to 128 MiB6. Given the single-threaded nature of the scalar CPU execution on the main browser thread1, isolating the storage and transfer mechanisms is critical to maintaining a responsive user interface.

### **OPFS Integration and Multi-Tab Coordination**

The Origin Private File System (OPFS) is the primary storage endpoint for the ecosystem, providing highly optimized, byte-level file access that avoids intrusive user permission prompts and bypasses the performance penalties of traditional IndexedDB serialization16. However, OPFS exposes its high-performance synchronous API (createSyncAccessHandle()) exclusively within Web Workers18.  
To safely store and load models, the architecture deploys dedicated Web Workers to handle the P2P chunk downloading and file writing. Before any download begins, a quota preflight check interfaces with the navigator.storage.estimate() API to ensure sufficient disk space exists for both the .slm file and the required staging overhead16.  
A significant architectural challenge involves multi-tab coordination. OPFS access handles place an exclusive lock on the file20. If a user opens the application in two tabs simultaneously, the second tab will encounter a locking error upon attempting to read the model21. To orchestrate safe concurrency, the implementation utilizes the Web Locks API (navigator.locks)17. A designated leader worker acquires the lock, loads the model, and coordinates memory transfers to follower tabs via a BroadcastChannel or SharedWorker pattern. If OPFS is unavailable—such as in older browsers or strict incognito environments—the storage engine elegantly degrades to IndexedDB using a batched atomic virtual file system (IDBBatchAtomicVFS), ensuring the application remains functional despite reduced performance20.

### **Atomic Promotion State Machine**

To prevent corrupted or partially downloaded artifacts from poisoning the local cache and causing WASM panics, the storage system strictly enforces an atomic promotion state machine.

1. **Quota Preflight & Staging:** The system verifies disk space and begins downloading P2P chunks into a volatile staging directory.  
2. **Partial Download & Hash Assembly:** Chunks are written out of order as they arrive. The Merkle tree is continuously updated.  
3. **Admission Validation:** Once all chunks are present, a lightweight WASM parser inspects the staged file. It verifies the 108-byte header, confirms the 64-byte tensor alignment, checks the matrix data types, and validates the non-cryptographic internal checksum1.  
4. **Atomic Promotion:** Only upon successful admission validation is the file moved from the staging directory to the persistent OPFS model cache.  
5. **Rollback:** If any validation check fails, the transaction is rolled back, the staging file is purged, and the system attempts to re-fetch the corrupted chunks from a different P2P neighbor.

This ensures that the 128 MiB transfer ceiling6 is never breached by malformed files, preserving the integrity of the model-load transaction6.

## **NuGet Packaging and Supply-Chain Controls**

To facilitate enterprise adoption and integration into .NET desktop and backend infrastructure, the Rust native wrappers, .slm validation logic, and memory connector APIs are distributed via the NuGet package manager. The packaging strategy must overcome the complexities of distributing native unmanaged binaries across diverse operating systems while maintaining strict supply-chain controls.

### **Native Wrapper Topologies**

The distribution requires a carefully orchestrated package matrix to separate the execution engine from the P2P networking logic. The core computational package (MiniModel.TinyRustLM.Native) encapsulates the compiled Rust dynamic link libraries (.dll, .so, .dylib). To ensure these native binaries are correctly copied to the build output directory of the consuming application, they must be explicitly placed within the runtimes/{rid}/native/ directory structure inside the .nupkg archive24. This ensures that MSBuild automatically resolves the correct architecture-specific binary during the compilation and publishing phases without requiring fragile post-build scripts.  
The managed C\# abstractions (MiniModel.TinyRustLM.Core) are placed within the lib/net8.0/ directories. These abstractions provide ergonomic, strongly-typed interfaces to the raw WebAssembly ABI, abstracting the manual memory allocation and explicit error code contracts1. Separate packages are maintained for the MiniModel.p2pRuntime (Kademlia DHT and Merkle tree validation) and the browser memory harness.

### **Deterministic Builds, SourceLink, and Symbol Verification**

The supply-chain controls enforced upon the NuGet publishing pipeline are exhaustive.

* **Deterministic Builds:** The build infrastructure enforces bit-for-bit reproducible builds by injecting the \<ContinuousIntegrationBuild\>true\</ContinuousIntegrationBuild\> property into the MSBuild pipeline. This normalizes embedded file paths, ensuring that identical source code produces identical binary hashes regardless of the specific CI runner executing the build8.  
* **SourceLink Integration:** To enhance developer experience without compromising the integrity of the production binaries, Microsoft.SourceLink.GitHub is integrated into the build process. This embeds the exact Git commit SHA and repository URL directly into the assembly metadata, allowing modern debuggers to seamlessly fetch the exact source code during execution9.  
* **Symbol Strategy:** Debug symbols (.pdb) are explicitly excluded from the primary package to reduce bandwidth. Instead, they are packaged into a supplementary Symbol Package (.snupkg) and pushed to a symbol server9. This allows enterprise developers to opt-in to deep diagnostics without bloating the runtime footprint for production users.  
* **Package Signing:** All official NuGet packages are signed with an X.509 code-signing certificate (RSA 2048-bit minimum) and include an RFC 3161 timestamp27. The timestamp guarantees that the signature remains valid indefinitely, even after the original signing certificate expires, providing long-term non-repudiation for the ecosystem28. A comprehensive SPDX Software Bill of Materials (SBOM) is generated during compilation and attached to the release metadata, fulfilling enterprise dependency audit requirements5.

## **Discoverability, Naming Taxonomy, and Optional Hugging Face Mirroring**

A fragmented ecosystem breeds confusion and security vulnerabilities. Public naming and discoverability across the various platforms must strictly demarcate authority.

* **UAIX.org:** Represents the ISP and routing infrastructure. It implies no authority over the models themselves10.  
* **TinyRustLM:** Represents the low-level execution environment, the SLM1 container specification, and the raw WASM ABI. It is the authority on memory boundaries and tensor mathematics.  
* **MiniModel.org:** Serves as the primary product ecosystem, hosting the authoritative metadata index, the tombstone ledger, and the public conformance samples30.  
* **Package Namespaces:** NuGet packages strictly follow the MiniModel.\* prefix (e.g., MiniModel.p2pRuntime, MiniModel.Wasm.Browser) to assure developers of their origin and intended compatibility.

### **The Hugging Face Cold-Storage Mirror**

While Hugging Face is the dominant platform for machine learning models, within this architecture, it is relegated to an optional, secondary public mirror. It acts as a high-availability cold-storage endpoint after release qualification, never as an automatic upload destination or a primary source of truth.  
The Hugging Face repository layout remains entirely flat. It hosts the raw .slm artifacts utilizing Git Large File Storage (LFS) to accommodate the multi-megabyte files. The SLSA .intoto.jsonl manifests are stored alongside the models. The repository README.md (the Model Card) explicitly states that the repository is a mirror, directing developers to MiniModel.org for the latest tombstones, P2P integrations, and runtime instructions.  
Synchronization with Hugging Face is strictly managed via revision pinning. An automated process maps the immutable source revision from the SLSA manifest to a specific Git tag on the Hugging Face repository. This prevents mirror drift, ensuring that the Hugging Face state is always a perfectly synchronized reflection of a specific, approved MiniModel release.

## **Defensive Validation and Threat Modeling**

The architectural design operates under the assumption of a deeply hostile environment, analyzing threat models ranging from malicious peers to credential leakage. The system defines explicit fail-closed behaviors for all anomalies.

| Threat Vector | Mechanism of Attack | Fail-Closed Defensive Mitigation |
| :---- | :---- | :---- |
| **Hash Confusion & Malicious Peers** | A malicious node on the UAIX network intentionally injects corrupted 16 KiB chunks designed to cause buffer overflows or memory corruption in the WASM parser. | The XOR distance logic only resolves peer routing; it grants no trust. Validation relies strictly on the SHA-256 Merkle root from the signed SLSA manifest2. Any chunk failing the hash check is immediately dropped, and the peer IP is locally blacklisted. |
| **Manifest Path Traversal & Zip Bombs** | A crafted .slm file contains header lengths or tensor directory entries pointing to relative paths (../../) or expanding into terabytes of null bytes to exhaust storage1. | The parser utilizes fixed 64-byte directory entries and enforces absolute offsets strictly bounded by the 128 MiB transfer ceiling1. If a calculated offset exceeds the declared container length, the transaction aborts instantly. |
| **Tokenizer Injection** | Attackers modify the BTOK or BPE1 embedded dictionaries to execute arbitrary cross-site scripting (XSS) when rendered in the browser DOM1. | The tokenizer vocabulary is strictly parsed as UTF-8 plaintext1. The evidence separation plane isolates the generation transaction from the HTML presentation layer, preventing code execution6. |
| **Rollback & Stale Announcements** | An attacker intercepts network traffic and provides a valid but older, vulnerable version of a model, bypassing current security patches. | The runtime queries the append-only Tombstone ledger on MiniModel.org before initiating load. If the model's hash is listed as superseded, the load is aborted, mitigating downgrade attacks. |
| **License Substitution** | An adversary repackages a proprietary .slm with an open-source manifest, tricking developers into violating commercial licenses. | The SLSA manifest explicitly binds the model's SHA-256 hash to the original licensing terms4. Modifying the license requires resigning the manifest, which will fail validation against the official MiniModel public keys. |
| **Symlink / Reparse Attacks** | Malicious processes attempt to swap the .slm file on disk with a symlink pointing to sensitive system files during the atomic promotion phase. | The native abstractions explicitly disable following symlinks during the File I/O operations inside the staging directory, ensuring operations only interact with standard files. |
| **Oversized Tensors** | A model manifest declares a shape that requires excessive memory allocation, targeting a denial of service against the browser tab. | The runtime enforces rigid memory calculation formulas6. If the required forward scratch or KV cache allocations exceed the predefined browser budgets, the load transaction fails safely with an explicit error code6. |

Diagnostics during these failures are designed to be extremely narrow. The system captures the immutable identities (WASM hash, model checksum, browser engine) and classifies the failure stage (e.g., fetch, parser admission, tokenization) without logging sensitive prompt data or proprietary memory states6.

## **Release Gates and Continuous Integration Design**

To strictly protect the commercial ecosystem, absolutely no model artifact, manifest, or NuGet package is published automatically to any public mirror. The CI/CD pipeline enforces a rigid sequence of release gates.

1. **Redistribution Approval:** Automated checks verify that the source licenses and converted-weight redistribution policies permit public exposure.  
2. **Immutable Provenance:** The conversion pipeline successfully emits the cryptographic SLSA v1.0 provenance manifest binding the artifact to its source commit4.  
3. **Cognitive Liberty Charter Gates:** The model undergoes fixed and seeded behavior tests to ensure compliance with predefined safety and liberty directives.  
4. **Execution Parity:** Source-to-quantized first-token and multi-step parity tests execute, mathematically validating that the q8\_0 and q4\_0 variants perform deterministically against the f32 baseline30.  
5. **Runtime Generation Tests:** Both the native .dll and the browser WASM runtimes must successfully generate the diagnostic JSON payload without triggering memory leaks6.  
6. **Malicious Admission Fuzzing:** The parser must successfully reject corrupted .slm headers, truncated files, and oversized tensors without causing a catastrophic WASM panic1.  
7. **Package Verification:** Metadata, repository links, tags, and documentation samples within the .nuspec are validated for completeness.  
8. **Supply Chain Verification:** The system verifies the generation of the SBOM, the deterministic compilation flag, the creation of the .snupkg, and the successful RFC 3161 timestamping of the NuGet signature5.  
9. **Public-Safe Documentation:** A secondary review ensures no internal telemetry URLs, commercial optimization logic, or premium weight routing endpoints are exposed in the public READMEs.  
10. **Explicit Human Authorization:** A designated ecosystem engineer must review the automated test receipts and manually approve the deployment to the DHT, NuGet, and Hugging Face mirrors.

## **Ecosystem Growth Plan and Phased Backlog**

Encouraging developers to adopt, run, and share .slm models requires minimizing friction while maintaining the obscurity of the commercial pipeline. The growth plan utilizes compatibility badges (e.g., "Deterministic Smoke", "Experimental") to manage expectations regarding model quality and runtime stability30.  
To lower the barrier to entry, MiniModel.org distributes tiny runtime fixtures (e.g., models with a parameter count of merely 4,824)30. These fixtures allow developers to rapidly build and debug OPFS storage integration, Web Lock concurrency, and P2P share-kit mechanics without downloading massive production models. The documentation architecture mirrors the strict boundaries of the runtime: explicitly defining the raw WASM ABI, standard error codes, and the precise state transitions required for a successful load transaction6.  
The release cadence operates on a predictable schedule, paired with a strict deprecation policy. Superseded models receive tombstones, and support is systematically phased out to prevent fragmentation.

### **Phased Delivery Backlog**

| Phase | Strategic Objective | Acceptance Criteria |
| :---- | :---- | :---- |
| **Phase 1: Foundation & Packaging** | Establish supply-chain controls and native wrappers. | CI/CD pipelines generate MiniModel.TinyRustLM.Native. MSBuild enforces deterministic builds. SourceLink is active. Unsigned packages publish to an internal staging feed8. |
| **Phase 2: Browser Storage Engine** | Implement safe OPFS memory integration. | Web Workers successfully stream chunks into OPFS using createSyncAccessHandle. Web Locks API successfully prevents cross-tab corruption. IndexedDB fallback logic is verified16. |
| **Phase 3: P2P & Provenance** | Instantiate decentralization and verification. | SLSA v1.0 JSON manifests are generated. BEP-52 Merkle trees validate incoming 16 KiB chunks. Kademlia DHT successfully routes chunk requests across the UAIX overlay2. |
| **Phase 4: Ecosystem Launch** | Public mirror synchronization and cryptographic signing. | X.509 code signing with RFC 3161 timestamps applied to NuGet packages. Tombstone ledger is active. Human-gated syncing to the Hugging Face repository is operational27. |

## **Always-Current Verification Record**

* **UTC Verification Date:** 2026-07-12 02:56:23 UTC (July 11, 2026, 9:56:23 PM CDT).  
* **Findings Record:**  
  * *NuGet Supply Chain:* Verification constraints remain current; X.509 certificates with 2048-bit RSA minimums and RFC 3161 timestamps are the absolute standard for preventing premature package invalidation27. The requirement for runtimes/{rid}/native/ to route native binaries correctly is verified against MSBuild specifications24. Deterministic compilation via \<ContinuousIntegrationBuild\> remains highly recommended8.  
  * *Browser Storage:* OPFS synchronous access (createSyncAccessHandle) remains strictly confined to Web Worker contexts, requiring asynchronous proxying from the main thread16. The Web Locks API remains the architectural standard for preventing cross-tab database corruption, superseding fragile polling mechanisms17.  
  * *Provenance & P2P:* SLSA v1.0 specifications utilizing the in-toto Statement/v1 schema (with distinct subject and predicate objects) are the current standard for supply-chain provenance4. BEP 52 (BitTorrent v2) SHA-256 Merkle tree designs remain the cryptographic standard for granular, streamable file verification in distributed swarms2.  
* **Confidence Level:** Exceptional. All proposed architectures map directly to current, proven systems programming and web-standard capabilities, ensuring a robust, secure, and performant SLM ecosystem.

#### **Works cited**

1. Implementation \- MiRust, [https://mirust.com/implementation/](https://mirust.com/implementation/)  
2. Torrent file \- Wikipedia, [https://en.wikipedia.org/wiki/Torrent\_file](https://en.wikipedia.org/wiki/Torrent_file)  
3. System Design Beginner's Guide: Designing a Peer-to-Peer Network | by bugfree.ai, [https://medium.com/@bugfreeai/system-design-beginners-guide-designing-a-peer-to-peer-network-707a5aa46238](https://medium.com/@bugfreeai/system-design-beginners-guide-designing-a-peer-to-peer-network-707a5aa46238)  
4. Provenance \- SLSA.dev, [https://slsa.dev/spec/v1.0/provenance](https://slsa.dev/spec/v1.0/provenance)  
5. Artifact Provenance and Attestations: From SLSA to in-toto | Secure Pipelines, [https://secure-pipelines.com/ci-cd-security/artifact-provenance-attestations-slsa-in-toto/](https://secure-pipelines.com/ci-cd-security/artifact-provenance-attestations-slsa-in-toto/)  
6. Implementation operations \- MiRust, [https://mirust.com/implementation-operations/](https://mirust.com/implementation-operations/)  
7. Documentation \- MiRust, [https://mirust.com/docs/](https://mirust.com/docs/)  
8. How do I do a deterministic build locally (ContinuousIntegrationBuild flag)? \- Stack Overflow, [https://stackoverflow.com/questions/63388344/how-do-i-do-a-deterministic-build-locally-continuousintegrationbuild-flag](https://stackoverflow.com/questions/63388344/how-do-i-do-a-deterministic-build-locally-continuousintegrationbuild-flag)  
9. Difference between Source Link and a NuGet symbol package \- Stack Overflow, [https://stackoverflow.com/questions/73726413/difference-between-source-link-and-a-nuget-symbol-package](https://stackoverflow.com/questions/73726413/difference-between-source-link-and-a-nuget-symbol-package)  
10. AS-ITS-UAIX \- bgp.he.net, [https://bgp.he.net/irr/as-set/AS-ITS-UAIX](https://bgp.he.net/irr/as-set/AS-ITS-UAIX)  
11. attestation/spec/v1/statement.md at main · in-toto/attestation \- GitHub, [https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md)  
12. Build Security Concepts | Xygeni User Guides, [https://docs.xygeni.io/xygeni-products/build-security/build-security-concepts](https://docs.xygeni.io/xygeni-products/build-security/build-security-concepts)  
13. in-toto attestations \- Trustification, [https://trustification.io/blog/2023/03/13/in-toto-attestations/](https://trustification.io/blog/2023/03/13/in-toto-attestations/)  
14. envelope.md \- in-toto/attestation \- GitHub, [https://github.com/in-toto/attestation/blob/main/spec/v1/envelope.md](https://github.com/in-toto/attestation/blob/main/spec/v1/envelope.md)  
15. In-Toto Attestations \- Sigstore, [https://docs.sigstore.dev/cosign/verifying/attestation/](https://docs.sigstore.dev/cosign/verifying/attestation/)  
16. Origin private file system \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API/Origin\_private\_file\_system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)  
17. 3x faster project loads with the origin private file system \- Between the Barndoors, [https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/](https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/)  
18. LocalStorage vs. IndexedDB vs. Cookies vs. OPFS vs. WASM-SQLite | RxDB \- JavaScript Database, [https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html)  
19. How I Built SqliteWasmBlazor: Bringing Real SQLite with Full EF Core to the Browser, [https://medium.com/@bgsyyxxqs/how-i-built-sqlitewasmblazor-bringing-real-sqlite-with-full-ef-core-to-the-browser-384585f5a657](https://medium.com/@bgsyyxxqs/how-i-built-sqlitewasmblazor-bringing-real-sqlite-with-full-ef-core-to-the-browser-384585f5a657)  
20. The Current State Of SQLite Persistence On The Web: May 2026 Update \- PowerSync, [https://powersync.com/blog/sqlite-persistence-on-the-web](https://powersync.com/blog/sqlite-persistence-on-the-web)  
21. Persistent Storage Options \- SQLite, [https://sqlite.org/wasm/doc/trunk/persistence.md](https://sqlite.org/wasm/doc/trunk/persistence.md)  
22. WASM opfs & multiple tabs \- SQLite User Forum, [https://sqlite.org/forum/info/2719a045c39a4a348920b1ae7800eddc5be53c485a68357675759c404981e421?t=h](https://sqlite.org/forum/info/2719a045c39a4a348920b1ae7800eddc5be53c485a68357675759c404981e421?t=h)  
23. OPFSCoopSyncVFS causes multi-tab deadlocks in Chrome and Safari · Issue \#785 \- GitHub, [https://github.com/powersync-ja/powersync-js/issues/785](https://github.com/powersync-ja/powersync-js/issues/785)  
24. Including native libraries in .NET packages \- NuGet \- Microsoft Learn, [https://learn.microsoft.com/en-us/nuget/create-packages/native-files-in-net-packages](https://learn.microsoft.com/en-us/nuget/create-packages/native-files-in-net-packages)  
25. Multi-targeting for NuGet Packages \- Microsoft Learn, [https://learn.microsoft.com/en-us/nuget/create-packages/supporting-multiple-target-frameworks](https://learn.microsoft.com/en-us/nuget/create-packages/supporting-multiple-target-frameworks)  
26. Can't figure out how to include the source code into the nuget package that gets generated, [https://stackoverflow.com/questions/74757799/cant-figure-out-how-to-include-the-source-code-into-the-nuget-package-that-gets](https://stackoverflow.com/questions/74757799/cant-figure-out-how-to-include-the-source-code-into-the-nuget-package-that-gets)  
27. Package Signatures Technical Details · NuGet/Home Wiki \- GitHub, [https://github.com/NuGet/Home/wiki/Package-Signatures-Technical-Details](https://github.com/NuGet/Home/wiki/Package-Signatures-Technical-Details)  
28. Signed Packages \- NuGet \- Microsoft Learn, [https://learn.microsoft.com/en-us/nuget/reference/signed-packages-reference](https://learn.microsoft.com/en-us/nuget/reference/signed-packages-reference)  
29. Signing NuGet Packages | Microsoft Learn, [https://learn.microsoft.com/en-us/nuget/create-packages/sign-a-package](https://learn.microsoft.com/en-us/nuget/create-packages/sign-a-package)  
30. Models \- MiRust, [https://mirust.com/models/](https://mirust.com/models/)  
31. BEP 52 (BitTorrent v2) support — implementation design · Issue \#546 · ikatson/rqbit \- GitHub, [https://github.com/ikatson/rqbit/issues/546](https://github.com/ikatson/rqbit/issues/546)  
32. Libtorrent 2.0 Is Released With BitTorrent 2.0 Support \- LinuxReviews, [https://linuxreviews.org/Libtorrent\_2.0\_Is\_Released\_With\_BitTorrent\_2.0\_Support](https://linuxreviews.org/Libtorrent_2.0_Is_Released_With_BitTorrent_2.0_Support)
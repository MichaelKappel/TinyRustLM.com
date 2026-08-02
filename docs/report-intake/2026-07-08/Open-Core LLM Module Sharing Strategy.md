# **Architectural Blueprint and Open-Core Strategy for Decentralized Small Language Models**

## **The Paradigm of Decentralized Inference and Open-Core Economics**

The trajectory of artificial intelligence is undergoing a structural realignment, shifting from centralized, monolithic Large Language Models (LLMs) toward decentralized, localized networks of Small Language Models (SLMs). Centralized architectures, while powerful, introduce insurmountable friction regarding inference latency, data sovereignty, and infrastructure capital expenditure. Decentralized, browser-native inference systems offer a compelling alternative, transforming the idle compute capacity of edge devices into a globally distributed computational fabric.1 However, engineering a platform that thrives in this environment presents a profound paradox: the system must be sufficiently open to catalyze widespread community adoption and network effects, yet strategically closed to protect the proprietary intellectual property (IP) that funds advanced research and enterprise commercialization.3  
The open-core business model resolves this tension by bifurcating the software architecture into a permissive, open-source foundation and a proprietary, commercially licensed upper echelon.5 In this framework, the open-source core functions as a massive distribution and research-and-development mechanism, while the proprietary features serve as the monetization arm.3 For a platform resembling the TinyRustLM ecosystem, the overarching strategic imperative is to share the core foundational modules—specifically the peer-to-peer (P2P) networking stack and the .slm model harness—to maximize the number of participating nodes.1 The network's value scales exponentially with user adoption, dictating that any barrier to entry for node operators must be systematically eliminated.9  
This report delivers an exhaustive, source-grounded architectural directive on structuring an open-core decentralized AI system in Rust and WebAssembly (WASM). It defines the exact boundaries of what must be shared to dominate the decentralized SLM ecosystem, what must be withheld to prevent catastrophic IP theft, and the precise software engineering mechanics required to enforce these boundaries at the compiler, runtime, and cryptographic levels.

## **Strategic Module Demarcation: Defining the Open Boundary**

The most critical decision in an open-core AI strategy is the deliberate classification of every module into either the open-source repository or the proprietary commercial registry. Releasing too much undermines the business model, while releasing too little stifles community adoption and starves the P2P network of necessary nodes.5  
The user query highlights the critical nature of the P2P and .slm model harness components. These systems represent the literal connective tissue and the standardized container format of the network. If they are encumbered by commercial licenses, third-party developers will reject the ecosystem in favor of truly open alternatives, resulting in a fragmented, low-liquidity inference network.9  
The architecture must share the baseline execution environment to allow independent researchers to verify determinism, audit memory safety, and build compatible routing interfaces.8 Conversely, the commercial entity must fiercely protect the trained model weights of its premium specialist models, the teleodynamic routing algorithms that orchestrate enterprise-scale swarms, and the in-memory decryption engines that secure enterprise data.4

| Component Category | Specific Module / Subsystem | Open / Proprietary | Strategic Rationale |
| :---- | :---- | :---- | :---- |
| **Model Container & Parsing** | .slm custom v1 format, 108-byte header parsing, tensor directory, shape contracts, and non-cryptographic checksums.15 | Open Source | Standardizes the ecosystem. Developers must be able to convert and package their own models to grow the ecosystem's utility.1 |
| **P2P Networking Fabric** | WebRTC abstraction, Trystero signaling integrations, decentralized peer discovery protocols, and data chunking logic.2 | Open Source | A P2P network requires maximal participation. Proprietary networking layers introduce platform risk and deter autonomous node operation.18 |
| **Core Execution Runtime** | WebAssembly module containing scalar CPU transformer execution, embedding lookup, RMSNorm, causal attention, KV caching, SwiGLU, and logits sampling.1 | Open Source | Allows the community to verify the deterministic execution smoke tests, benchmark performance, and audit memory allocation safety.12 |
| **Tokenization & Quantization** | Byte pair encoding (BPE1) tokenizer, F32, Q8\_0, and Q4\_0 storage and matrix-vector (matvec) dispatch pathways.8 | Open Source | Fundamental building blocks required for any model to function within the runtime. Necessary for third-party compatibility.1 |
| **Tooling & Harnesses** | tinyrustlm-browser-harness, tinyrustlm-local-server, and tinyrustlm-slm-pack conversion tools.16 | Open Source | Lowers the barrier to entry for developers testing local loops, validating .slm admission, and running experimental profiles.12 |
| **Premium Model Weights** | Trained parameters for highly specialized, high-performance task models (e.g., advanced reasoning, zero-knowledge verifiers, medical/legal skill adapters).4 | Proprietary | Represents millions of dollars in compute and curated training data. The primary asset of the monetization arm.3 |
| **Teleodynamic Routing** | Advanced algorithms governing resident-set control, sparse routing, measured resource orchestration, and dynamic skill swapping.1 | Proprietary | Provides enterprise-grade orchestration and efficiency, differentiating the commercial product from the raw community swarm.1 |
| **Security & Decryption Enclaves** | In-memory WASM-in-WASM decryptors, sliding window XOR ciphers, and memory virtualization for confidential stateful execution.14 | Proprietary | Secures enterprise intellectual property from adversarial extraction when deployed to edge nodes.13 |
| **Enterprise Data Controls** | Namespace-level storage quotas, out-of-hierarchy configurations, and strict role-based access control (RBAC).6 | Proprietary | Required for compliance and governance in large-scale corporate deployments, representing classic open-core up-selling vectors.6 |

## **Structuring the Rust Workspace for Open-Core Isolation**

Achieving this strict demarcation requires a meticulously designed Rust codebase. The default approach of many developers—utilizing conditional compilation feature flags (e.g., \#\[cfg(feature \= "enterprise")\]) to separate free and paid code within a single repository—is fundamentally flawed in an open-source context.25 If the enterprise code resides within the public repository behind a feature flag, the source code is entirely visible, destroying the intellectual property protection.27  
To build a professional, unassailable open-core architecture, the software must be split across entirely separate repositories utilizing Rust's Cargo workspace mechanisms, dynamic dispatch, and Foreign Function Interfaces (FFI).29

### **Flat Workspace Topologies and Virtual Manifests**

The open-source repository must be structured as a Cargo workspace. Empirical analysis of large-scale Rust projects indicates that hierarchical, deeply nested tree structures deteriorate over time, leading to inconsistent dependency graphs and maintenance friction.32 A flat workspace topology—where all core crates exist at a single directory depth beneath the root—is significantly easier to audit and maintain.32  
The root directory of the open-source repository should utilize a virtual manifest (a Cargo.toml file that defines the workspace members but contains no source code itself).32 Based on the TinyRustLM snapshot, this manifest consolidates the zero-dependency crates that comprise the foundational open-core system.16  
The open-source virtual manifest defines the following structure:

| Workspace Member | Core Functionality | Supply Chain Posture |
| :---- | :---- | :---- |
| tinyrustlm-runtime | Contains the WebAssembly and native library for the model parser, tokenizer, quantized kernels, execution, and sampling.16 | Zero third-party dependencies to eliminate supply chain poisoning risks.8 |
| tinyrustlm-slm-pack | Validates .slm admission, converts raw trained sources, emits quantized variants, and enforces quality gates.16 | Strict dependency curation; handles all serialization and formatting logic.16 |
| tinyrustlm-local-server | Loopback-only static server supporting GET/HEAD requests, traversal rejection, and content type validation.16 | Isolates HTTP logic from the core runtime, minimizing the attack surface.16 |
| tinyrustlm-browser-harness | Static contract crawler and loopback probe checking required DOM identifiers and WASM call markers.16 | Ensures testing frameworks rely solely on project-owned code.16 |

This architecture ensures that the community can seamlessly build, test, and deploy the foundational network without encountering proprietary roadblocks.29

### **The Proprietary Workspace and the Dependency Inversion Principle**

The commercial entity maintains a secondary, strictly private repository containing the enterprise features, teleodynamic routers, and proprietary model weight decryptors.30 This private workspace treats the open-source repository as a standard upstream dependency.36  
The most profound challenge in this architecture is integrating the proprietary logic into the open-core execution path without the open core knowing of the proprietary code's existence.30 If the open core imports the proprietary crate, the dependency cycle breaks the separation of concerns. This is resolved through the Dependency Inversion Principle, implemented in Rust via traits, dynamic dispatch, and plugin architectures.30  
The open-source tinyrustlm-runtime defines a strict API boundary using public traits. For example, it defines a trait for routing logic, with a default implementation that performs basic, localized P2P broadcasts.  
When an enterprise customer compiles or deploys the system using the proprietary workspace, the proprietary application acts as the host.30 The host application initializes the open-core runtime but injects its advanced, proprietary structs—which implement the open-core traits—into the runtime's configuration at startup.30 The core runtime then executes the injected proprietary logic via dynamic dispatch, remaining completely ignorant of the underlying proprietary implementation.30  
For WebAssembly deployments in the browser, where traditional dynamic linking is constrained, the system can utilize a C-FFI boundary.31 The open core exposes exported functions (e.g., \#\[no\_mangle\] pub extern "C" fn register\_teleodynamic\_hook(...)), allowing a separately loaded proprietary WASM module to attach itself to the runtime execution lifecycle, passing data back and forth through shared linear memory.21

## **Architecting the Decentralized Peer-to-Peer Fabric**

The viability of a decentralized SLM network is entirely dependent on the efficiency, scalability, and accessibility of its peer-to-peer communication fabric. Traditional decentralized AI projects often fail because they require users to download heavy daemons, configure router port forwarding, or stake cryptocurrency tokens to participate.2 To achieve true ubiquitous scale, the network must run frictionlessly within standard web browsers.2  
The open-source networking layer must be designed to facilitate high-throughput, low-latency, and end-to-end encrypted connections without relying on centralized platform infrastructure.18

### **Serverless WebRTC and the Signaling Abstraction**

WebRTC is the definitive protocol for establishing direct, peer-to-peer data channels between browsers.2 It supports NAT traversal and secure UDP communication, bypassing the need for central relay servers for bulk data transfer.39 However, WebRTC possesses a fundamental bootstrapping limitation: it requires a signaling mechanism.39 Before two browsers can connect directly, they must exchange cryptographic keys and network routing information via a Session Description Protocol (SDP) payload.39  
Historically, this required developers to deploy and maintain centralized signaling servers, reintroducing platform risk and centralized failure points.18 The open-core architecture circumvents this by integrating a serverless signaling abstraction layer, utilizing libraries analogous to Trystero.17  
This serverless abstraction layer automates peer discovery by piggybacking the SDP handshakes over existing, public decentralized networks.41 Instead of a central server, the open-core runtime leverages BitTorrent trackers, Nostr relays, or MQTT brokers to locate peers and perform the initial handshake.41 Once the WebRTC connection is established, all subsequent communication—including prompt context, token streams, and telemetry—flows directly between the browsers, fully encrypted and bypassing the signaling medium entirely.41 This "wallet-as-a-node" architecture allows any user to join the inference swarm merely by opening a webpage, achieving frictionless onboarding.2

### **Advanced Decentralized Topologies and Distributed Inference**

While libp2p excels at content addressing, Distributed Hash Tables (DHT), and powering blockchain infrastructure, its full suite is often too heavy for purely browser-based, ephemeral AI nodes.9 By focusing the open core on WebRTC and lightweight signaling, the network remains highly responsive.  
With the connectivity layer established, the open core must implement the distributed inference mechanics. Taking inspiration from the Petals architecture—which facilitates the execution of massive models by splitting them into pipeline parallel layers across continents—the platform adapts this logic for modular SLMs.43  
Instead of fracturing a single monolithic model, the TinyRustLM architecture employs an "Independent specialist topology" or a "Hybrid specialist mesh".8 The network is populated by thousands of discrete, standalone specialist models (e.g., a 16M parameter logic model, an 8M parameter coding adapter).12  
The open-source P2P protocol dictates how these nodes interact:

1. **Demand Broadcast:** When a user prompt requires a skill not present in the local browser, the node broadcasts a cryptographic capability request over the WebRTC mesh.9  
2. **Peer Matching:** Adjacent nodes with the required .slm module in their resident memory respond, advertising their current bandwidth and latency profiles.42  
3. **Context Serialization:** The originating node serializes the prompt, the encoded tokens, and the necessary KV cache context, chunking the data for optimal UDP transmission.1  
4. **Remote Generation:** The peer node executes the generation transaction, processing the forward pass and streaming the resulting output tokens back to the origin over the encrypted channel.1

This infrastructure democratizes AI inference, pooling global browser resources to eliminate the need for centralized cloud compute, while ensuring that the underlying protocols remain open and immune to censorship.37

## **The .slm Container Format and Execution Lifecycles**

The physical artifact of the decentralized AI ecosystem is the .slm (Small Language Model) file format.8 Just as the GGUF format standardized local model execution for larger architectures, the .slm format serves as the highly optimized, WebAssembly-friendly container for browser-based inference.15 To encourage maximum adoption, the entire specification, parsing logic, and execution lifecycle of the .slm container must reside within the open-source core.15

### **Structural Anatomy of the SLM1 Format**

The container is engineered for extreme parsing speed and deterministic memory mapping.15 The parser validates the file through a strict sequence of layout constraints:

| Container Section | Structural Function | Validation Criteria |
| :---- | :---- | :---- |
| **Fixed Header** | Establishes the precise architectural shape of the model.15 | Must exactly match the 108-byte header layout, defining parameter counts, layers, and context windows.15 |
| **Tensor Directory** | Maps the location and alignment of all internal mathematical matrices.15 | Parses the 64-byte tensor entries, validating offset pointers and ensuring strict memory alignment constraints.15 |
| **Tokenizer Section** | Contains the vocabulary and byte-pair encoding rules.8 | Verifies the BTOK byte tokenizer or BPE1 tokenizer structures against the declared vocabulary size.8 |
| **Quantized Payload** | The raw, compressed mathematical weights.8 | Validates shape contracts, dtype definitions (F32, Q8\_0, Q4\_0), and the custom non-cryptographic checksum.8 |

### **The Model-Load and Generation Transactions**

To guarantee stability within the browser environment, operations on the .slm files are managed through rigid, transactional state machines.1 In a decentralized setting, a node may receive an .slm artifact from an untrusted peer. The execution lifecycle must protect the host machine from malformed or malicious data.1  
The **Model-Load Transaction** is a serialized, all-or-nothing process guarded by a global mutex.1 Before a model is marked as ready for execution, it must clear five sequential hurdles: parsing the container, materializing the tensors, allocating forward scratch memory, allocating the KV cache, and allocating the logits arrays.1 If any of these steps violate the predefined memory boundaries or structural contracts, the transaction rolls back cleanly, dropping the malformed artifact without crashing the WASM runtime.1  
Once a model is admitted, inference is governed by the **Generation Transaction**.1 Every new prompt forcefully clears the previous generation state to prevent context bleeding.1 The runtime executes the token encoding, the prefill phase, and the decode loop.1 Because the open core natively exposes the hidden states of the served models, developers can easily hook into the residual flow for custom evaluations, fine-tuning, or diagnostic observability.47 The transaction strictly guarantees the publication of either one stable result token or one stable error code, ensuring the host application maintains absolute control over the presentation layer.1

## **Deterministic Memory and Resource Boundaries**

A defining characteristic of professional-grade WebAssembly engineering is the elimination of dynamic memory allocation during critical execution loops. Dynamic allocation introduces unacceptable latency, risks heap fragmentation, and creates vulnerabilities where an adversarial peer could submit a prompt designed to trigger an Out-Of-Memory (OOM) crash on the host browser.1  
The open-source core mandates that all memory requirements are statically derived from the mathematical structure of the loaded .slm container before any computation begins.1 The memory footprint is calculated via fixed formulas, providing hard limits and absolute state boundaries.1

### **Operational Constants and Memory Formulas**

The runtime enforces a strict transfer ceiling, allowing a maximum of 128 MiB for a single raw host transfer allocation, establishing an upper bound on model artifact size suitable for lightweight, specialist tasks.1 Transient arrays are fixed, with a sampling cap explicitly locked at 1,024 candidates.1  
For a baseline standalone specialist model—such as the 17,048,064 parameter TinyLM-16M architecture deployed in the experimental smoke tests—the core runtime allocations are pre-calculated using the following deterministic formulas 1:

| Allocation Purpose | Deterministic Resource Formula | Calculated Size for TinyLM-16M |
| :---- | :---- | :---- |
| **Forward Scratch Space** | **![][image1]** | 47,104 bytes |
| **KV Cache Capacity** | **![][image2]** | 8,388,608 bytes |
| **Logits Materialization** | **![][image3]** | 1,040 bytes |
| **Max Host Transfer** | Defined by artifact byte limits | Up to 134,217,728 bytes |

(Note: Variables map directly to the model's architectural dimensions: ![][image4] represents the hidden dimension, ![][image5] the feed-forward dimension, ![][image6] the maximum context length, ![][image7] the number of layers, ![][image8] the number of key heads, ![][image9] the head dimension, and ![][image10] the vocabulary size.1)  
These formulas completely exclude externalized overheads such as browser fetch buffering, JavaScript response strings, and allocator metadata.1 By publishing these formulas openly, the platform ensures that external developers can confidently engineer proprietary skill adapters, knowing precisely how much memory their models will consume on host browsers worldwide.8

## **Safeguarding Proprietary Intellectual Property in WebAssembly**

The primary vulnerability of the open-core model in a decentralized AI paradigm lies in the deployment of proprietary model weights to untrusted edge devices.4 When an enterprise routes a proprietary specialist .slm to a peer browser for execution, the binary is served over public HTTP and resides in the client's local memory.48  
Historically, this "naked compute" dynamic meant that distributing a model effectively open-sourced its weights, as adversaries could easily extract the F32 or Q8\_0 tensors from the WebAssembly linear memory.4 To reconcile this deadlock—where the enterprise demands low-latency edge inference but refuses to surrender its IP—the proprietary workspace must implement sophisticated cryptographic and obfuscation countermeasures.4

### **Cryptographic Enclaves and In-Memory Decryption**

The proprietary .slm models must be symmetrically encrypted at rest and during transit across the P2P network.13 Decryption must never occur on the host's JavaScript execution thread or the disk. Instead, the decryption keys and the cipher logic must be securely embedded deep within a proprietary WebAssembly enclave.14  
The most resilient architecture for this task is the implementation of a "WASM-in-WASM" virtual machine.20 The commercial product delivers its proprietary inference logic and weights as heavily encrypted bytecode. The host WebAssembly module initializes the environment and passes a session key via a highly secure, restricted raw pointer exchange:

Rust  
\#\[no\_mangle\]  
pub unsafe extern "C" fn vm\_set\_session\_key(key: u32) {  
    // Explicit raw pointer manipulation to maintain strict isolation  
    // and prevent reference escapes.  
    GLOBAL\_SESSION\_KEY \= key as u8;  
}

Once the session key is registered, the internal proprietary VM employs a strict execution state object utilizing a sliding window and an XOR cipher to lazily decrypt the model weights strictly on the fly.20 To mitigate the risk of sophisticated memory-dumping attacks, the architecture must enforce an aggressive limitation on the maximum decrypted instruction window exposed in memory at any given nanosecond—restricting it to a microscopic footprint, such as 256 bytes.20 Once the micro-batch of tensors is processed through the matvec dispatch, the memory is immediately zeroed and overwritten.

### **WebAssembly Code Obfuscation (WasmX)**

While cryptographic mechanisms protect the static weights, the proprietary execution logic itself (the teleodynamic routers, the custom enterprise kernels, the decryption loop) must be defended against reverse engineering via decompilation to WebAssembly Text Format (WAT).49  
The proprietary Rust build pipeline must integrate advanced binary obfuscation tools, such as WasmX.51 By applying these tools post-compilation, the proprietary modules undergo several defensive transformations 50:

| Obfuscation Technique | Defensive Mechanism | Impact on Reverse Engineering |
| :---- | :---- | :---- |
| **Control Flow Flattening** | Dismantles the logical structure of loops and conditionals, replacing them with a massive, centralized switch statement controlled by an opaque state variable.51 | Destroys the readability of the decompiled WAT, making it nearly impossible to trace the execution path of the decryption engine.51 |
| **Alias Disruption** | Introduces complex, redundant pointer aliasing and indirection.51 | Confounds static analysis tools and automated cryptojacking detectors.50 |
| **Identifier Encoding** | Renames and scrambles all imports, exports, and internal function signatures (activated via the \--identifiers flag).51 | Removes semantic context. An adversary cannot search for strings like decrypt\_weights or load\_tensor.48 |

While it is axiomatic in software security that code executed on a client machine can eventually be reverse-engineered by a sufficiently resourced state actor, these layered defenses shift the economic calculus.49 The cost, time, and specialized expertise required to extract the weights vastly exceed the value of the weights themselves, effectively securing the IP for commercial viability.49

## **Teleodynamic Control and Enterprise Integrations**

With the open P2P network established and the proprietary IP secured, the commercial offering must provide the advanced orchestration capabilities required by enterprise clients. The open core handles basic broadcast and localized execution; the proprietary tier introduces Teleodynamic Structural Control.1  
This proprietary control plane allows enterprises to orchestrate complex "Pipelines, cascades, and committees" across the decentralized swarm.8 Using skill packages and active-set controls, the proprietary router evaluates a user prompt in real-time, determines the specific sequence of models required to solve the task (e.g., a logic adapter followed by a verifier or judge model), and routes the execution context to the optimal nodes in the mesh based on real-time latency and reliability metrics.8  
Furthermore, the enterprise tier must implement the data governance frameworks demanded by corporate compliance officers.11 The open core relies on a shared memory model, but the proprietary tier implements memory virtualization and namespace-level storage separation.21 This enables out-of-hierarchy namespaces and strict access policies, ensuring that one enterprise user's context cannot bleed into another's, even when utilizing the same underlying decentralized execution fabric.23

## **Governance, Licensing, and Diagnostic Telemetry**

The architectural boundaries defined throughout this report must be legally cemented. The open-core distribution strategy hinges entirely on meticulous licensing management.24

### **Licensing Architecture and CLAs**

The core modules—comprising the .slm parser, the WebRTC abstractions, and the runtime limits—must be distributed under a highly permissive, OSI-approved license, such as MIT or Apache 2.0.6 Permissive licenses strip away legal friction, allowing the maximum number of startups, researchers, and hobbyists to integrate the core into their platforms, thereby expanding the P2P network.7 Copyleft licenses (like GPL) must be strictly avoided for the core, as they act as a "license firewall" that terrifies enterprise compliance departments and artificially restricts network growth.24  
Crucially, the ecosystem's maintainer must enforce a Contributor License Agreement (CLA) for all community pull requests.5 To legally operate an open-core business model and eventually offer proprietary dual-licensed variants of core optimizations, the commercial entity must retain 100% consolidated copyright ownership of the codebase.6 Without a CLA, the copyright fractures across thousands of independent contributors, paralyzing the commercial entity's ability to maneuver legally.6

### **Navigating the Open Weights Paradigm**

The platform must clearly delineate between its open-source software and its model weights.11 As formalized by the Open Weights Definition, releasing raw weights without the underlying training data or orchestration code does not meet the standard of Open Source AI.11  
The platform leverages this strategically:

1. **Experimental Fixtures:** Baseline, deterministic models (like the 4,824-parameter runtime fixture and the 17M parameter smoke test) are released fully openly, allowing the community to test parser and ABI regressions.12  
2. **Proprietary Specialists:** The highly capable, commercially valuable skill adapters are distributed under restrictive commercial licenses.53 They remain black boxes—or, more accurately, encrypted encrypted enclaves—protecting the vast investments required for training data curation, tamper-resistant fine-tuning, and model provenance.11

### **Diagnostic Observability and Fault Tolerance**

Finally, the operation of a massive, decentralized swarm of browser tabs is inherently chaotic. Nodes drop offline, browsers close, and networks partition.1 To maintain enterprise-grade reliability over an unreliable substrate, the architecture implements a rigorous operator diagnostic flow.1  
Errors are not managed by symptom, but are systematically classified by stage.1 The runtime continuously records immutable identities (source archives, WASM hashes, manifest checksums).1 If a remote peer disconnects during the prefill phase, the diagnostic telemetry preserves the numeric code, the prompt policy, and the elapsed time.1 The proprietary teleodynamic router intercepts this failure, instantly isolating the offline peer and routing the preserved generation state to an adjacent node in the swarm, executing a narrow recovery without requiring a full reload of the user's application state.1

## **Conclusion**

The evolution of localized AI toward decentralized, peer-to-peer swarms demands a paradigm shift in software architecture. To successfully launch and monetize a platform like TinyRustLM, the open-core strategy must be executed with surgical precision at the repository, runtime, and cryptographic levels.  
By completely open-sourcing the P2P WebRTC networking stack, the .slm container format, and the baseline WebAssembly execution runtime, the platform eliminates onboarding friction and leverages Metcalfe's Law to build an insurmountable network of edge nodes. Simultaneously, by strictly isolating proprietary specialist models, enterprise namespaces, and teleodynamic routing algorithms in externalized private workspaces—and defending them with WASM-in-WASM sliding window encryption and aggressive code obfuscation—the commercial entity secures the intellectual property necessary to dominate the enterprise market.  
This architecture—enforced by flat Cargo workspaces, strict trait-based dependency inversion, deterministic resource formulas, and unyielding Contributor License Agreements—provides the definitive blueprint for building a resilient, globally scalable, and commercially viable decentralized AI ecosystem.

#### **Works cited**

1. Implementation operations \- MiRust, accessed July 5, 2026, [https://mirust.com/implementation-operations/](https://mirust.com/implementation-operations/)  
2. (PDF) OpenCLAW-P2P: A Decentralized Framework for Collective AI Intelligence Towards Artificial General Intelligence \- ResearchGate, accessed July 5, 2026, [https://www.researchgate.net/publication/400788567\_OpenCLAW-P2P\_A\_Decentralized\_Framework\_for\_Collective\_AI\_Intelligence\_Towards\_Artificial\_General\_Intelligence](https://www.researchgate.net/publication/400788567_OpenCLAW-P2P_A_Decentralized_Framework_for_Collective_AI_Intelligence_Towards_Artificial_General_Intelligence)  
3. Open core is a business model for monetizing open source software. Open core companies provide an open source core product and a commercial, source-available premium product., accessed July 5, 2026, [https://handbook.opencoreventures.com/how-we-work/open-core](https://handbook.opencoreventures.com/how-we-work/open-core)  
4. How Can Enterprises Deploy Proprietary AI Models On-Premises \- Fortanix, accessed July 5, 2026, [https://www.fortanix.com/blog/how-can-enterprises-deploy-proprietary-ai-model-on-premises](https://www.fortanix.com/blog/how-can-enterprises-deploy-proprietary-ai-model-on-premises)  
5. Open-core model \- Wikipedia, accessed July 5, 2026, [https://en.wikipedia.org/wiki/Open-core\_model](https://en.wikipedia.org/wiki/Open-core_model)  
6. Dual Licensing vs. Open Core: Legal Distinctions Every Business Should Understand, accessed July 5, 2026, [https://www.termsfeed.com/blog/dual-licensing-vs-open-core/](https://www.termsfeed.com/blog/dual-licensing-vs-open-core/)  
7. Open sourcing AI: intellectual property at the service of platform leadership, accessed July 5, 2026, [https://www.jipitec.eu/jipitec/article/download/356/349/1838](https://www.jipitec.eu/jipitec/article/download/356/349/1838)  
8. Model lifecycle – MiRust, accessed July 5, 2026, [https://mirust.com/docs/model-lifecycle/](https://mirust.com/docs/model-lifecycle/)  
9. Lattica: A Decentralized Cross-NAT Communication Framework for Scalable AI Inference and Training \- arXiv, accessed July 5, 2026, [https://arxiv.org/html/2510.00183v1](https://arxiv.org/html/2510.00183v1)  
10. Can this project be built and used on open source code alone? \#12377 \- GitHub, accessed July 5, 2026, [https://github.com/Budibase/budibase/discussions/12377](https://github.com/Budibase/budibase/discussions/12377)  
11. Open Weights: not quite what you've been told \- Open Source Initiative, accessed July 5, 2026, [https://opensource.org/ai/open-weights](https://opensource.org/ai/open-weights)  
12. Models \- MiRust, accessed July 5, 2026, [https://mirust.com/models/](https://mirust.com/models/)  
13. How to Secure AI Models in Production Environments | Blog \- Endor Labs, accessed July 5, 2026, [https://www.endorlabs.com/learn/how-to-secure-ai-models-in-production-environments](https://www.endorlabs.com/learn/how-to-secure-ai-models-in-production-environments)  
14. MVVM: Deploy Your AI Agents—Securely, Efficiently, Everywhere \- arXiv, accessed July 5, 2026, [https://arxiv.org/html/2410.15894v2](https://arxiv.org/html/2410.15894v2)  
15. Guides \- MiRust, accessed July 5, 2026, [https://mirust.com/guides/](https://mirust.com/guides/)  
16. Implementation \- MiRust, accessed July 5, 2026, [https://mirust.com/implementation/](https://mirust.com/implementation/)  
17. Trystero: Serverless WebRTC for JavaScript P2P Apps, accessed July 5, 2026, [https://trystero.dev/](https://trystero.dev/)  
18. Decentralized AI: Application Scenarios and Major Projects | 金色, accessed July 5, 2026, [https://www.binance.com/en/square/post/3172549713761](https://www.binance.com/en/square/post/3172549713761)  
19. 2025 \- libp2p, accessed July 5, 2026, [https://libp2p.io/reports/annual-reports/2025/](https://libp2p.io/reports/annual-reports/2025/)  
20. Building a Wasm-in-Wasm Virtualizer (with JIT decrypted paged memory) \- DEV Community, accessed July 5, 2026, [https://dev.to/trustsig/building-a-wasm-in-wasm-virtualizer-with-jit-decrypted-paged-memory-pk1](https://dev.to/trustsig/building-a-wasm-in-wasm-virtualizer-with-jit-decrypted-paged-memory-pk1)  
21. WAVEN: WebAssembly Memory Virtualization for Enclaves \- NDSS Symposium, accessed July 5, 2026, [https://www.ndss-symposium.org/wp-content/uploads/2025-746-paper.pdf](https://www.ndss-symposium.org/wp-content/uploads/2025-746-paper.pdf)  
22. Load encrypted model data with WebAssembly and Rust | Autodesk Platform Services, accessed July 5, 2026, [https://aps.autodesk.com/blog/load-encrypted-model-data-webassembly-and-rust](https://aps.autodesk.com/blog/load-encrypted-model-data-webassembly-and-rust)  
23. OpenBao: Horizontally Scaling Secrets Management \- OSSNA 2026, accessed July 5, 2026, [https://openbao.org/blog/cipherboy-ossna-26-talk/](https://openbao.org/blog/cipherboy-ossna-26-talk/)  
24. Software Licensing as a Strategic Architectural Tool \- SG SERAFIN STUDIO LEGALE, accessed July 5, 2026, [https://www.sgserafin.it/2026/07/software-licensing-as-strategic.html](https://www.sgserafin.it/2026/07/software-licensing-as-strategic.html)  
25. Conditional compilation \- The Rust Reference, accessed July 5, 2026, [https://doc.rust-lang.org/reference/conditional-compilation.html](https://doc.rust-lang.org/reference/conditional-compilation.html)  
26. Conditional Compilation in Rust with Feature Flags \- Midnight Programmer, accessed July 5, 2026, [https://midnightprogrammer.net/post/conditional-compilation-in-rust-with-feature-flags/](https://midnightprogrammer.net/post/conditional-compilation-in-rust-with-feature-flags/)  
27. How do I check for features set in Rust during compilation? \- Stack Overflow, accessed July 5, 2026, [https://stackoverflow.com/questions/55515686/how-do-i-check-for-features-set-in-rust-during-compilation](https://stackoverflow.com/questions/55515686/how-do-i-check-for-features-set-in-rust-during-compilation)  
28. How to effectively use RA with conditional compilation? : r/rust \- Reddit, accessed July 5, 2026, [https://www.reddit.com/r/rust/comments/12xqb86/how\_to\_effectively\_use\_ra\_with\_conditional/](https://www.reddit.com/r/rust/comments/12xqb86/how_to_effectively_use_ra_with_conditional/)  
29. An Opinionated Guide To Structuring Rust Projects \- Ryan James Spencer, accessed July 5, 2026, [https://www.justanotherdot.com/posts/an-opinionated-guide-to-structuring-rust-projects](https://www.justanotherdot.com/posts/an-opinionated-guide-to-structuring-rust-projects)  
30. Open-Core with Core Java and Vaadin — Part 1 \- JAVAPRO International, accessed July 5, 2026, [https://javapro.io/2026/05/22/open-core-with-core-java-and-vaadin-part-1/](https://javapro.io/2026/05/22/open-core-with-core-java-and-vaadin-part-1/)  
31. How to build a plugin system in Rust | Arroyo blog, accessed July 5, 2026, [https://www.arroyo.dev/blog/rust-plugin-systems/](https://www.arroyo.dev/blog/rust-plugin-systems/)  
32. Large Rust Workspaces \- matklad, accessed July 5, 2026, [https://matklad.github.io/2021/08/22/large-rust-workspaces.html](https://matklad.github.io/2021/08/22/large-rust-workspaces.html)  
33. Mastering Rust Workspaces: From Development to Production | by Nishantspatil | Medium, accessed July 5, 2026, [https://medium.com/@nishantspatil0408/mastering-rust-workspaces-from-development-to-production-a57ca9545309](https://medium.com/@nishantspatil0408/mastering-rust-workspaces-from-development-to-production-a57ca9545309)  
34. Cargo Workspaces \- The Rust Programming Language, accessed July 5, 2026, [https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html)  
35. Recap of Webinar: “Feature Flags & Authorization: Key Tools for Modern Development”, accessed July 5, 2026, [https://www.cerbos.dev/news/recap-of-webinar-feature-flags-authorization-key-tools-for-modern-development](https://www.cerbos.dev/news/recap-of-webinar-feature-flags-authorization-key-tools-for-modern-development)  
36. Structuring a Rust mono repo \- Reddit, accessed July 5, 2026, [https://www.reddit.com/r/rust/comments/1lra6h4/structuring\_a\_rust\_mono\_repo/](https://www.reddit.com/r/rust/comments/1lra6h4/structuring_a_rust_mono_repo/)  
37. Deep Insight: Decentralized Inference is Not Hype, but a Key Track, accessed July 5, 2026, [https://www.htx.com/news/deep-insight-decentralized-inference-is-not-hype-but-a-key-t-Fs0jTB8X/](https://www.htx.com/news/deep-insight-decentralized-inference-is-not-hype-but-a-key-t-Fs0jTB8X/)  
38. What are your thoughts on Bittensor? : r/singularity \- Reddit, accessed July 5, 2026, [https://www.reddit.com/r/singularity/comments/114vev7/what\_are\_your\_thoughts\_on\_bittensor/](https://www.reddit.com/r/singularity/comments/114vev7/what_are_your_thoughts_on_bittensor/)  
39. Overlay networks based on WebRTC \- Hacker News, accessed July 5, 2026, [https://news.ycombinator.com/item?id=39866325](https://news.ycombinator.com/item?id=39866325)  
40. I built a decentralized, serverless, peer-to-peer private chat app that's open source, ephemeral, and runs entirely in the browser : r/programming \- Reddit, accessed July 5, 2026, [https://www.reddit.com/r/programming/comments/yfo02q/i\_built\_a\_decentralized\_serverless\_peertopeer/](https://www.reddit.com/r/programming/comments/yfo02q/i_built_a_decentralized_serverless_peertopeer/)  
41. GitHub \- dmotz/trystero: Build instant multiplayer webapps, no server required — Magic WebRTC matchmaking over BitTorrent, Nostr, MQTT, IPFS, Supabase, and Firebase, accessed July 5, 2026, [https://github.com/dmotz/trystero](https://github.com/dmotz/trystero)  
42. Effortless Serverless Multiplayer in Three.js with Trystero | by Bandinopla \- Medium, accessed July 5, 2026, [https://medium.com/@pablobandinopla/effortless-serverless-multiplayer-in-three-js-with-trystero-f025f31150c6](https://medium.com/@pablobandinopla/effortless-serverless-multiplayer-in-three-js-with-trystero-f025f31150c6)  
43. Distributed Inference and Fine-tuning of Large Language Models Over The Internet, accessed July 5, 2026, [https://neurips.cc/virtual/2023/poster/71336](https://neurips.cc/virtual/2023/poster/71336)  
44. Petals: A Step Towards Decentralized AI \- DEV Community, accessed July 5, 2026, [https://dev.to/gssakash/petals-a-step-towards-decentralized-ai-4op9](https://dev.to/gssakash/petals-a-step-towards-decentralized-ai-4op9)  
45. Petals: Decentralized AI Revolution \- The Prompt Engineering Institute, accessed July 5, 2026, [https://promptengineering.org/petals-decentralized-ai-revolution/](https://promptengineering.org/petals-decentralized-ai-revolution/)  
46. From model bytes to Ready: TinyRustLM admission stages \- MiRust, accessed July 5, 2026, [https://mirust.com/from-model-bytes-to-ready-tinyrustlm-admission-stages/](https://mirust.com/from-model-bytes-to-ready-tinyrustlm-admission-stages/)  
47. PETALS: Collaborative Inference and Fine-tuning of Large Models \- ACL Anthology, accessed July 5, 2026, [https://aclanthology.org/2023.acl-demo.54.pdf](https://aclanthology.org/2023.acl-demo.54.pdf)  
48. Blazor WebAssembly Obfuscation: Protecting Client-Side .NET Code \- Softanics, accessed July 5, 2026, [https://www.softanics.com/net-obfuscation/platforms/blazor-webassembly](https://www.softanics.com/net-obfuscation/platforms/blazor-webassembly)  
49. Best way to obfuscate/protect WASM code? : r/rust \- Reddit, accessed July 5, 2026, [https://www.reddit.com/r/rust/comments/k6n1g8/best\_way\_to\_obfuscateprotect\_wasm\_code/](https://www.reddit.com/r/rust/comments/k6n1g8/best_way_to_obfuscateprotect_wasm_code/)  
50. A First Look at Code Obfuscation for WebAssembly \- Cyber-Physical Systems Security Lab |, accessed July 5, 2026, [https://csl.fiu.edu/wp-content/uploads/2023/05/webassembly\_obfuscation.pdf](https://csl.fiu.edu/wp-content/uploads/2023/05/webassembly_obfuscation.pdf)  
51. GitHub \- sergiodagama/WasmX: Rust-based tool for obfuscating WebAssembly code, enhancing security and protecting intellectual property., accessed July 5, 2026, [https://github.com/sergiodagama/WasmX](https://github.com/sergiodagama/WasmX)  
52. \[Solved\] Rust/wasm32 code obfuscation techniques?, accessed July 5, 2026, [https://users.rust-lang.org/t/solved-rust-wasm32-code-obfuscation-techniques/25325](https://users.rust-lang.org/t/solved-rust-wasm32-code-obfuscation-techniques/25325)  
53. Beyond the Buzz: Making Sense of Open-Weight AI in the Enterprise | Box Blog, accessed July 5, 2026, [https://blog.box.com/beyond-buzz-making-sense-open-weight-ai-enterprise](https://blog.box.com/beyond-buzz-making-sense-open-weight-ai-enterprise)  
54. Managing risks from increasingly capable open-weight AI systems | AISI Work, accessed July 5, 2026, [https://www.aisi.gov.uk/blog/managing-risks-from-increasingly-capable-open-weight-ai-systems](https://www.aisi.gov.uk/blog/managing-risks-from-increasingly-capable-open-weight-ai-systems)  
55. Building a Rakis | Hrishi Olickel, accessed July 5, 2026, [https://olickel.com/introducing-rakis](https://olickel.com/introducing-rakis)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAaCAYAAAD43n+tAAAB60lEQVR4Xu2WvyuFURjHH/lRopRELCQGSZGQZFBWBmWzMwmFMihkEBYZhIEUizIZLLql/AEWk4FFKRsG5cf367xv99znXvee9711p/Opz3Df5/S+53vPec77ing8nnypgTfwx/ITDltjyuCZGrNg1QtJEZyBU7qgGREz0WNdCCiGp3AJlqpaIemD73BRFzTdYgaewxJVI7zRCSzXhQJSBa/F/PE5AzXDZ5iAlamlvxBHsEtdz0Z14H9wxRvEbCEXOG4OborjCtXBB/gI61VtAq6I+8NJK7yAjbogZssuw3lxvyd3yBbsF8dAXJUEfIVt1vUmMROrta650gmvJDVUnDDcavti5hK2Rs5A7Bv2zwfsCa7xgRtwNBwUAztUnDAcNwvHg9/OgcihmIbjiUcG4a7kf6oxFJv5QKKFIb1wW5JziBSIgxiIzcdl5runJWVEPDiZHTE9ysPHFbbBnpitFhIp0JiYQOtiQk2mlmPBMDyZuDLt8FIyHxSZ6IB38MnyRcwc34Lf9gdAGix+w3sx7xx9fEfFDhNuMx44UUJpIq1QOJjymMwHhuGBwobWPZNPKB5YPLj4xZITvn/4HlqT9ElEZQhOy//3YW+uivlOdIGvjVv4JcnvSW6/rFuO/+oArNAFj8fj8Xg8ufkFMKBdS1jyMOoAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAAA7klEQVR4Xu3TsWrCYBTF8VtwEJ2kLsUncHLo2qXQB+jiIMWXcPE9HEtBEAoOrp2cnH0IM3VQdCh1sbb6P34Iya0SbAtSyIEfJN9JyJdLYpblt7nFDJuYBZooY4TPWPeOPoq6+Vie8IU7X1hYU9fFheu+pYQxIlSS1S5tC7t68MWhVDHHADnX6Vzr6nVdavREPVk78NFOIws71xukpoM17nHl1C3MS9ekZj+vJXp4dCZ27nm1fGE/mJe+rw/c+MLCmrqT5hXZH3xf1xYGf2heebzgDTXXJaLf49WS/+MUDVxiiFWs0/EzCro5S5Z/nS1olkHFq0oRIgAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAAA1ElEQVR4XmNgGAXowBOI/xOBvwKxMVQPVrAQiH8DsQ2aODMQpwHxMyDWRJODA0EgPg3Ed4FYHE0OBESAeCsQS6JLwIA+EH8C4jVAzAIVYwRibigbZMB0IOaB8jFANAPEn0VIYiDn9jBADBIA4lAoGyuYw4Dqf5C/24E4Ha4CD4D5H+QCUEB9gbK/AbEpkjqcABQ1oChC9j/I+XsYIH4nCGD+L0cSQ/Y/XgBSMJ8BM/5ZGRAxgBcQin+CAJv/iQIuDJAQR07r74B4BxALIakbBaOAdgAAHUsvUKJM+V0AAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABE0lEQVR4Xu3TP0tCURjH8SciKBIiBEkolGzR3oEQhDg0BrW3utpUIdHi2NDkElFtvYAImkRBh95BTkLUHtJgYH0f7rmmD8c/c/iDDxzOc+659/y5Iv8+EeziEGnMu/5lrLu2Nxk00cEDjnGPZ2zjCfn+6IEsoIQuTrA0XJYdfOJNPF+gD1fwjQNTC7OIR0fbQyngB6eYM7XB3OHMdm7hHS1smJrNtXjWfyHB28um35cVCZbbjx5VFT3xzDxN4mjjA5umNlXCCZS2x0U3Oms7V/EikyeI4gYxW9BcSrAHe7bgoseqt3HU/ZAEXlHDmqnpbTxHUcbfD0migS/c4ghXqCMnEx4Oo4OS2HdS8vcHzjLLyPwC1vkp/WcUoisAAAAASUVORK5CYII=>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAaCAYAAACHD21cAAAAuUlEQVR4XmNgGHnAEYhfA/F/JPwLiHcDsTCSOpxgDhD/A2IPdAl8QBCITwPxAyCWRpXCDzSB+C0QrwFiFjQ5vCCaAeK3cnQJQmASEP8GYht0CXwA5r+7QCyOJocXEPIfGxCzoguCAMx/RegSQMAIxE1ArIMuAQKg+MPlPxUgngvEnOgS+OIP5LxZDBAXYQBjIP7KgOk/SQaIpkdArIgkzuACxM8YEGnzLxA/gWIQGya+nAF7gI2CkQgA+LEntuOlP9kAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABGklEQVR4Xu2TsUoDQRCGRxLBYBHSmMLGIhEEO1ubiEUeQVGfQEgbQppACnvBzt7GJhDfwWhhE0glaGOhaKpUouYbdpfb7BlcsArcBx/H7gx3c//tiWT8lxq+4Y/nB554Pd2g3sNVr57iEr9xPyxAFQd4jCtBLUUJ7/EJ12dLsod93Aj257KF73gjyZNz2MAzLNi9KI7EZNG0a83jQkxuS64plnP8xF3cxAe8xaLfFIPL6xlP8UrMjfRj1L2+KFxeX9jGZTwQ89p643zS+jcur5Yk+ZRxhGPctntR6Plyefl0xDxEr1G4vB7FTOOjE+lkOmFY+5UdnOC1pLPRte7rdHry56K/zIvM/m+veGjra3gX1IdYsfWMjMVlCn+/PCJqzkDYAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAZCAYAAAA8CX6UAAAA+UlEQVR4Xu3Tv0sCcRjH8UdQUFRcBIWcGgShLdSlhsA5on/C/0caW9oaWoSChgbRv0FcKwJByKYCk9L38Xi/HtPLzeE+8ILjPndf+D53X5E4u+YMYywCppisrr9xj6r7QlSuMceJuV9BFx9omG4teQwwRNF0TkoY4REZ04VSwzvukDSdmxvRZ5xnN+ZcdB5tWwTiLPSFui2C6cjf83GTxRM+cWw6Lzn0ZPN8nBzgWfTrHoYrP/+ZTwu/eEDadF6i5pPAlehCl6bzEvXZy+iLzqdgulCORH80u60ULkTncitbFjnFi/hH4gdveBU9GjPRY9EU3VqcOPufJU75NY0EHNwQAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAZCAYAAADXPsWXAAAA7ElEQVR4Xu2SvQ4BQRSFr/hJhEQjRCeiUYqIQnRansBTKEh0otIrFURCI/EKm3gIlUKlUlIocK5Zm9m7uzKh3S/5mnvu7iRzhijEjyzcw6fmHba1nQTciJ2Bljt0SIVLGdhE4RqOYFxkDjV4hVsYExnTgCuYlIFOCZ6hBdPu6P3hAlbF3EMeHuEJFkTWg2MYEXMPfLoFL7CizYtwB3PaLBC+B76PG6zbMz55CrufJRPmpBrippgWnNGXNvwYkvpJH2ZIvY2ya8MAfmAPeCBVp2zJiM9bYfld/ARXyxVPyKDOIPgCmzAlg5CQf3kBE1AmXeAJjTAAAAAASUVORK5CYII=>
# **Enterprise Rust Architecture: Best Practices for Dual Desktop and Web Applications**

## **The Evolution of the Dual-Target Paradigm**

The contemporary software landscape demands applications that seamlessly operate across fundamentally disparate environments—specifically, as downloadable native desktop binaries and universally accessible web applications. Historically, organizations achieved this by maintaining isolated codebases or by compromising native performance through heavy, bundled browser runtimes like Electron. The emergence of the Rust programming language, combined with advanced compilation targets such as WebAssembly (WASM) and lightweight application toolkits, has established a new enterprise standard. Architecting a system that serves both web and desktop environments from a unified codebase requires a profound understanding of memory safety, strict architectural boundaries, and cross-platform compilation strategies.  
To construct a resilient dual-target deployment, the underlying architecture must rigorously decouple the core business logic from infrastructural constraints. The enterprise standard for achieving this in the Rust ecosystem relies on Hexagonal Architecture, utilizing Rust's zero-cost abstractions, powerful trait systems, and Cargo workspace capabilities1. When integrated with modern cross-platform rendering frameworks—namely Leptos and Dioxus—alongside the Tauri v2 desktop toolkit, developers can synthesize a singular repository that deploys universally without sacrificing native performance or web accessibility2. Furthermore, distributed data synchronization models utilizing Conflict-Free Replicated Data Types (CRDTs) guarantee data consistency across disparate storage layers, such as native SQLite databases and browser-based IndexedDB5. This report provides an exhaustive analysis of the architectural patterns, security postures, and build optimizations required to engineer a production-ready dual-target Rust application.

## **Core Architectural Design: Hexagonal Architecture in Rust**

The foundational blueprint for an enterprise Rust application targeting both desktop and web platforms is Hexagonal Architecture, alternatively classified as the Ports and Adapters pattern1. The central tenet of this architecture is the creation of loosely coupled components by permanently isolating the pure domain logic from external dependencies, user interfaces, and persistence mechanisms8.

### **The Dependency Inversion Principle and Architectural Layers**

In a dual-target application, the presentation layer oscillates between a web server handling HTTP endpoints and a Tauri local binary executing Inter-Process Communication (IPC). Similarly, the data persistence layer alternates between browser-native IndexedDB running within a WASM sandbox and desktop-native SQLite interacting directly with the filesystem5. If the application's business logic becomes coupled to either of these specific implementations, severe codebase duplication becomes inevitable.  
Hexagonal Architecture dictates that dependencies must strictly flow inward toward the core domain1. The domain layer defines pure business entities and invariants, possessing absolutely no external dependencies—expressly forbidding imports from the standard library's network or filesystem modules1. The application interacts with the outside world exclusively through "Ports," which in Rust are naturally expressed as traits1.

| Architectural Layer | Core Responsibility | Rust Implementation Strategy | Allowable Dependencies |
| :---- | :---- | :---- | :---- |
| **Domain** | Pure business rules, state invariants, and entity definitions. | Structs, Enums, Newtypes, Trait definitions (Ports). | None (Zero external crates). |
| **Application** | Use case orchestration, coordinating domain logic. | Structs implementing service workflows and handlers. | Domain layer only. |
| **Infrastructure** | Concrete data persistence, external API communication. | Structs implementing Domain traits (Adapters). | Domain and Application layers. |
| **Presentation** | User interface, HTTP handlers, Tauri IPC commands. | Axum routers, Tauri command handlers, UI components. | Application layer. |

This process separation is not merely theoretical; it is enforced at the compilation level. A dedicated configuration, such as a deny.toml policy or custom boundary checker, can reject any integration code that attempts to leak I/O operations into the pure-domain modules12.

### **Type-Driven Design and Compile-Time Verification**

Rust's expressive type system is uniquely equipped to enforce Hexagonal boundaries. By leveraging Type-Driven Design, invalid states can be rendered unrepresentable at compile time1. Rather than relying on fragile runtime validation, domain models utilize the Newtype pattern to encapsulate primitive types, ensuring that structural rules are cryptographically guaranteed before execution begins13.  
For instance, an identifier should not merely be cast as a String or u64, but rather as a distinct type struct AuthorId(u64). This strictly prevents the accidental swapping of an AuthorId with a PostId during complex application orchestration13. Furthermore, traits define the contracts that outer layers must fulfill. A repository port is defined purely by its function signatures within the domain:

Rust  
pub trait UserRepository: Send \+ Sync {  
    fn save(&self, user: User) \-\> Result\<(), DomainError\>;  
    fn find\_by\_id(&self, id: UserId) \-\> Result\<Option\<User\>, DomainError\>;  
}

By defining this trait within the pure domain, the application logic executes operations without knowing whether the underlying storage mechanism is an in-memory test double, a PostgreSQL database on a remote server, or an IndexedDB instance executing inside a browser9.

### **Managing Dependency Injection and Trait Objects**

A prevalent anti-pattern observed when porting enterprise architectures from object-oriented languages like Java or C\# to Rust is the heavy reliance on dynamic Dependency Injection (DI) frameworks1. Due to Rust's distinct memory management model and borrow checker, relying extensively on Arc\<dyn Trait\> (dynamic dispatch) incurs both performance overhead and ergonomic friction16.  
The enterprise best practice for Rust DI relies primarily on static dispatch via generics and constructor injection1. Trait objects (dyn Trait) should be reserved strictly for scenarios where implementations must be swapped at runtime based on configuration, or when heterogeneous collections of varying types are absolutely necessary1. For dual-target setups, the target environment (Web versus Desktop) is typically known at compile time. Thus, static dispatch remains the superior choice for maximizing performance, allowing the compiler to heavily inline functions during the Link-Time Optimization (LTO) phase18. However, engineers must balance this approach; overly abstract generic code can sometimes severely complicate lifetime annotations and force reliance on heap-allocated data, potentially negating performance benefits17. The pragmatic approach dictates starting with concrete types and introducing abstraction only after multiple concrete implementations explicitly require it1.

### **Error Handling Protocols and Concurrency Safety**

Robust error handling acts as the connective tissue between Hexagonal layers. Rust's Result type facilitates seamless error propagation, provided that each architectural layer defines its own custom error types1. Errors originating in the infrastructure layer (e.g., a SQLite constraint violation) must be explicitly mapped to a generic DomainError before crossing into the application layer, ensuring that the domain remains oblivious to database-specific implementations13.  
Crucially, library and application code must meticulously avoid utilizing .unwrap() or .expect() in production scenarios1. Beyond the obvious risk of unexpected application crashes, panicking in a multithreaded Rust environment carries severe consequences for concurrency primitives. Panicking while holding a Mutex guard instantly poisons the mutex, permanently deadlocking any other thread attempting to acquire that lock13. Because enterprise applications heavily utilize Arc\<Mutex\<T\>\> for shared state management, diligent propagation of recoverable errors is mandatory13.

## **Workspace Topology and Package Management**

To effectively manage the scale and complexity of a dual-target architecture, the codebase must be organized into a Cargo workspace. A workspace allows multiple interdependent crates to share a single Cargo.lock file and unified output directory, ensuring that dependency resolution remains consistent and compilation artifacts are heavily cached across the entire project22.

### **Multi-Crate Structure and Dependency Synchronization**

An enterprise-grade workspace systematically isolates bounded contexts and architectural layers into distinct packages1. A standard directory topology for a Tauri/Webapp hybrid project is structured as follows:

1. crates/domain: Contains pure business logic. Compiled to both native and WASM targets.  
2. crates/application: Contains use-case orchestrators. Compiled to both targets.  
3. crates/infrastructure: Contains adapters. Features must be carefully managed here; the SQLite adapter is gated behind a desktop feature, while the IndexedDB adapter is gated behind a web feature.  
4. apps/desktop-tauri: The native Tauri application. Configured as a binary crate acting as the composition root for the desktop target17.  
5. apps/web-server: An Axum or Actix web server providing Server-Side Rendering (SSR) and API endpoints3.  
6. apps/web-client: The WASM frontend executing in the user's browser27.

To manage these dependencies cleanly, the root Cargo.toml utilizes the \[workspace.dependencies\] table to centralize version management29. This guarantees that if crates/domain and apps/desktop-tauri both rely on serialization libraries like serde, they resolve to the exact same version, preventing compatibility matrix failures across the workspace29. Tools like Cargo support multi-crate publishing workflows, carefully building a local registry overlay to verify dependency-compatible compilation order before submitting crates to remote registries23.

### **Feature Flag Segregation for Distinct Targets**

Because WASM is a distinct compilation target (wasm32-unknown-unknown) characterized by severe restrictions on system-level APIs, infrastructure code must heavily utilize conditional compilation27. A crate cannot compile native filesystem operations (std::fs) or multithreaded Tokio runtimes into a standard WASM target meant for browser execution12.  
Therefore, the workspace relies on Cargo feature flags (\#\[cfg(feature \= "desktop")\] vs \#\[cfg(feature \= "web")\]) or target OS gating (\#\[cfg(target\_arch \= "wasm32")\]) to guarantee that the correct physical adapters are compiled into the final binary25. By configuring workspaces correctly, the exact same core crates can be injected into the Tauri binary for the desktop and the cargo-leptos build pipeline for the web28.

## **Frontend and Presentation Layer Paradigms**

The selection of a frontend framework permanently dictates how the application renders across platforms. In the modern Rust ecosystem, the leading paradigms are represented by Leptos and Dioxus2. Both frameworks provide declarative, component-based architectures written directly in Rust, yet their underlying rendering philosophies and platform integrations differ significantly3.

### **Comparative Analysis: Leptos versus Dioxus**

Leptos is engineered primarily as a full-stack web framework heavily optimized for Server-Side Rendering (SSR), progressive hydration, and fine-grained reactivity2. Unlike frameworks relying on a Virtual DOM, Leptos utilizes Signals to form a dependency graph, ensuring the runtime executes only the minimal set of effects when state mutates3. It operates seamlessly with tools like cargo-leptos to coordinate the compilation of native server binaries alongside WASM client bundles27. When combined with Tauri, Leptos components are compiled to WASM and executed inside the operating system's native webview34.  
Dioxus, conversely, is built with a cross-platform, multi-tenant mindset structurally akin to React Native3. While it also compiles to WASM for web distribution, Dioxus Desktop operates differently: the Rust application logic runs entirely as a native OS process, utilizing Inter-Process Communication to pass Virtual DOM patches to a lightweight webview2. Experimental branches of Dioxus bypass the webview entirely, utilizing WGPU to render native graphical elements directly4.

| Architectural Feature | Leptos Framework | Dioxus Framework |
| :---- | :---- | :---- |
| **Primary Architectural Focus** | Full-stack Web, SSR, Server Functions3. | Multi-platform (Web, Desktop, Mobile, TUI)4. |
| **Underlying Reactivity Model** | Fine-grained Signals (no Virtual DOM overhead)3. | React-style Virtual DOM paired with Signals4. |
| **Desktop Execution Model** | Application logic compiles to WASM, executes inside Webview34. | Application logic runs as a native binary, patches UI via IPC2. |
| **Web Compilation Profile** | Optimized for Web Delivery via Islands architecture3. | Highly compact; \~50kb for baseline applications4. |
| **Optimal Enterprise Use Case** | Applications demanding intensive SEO, SSR, and web-first delivery3. | Teams requiring identical native codebases spanning mobile and desktop natively4. |

For an enterprise application heavily targeting a dual web/desktop release, the decision rests on where the business logic should physically execute on the desktop platform. If the logic is lightweight and can run comfortably inside the WASM webview, Leptos coupled with Tauri provides an immensely stable, web-aligned development experience34. If the architecture requires continuous access to native system resources without constantly serializing payloads across the WASM-to-Native IPC boundary, Dioxus Desktop offers significant structural advantages2. Additionally, for applications requiring zero JavaScript overhead and maximum simplicity, utilizing HTMX with Tauri invoke directives represents an ultra-lightweight alternative for routing and state mutation39.

## **The Tauri v2 Desktop and Mobile Runtime**

Tauri v2 serves as the overarching desktop and mobile deployment vehicle for the native segment of the architecture40. In stark contrast to Electron, which bundles a complete Chromium runtime and Node.js environment into every binary, Tauri relies entirely on the host operating system's native webview capabilities40. This includes utilizing Microsoft Edge WebView2 on Windows, WKWebView on macOS, and webkit2gtk on Linux42. This fundamental architectural shift produces installer sizes routinely under 5MB and drastically reduced memory footprints—often idling below 60MB even under significant load5.  
Tauri v2 expands significantly upon its predecessor by introducing first-class mobile support (iOS and Android), an expansive modular plugin ecosystem, and complex multi-window workspace capabilities41. Within a dual-target architecture, the webview serves as the unified presentation layer. When running in the browser, the WASM bundle communicates with the remote server via REST, GraphQL, or Server Functions3. When executing inside the Tauri binary, the exact same frontend logic communicates directly with the local Rust backend via the Tauri IPC invoke command44.

### **Unifying the IPC Bridge and Enforcing Type Safety**

The transition between web-based API calls and desktop-based IPC calls must be cleanly abstracted to prevent business logic fragmentation. Tauri commands empower developers to expose native Rust functions to the frontend webview44:

Rust  
\#\[tauri::command\]  
pub async fn save\_document(doc: Document, state: tauri::State\<'\_, AppState\>) \-\> Result\<(), AppError\> {  
    state.repository.save(doc).await  
}

To maintain end-to-end type safety across this asynchronous boundary, enterprise architectures deploy specialized tooling such as tauri-specta or ts-rs47. These libraries analyze the Rust domain structs and command signatures at compile time to automatically generate highly precise TypeScript definitions or corresponding Rust WASM bindings48. Recent advancements in specta even allow for phase-specific types, dynamically generating distinct TypeScript interfaces based on whether a structure is being serialized for an outgoing request or deserialized from an incoming response48. This guarantees that if a domain entity's schema changes deep in the Rust core, the frontend compilation will instantly fail if the corresponding IPC payload is not updated, preemptively eliminating an entire class of runtime serialization errors49. Furthermore, when avoiding JavaScript entirely, developers utilize crates like tauri-wasm to interact with Tauri commands natively from a Rust frontend compiled strictly to WASM32.

### **Advanced Window Management and Sidecars**

Enterprise software often necessitates complex interface management surpassing single-page application models. Tauri v2 enables robust multi-window functionality, allowing applications to dynamically spawn independent webviews tailored to specific workspaces or tool palettes45. Developers can utilize plugins like tauri-plugin-frame or tauri-plugin-decorum to hijack native window decorations, implementing custom titlebars that seamlessly integrate with system-level features such as Windows 11 Snap Layouts or macOS traffic-light controls51. Furthermore, for architectures transitioning away from legacy stacks, Tauri permits the embedding of external binaries, known as "sidecars"53. This facilitates the secure packaging and execution of Python scripts or Node.js services directly alongside the Rust core, bypassing the need for end-users to manually configure external execution environments53.

## **Offline-First State Synchronization and Persistence**

The most complex engineering challenge inherent in a downloadable desktop/web hybrid is reliable state synchronization. An enterprise desktop application must function flawlessly in offline, high-latency, or air-gapped environments, retaining data locally and seamlessly merging state once connectivity to central cloud infrastructure is restored54. Traditional CRUD REST APIs fail catastrophically under these conditions, as concurrent offline edits inevitably lead to split-brain scenarios and manual merge conflicts56.

### **The Shift to Conflict-Free Replicated Data Types (CRDTs)**

To solve the distributed state problem definitively, the architecture must abandon centralized, locking database models in favor of Conflict-Free Replicated Data Types (CRDTs)6. CRDTs are specialized data structures mathematically guaranteed to converge to identical states across all replicas, regardless of network latency or the precise order in which asynchronous updates are received6.  
The mathematical axioms governing CRDTs ensure convergence through three principles:

1. **Commutativity:** The arbitrary order of synchronization does not alter the final computed state (![][image1])6.  
2. **Associativity:** Network batches can be grouped or fragmented arbitrarily (![][image2])6.  
3. **Idempotency:** Re-transmitting the same synchronization payload multiple times does not inadvertently duplicate data (![][image3])6.

In the Rust ecosystem, libraries like crdt-kit provide highly optimized, zero-allocation CRDT implementations tailored for resource-constrained embedded and WASM environments6. By replacing heavy string-based identifiers with integer-based NodeId structs, these libraries eliminate massive heap allocation overheads during rapid synchronization57. By representing complex business entities as composites of Last-Writer-Wins Registers (LWWRegister), Grow-Only Sets (GSet), and Replicated Growable Arrays (RGA) ordered by Hybrid Logical Clocks (HLC), the application resolves intricate domain conflicts deterministically without human intervention6.

### **Dual-Storage Adapters: IndexedDB versus SQLite**

The Ports and Adapters architecture becomes critical when implementing the local storage layer for these CRDTs across distinct platforms.

* **Web Target Execution:** When compiled to WASM and running directly in the browser, the application utilizes IndexedDB5. While the older localStorage API is synchronous and aggressively blocks the main rendering thread, IndexedDB is inherently asynchronous and cooperatively scheduled58. Modern architectural implementations wrap IndexedDB in reactive Rust hooks, enabling sub-millisecond indexed queries even against datasets exceeding 500,000 entries5. Crucially, sensitive enterprise data stored in IndexedDB must be encrypted via the Web Crypto API prior to persistence, as browser storage is otherwise completely accessible to end-users traversing the application's file path5.  
* **Desktop Target Execution:** When running as a native Tauri application, the Rust backend bypasses the browser entirely to interface directly with SQLite10. SQLite provides exceptional offline performance, massive storage limits, and full relational querying capabilities10. By employing advanced synchronization engines like sqlite-sync or Loomabase, the local SQLite database automatically applies incoming CRDT payloads directly at the column level7. This ensures that if User A edits the "Title" column offline while User B edits the "Status" column offline, both changes survive the merge process7.

### **Cloud Convergence via PostgreSQL**

When the client regains network access, the local sync engine transmits compressed delta-state updates to a central PostgreSQL database7. Because the local SQLite edge nodes and the remote PostgreSQL cluster share a mathematically synchronized CRDT schema, the central server acts merely as another peer replica rather than an authoritative dictator of state7. Using Lamport clocks to establish causal order, the synchronization engine deterministically merges concurrent column-level updates55.  
This architecture allows multi-tenant enterprise applications to maintain a single central PostgreSQL analytics database while deploying thousands of partial, disconnected SQLite replicas to individual user desktops60. This architecture minimizes cloud egress costs, provides instantaneous local execution, and enables Row-Level Security policies to be cryptographically enforced server-side7.

## **Enterprise Security Posture and Sandboxing Limits**

Distributing enterprise applications outside the highly controlled perimeter of a cloud server introduces severe local security vulnerabilities. A compromised frontend payload—perhaps injected via Cross-Site Scripting (XSS)—executing inside a desktop webview could theoretically harness the IPC bridge to execute arbitrary native OS commands12.

### **Tauri v2 Capability and Permission Systems**

To rigorously mitigate this attack vector, Tauri v2 implements a rigid, deny-by-default capability system63. Developers must explicitly define JSON or TOML configuration files detailing precisely which IPC commands the webview is permitted to access across the IPC boundary64.  
A capability maps specific application windows to granular, plugin-specific permissions66. For instance, a basic settings window may only be granted access to the core:default permission set, completely preventing it from utilizing the filesystem plugin regardless of the code executed in the frontend65. If an application requires access to the host filesystem, the capability file must explicitly permit the specific directory paths using deeply nested scope allowances67:

JSON  
{  
  "$schema": "../gen/schemas/desktop-schema.json",  
  "identifier": "main-capability",  
  "windows": \["main"\],  
  "permissions": \[  
    "fs:allow-write-text-file",  
    {  
      "identifier": "fs:allow-write-text-file",  
      "allow": \[{ "path": "$HOME/documents/\*" }\]  
    }  
  \]  
}

By defining these strict boundaries, Tauri contains the blast radius of a frontend compromise66. The Rust backend acts as the definitive security gate; even if a malicious payload successfully invokes the write-text-file command, the Rust core intercepts the execution and terminates the operation if the target path falls outside the pre-approved $HOME/documents/ scope67.

### **WebAssembly Sandboxing and Hardware Memory Protections**

While WASM execution inside the browser inherently isolates processes from the host operating system by denying access to the callstack and linear memory boundaries, the WASM sandbox itself is not a panacea for internal memory safety70. WASM restricts a module to its designated linear memory, successfully protecting the host environment, but it does not inherently protect the module's internal structures from itself71.  
If an application compiles legacy, memory-unsafe C or C++ libraries into a WASM module, internal buffer overflows and use-after-free vulnerabilities can still silently corrupt the application's internal memory structures, leading to semantic logic exploitation entirely within the confines of the sandbox71. Emerging hardware-accelerated solutions, such as Cage utilizing ARM's Memory Tagging Extension (MTE) and Pointer Authentication Codes (PAC), attempt to catch these spatial memory bugs inside WASM modules71.  
However, this underscores exactly where Rust's ownership model and borrow checker prove indispensable12. By writing the entire frontend and backend logic exclusively in Rust, memory safety is cryptographically proven at compile time without relying on runtime hardware extensions1. Therefore, a pure-Rust WASM binary executing within the browser achieves both external isolation (via the WASM host) and internal memory safety (via the Rust compiler), providing defense-in-depth unrivaled by legacy language stacks12.

## **Build Optimization and Continuous Integration Pipelines**

A critical phase in delivering dual-target enterprise software is optimizing the compilation artifacts. Rust's default release profile prioritizes a balance of compilation speed and execution optimization, but enterprise deployments must be fiercely tuned to minimize binary bloat and maximize end-user execution efficiency18.

### **Tuning the Release Profile for Size and Speed**

The Cargo.toml configuration dictates how the LLVM backend processes the intermediate representation. To achieve the sub-5MB binary sizes characteristic of highly optimized Tauri applications and WASM payloads, the \[profile.release\] configuration must be explicitly defined19:

| Configuration Variable | Recommended Value | Architectural Impact and Rationale |
| :---- | :---- | :---- |
| opt-level | "z" or "s" | Optimizes aggressively for binary size rather than sheer execution speed, crucial for delivering small WASM bundles over latent networks18. |
| lto | true or "fat" | Link-Time Optimization allows the compiler to analyze the entire dependency graph as a single unit, aggressively stripping dead code and inlining functions across crate boundaries18. |
| codegen-units | 1 | Forces the compiler to process the binary in a single thread. This exponentially increases compile times but allows LLVM to perform maximum optimization, removing cross-unit redundancies18. |
| strip | true | Removes all debug symbols from the compiled binary, drastically reducing the final file footprint for deployment18. |
| panic | "abort" | Replaces the default unwinding behavior with a direct OS abort. This strips the massive unwinding infrastructure from the binary, significantly reducing size overhead19. |

### **Managing Compile Times and Developer Velocity**

While the aforementioned release settings are mandatory for production pipelines, they severely degrade local developer velocity due to extended compilation times18. In the \[profile.dev\] section, incremental compilation (incremental \= true) must remain enabled to ensure the compiler only touches mutated files19.  
A highly disruptive bottleneck in Tauri development arises when the IDE's Rust analyzer locks the build directory, conflicting directly with the cargo build process executing in the terminal. Enterprise teams resolve this permanently by setting the rust-analyzer.cargo.targetDir configuration to an isolated, dedicated directory, completely decoupling the IDE's background processing from the active compilation pipeline73. Furthermore, applying minor optimizations (opt-level \= 1\) and disabling heavy debug symbols (debug \= false) strictly for third-party workspace dependencies via \[profile.dev.package."\*"\] can shave profound amounts of time off incremental rebuilds73.

### **Distribution and CI/CD Orchestration**

Continuous Integration for dual-target applications relies heavily on automated, orchestrated workflows. For the web deployment target, tools like cargo-leptos seamlessly build both the native server binaries and the WASM client bundles. These artifacts are typically packaged into optimized Linux Containerfiles (e.g., Docker or Podman) and deployed to micro-VM cloud architectures like Fly.io or serverless runtimes like AWS Lambda28.  
For the desktop deployment target, Tauri's built-in bundler packages the compiled Rust binary, the optimized frontend web assets, and any necessary external sidecars into platform-native formats (.dmg for macOS, .msi for Windows, .AppImage or .deb for Linux)53. Modern CI/CD pipelines utilize GitHub Actions (tauri-action) to automate highly complex cross-compilation matrixes76. These pipelines verify that macOS builds are properly notarized with Apple and Windows executables are cryptographically code-signed before automated release distribution, guaranteeing that the end-user receives a verified, untampered native binary78.

## **Final Synthesis**

Designing a downloadable desktop application alongside an accessible web application from a singular codebase demands an architecture that is uncompromising in its modularity. The fusion of Hexagonal Architecture with Rust's strict, memory-safe type system provides the foundational isolation necessary to target wildly disparate environments—the restricted WASM sandbox of the browser and the native operating system—without duplicating critical business logic.  
By leveraging Cargo workspaces to strictly map architectural boundaries, integrating declarative rendering paradigms like Leptos or Dioxus, and utilizing Tauri v2 as a secure, lightweight native wrapper, enterprises can achieve unprecedented code reuse and minimal binary footprints. Furthermore, bypassing fragile centralized state models by integrating offline-first data engines backed by CRDTs transforms brittle client-server relationships into resilient, globally distributed systems capable of surviving extreme network volatility. Ultimately, this Rust-driven, dual-target stack establishes a highly performant, cryptographically secure, and future-proof standard for modern enterprise software delivery.

#### **Works cited**

1. rust-architecture-patterns \- Skill \- Smithery, [https://smithery.ai/skills/davincible/rust-architecture-patterns](https://smithery.ai/skills/davincible/rust-architecture-patterns)  
2. What is the state of frontend web frameworks in 2025? : r/rust \- Reddit, [https://www.reddit.com/r/rust/comments/1hyes2x/what\_is\_the\_state\_of\_frontend\_web\_frameworks\_in/](https://www.reddit.com/r/rust/comments/1hyes2x/what_is_the_state_of_frontend_web_frameworks_in/)  
3. Leptos vs Dioxus: Choosing a Rust Frontend Framework in 2026 \- Rustify, [https://rustify.rs/articles/leptos-vs-dioxus-rust-frontend-2026](https://rustify.rs/articles/leptos-vs-dioxus-rust-frontend-2026)  
4. Introduction to Dioxus, [https://dioxuslabs-dioxus-54.mintlify.app/introduction](https://dioxuslabs-dioxus-54.mintlify.app/introduction)  
5. Bare-Metal Offline: Architecting a Blazing-Fast Desktop App with Tauri and IndexedDB | by Hash Block | Medium, [https://medium.com/@connect.hashblock/bare-metal-offline-architecting-a-blazing-fast-desktop-app-with-tauri-and-indexeddb-a932e6a58fb3](https://medium.com/@connect.hashblock/bare-metal-offline-architecting-a-blazing-fast-desktop-app-with-tauri-and-indexeddb-a932e6a58fb3)  
6. crdt-kit — Conflict-Free Replicated Data Types for Rust, [https://crdt-kit.github.io/crdt-kit/en/](https://crdt-kit.github.io/crdt-kit/en/)  
7. GitHub \- sqliteai/sqlite-sync: CRDT-based offline-first sync for SQLite. Syncs automatically with SQLite Cloud, PostgreSQL, and Supabase. No conflicts, no data loss, no backend to build. For offline-first apps and AI agents., [https://github.com/sqliteai/sqlite-sync](https://github.com/sqliteai/sqlite-sync)  
8. Hexagonal architecture in Rust. Tutorial index | by Luca Corsetti | Medium, [https://medium.com/@lucorset/hexagonal-architecture-in-rust-72f8958eb26d](https://medium.com/@lucorset/hexagonal-architecture-in-rust-72f8958eb26d)  
9. Structuring a Rust Backend: Feature-Based Architecture That Scales \- \#3 by rivelbab, [https://users.rust-lang.org/t/structuring-a-rust-backend-feature-based-architecture-that-scales/137452/3](https://users.rust-lang.org/t/structuring-a-rust-backend-feature-based-architecture-that-scales/137452/3)  
10. Tech Stack Analysis for a Cross-Platform Offline-First AI Chat Client | BoltAI Blog, [https://docs.boltai.com/blog/tech-stack-analysis-for-a-cross-platform-offline-first-ai-chat-client](https://docs.boltai.com/blog/tech-stack-analysis-for-a-cross-platform-offline-first-ai-chat-client)  
11. Memory System Architecture Implementation Alternatives · Issue \#387 · moeru-ai/airi, [https://github.com/moeru-ai/airi/issues/387](https://github.com/moeru-ai/airi/issues/387)  
12. The Unfireable Safety Kernel: Execution-Time AI Alignment for AI Agents and Other Escapable AI Systems \- arXiv, [https://arxiv.org/html/2606.26057v1](https://arxiv.org/html/2606.26057v1)  
13. Master Hexagonal Architecture in Rust \- How To Code It, [https://www.howtocodeit.com/guides/master-hexagonal-architecture-in-rust](https://www.howtocodeit.com/guides/master-hexagonal-architecture-in-rust)  
14. antoinecarton/hexagonal-rust: Hexagonal architecture in Rust \- GitHub, [https://github.com/antoinecarton/hexagonal-rust](https://github.com/antoinecarton/hexagonal-rust)  
15. hexser \- crates.io: Rust Package Registry, [https://crates.io/crates/hexser](https://crates.io/crates/hexser)  
16. Clean Architecture in Rust \- Reddit, [https://www.reddit.com/r/rust/comments/1dbmmv9/clean\_architecture\_in\_rust/](https://www.reddit.com/r/rust/comments/1dbmmv9/clean_architecture_in_rust/)  
17. 2048-rs: Exploring Hexagonal Architecture in Rust as an exercise \- Reddit, [https://www.reddit.com/r/rust/comments/1qsehor/2048rs\_exploring\_hexagonal\_architecture\_in\_rust/](https://www.reddit.com/r/rust/comments/1qsehor/2048rs_exploring_hexagonal_architecture_in_rust/)  
18. How to Optimize Rust Release Builds for Smaller Binaries and Faster Performance | by Nithin Bharadwaj | TechKoala Insights \- Medium, [https://medium.com/techkoala-insights/how-to-optimize-rust-release-builds-for-smaller-binaries-and-faster-performance-019e7718e8aa](https://medium.com/techkoala-insights/how-to-optimize-rust-release-builds-for-smaller-binaries-and-faster-performance-019e7718e8aa)  
19. App Size \- Tauri, [https://v2.tauri.app/concept/size/](https://v2.tauri.app/concept/size/)  
20. Master Hexagonal Architecture in Rust \- Hacker News, [https://news.ycombinator.com/item?id=41518698](https://news.ycombinator.com/item?id=41518698)  
21. State Management | Tauri by Simon, [https://tauri.by.simon.hyll.nu/concepts/tauri/state\_management/](https://tauri.by.simon.hyll.nu/concepts/tauri/state_management/)  
22. Cargo Workspaces \- The Rust Programming Language, [https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html)  
23. Publish all your crates everywhere all at once \- Tweag, [https://tweag.io/blog/2025-07-10-cargo-package-workspace/](https://tweag.io/blog/2025-07-10-cargo-package-workspace/)  
24. From Monolith to Distributed Systems in Rust: A Practical Introduction | 40tude, [https://www.40tude.fr/docs/06\_programmation/rust/026\_monolith\_to\_distributed/monolith\_to\_distributed.html](https://www.40tude.fr/docs/06_programmation/rust/026_monolith_to_distributed/monolith_to_distributed.html)  
25. Project Structure \- Tauri, [https://v2.tauri.app/start/project-structure/](https://v2.tauri.app/start/project-structure/)  
26. A collection of awesome libraries in the Leptos ecosystem. \- GitHub, [https://github.com/leptos-rs/awesome-leptos](https://github.com/leptos-rs/awesome-leptos)  
27. cargo-leptos, [https://book.leptos.dev/ssr/21\_cargo\_leptos.html](https://book.leptos.dev/ssr/21_cargo_leptos.html)  
28. leptos-rs/cargo-leptos: Build tool for Leptos (Rust) \- GitHub, [https://github.com/leptos-rs/cargo-leptos](https://github.com/leptos-rs/cargo-leptos)  
29. How to keep package versions in sync with multi-crate workspaces? : r/rust \- Reddit, [https://www.reddit.com/r/rust/comments/1pecshu/how\_to\_keep\_package\_versions\_in\_sync\_with/](https://www.reddit.com/r/rust/comments/1pecshu/how_to_keep_package_versions_in_sync_with/)  
30. Create a desktop app in Rust using Tauri and Yew \- DEV Community, [https://dev.to/stevepryde/create-a-desktop-app-in-rust-using-tauri-and-yew-2bhe](https://dev.to/stevepryde/create-a-desktop-app-in-rust-using-tauri-and-yew-2bhe)  
31. WASM vs Native Rust performance \- Reddit, [https://www.reddit.com/r/rust/comments/12jbjsc/wasm\_vs\_native\_rust\_performance/](https://www.reddit.com/r/rust/comments/12jbjsc/wasm_vs_native_rust_performance/)  
32. tauri-wasm \- Docs.rs, [https://docs.rs/tauri-wasm](https://docs.rs/tauri-wasm)  
33. WebApp with Tauri? : r/tauri \- Reddit, [https://www.reddit.com/r/tauri/comments/1hv640j/webapp\_with\_tauri/](https://www.reddit.com/r/tauri/comments/1hv640j/webapp_with_tauri/)  
34. Getting started with Leptos and Tauri \- ForgeStream \- IDVerse®, [https://forgestream.idverse.com/blog/20251020-getting-started-with-leptos-and-tauri/](https://forgestream.idverse.com/blog/20251020-getting-started-with-leptos-and-tauri/)  
35. Dioxus 0.6 – Crossplatform apps with Rust | Hacker News, [https://news.ycombinator.com/item?id=42388665](https://news.ycombinator.com/item?id=42388665)  
36. GitHub \- DioxusLabs/dioxus: Fullstack app framework for web, desktop, and mobile., [https://github.com/dioxuslabs/dioxus](https://github.com/dioxuslabs/dioxus)  
37. Dioxus Has a Free API: Write React-Style UIs in Rust That Run Everywhere — Web, Desktop, Mobile \- DEV Community, [https://dev.to/0012303/dioxus-has-a-free-api-write-react-style-uis-in-rust-that-run-everywhere-web-desktop-mobile-34ae](https://dev.to/0012303/dioxus-has-a-free-api-write-react-style-uis-in-rust-that-run-everywhere-web-desktop-mobile-34ae)  
38. Tauri and leptos : the ultimate stack? : r/rust \- Reddit, [https://www.reddit.com/r/rust/comments/1t0zvzb/tauri\_and\_leptos\_the\_ultimate\_stack/](https://www.reddit.com/r/rust/comments/1t0zvzb/tauri_and_leptos_the_ultimate_stack/)  
39. Building desktop apps with rust and htmx \- Tauri Tutorials, [https://tauritutorials.com/blog/building-desktop-apps-with-rust-and-htmx](https://tauritutorials.com/blog/building-desktop-apps-with-rust-and-htmx)  
40. What is Tauri?, [https://v2.tauri.app/start/](https://v2.tauri.app/start/)  
41. Tauri 2.0 Stable Release, [https://v2.tauri.app/blog/tauri-20/](https://v2.tauri.app/blog/tauri-20/)  
42. Tauri (software) \- Grokipedia, [https://grokipedia.com/page/Tauri\_software](https://grokipedia.com/page/Tauri_software)  
43. Lemonade Desktop App (Tauri), [https://lemonade-server.ai/dev/app.html](https://lemonade-server.ai/dev/app.html)  
44. Build a Desktop App with Tauri v2 in 2026 (Step-by-Step Tutorial) \- Rustify \- Rust Bootcamp, [https://rustify.rs/articles/rust-tauri-v2-desktop-app-tutorial-2026](https://rustify.rs/articles/rust-tauri-v2-desktop-app-tutorial-2026)  
45. Built a 5 MB Multi-Window IDE with Tauri v2 in 7 Days \- Reddit, [https://www.reddit.com/r/tauri/comments/1tvzyco/built\_a\_5\_mb\_multiwindow\_ide\_with\_tauri\_v2\_in\_7/](https://www.reddit.com/r/tauri/comments/1tvzyco/built_a_5_mb_multiwindow_ide_with_tauri_v2_in_7/)  
46. Calling Rust from the Frontend \- Tauri, [https://v2.tauri.app/develop/calling-rust/](https://v2.tauri.app/develop/calling-rust/)  
47. I'm building a Tauri \+ Rust backup app and exploring Rust/WASM to share logic between UI and backend : r/tauri \- Reddit, [https://www.reddit.com/r/tauri/comments/1u22wx5/im\_building\_a\_tauri\_rust\_backup\_app\_and\_exploring/](https://www.reddit.com/r/tauri/comments/1u22wx5/im_building_a_tauri_rust_backup_app_and_exploring/)  
48. Releases · specta-rs/tauri-specta \- GitHub, [https://github.com/specta-rs/tauri-specta/releases](https://github.com/specta-rs/tauri-specta/releases)  
49. We built a desktop app with Tauri (v2) and it was a delightful experience : r/rust \- Reddit, [https://www.reddit.com/r/rust/comments/1rekooi/we\_built\_a\_desktop\_app\_with\_tauri\_v2\_and\_it\_was\_a/](https://www.reddit.com/r/rust/comments/1rekooi/we_built_a_desktop_app_with_tauri_v2_and_it_was_a/)  
50. Tauri v2 Multi-Window and System Tray Development Guide | Oflight Inc., [https://www.oflight.co.jp/en/columns/tauri-v2-multi-window-system-tray](https://www.oflight.co.jp/en/columns/tauri-v2-multi-window-system-tray)  
51. clearlysid/tauri-plugin-decorum: Opinionated window decorations for Tauri apps \- GitHub, [https://github.com/clearlysid/tauri-plugin-decorum](https://github.com/clearlysid/tauri-plugin-decorum)  
52. tauri-plugin-frame \- Lib.rs, [https://lib.rs/crates/tauri-plugin-frame](https://lib.rs/crates/tauri-plugin-frame)  
53. Embedding External Binaries \- Tauri, [https://v2.tauri.app/develop/sidecar/](https://v2.tauri.app/develop/sidecar/)  
54. JavaScript Web SDK \- PowerSync Docs, [https://docs.powersync.com/client-sdks/reference/javascript-web](https://docs.powersync.com/client-sdks/reference/javascript-web)  
55. I built an offline-first sync engine for SQLite ↔ PostgreSQL using column-level CRDTs, [https://www.reddit.com/r/PostgreSQL/comments/1u46j87/i\_built\_an\_offlinefirst\_sync\_engine\_for\_sqlite/](https://www.reddit.com/r/PostgreSQL/comments/1u46j87/i_built_an_offlinefirst_sync_engine_for_sqlite/)  
56. Show HN: SyncKit – Offline-first sync engine (Rust/WASM and TypeScript) | Hacker News, [https://news.ycombinator.com/item?id=46069598](https://news.ycombinator.com/item?id=46069598)  
57. crdt-kit \- crates.io: Rust Package Registry, [https://crates.io/crates/crdt-kit](https://crates.io/crates/crdt-kit)  
58. Any downsides to using indexedDB vs localStorage? : r/sveltejs \- Reddit, [https://www.reddit.com/r/sveltejs/comments/15rj12h/any\_downsides\_to\_using\_indexeddb\_vs\_localstorage/](https://www.reddit.com/r/sveltejs/comments/15rj12h/any_downsides_to_using_indexeddb_vs_localstorage/)  
59. Building a Secure Offline-First Desktop App with Tauri and IndexedDB | by Bhagya Rana, [https://medium.com/@bhagyarana80/building-a-secure-offline-first-desktop-app-with-tauri-and-indexeddb-ae231c26b364](https://medium.com/@bhagyarana80/building-a-secure-offline-first-desktop-app-with-tauri-and-indexeddb-ae231c26b364)  
60. I built an offline-first sync engine for SQLite ↔ PostgreSQL using column-level CRDTs : r/rust, [https://www.reddit.com/r/rust/comments/1u77bwc/i\_built\_an\_offlinefirst\_sync\_engine\_for\_sqlite/](https://www.reddit.com/r/rust/comments/1u77bwc/i_built_an_offlinefirst_sync_engine_for_sqlite/)  
61. SQLite Sync \- Offline-first CRDT sync for SQLite, [https://www.sqlite.ai/sqlite-sync](https://www.sqlite.ai/sqlite-sync)  
62. Security | Tauri, [https://v2.tauri.app/security/](https://v2.tauri.app/security/)  
63. Configuring Tauri Permissions | Claude Code Skills, [https://claudemarketplaces.com/skills/dchuk/claude-code-tauri-skills/configuring-tauri-permissions](https://claudemarketplaces.com/skills/dchuk/claude-code-tauri-skills/configuring-tauri-permissions)  
64. Capability \- Tauri, [https://v2.tauri.app/reference/acl/capability/](https://v2.tauri.app/reference/acl/capability/)  
65. Permissions and Capabilities | zudo-tauri-wisdom, [https://takazudomodular.com/pj/zudo-tauri/docs/frontend/capabilities/](https://takazudomodular.com/pj/zudo-tauri/docs/frontend/capabilities/)  
66. Capabilities | Tauri, [https://v2.tauri.app/security/capabilities/](https://v2.tauri.app/security/capabilities/)  
67. tauri \- Skill \- Smithery, [https://smithery.ai/skills/patrickhaahr/tauri](https://smithery.ai/skills/patrickhaahr/tauri)  
68. Permissions \- Tauri, [https://v2.tauri.app/security/permissions/](https://v2.tauri.app/security/permissions/)  
69. Using Plugin Permissions \- Tauri, [https://v2.tauri.app/learn/security/using-plugin-permissions/](https://v2.tauri.app/learn/security/using-plugin-permissions/)  
70. Security \- Wasmtime, [https://docs.wasmtime.dev/security.html](https://docs.wasmtime.dev/security.html)  
71. Wasm's Sandbox Isn't Bulletproof. Cage Adds a Bodyguard. | by Enrico Piovesan \- Medium, [https://medium.com/wasm-radar/wasms-sandbox-isn-t-bulletproof-cage-adds-a-bodyguard-57654004dc5a](https://medium.com/wasm-radar/wasms-sandbox-isn-t-bulletproof-cage-adds-a-bodyguard-57654004dc5a)  
72. Customizing Builds with Release Profiles \- The Rust Programming Language \- MIT, [https://web.mit.edu/rust-lang\_v1.25/arch/amd64\_ubuntu1404/share/doc/rust/html/book/second-edition/ch14-01-release-profiles.html](https://web.mit.edu/rust-lang_v1.25/arch/amd64_ubuntu1404/share/doc/rust/html/book/second-edition/ch14-01-release-profiles.html)  
73. How to make your Tauri dev faster, [https://dev.to/ahonn/how-to-make-your-tauri-dev-faster-2en1](https://dev.to/ahonn/how-to-make-your-tauri-dev-faster-2en1)  
74. Deploying SSR Apps \- Leptos book, [https://book.leptos.dev/deployment/ssr.html](https://book.leptos.dev/deployment/ssr.html)  
75. tauri | tauri-apps/tauri \- OSSphere, [https://www.ossphere.dev/tauri-apps/tauri](https://www.ossphere.dev/tauri-apps/tauri)  
76. tauri/ARCHITECTURE.md at dev \- GitHub, [https://github.com/tauri-apps/tauri/blob/dev/ARCHITECTURE.md](https://github.com/tauri-apps/tauri/blob/dev/ARCHITECTURE.md)  
77. Tauri Architecture, [https://v2.tauri.app/concept/architecture/](https://v2.tauri.app/concept/architecture/)  
78. Awesome Tauri Apps, Plugins and Resources \- GitHub, [https://github.com/tauri-apps/awesome-tauri](https://github.com/tauri-apps/awesome-tauri)  
79. GitHub \- dannysmith/tauri-template: A production-ready template for building modern desktop applications with Tauri v2, React 19, and TypeScript. This template provides a solid foundation with best practices, comprehensive documentation, and quality tooling built-in., [https://github.com/dannysmith/tauri-template](https://github.com/dannysmith/tauri-template)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHUAAAAaCAYAAACJphMzAAADy0lEQVR4Xu2YWahOURTHl1BkdmUIGZIiDyTqCk/GzFMR8SBDkuKBTA9ChlKGyDXFkwwlRTKk+6h4UUJKIfHEEw/I8P/f9e3v7rO+c8693/mu43Pbv/p3v7v3Puestdfee61zRAKBQCAQaKANVAN1tx05Uy12/Pfshr5Dv6H9pi9PqsWOVsMU6Cc013bkTLXY8U8ZCd2C3kHfoI/QE2gl1NEb1xTbRK8dajtyJqsdA6CzovPwBfoMPYO2Ql29cVUNc88G6LKoQ+QENBZqD62A7nh9aXSAbkP1UOdoV65ktWMWdE90gRMujDlQW2gq9AAaXejLDT58BDQN6mT6klgEHRQNoMMF1TEeugp189ri6A+9gQ5Aw6H5UD9/QE5ksYM+XpCojy6ojkHQzcLf5pAlHhFo/CNRR3hk1kMfoC3eGEsfqE5Kg2WDSpZD60ybhXnsF/QW2guth15BC/1BOVCuHUwvp6DBpt0GlUyC9omecGlkiUcErhwavV0aH8YgsPpLKxSWQstso8QHlav/nKSvOE4CixPufsclST8G+Xzmr+aKeX5Yw5XJlGtHLbTDNkp8UHk9dzQ3RBJZ41Gknehkv4eGeO1cEZ9Et38SdGSm6NHk6zw03bTx3hcLv+OgHdeldOI4mdwxSde1NFns4ISvltJ54C7nLrPtx6R00TsqiUcRDuJgOsIbkiTHLHz4DeiM0cuE9ocSPynE5bHjXlsP6DH0WtJXdkuSxQ7uSBZI1l+eCnHt9yU5qJXEowiPB25rP9/RcDrgOxbHRtH8Y4k7fruIOtTLtDs4/qtE85ZzkJW1c9DCStXuhDTRN7+os2Sxg6fVGtso8ccvj1Pu1KQdV0k8irib0DDHROiHqGO10Gavz4d9h6U06ccFlf/z64wd62A/c55/HRfNN9HiIgnmn8VlaB7Us+HKeLLYwWOSp5Z9H48L6kDopJSOdVQSjyKjRFehS8CsZPk+xdVKx3ZK/G4kXPGnRct5HxtUN26M12bhxPDYpgOEwXoh+tKetBD+BlnsYPsuiRZWxAbVjUsrdiqJRxE+iCvxqWiBw/N+gehXkLvQEUk/rug0vySN89r8oLLarRP9QJE0KYR9HMM8RDs4kbSL72p5ktUOTv4V0WA4P/2gcg4ZkEOF30lUGo8ITMC9pdF4Xsj815QzpC90TbRCnCBqzBJoE/Qcmi3pAfVhjmwq7+VBFju4gI+KfkGbIVr9roVWiRZanI/mzCepJB4tCvMFEzwLoj3QZClvUloLNaKfR/lBgjUH82Pa+3kgEAgEAoFAIBAIBJQ/ecvpI0uOwEoAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFUAAAAaCAYAAADG+xDjAAACMElEQVR4Xu2XQUhVQRSGT2gLMQkiSsmINkGRi5AEJVqFIVRQKSRF20BEsF2JCxeiCG1sk6KQK0GDNkFFES5buAkkInATUauWLaJF/r/nDY3z5l6ed97FheeDD31n5r533rkzZ+4TMQzDMAzDKMo5+Ap+g3/gT7gO78Mmb55RAwfgEFyG7ZXYU9gJD8J78LU3tu9ogGdhL2wOxrK4DadFC+hwRXV0wRV42IvlUSSPMimczxn4EU6Jbtk1+AM+9OaEHIdzUl2ssKjkLnwQxGIUyaNMCudzCn6Fj0S3M2ER/sEbblKEO3AwDEq8qCfgguTf6aJ5kHHRfl6rb+CR7SuzKZxPo+iX/Q5Pe3HeiV+iyz6Lx7APtgUuwqtBjO/9vPJ/jJQ8yiApHw5y0gvRNyL8y9dr8FAlFoMf+hLOB37JiH+Q7KKm5FEGSflcF13Ofr9jr9yEs14sxjC8EgYlvv1bRAt7NIg7UvIg/JLhjsnzmOgBlEVSPu5ibmPHJfgX3oLdcNQb8+HYjPzvN45YUfl6UqrnOlLyIB2wfxfyc/Ken5PyOS+6zF3j5Un+Hv4WLcSYxFcj4WPUM9FHJp+wqG7eBS8WkpJHGSTlw5XDbfxJ9IB5B2/CDfgWPpGdz6AhPCH5S+qiF/OLytN+TvQHQtYqJal51Ju65MOe5PcZXsD+l9d3HK1wFS7BHtEkBuAI/AyvSX5BfVLyKIM9z+ekaGPngTQBL0sNd9MwDMMwDMMwArYAd0OVvjYKXJsAAAAASUVORK5CYII=>
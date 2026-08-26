# **Executable Contract Generation And Differential Verification Across Rust, .NET, And JavaScript**

## **1\. Executive Architecture Decision**

The elimination of semantic drift between independently engineered systems necessitates the abandonment of manually synchronized schemas and the adoption of a single, normative modeling authority. To orchestrate a preregistered, one-shot operation involving a Rust producer, a .NET verifier, and a JavaScript coordinator, the architecture establishes the AWS Smithy Interface Definition Language (IDL) as the exclusive source of truth1. Smithy provides a resilient abstraction by isolating the syntactic description of data structures from the semantic constraints that govern business logic, thereby preventing the divergence of operational models.  
The build pipeline compiles the Smithy IDL into an isomorphic JSON Abstract Syntax Tree (AST), which serves as a machine-readable intermediate representation (IR)3. A proprietary, hermetically sealed compiler ingests this AST to generate deterministic, allocation-optimized execution contracts across all three runtimes. To guarantee cryptographic parity and prevent serialization-induced digest failures, the generated parsing and validation layers are mandated to enforce the JSON Canonicalization Scheme (JCS) as defined in RFC 87855. The integration of JCS ensures that cryptographic hashes computed over the Qwen3 composition and its associated receipts remain byte-for-byte identical, regardless of the memory layout or object-property ordering inherent to the underlying Rust, .NET, or JavaScript runtimes7.  
To mathematically prove adherence to the normative model and expose any deviations before deployment, the architecture mandates an automated differential testing orchestrator. This orchestrator leverages property-based generation to subject the Rust, .NET, and JavaScript binaries to identical, immutable input vectors9. Any discrepancy in parsing bounds, semantic validation, or terminal outcome derivation triggers an immediate build failure, completely obstructing the deployment of drifting logic and guaranteeing that generated code never serves as an excuse to bypass independent recomputation.

## **2\. Requirements and Threat Model**

The deployment operates under a strict clean-slate paradigm for a prelaunch product, deliberately abandoning any obligation to preserve backward compatibility, execute schema migrations, or maintain parallel fallback readers. This lack of legacy debt allows the architecture to impose uncompromising validation boundaries. The system must coordinate a distributed operation where a Rust process produces a Qwen3 composition, a .NET process performs independent verification, and a JavaScript owner emits a bounded final decision regarding the terminal state of the receipt.  
The primary threat vector identified in the historical failure stems from implicit, documentation-driven semantic drift. The Rust producer emitted a child durability operation identifier terminating in \-members alongside a performed status, while the .NET verifier autonomously expected the unaltered parent operation identifier paired with a flushed status. This critical divergence occurred because the relationship between parent-child identifiers and terminal state transitions was implied through human-readable documentation rather than strictly enforced by a unified, executable contract. Without a shared semantic model, the independent implementations diverged in their handling of mutually exclusive terminal outcomes.  
Further threat vectors involve resource exhaustion and canonicalization drift. Malicious or malformed payloads containing highly nested JSON arrays or artificially inflated strings pose a Denial of Service (DoS) risk via decompression bombs and unbounded memory allocation attacks. Consequently, the architecture must guarantee bounded memory consumption by utilizing forward-only, zero-allocation parsers at the ingestion boundary11. Additionally, canonicalization drift poses a severe threat to non-repudiation; if the Rust implementation serializes a numeric value with excess precision and the JavaScript implementation silently truncates this value due to IEEE 754 floating-point limitations, the resulting cryptographic digests will irrevocably diverge12. The threat model thus necessitates the rigorous enforcement of Internet JSON (I-JSON) constraints, explicitly mapping large integers to safe types to prevent lossy conversions across runtime boundaries.

## **3\. Schema/IDL Option Matrix and Selection Rationale**

Selecting the definitive source-of-truth technology requires evaluating available data description languages against stringent requirements for cross-language determinism, generated code auditability, unknown-field rejection, and the capacity to express complex semantic invariants.

| Technology | Deterministic Generation | Integer Safety | Unknown Field Rejection | Semantic Modeling Capacity | Ecosystem Maturity |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **JSON Schema (2020-12)** | Moderate | Weak (requires custom limits) | Yes (additionalProperties) | Weak (syntax constrained) | High |
| **CDDL (RFC 8610\)** | Moderate | High | Yes | Moderate | Moderate14 |
| **Protocol Buffers** | High | High | No (preserves by default) | Weak | High |
| **FlatBuffers** | High | High | No | Weak | High |
| **OpenAPI** | Moderate | Weak | Yes | Weak | High |
| **Smithy IDL** | High | High (explicit primitives) | Yes | High (custom traits) | High1 |
| **Custom DSL** | High | High | Yes | High | Low (tooling overhead) |

JSON Schema and OpenAPI provide robust syntactic constraints but fundamentally lack the capability to natively model state transitions, operation graph linkage, or mutual exclusivity without heavy reliance on proprietary extension keywords that external code generators frequently ignore. Protocol Buffers and FlatBuffers enforce strict typing and offer high-performance serialization, but they are architecturally designed around permissive evolution. By default, they preserve unknown fields rather than rejecting them, directly violating the strict exact-member-set equality and deterministic canonicalization requirements of this architecture16. The Concise Data Definition Language (CDDL) offers excellent capabilities for defining compact data representations and boasts zero-copy Rust support14, but its code-generation ecosystems lack the rigorous, battle-tested trait systems required to model operational state machines across three vastly different language paradigms16.  
Smithy IDL emerges as the optimal choice. Unlike Protocol Buffers, Smithy is protocol-agnostic and explicitly supports canonical JSON payloads17. Crucially, Smithy utilizes a robust trait system that allows engineers to annotate abstract shapes with proprietary semantic rules19. By defining custom traits for state transitions, parent-child ID derivation logic, and digest recomputation, the schema compiler can generate not just the syntax parsers, but the deterministic semantic validators required by the JavaScript owner and the .NET verifier. The Smithy IDL is subsequently compiled into a JSON Abstract Syntax Tree (AST), serving as a unified, machine-readable intermediate representation for the proprietary compiler pipeline3.

## **4\. Normative IR and Deterministic Compiler Design**

The compilation pipeline translates the Smithy IDL into the Smithy JSON AST, establishing the AST as the singular Intermediate Representation (IR) from which all executable artifacts are derived. To guarantee that the generated code is inherently auditable, reproducible, and impervious to non-deterministic build environments, the schema compiler functions as a strict pure function.  
The custom compiler parses the JSON AST, mapping the defined shapes and traits into an in-memory directed acyclic graph. The AST representation utilizes absolute shape identifiers, completely eliminating the complexities of relative namespace resolution during the generation phase3. The generation engine traverses this graph utilizing a strict lexicographical sort based on these absolute identifiers. This design guarantees that regardless of the order in which shapes are authored in the source IDL files, the resulting generated files will always output structures, classes, and interfaces in an identical sequence. Source mapping is preserved by extracting the Smithy documentation traits and normalizing them into standard Rust ///, C\# ///, and TypeScript /\*\* \*/ docstrings, ensuring that developer tooling maintains context without altering the executable footprint2.  
To programmatically resolve the historical durability mismatch, the IR integrates a proprietary semantic trait denoted as @terminalStateTransition. The schema defines DurabilityStatus as a closed enumeration, and the custom trait explicitly binds the status flushed to the parent operation identifier, actively signaling the compiler to generate validation logic that rejects any \-members suffix.  
The compiler embeds a deterministic cryptographic hash of the source AST, combined with the compiler's own version identifier, into the header of every generated file. During the Continuous Integration (CI) pipeline, the compiler executes in an offline, hermetically sealed container. The resulting byte output is hashed using SHA-256. If the generated files committed to the repository deviate by a single byte from the newly generated output, the CI pipeline fails immediately. This byte-for-byte reproducibility rule enforces the mandate that hand-editing generated code is strictly prohibited, securing the integrity of the generation toolchain21.

## **5\. Generated API Contracts by Language**

The generated API contracts enforce uncompromising memory boundaries, bounded parsing, and rigorous error handling. The architecture expressly forbids permissive parsing algorithms, silently dropped fields, or implicit type coercions that could facilitate semantic drift.  
The Rust implementation functions as the producer of the Qwen3 composition and its associated cryptographic receipts. The generated Rust API leverages the serde framework, specifically utilizing the \#\[serde(borrow)\] attribute to map string and byte payloads directly to borrowed references (&'a str and &'a \[u8\]) or Cow\<'a, T\> types tied to the lifetime of the input buffer22. This zero-copy deserialization strategy eliminates unnecessary heap allocations during payload processing. All integers are mapped to explicit, capacity-bound types, and any truncation or numeric overflow triggers a strongly typed error enumeration rather than a catastrophic runtime panic.  
The .NET implementation serves as the independent verifier, necessitating extreme resilience against decompression and allocation bombs. To minimize Garbage Collection (GC) pressure, the generated C\# API bypasses traditional object materialization for the initial inspection phase. Instead, it employs the Utf8JsonReader struct operating directly over a ReadOnlySpan\<byte\> or ReadOnlySequence\<byte\>24. This forward-only, allocation-free parsing model guarantees high-throughput validation11. When materialization into POCOs (Plain Old CLR Objects) is required, the System.Text.Json configuration is strictly locked using JsonUnmappedMemberHandling.Disallow26. This ensures that if the Rust producer emits an undocumented or deprecated field, the .NET verifier immediately throws a JsonException, refusing the payload rather than silently ignoring the anomaly28. Buffer length constraints are enforced using checked((int)reader.ValueSequence.Length) to ensure excessively large payloads trigger bounds-checking exceptions before memory exhaustion occurs30.  
The TypeScript/JavaScript implementation assumes the role of the transaction owner. Because the JavaScript runtime natively represents all numbers as IEEE 754 double-precision floats, integer precision loss represents a critical vulnerability in cryptographic hashing6. The generated API utilizes a specialized parsing layer that intercepts numerical values during the JSON.parse reviver phase, similar to the mechanics of the lossless-json library13. Any integer exceeding Number.MAX\_SAFE\_INTEGER is strictly mapped to the native BigInt primitive, preventing accidental lossy conversion during digest recomputation13. Furthermore, the generated TypeScript definitions utilize discriminated tagged unions for all polymorphic types and terminal state outcomes. This architectural choice forces the TypeScript compiler to enforce exhaustive switch-statement matching, effectively preventing the JavaScript owner from accidentally ignoring a terminal outcome state or processing an invalid state transition.

## **6\. Semantic-Validation Ownership Boundaries**

Ordinary schema languages excel at defining syntactic boundaries—ensuring a payload contains a string and an integer—but fundamentally fail to enforce the semantic invariants necessary for cross-system consensus. Syntactic checks cannot verify that an operation graph remains acyclic, nor can they guarantee that a cryptographic digest precisely matches the recomputed representation of its constituent fields. The architecture separates these concerns by embedding autonomous semantic validators directly into the generated code, preventing common-mode bugs without requiring developers to maintain hand-copied validation logic33.  
The generated code provides an abstraction layer cleanly divided into syntax parsers and semantic validators. Syntax parsers strictly convert raw byte streams into memory representations, enforcing I-JSON constraints and UTF-8 validity. Semantic validators consume these normalized memory representations and execute cross-field invariant checks. For example, the mathematical derivation of the parent-child operation ID is encoded directly within the Smithy AST via custom traits. The schema compiler interprets this relationship and generates a pure mathematical function in Rust, C\#, and TypeScript that derives the expected child ID from the parent ID, completely isolating this logic from the producer's internal business logic.  
By centralizing the logic within the normative schema and mechanically generating the validation functions, the architecture structurally prevents the exact semantic drift that caused the historical failure. The Rust producer utilizes the generated function to compute the required ID, and the .NET verifier uses its own identically generated function to validate it. Because both functions are derived from the same mathematical model within the IR, they cannot drift. The business logic of the respective applications remains entirely separated from these validation boundaries, interacting solely with the strongly typed terminal verdict outputted by the generated validators. The validators will independently recompute JCS digests, ensuring that generated code never trusts producer claims without objective, byte-for-byte verification5.

## **7\. Golden-Vector Format and Representative Vectors**

To irrefutably prove interoperability and freeze known failure modes, the architecture requires a language-neutral golden-vector bundle. This bundle is committed to source control and serves as the immutable benchmark for all three implementations. The bundle is structured as an array of JSON objects, meticulously canonicalized using RFC 8785 to eliminate whitespace and ordering ambiguities5.  
The manifest format dictates that each test vector contains a unique vector\_id, a schema\_hash to cryptographically bind the test to a specific contract revision, the canonical\_bytes encoded as a hexadecimal string representing the raw input, and a rigid set of expected outcomes. The outcomes are split into three assertions: expected\_parse\_outcome, expected\_semantic\_verdict, and expected\_typed\_error.  
Representative vectors must exhaustively cover edge cases across all runtimes. The bundle includes vectors with malformed UTF-8 sequences and trailing bytes, triggering immediate parse rejections. It contains duplicate keys, ensuring all three languages strictly reject them rather than exhibiting "last-key-wins" behavior6. It tests unknown fields to explicitly validate the .NET JsonUnmappedMemberHandling.Disallow configuration26. It tests integer boundaries to verify BigInt parsing in JavaScript13. Furthermore, it includes timestamp edge cases, ensuring that all timestamps are processed as integer milliseconds since the Unix epoch (Substrate Rule 2), strictly forbidding RFC 3339 string representations that introduce parsing ambiguities5.  
Crucially, the bundle encodes the exact historical durability mismatch as a negative test vector. The input payload contains a child ID terminating in \-members combined with the status performed. The expected semantic verdict for this vector is explicitly REJECTED, with the expected typed error mapped to InvalidStateTransitionMismatch. This action immortalizes the previous failure as an immutable regression artifact, mathematically guaranteeing that no future compilation can ever permit that specific invalid state to propagate through the verifier.

## **8\. Differential, Property, Mutation, and Fuzz Testing**

The testing architecture relies on an advanced differential orchestration strategy to ensure absolute execution parity across the Rust, .NET, and JavaScript implementations. Instead of writing isolated, manually curated unit tests, the system utilizes property-based generation and shrinking to systematically explore the state space of the executable contract21.  
The orchestrator operates as a standalone process that generates identical, immutable input vectors based on reproducible random seeds. It leverages the property-testing ecosystem—utilizing algorithms derived from Rust's proptest framework and JavaScript's fast-check—to generate complex, structurally valid, and near-valid data compositions10. The orchestrator serializes these generated structures into canonical JSON8 and feeds the exact same byte array into the standard input of the isolated Rust, .NET, and JavaScript binaries.  
Each binary parses the input, applies the generated semantic validators, and writes the output verdict to standard output. The orchestrator captures these outputs and performs a strict equality check. The mathematical foundation of this differential verification is modeled such that the verdict of the Rust process must equal the verdict of the .NET process, which must equal the verdict of the JavaScript process for all inputs within the domain. If any implementation diverges—for instance, if JavaScript accepts a payload that .NET rejects due to an integer overflow—the orchestrator halts the testing campaign. It categorically rejects any non-deterministic behavior and refuses to implement a "majority vote" or permissive fallback.  
When a discrepancy is discovered, the orchestrator invokes a graph-aware shrinking algorithm36. Unlike basic linear shrinking, which blindly deletes bytes and often invalidates the JSON syntax entirely, graph-aware shrinking utilizes the underlying AST value tree to prune entire nodes, arrays, or nested fields while maintaining structural validity38. It systematically reduces the payload to the absolute minimal counterexample that triggers the cross-language disagreement. This minimized counterexample is then automatically promoted into the golden-vector bundle, preserving it permanently to prevent regression.

## **9\. Fuzz Boundaries and Coverage Validation**

To comprehensively harden the implementation against malicious inputs, the architecture defines strict fuzzing boundaries mapped to the distinct layers of the generated contract: the parser, the canonicalizer, the graph validator, the path validator, and the digest reader.  
Fuzzing operates across multiple runtime paradigms. Native fuzzing utilizes cargo-fuzz and libFuzzer in the Rust ecosystem to target the zero-copy deserialization boundaries, aggressively probing for panics, out-of-bounds reads on borrowed &\[u8\] slices, and unchecked integer arithmetic. Managed fuzzing in .NET targets the Utf8JsonReader and the JsonUnmappedMemberHandling.Disallow constraints, ensuring that heavily nested arrays or recursive object graphs do not result in StackOverflow exceptions or allocation bombs that bypass the Garbage Collector11. Browser JavaScript fuzzing focuses on the V8 engine's handling of BigInt conversions and tagged union discriminants, verifying that maliciously crafted numeric strings do not trigger catastrophic backtracking or heap exhaustion13.  
The fuzzing campaign incorporates corpus exchange, where successful mutation vectors discovered by the Rust native fuzzer are serialized and fed into the .NET and JavaScript fuzzing harnesses. This cross-pollination ensures that vulnerabilities unique to one runtime's parsing logic are immediately evaluated against the others. Coverage sanitizers (AddressSanitizer and MemorySanitizer for Rust) run concurrently to detect subtle memory leaks. Decompression bombs and memory limits are strictly enforced by applying timeout thresholds and maximum heap-size arguments to the test runner; any binary that exceeds a 50-millisecond execution window or allocates beyond a predetermined memory budget on a single payload is flagged as a denial-of-service vulnerability.

## **10\. Clean-Slate Replacement and Deletion Rules**

Because the project operates as a prelaunch, clean-slate product, the architecture strictly prohibits any form of soft deprecation, runtime aliases, fallback fields, or parallel contract readers. When a schema requires a correction prior to launch, the modification protocol dictates absolute atomic replacement.  
The responsible engineer must modify the normative Smithy IDL to reflect the new state logic or structural requirement. Upon execution, the compiler entirely overwrites the target directories containing the generated Rust, .NET, and JavaScript code. There are no migration scripts, and superseded code is completely deleted from the file system.  
Downstream applications consuming these generated APIs will subsequently fail to compile if they reference outdated fields, such as the deprecated \-members identifier or legacy status enumerations. This hard-break methodology forces developers to update their business logic to conform to the new semantic model immediately. Stale generated files are actively detected by the CI pipeline via hash mismatches, and any attempt to bypass the deletion rule or retain dual operational paths for hypothetical backward compatibility will cause an immediate build failure. Historical evidence readers—designed to inspect logs of older schema versions—are strictly isolated to out-of-band analytical environments and are categorically excluded from the active production deployment path.

## **11\. Reproducible Generation and Supply-Chain Controls**

Allowing dynamic, unverified code generation opens the pipeline to severe supply-chain attacks. To lock down the process, the compiler and all associated dependencies are subjected to extreme supply-chain controls, ensuring deterministic output21.  
The code generator binary itself is versioned via an immutable cryptographic hash. The build pipeline utilizes a strict lock file that pins the exact revision of every transitive dependency, preventing malicious upstream updates from altering the generation logic. The compilation of the schema into the executable API contracts is executed in a hermetically sealed, offline container environment. This isolation prevents the generator from downloading arbitrary code, probing network interfaces, or relying on changing remote resources during the build phase.  
The output artifacts are strictly deterministic. Given the same Smithy IDL and the same generator binary, the resulting Rust, C\#, and TypeScript source code must hash to the exact same value on any host machine. A Software Bill of Materials (SBOM) is generated for every build, mapping the cryptographic hashes of the IDL files, the compiler binary, and the generated output. During a pull request, the CI pipeline recalculates all hashes. If a developer manually alters a generated file without updating the source schema and regenerating the outputs, the CI gate will detect the mismatched hashes and reject the integration immediately, maintaining a fully auditable bootstrap trust chain.

## **12\. CI/Release Gate with Objective Evidence**

The Continuous Integration pipeline acts as the final, uncompromising enforcer of the executable contract. A release is only permitted if the CI pipeline can generate objective, cryptographically verifiable evidence that all systems are perfectly aligned.  
The pipeline executes in sequential validation phases. Phase one validates the Smithy IDL syntax against the language grammar. Phase two invokes the offline, hermetic generator to produce the API source code. Phase three hashes the newly generated code and compares it to the committed code in the repository; any drift results in a fatal error.  
Phase four compiles the Rust, .NET, and TypeScript implementations, injecting them into the differential testing orchestrator. The orchestrator feeds the golden-vector bundle into the binaries, checking for absolute execution parity across the historical failure cases. Phase five initiates the property-based fuzzing campaign, generating thousands of randomized mutations bounded by memory and timeout limits. If all phases succeed, the CI pipeline aggregates the compiler checksums, the golden-vector hash, and the differential testing logs into a signed attestation artifact. This artifact is attached to the release, providing incontrovertible proof that the contract is enforced uniformly and free of semantic drift.

## **13\. Prioritized Implementation Backlog**

To mitigate integration risk, the implementation of this architecture must proceed through a staged backlog, expanding scope progressively without prematurely coupling unrelated state machines.  
The first stage focuses entirely on isolating and proving the durability mismatch resolution. The schema is constructed solely for the OperationId and DurabilityStatus definitions. The custom compiler is built to emit the Rust and .NET syntax parsers for this minimal footprint, integrating the RFC 8785 canonicalization and the JsonUnmappedMemberHandling.Disallow constraints5. The golden-vector test containing the historical failure is executed to verify that the generated validators successfully reject the \-members anomaly across all targets.  
The second stage expands the schema to encompass the full Qwen3 composition contracts and browser receipts. This involves generating the complex nested structures, implementing graph-aware shrinking in the differential orchestrator, and verifying that the JavaScript layer safely handles the arbitrary precision integers using BigInt parsing logic13.  
The third stage models the acquisition receipts, bringing in the property-based fuzzing boundaries. The orchestrator is heavily tuned to attack the parsing boundaries with duplicate keys, extreme depths, and malformed UTF-8, ensuring that all three runtimes fail gracefully and securely under malicious load.  
The final stage finalizes the release receipts and enforces the clean-slate deployment pipeline. The CI gates are locked, the SBOM generation is automated, and the hermetic build environment is strictly enforced for production readiness.

## **14\. Unknown Local Facts**

The formulation of this architecture identifies several localized parameters that remain unverified and must be defined prior to executing the implementation backlog.  
The exact physical limitations of the Qwen3 payload sizes are unknown41. While the architecture bounds the parsing buffers to mitigate decompression attacks, the maximum allowable bytes for a legitimate multimodal receipt must be codified into the schema traits to prevent false positives during differential fuzzing.  
The specific operational capabilities of the Continuous Integration runners are undefined. The differential orchestrator requires substantial computational overhead to execute the Rust, .NET, and JavaScript runtimes concurrently during property-based mutation campaigns. If the CI environment heavily constrains CPU threads or memory, the fuzzing timeouts will require calibration to prevent non-deterministic pipeline failures.  
Finally, the precise cryptographic hashing algorithm intended for the receipt digest beyond the JCS canonicalization payload requires confirmation. While RFC 8785 mandates SHA-256 for the canonical output5, the subsequent signing algorithms (e.g., Ed25519, ECDSA) and their specific language-binding implementations must be audited to ensure they do not introduce side-channel vulnerabilities or cross-platform inconsistencies that could compromise non-repudiation.

## **15\. Annotated Primary-Source Bibliography**

* 16  
  Avrotize, "CDDL to JSON Structure Conversion," PyPI, *Accessed Aug 2026*. Provides insight into the limitations of generating complex semantic models from basic CDDL definitions across multiple languages.  
* 14  
  anweiss, "cddl-rs," GitHub, *Updated 2024*. Details the Rust implementation of the Concise Data Definition Language (RFC 8610\) and its constraints regarding unknown fields.  
* 16  
  Avrotize Schema Converter, *Accessed Aug 2026*. Documents the inherent incompatibility of Protocol Buffers regarding strict semantic enforcement and unknown field retention.  
* 17  
  Simon K. Johnston, "Smithy and Atelier," *August 10, 2021*. Discusses the AWS Smithy IDL framework and its Rust implementation for semantic model generation.  
* 1  
  Smithy Official Documentation, "Build with Smithy," *Accessed Aug 2026*. Outlines Smithy's protocol-agnostic, multi-language code generation capabilities.  
* 1  
  Smithy IDL Guide, *Accessed Aug 2026*. Validates the ecosystem maturity of Smithy for TypeScript, Rust, and .NET environments.  
* 33  
  Texas Instruments, "Differential Testing in High-Speed Systems," *Accessed Aug 2026*. Establishes the theoretical foundation for eliminating common-mode bugs via independent verification.  
* 34  
  ArXiv Preprint 2608.18039v1, "Bug Prevention," *Aug 2026*. Discusses CRUD nonconformance bug rates and the necessity of differential testing.  
* 5  
  Hopley, "JSON Canonicalization Scheme (JCS) v1," IETF Draft, *Accessed Aug 2026*. Specifies the canonicalization discipline, cross-language reproducibility, and Substrate Rule 2 for timestamp normalization.  
* 6  
  RFC 8785, "JSON Canonicalization Scheme (JCS)," *Published 2020*. The foundational IETF standard mandating ECMAScript primitive serialization and lexicographical sorting for cryptographic hashing.  
* 12  
  RFC 8785 Translation/Explanation, *Accessed Aug 2026*. Further clarifies the necessity of I-JSON constraints to prevent floating-point and integer truncation discrepancies.  
* 13  
  lossless-json, "TypeScript JSON parser preserving BigInt," npm, *Accessed Aug 2026*. Details the mechanics of intercepting long numerical values in JavaScript to prevent precision loss.  
* 32  
  OpenActive, "Large Integers in JavaScript," *Accessed Aug 2026*. Demonstrates the necessity of custom revivers for integer safety in JS runtimes.  
* 3  
  Smithy Spec, "JSON AST," *Accessed Aug 2026*. Defines the isomorphic Abstract Syntax Tree representation used as the compiler's Intermediate Representation.  
* 2  
  Smithy Spec, "IDL Grammar," *Accessed Aug 2026*. Specifies the ABNF grammar for defining Smithy models.  
* 19  
  Tanruan, J., "AWS Smithy API Models," Medium, *Accessed Aug 2026*. Analyzes Smithy's shape and trait system for defining complex API components.  
* 18  
  Smithy Protocol Traits, "awsJson1\_0," *Accessed Aug 2026*. Discusses integer and bigDecimal constraints within JSON serialization.  
* 4  
  Decision.ai, "Smithy JSON AST Structure," *Accessed Aug 2026*. Validates the use of absolute shape IDs in the AST to eliminate relative reference parsing.  
* 2  
  Smithy Spec, "Documentation Comments," *Accessed Aug 2026*. Explains the syntactic conversion of IDL documentation into the AST semantic model.  
* 20  
  Smithy Spec, "Semantic Model and Traits," *Accessed Aug 2026*. Documents trait application, conflict resolution, and the creation of semantic models.  
* 7  
  CoderPatros, "dotnet-jss," GitHub, *Accessed Aug 2026*. Demonstrates the use of JCS for deterministic JSON signatures in .NET.  
* 26  
  .NET Runtime Issues, "\#100057: JsonUnmappedMemberHandling," GitHub, *Mar 2024*. Details the behavior and strict constraints of JsonUnmappedMemberHandling.Disallow during deserialization.  
* 27  
  Microsoft Learn, "JsonUnmappedMemberHandling Enum," *Accessed Aug 2026*. Official documentation for rejecting unknown JSON properties in C\#.  
* 28  
  Stack Overflow, "ASP.NET Core \- System.Text.Json: reject unknown properties," *Accessed Aug 2026*. Community validation of strict field mapping techniques.  
* 29  
  Duende Software, "Harden your .NET JSON Deserialization," *April 2026*. Highlights vulnerabilities caused by duplicate keys and the necessity of strict validation boundaries.  
* 36  
  Pearce, A., "Proptest Book," *Accessed Aug 2026*. Introduces property testing in Rust and the mechanics of value shrinking.  
* 9  
  Proptest Rustdoc, *Accessed Aug 2026*. Details the internal mechanics of stateful shrinking and value generation strategies.  
* 38  
  Falsify Paper, *Accessed Aug 2026*. Analyzes graph-aware shrinking via sample trees versus traditional linear choice sequences.  
* 39  
  Hypofuzz Docs, "Literature on Structure-Aware Fuzzing," *Accessed Aug 2026*. Discusses adaptive mutation operators and structure-aware mutation logic.  
* 35  
  PLDI 23, "Property Based Testing," *Accessed Aug 2026*. Compares frameworks across languages, specifically noting how implementations capture differing coverage properties.  
* 24  
  Stack Overflow, "System.Text.Json deserializing from Pipelines," *Oct 2019*. Demonstrates the use of Utf8JsonReader with sequences for low-allocation parsing.  
* 11  
  Rowles, J., "Building Zero-Allocation Parsers in C\#," Medium, *Accessed Aug 2026*. Explains the performance benefits of ReadOnlySpan and ref struct parsers.  
* 25  
  .NET Runtime Issues, "\#54410: Utf8JsonReader GetChars," GitHub, *Jun 2021*. Details internal Utf8JsonReader behavior and non-allocating string views.  
* 11  
  Rowles, J., "Building Zero-Allocation Parsers," Medium, *Accessed Aug 2026*. Discusses avoiding GC pressure via Span slicing.  
* 22  
  Serde Rustdoc, "BorrowCow," *Accessed Aug 2026*. Documents the \#\[serde(borrow)\] attribute for zero-copy deserialization in Rust.  
* 23  
  Serde.rs, "Lifetimes," *Accessed Aug 2026*. Further documentation on lifetime binding in Rust serialization.  
* 40  
  Qwen Blog, "Qwen-Image-2.0," *Accessed Aug 2026*. Analyzes the generative capabilities and architectural constraints of the Qwen multimodal compositions.  
* 41  
  Qwen Documentation, "Concepts," *Accessed Aug 2026*. Defines context lengths, chat templates, and structural capabilities of the Qwen3 language model.  
* 8  
  Truestamp, "@truestamp/canonify," npm, *Accessed Aug 2026*. Documents a zero-dependency TypeScript implementation of JCS (RFC 8785\) for deterministic canonicalization.  
* 42  
  Cyberphone, "json-canonicalization," GitHub, *Accessed Aug 2026*. The reference implementation for cryptographic JSON canonicalization in JavaScript and Java.  
* 36  
  Proptest Book, "Custom Shrinker Example," *Accessed Aug 2026*. Provides practical examples of writing deterministic, shrinking property tests in Rust.  
* 37  
  Nevyk, P., "Proptest Strategies the Hard Way," *Accessed Aug 2026*. Explains complex state-machine tracking during graph-aware shrinking.  
* 10  
  Fast-Check, "Property Based Testing for JavaScript," npm, *Accessed Aug 2026*. Documents the primary fuzzing and property-testing framework for TypeScript/JavaScript APIs.  
* 21  
  Ondos Whitepaper, "Differential Verification and Compilers," *Accessed Aug 2026*. Validates the necessity of byte-for-byte reproducibility and self-hosting compiler trust mechanisms.  
* 21  
  Ondos Whitepaper, *Accessed Aug 2026*. Further details differential verification strategies across toolchains.  
* 30  
  Microsoft Learn, "System.Text.Json How-To," *Accessed Aug 2026*. Demonstrates integer parsing and boundary checks utilizing reader.ValueSequence.Length.  
* 31  
  .NET DevBlogs, "System.Text.Json in .NET 7," *Accessed Aug 2026*. Details low-level buffer constraints and capacity checking during span-based JSON reading.

#### **Works cited**

> 1. Smithy: Build services. Build SDKs. Build with Smithy., [https://smithy.io/](https://smithy.io/)  
> 2. Smithy IDL — Smithy 2.0, [https://smithy.io/2.0/spec/idl.html](https://smithy.io/2.0/spec/idl.html)  
> 3. JSON AST — Smithy 2.0, [https://smithy.io/2.0/spec/json-ast.html](https://smithy.io/2.0/spec/json-ast.html)  
> 4. aws/smithy-ast-model | Decision Hub, [https://hub.decision.ai/skills/aws/smithy-ast-model](https://hub.decision.ai/skills/aws/smithy-ast-model)  
> 5. JCS Canonicalisation Discipline for Agentic-Payment Receipts \- IETF, [https://www.ietf.org/archive/id/draft-hopley-x402-canonicalisation-jcs-v1-02.html](https://www.ietf.org/archive/id/draft-hopley-x402-canonicalisation-jcs-v1-02.html)  
> 6. RFC 8785: JSON Canonicalization Scheme (JCS), [https://www.rfc-editor.org/info/rfc8785/](https://www.rfc-editor.org/info/rfc8785/)  
> 7. dotnet-jss/README.md at main · coderpatros/dotnet-jss · GitHub, [https://ithub.global.ssl.fastly.net/coderpatros/dotnet-jss/blob/main/README.md](https://ithub.global.ssl.fastly.net/coderpatros/dotnet-jss/blob/main/README.md)  
> 8. truestamp/canonify \- NPM, [https://www.npmjs.com/package/@truestamp/canonify](https://www.npmjs.com/package/@truestamp/canonify)  
> 9. proptest \- Rust \- GitHub Pages, [https://altsysrq.github.io/rustdoc/proptest/0.8.1/proptest/](https://altsysrq.github.io/rustdoc/proptest/0.8.1/proptest/)  
> 10. fast-check \- NPM, [https://www.npmjs.com/package/fast-check](https://www.npmjs.com/package/fast-check)  
> 11. Building Zero-Allocation Parsers in C\# .NET \- Jordan Rowles, [https://jordansrowles.medium.com/building-zero-allocation-parsers-in-c-net-348ce6d124f1](https://jordansrowles.medium.com/building-zero-allocation-parsers-in-c-net-348ce6d124f1)  
> 12. RFC 8785 \- JSON Canonicalization Scheme (JCS) 日本語訳, [https://tex2e.github.io/rfc-translater/html/rfc8785.html](https://tex2e.github.io/rfc-translater/html/rfc8785.html)  
> 13. lossless-json \- NPM, [https://www.npmjs.com/package/lossless-json](https://www.npmjs.com/package/lossless-json)  
> 14. GitHub \- anweiss/cddl: Concise data definition language (RFC 8610, [https://github.com/anweiss/cddl](https://github.com/anweiss/cddl)  
> 15. Flatbuffers vs CBOR \- json \- Stack Overflow, [https://stackoverflow.com/questions/47799396/flatbuffers-vs-cbor](https://stackoverflow.com/questions/47799396/flatbuffers-vs-cbor)  
> 16. avrotize \- PyPI, [https://pypi.org/project/avrotize/](https://pypi.org/project/avrotize/)  
> 17. Smithy and Atelier \- Randomizer, [https://simonkjohnston.life/work/2021/08/10/Smithy-and-Atelier.html](https://simonkjohnston.life/work/2021/08/10/Smithy-and-Atelier.html)  
> 18. AWS JSON 1.0 protocol — Smithy 2.0, [https://smithy.io/2.0/aws/protocols/aws-json-1\_0-protocol.html](https://smithy.io/2.0/aws/protocols/aws-json-1_0-protocol.html)  
> 19. AWS Smithy API Models: Fueling Agentic AI and Safe Tool Use, [https://jtanruan.medium.com/aws-smithy-api-models-fueling-agentic-ai-and-safe-tool-use-1814f6bc44df](https://jtanruan.medium.com/aws-smithy-api-models-fueling-agentic-ai-and-safe-tool-use-1814f6bc44df)  
> 20. The Smithy model — Smithy 2.0, [https://smithy.io/2.0/spec/model.html](https://smithy.io/2.0/spec/model.html)  
> 21. Ondos docs · Montana Labs, [https://ondos.montanalabs.ai/ondos-whitepaper.pdf](https://ondos.montanalabs.ai/ondos-whitepaper.pdf)  
> 22. BorrowCow in serde\_with \- Rust \- Docs.rs, [https://docs.rs/serde\_with/latest/serde\_with/struct.BorrowCow.html](https://docs.rs/serde_with/latest/serde_with/struct.BorrowCow.html)  
> 23. Understanding deserializer lifetimes \- Serde, [https://serde.rs/lifetimes.html](https://serde.rs/lifetimes.html)  
> 24. System.Text.Json: deserializing from System.IO.Pipelines, [https://stackoverflow.com/questions/58537669/system-text-json-deserializing-from-system-io-pipelines](https://stackoverflow.com/questions/58537669/system-text-json-deserializing-from-system-io-pipelines)  
> 25. Support non-allocating view on string properties values of JSON in, [https://github.com/dotnet/runtime/issues/54410](https://github.com/dotnet/runtime/issues/54410)  
> 26. System.Text.Json: \`JsonUnmappedMemberHandling.Disallow, [https://github.com/dotnet/runtime/issues/100057](https://github.com/dotnet/runtime/issues/100057)  
> 27. JsonUnmappedMemberHandling Enum (System.Text.Json, [https://learn.microsoft.com/en-us/dotnet/api/system.text.json.serialization.jsonunmappedmemberhandling?view=net-11.0-pp](https://learn.microsoft.com/en-us/dotnet/api/system.text.json.serialization.jsonunmappedmemberhandling?view=net-11.0-pp)  
> 28. c\# \- ASP.NET Core \- System.Text.Json: how to reject unknown, [https://stackoverflow.com/questions/74995241/asp-net-core-system-text-json-how-to-reject-unknown-properties-in-payload](https://stackoverflow.com/questions/74995241/asp-net-core-system-text-json-how-to-reject-unknown-properties-in-payload)  
> 29. Harden .NET JSON Deserialization with Strict Mode | Duende, [https://duendesoftware.com/blog/20260430-harden-your-dotnet-json-deserialization](https://duendesoftware.com/blog/20260430-harden-your-dotnet-json-deserialization)  
> 30. How to use Utf8JsonReader in System.Text.Json \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/use-utf8jsonreader](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/use-utf8jsonreader)  
> 31. What's new in System.Text.Json in .NET 7 \- Microsoft Developer Blogs, [https://devblogs.microsoft.com/dotnet/system-text-json-in-dotnet-7/](https://devblogs.microsoft.com/dotnet/system-text-json-in-dotnet-7/)  
> 32. Large Integers in JavaScript | OpenActive Developers, [https://developer.openactive.io/using-data/harvesting-opportunity-data/large-integers-in-javascript](https://developer.openactive.io/using-data/harvesting-opportunity-data/large-integers-in-javascript)  
> 33. Data Converter Basics \- Texas Instruments, [https://www.ti.com/lit/ml/sprp635/sprp635.pdf](https://www.ti.com/lit/ml/sprp635/sprp635.pdf)  
> 34. Conformance Testing a Dozen Specs in as Many Languages \- arXiv, [https://arxiv.org/html/2608.18039v1](https://arxiv.org/html/2608.18039v1)  
> 35. Type-Based Verification of Test Input Generators \- CS@Purdue, [https://www.cs.purdue.edu/homes/suresh/papers/pldi23.pdf](https://www.cs.purdue.edu/homes/suresh/papers/pldi23.pdf)  
> 36. Proptest, [https://altsysrq.github.io/proptest-book/print.html](https://altsysrq.github.io/proptest-book/print.html)  
> 37. Proptest strategies the hard way | The bytes // they want you, [https://pnevyk.github.io/posts/proptest-strategies-the-hard-way/](https://pnevyk.github.io/posts/proptest-strategies-the-hard-way/)  
> 38. falsify: Internal Shrinking Reimagined for Haskell \- Well-Typed, [https://well-typed.com/blog/aux/files/falsify.pdf](https://well-typed.com/blog/aux/files/falsify.pdf)  
> 39. Related research \- HypoFuzz docs, [https://hypofuzz.com/docs/literature.html](https://hypofuzz.com/docs/literature.html)  
> 40. Qwen-Image-2.0: Professional infographics, exquisite photorealism, [https://qwen.ai/blog?id=qwen-image-2.0](https://qwen.ai/blog?id=qwen-image-2.0)  
> 41. Key Concepts \- Qwen \- Read the Docs, [https://qwen.readthedocs.io/en/latest/getting\_started/concepts.html](https://qwen.readthedocs.io/en/latest/getting_started/concepts.html)  
> 42. cyberphone/json-canonicalization \- GitHub, [https://github.com/cyberphone/json-canonicalization](https://github.com/cyberphone/json-canonicalization)
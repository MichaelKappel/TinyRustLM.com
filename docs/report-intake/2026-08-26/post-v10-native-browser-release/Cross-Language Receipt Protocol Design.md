# **Formal Cross-Language Receipt Semantics After A Preserved Contract-Drift Failure**

## **1\. Executive Recommendation and Explicit Assumptions**

The absolute enforcement of cross-language contract boundaries requires a zero-tolerance approach to historical contract drift. The terminal failure of attempt /10—precipitated by a divergence between the Rust producer’s emission of an operation ID without a suffix paired with the status performed, and the .NET managed verifier’s expectation of the parent operation ID paired with the status flushed—represents an immutable historical artifact. The recommended architectural path is the immediate formalization of a fail-closed, single-semantics receipt protocol. The corrected implementation must mandate the child operation suffix \-members and the status performed. It must actively and deterministically reject the former shape. Dual semantics, fallback validators, response repair, or runtime translation of historical records compromise the independent verifier’s integrity and introduce unacceptable state-space complexity1.  
The architectural assumptions underpinning this formalization are absolute. TinyRustLM operates as an unversioned prelaunch browser-local product, meaning no legacy interoperability layers, migrations, or accepted code debt are permitted. Technical labels such as SLM2 and Tokenizer2 denote strict format identities rather than evolving product generations. The target composition payload is constrained exclusively to the public candidate Qwen/Qwen3-0.6B, pinned immutably at revision c1899de289a04d12100db370d81485cdf75e47ca2. This composition requires exactly six members: model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2. Furthermore, the closed /10 execution, its bytes, and its evidence are permanently inaccessible for retry, repair, or adoption. The .NET managed inspector must assume an adversarial posture, treating the Rust producer as a fundamentally untrusted entity whose claims must be independently recomputed from raw bytes.

## **2\. Normative Terminology and Formal State Machine**

To prevent the semantic overloading that triggered the /10 execution failure, the protocol must define an unambiguous, non-overlapping vocabulary for the state lifecycle of distributed operations. The overloading of status fields to imply operating-system durability without explicit proof is a well-documented source of data loss, synchronization failure, and cross-language parser discrepancies3.  
The normative state vocabulary distinguishes explicitly between memory states, system calls, and physical hardware guarantees. The state created denotes that an entity or operation has been instantiated in volatile application memory but has not yet been processed or dispatched to the operating system. The state performed indicates that the algorithmic or computational mutation associated with an operation is complete in user-space memory; critically, this status makes no claims regarding durability, verification, or operating system dispatch, making it the strictly required and exclusively valid status for the \-members child receipt. The state written signifies that the payload has been dispatched via system calls to the operating system’s page cache, such as through standard buffered I/O, though the physical hardware state remains unproven and volatile5. The state closed means the operating system file descriptor or handle has been explicitly released, severing the process's active lock but guaranteeing nothing about disk commit. The state flushed implies a synchronization command, such as fsync on Linux or FlushFileBuffers on Windows, has been successfully executed, forcing the operating system to transfer modified pages to the storage controller6. The state durable represents a holistic synchronization barrier that has successfully completed across all required members and their parent directory container, accounting for metadata journaling. The state verified is achieved only when the independent .NET inspector has successfully parsed the receipt, recomputed canonical hashes from disk, validated schemas, and matched the output against the producer's claims. The state accepted is the terminal state of a fully verified and integrated composition. The state terminal serves as a meta-state or leaf node in the state graph from which no further transitions are geometrically or chronologically permitted.  
The state machine for the composition transaction is modeled as a deterministic finite automaton with strict transition guards. Let ![][image1] be the finite set of states, ![][image2] be the set of valid transitions, and ![][image3] be the transition function. The set of states encompasses registration, conversion, materialization, durability, inspection, acceptance, and rejection. Transition guards mandate that no state can bypass the durability barrier before inspection. The critical guard transitioning from durability to inspection mathematically requires that the receipt identifier equals the parent identifier concatenated with \-members and that the status equals performed. Any deviation immediately forces a transition to terminal rejection.

## **3\. Operation Graph and Identifier Derivation**

The distributed transaction is structured as a strictly ordered, parent-child operation graph. The graph initiates with registration, which acts as the parent operation asserting the intent to compose the model. This is followed by the attempt operation, a child of registration that signals the commencement of execution. Conversion operates as a child of the attempt, tracking the translation of the Qwen3-0.6B weights into the target formats. Member materialization encompasses the serialized generation of the six member files to the local file system.  
The durability barrier must be implemented as a single child operation, rather than a set of per-member operations. Emitting six individual durability receipts unnecessarily inflates the attack surface, multiplies file I/O overhead, and introduces complex partial-failure states. For instance, if four members flush successfully, two remain pending, and a process crash occurs, the recovery logic must handle fragmented transaction boundaries. A single, holistic barrier implies a pseudo-atomic commit of the directory state, aligning with the POSIX concept of parent-directory synchronization8. Following the durability barrier, the graph proceeds to independent inspection, executed by the .NET verifier in an isolated context, culminating in a terminal owner decision.  
Deterministic identifier derivation provides cryptographic domain separation, parent-identity binding, and collision resistance. Identifiers must be human-readable for operational tracing but hash-derived for uniqueness and security. The derivation algorithm utilizes the JSON Canonicalization Scheme and the BLAKE3 cryptographic hash function, bounded to lowercase hexadecimal output10. The parent identity binding is achieved by incorporating the canonicalized registration payload into the parent identifier.  
The parent operation identifier is derived by concatenating a static URN namespace prefix with the BLAKE3 hash of the canonicalized registration payload, resulting in a 128-character maximum string. The child operation identifiers are strictly bound to the parent via string concatenation, utilizing the hyphen as a safe, URL-compatible delimiter. The durability child operation suffix must be exactly \-members. The collision domain is bounded to the specific model revision and execution attempt, preventing cross-pollination of receipts between disparate executions. Character sets are strictly limited to lowercase alphanumeric ASCII to eliminate Unicode normalization vulnerabilities and case-sensitivity ambiguities.

### **Identity Test Vectors**

| Scenario | Input Parent ID | Expected Child ID | Required Verdict |
| :---- | :---- | :---- | :---- |
| Valid Canonical | urn:tiny\_rust\_lm:op:abc123def456 | urn:tiny\_rust\_lm:op:abc123def456-members | Accept |
| Missing Suffix | urn:tiny\_rust\_lm:op:abc123def456 | urn:tiny\_rust\_lm:op:abc123def456 | Reject |
| Wrong Delimiter | urn:tiny\_rust\_lm:op:abc123def456 | urn:tiny\_rust\_lm:op:abc123def456\_members | Reject |
| Legacy Shape | urn:tiny\_rust\_lm:attempt:10 | urn:tiny\_rust\_lm:attempt:10 | Reject |
| Double Suffix | urn:tiny\_rust\_lm:op:abc123def456 | urn:tiny\_rust\_lm:op:abc123def456-members-members | Reject |
| Case Variation | urn:tiny\_rust\_lm:op:abc123def456 | urn:tiny\_rust\_lm:op:abc123def456-MEMBERS | Reject |

## **4\. Versioned Schema Family with Field Tables**

Every schema within the versioned family must enforce rigid constraints to prevent parser exploitation and semantic drift. The unknown-field policy across all schemas is strictly fail-closed; the presence of any unmapped property must trigger immediate rejection. The null policy prohibits explicit null values; if a field is optional, the key must be entirely omitted from the JSON structure. Integers must be strictly constrained to the IEEE 754 double-precision safe integer limit, defined as the range between ![][image4] and ![][image5], to guarantee cross-language interoperability without precision loss or arbitrary precision coercion10. Timestamps must be 64-bit JSON integers representing milliseconds since the Unix epoch. The use of RFC 3339 string representations for timestamps is explicitly prohibited to ensure byte-deterministic canonicalization11. Digest encodings must exclusively use lowercase hexadecimal representations of BLAKE3 hashes. The canonical ordering of all JSON properties is governed by the UTF-16 code unit sorting rules defined in RFC 878513.

### **Registration Schema (v1.registration)**

| Field Name | Type | Required | Max Size / Constraints |
| :---- | :---- | :---- | :---- |
| schema\_version | String | Yes | Exact match: "v1.registration" |
| target\_model | String | Yes | Exact match: "Qwen/Qwen3-0.6B" |
| target\_commit | String | Yes | 40 chars; Git SHA-1 |
| timestamp\_ms | Integer | Yes | Epoch milliseconds, safe integer |

### **Composition Attempt Schema (v1.attempt)**

| Field Name | Type | Required | Max Size / Constraints |
| :---- | :---- | :---- | :---- |
| schema\_version | String | Yes | Exact match: "v1.attempt" |
| operation\_id | String | Yes | Hash-derived from registration |
| timestamp\_ms | Integer | Yes | Epoch milliseconds, safe integer |

### **Conversion Receipt Schema (v1.conversion)**

| Field Name | Type | Required | Max Size / Constraints |
| :---- | :---- | :---- | :---- |
| schema\_version | String | Yes | Exact match: "v1.conversion" |
| operation\_id | String | Yes | Parent ID \+ "-conversion" |
| status | String | Yes | Exact match: "performed" |
| timestamp\_ms | Integer | Yes | Epoch milliseconds, safe integer |

### **Member Receipt Schema (v1.member)**

| Field Name | Type | Required | Max Size / Constraints |
| :---- | :---- | :---- | :---- |
| schema\_version | String | Yes | Exact match: "v1.member" |
| filename | String | Yes | Must match predefined member list |
| digest | String | Yes | 64 chars; BLAKE3 lowercase hex |
| bytes | Integer | Yes | File size in bytes, safe integer |

### **Durability Receipt Schema (v1.durability)**

| Field Name | Type | Required | Max Size / Constraints |
| :---- | :---- | :---- | :---- |
| schema\_version | String | Yes | Exact match: "v1.durability" |
| operation\_id | String | Yes | Parent ID \+ "-members" |
| parent\_id | String | Yes | Exact match to attempt ID |
| status | String | Yes | Exact match: "performed" |
| timestamp\_ms | Integer | Yes | Epoch milliseconds, safe integer |
| member\_digests | Object | Yes | Exactly 6 string:string pairs |

### **Independent Inspection Schema (v1.inspection)**

| Field Name | Type | Required | Max Size / Constraints |
| :---- | :---- | :---- | :---- |
| schema\_version | String | Yes | Exact match: "v1.inspection" |
| operation\_id | String | Yes | Parent ID \+ "-inspection" |
| verdict | String | Yes | Enum: "accepted", "rejected" |
| timestamp\_ms | Integer | Yes | Epoch milliseconds, safe integer |

### **Final Verification Schema (v1.verification)**

| Field Name | Type | Required | Max Size / Constraints |
| :---- | :---- | :---- | :---- |
| schema\_version | String | Yes | Exact match: "v1.verification" |
| operation\_id | String | Yes | Hash of all prior receipts |
| is\_terminal | Boolean | Yes | Must be true |

## **5\. Canonical Serialization and Content Identity**

The requirement for a .NET verifier to independently compute content identities that exactly match those emitted by a Rust producer demands a mathematically rigid serialization standard. The JSON Canonicalization Scheme (JCS), as defined in RFC 8785, is the mandatory standard for all serialization10. When compared to deterministic CBOR or a purpose-built binary encoding, JCS offers superior cross-language transparency and debugging capabilities without sacrificing cryptographic determinism. Deterministic CBOR profiles often fracture across implementations regarding the sorting of map keys and the encoding of variable-length integers, while purpose-built binary encodings lack robust standard libraries in both Rust and .NET. JCS eliminates these discrepancies through strict, universally defined rules.  
The canonicalization process enforces UTF-16 code unit sorting for all object property names, contrasting sharply with UTF-8 byte sorting10. All insignificant whitespace, including spaces, tabs, carriage returns, and line feeds, is completely eliminated14. String escaping is minimized; only the backslash, double quote, and C0 control characters (U+0000 to U+001F) are escaped, while the surrogate range is strictly forbidden14. Number formatting adheres strictly to ECMAScript Number.toString() serialization rules, which mandates the shortest possible representation, forbids the \+ prefix, and rejects leading or trailing zeros13. Furthermore, byte-order marks are forbidden, and numbers outside the interoperable IEEE 754 double-precision range are silently rejected or rounded by compliant parsers, necessitating the strict integer boundaries defined in the schema10.  
A critical interoperability vulnerability occurs when parsers employ a "last-value-wins" strategy for duplicate JSON keys. An attacker or a malfunctioning producer could emit a payload containing {"status":"performed", "status":"flushed"}. A validator evaluating the raw string might authorize the first key, while the underlying object deserializer consumes the last, leading to a catastrophic authorization bypass1. To mitigate this, the Rust producer must utilize strict parsing pathways, such as those in boundary-compiler or serde\_jcs, that yield explicit errors upon encountering duplicate keys13. Concurrently, the .NET verifier must be configured using .NET 10 System.Text.Json features, explicitly setting JsonSerializerOptions.AllowDuplicateProperties \= false to enforce strict duplicate-key rejection16. The JsonSerializerOptions.Strict preset effectively bundles these protections, ensuring that any payload containing duplicate keys, unmapped properties, or mismatched casing throws a JsonException before evaluation17.

## **6\. Producer Claims Versus Independently Recomputed Facts**

The foundational premise of this architecture is that the .NET managed inspector trusts absolutely nothing in the Rust producer's receipt beyond its role as a claim to be verified. The receipt acts as a target hypothesis; the inspector recomputes reality and checks for equivalence. The producer can only claim what it observed during its execution window, which is inherently vulnerable to race conditions, storage hardware deceit, and OS-level cache volatility. The verifier independently proves what it can recompute from the physical state of the storage medium at the time of inspection.  
Fields that represent the declared operation identifiers, the declared status string, and the claimed timestamps of completion are read from the receipt as assertions. However, critical verification fields must never be copied from the producer claims without exhaustive recomputation. The verifier must independently traverse the output directory to enumerate the exact member set, establishing inventory and member-set closure. If the directory contains seven files, but the receipt claims six, the verification must fail. Path containment must be rigidly bounded; symlinks, junction points, and hard links must be actively rejected to prevent path aliasing and directory traversal vulnerabilities.  
The file type, length, and digest must be determined by the verifier opening each file as read-only, reading the raw bytes sequentially into a BLAKE3 hasher, and producing the physical file length and hash13. Under no circumstances should the verifier copy a length or digest value from the Rust receipt to populate its own verification records. It must log the value it physically measured, compare it to the producer's claim, and fail the entire transaction if a single byte diverges.

## **7\. Filesystem and Crash-Durability Model**

Filesystem metadata caching creates a vast synchronization gap between when an application executes a write function and when the bits are physically committed to non-volatile storage. The performed status emitted in the \-members receipt must be backed by true, platform-aware hardware flushes to guarantee crash durability, as failing to do so exposes the system to torn writes and metadata corruption4. The crash model evaluates boundaries before and after each critical I/O operation.  
If a crash occurs before a member file is closed, the OS may orphan the file descriptor, leaving a zero-byte or truncated file on disk. If a crash occurs after the file is closed but before a flush, the data resides in the OS write-back cache; upon reboot, the file may exist in the directory structure but contain entirely null bytes or partial writes5. If a crash occurs after the file is flushed but before the directory is flushed, the file data is durable on the storage medium, but the directory entry linking the filename to the inode may be lost, effectively rendering the file invisible and orphaned7.

### **Crash Boundary Matrix**

| Operation Phase | Volatile State | Durable State | Crash Outcome |
| :---- | :---- | :---- | :---- |
| File Write | Memory Cache | Unwritten | File empty/truncated |
| File Close | OS Page Cache | Unwritten | Data loss, metadata present |
| File Flush | Storage Controller Cache | File Bytes Durable | File durable, dir entry volatile |
| Directory Flush | Synchronized | File \+ Meta Durable | Fully recoverable member |
| Receipt Write | OS Page Cache | Receipt Unwritten | Members durable, receipt lost |
| Receipt Flush | Synchronized | Receipt Durable | Validatable state |
| Inspection | Verifier Memory | Inspection Unwritten | Safe retry of verification |

On Windows systems utilizing NTFS, the WriteFile API transfers data to the system file cache5. To ensure durability, the Rust producer must utilize FlushFileBuffers on the file handle6. However, flushing the files is insufficient if the directory metadata is lost. The protocol requires the producer to open the parent directory container using CreateFile with FILE\_FLAG\_BACKUP\_SEMANTICS and execute FlushFileBuffers on the directory handle to commit the NTFS Master File Table journal entries20.  
On Linux systems utilizing Ext4 or XFS, fsync() flushes the inode and data. However, a newly created file's existence in a directory is not durable until the parent directory is itself synchronized7. The protocol requires the producer to call fsync() on the file descriptor of each member, and subsequently open the parent directory and call fsync() on the directory file descriptor7. What can be proven portably across both OS environments is that the application issued the correct synchronization barriers. What remains platform-specific, and requires local fault injection to verify, is how the underlying storage controller honors these barriers, particularly concerning volatile write-back caches and non-battery-backed raid configurations4.

## **8\. Cross-Language Validation Algorithm and Pseudocode**

The independent verification algorithm is defined as a strict, fail-closed pipeline. It is architected to never accept either of two competing meanings. A corrected clean-slate implementation must actively reject the former parent-ID and flushed shape; it must not accept both shapes, infer intent, attempt to repair the receipt, or translate old records at runtime. The presence of conditional logic that tolerates historical errors introduces catastrophic verification bypasses.  
The algorithm begins with strict JSON parsing, enforcing duplicate key rejection and unknown field rejection. It proceeds to enforce the contract-drift correction by mathematically validating the operation identifier derivation and the status string. Following structural validation, it enforces member-set closure by inspecting the physical directory, explicitly rejecting symlinks. Finally, it computes independent digests and compares them to the producer claims.  
ALGORITHM: Validate\_Composition\_Transaction INPUT: receipt\_path (String), composition\_dir (String), expected\_parent\_id (String) OUTPUT: Record \<Terminal\_Accepted | Terminal\_Rejected\>

> 1. // Phase 1: Strict Parsing and Duplicate Rejection json\_bytes \<- OS\_READ\_FILE(receipt\_path) IF length(json\_bytes) \> MAX\_RECEIPT\_SIZE THEN RETURN Terminal\_Rejected  
>    // Configured with System.Text.Json JsonSerializerOptions.Strict // Throws exception on duplicates, unmapped fields, or invalid types. receipt \<- STRICT\_PARSE\_JCS(json\_bytes) IF PARSE\_ERROR THEN RETURN Terminal\_Rejected  
> 2. // Phase 2: Contract-Drift Correction Enforcement expected\_child\_id \<- CONCATENATE(expected\_parent\_id, "-members")  
>    IF receipt.operation\_id \!= expected\_child\_id THEN // Actively rejects the old parent-only shape from execution /10 RETURN Terminal\_Rejected  
>    IF receipt.status \!= "performed" THEN // Actively rejects the old "flushed" status from execution /10 RETURN Terminal\_Rejected  
> 3. // Phase 3: Directory Member-Set Closure and Alias Rejection physical\_files \<- OS\_LIST\_DIRECTORY(composition\_dir) IF count(physical\_files) \!= 6 THEN RETURN Terminal\_Rejected  
>    expected\_files \<- \["model.slm2", "tokenizer.tokenizer2", "template.template2", "sampling.sampling2", "prompt.prompt2", "composition.acg2"\]  
>    FOR each file IN physical\_files: IF file.name NOT IN expected\_files THEN RETURN Terminal\_Rejected IF OS\_IS\_SYMLINK(file) OR OS\_IS\_JUNCTION(file) THEN RETURN Terminal\_Rejected  
> 4. // Phase 4: Independent Digest Computation FOR each file IN expected\_files: bytes \<- OS\_READ\_FILE\_SEQUENTIAL(file.path) computed\_hash \<- BLAKE3\_HEX(bytes) claimed\_hash \<- receipt.member\_digests\[file.name\]  
>    IF computed\_hash \!= claimed\_hash THEN RETURN Terminal\_Rejected

> 5. // Phase 5: Terminal Acceptance RETURN Terminal\_Accepted

## **9\. Positive, Negative, Mutation, and Fuzz Test Vectors**

A robust protocol is defined not just by its positive conformance, but by its active rejection of hostile, malformed, and obsolete data. The conformance-vector suite must provide exhaustive coverage across all failure domains, proving that the independent verifier cannot be coerced into a false positive.

### **Conformance Vector Suite**

| Vector ID | Category | Input Mutation | Required Output |
| :---- | :---- | :---- | :---- |
| POS-001 | Valid Graph | Exact match to schema, \-members, performed | Accepted |
| NEG-001 | Wrong Parent | Parent ID altered by substituting 1 hex character | Rejected |
| NEG-002 | Wrong Suffix | ID suffix altered to \-member or omitted entirely | Rejected |
| NEG-003 | Wrong Status | Status string is flushed (replicates legacy /10) | Rejected |
| NEG-004 | Missing Child | Durability receipt file absent from directory | Rejected |
| NEG-005 | Duplicate Child | Two durability receipts present (e.g., old and new) | Rejected |
| NEG-006 | Unknown Member | Directory contains extra.bin alongside valid 6 | Rejected |
| NEG-007 | Missing Barrier | Missing parent directory sync receipt | Rejected |
| MUT-001 | Digest Swap | model.slm2 bytes modified, hash unchanged in receipt | Rejected |
| MUT-002 | Replayed Data | Receipt from a different target\_commit presented | Rejected |
| MUT-003 | Stale Reg | Registration timestamp older than max TTL | Rejected |
| MUT-004 | Path Alias | model.slm2 is a symlink pointing to /etc/passwd | Rejected |
| MUT-005 | Truncated JSON | Receipt JSON string abruptly ends mid-object | Rejected |
| MUT-006 | Oversized JSON | Receipt padded with 10MB of whitespace | Rejected |
| MUT-007 | Contradictory | Terminal record claims acceptance, digest mismatches | Rejected |

## **10\. Clean-Slate Contract Replacement Strategy**

In a prelaunch phase with no legacy runtime constraints, handling contract drift requires a clean, zero-compromise approach. The /10 execution failed permanently. The schema mutation from requiring flushed to requiring \-members and performed must be treated as a complete contract replacement rather than a backwards-compatible migration.  
Replacing the sole not-yet-released contract entails fundamentally different procedures than maintaining runtime compatibility in a live system. Code deletion is paramount. All .NET parsing paths, conditional logic branches, or fallback handlers that accepted the parent ID as the durability ID, or expected the flushed status, must be entirely excised from the codebase. The system must not include runtime upgraders or translators that convert the old /10 receipt into the new format during the deserialization pipeline.  
Immutable historical evidence, such as the bytes and logs of execution /10, remains interpretable without keeping old executable acceptance paths in the active main branch. Future developers investigating the failure rely on source-control archaeology—checking out the specific Git revision active at the time of /10—rather than burdening the forward-moving production code with legacy parsing logic. To produce release evidence, a wholly new preregistered execution must be initiated, processed through the Rust converter, and verified by the corrected .NET inspector.  
To ensure the integrity of the replacement, property-based and model-based tests for the state machine must be defined. In Rust, this is achieved using the proptest and proptest-state-machine crates, which automate the checking of properties against an abstract reference state machine22. The reference state machine defines valid transition matrices, generating sequences of operations that the system under test must process24. Generators produce random inputs, including unusual Unicode strings and edge-case integers, while shrinking strategies automatically reduce failing inputs to minimal test cases25. Mutation operators inject hardware faults, simulating process death between file writes.  
In the .NET ecosystem, the FsCheck framework provides analogous capabilities, utilizing the Machine abstraction to explore states and verify that actions conform to the model27. Oracles are established to verify properties such as idempotence, commutativity, and invariants26. Crucially, an automated test harness must assert that the Rust implementation, the .NET implementation, and any theoretical JavaScript implementations return the identical, typed verdict for all generated payloads without sharing a single line of implementation code, thereby proving true cross-language contract equivalence.

## **11\. Objective Acceptance Gate and Residual Risks**

Release authorization for the corrected contract is strictly gated behind objective cryptographic and systemic proofs. The acceptance gate requires a 100% pass rate across the generated test vectors and the negative corpus, confirming that all hostile shapes are rejected. Independent implementations in Rust and .NET must demonstrate byte-for-byte agreement on the JCS canonicalization of 100,000 fuzzed objects. Crash tests must prove that simulated power failures at any point in the matrix do not result in a false-positive verification. Schema identity must be proven through AST introspection tooling, asserting that the Rust producer structures map 1:1 with the .NET record types. Finally, public bounded evidence requires a successful, cleanly registered end-to-end execution utilizing the new contract on the target hardware.  
However, state exactly what remains unproven after this gate. A structural or receipt pass proves no numerical inference correctness. It confirms that the Qwen3-0.6B weights were moved and verified byte-for-byte, but provides zero evidence regarding tokenizer accuracy, inference latency, browser execution stability, or overall behavioral quality. P2P availability and campaign progress are similarly unaddressed. Furthermore, hardware lies remain a residual risk. Storage controllers with volatile write-back caches or non-battery-backed RAID cards may acknowledge FlushFileBuffers or fsync before physical media commitment. A hard power loss immediately following the emission of the performed receipt could still result in partial data loss despite perfect protocol adherence4. Finally, the vulnerability to external mutation by a hostile process with elevated OS privileges operating in the millisecond window between the .NET inspector's read phase and terminal acceptance remains a theoretical, though out-of-scope, threat.

## **12\. Prioritized Implementation Sequence**

The remediation and implementation must proceed in a strictly prioritized sequence to guarantee dependency integrity and prevent regression.

> 1. **Phase 1: Canonical Boundary Hardening.** Implement RFC 8785 JCS serialization in the Rust producer and configure .NET 10 JsonSerializerOptions.Strict in the verifier. Generate the shared conformance corpus to validate byte-exact agreement.  
> 2. **Phase 2: Verifier Fail-Closed Logic.** Update the .NET inspector to enforce the \-members operation ID suffix and the performed status. Delete all legacy /10 parsing pathways and fallback logic.  
> 3. **Phase 3: OS Synchronization Primitives.** Implement the recursive directory and file fsync and FlushFileBuffers logic in the Rust producer to ensure hardware durability prior to receipt generation.  
> 4. **Phase 4: State Machine Test Harness.** Build the proptest and FsCheck suites to simulate fault injection, validate state transitions, and enforce cross-language parity.  
> 5. **Phase 5: Clean Execution.** Trigger a wholly new, monitored execution attempt to produce the immutable release evidence required by the objective acceptance gate.

## **13\. Unknowns Requiring Local Inspection or Execution**

Because this architectural report is generated based on public standards without access to the private TinyRustLM repository, workstations, or execution hardware, several parameters remain unverified and must be resolved by local inspection by the engineering team.  
The exact file system permissiveness of the target deployment environments is unknown. The mount options of Linux hardware, such as ext4 configured with data=writeback versus data=ordered, fundamentally alter how fsync responds and whether metadata corruption is possible28. The presence of hardware acceleration, such as AVX-512 or SIMD instructions, on the target verification hardware must be inspected, as this dictates whether BLAKE3 hashing operates within acceptable latency bounds for the large model files. The memory management strategy of the Rust producer—specifically whether it utilizes memory-mapped files (mmap) or standard buffered I/O—must be verified, as this drastically alters the system calls required to safely flush pages to disk before receipt emission29. Finally, the specific cryptographic hashes of the .NET 10 and Rust compiler toolchains used in the build pipeline must be documented for full supply-chain attestation of the verification logic.

## **14\. Annotated Primary-Source Bibliography**

* 10  
  Arcanesys. (n.d.). *jcs-canonicalize: RFC 8785 JSON Canonicalization Scheme (JCS) for Rust*. GitHub Repository. Details the implementation of RFC 8785 in Rust, enforcing UTF-16 key sorting and duplicate key rejection.  
* 13  
  vr-jcs. (n.d.). *RFC 8785 JSON Canonicalization Scheme (JCS) for Rust*. Rust Documentation. Specifies strict parsing admission checks and deterministic digest computation.  
* 11  
  Hopley, D. (n.d.). *The Canonicalisation Discipline: RFC 8785 JSON Canonicalisation Scheme*. IETF Draft. Formalizes the necessity of schema-normalisation requirements applied before canonicalization, including timestamp integer rules.  
* 14  
  ATL Core. (n.d.). *Module jcs: RFC 8785 JSON Canonicalization Scheme*. Rust Documentation. Outlines the requirement for minimal string escaping and non-ASCII Unicode characters output as UTF-8.  
* 15  
  Boundary-Compiler. (n.d.). *boundary-compiler v0.1.0*. Crates.io. Explains the subtle gotchas of RFC 8785, including number formatting and the mandate that duplicate object keys trigger strict errors.  
* 11  
  Hopley, D. (n.d.). *The Canonicalisation Discipline*. IETF Draft. Provides evidence of cross-implementation reproducibility across multiple languages including Rust and Java.  
* 12  
  Reddit Programming. (n.d.). *Building a strict RFC 8259 JSON parser*. Details the interoperability failures caused by silent parser leniency and duplicate key resolution.  
* 2  
  Insights DB. (n.d.). *Qwen/Qwen3-0.6B*. Model pinning the required immutable revision c1899de289a04d12100db370d81485cdf75e47ca.  
* 17  
  Duende Software. (2026, April 30). *Harden your .NET JSON Deserialization*. Explains the critical security necessity of disallowing duplicate properties using JsonSerializerOptions.Strict.  
* 18  
  Giretti, A. (2026, March 2). *.NET 10 System.Text.Json improvements*. Details the introduction of explicit duplicate property rejection throwing a JsonException.  
* 16  
  DevSkillsUnlock. (n.d.). *System.Text.Json in .NET 10: Security, Performance, and Modern JSON Handling*. Analyzes CVE-class vulnerabilities exploited via duplicate properties and the .NET 10 strict preset.  
* 1  
  Bishop Fox. (n.d.). *JSON Interoperability Vulnerabilities*. Categorizes the security risks of inconsistent duplicate key precedence and key collision through character truncation.  
* 19  
  Russell, J. K. (n.d.). *Benchmarking System.Text.Json vs Newtonsoft.Json in .NET 10*. Compares the strict mode handling of duplicate keys and numbers-as-strings.  
* 30  
  Superuser. (2014, December 23). *What is the whole function and effect of turn off windows write-cache buffer*. Explains NTFS journaling and write order guarantees.  
* 6  
  WinNTFS. (2012, November 29). *Windows Write Caching Part 2: An overview for application developers*. Documents the FlushFileBuffers API for flushing outstanding data and metadata.  
* 29  
  OSR Community. (2015, May 14). *Question on IRP\_MJ\_FLUSH\_BUFFERS behavior*. Analyzes the blocking nature of FlushFileBuffers in NTFS minifilter perspectives.  
* 5  
  Microsoft Learn. (n.d.). *File Caching*. Details Windows system file caching and the mechanism of write-back caches and lazy writing.  
* 3  
  Ayende. (n.d.). *How do they do this*. Discusses the performance costs and durability trade-offs of FlushFileBuffers versus memory-mapped file flushing.  
* 20  
  Google Groups. (2013, March 8). *comp.os.ms-windows.programmer.win32*. Discusses executing FlushFileBuffers on directory containers.  
* 20  
  Google Groups. (2013, March 8). *comp.os.ms-windows.programmer.win32*. Highlights the limitations of OS flushing when hardware controllers lie about physical disk commits.  
* 4  
  Ramoliya, K. (n.d.). *Internals of windows and linux file systems*. Details the sequence of operations in NTFS including MFT journals and FLUSH\_CACHE commands.  
* 21  
  Stack Overflow. (2024, May 2). *Do I have to flush a directory on Windows*. Confirms the necessity of using FILE\_FLAG\_BACKUP\_SEMANTICS to flush parent directory metadata in NTFS.  
* 5  
  Microsoft Learn. (n.d.). *File Caching*. Outlines how caching can be turned off via FILE\_FLAG\_NO\_BUFFERING and FILE\_FLAG\_WRITE\_THROUGH.  
* 8  
  Wikipedia. (n.d.). *Ext4*. Explains the risk of using fsync() frequently in Ext4 and the concept of parent directory project IDs.  
* 7  
  Kernel Internals. (n.d.). *fsync / fdatasync*. Specifies that fsync flushes data but the directory entry remains in the parent directory's dirty state, requiring a separate flush.  
* 28  
  LWN.net. (n.d.). *LSFMM Summit 2019*. Discusses delayed allocation in XFS and Ext4 and the necessity of fsync calls for data safety.  
* 9  
  Stack Exchange. (n.d.). *Which filesystems require fsync for crash safety*. Highlights the necessity of waiting for the whole log tree to be written for parent directory durability.  
* 31  
  Stack Overflow. (n.d.). *What do fsync do when open with O\_DIRECT in ext4*. Explains that fsync requests data in the disk's volatile cache to be written back.  
* 28  
  LWN.net. (n.d.). *LSFMM Summit*. Re-emphasizes the Ext4 implementation details making fsync mandatory for durability.  
* 22  
  Proptest-rs. (n.d.). *State machine testing*. Explains the automation of checking properties against abstract reference state machines.  
* 25  
  Proptest-rs. (n.d.). *Proptest Book: Introduction*. Details property testing frameworks, shrinking inputs to minimal test cases, and filtering.  
* 23  
  Docs.rs. (2026, July 4). *proptest\_state\_machine*. Documents the strategies and test runners for abstract state machine testing in Rust.  
* 24  
  Docs.rs. (n.d.). *proptest\_state\_machine::strategy*. Outlines the ReferenceStateMachine trait used to model systems under test.  
* 26  
  Developers Voice. (n.d.). *C\# Property-Based Testing with FsCheck and xUnit*. Explains modeling invariants, idempotence, commutativity, and round-tripping using FsCheck in .NET.  
* 27  
  Citi, G. (2021, August 19). *Model-based testing made simplistic*. Details the initialization of systems under test using FsCheck state machines.  
* 27  
  Citi, G. (2021, August 19). *Model-based testing made simplistic*. Provides code examples for utilizing the Machine abstraction in FsCheck.

#### **Works cited**

> 1. An Exploration of JSON Interoperability Vulnerabilities \- Bishop Fox, [https://bishopfox.com/blog/json-interoperability-vulnerabilities](https://bishopfox.com/blog/json-interoperability-vulnerabilities)  
> 2. Insights DB \- Palo Alto Networks, [https://insights-db.paloaltonetworks.com/models/Qwen/Qwen3-0.6B/c1899de289a04d12100db370d81485cdf75e47ca/overview](https://insights-db.paloaltonetworks.com/models/Qwen/Qwen3-0.6B/c1899de289a04d12100db370d81485cdf75e47ca/overview)  
> 3. How do they DO this? \- Ayende @ Rahien, [https://ayende.com/blog/164481/how-do-they-do-this](https://ayende.com/blog/164481/how-do-they-do-this)  
> 4. Internals of Windows and Linux File Systems | Keyur Ramoliya, [https://keyurramoliya.com/posts/Internals-of-windows-and-linux-file-systems/](https://keyurramoliya.com/posts/Internals-of-windows-and-linux-file-systems/)  
> 5. File Caching \- Win32 apps \- Microsoft Learn, [https://learn.microsoft.com/en-us/windows/win32/fileio/file-caching](https://learn.microsoft.com/en-us/windows/win32/fileio/file-caching)  
> 6. Windows Write Caching – Part 2 An overview for Application, [https://winntfs.com/2012/11/29/windows-write-caching-part-2-an-overview-for-application-developers/](https://winntfs.com/2012/11/29/windows-write-caching-part-2-an-overview-for-application-developers/)  
> 7. fsync, fdatasync, and O\_SYNC \- Linux Kernel Internals, [https://kernel-internals.org/io/fsync-fdatasync/](https://kernel-internals.org/io/fsync-fdatasync/)  
> 8. ext4 \- Wikipedia, [https://en.wikipedia.org/wiki/Ext4](https://en.wikipedia.org/wiki/Ext4)  
> 9. Which filesystems require fsync() for crash-safety when replacing an, [https://unix.stackexchange.com/questions/464382/which-filesystems-require-fsync-for-crash-safety-when-replacing-an-existing-fi](https://unix.stackexchange.com/questions/464382/which-filesystems-require-fsync-for-crash-safety-when-replacing-an-existing-fi)  
> 10. GitHub \- arcanesys/jcs-canonicalize: RFC 8785 JSON canonicalizer, [https://github.com/arcanesys/jcs-canonicalize](https://github.com/arcanesys/jcs-canonicalize)  
> 11. JCS Canonicalisation Discipline for Agentic-Payment Receipts \- IETF, [https://www.ietf.org/archive/id/draft-hopley-x402-canonicalisation-jcs-v1-02.html](https://www.ietf.org/archive/id/draft-hopley-x402-canonicalisation-jcs-v1-02.html)  
> 12. r/programming on Reddit: Building a strict RFC 8259 JSON parser, [https://www.reddit.com/r/programming/comments/1rp0zl4/building\_a\_strict\_rfc\_8259\_json\_parser\_what\_most/](https://www.reddit.com/r/programming/comments/1rp0zl4/building_a_strict_rfc_8259_json_parser_what_most/)  
> 13. vr\_jcs \- Rust \- Docs.rs, [https://docs.rs/vr-jcs](https://docs.rs/vr-jcs)  
> 14. atl\_core::core::jcs \- Rust \- Docs.rs, [https://docs.rs/atl-core/latest/atl\_core/core/jcs/index.html](https://docs.rs/atl-core/latest/atl_core/core/jcs/index.html)  
> 15. boundary-compiler \- crates.io: Rust Package Registry, [https://crates.io/crates/boundary-compiler/0.1.0](https://crates.io/crates/boundary-compiler/0.1.0)  
> 16. System.Text.Json in .NET 10: Security, Performance, and Modern, [https://www.devskillsunlock.com/blog/system-text-json-net10-improvements](https://www.devskillsunlock.com/blog/system-text-json-net10-improvements)  
> 17. Harden .NET JSON Deserialization with Strict Mode | Duende, [https://duendesoftware.com/blog/20260430-harden-your-dotnet-json-deserialization](https://duendesoftware.com/blog/20260430-harden-your-dotnet-json-deserialization)  
> 18. NET 10: System.Text.Json Improvements \- Anthony Giretti's .NET blog, [https://anthonygiretti.com/2026/03/02/net-10-system-text-json-improvements/](https://anthonygiretti.com/2026/03/02/net-10-system-text-json-improvements/)  
> 19. Benchmarking System.Text.Json vs Newtonsoft.Json in .NET 10, [https://jkrussell.dev/blog/system-text-json-vs-newtonsoft-json-benchmark/](https://jkrussell.dev/blog/system-text-json-vs-newtonsoft-json-benchmark/)  
> 20. FlushFileBuffers to commit file creation and/or move ? \- Google Groups, [https://groups.google.com/g/comp.os.ms-windows.programmer.win32/c/LAzEI84s5ww](https://groups.google.com/g/comp.os.ms-windows.programmer.win32/c/LAzEI84s5ww)  
> 21. Do I have to flush a directory on Windows? \- Stack Overflow, [https://stackoverflow.com/questions/78040177/do-i-have-to-flush-a-directory-on-windows](https://stackoverflow.com/questions/78040177/do-i-have-to-flush-a-directory-on-windows)  
> 22. State Machine testing \- Proptest, [https://proptest-rs.github.io/proptest/proptest/state-machine.html](https://proptest-rs.github.io/proptest/proptest/state-machine.html)  
> 23. proptest\_state\_machine \- Rust \- Docs.rs, [https://docs.rs/proptest-state-machine](https://docs.rs/proptest-state-machine)  
> 24. proptest\_state\_machine::strategy \- Rust \- Docs.rs, [https://docs.rs/proptest-state-machine/latest/proptest\_state\_machine/strategy/index.html](https://docs.rs/proptest-state-machine/latest/proptest_state_machine/strategy/index.html)  
> 25. Proptest, [https://altsysrq.github.io/proptest-book/print.html](https://altsysrq.github.io/proptest-book/print.html)  
> 26. Property-Based Testing in C\#: FsCheck \+ xUnit for Robust, Law, [https://developersvoice.com/blog/csharp/csharp-property-based-testing-fscheck-xunit/](https://developersvoice.com/blog/csharp/csharp-property-based-testing-fscheck-xunit/)  
> 27. Model based testing made simplistic \- Giacomo Citi, [https://giacomociti.github.io/2021/08/19/Model-based-testing-made-simplistic.html](https://giacomociti.github.io/2021/08/19/Model-based-testing-made-simplistic.html)  
> 28. Asynchronous fsync() \- LWN.net, [https://lwn.net/Articles/789024/](https://lwn.net/Articles/789024/)  
> 29. Question on IRP\_MJ\_FLUSH\_BUFFERS behavior \- NTFSD, [https://community.osr.com/t/question-on-irp-mj-flush-buffers-behavior/51239](https://community.osr.com/t/question-on-irp-mj-flush-buffers-behavior/51239)  
> 30. What is the whole function and effect of "Turn off Windows write, [https://superuser.com/questions/390540/what-is-the-whole-function-and-effect-of-turn-off-windows-write-cache-buffer-fl](https://superuser.com/questions/390540/what-is-the-whole-function-and-effect-of-turn-off-windows-write-cache-buffer-fl)  
> 31. What do fsync() do when open() with O\_DIRECT in ext4, [https://stackoverflow.com/questions/66002976/what-do-fsync-do-when-open-with-o-direct-in-ext4](https://stackoverflow.com/questions/66002976/what-do-fsync-do-when-open-with-o-direct-in-ext4)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAaCAYAAACHD21cAAABG0lEQVR4Xu3TIUtDURjG8XeooEwUNmxahmVgUxDbkiytKDjQZhAMpo2hWEUEw5jBbLOY7DKMWzJYBEHBL7BgnPP/eO5113f3Ewwf+MF433POPfecO7OxyCxK2MR8VMtjIR7gM4VTvOIIh+jiEo8oDocOM4lr3CKbqOtJHbQt7GQkG3jHim+QE7R8Mc4ZPrDoG6SOii/GucEAx5hwvWXkXO03VQsTpY8H7GMuOSgtOtFzC5PiBeTJ0rc/Em1Tx36BnoXJB39GRNFAvUPGN0gZX2j4hlLAlYV79FnFJ3Z9Q9Ex32PaN8geXrDkG4ruT6uuu7q2r4PZcvWf6BO6Qw3P0W9dQRNv2LH0d7cZCysruo41bFv4Z6Rt/T9jlG+J/Ct4t2V5pAAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAZCAYAAADuWXTMAAAA5ElEQVR4Xu2SPQ5BURCFR6EQhUKCjkapkrABCo2CRrANErENlSVoFCIiUaosQSm2oCF+zjHvRt7kIlp8ydfMeXfm3rwR+U1ScAuv8Ah3gXt4DurOAyzqsQdd0ZBNsiYjcTiAJ1gzmUThWLTBDMbC8Z0IHMGODQgnuuv3RT+2cCpv4KUq+k6+rWwykoNtW3RwGqdy+gYmw/F7EnAl2uDpFV/RgkvRRh9RgVOYsQEowKEtOkpwLf5/TeqwZ4uEB3iQDXxwFyawYQO+bQ6bps4DaZgXXaKLmA3j6i0kvMPP9O72n+/mBsCiMazwKLp4AAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAH8AAAAaCAYAAACehIP6AAAEjklEQVR4Xu2ZWahVVRjH/1JCYRQNmE14bSCyEqVBhJ4iG6AimohKECrsQUQfNGx4ip4b7SGCKIhoIqJ5oC4RpBVRUCRBZNEASQRBDxaV36/vrO7e393Hvda555bk+sEf7tlrn7PXXt+41pUqlUqlso+z2HSfaZPpbNMB7eGxsp/pBNNlplMGn+eYThz8XelnrulU+RpOyNePa6xrESebHpQb/XnTX6ZbWneMD4z9qekx03Wmh0yTpvtN90zdNmvMN30hf8ffTN8M9K3pj8H1pF9NZ/jX9irONX0lD1bW8GnTs6YnTWsa92Vxiemuwd9EHk5w8NTw2Fhm+tJ0frh+velP06Xh+mzB8zAuTrAwjME802bT76aLwth/DWvEvIn6BFF/p0Z0VqLxI3nanS32Nz1hekA+2SbHmj6Uz+PfgPRIxsEBXjAd2B7+G+bIXImsvYVDTFtNa+OAcZbpPdMRcaAPXv5V05vyB8wGx5t+MN0aB4yjTI+aDooDgePkhhsGEXt4vDgEIj6lf/qc6JBA1JMBxsnFptPjxUzOkWejy+OAPOLvVfd79LJKnnpJHzk/QEPYZ6wmTI60xILHDIPzLQnXuiBd0xd0OcAC03PykpXLSnmdZ17LwxhMmK6NF2fIhaYN8WImlGec9S3TYWGMz3Fde+FLj8vT38emXaYVrTumQ3R9YvpZXsdzSCkrNVPfyT0Vp8hxNuA+Uh7NYdMBRjE88HtEPfN5X/lZYyYQMA/Ls1gpi+SNaVrD7fJerdjoQLrFICntXSP/0a7U3IQXeN20U+3Go4+lps/V7qjR+uZNPUQHGNXwCZyScsc8xp3ih8FccXzKVCmUoh/VXj92LWSFbFhEUijGT3Wehusnef3tg11BV/rNgeddZXpbPvnPVNaoJAd4Sp6xRjV8Aqd/TaP1O5Q/gqhUN5rekZ+vjMKRphvk22bW8CUVnM2kBqy5n2dSX6s/8kthbx1rFKRGk2fy7BJIm5QpzgtGdUI4T545yCARGrPb4sXAlfKdQ6kotZRN3n+h+mFH1JUpcAKy6aQKejDSxy55B5nAIb7X+Pfbt6v9nCZkmQ9Mh8aBPcBCsGg0aas1vQfIhYzxroYvPuuwMV4cA2QYjH+B8vodtsm8I/aJYPBJ0zPy+7LA+L+ofSjAy5KC8aY+eIGj1T/51B8QYREaLBqtktPEZPiU6nn+apU7AAbH8MNKBr9FWenaVs0E5kswXBEH9sAx8vLcdQ5Cs7dDhfMkbWJoth5ACuZo9+Z/7hhO6vbJHCvCWCSVl0fUNg49w2bTG8qvtRj+RdOZ4XqpA/A8amQ0AN/F8U+Sp2a2vuM+4TvNtEUFUaqp/T3r1Qw2bMbOgbnmvHcLzogxIql3Ul7fcn6EaH5Zw49Hm5BNONnDMNQmtiY0Ktvkqaqr1g7jDk03fIJFof5eHQcC1M1XNH3H0aWRjkt7uEnlZZXSc7d8vTiJZXe2Tr6enO939QJZEIE0ZNnNQiGLNDU5oootSfM/UfsarEVOgDXhH298h/WakK8f65hTniuVSqVSqVQqlUqlUqn8j9kN3fvWvg1Uci8AAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAZCAYAAAB0FqNRAAACeElEQVR4Xu2YT4hNURzHv0Ip8qfkT438SclCFBbIrBAZ5W8slQXNgsSYGhazUCQLSikpSZJkMQtbKRuyEJGF5E8iKxsWpsT3O79zmnuPN71735054713PvXp9c659717v/ec3znvAYn/li10H+2gm+hO1z6R7qLnaC+d7toTsED+0N/0Lp3n2o/QHjqBHqRP6AzX1/YonNVhIzlDH8JG2A76lS7JHdHCLKMX6DV6gs7Pdw+F1gWblithIyuL3l+hV+mkoC8mi+iBsHEs2EPvw8LYSJ/TQbo7c8xxepJOoX30FIaD20Cf0gd0rmuLyXLaDRvxKh83892jj27yMay4+xCW0i/0LV3g2rKspa/p4qB9K31FFwbtRdB1aJRPDTsKoNA0A9bTz4gQmurUT/oOw6NE4d2GFf5tdBq9RTe7fp3zia6BBaVX367POuzel0HlQDer72oUfcZHRAhNK52m5g3kL1hfrNBU3GfTAdj0FRqVL2BPWCPuumvXCPzu+svSVKHVYhZ9Rr/BFgih4qq6tpc+otthI/IoPU/X0Tv0Ip1sp5Si6UPbDyuo2WIvZsIuTItBFt2o2tXfKOMSmp6uapJOrOcc2E6+Firib2g/GhsxRfDhZ9XUvwdbhMK+okHq2FKhrYKtPkW8DNvPhKi+adtwDCOHWhWtjqfx7zVp4XkPq61h36GhM+tTOrSq+MA0Nf2U7IQ9jBjohqNPzypoGl5CfjMrzsJWxBg0VWgKrJ/+gu29vNokfkC835GjGZqmup8tY4LfkGpPFqpth7YfMagSmvaFesha8f21/6Av6YrMcS1HldDaFoWlPznH8x+SRCKRSCQSI/IXnxt8ZG+4WCEAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD0AAAAZCAYAAACCXybJAAACKklEQVR4Xu2XO0gcURSGj2iCj0ACig8QxBACAUFFUMQYrAQFC62MSUAU1MJGBUXRQiREUggKQrDTELBQsFEQLSTpFNJFQ0gTkdilCGgn+v977mVmVnHH1zgL88PH7t4zszv/nMedFYl0qcpAJygCleANeGhihWAUfACvQIpZT3o1gVPDV/DcrOeCJVAMssEOaDWxpBdNk3gx879BM3gEtsB79wFhVgEYA3NgHDzzhmOG35rXlyDVG46pBPwC5fGBAMXfro9fvEjs0Q1QC0rBqmgZD4jTnzQ7I5rN12AWPDCxTDANfoJ3EnxPV4FB0dbidQ95w+eVAVZAhzjZY29ugyNQYdbc4uDaBdVx6/yuNdELCNI4TTMpjaLXnNA0y/oP+C+aZasR0bvWD9LAR9BlYvYc/lA+aANZJjYPfoAc8zlIMUG+TLNEWZrromaseKItlXSwABpM7AXYE+3hbnFuGLP7RbQ9eE7Q8m36IjGz3IZOQJ1ZqwETotldBr2iJjm9F806e/276J5+H7qRafYIT+Ykt8OK4hBjNfDVLc4C7td54j0+aF3b9GOwCT6L06e3LVYIhyVvoB/8tsq1TDNLn8CU6CS+Kz0Bk6KV5Ac7SxLpyqat4WFxti4OLF8bfUh0JdMsNz6I9Jn3VpzMLa7PYZdv0zTZDo7BAdh38U/0kTNZZE3zGeNS2QcN+w/KzSF46hwaWvWAv+K9dibsm+iuEilSpEiRIkVKEp0B5nBqnEO8Z7oAAAAASUVORK5CYII=>
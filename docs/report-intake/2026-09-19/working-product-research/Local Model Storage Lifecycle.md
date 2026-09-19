# **Architecture and Lifecycle Specification for TinyRustLM Storage and Activation**

## **Recommended Decision and Counter-Argument**

The architecture mandates the implementation of a Verified Streaming Architecture utilizing BLAKE3/Bao cryptographic tree hashing, combined with the Web Locks API for browser-side multi-tab coordination and Windows NTFS POSIX-semantic APIs for companion-side file operations. Under this design, the six-member model composition (model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, composition.acg2) is treated as a single content-addressable Merkle Directed Acyclic Graph (DAG)1. The composition.acg2 file serves as the cryptographically signed root manifest. During installation or update, new data chunks are downloaded, verified on the fly, and staged as temporary files. Upon complete verification, the active composition is atomically superseded using SetFileInformationByHandle with POSIX semantics, immediately condemning the previous payload to deletion upon the closure of its last active handle4. This satisfies the strict requirement to maintain only the current replacement model while preventing mid-inference crashes.

**The strongest reason this recommendation could be wrong:** The reliance on FILE\_RENAME\_FLAG\_POSIX\_SEMANTICS and OPFS readwrite-unsafe locking modes depends heavily on modern operating system features (Windows 10 1607+) and recent browser engine updates (Chromium 121+)4. If the execution environment operates on a legacy build or an older browser environment, the atomic superseding rename will fail with an ERROR\_ACCESS\_DENIED or NoModificationAllowedError9. This failure mode would force a fallback to non-atomic deletion, which inherently risks breaking active inference, stranding temporary files, and violating the zero-overlap requirement during active usage.

## **Categorization of Contextual Claims**

To maintain rigorous architectural boundaries and eliminate ambiguity, the operational facts and assumptions governing this specification are strictly classified into five distinct categories.

**Project-Supplied Facts:**

* The execution environment consists of a prerelease browser-local Rust/WebAssembly assistant with a Windows .NET companion application.  
* The composition strictly requires six specific files: model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2.  
* Canonical source history belongs exclusively in E:\\Source\\Rust\\TinyRustLM.com.  
* Developer model payloads are restricted to D:\\LLMs\\TinyRustLM.  
* The path X:\\LLMS is out of scope and must remain entirely untouched.  
* Forty-four obsolete SLM1 payloads were successfully deleted; legacy support is explicitly discarded.  
* MiniModel.org is authorized to provide live initial model seeds.

**Externally Verified Facts:**

* The Web Locks API (navigator.locks.request) provides robust, zero-permission, cross-tab execution coordination within a browser origin, with automatic lock release upon worker termination or tab closure10.  
* Windows NTFS supports POSIX-style atomic superseding renames and deletions for open file handles via SetFileInformationByHandle using FileRenameInfoEx and FileDispositionInfoEx6.  
* The Origin Private File System (OPFS) createSyncAccessHandle method provides synchronous I/O in dedicated Web Workers. The readwrite-unsafe mode enables concurrent multi-tab read/write operations on modern Chromium browsers7.  
* Browsers impose strict, often opaque, heuristics on navigator.storage.persist() requests; Chrome auto-grants or auto-denies based on engagement metrics without prompting, while Firefox delegates the decision to a user prompt17.  
* BLAKE3 and its Bao outboard tree format permit verifiable streaming, wherein data chunks can be cryptographically validated in 1024-byte or 16-KiB increments before an entire file is downloaded21.

**Hypotheses:**

* Replacing legacy active payloads using NTFS POSIX semantics will completely eliminate the incidence of ERROR\_SHARING\_VIOLATION during companion-initiated background updates, allowing seamless hot-swapping while instances of TinyRustLM are actively inferencing.  
* Utilizing the Web Locks API with the ifAvailable: true flag will effectively elect a single "leader" tab to handle OPFS database migrations and model downloads, preventing redundant network requests and cache corruption13.

**Recommendations:**

* Transition all model distribution to Bao-encoded BLAKE3 outboard trees to enable chunk-level verification during download, eliminating the vulnerability of storing an entire unverified file before validation.  
* Implement a JSON-based ML lineage receipt system to retain hyperparameters, evaluation metrics, and architectural lessons from obsolete experiments without keeping their multi-gigabyte weight files30.

**Locally Unverified Conditions:**

* The exact performance penalty of WebAssembly synchronous OPFS access via JavaScript Promise Integration (JSPI) versus SharedArrayBuffer \+ Atomics on the specific target hardware of the user base7.  
* The exact byte overhead of Master File Table (MFT) slack space on the developer's local D:\\LLMs\\TinyRustLM NTFS formatted volume32.

## **1\. Ownership and Lifecycle Boundaries**

Establishing strict ownership boundaries is paramount to preventing storage sprawl and satisfying the constraint against duplicate checkouts, backups, and abandoned experiments. The architecture differentiates between the immutable canonical source, developer experimental outputs, and the end-user browser state.

| Domain | Path/Location | Owner | Lifecycle Policy | Avoidable Copies (To be Eliminated) |
| :---- | :---- | :---- | :---- | :---- |
| **Canonical Source** | E:\\Source\\Rust\\TinyRustLM.com | Git / Source Control | Immutable historical checkpoints. Preserved indefinitely. | Source snapshots scattered in ZIP files; duplicate checkouts; backup trees. |
| **Developer Payloads** | D:\\LLMs\\TinyRustLM | .NET Companion | Only the single active 6-member composition is retained. | Old SLM1 payloads; overlapping experimental weights; ad-hoc .bak files. |
| **Browser Execution** | OPFS (navigator.storage.getDirectory()) | TinyRustLM WASM | Hot-cache for inference. Evictable by browser pressure. | Copies of the model moved from IndexedDB to OPFS; stale cache entries. |
| **Experiment Receipts** | E:\\Source\\Rust\\TinyRustLM.com\\receipts | Developer | Lightweight JSON containing BLAKE3 roots and metrics. | Retaining physical .slm2 files just to remember hyperparameters and outcomes. |
| **Partial Downloads** | OPFS / D:\\LLMs\\TinyRustLM | Downloader Module | Tracked via Bao bitmap. Resumed or cleaned up on reboot. | Failed downloads left as .part files indefinitely. |

Bytes required for execution include the exact file contents of the six-member composition and the Bao outboard trees used for streaming verification. Avoidable copies include browser caching of the HTTP request, duplicate staging directories, and any historical model weights that have been successfully superseded by a newer verified composition.

Browser caches must be explicitly bypassed during model acquisition by using Cache-Control: no-store headers, ensuring the payload is written directly to OPFS or the companion's NTFS directory via chunked streaming, rather than being duplicated in the browser's hidden HTTP cache34.

## **2\. Atomic Activation of a Six-Member Composition**

The activation of a new composition must be fiercely atomic. The system can never risk a state where a model.slm2 file is paired with an incompatible tokenizer.tokenizer2 or sampling.sampling2. Such mixed states guarantee corrupted inference generation.

### **The Durable Commit Point**

The composition.acg2 file acts as the cryptographic anchor for the entire composition. It operates as the root of a Merkle Directed Acyclic Graph (DAG)1. Activation follows a rigid state machine:

> 1. **Acquisition:** The five member files (model, tokenizer, template, sampling, prompt) are streamed to the disk with a .tmp extension (e.g., model.slm2.tmp).  
> 2. **Verification:** As chunks arrive, they are validated against their BLAKE3/Bao outboard tree. Any failed chunk causes immediate termination of the stream and deletion of the .tmp file21.  
> 3. **Manifest Staging:** A new composition.acg2.tmp is written to disk, containing the verified hashes of the newly downloaded members.  
> 4. **The Commit Point:** An atomic rename operation is executed, superseding the old composition.acg2 with composition.acg2.tmp.  
> 5. **Realization:** The five member files are atomically renamed to remove their .tmp extensions.

Because the WebAssembly module strictly reads composition.acg2 first, it uses the hashes contained within to verify the integrity of the other five files at load time. The composition.acg2 commit point represents the exact moment the application's truth state transitions from the old model to the new model.

### **Integrity Checks and Crash Recovery**

If a power loss or crash occurs between step 4 and step 5, the system enters a fractured state where the manifest expects new files, but the file extensions on disk have not yet been swapped.

Upon the next boot, the engine reads composition.acg2, notes that the required BLAKE3 hashes do not match the old .slm2 files currently active, and immediately executes a crash-recovery routine. It queries the directory for .tmp files. If the .tmp files hash correctly to the manifest's requirements, the system recognizes a severed realization and simply completes the interrupted rename (Step 5).

If the .tmp files are missing or corrupted, the system falls back to fetching the designated default model from MiniModel.org. The rule preventing mixed members is enforced because the WebAssembly runtime refuses to map any file into memory unless its calculated BLAKE3 hash matches the manifest exactly23.

## **3\. Reconciling Zero Overlap with Safe Replacement**

The directive to "keep only the new model" creates a fundamental physical paradox: a system cannot download a candidate model directly over an active model if the active model is currently locked in memory for user inference. To safely replace a model while guaranteeing continuous availability, there is a quantifiable, unavoidable temporary space requirement.

### **The Availability / Risk Tradeoff**

The minimum temporary space required to validate a candidate before retiring the active payload is exactly ![][image1]. Attempting to achieve zero simultaneous overlap would necessitate taking the application offline, deleting the active model entirely, and initiating a download. If the network drops or the candidate fails validation, the user is left with a broken application and no model. This is an unacceptable availability risk.

To achieve the perception and long-term reality of "zero overlap" without sacrificing stability, the architecture utilizes Windows POSIX semantics. This ensures the physical overlap exists *only* for the precise duration of the download and verification, terminating the overlap the exact millisecond the commit point is reached.

### **Terminating the Overlap**

When replacing the active model, the .NET companion writes the new files to disk. Once verified, it issues a SetFileInformationByHandle call using FileRenameInfoEx with the FILE\_RENAME\_FLAG\_POSIX\_SEMANTICS and FILE\_RENAME\_FLAG\_REPLACE\_IF\_EXISTS flags4. This instructs the NTFS kernel driver to atomically supersede the active file, even if the Rust/WASM local assistant is actively reading it.

Simultaneously, FILE\_DISPOSITION\_FLAG\_POSIX\_SEMANTICS is applied to the old file5. The previous active payload is immediately unlinked from the NTFS directory namespace. Its physical bytes remain on the disk platter only as long as the WebAssembly module holds the open file handle. The moment the user closes the tab or the inference generation finishes and the handle drops, the OS reclaims the space automatically6. This strictly honors the demand to keep only the current replacement while achieving safe hot-swapping.

## **4\. Browser Persistence vs. Companion Filesystem Storage**

End-user browser storage operates under a fundamentally different regulatory and lifecycle regime than the developer's D:\\ drive. The architecture must dynamically adapt depending on whether execution is running via the browser's OPFS or the local .NET companion. It is a critical error to assume browser filesystems behave with the durability and locking semantics of NTFS.

### **Browser OPFS Quotas and Eviction**

Browser storage is heavily restricted and subject to silent eviction under disk pressure. Chromium-based browsers generally allocate up to 60% of the total physical disk size to an origin, while Firefox defaults to an aggressive 10% limit20. Furthermore, browsers employ an LRU (Least Recently Used) eviction algorithm that executes without application notification41.

Calling navigator.storage.persist() to protect the OPFS payload from eviction behaves inconsistently across browser engines:

* **Firefox:** Halts execution and displays a strict user prompt requesting permission17.  
* **Chrome / Edge:** Silently applies opaque heuristics (e.g., site engagement scores, bookmark status, push notification permissions) to automatically grant or deny the request without ever prompting the user17.  
* **Safari:** Employs a strict Intelligent Tracking Prevention (ITP) policy that will delete all script-writable storage for an origin after 7 days without user interaction42.

If a persistence request is silently denied, the browser will mercilessly delete the model during a low-disk event. The design must accommodate this by treating the OPFS model as a highly durable cache, inherently reliant on the ability to seamlessly re-seed from MiniModel.org when a NotFoundError is thrown.

### **OPFS File Handles and Multi-Tab Concurrency**

WASM execution requires synchronous file access for optimal execution speeds, utilizing FileSystemSyncAccessHandle. By default, creating this handle takes out an exclusive lock, preventing any other tab from reading the model7. If Tab A holds the model, Tab B will crash with a NoModificationAllowedError9.

To support multiple tabs, the architecture must specify the mode: "readwrite-unsafe" parameter during createSyncAccessHandle7. This newer specification bypasses the exclusive lock, allowing multiple WASM workers in different tabs to map the model into memory simultaneously. Because OPFS lacks robust atomic rename semantics equivalent to NTFS, superseding a model in the browser requires leader-election logic (detailed in Section 7\) to ensure only one tab attempts the write.

### **Companion NTFS Storage semantics**

Conversely, the .NET companion operating on D:\\LLMs\\TinyRustLM relies on the NTFS filesystem. NTFS does not silently evict data based on quotas or lack of engagement. However, it applies strict file locking by default. Standard MoveFileEx and DeleteFile APIs will fail with ERROR\_SHARING\_VIOLATION if the browser, an antivirus engine, or a search indexer has the file locked40. The .NET app must rely on the aforementioned SetFileInformationByHandle with POSIX semantics to circumvent these locks and schedule deletions over open handles6.

## **5\. Exact-Path Containment and Safe Cleanup**

The project history explicitly states that the owner rejected scattered files across drives. This necessitates severe path containment protocols for the developer environment. The target directory is strictly D:\\LLMs\\TinyRustLM. Any operation targeting X:\\LLMS is structurally prohibited.

### **Path Verification and Traversal Prevention**

Before any cleanup or deletion routine is executed, the absolute path must be canonicalized using the Windows API GetFinalPathNameByHandle47. This resolves all ..\\ path traversals, symbolic links, and NTFS reparse points to their canonical volume path.

If the resolved path does not strictly begin with \\\\?\\D:\\LLMs\\TinyRustLM\\, the operation must immediately abort. This containment rule prevents catastrophic systemic failures where an accidental or malicious symlink causes the cleanup routine to traverse upward and delete X:\\LLMS or adjacent source repositories on the E:\\ drive.

### **Ownership Verification Before Cleanup**

The cleanup routine executes as a post-update garbage collection phase. It queries the directory for any file not listed in the newly committed composition.acg2.

To refuse ambiguous deletion without abandoning safe independent work, the algorithm must adhere to strict type matching:

> 1. The cleanup engine isolates files possessing specific extension signatures: .slm2, .tokenizer2, .template2, .sampling2, .prompt2, and .tmp.  
> 2. It hashes the isolated files. If the hash does not match the active composition.acg2 ledger, the file is identified as an orphaned asset and condemned.  
> 3. Unexpected files—such as developer notes (.txt), adjacent repositories, or foreign binaries—are ignored entirely.

If concurrent writers attempt to add files during cleanup, an OS-level named Mutex prevents the .NET garbage collector from deleting a .tmp file that is currently being streamed by an active download thread.

## **6\. Training Checkpoints and Experiment Receipts**

The historical context reveals that forty-four obsolete SLM1 payloads were previously deleted to curtail drive-wide sprawl. However, deleting historical models often destroys highly valuable experimental knowledge, resulting in duplicated research effort.

To preserve this knowledge in a compact, highly durable format, the architecture shifts from storing full historical weights to storing lightweight ML Lineage Receipts in the canonical source directory: E:\\Source\\Rust\\TinyRustLM.com\\receipts31. When an experimental candidate model is retired and its physical D:\\ payload is superseded and deleted, a JSON receipt is generated to document the lifecycle event.

### **The Compact ML Lineage Receipt Schema**

&nbsp;

&nbsp;

&nbsp;

JSON

{  
&nbsp;&nbsp;"experiment\_id": "EXP-2026-09A",  
&nbsp;&nbsp;"blake3\_root": "a1b2c3d4e5f6...",  
&nbsp;&nbsp;"inputs": {  
&nbsp;&nbsp;&nbsp;&nbsp;"hyperparameters": { "lr": 2e-5, "epochs": 3, "batch": 128 },  
&nbsp;&nbsp;&nbsp;&nbsp;"dataset\_hash": "blake3:8f7e6d..."  
&nbsp;&nbsp;},  
&nbsp;&nbsp;"results": {  
&nbsp;&nbsp;&nbsp;&nbsp;"perplexity": 12.4,  
&nbsp;&nbsp;&nbsp;&nbsp;"eval\_loss": 0.85,  
&nbsp;&nbsp;&nbsp;&nbsp;"pass\_rate": 0.92  
&nbsp;&nbsp;},  
&nbsp;&nbsp;"decision": "REJECTED",  
&nbsp;&nbsp;"reusable\_lesson": "Increasing batch size to 128 caused catastrophic forgetting on reasoning benchmarks.",  
&nbsp;&nbsp;"status": "PAYLOAD\_DELETED"  
}

This strategy ensures that the exact provenance and evaluation metrics are preserved permanently in the Git repository. Because these receipts occupy less than 2 KB per experiment, developers can query years of past lessons, performance metrics, and exact hashes without retaining the gigabyte-scale .slm2 weight files30.

For interrupted training runs, only the single most recent resumable state checkpoint is retained. Upon the completion of epoch ![][image2], the checkpoint for epoch ![][image3] is atomically superseded, preventing a trailing tail of checkpoint files from consuming the disk.

## **7\. Multi-Tab Coordination and Edge Case Resilience**

Web applications are highly susceptible to race conditions when users open multiple instances. If Tab A attempts to acquire a new model from MiniModel.org while Tab B is actively reading the current model, uncoordinated storage mechanisms will corrupt the cache and crash the WASM runtime.

### **Web Locks API Leader Election**

All tabs must participate in leader election using the Web Locks API before attempting any modification to the OPFS storage10.

* When an update or initial seed fetch is triggered, the tab attempts to acquire a named lock: navigator.locks.request("tinyrustlm-update", { ifAvailable: true })12.  
* If ifAvailable: true returns null, another tab is already handling the update. The current tab quietly stands down, enters a non-blocking state, and listens on a BroadcastChannel for completion12.  
* The leader tab handles the chunked download and atomic commit to OPFS.  
* Because readwrite-unsafe OPFS handles are in use8, follower tabs continue inferencing from the physical bytes of the old model on disk until their handle is closed. They seamlessly survive the update without experiencing locking errors.

If a leader tab crashes or is closed by the user mid-download, the browser engine guarantees the automatic release of the lock during worker termination11. The next tab in the queue instantly acquires the lock and resumes the download using the BLAKE3/Bao outboard tree to identify the last successfully written chunk25.

### **Edge Case Handlers**

* **Offline Operation & Catalog Withdrawal:** If the system boots offline, it inspects the local OPFS or NTFS root. If composition.acg2 is valid, it initializes locally. If the candidate model fails BLAKE3 validation after download (due to catalog withdrawal mid-flight or network failure), the .tmp files are immediately unlinked. The existing active payload remains untouched and continues functioning.  
* **Low Disk Space:** If OPFS throws a QuotaExceededError during download, the lock is released, the .tmp file is wiped, and the application alerts the user35.

## **8\. Logical Bytes vs. Measured Storage Recovered**

When executing the cleanup design and replacing models, distinguishing between logical bytes removed and actual physical storage recovered is critical for accurate developer telemetry and system resource reporting.

### **NTFS Sparse Files and MFT Slack Space**

NTFS natively supports sparse files. If a model file contains large ranges of zeros, NTFS will not physically allocate those clusters on the disk50. Deleting a 2 GB logical .slm2 file that is 80% sparse will only recover 400 MB of physical space.

Furthermore, the Master File Table (MFT) possesses slack space that accommodates highly compact files. Files smaller than roughly 700 bytes (such as the 512-byte sampling.sampling2 or 1024-byte template.template2) are stored as "resident data" entirely within the 1024-byte MFT record itself32. Therefore, deleting these specific files recovers ![][image4] external clusters.

### **Honest Reporting Mechanics**

Honest reporting prohibits claiming "2 GB of space reclaimed" if the space was never occupied. To enforce this, the .NET companion must call the DeviceIoControl API with FSCTL\_QUERY\_ALLOCATED\_RANGES to interrogate the filesystem for the true physical footprint of the model prior to executing the POSIX deletion50. The console output must specifically report: *"Reclaimed 1.42 GB of physical disk space"* based on the summation of allocated ranges, ensuring the developer receives an mathematically honest measurement of their cleanup efforts.

## **Comparison: Minimum Viable Approach vs. Credible Alternatives**

&nbsp;

| Dimension | Proposed Approach (POSIX \+ WebLocks) | Alternative A (Mutex-Locked IDB Blobs) | Alternative B (Legacy MoveFileEx) |
| :---- | :---- | :---- | :---- |
| **Concurrency Mechanism** | navigator.locks / NTFS POSIX | Application-level boolean flags | Standard Windows file locking |
| **Update during Inference** | **Supported.** Old file unlinked but handle remains valid until inference completes. | **Failed.** IDB write blocks main thread; high latency; out-of-memory errors on large blobs53. | **Failed.** Returns ERROR\_SHARING\_VIOLATION if WASM or Antivirus holds handle40. |
| **Disk Overhead** | **![][image5]** | **![][image6]** (IDB duplication) | ![][image5] |
| **Crash Safety** | Cryptographic DAG commit point guarantees atomicity. | IndexedDB transaction commits are atomic but prone to quota exhaustion35. | Prone to stranded .tmp files on power loss. |

## **Required Decision Artifacts**

### **On-Disk and Browser Metadata Schema**

The composition.acg2 schema remains identical across both OPFS and NTFS, acting as the ultimate source of truth.

&nbsp;

&nbsp;

&nbsp;

JSON

{  
&nbsp;&nbsp;"acg\_version": "2.0",  
&nbsp;&nbsp;"composition\_id": "blake3:7d86f1a9b2...",  
&nbsp;&nbsp;"timestamp": "2026-09-19T09:55:46Z",  
&nbsp;&nbsp;"members": {  
&nbsp;&nbsp;&nbsp;&nbsp;"model.slm2": { "blake3": "b1c2d3...", "size\_bytes": 1420500 },  
&nbsp;&nbsp;&nbsp;&nbsp;"tokenizer.tokenizer2": { "blake3": "e4f5a6...", "size\_bytes": 32000 },  
&nbsp;&nbsp;&nbsp;&nbsp;"template.template2": { "blake3": "c7d8e9...", "size\_bytes": 1024 },  
&nbsp;&nbsp;&nbsp;&nbsp;"sampling.sampling2": { "blake3": "a0b1c2...", "size\_bytes": 512 },  
&nbsp;&nbsp;&nbsp;&nbsp;"prompt.prompt2": { "blake3": "f3e4d5...", "size\_bytes": 2048 }  
&nbsp;&nbsp;},  
&nbsp;&nbsp;"lineage": {  
&nbsp;&nbsp;&nbsp;&nbsp;"parent\_composition": "blake3:1a2b3c4d5e...",  
&nbsp;&nbsp;&nbsp;&nbsp;"source\_seed": "MiniModel.org/v2"  
&nbsp;&nbsp;}  
}

### **Installation/Update/Retirement State Machines**

&nbsp;

| State | Trigger | Next State | Condition / Notes |
| :---- | :---- | :---- | :---- |
| IDLE | Update Request | ACQUIRING\_LOCK | User or background check initiates update. |
| ACQUIRING\_LOCK | ifAvailable: true yields Lock | STREAMING\_DOWNLOAD | Tab becomes Leader. |
| ACQUIRING\_LOCK | ifAvailable: true yields Null | AWAIT\_BROADCAST | Tab becomes Follower; waits for Leader. |
| STREAMING\_DOWNLOAD | Chunk Verification passes | STAGING\_MANIFEST | BAO outboard stream valid25. |
| STAGING\_MANIFEST | POSIX Rename Executed | COMMITTED | The durable commit point. |
| COMMITTED | Handle Count \= 0 | IDLE | OS reclaims condemned file physical space. |

### **Pseudocode for Commit and Safe Cleanup (.NET Companion)**

&nbsp;

&nbsp;

&nbsp;

C\#

// Path verification to prevent directory traversal  
string targetPath \= GetFinalPathNameByHandle(directoryHandle);  
if (\!targetPath.StartsWith(@"\\\\?\\D:\\LLMs\\TinyRustLM\\")) {  
&nbsp;&nbsp;&nbsp;&nbsp;throw new SecurityException("Path containment violation.");  
}

// Step 1: Open handle to active file with DELETE permissions  
IntPtr hFile \= CreateFileW(  
&nbsp;&nbsp;&nbsp;&nbsp;@"\\\\?\\D:\\LLMs\\TinyRustLM\\model.slm2",  
&nbsp;&nbsp;&nbsp;&nbsp;DELETE,  
&nbsp;&nbsp;&nbsp;&nbsp;FILE\_SHARE\_READ | FILE\_SHARE\_WRITE | FILE\_SHARE\_DELETE,  
&nbsp;&nbsp;&nbsp;&nbsp;IntPtr.Zero, OPEN\_EXISTING, FILE\_FLAG\_BACKUP\_SEMANTICS, IntPtr.Zero  
);

// Step 2: Apply POSIX Rename to unbind the active namespace  
FILE\_RENAME\_INFO\_EX renameInfo \= new FILE\_RENAME\_INFO\_EX();  
renameInfo.Flags \= FILE\_RENAME\_FLAG\_POSIX\_SEMANTICS | FILE\_RENAME\_FLAG\_REPLACE\_IF\_EXISTS;  
renameInfo.FileName \= @"\\\\?\\D:\\LLMs\\TinyRustLM\\model.slm2.deleted";  
SetFileInformationByHandle(hFile, FileRenameInfoEx, ref renameInfo, size);

// Step 3: Apply POSIX Deletion. File vanishes the moment the last handle drops.  
FILE\_DISPOSITION\_INFO\_EX dispInfo \= new FILE\_DISPOSITION\_INFO\_EX();  
dispInfo.Flags \= FILE\_DISPOSITION\_FLAG\_DELETE | FILE\_DISPOSITION\_FLAG\_POSIX\_SEMANTICS;  
SetFileInformationByHandle(hFile, FileDispositionInfoEx, ref dispInfo, size);

CloseHandle(hFile);

// Step 4: Rename the new verified .tmp file into the active path  
MoveFileEx(@"\\\\?\\D:\\LLMs\\TinyRustLM\\model.slm2.tmp", @"\\\\?\\D:\\LLMs\\TinyRustLM\\model.slm2", MOVEFILE\_REPLACE\_EXISTING);

### **Fault-Injection Matrix**

| Persistent Transition | Simulated Fault | Expected Behavior | Interpretation / Next Action |
| :---- | :---- | :---- | :---- |
| Writing .tmp files | Network disconnect | Download halts. composition.acg2 untouched. | Partial chunks preserved. Leader restarts and resumes via Bao outboard request on reconnect. |
| Writing .acg2.tmp | Process kill (OOM) | .tmp files stranded. Active composition boots normally. | Next boot cleanup routine detects orphaned .tmp files failing manifest checks and deletes them. |
| Atomic POSIX Rename | Power loss mid-rename | Active composition unlinked, new composition unlinked. | Boot failure. System automatically requests initial seed from MiniModel.org due to missing composition.acg2. |
| File Disposition Delete | Active WASM inference | Deletion deferred by OS. Active inference completes normally. | Zero impact. Disk space reclaimed automatically upon WASM termination. |

### **Bounded Retention Policy**

* **Active Models:** Exactly ![][image7] (The latest successfully committed composition).  
* **Previous Models:** ![][image4] (Immediately superseded via POSIX rename).  
* **Training Checkpoints:** Exactly ![][image7] (Resumable state for the current epoch; overwrites previous epoch).  
* **Experiment Receipts:** Unbounded (JSON format; \<2KB each; retained indefinitely in Git).

### **Compact Experiment-Retirement Checklist**

Before deleting a developer payload from D:\\LLMs\\TinyRustLM, tools must automatically verify the following extraction into a JSON receipt:

> 1. \[ \] Exact hyperparameters and architecture flags used for generation.  
> 2. \[ \] BLAKE3 root hash of the evaluated composition.  
> 3. \[ \] Quantitative evaluation metrics (loss, perplexity, generation speed).  
> 4. \[ \] A qualitative reusable lesson input by the developer.  
> 5. \[ \] Commit hash of the source tree (E:\\Source\\Rust\\TinyRustLM.com) used to build the model.

## **Implementation Sequence and Ship Criteria**

**Implementation Sequence:**

> 1. Implement the JSON composition.acg2 parsing and Bao outboard verification in the Rust/WASM core.  
> 2. Implement Web Locks API leader election (navigator.locks.request) in the browser UI.  
> 3. Integrate SetFileInformationByHandle POSIX wrappers in the .NET companion for atomic deletion.  
> 4. Establish the E:\\...\\receipts Git tracking mechanism for JSON experiment logs.  
> 5. Wire the initial seed fallback to MiniModel.org, triggered automatically if composition.acg2 is absent or corrupt.

**Ship Criteria:**

* A new browser tab successfully opens, transparently downloads a seed from MiniModel.org, verifies the BLAKE3 hashes via stream, and executes a local chat generation.  
* The .NET companion can execute a background update, superseding the active model while a generation is actively running in the browser, without causing a crash or ERROR\_SHARING\_VIOLATION.  
* The physical disk space temporarily spikes by exactly ![][image8] the model size during download, and returns to ![][image8] the model size upon closure of the active handle.  
* Attempting to delete an unreferenced developer .txt file in the directory correctly aborts, protecting independent work.

**No-Ship Criteria:**

* OPFS readwrite-unsafe mode throws NoModificationAllowedError on target browser baselines.  
* The system retains historical .slm2 files after a successful update, violating the core directive.  
* The fallback to MiniModel.org requires user intervention or manual IP configuration.

## **Unresolved Local Measurements**

* The exact performance penalty incurred by switching from SharedArrayBuffer memory sharing to JavaScript Promise Integration (JSPI) for synchronous OPFS reads on lower-tier hardware.  
* Latency metrics for resolving GetFinalPathNameByHandle across deeply nested NTFS Reparse Points on user machines.

## **What to Stop Doing**

* **Stop maintaining duplicate source trees.** All development must happen canonically in E:\\Source\\Rust\\TinyRustLM.com.  
* **Stop archiving multi-gigabyte models for "historical reference."** Archive the JSON receipt and the training dataset hashes instead.  
* **Stop using MoveFile and DeleteFile in the .NET companion.** They are not concurrency-safe on Windows without POSIX semantics and will lock up during active inference.  
* **Stop relying on navigator.storage.persist().** The silent heuristics make it unreliable as an absolute guarantee17; the architecture must always gracefully handle cache eviction via the MiniModel.org fallback.

## **Compact Experiment-Lesson Template**

&nbsp;

&nbsp;

&nbsp;

JSON

{  
&nbsp;&nbsp;"question": "Does enabling flash attention reduce memory footprint during 4k context inference?",  
&nbsp;&nbsp;"inputs": {  
&nbsp;&nbsp;&nbsp;&nbsp;"git\_commit": "e8f7d6c",  
&nbsp;&nbsp;&nbsp;&nbsp;"model\_blake3": "b4c5d6e7f8..."  
&nbsp;&nbsp;},  
&nbsp;&nbsp;"method": "Synthetic load test with 4096-token prompts over 100 iterations.",  
&nbsp;&nbsp;"result": {  
&nbsp;&nbsp;&nbsp;&nbsp;"memory\_peak\_mb": 450,  
&nbsp;&nbsp;&nbsp;&nbsp;"latency\_ms": 120  
&nbsp;&nbsp;},  
&nbsp;&nbsp;"uncertainty": "Test run on isolated local machine; OPFS memory constraints may differ.",  
&nbsp;&nbsp;"decision": "SHIP",  
&nbsp;&nbsp;"reusable\_lesson": "Flash attention reduced peak memory by 15% with no measurable degradation in perplexity.",  
&nbsp;&nbsp;"evidence\_identity": "urn:blake3:b4c5d6e7f8..."  
}

## **Smallest Falsifying Experiment**

**Hypothesis:** POSIX semantic file deletion allows seamless model updates without interrupting active WebAssembly inference locks.**Exact Inputs:** An active model.slm2 (1 GB) loaded into WASM memory; a dummy model.slm2.tmp (1 GB) representing an incoming update.**Procedure:**

> 1. Start a continuous inference loop in the browser tab that takes exactly 30 seconds to complete.  
> 2. At second 5, trigger the .NET companion to execute the FILE\_RENAME\_FLAG\_POSIX\_SEMANTICS and FILE\_DISPOSITION\_FLAG\_POSIX\_SEMANTICS routines, swapping the .tmp file into the active path and deleting the old path.**Observable Outputs:** The WASM inference loop must finish its 30-second generation successfully, reading from its open file handle. The physical disk space must reclaim the original 1 GB the exact moment the inference finishes.**Failure Interpretation:** If the inference crashes with an I/O error, or the .NET tool receives ERROR\_ACCESS\_DENIED, the Windows POSIX semantics implementation is flawed or the local OS version lacks support.**Next Action:** The recommendation must be falsified, and the architecture must be downgraded to require a full application restart prompt for all updates.

#### **Works cited**

> 1. Portable Agent Memory: A Protocol for Provenance-Verified ... \- arXiv, [https://arxiv.org/html/2605.11032v1](https://arxiv.org/html/2605.11032v1)  
> 2. Cryptography — list of Rust libraries/crates // Lib.rs, [https://lib.rs/cryptography](https://lib.rs/cryptography)  
> 3. kswg-acdc-specification/spec/spec-body.md at main \- GitHub, [https://github.com/trustoverip/tswg-acdc-specification/blob/main/spec/spec-body.md](https://github.com/trustoverip/tswg-acdc-specification/blob/main/spec/spec-body.md)  
> 4. Is an atomic file rename (with overwrite) possible on Windows?, [https://stackoverflow.com/questions/167414/is-an-atomic-file-rename-with-overwrite-possible-on-windows](https://stackoverflow.com/questions/167414/is-an-atomic-file-rename-with-overwrite-possible-on-windows)  
> 5. windows::Win32::Storage::FileSystem \- Rust, [https://microsoft.github.io/windows-docs-rs/doc/windows/Win32/Storage/FileSystem/index.html](https://microsoft.github.io/windows-docs-rs/doc/windows/Win32/Storage/FileSystem/index.html)  
> 6. Hard links, hard times \- Sebastian Schöner, [https://blog.s-schoener.com/2025-10-07-windows-hard-links/](https://blog.s-schoener.com/2025-10-07-windows-hard-links/)  
> 7. The Current State Of SQLite Persistence On The Web: May 2026, [https://powersync.com/blog/sqlite-persistence-on-the-web](https://powersync.com/blog/sqlite-persistence-on-the-web)  
> 8. The future: JSPI and unsafe access handles · rhashimoto wa-sqlite, [https://github.com/rhashimoto/wa-sqlite/discussions/115](https://github.com/rhashimoto/wa-sqlite/discussions/115)  
> 9. FileSystemFileHandle: createSyncAccessHandle() method \- Web APIs, [https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle)  
> 10. The Web Locks API: One Tab Does the Work, the Rest Wait, [https://dev.to/grimicorn/the-web-locks-api-one-tab-does-the-work-the-rest-wait-12om](https://dev.to/grimicorn/the-web-locks-api-one-tab-does-the-work-the-rest-wait-12om)  
> 11. How can i know if a web worker has closed? \- Stack Overflow, [https://stackoverflow.com/questions/33044817/how-can-i-know-if-a-web-worker-has-closed](https://stackoverflow.com/questions/33044817/how-can-i-know-if-a-web-worker-has-closed)  
> 12. Web Locks API \- W3C, [https://www.w3.org/TR/web-locks/](https://www.w3.org/TR/web-locks/)  
> 13. Web Locks API \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/API/Web\_Locks\_API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)  
> 14. delete-self-poc/main.c at main \- GitHub, [https://github.com/LloydLabs/delete-self-poc/blob/main/main.c](https://github.com/LloydLabs/delete-self-poc/blob/main/main.c)  
> 15. C++17/20 Features and Fixes in Visual Studio 2019 : r/cpp \- Reddit, [https://www.reddit.com/r/cpp/comments/bf3fmk/c1720\_features\_and\_fixes\_in\_visual\_studio\_2019/](https://www.reddit.com/r/cpp/comments/bf3fmk/c1720_features_and_fixes_in_visual_studio_2019/)  
> 16. : rename sometimes deletes the target file. \#5501, [https://github.com/microsoft/STL/issues/5501](https://github.com/microsoft/STL/issues/5501)  
> 17. How to ask for persistent storage permission in Google Chrome, [https://blog.desgrange.net/post/2025/10/06/how-persistent-storage-permission-chrome.html](https://blog.desgrange.net/post/2025/10/06/how-persistent-storage-permission-chrome.html)  
> 18. StorageManager.persist should grant permission, particularly for an, [https://issues.chromium.org/issues/40071277](https://issues.chromium.org/issues/40071277)  
> 19. Persistent storage | Articles \- web.dev, [https://web.dev/articles/persistent-storage](https://web.dev/articles/persistent-storage)  
> 20. The Browser Storage API \+ Cheat Sheet | by Tanvi Dadwal | Medium, [https://medium.com/@tanvidadwal799/the-browser-storage-api-cheat-sheet-be6e4afff0c0](https://medium.com/@tanvidadwal799/the-browser-storage-api-cheat-sheet-be6e4afff0c0)  
> 21. Grant Application: Bao-Verified Streaming for Faster Wallet Recovery, [https://forum.zcashcommunity.com/t/grant-application-bao-verified-streaming-for-faster-wallet-recovery/53966](https://forum.zcashcommunity.com/t/grant-application-bao-verified-streaming-for-faster-wallet-recovery/53966)  
> 22. The new BLAKE3 hazmat API \- Iroh, [https://www.iroh.computer/blog/blake3-hazmat-api](https://www.iroh.computer/blog/blake3-hazmat-api)  
> 23. BLAKE (hash function) \- Wikipedia, [https://en.wikipedia.org/wiki/BLAKE\_(hash\_function)](https://en.wikipedia.org/wiki/BLAKE_\(hash_function\))  
> 24. bitmask-stack/carbonado: An apocalypse-resistant data storage, [https://github.com/bitmask-stack/carbonado](https://github.com/bitmask-stack/carbonado)  
> 25. Blob store design challenges \- Iroh.computer, [https://www.iroh.computer/blog/blob-store-design-challenges](https://www.iroh.computer/blog/blob-store-design-challenges)  
> 26. BLAKE3 \- GitHub, [https://raw.githubusercontent.com/BLAKE3-team/BLAKE3-specs/master/blake3.pdf](https://raw.githubusercontent.com/BLAKE3-team/BLAKE3-specs/master/blake3.pdf)  
> 27. Angular : Cross-Tab Sync with BroadcastChannel API & Web Locks, [https://medium.com/@piyalidas.it/angular-cross-tab-sync-with-broadcastchannel-api-web-locks-api-ac31eff0a947](https://medium.com/@piyalidas.it/angular-cross-tab-sync-with-broadcastchannel-api-web-locks-api-ac31eff0a947)  
> 28. LockManager: request() method \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request)  
> 29. How to avoid multiple API calls in a React Custom Hook, [https://stackoverflow.com/questions/71593360/how-to-avoid-multiple-api-calls-in-a-react-custom-hook](https://stackoverflow.com/questions/71593360/how-to-avoid-multiple-api-calls-in-a-react-custom-hook)  
> 30. What is an ML Experiment Tracking Tool? \- JFrog, [https://jfrog.com/learn/mlops/experiment-tracking-tool/](https://jfrog.com/learn/mlops/experiment-tracking-tool/)  
> 31. LLM Experiment Tracking Best Practices That Actually Scale \- MLflow, [https://mlflow.org/articles/llm-experiment-tracking-best-practices/](https://mlflow.org/articles/llm-experiment-tracking-best-practices/)  
> 32. Analyzing MFT for Deleted File Recovery | Get Claude Skills, [https://www.getclaudeskills.com/skills/analyzing-mft-for-deleted-file-recovery-mukul975](https://www.getclaudeskills.com/skills/analyzing-mft-for-deleted-file-recovery-mukul975)  
> 33. Disk and File System Forensics \- Trackr.Live, [https://www.trackr.live/digital-forensics/disk-and-file-system-forensics/](https://www.trackr.live/digital-forensics/disk-and-file-system-forensics/)  
> 34. storage/browser/quota \- chromium/src \- Git at Google, [https://chromium.googlesource.com/chromium/src/+/refs/heads/main/storage/browser/quota](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/storage/browser/quota)  
> 35. Storage quotas and eviction criteria \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/Storage\_API/Storage\_quotas\_and\_eviction\_criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)  
> 36. draft-ssmith-keri-00 \- IETF Datatracker, [https://datatracker.ietf.org/doc/html/draft-ssmith-keri-00](https://datatracker.ietf.org/doc/html/draft-ssmith-keri-00)  
> 37. What is Hashing? Definition & Explanation of Data Transformation, [https://www.kusari.dev/learning-center/hashing/](https://www.kusari.dev/learning-center/hashing/)  
> 38. Adding atomicwrite in stdlib \- Ideas \- Discussions on Python.org, [https://discuss.python.org/t/adding-atomicwrite-in-stdlib/11899](https://discuss.python.org/t/adding-atomicwrite-in-stdlib/11899)  
> 39. OS： windows系统编程（win32） \- lnlidawei \- 博客园, [https://www.cnblogs.com/lnlidawei/p/15678035.html](https://www.cnblogs.com/lnlidawei/p/15678035.html)  
> 40. C++/Win32: How to wait for a pending delete to complete, [https://stackoverflow.com/questions/3764072/c-win32-how-to-wait-for-a-pending-delete-to-complete](https://stackoverflow.com/questions/3764072/c-win32-how-to-wait-for-a-pending-delete-to-complete)  
> 41. cache \- How does Chrome/Chromium eviction algorithm really work?, [https://superuser.com/questions/1549207/how-does-chrome-chromium-eviction-algorithm-really-work](https://superuser.com/questions/1549207/how-does-chrome-chromium-eviction-algorithm-really-work)  
> 42. \[P2\]\[docs\] Browser storage guidance: quotas, persist(), eviction, and, [https://github.com/libredb/libredb-database/issues/63](https://github.com/libredb/libredb-database/issues/63)  
> 43. FileSystemFileHandle: createWritable() method \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable)  
> 44. fs::remove\_dir\_all rarely succeeds for large directories on windows, [https://github.com/rust-lang/rust/issues/29497?timeline\_page=1](https://github.com/rust-lang/rust/issues/29497?timeline_page=1)  
> 45. \[boost\] boost.log's text\_multifile\_backend is not performant on, [https://groups.google.com/g/boost-developers-archive/c/Ca5RtDBY8y8](https://groups.google.com/g/boost-developers-archive/c/Ca5RtDBY8y8)  
> 46. Windows Kernel Programming 9798379069513 \- DOKUMEN.PUB, [https://dokumen.pub/windows-kernel-programming-9798379069513.html](https://dokumen.pub/windows-kernel-programming-9798379069513.html)  
> 47. How Bun PR \#30412 (claude/phase-a-port) ports Zig to Rust, [https://gist.github.com/michaellady/7d552137fb1e37ab9bf637e450016c25](https://gist.github.com/michaellady/7d552137fb1e37ab9bf637e450016c25)  
> 48. ML Lineage: Trace ML data flow | Snowflake Documentation, [https://docs.snowflake.com/en/developer-guide/snowflake-ml/ml-lineage](https://docs.snowflake.com/en/developer-guide/snowflake-ml/ml-lineage)  
> 49. Using a shared Worker (instead of SharedWorker) \#81 \- GitHub, [https://github.com/rhashimoto/wa-sqlite/discussions/81](https://github.com/rhashimoto/wa-sqlite/discussions/81)  
> 50. File Management Control Codes \- Win32 apps | Microsoft Learn, [https://learn.microsoft.com/en-us/windows/win32/fileio/file-management-control-codes](https://learn.microsoft.com/en-us/windows/win32/fileio/file-management-control-codes)  
> 51. What is the equivalent of \`posix\_fallocate()\` on Windows?, [https://stackoverflow.com/questions/76447042/what-is-the-equivalent-of-posix-fallocate-on-windows](https://stackoverflow.com/questions/76447042/what-is-the-equivalent-of-posix-fallocate-on-windows)  
> 52. The Win32 C file management references, [https://www.installsetupconfig.com/win32programming/windowsfileapis4\_26.html](https://www.installsetupconfig.com/win32programming/windowsfileapis4_26.html)  
> 53. LocalStorage vs. IndexedDB vs. Cookies vs. OPFS vs. WASM-SQLite, [https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABHElEQVR4XmNgGAWUAkcgfg3E/6F4BxBzIsnzAfEuJHkQXgfE3EhqUAAjEM8C4l9A/BOILVGlwSAIiNcwoFqEFQgC8UIgzmeA2DyFAWIBMigC4mg0MaxAH4j7gVgSiK8D8RMgVkSSZwHi2VB1BAHIxnQou4EB4rocuCwDgwgDxOUgHxAEfUBsDGXrAPF7ID4BxPxQMRsgngxl4wWw8ALZDgIgLy0H4n9A7AEVA7mapPBCDnCQISDDQIaCYo+s8IIBkPdA3gR514mByPACuQYUFqboEkAQwwCJiGtA3IkmhxWghxcyEGeAJBOQgUSFF8gLoKzBhS4BBQ1A/BaINdHEUYALEH9hQOQ1UBbyRlEBAaBkAsqrBMNrFIyCIQMA260zNBT6yKgAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAaCAYAAAD8K6+QAAABlElEQVR4Xu2WrUsEQRjGX8Hgx+EXoggWoyAY1CBYFINgECyGMwgGDYIg2K9aNGjSokmDmMVq8S/QLNhELJYT/Hge31mdnaAzB7tjmB/8YJl39u6em3lnVySRSJTJNHyEH8ZL2GrVO+CVVacXsN2aUwb8TSuwyxn/lSZ4CF9hHU7my18swnPJhy6aHrgEj+EzvIcD9oS/6IYncFN0RQ5Ew9pswaozVjQMtgDH4Zk0EGwU7onedAcf4JBVb4ZHZl4s+McHB+NKrJnrmuiqbXxXRXpFP5grG4uGgu3CMXM9Irqfb2CnGZuC++Y6FsHBsv7iqhBuu1P4DufMGFez7P5yCQ6W9Zd9WDAQgzEgT8GQ/uJxzC/3sWLu8SE4mN1fGdyC3IrckjPi318tcFv00eHjqt7mRVAwrhJ7Z8ItgGXRQ+QW7ji1GAQFc/vLpl/06Ge42P1FgoJxm/H1qM0tGGrwCQ474zFgMD5fB92CzSx8kZ93vzqcz81QePTz3dGnv4qgD15L/re+iQZct+YlEolEIpH4r3wCVlxVXVGEC3QAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAAw0lEQVR4Xu3RPwtBURzG8Z9BUUomMwPZlKwmi4EUE96HssriDSibF2EyMCozdovJxmLhezp/Opxu3VV56tPtPue5dzkiv5U0BlhijvLnsU4WG0yRQRUn9PyRyhgH5LxuiDPytlCHarSyhUkdd3RsUcFNwmEND8y+i6ih69t4+YVJMGxJzGFQRPVBEdUXcfULEzuc2ELdxA5rpGxJmniap8sIFxTMe0L0de5FX69LEgts0TWjo+g7D6L+UkIfDdEf/xMvb7M7LHVni9rlAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKMAAAAWCAYAAACsayxGAAABzklEQVR4Xu2ZPyhFURzHf0IRMVj8jWwGExEZLQYlSYrhLVJSymIyyS42SVESKQPJZDIYMZooZbIxSP58f849uffc+969p2z3+6lP773fvb3pU+fec0QIIYQQQgjxpwNOucMU6uAi3IIrsCl6mZDsdMF5eAk/4W70ckna4S2chVVwBN7DvvBNhGRFYxyDg/BJssdYAbfhcfDdsgYvYHVoRogXurw+SvYYO+EzXHbm4/AN9jhzlzZY6Q5D1MAGd0jygW+Mw/BL4jGOwm847cxdZuC6JAfZCE+Ey31u8Y3RRlcsRnfuUgYX4KZEg2SIxDtGjS0puqwxKm6QDJH84hvjkiRH5xOjYoM8gqfCEIn4x1gsumLzUujLzA3ck+RnSJIzfGMcgh8Sj87GqG/VWWgVsxXUDwsSf4YkOSQtxnrYLGZZVVrgA9ywNwTMwRcx+5dp2BDt0qz/XRAGmXtsjPvyF5xF9/v0pOUdDgQzvWcVXosJVdGA9NnvQKIb4UloiGew15kzyByj+4V68qJHgbq8qq/wDnYH99TCczFHfXoEaNEIdX4o5ihwB16JCS0NPcd2Q7RokBNw0r1ASCnKxZy2aDz6qb8JIYQQQggh5F/5AbjfWAhKZMJEAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKMAAAAWCAYAAACsayxGAAACMklEQVR4Xu2ZTYhNYRzGHxlFJhY2PpuSjZUFkRplIWVhI9mwmKZko4SFKAvJVmZsJFmwECnKR8TSQlZma4WUlVlMUZKP5+l/3jvnvPfcc89oduf51a97+5/3vJv73PcTMMYYY4wxpj3r6EV6k16iW6qPG1lFTyHeVR/qy5j/Yid9RffQbfQZ/UvP0iWldnWM0Rl6nC6nB+gHRJ/GLIgV9DGdpEuL2hr6jn6n24taHSP0Fn1YfE9coS8QfRvTGk2pn+gcYlRMXECMjmdKtZzN9Cs9l9UPYXiQxSa6LC+WWIn4Y5iOoDBM0ZeorvUUMIUxD1qZffQP+tscRLx7NKvnHKPXUB/ItfQRPN13Hk25mnp/073VRxVS6AaFMa/naD16kl5HNZAOoumxCzHNandcN2olBo2ebcMo8kA6iKbHavqa3kWs2ZrQerIudAsJo0iBfECfwEE0iJHpBr2KdjvhQaEbVG9Cm5n39A6aR2PTAVIQz2P+iGcr3d9r0c84/YX+0KUwalfdho2IoyAtDybQv4Y0HULTpA64TxffEydQDZSm8PWYb7OBfqTTqUGB3vuGCPMwUhDT1Ky+J+BAdpL04/+gX+jnkrOI0U/ovE83LT/p7qKmdy/Tt4igCgVIa797qB6E16EgPqU7sroD2VHSobem1VwdaOtgW4zS54irvrGiJhRC1e8jrgJv0zeIoA1D99h5EBMK5GF6JH9gTBNaY+q2ReHRZ1pzGmOMMcYYY8yi8Q/w/GRIA+cp7QAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAAVklEQVR4XmNgGJpAAYgj0AVhQBOIs4B4HxD/BeKFqNIIAFIYAMRWQPyEAY9CGJAE4ocMowpxANopXArEjGhyYODCAIk6UDz/h+IvQHwJiHWR1I0CCgEAejIbyUtdBmMAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAZCAYAAAAv3j5gAAAA5UlEQVR4Xu2UMQrCQBBFx8LK0kZBwdbCThSsPYCFiIVFavEK3kHwBAo2NhZaWHkG8QaCR7AV/UMcSCYxzGIshH3wmtmEB7vLEnn+kQYc62FeNOEUnuADruLL+cGhAezBG/0wJFThlbJDdVjUwwglWNZDjSU0gQtKj1XgDnb0gsYSKsAZXFI8Zo4wlhCjY04RxhpiJLaFe3KIMC4hhi/GGa4p/cw+4hKqwSPswoCSZ5aJNSQR2S7exoAcYhLaUPhzGhw5wLaam2J9Cl8Efn6eb+/wAluR75g5JSMCx4ZwpBc8Hs/3vAAbmStTygp+CgAAAABJRU5ErkJggg==>
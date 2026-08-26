# **State Machine and Protocol Architecture for Exactly-Once Local SLM Generation**

## **1\. Executive Interaction-Reliability Recommendation**

The transition from cloud-hosted inference to browser-local execution fundamentally alters the reliability paradigm of large language model interactions. In distributed cloud architectures, asynchronous delivery, silent retries, and eventual consistency are standard mechanisms used to mask network latency and node failure. However, operating a prelaunch, unversioned Small Language Model (SLM2) such as TinyRustLM running a Qwen3-0.6B composition within a localized Web Worker demands deterministic, hardware-bound state management. Relaxed consistency models are unacceptable in this environment. The UI must serve as a strict, immutable reflection of the worker's memory heap, enforcing exactly-once rendering semantics to guarantee that every token emitted by the inference engine is presented without duplication, omission, or unauthorized structural repair.  
The core recommendation of this architecture centers on absolute physical process isolation, synchronized through a rigid topology of cryptographic state machines. The Web Worker acting as the inference engine must retain exclusive custody of the model weights, the byte-level byte-pair encoding (BBPE) tokenizer, and the Key-Value (KV) cache. The main UI thread is explicitly stripped of all inference responsibilities, functioning solely to route typed commands and render incremental sequences. Because localized matrix multiplication fully saturates device CPU/GPU resources, UI-level cancellation cannot simply hide the loading state; it must execute a physical cessation of underlying computational loops via SharedArrayBuffer atomics, falling back to destructive thread termination only when the virtual machine traps1. Furthermore, validation of this architecture requires a departure from standard browser test isolation. Simulating a clean environment via incognito modes or IndexedDB clearance is insufficient. True interaction reliability verification mandates the programmatic creation, utilization, and verifiable physical destruction of a persistent browser profile on the host file system, overcoming OS-level file locks to prove zero residual state.

## **2\. Linked Model, Worker, Conversation, and Turn State Machines**

Systemic stability in browser-local inference requires decoupling the ephemeral nature of the Document Object Model (DOM) from the durable, long-running execution context of the inference worker. This architecture implements a system of separate but cryptographically linked state machines. Every state transition requires strict monotonic sequence number validation, ensuring that late-arriving asynchronous events from a deposed worker cannot corrupt the active operational phase.

### **Installed Composition State Machine**

The composition state machine governs the immutable bytes of the Qwen3-0.6B model residing in local storage. It guarantees the cryptographic integrity of the model—which features a 1024 hidden size, 3072 intermediate size, and 28 transformer layers—before any worker instantiation is permitted3. This state is primarily managed through the Origin Private File System (OPFS) utilizing the Web Locks API to prevent concurrent corruption4.

| State | Legal Transitions | Owner | Ephemeral / Durable | Sequence Requirement | Terminal State |
| :---- | :---- | :---- | :---- | :---- | :---- |
| ABSENT | VERIFYING\_DOWNLOAD | OPFS | Durable | N/A | No |
| VERIFYING\_DOWNLOAD | READY, CORRUPT | OPFS / Web Locks | Ephemeral | Monotonic \+ Hash | No |
| READY | VERIFYING\_DOWNLOAD, EVICTED | OPFS | Durable | Exact Hash Match | No |
| CORRUPT | ABSENT | OPFS | Durable | N/A | No |
| EVICTED | ABSENT | OPFS | Durable | N/A | Yes |

### **Worker Execution State Machine**

The worker state machine tracks the lifecycle of the active JavaScript/WebAssembly thread responsible for memory allocation and the execution of the inference loop.

| State | Legal Transitions | Owner | Ephemeral / Durable | Sequence Requirement | Terminal State |
| :---- | :---- | :---- | :---- | :---- | :---- |
| BOOTING | LOADING\_MODEL, FAULT | Main Thread | Ephemeral | Worker ID \= N | No |
| LOADING\_MODEL | IDLE, FAULT | Web Worker | Ephemeral | Worker ID \= N | No |
| IDLE | COMPUTING, TERMINATING | Web Worker | Ephemeral | Worker ID \= N | No |
| COMPUTING | IDLE, FAULT, TERMINATING | Web Worker | Ephemeral | Worker ID \= N | No |
| FAULT | TERMINATING | Main Thread | Ephemeral | Worker ID \= N | No |
| TERMINATING | DISPOSED | Main Thread | Ephemeral | Worker ID \= N | No |
| DISPOSED | None | Main Thread | Durable | N/A | Yes |

### **Conversation and Turn State Machines**

The conversation state machine establishes the authoritative workspace for the user, while the turn state machine tracks the alternating sequence of user prompts and assistant completions. These machines are durably backed by IndexedDB to survive page unloads.

| State (Conversation) | Legal Transitions | Owner | Ephemeral / Durable | Sequence Requirement | Terminal State |
| :---- | :---- | :---- | :---- | :---- | :---- |
| INIT | ACTIVE | UI Protocol | Durable | Conv ID Hash | No |
| ACTIVE | TRUNCATED, CLOSED | UI Protocol | Durable | Turn Sequence N | No |
| TRUNCATED | ACTIVE, CLOSED | UI Protocol | Durable | Turn Sequence N | No |
| CLOSED | None | UI Protocol | Durable | Turn Sequence N | Yes |

| State (Turn) | Legal Transitions | Owner | Ephemeral / Durable | Sequence Requirement | Terminal State |
| :---- | :---- | :---- | :---- | :---- | :---- |
| AWAITING\_INPUT | PREFILLING | UI Protocol | Durable | Turn Seq \= N | No |
| PREFILLING | DECODING, CANCELLED | Web Worker | Ephemeral | Turn Seq \= N | No |
| DECODING | COMMITTED, CANCELLED | Web Worker | Ephemeral | Turn Seq \= N | No |
| COMMITTED | None | UI Protocol | Durable | Turn Seq \= N | Yes |
| CANCELLED | None | UI Protocol | Durable | Turn Seq \= N | Yes |

### **Generation, Message Rendering, and Cancellation State Machines**

These highly granular state machines enforce strict custody over token delivery. They are designed specifically to mitigate at-least-once delivery hazards inherent in standard MessageChannel IPC and reactive UI framework lifecycles.

| State (Generation) | Legal Transitions | Owner | Ephemeral / Durable | Sequence Requirement | Terminal State |
| :---- | :---- | :---- | :---- | :---- | :---- |
| QUEUED | RUNNING, CANCEL\_REQUESTED | Web Worker | Ephemeral | Gen ID Seq \= N | No |
| RUNNING | COMPLETED, CANCEL\_REQUESTED, HALTED | Web Worker | Ephemeral | Gen ID Seq \= N | No |
| CANCEL\_REQUESTED | HALTED | Main Thread | Ephemeral | Gen ID Seq \= N | No |
| HALTED | None | Web Worker | Ephemeral | Gen ID Seq \= N | Yes |
| COMPLETED | None | Web Worker | Ephemeral | Gen ID Seq \= N | Yes |

| State (Rendering) | Legal Transitions | Owner | Ephemeral / Durable | Sequence Requirement | Terminal State |
| :---- | :---- | :---- | :---- | :---- | :---- |
| MOUNTED | STREAMING | UI Framework | Ephemeral | Token Seq \= 0 | No |
| STREAMING | FINALIZED | UI Framework | Ephemeral | Token Seq \= N+1 | No |
| FINALIZED | None | UI Framework | Durable (DOM) | Token Seq \= Max | Yes |

| State (Cancellation) | Legal Transitions | Owner | Ephemeral / Durable | Sequence Requirement | Terminal State |
| :---- | :---- | :---- | :---- | :---- | :---- |
| NONE | SIGNALED | Main Thread | Ephemeral | N/A | No |
| SIGNALED | TIMEOUT, ACKNOWLEDGED | Main Thread | Ephemeral | Worker ID \= N | No |
| TIMEOUT | HARD\_KILL | Main Thread | Ephemeral | Worker ID \= N | No |
| HARD\_KILL | WORKER\_REPLACED | Main Thread | Ephemeral | Worker ID \= N | No |
| ACKNOWLEDGED | None | Web Worker | Ephemeral | Worker ID \= N | Yes |
| WORKER\_REPLACED | None | Main Thread | Ephemeral | Worker ID \= N+1 | Yes |

### **Browser Profile State Machine**

This final machine operates entirely outside the web application context. Orchestrated by the testing driver, it manages OS-level resources to guarantee absolute environmental isolation during validation.

| State (Profile) | Legal Transitions | Owner | Ephemeral / Durable | Sequence Requirement | Terminal State |
| :---- | :---- | :---- | :---- | :---- | :---- |
| PROVISIONED | MOUNTED | Test Harness | Durable (OS Disk) | Random ID | No |
| MOUNTED | CLOSING | Browser Engine | Durable | Random ID | No |
| CLOSING | ORPHANED, DELETED | Browser Engine | Durable | Random ID | No |
| ORPHANED | DELETED | Test Harness | Durable | OS File Lock Poll | No |
| DELETED | None | Test Harness | Ephemeral | Hash Verify | Yes |

## **3\. Typed UI-Worker Protocol**

Communication across the main UI thread and the dedicated inference Web Worker must adhere to a strictly typed protocol. To maximize performance and bypass expensive serialization overhead, the protocol leverages structured cloning and Transferable Objects for memory handoffs. Every command dispatched to the worker, and every event emitted back to the main thread, must be encapsulated in a strict interface that binds the systemic identity of the current context.  
This identity tuple consists of the protocol\_identity (versioning the interface), composition\_identity (the SHA-256 hash of the Qwen3-0.6B bytes), conversation\_ID (a UUID representing the active workspace), turn\_ID (a monotonic integer tracking the interaction pair), generation\_ID (a UUID for the specific inference request), message\_ID (a sub-identifier for the active stream), sequence\_number (a strict monotonic integer defining the exact order of the payload), and payload\_length (the byte size of the attached data).  
The UI-to-Worker intent is dictated through WorkerCommand types. The LOAD command transfers ownership of an OPFS FileSystemSyncAccessHandle and the expected composition\_identity to the worker6. The worker must independently VERIFY the installed bytes against this hash before responding with a READY event. To initiate inference, the START\_GENERATION command transmits the verified context window. Crucially, real-time cancellation is not brokered through standard command messaging, as the worker's event loop is blocked by synchronous WebAssembly execution. Instead, the UI passes a SharedArrayBuffer during initialization, enabling the CANCEL\_REQUESTED intent to be communicated via atomic memory mutation1. The UNLOAD and SHUTDOWN commands trigger graceful memory deallocation and thread closure.  
Worker-to-UI status updates are dictated through WorkerEvent types. When inference begins, the worker emits a PREFILL\_PROGRESS event, allowing the UI to reflect a truthful computational status without rendering phantom tokens. As generation proceeds, the worker emits TOKEN\_CHUNK events. Each chunk includes a Uint32Array of raw token IDs, reflecting Qwen's byte-level BPE vocabulary which contains 151,643 regular tokens and up to 22 control tokens9. The SEQUENCE\_NUMBER property of the TOKEN\_CHUNK must strictly increment by exactly 1 for every payload. Terminal events resolving a generation include COMPLETION, CANCELLED, or FAULT.

## **4\. Exactly-Once Rendering Algorithm**

Modern reactive UI frameworks, such as React, intrinsically introduce at-least-once delivery hazards. Their asynchronous reconciliation algorithms and strict-mode double-invocations can cause side effects to execute multiple times. When this behavior interfaces with the asynchronous, queue-based nature of Web Worker MessageChannel deliveries, the risk of rendering the same token twice—or skipping a token during rapid state updates—is severe. The architecture dictates a deterministic, exactly-once rendering algorithm based on strict monotonic sequence deduplication executed at the absolute boundary of the UI framework's state tree.  
When a TOKEN\_CHUNK event arrives on the main thread, an interception handler processes it before any UI framework state update is triggered. This handler maintains an ephemeral, non-reactive expected\_sequence\_number cursor mapped strictly to the current generation\_ID. If an incoming event's sequence number is lower than the cursor, the event is identified as a late-arriving duplicate resulting from a race condition or a stale Service Worker, and is silently discarded. If the sequence number is exactly equal to the cursor, the cursor increments, and the payload is appended to an immutable raw\_output\_buffer. This buffer strictly preserves absolute token ID custody as an array of Uint32Array objects. Crucially, idempotency and deduplication rules operate purely on sequence numbers, never on token text; if the model legitimately hallucinates and outputs repeating text (e.g., " the the the"), the algorithm must not discard the repeated tokens.  
The rendered presentation reads exclusively from this immutable raw\_output\_buffer. The UI is explicitly prohibited from implementing auto-repair logic. If the Qwen3-0.6B model outputs a truncated Markdown code block due to context exhaustion or user cancellation, the UI must render the raw, unclosed backtick string. There is no auto-completion of Markdown tags or silent "best-of-N" retry logic to mask model deficiencies. Sanitization boundaries are rigidly enforced just-in-time during the DOM text node creation, ensuring cross-site scripting (XSS) vectors are neutralized without altering the literal truth of the model's textual output. Malformed output, such as invalid UTF-8 byte sequences emitted by the model, must not be repaired into coherent words; instead, a truthful visible error marker (such as the Unicode replacement character) must be displayed, maintaining absolute custody of the raw generation.

## **5\. Multi-Turn, KV, and Context Semantics**

The specific architecture of the Qwen3-0.6B model features a hidden size of 1024, an intermediate size of 3072, 28 hidden layers, 16 attention heads, and 8 key-value heads3. The implementation of Grouped Query Attention (GQA), where multiple query heads share a single KV head, reduces the memory footprint of the KV cache11. However, managing a multi-turn conversation within a browser-local Web Worker still requires absolute discipline over WebAssembly linear memory allocation, particularly when approaching the maximum context window, which can span up to 32,768 tokens12.  
The KV cache is durably bound to the specific worker thread and its associated WebAssembly memory heap. Because raw KV cache tensors are massive and cannot be efficiently serialized and passed back to the main thread via structured cloning, multi-turn interactions rely on continuous context accumulation within the worker. When a turn concludes—either through a COMPLETION or a CANCELLED event—the main thread issues a COMMIT\_TURN command. This finalizes the context window up to that exact token sequence, allowing subsequent prompts to efficiently compute only the delta attention.  
If the conversation length approaches the maximum allocated context boundary, a deterministic context truncation policy is executed. The UI protocol commands a windowed slide, strictly preserving the system prompt and the most recent N turns, explicitly signaling the worker to recalculate the KV cache for the truncated sequence. User input precedence is strictly enforced, but untrusted memory labels are applied; any instruction-tuning control tokens injected by the user (such as unauthorized \<|im\_start|\> sequences) are forcibly neutralized by a UI-side tokenizer proxy before transmission to the worker.  
In the event of an edit/resend action by the user, the KV cache logic requires precise invalidation. The protocol must rewind the KV cache to the state prior to the edited prompt. If the WebAssembly runtime lacks a mechanism to dynamically prune the KV cache, the UI must issue an invalidation command, forcing the worker to re-prefill the entire surviving conversation history. Furthermore, if a worker crash occurs, or if the underlying composition bytes are switched, the entire KV cache is considered instantaneously invalid, requiring a fresh worker initialization and a complete context replay from the durable IndexedDB conversation state.

## **6\. Cancellation and Fresh-Worker Recovery**

To provide a genuine, responsive interaction workspace, a cancellation request must result in the immediate cessation of physical matrix multiplication operations. Superficial UI state changes that merely hide the assistant's output while the CPU continues to burn resources are explicitly forbidden. Standard Web Worker postMessage cancellation is non-cooperative and highly latent; the worker's event loop is blocked by the synchronous execution of the WebAssembly inference loop, rendering standard message parsing impossible until the current token generation completes.  
To achieve sub-millisecond cancellation latency, the architecture leverages SharedArrayBuffer atomics1. During worker initialization, the main thread passes a shared buffer containing a single Int32Array synchronization flag. The inner decoding loop of the WebAssembly binary is instrumented to perform a cooperative Atomics.load() on index 0 of this array before executing the matrix math for the next token. When the user requests cancellation, the main thread executes Atomics.store(sab, 0, 1). Within a single token generation cycle, the worker detects the mutated integer, aborts the generation loop, flushes the final partial token to the main thread, and cleanly transitions to a HALTED state.  
However, driver-level GPU hangs, infinite loops, or WebAssembly memory traps can prevent the worker from polling the atomic flag. Consequently, the cancellation state machine implements a strict temporal bound. After signaling via Atomics, the main thread initiates a 50-millisecond timer. If the worker fails to emit a CANCELLED event within this window, the main thread assumes a catastrophic hang and executes a hard kill via Worker.terminate().  
Executing Worker.terminate() abruptly destroys the thread, bypassing all internal cleanup logic. If the worker was holding an exclusive navigator.locks.request for an OPFS file handle, or actively writing to a FileSystemSyncAccessHandle4, this destructive termination risks leaving the storage layer in a corrupted or deadlocked state. Therefore, the fresh-worker recovery protocol immediately follows a hard termination. The main thread discards the deposed worker reference, explicitly awaits the browser's internal garbage collector to natively release orphaned Web Locks, and then instantiates a completely new worker. This fresh worker must reopen the OPFS handles and re-verify the immutable installed composition bytes before declaring a READY state, guaranteeing that a crashed thread leaves no poisoned state for subsequent generations.

## **7\. Failure Containment and Restart Behavior**

Failure modes in local browser inference are exceptionally diverse, driven by heterogeneous consumer hardware, aggressive OS-level memory management, and asynchronous lifecycle events. The architecture dictates that no failure condition may silently initiate a background retry or start a second, hidden generation. All faults must be deterministically trapped, contained, logged locally, and presented as terminal, truthful UI statuses.  
If a WebAssembly memory allocation failure occurs (e.g., the context window expands beyond the physical RAM constraints of the host device), the worker emits a WORKER\_FAULT event specifying an out-of-memory (OOM) code, immediately followed by the thread gracefully exiting. The UI transitions to the FAULT state and explicitly requires manual user intervention to reload the context; it must not automatically downgrade the model or retry.  
Browser tab backgrounding introduces unique lifecycle hazards. The Page Lifecycle API may trigger visibilitychange or freeze events when the user switches away from the tab14. Modern browsers frequently throttle requestAnimationFrame and suspend timers in background tabs16. The architecture handles this by listening for the freeze event and explicitly pausing non-critical UI DOM updates. However, the SharedArrayBuffer synchronization remains intact. If the inference completes while backgrounded, the terminal events queue in the MessageChannel. Upon the resume event14, the exactly-once rendering algorithm sequentially drains the channel, deduplicating any stalled sequences without attempting to re-trigger the generation.  
In the event of a Service Worker update or a catastrophic browser tab crash, the ephemeral memory—including the KV cache and the worker thread—is instantly destroyed. Upon page reload, the UI retrieves the durable conversation state from IndexedDB. Because the previous generation was interrupted before a COMMITTED state could be achieved, the UI marks the final incomplete assistant message as TRUNCATED\_BY\_CRASH. The user must manually request a resumption. Storage hash drifts, where the OPFS file hash no longer matches the expected Qwen3-0.6B signature due to disk corruption, result in immediate eviction of the model and a hard lock on the conversation workspace until the correct composition is explicitly re-downloaded.

## **8\. Owned Fresh-Profile and Deletion Protocol**

Validating this architecture requires rigorous continuous integration testing using Playwright. A non-negotiable requirement is that each dogfood round utilizes a newly created, physically persistent browser profile. Standard Playwright incognito contexts, or simply invoking localStorage.clear(), completely fail to test the true initialization mechanics of the OPFS, the Service Worker installation, and the IndexedDB schema migrations.  
The testing architecture must utilize browserType.launchPersistentContext(userDataDir)17, pointing to a uniquely generated, temporary directory on the host OS file system. On Linux environments, this directory is cleanly isolated using standard /tmp boundaries and relies on standard POSIX file descriptor behaviors. However, on Windows environments, Playwright exhibits well-documented file lock retention behaviors; underlying Chromium processes, specifically crashpad and GPU helper utilities, routinely maintain locks on the persistent directory (often named mcp-chrome-profile) even after context.close() is successfully awaited19.  
To guarantee absolute proof of process and context closure, the test harness implements a bounded deletion protocol. When the test concludes, Playwright issues browser.close(). The Node.js test harness then executes a polling loop against the OS process tree, verifying that all processes spawned by the Playwright driver have physically exited. Once the process tree is clear, the harness attempts a recursive deletion of the userDataDir utilizing an exponential backoff retry mechanism to defeat transient Windows file locks.  
Symlink and reparse point defenses are strictly enforced during this deletion phase. The cleanup script verifies the target directory's physical path via fs.realpath before execution to prevent malicious test artifacts from redirecting the delete command to critical system directories. Cryptographic proof of deletion is obtained by verifying the absolute absence of the directory path on the disk and asserting that no leaked file handles remain open in the test framework's process monitor, ensuring pristine state for the subsequent validation run.

## **9\. Responsive and Accessible UI Assertions**

The UI architecture serves as a strict, immutable reflection of the underlying state machines. Product expectations demand a stable center conversation workspace that fluidly adapts across desktop, narrow, and mobile viewports. Upon the submission of the first user prompt, the UI must execute a seamless transition: introductory prompt cards must disappear immediately, shifting the viewport to a persistent workspace. The composer input field remains rigidly anchored to the bottom of the viewport; it must not resize erratically, jump, or overlap with the streaming text due to upstream DOM repaints.  
As the Qwen3-0.6B model generates output, the viewport implements a strict scroll-anchoring algorithm. If the user scrolls upward to review previous context while the assistant is actively streaming, the auto-scroll mechanism is instantly disengaged to prevent focus hijacking and user frustration.  
Accessibility is integrated fundamentally at the protocol level. The rendering space utilizes aria-live="polite" regions for the streaming text, ensuring screen readers announce new tokens gracefully at natural pauses without continuously interrupting the user. The UI provides precise keyboard operation, enabling strict tab navigation through Markdown code blocks, raw text elements, and the anchored composer. Screen-reader labels dynamically update to reflect truthful load and generation statuses, mapping perfectly to the PREFILLING, DECODING, and HALTED internal state machine values. Long model names (such as the precise configuration string of the 0.6B composition) and long unbroken textual outputs (e.g., massive Base64 strings) are explicitly constrained using CSS word-break: break-word properties to prevent horizontal overflow on narrow mobile screens.  
Finally, the UI layout must guarantee secret-free screenshots. No tracking parameters, user UUIDs, or environment variables may be rendered invisibly in the DOM or console, allowing users to capture and share visual proof of their local inference sessions safely and privately.

## **10\. Network and Privacy Assertions**

Because the Qwen3-0.6B model operates entirely on local device hardware, the architecture must guarantee zero unauthorized data exfiltration. The testing matrix implements a strict network proof layer using Playwright's interception capabilities. By invoking page.route('\*\*/\*', ...) during the acceptance round20, the test harness inspects every outgoing request, WebSocket connection, Service Worker fetch, beacon payload, and DNS lookup initiated by the browser profile.  
The network assertion permits only explicit static asset retrieval from the designated local or loopback server. Any attempt by the UI framework, integrated third-party libraries, or the worker itself to initiate telemetry, analytics reporting, model uploading, or credential validation against a remote URL is instantly aborted20, and the test run is marked as a catastrophic privacy failure.  
Service Workers are heavily restricted, allowed only to cache static UI assets for offline availability. They are explicitly forbidden from intercepting OPFS file handles or proxying inference requests to remote endpoints. This absolute containment proves mathematically that the model bytes, the KV cache, and the user's private prompts remain strictly confined to the local memory heap and disk storage of the user's isolated profile.

## **11\. Race and Fault-Injection Matrix**

To certify interaction reliability, the implementation requires continuous fault-injection testing against a comprehensive matrix of race conditions.

| Fault Scenario | Trigger Condition | Expected System Behavior | Resulting State Transition |
| :---- | :---- | :---- | :---- |
| **Double Submit** | User spams "Enter" and mouse clicks simultaneously. | UI deduplicates input based on strictly monotonic Turn ID. Only one command is sent to the Worker. | AWAITING\_INPUT \-\> PREFILLING |
| **Cancel During Prefill** | User cancels exactly during the PREFILLING phase. | Worker detects Atomics flag before entering the decoding loop. Generation aborted instantly. | PREFILLING \-\> CANCELLED |
| **Cancel Between Token/Completion** | Cancel requested milliseconds before final token is emitted. | Main thread sequence deduplication intercepts the late completion event and discards it in favor of the cancel. | RUNNING \-\> CANCEL\_REQUESTED \-\> HALTED |
| **Model Switch Mid-Gen** | User attempts to load a new model while current model is generating. | UI strictly blocks the LOAD command while state is RUNNING or PREFILLING. | Rejected by State Machine |
| **Late Old-Worker Event** | A terminated worker manages to push a message into the channel before death. | Main thread checks the worker\_ID and generation\_ID. Mismatch causes silent drop. | Ignored |
| **Storage Lock Deadlock** | Two isolated tabs attempt to load the model via OPFS simultaneously. | Web Locks API grants exclusive access to first tab. Second tab awaits lock or times out gracefully4. | VERIFYING\_DOWNLOAD (Tab 2 blocked) |
| **Browser Crash / OOM** | Linear memory exhaustion triggers hard tab crash. | OS kills process. On restart, UI detects uncommitted turn in IndexedDB, marks as truncated. No auto-retry. | COMMITTED (truncated) |
| **Repeated Identical Tokens** | Model falls into a repetitive hallucination loop (e.g., outputting " the the the"). | UI renders exactly what the model outputs. No regex repair or silent prompt injection to correct it. | STREAMING (Truthful reflection) |
| **Profile Deletion Lock (Windows)** | Playwright attempts to delete userDataDir while crashpad holds lock19. | Node.js harness initiates exponential backoff loop until file lock clears, ensuring 100% deletion proof. | ORPHANED \-\> DELETED |

## **12\. Real-Round Acceptance Evidence and Implementation Sequence**

Passing the validation gate requires a fully automated, verifiable multi-turn execution round that generates a comprehensive cryptographic audit log. The acceptance evidence must execute and prove the following strict sequence:

> 1. **Provisioning:** The Node.js harness creates a random UUID identity and provisions the persistent directory for the browser profile17.  
> 2. **Instantiation:** Playwright mounts the browser, navigating to the loopback URL. Network routing rules are established to block all non-local traffic, asserting absolute privacy20.  
> 3. **Model Loading:** The worker thread initializes, acquiring the OPFS file lock. It verifies the cryptographic hash of the Qwen3-0.6B model (ensuring the presence of the 1024 hidden size and 28 layers)3, and emits the READY state back to the UI.  
> 4. **First Turn:** The harness injects a predetermined prompt. The worker transitions through PREFILLING, then into DECODING. Exact token IDs are streamed. The harness intercepts and counts the exact number of React DOM updates to definitively prove exactly-once rendering semantics.  
> 5. **Second Turn & Cancellation:** A subsequent prompt is injected. Mid-generation, a cancellation is triggered. The harness captures the SharedArrayBuffer memory mutation, measures the sub-millisecond halt latency, and logs the HALTED state.  
> 6. **Fault Recovery:** A simulated WebAssembly trap is injected into the worker. The harness proves that the UI updates truthfully to a FAULT state, calls Worker.terminate(), re-initializes a fresh worker, and re-establishes readiness without memory leaks or orphaned Web Locks.  
> 7. **Process Closure:** Playwright gracefully closes the context.  
> 8. **Deletion Verification:** The harness initiates the bounded directory deletion loop, continuously polling the OS process tree, and eventually proving the absolute physical absence of the persistent profile directory from the disk.

The final verdict is output as a strictly typed JSON report summarizing resource bounds (peak WebAssembly heap size), precise sub-millisecond timing of the cancellation events, the exact list of intercepted and blocked network endpoints, and boolean confirmation of directory deletion.

## **13\. Unknowns Requiring Local Browser Execution**

While the state machines and typed protocols provide a deterministic, mathematically sound framework, several architectural unknowns remain that can only be resolved through active browser execution profiling and empirical measurement:

* **V8 / SpiderMonkey Garbage Collection (GC) Pauses:** The extent to which heavy Uint32Array passing across the MessageChannel triggers main-thread GC pauses must be profiled. If GC pauses exceed 16ms, they will introduce micro-stutters in the React rendering cycle, necessitating optimization of the structured cloning payload.  
* **Background Throttling of Atomics:** The specific behavior of Atomics.notify() and Atomics.wait() when a tab transitions into a deeply frozen state under the Page Lifecycle API is an unknown14. Operating systems may aggressively suspend background threads, making timeout-based cancellation heuristics unpredictable.  
* **OPFS Concurrency and Quota Limits:** The exact behavior of FileSystemSyncAccessHandle under extreme concurrent pressure or when nearing the origin's quota limit remains undocumented in edge cases6. Whether quota exhaustion triggers an immediate synchronous error or a deferred asynchronous fault must be mapped precisely to the WORKER\_FAULT payload.  
* **Windows Subprocess Lifespans:** The precise timing variance of Chromium crashpad and GPU utility process termination on Windows environments dictates the necessary exponential backoff configuration for the fresh-profile deletion protocol19. These timing windows must be established through repeated statistical execution on target hardware.

#### **Works cited**

> 1. Atomics.wait() \- JavaScript \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global\_Objects/Atomics/wait](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait)  
> 2. Atomics.wait, Atomics.notify, Atomics.waitAsync · V8, [https://v8.dev/features/atomics](https://v8.dev/features/atomics)  
> 3. config.json · Qwen/Qwen3-0.6B at main \- Hugging Face, [https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/config.json](https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/config.json)  
> 4. Feature request: Web Locks API · Issue \#15905 · denoland/deno, [https://github.com/denoland/deno/issues/15905](https://github.com/denoland/deno/issues/15905)  
> 5. Worker Architecture \- GenosDB, [https://estebanrfp-gdb.mintlify.app/advanced/worker-architecture](https://estebanrfp-gdb.mintlify.app/advanced/worker-architecture)  
> 6. File System API \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)  
> 7. Intent to Experiment: Origin Private File System extension, [https://groups.google.com/a/chromium.org/g/blink-dev/c/-FVIvFovd3g](https://groups.google.com/a/chromium.org/g/blink-dev/c/-FVIvFovd3g)  
> 8. Atomics.wait prevents postMessage being queued \#21417 \- GitHub, [https://github.com/nodejs/node/issues/21417](https://github.com/nodejs/node/issues/21417)  
> 9. Key Concepts \- Qwen \- Read the Docs, [https://qwen.readthedocs.io/en/stable/getting\_started/concepts.html](https://qwen.readthedocs.io/en/stable/getting_started/concepts.html)  
> 10. Qwen2 Technical Report \- arXiv, [https://arxiv.org/html/2407.10671v1](https://arxiv.org/html/2407.10671v1)  
> 11. Qwen2 \- Hugging Face, [https://huggingface.co/docs/transformers/model\_doc/qwen2](https://huggingface.co/docs/transformers/model_doc/qwen2)  
> 12. Aman's AI Journal • Primers • Qwen 3, [https://aman.ai/primers/ai/qwen3/](https://aman.ai/primers/ai/qwen3/)  
> 13. arXiv:2505.09388v1 \[cs.CL\] 14 May 2025, [https://arxiv.org/pdf/2505.09388](https://arxiv.org/pdf/2505.09388)  
> 14. Understanding JavaScript in the Background － firt.dev, [https://firt.dev/understanding-js-background/](https://firt.dev/understanding-js-background/)  
> 15. Back/Forward Cache: Web Behavior Overview | PDF \- Scribd, [https://www.scribd.com/document/566514449/Back-forward-cache-web-exposed-behaviour](https://www.scribd.com/document/566514449/Back-forward-cache-web-exposed-behaviour)  
> 16. requestAnimationFrame: Browser Support, Use Cases, Issues, [https://www.testmuai.com/learning-hub/requestanimationframe-browser-support/](https://www.testmuai.com/learning-hub/requestanimationframe-browser-support/)  
> 17. BrowserType \- Playwright, [https://playwright.dev/docs/api/class-browsertype](https://playwright.dev/docs/api/class-browsertype)  
> 18. BrowserContext \- Playwright, [https://playwright.dev/docs/api/class-browsercontext](https://playwright.dev/docs/api/class-browsercontext)  
> 19. MCP Server: Browser profile lock issue on Windows using VS Code, [https://github.com/microsoft/playwright-mcp/issues/752](https://github.com/microsoft/playwright-mcp/issues/752)  
> 20. Route | Playwright, [https://playwright.dev/docs/api/class-route](https://playwright.dev/docs/api/class-route)
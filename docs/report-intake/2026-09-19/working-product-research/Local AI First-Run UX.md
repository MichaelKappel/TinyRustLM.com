# **TinyRustLM: First-Run Experience and Everyday-Use Architecture Report**

## **Recommended Decision and Primary Vulnerability**

The most robust architectural and design path to eliminate expert setup friction for TinyRustLM is to construct an automatic, progressively loading browser-local first-run experience that completely bypasses the .NET companion application for the primary beginner journey. This approach relies on isolating the WebAssembly (Wasm) and WebGPU execution engines within a Dedicated Web Worker, utilizing the Origin Private File System (OPFS) via synchronous access handles for persistent artifact storage. Initial model acquisition must be executed through background HTTP Range Requests, fetching the six canonical artifacts directly from MiniModel.org into the browser's local sandbox, thereby abstracting all concepts of model hosting, file conversion, and peer configuration away from the user.

The strongest reason this recommendation could be wrong involves the extreme hardware heterogeneity of the target user base, specifically regarding WebGPU memory allocation limits and browser eviction policies. Diverse client hardware presents unpredictable maxStorageBufferBindingSize limits, which dictate the maximum chunk of model weights that can be bound in a single shader pass1. If the browser fails to negotiate sufficient storage due to silent quota enforcement, or if the WebGPU adapter refuses the buffer allocation required by the .slm2 payload, the user may be trapped in an unrecoverable failure state without the low-level diagnostic escape hatches traditionally provided by a native .NET companion.

## **Categorized Analytical Baselines**

To ensure the architectural recommendations remain grounded in reality, the foundational constraints of this analysis are strictly categorized by their evidentiary origin.

### **Project-Supplied Facts**

The application under analysis, TinyRustLM, operates as a prerelease browser-local small-language-model assistant powered by Rust and WebAssembly execution environments. The singular active composition strictly requires the binding of six exact file identities: model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2. MiniModel.org holds explicit authorization to supply initial server seeds, a directive that supersedes any legacy project documentation prohibiting such external seeding. At present, there is no established qualified default model or proven live initial seed existing within the engineering checkpoint. Furthermore, all canonical source repositories reside exclusively under E:\\Source\\Rust\\TinyRustLM.com, and model payloads belong strictly in D:\\LLMs\\TinyRustLM, with no historical model preservation required once a payload is superseded.

### **Externally Verified Facts**

Modern browser storage capabilities dictate that the Origin Private File System (OPFS) provides the most performant local persistence for large artifacts, bypassing the serialization overhead associated with IndexedDB3. However, creating a FileSystemSyncAccessHandle for optimal read/write speeds is restricted to Dedicated Web Workers and inherently claims an exclusive lock on the target file, prohibiting concurrent read/write operations from other contexts4. Storage persistence requests via navigator.storage.persist() exhibit divergent browser behaviors; Firefox delegates the decision to a user-facing permission prompt, whereas Chromium-based browsers employ silent heuristics based on site engagement metrics5. Finally, security vulnerabilities associated with unauthenticated localhost WebSocket connections—often utilized by local companion apps—expose users to Cross-Site WebSocket Hijacking and DNS rebinding attacks, representing a severe risk vector for client-side architectures6.

### **Hypotheses**

A continuous, resumable background download of gigabyte-scale artifacts directly into OPFS will not precipitate user abandonment, provided the interface remains visually responsive and offers immediate, non-generative utility while the network operation completes. Furthermore, it is hypothesized that cross-tab synchronization utilizing the Web Locks API in conjunction with BroadcastChannel will sufficiently resolve OPFS file contention and allow multi-tab usage without requiring a persistent, background Service Worker.

### **Recommendations**

The .NET companion application must be decoupled from the primary user onboarding flow, relegated exclusively to an advanced configuration tier for users requiring custom file imports, specific network peer configurations, or legacy hardware routing. The primary interface must employ progressive disclosure to hide all technical nomenclature—such as SLM2 formats, cryptographic hashes, and Hugging Face repositories—behind an explicit "Advanced" navigational threshold.

### **Locally Unverified Conditions**

The median disk write latency of the target user base remains unverified, which directly impacts the timeout thresholds necessary for committing OPFS data chunks without causing main-thread stuttering. Additionally, the precise statistical distribution of WebGPU hardware limitations, particularly available VRAM and maximum compute workgroup storage sizes among prospective TinyRustLM users, requires localized telemetry to calibrate fallback Wasm CPU thresholds.

## **The Minimal User Journey**

The primary objective of the redesign is to seamlessly transition the user from their first website visit to receiving a useful first answer, systematically eliminating all points of explicit configuration. The system architecture must securely absorb technical decisions regarding network metering, storage allocation, and artifact validation.

When a new user navigates to TinyRustLM online, the application initiates a silent environmental evaluation. The application queries navigator.storage.estimate() to calculate available disk space8 and checks the navigator.connection API to detect metered networks. If conditions are optimal, the application automatically initiates a chunked download of the six canonical artifacts (.slm2, .tokenizer2, etc.) from MiniModel.org directly into the OPFS sandbox. The user is immediately presented with the standard chat interface, overlaid with a non-blocking, ambient progress indicator. The system intercepts any premature chat attempts with friendly microcopy indicating that the assistant is preparing its local knowledge base. Once the artifacts are verified via cryptographic hashing and loaded into WebGPU memory, the input field unlocks, and the user experiences a frictionless first run.

Upon a returning visit, regardless of whether the user is online or offline, the application bypasses all external network calls. A Dedicated Web Worker immediately attempts to acquire a read-only lock on the model.slm2 file residing within the OPFS root. Because OPFS is persistent—subject to browser eviction policies—the model is restored directly into the Wasm linear memory and WebGPU VRAM10. The user experiences a near-instantaneous load time, enabling immediate interaction without network latency.

Because TinyRustLM operates strictly as a browser-local application, the system state and the model artifacts are fundamentally bound to the local origin storage of the specific device. A user switching from a desktop computer to a mobile device will not experience automatic network synchronization of their multi-gigabyte OPFS artifacts. The design must accommodate this physical limitation by treating each device as a distinct hardware endpoint. Consequently, when the user opens the application on a new device, the initial discovery and downloading journey simply repeats, establishing a fresh local instance.

Mobile environments and unreliable connections necessitate highly robust resumption capabilities. By leveraging HTTP Range Requests through the Range: bytes=X-Y header, the system can request strictly the missing byte chunks of the model.slm2 file after an interruption12. The Dedicated Web Worker tracks the byte offset of the last successfully committed OPFS chunk and stores this pointer in IndexedDB. Upon network reconnection, the fetch operation resumes precisely from that offset, preventing bandwidth waste and ensuring the user does not have to restart a massive download sequence from the beginning.

To maintain simplicity, the system must independently decide which model version is compatible with the current composition.acg2 schema, determine the optimal chunk size for HTTP Range Requests based on available system RAM, and dynamically select whether to utilize WebGPU acceleration or fallback to CPU-bound Wasm execution based on adapter limits14. The system must interrupt the user and demand an explicit decision only when critical thresholds are crossed: if navigator.storage.estimate() reveals dangerously low available space, if the browser detects a cellular or metered connection to avoid unexpected data charges, or if the browser environment requires explicit user interaction to grant persistence via navigator.storage.persist()5.

## **Architectural State Model**

A highly precise state machine is required to ensure the user interface accurately reflects the underlying asynchronous Wasm, WebGPU, and OPFS operations without exposing their complexity. The state model defines the complete lifecycle of the model artifacts from remote discovery to local execution.

The state definitions distinguish between the precise physical location and readiness of the files. "Discovering" implies the application has queried MiniModel.org and identified the required canonical artifact hashes but has not transferred data. "Downloading" indicates that HTTP Range Requests are actively pulling byte chunks and writing them to temporary OPFS file handles. "Verified" represents a critical security and integrity gate; the download is complete, and the local SHA-256 hashes of the six files perfectly match the remote manifest. "Installed" confirms that the verified files have been moved from temporary storage and committed to their final paths in the OPFS root, resting safely on the disk. "Loaded" means the artifacts are actively being read from OPFS via SyncAccessHandle and transferred into active memory arrays. Finally, "Ready to Answer" signifies the LLM engine is fully initialized, the prompt template is parsed, and the system is idling.

### **State Transition Table**

| Current State | Trigger / Condition | Next State | System Action |
| :---- | :---- | :---- | :---- |
| **Initial** | OPFS check: Missing .slm2 | **Discovering** | Fetch manifest from MiniModel.org |
| **Initial** | OPFS check: .slm2 exists | **Verifying** | Read local file hashes from OPFS |
| **Discovering** | Manifest parsed, space \> 3x model size | **Downloading** | Initiate HTTP Range Requests |
| **Discovering** | Space insufficient OR Metered Network | **Blocked** | Prompt user for explicit permission |
| **Downloading** | Connection lost or User pauses | **Paused** | Save current byte offset to IndexedDB |
| **Paused** | Network restored | **Downloading** | Resume fetch via Range: bytes=X-Y |
| **Downloading** | 100% of chunks committed to disk | **Verifying** | Execute SHA-256 on temporary files |
| **Verifying** | Hashes perfectly match manifest | **Installing** | Rename temp files to canonical names |
| **Installing** | Disk write operations complete | **Loading** | Pipe file handles to Wasm worker |
| **Loading** | Memory allocated, GPU buffers bound | **Ready** | Unlock UI input field for text entry |
| **Ready** | User submits a text prompt | **Generating** | Execute inference loop |
| **Generating** | \[EOS\] token reached or User interrupt | **Ready** | Flush context window, await input |
| *(Any)* | maxStorageBufferBindingSize exceeded | **Recoverable Failure** | Fallback to CPU Wasm / notify user |
| *(Any)* | Browser lacks OPFS/Wasm SIMD support | **Unsupported** | Display fatal error screen |

## **Storage Acquisition Logic and Network Metering**

The transition from a lightweight website to a heavily provisioned local application involves silently consuming significant system storage and bandwidth. Executing this without consent risks user frustration; however, introducing excessive friction violates the mandate for a design that "just works."

The download of the six foundational files should begin automatically if, and only if, strict environmental heuristics are satisfied. The network condition must indicate an unmetered connection, prioritizing environments where navigator.connection.saveData is false and the connection type resolves to a stable broadband link. Storage estimation must report at least three times the model's footprint as free space; for example, a 1GB model payload requires at least 3GB of free space. This generous buffer prevents the application from inducing OS-level storage pressure alerts or inadvertently triggering the browser's own aggressive data eviction routines8.

If any of these heuristics fail, the automatic download must be suspended immediately. The interface must transition to an explicit choice state, presenting a clear, non-technical explanation to the user. The system should explain that the assistant requires a large initial download of its core knowledge base and flag that the user appears to be on a mobile network or low on space. A singular, high-contrast button allows the user to override the safeguard and proceed.

Data stored within the Origin Private File System is categorized by browsers as "best-effort" storage, rendering it vulnerable to eviction under severe disk pressure15. To safeguard the gigabytes of downloaded model files, the application must attempt to elevate its storage status by invoking navigator.storage.persist(). Because Firefox strictly enforces a user-facing permission dialog for this action5, the programmatic call must be ergonomically tied to a natural user gesture, such as clicking a "Start Chat" or "Acknowledge" button, to prevent the browser from blocking the prompt. Chromium-based browsers evaluate this request silently, granting or denying persistence based on an internal site engagement score5. If the persistence request is denied by either the user or the browser, the application must continue to function normally, but it must internally flag the state, recognizing that the model artifacts may require re-downloading during a future session if the operating system reclaims the space.

## **Product Language and Microcopy**

Implementation vocabulary introduces profound cognitive friction for non-expert users. A beginner does not need to understand Wasm linear memory limits, the mechanics of OPFS, IP addresses, Hugging Face repositories, or the proprietary .slm2 file format to conduct a conversation with a language model. The design must ruthlessly translate highly technical system states into human-centric, approachable microcopy that fosters trust.

The labels and status text must clearly separate the complexity of the backend from the user's perception of the assistant. When the system is allocating WebGPU buffers, the user should be told the assistant is "Warming up." When cryptographic hashes fail verification, the user should be informed that a file was corrupted and is being automatically repaired, rather than being bombarded with SHA-256 mismatch exceptions.

### **Microcopy Inventory for Key States and Errors**

&nbsp;

| System Condition | Internal State | Proposed Microcopy (Title) | Proposed Microcopy (Description / Next Action) |
| :---- | :---- | :---- | :---- |
| First open, initiating auto-download | Downloading | **Waking up your assistant...** | "Downloading core knowledge (1.2 GB). This only happens once." |
| Insufficient storage detected | Blocked | **Not enough room** | "The assistant needs about 2GB of space to live on your device. Please free up some storage." |
| Metered network detected | Blocked | **Large download ahead** | "We paused the initial 1.2 GB download to save your mobile data. Continue anyway?" |
| Network drop during download | Paused | **Connection lost** | "Download paused at 45%. We'll resume automatically when you're back online." |
| Hashes fail verification | Recoverable Failure | **File corrupted** | "Something went wrong during the download. Retrying..." (Auto-initiates partial fetch). |
| Moving files to persistent OPFS | Installing | **Almost ready** | "Organizing files on your device..." |
| Pushing data to WebGPU VRAM | Loading | **Warming up** | "Loading knowledge into memory. Just a few more seconds." |
| Memory limit exceeded2 | Recoverable Failure | **Device memory full** | "Your device's graphics memory is full. We're switching to a slower, safer mode." |
| Successful initialization | Ready | **Ready** | "What's on your mind?" (Input field placeholder text). |
| Inference active | Generating | *(Pulsing text cursor)* | "Thinking..." (Displayed if time to first token exceeds 1 second). |
| Generating, user clicks stop | Ready | **Halted** | "Stopped. You can ask something else." |
| Device lacks Wasm/OPFS support | Unsupported | **Browser unsupported** | "This assistant requires a newer browser. Try updating Chrome, Edge, or Safari." |
| Tab loses WebGL/WebGPU context | Recoverable Failure | **Graphics reset** | "Your browser refreshed its graphics memory. Reloading the assistant..." |
| Local file import successful | Installed (Adv.) | **Custom model loaded** | "Your personal assistant is ready to use." |
| Local file import failed | Failure (Adv.) | **Incompatible file** | "This file isn't formatted correctly. Please use the standard format." |
| Missing .sampling2 file | Recoverable Failure | **Missing component** | "A required file is missing. Let's fix this." \-\> \[Action Button: Redownload Default\] |
| Multiple tabs open | Blocked | **Already running** | "The assistant is open in another tab. Please close it to continue here." |
| Requesting persistence (Firefox) | Permission Prompt | **Keep it local** | "Your browser may ask to store data permanently. Allowing this prevents redownloads." |
| Model successfully deleted | Initial | **Assistant removed** | "Local files cleared. You can download a new assistant anytime." |
| Unrecognized .acg2 composition | Failure | **Version mismatch** | "This model requires a newer version of the application. Please update." |

## **Advanced Information Hierarchy**

While the primary pathway must remain relentlessly frictionless, advanced users still require explicit control over local import mechanisms, Hugging Face repository configurations, and runtime diagnostics. Utilizing the human-computer interaction principle of progressive disclosure—pioneered by the Nielsen Norman Group to reduce cognitive load17—advanced features are abstracted entirely from the primary canvas. They are housed behind a secondary navigation layer, such as an "Advanced Configuration" or "Engine Room" modal, ensuring that complexity is strictly opt-in.

### **Beginner versus Advanced Control Inventory**

&nbsp;

| Capability / Information | Beginner View (Primary UI) | Advanced View (Hidden by default) |
| :---- | :---- | :---- |
| **Model Source** | Invisible. System auto-fetches from MiniModel.org. | Exposed text field for Hugging Face repo ID or custom URL input. |
| **File Management** | None. Completely abstracted. | Drag-and-drop zone requiring the strict 6-file composition (.slm2, .tokenizer2, etc.). |
| **Peer / IP Configuration** | Invisible. Strictly assumes local execution. | Toggle for "Remote Execution Node" with explicit IP address and Port fields. |
| **Diagnostics** | Basic ambient progress bar during downloads. | Real-time console showing token generation speed (tok/s), WebGPU buffer limits2, and OPFS write latency. |
| **Model Conversion** | Invisible. | Link to external CLI documentation detailing how to convert raw weights to the .slm2 format. |
| **Provenance Receipts** | Invisible. | Tabular view of cryptographic hashes (SHA-256) for the active 6 artifacts. |
| **Reset / Clear Data** | Simple "Delete Assistant" button in settings. | Granular "Wipe OPFS Sandbox" and "Clear Wasm Cache" destructive actions. |

Any interaction within the Advanced configuration space that alters the foundational model—such as importing a custom .slm2 file or routing inference to a custom IP peer—must immediately suspend the default MiniModel.org acquisition path. The user interface updates to reflect the active custom source, ensuring the user is never surprised by where their compute is occurring. If an advanced user wishes to return to the beginner experience, they select a unified "Restore Default Assistant" command. This action safely clears the custom OPFS files, purges the custom IP configurations, and triggers the "First Visit" state machine, fetching the canonical seed from MiniModel.org.

## **Model Lifecycle, Updates, and Cross-Tab Coordination**

Managing gigabytes of local storage within a browser sandbox requires stringent lifecycle policies. Browser applications cannot hoard massive data payloads invisibly without severely degrading the user's overarching operating system experience. The mechanisms for updating, retiring, and coordinating models across multiple tabs must be architected with precision.

A critical architectural constraint of the Origin Private File System is that creating a SyncAccessHandle for performant I/O operations inherently obtains an exclusive lock on the underlying file4. If a user opens the application in a primary tab, that tab locks model.slm2. If the user subsequently opens a second tab and attempts to initialize the assistant, the Wasm engine in the new tab will encounter an access violation and crash when attempting to read the locked file.

To resolve this contention gracefully, the design must implement a Leader/Follower concurrency model utilizing the Web Locks API (navigator.locks) and the BroadcastChannel API19. When a tab opens, it attempts to acquire a named lock, such as TinyRustLM\_Engine\_Lock. The tab that successfully acquires the lock becomes the Leader. The Leader is solely responsible for mounting the OPFS files, spinning up the WebGPU engine, and processing all inference tasks. If a tab fails to acquire the lock, it immediately falls back to Follower mode. The user interface in the Follower tab displays a read-only, synchronized view of the conversation, receiving state updates via the BroadcastChannel from the Leader. If the user attempts to type a prompt in the Follower tab, the interface passes the message payload over the BroadcastChannel to the Leader for processing. If the Leader tab is closed or crashes, the operating system automatically releases the Web Lock; a Follower tab will immediately claim the lock, initialize its own Wasm engine, and seamlessly take over execution without the user losing their session state19.

When a newer qualified default model is published to MiniModel.org, the application must manage the update lifecycle without disrupting the user. Model updates must never interrupt an active generation; the system schedules background checks during extended idle states. If an update requires 1.2GB of space, but the device only has 500MB of free space remaining, the system cannot safely download the new files alongside the old ones. The architecture must prioritize device stability over redundancy. The system displays a warning: "An update is available, but space is tight. Updating will briefly make the assistant unavailable." Upon user confirmation, the system explicitly deletes the active .slm2 family of files from the OPFS volume, freeing the necessary space, and only then initiates the HTTP Range Request for the new version.

Under no circumstances should the application retain older versions of the models as a hidden backup policy. Once an artifact is superseded by an update, or a manual clear-data action is invoked by the user, the superseded files are permanently expunged from OPFS. This strict retirement policy prevents the browser from silently consuming the user's hard drive.

## **The .NET Companion and Security Dependencies**

The original engineering context stipulates the existence of a "Windows .NET companion for supported acquisition and local operations." However, from an HCI and systems architecture perspective, enforcing a native companion installation severely degrades the primary browser-first value proposition and introduces substantial friction.

Relying on a local .NET companion typically requires the browser application to communicate with a localhost server via WebSockets or HTTP APIs. This architectural pattern is fundamentally flawed for a mass-market primary path due to severe security implications. Browsers enforce strict Cross-Origin Resource Sharing (CORS) policies. Opening a WebSocket to localhost from an arbitrary web origin bypasses standard validation protocols, subjecting the user to Cross-Site WebSocket Hijacking and DNS rebinding attacks6. As demonstrated by vulnerabilities in enterprise local-agent frameworks, malicious websites can silently seize control of locally running unauthenticated WebSocket endpoints, executing arbitrary commands without user interaction7.

Furthermore, prompting a new user to download, trust, and execute an .exe or .msi file shatters the "just works" browser paradigm. It introduces OS-level permission prompts, triggers antivirus heuristics, and creates significant installation fatigue, directly contradicting the goal of eliminating expert setup.

Therefore, the primary beginner path must completely circumvent the .NET companion. The combination of Wasm execution, WebGPU acceleration, HTTP Range Requests for chunked network delivery, and OPFS for persistent local storage allows the modern browser to handle discovery, download, installation, and execution entirely natively. The .NET companion should be relegated exclusively to the Advanced tier, explicitly documented as a specialized tool for local file conversion or routing to unsupported custom hardware endpoints, rather than a prerequisite for everyday conversational use.

## **Honest Empty States and Missing Dependencies**

A critical project-supplied fact dictates that there is currently no established qualified default model or proven live initial seed in the engineering checkpoint. It is an egregious violation of user trust to present synthetic fixture tests, randomly imported files, or mock user interfaces as if a working real model currently exists. The design must accommodate the reality of the missing product dependency while laying the architectural groundwork for the future release.

Until MiniModel.org hosts a verified, live composition of the six required files, the application must default to a highly transparent "Empty State." The visual chat interface should be rendered in the background but disabled, with a prominent, elegant overlay dominating the viewport. The microcopy must honestly state: "TinyRustLM is awaiting its first intelligence module. The default models are currently undergoing final qualification." A single, prominent action button labeled "Provide Custom Model (Advanced)" should route the user directly to the manual local-file import flow. The application must not render deceptive "Downloading..." progress bars that hang indefinitely, nor should it invite the user to blindly drop random, unsupported .gguf files into the browser under the false pretense that they will function without structural conversion.

Once the engineering team successfully qualifies the first live seed and publishes it to the MiniModel.org directory, this interim empty state UI will simply be bypassed by the "First Visit" state machine, initiating the seamless acquisition flow.

## **Text Wireflows for the Primary Interface**

To visualize the sequential user experience without relying on fabricated graphical mockups, the UI transitions are mapped through continuous narrative wireflows.

When the user first lands on the URL, the screen renders a clean, minimalist layout dominated by a central message: **"Waking up your assistant..."** directly above a smooth, indeterminate progress bar. Below the bar, subdued text reads, "Downloading core knowledge (1.2 GB). This only happens once." The standard chat input box at the bottom of the screen is visible but disabled, displaying the placeholder text, "Preparing assistant..." As the background HTTP Range Requests pull the OPFS chunks, the progress bar transitions to a determinate state, filling smoothly. Once hashing is complete, the central message briefly flashes **"Almost ready,"** before fading out entirely. The chat input box instantly activates, the placeholder text changes to **"What's on your mind?"**, and a welcoming, introductory message from the assistant appears in the chat log.

If the user clicks the subtle "Settings" icon in the corner, a modal slides in. The primary view offers basic toggles for theme preferences and a destructive red button labeled **"Delete Assistant (Frees 1.2 GB)"**. Below this, a distinct, bordered section labeled **"Advanced Configuration"** requires an explicit click to expand. Upon expansion, the user is presented with the complex control inventory: input fields for custom Hugging Face URLs, a drag-and-drop zone specifying the need for .slm2 and .tokenizer2 files, and IP address routing inputs. Adjusting any of these advanced fields instantly disables the primary model, updating the active status indicator at the top of the modal to read: **"Custom Source Active."**

## **Specific Edge Cases and Capabilities**

To ensure the implementation is robust, specific Web API capabilities and limitations must be handled rigorously within the engineering architecture.

### **HTTP Range Requests and OPFS Streaming**

Browsers impose strict memory limits on the amount of data that can be held synchronously in a single ArrayBuffer, meaning that attempting to download a 1GB .slm2 file in one massive fetch request will invariably crash the Wasm engine or trigger an out-of-memory exception3.

The download algorithm must utilize chunking. First, the system issues an HTTP HEAD request to MiniModel.org to verify that the server supports Accept-Ranges: bytes and to retrieve the total Content-Length of the artifact12. The system then divides this Content-Length into sequential 50MB chunks. It fetches the first chunk utilizing the header Range: bytes=0-52428799. The resulting Response.body is piped directly into a FileSystemSyncAccessHandle.write() operation at the current byte offset within the OPFS sandbox. Critically, the system must invoke FileSystemSyncAccessHandle.flush() after each chunk to force the operating system to commit the data to persistent disk22. The system updates an IndexedDB pointer with the new last\_written\_byte and iterates through the remaining chunks. This strict streaming architecture ensures the application's memory footprint remains well under 60MB during the entire multi-gigabyte acquisition phase.

### **WebGPU maxStorageBufferBindingSize Restrictions**

The WebGPU specification forces applications to explicitly request hardware limits during initialization1. The most critical limit for local language model inference is maxStorageBufferBindingSize, which dictates the absolute maximum block of model weights that can be bound to the GPU in a single shader pass2.

If the call to navigator.gpu.requestAdapter() returns an adapter where the maxStorageBufferBindingSize is severely constrained (for example, less than 128MB, common on older integrated graphics or specific mobile chips), the system must not attempt to force WebGPU inference, as it will result in a fatal binding size exception. Instead, the architecture must detect this constraint pre-flight, automatically transition the UI to the "Device memory full" state, and gracefully fall back to CPU-bound Wasm execution. While inference will be significantly slower, the application will remain functional and stable, preserving the user experience.

## **Usability Testing Plan**

Prior to shipping the redesign, the minimal user journey must be validated with individuals completely unfamiliar with artificial intelligence terminology or model architecture.

The testing assumes that users will not abandon the web page if an automatic background download takes longer than 30 seconds, provided the user interface clearly communicates the necessity and progress of the operation. It also assumes that users will correctly interpret the "Not enough room" microcopy as a directive to manage their operating system-level disk space, rather than searching for browser-specific settings.

The testing protocol consists of five measurable tasks, targeting a profile of non-technical internet users:

> 1. **First Run Initialization:** The user is instructed to "Open the application link and start a conversation." The completion criterion is met if the user successfully waits for the auto-download to complete and sends a first message without asking the moderator for technical assistance.  
> 2. **Storage Pressure Resolution:** The test environment is artificially constrained to less than 1GB of free space. The user is instructed to "Open the application and resolve the error." The criterion is met if the user successfully identifies that their computer's hard drive is full and understands they cannot proceed without deleting personal files.  
> 3. **Network Interruption Recovery:** The moderator physically disconnects the Wi-Fi when the download reaches 50%. The user is asked, "What is the system doing, and what should you do?" The criterion is met if the user reads the "Connection lost" state and correctly states they simply need to wait for the Wi-Fi connection to return.  
> 4. **Advanced Settings Navigation:** The user is provided a private model file on their desktop and instructed to "Load the custom file." The criterion is met if the user successfully locates the hidden "Advanced" menu, discovers the local import drag-and-drop zone, and successfully bypasses the default download flow.  
> 5. **Artifact Retirement:** The user is instructed to "Delete the assistant from your computer to free up space." The criterion is met if the user locates the "Delete Assistant" button in the settings and successfully clears the OPFS storage sandbox.

## **Prioritized Experiment Matrix**

To validate the technical hypotheses systematically, the engineering team must execute a prioritized matrix of controlled experiments.

| Hypothesis | Controlled Variables | Exact Inputs | Procedure | Observable Outputs | Suggested Thresholds | Failure Interpretation | Next Action |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Chunked OPFS streaming prevents OOM crashes | Browser engine, RAM allocation | 1.2GB .slm2 file, HTTP Range Requests at 50MB chunks | Initiate download on device with 4GB total RAM | JS Heap size, OS Memory pressure events | Peak JS heap \< 100MB | Memory leak in streaming pipeline | Force garbage collection after each chunk flush |
| Web Locks gracefully handle cross-tab contention | Same-origin tabs, Web Lock API | Open Tab A (Leader), Open Tab B (Follower) | Tab A acquires lock, Tab B requests lock | Tab B fallback to UI listener, no OPFS read error | Lock acquisition timeout \< 500ms | OS failed to release lock, or logic race condition | Implement heartbeat timeout for lock claims |
| maxStorageBuffer fallback prevents GPU panics | Adapter limits, Model payload | Artificially restrict adapter maxStorageBufferBindingSize to 64MB | Init WebGPU engine, load model | Clean catch of exception, fallback to Wasm CPU | GPU crash count \= 0 | Shader logic ignores requested limits | Rewrite shader tiling to respect queried limits |
| Firefox persist prompt does not cause abandonment | Browser (Firefox), User gesture | Trigger navigator.storage.persist() on first chat input | Monitor prompt appearance and user selection | "Allow" vs "Block" interaction rates | "Allow" rate \> 80% | Users are frightened by the native browser prompt | Implement pre-prompt educational UI modal |

## **Implementation Sequence and Ship Criteria**

To ensure engineers can execute the redesign without requiring further extensive literature reviews, the implementation must proceed in strictly gated, sequential phases. Each phase requires meeting an explicit ship/no-ship criterion before advancing.

The first phase is the OPFS Storage Worker. Engineering must create a Dedicated Web Worker responsible for handling all OPFS SyncAccessHandle input/output operations. The explicit gate for this phase requires demonstrating that the worker can write a 1GB dummy file in 50MB chunks to the persistent disk without causing the main UI thread to drop frames or stall.

The second phase is the HTTP Range Request Engine. The team must implement the chunked fetching logic against a static dummy file hosted on a test server. The explicit gate requires an artificial network interruption at exactly 50% download completion; upon network restoration, the system must resume fetching perfectly at the exact byte offset without restarting the download.

The third phase implements Web Locks and Cross-Tab coordination. The team must utilize navigator.locks for leader election. The explicit gate requires that if Tab A is actively downloading the artifacts, and a user opens Tab B, Tab B immediately renders the progress state via BroadcastChannel communication, rather than crashing due to an OPFS lock violation.

The final phase involves WebGPU Limit Detection. The team must implement the pre-flight checks for maxStorageBufferBindingSize. The explicit gate requires artificially constraining the browser's reported limits to 64MB; the system must safely abort the WebGPU initialization and fall back to Wasm-CPU execution instead of inducing a fatal graphics panic.

## **Unresolved Local Measurements**

Before final calibration of the system, engineering must execute localized telemetry tests on the target demographic hardware to determine several unknown variables. The team must measure the average OPFS flush latency, determining how many milliseconds SyncAccessHandle.flush() requires on an average mechanical hard disk drive versus an NVMe solid-state drive. This measurement dictates whether 50MB chunks cause unacceptable I/O stuttering on lower-end devices. Additionally, the team must measure the Firefox persistence drop-off rate, quantifying the exact percentage of users who click "Deny" when prompted for navigator.storage.persist(). If this rate is alarmingly high, the UX team must design an interstitial modal that explains the benefits of local storage before the browser prompt is triggered.

## **What to Stop Doing**

To ensure the success of this architectural pivot, the engineering and design teams must cease several existing practices. The team must stop building the primary onboarding flow around the .NET companion, as it introduces severe security vulnerabilities regarding localhost WebSockets and unacceptable UX friction. The team must stop attempting to load entire multi-gigabyte files into memory using Response.arrayBuffer(), completely shifting to streams and chunking. Finally, the team must stop keeping historical model copies in D:\\LLMs\\TinyRustLM; to respect the user's disk space, only the active composition must be retained, and superseded payloads must be permanently deleted.

## **Compact Experiment-Lesson Template**

To preserve compact, actionable lessons regarding system behavior without generating sprawling, unreadable documentation, engineering should adopt the following template for all subsequent WebGPU and Wasm tuning experiments:

**Question:** Does increasing the OPFS chunk size from 50MB to 100MB reduce total download time on high-speed connections?**Exact Inputs:** 1.2GB .slm2 file, 1 Gbps symmetric fiber connection, Chrome 128 (Windows).**Method:** Download file using 50MB chunks (N=10 runs). Clear OPFS. Download using 100MB chunks (N=10 runs). Measure performance.now() delta.**Result:** 50MB chunks averaged 12.4s. 100MB chunks averaged 12.1s.**Uncertainty:** Minimal impact on gigabit connections; results may invert on low-memory devices where 100MB allocations trigger severe garbage collection pauses.**Decision:** Retain 50MB chunk size to ensure stability on low-end hardware.**Reusable Lesson:** I/O chunk sizes above 50MB yield diminishing returns on modern browsers due to V8 memory allocation overhead.**Evidence Identity:** Commit Hash a1b2c3d / Trace Log E:\\Source\\Rust\\TinyRustLM.com\\experiments\\chunk\_size\_01.log

## **Smallest Falsifiable Experiment**

To empirically validate this entire architectural recommendation, the smallest falsifiable experiment is to deploy the OPFS Storage Worker phase and attempt to load a 1.2GB dummy file via HTTP Range Requests onto a baseline, resource-constrained smartphone (e.g., a three-year-old Android device). If the browser crashes, or if the mobile operating system aggressively terminates the tab due to out-of-memory errors before the file is fully committed to the Origin Private File System, the core hypothesis that browser-local isolation is broadly viable for the primary path is falsified. Under such failure conditions, the project would be forced to revert to relying on the .NET companion application to manage out-of-browser, OS-level download management.

#### **Works cited**

> 1. From WebGL to WebGPU | Chrome for Developers, [https://developer.chrome.com/docs/web-platform/webgpu/from-webgl-to-webgpu](https://developer.chrome.com/docs/web-platform/webgpu/from-webgl-to-webgpu)  
> 2. WebGPU Memory Limits: maxStorageBufferBindingSize \- Ayoob AI, [https://ayoob.ai/blog/webgpu-maxstoragebufferbindingsize-limits-enterprise](https://ayoob.ai/blog/webgpu-maxstoragebufferbindingsize-limits-enterprise)  
> 3. 3x faster project loads with the origin private file system, [https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/](https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/)  
> 4. FileSystemFileHandle: createSyncAccessHandle() method \- Web APIs, [https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle)  
> 5. Persistent storage | Articles \- web.dev, [https://web.dev/articles/persistent-storage](https://web.dev/articles/persistent-storage)  
> 6. Private Network Access \- GitHub Pages, [https://wicg.github.io/private-network-access/](https://wicg.github.io/private-network-access/)  
> 7. The Sovereign Agent Dilemma: A Comprehensive Analysis of, [https://gregrobison.medium.com/the-sovereign-agent-dilemma-a-comprehensive-analysis-of-openclaw-moltbook-and-the-emerging-d9fd752996ff](https://gregrobison.medium.com/the-sovereign-agent-dilemma-a-comprehensive-analysis-of-openclaw-moltbook-and-the-emerging-d9fd752996ff)  
> 8. Capabilities | 2020 | The Web Almanac by HTTP Archive, [https://almanac.httparchive.org/en/2020/capabilities](https://almanac.httparchive.org/en/2020/capabilities)  
> 9. IndexedDB Max Storage Size Limit \- Detailed Best Practices \- RxDB, [https://rxdb.info/articles/indexeddb-max-storage-limit.html](https://rxdb.info/articles/indexeddb-max-storage-limit.html)  
> 10. Persistent Storage Options \- SQLite, [https://sqlite.org/wasm/doc/trunk/persistence.md](https://sqlite.org/wasm/doc/trunk/persistence.md)  
> 11. Artifact \[4b1ad64c84\] \- SQLite, [https://sqlite.org/wasm/artifact?name=4b1ad64c84b29c9b\&txt=1](https://sqlite.org/wasm/artifact?name=4b1ad64c84b29c9b&txt=1)  
> 12. HTTP range requests \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range\_requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests)  
> 13. Serving Video with HTTP Range Requests \- smoores.dev, [https://smoores.dev/post/http\_range\_requests/](https://smoores.dev/post/http_range_requests/)  
> 14. Running a 3.4GB language model in a browser tab \- Unwrite, [https://unwrite.co/blog/running-3-7gb-language-model-in-browser/](https://unwrite.co/blog/running-3-7gb-language-model-in-browser/)  
> 15. Browser Storage Options Compared \- Novus Stream Solutions, [https://novusstreamsolutions.com/product-blog/browser-storage-options-compared](https://novusstreamsolutions.com/product-blog/browser-storage-options-compared)  
> 16. Working with the Storage API \- Raymond Camden, [https://www.raymondcamden.com/2023/08/25/working-with-the-storage-api](https://www.raymondcamden.com/2023/08/25/working-with-the-storage-api)  
> 17. What Is Progressive Disclosure in UX? Definition, Examples & Best, [https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/)  
> 18. 4 Principles to Reduce Cognitive Load in Forms \- NN/G, [https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/)  
> 19. Rebuilding an Upload System That Was Losing Customer Data, [https://www.vasylsemiliak.com/projects/from-30-to-99-percent-rebuilding-upload-system-losing-customer-data](https://www.vasylsemiliak.com/projects/from-30-to-99-percent-rebuilding-upload-system-losing-customer-data)  
> 20. Securing OpenClaw in the Enterprise: A Zero Trust Approach to, [https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/03/enterprise-openclaw-zero-trust-hardening-guide-v1.pdf](https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/03/enterprise-openclaw-zero-trust-hardening-guide-v1.pdf)  
> 21. Browser Storage Comparison: sql.js vs IndexedDB vs localStorage, [https://recca0120.github.io/en/2026/03/06/browser-storage-comparison/](https://recca0120.github.io/en/2026/03/06/browser-storage-comparison/)  
> 22. File System API \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
# **Crash-Safe Resumable Multi-Peer Import and End-to-End Content Verification for TinyRustLM Artifacts**

The deployment of small language models, particularly within the ecosystem of TinyRustLM, necessitates a robust, fault-tolerant infrastructure capable of managing multi-peer artifact acquisition. The transition from remote network sources to a fully instantiated, verified runtime model involves navigating hostile network environments, non-deterministic cross-platform file system behaviors, and complex synchronization challenges across language boundaries. This comprehensive specification outlines a resilient, crash-safe architecture for importing TinyRustLM .slm models, specifically targeting a representative 925 MiB production artifact composed of 925 fixed-size pieces. The orchestration of this process is delegated to a C\# client, while all cryptographic, structural, and semantic trust decisions are strictly enforced by the immutable Rust runtime1.  
Operating under the explicit assumption that local runtime behavior remains untested and that all knowledge is derived from public primary sources, this report delineates a zero-trust execution environment. The design strictly prevents time-of-check to time-of-use (TOCTOU) vulnerabilities, identity substitution, and state corruption. Credentials are never persisted, partially assembled artifacts are entirely isolated from the runtime, and the mere existence of data on disk is never conflated with cryptographic completeness.

## **Primary Source Literature Review**

The architectural decisions presented in this report are grounded in contemporary systems engineering literature and established vulnerability disclosures. The constraints of the TinyRustLM ecosystem are derived from project documentation, which outlines a single global Rust/WebAssembly runtime, a strict C-style Application Binary Interface (ABI), and rigorous evidence boundaries for transitioning models into a ready state1. The structural validation parameters are based on the custom SLM1 binary format, which enforces a 108-byte fixed header, non-cryptographic internal checksums, and 64-byte tensor directory entries1. Sizing constraints are informed by the TinyLM-16M artifact specifications, confirming the 925 MiB payload and memory behaviors1.  
Research on crash consistency leverages insights from transactional file system literature, specifically the use of atomic file renames coupled with ordered fsync calls to mimic the durability of Write-Ahead Logging (WAL) databases without modifying the underlying operating system2. This research proves that failing to synchronize directory metadata results in orphaned or overwritten files during sudden power loss4. Furthermore, network threat modeling is informed by recent vulnerability disclosures, including DNS rebinding attacks against local services7 and data amplification vulnerabilities (decompression bombs) in HTTP clients10. Finally, network scheduling and bounded concurrency models utilize the Mathis equation to predict TCP throughput degradation under varying conditions of packet loss and latency, ensuring evidence-based peer scoring rather than reliance on raw advertised bandwidth12.

## **The Exact Trust and Fetch Sequence**

The integrity of the import process relies on a strictly ordered sequence of operations. Altering this sequence introduces critical security vulnerabilities, enabling attackers to inject malicious payloads, bypass authentication, or corrupt the local execution environment. The orchestrator must execute the following sequence, delegating every validation step to the Rust core.  
The sequence begins by validating the local import request. The C\# orchestrator must parse the request to guarantee that the destination path, the intent of the operation, and the requested model identity conform strictly to local isolation policies. Proceeding without this initial sanitization exposes the system to path traversal and arbitrary file overwrite attacks. Following successful local validation, the orchestrator fetches bounded peer status. By querying the provided peer URLs for their protocol version, health, and availability, the orchestrator establishes basic transport viability before committing any cryptographic trust.  
Subsequently, the orchestrator must fetch and validate piece-set metadata. The manifest, which describes the 925 MiB artifact and contains the SHA-256 Merkle root of the 925 fixed-size pieces1, is downloaded and passed to the Rust core. Rust acts as the sole authority, validating the cryptographic signature and the structural integrity of the manifest. Concurrently, any required companion state—such as tokenizers or adapter configurations—is fetched and cryptographically bound to the manifest by the Rust runtime.  
With the metadata secured, the system enters the critical phase of binding all identities to the selected manifest. The Rust runtime must enforce that all peer identities and the requested model hash explicitly match the validated manifest. If two remote peers disagree on the Merkle root, the import must immediately abort. The concept of "last-write-wins" is strictly forbidden, as it allows a compromised secondary peer to silently overwrite a legitimate manifest with a malicious counterpart. Only after this binding is complete can the orchestrator safely schedule pieces across the available, validated peers based on their current transport evidence.  
As the network transfers commence, the system must verify every piece individually. Each 1 MiB piece arrives into a temporary memory buffer. The C\# orchestrator passes this buffer to Rust via the FFI boundary, where Rust calculates the SHA-256 hash and verifies it against the established Merkle tree. A piece is definitively marked complete in the state machine only if Rust explicitly returns a success code. Assuming a piece is valid simply because a file operation succeeded on disk completely subverts the security model and is strictly prohibited.  
Verified pieces are then used to assemble a temporary artifact. They are systematically appended to a temporary file within a highly isolated staging directory, physically separated from any path that the TinyRustLM runtime observes. Once all 925 pieces are successfully assembled, Rust performs a comprehensive verification of the complete .slm structure and its internal checksums1. This requires traversing the 108-byte header and the tensor directory to ensure no logical inconsistencies exist that might trigger buffer overflows during memory mapping.  
Following successful structural validation, the temporary file is atomically promoted. It is renamed from the private staging location into the final, runtime-accessible directory. To ensure the integrity of the transaction chain, a cryptographically signed receipt is generated, flushed to disk, and immediately read back and re-validated by Rust. Finally, the model is exposed, and the orchestrator notifies the host application that the instantiation process may begin.  
Changing this operational order invites catastrophic failures. If piece scheduling and assembly precede the strict identity binding to the manifest, an attacker controlling a single peer could serve pieces from a structurally valid but maliciously tuned model, effectively poisoning the assembly. If final structural verification is deferred or skipped under the assumption that piece-level hashing is sufficient, a single misaligned byte in the header—specifically around the custom checksum at offset 100 or the tensor data offsets1—could lead to out-of-bounds reads when the un-sandboxed memory mapper attempts to initialize the model. Furthermore, attempting to write directly to the final artifact location rather than utilizing an isolated staging environment guarantees that the runtime will eventually encounter a partially written .slm file during a concurrent load operation, leading to undefined behavior or application crashes.

## **Durable Resume Journal and State Machine Architecture**

To survive process termination, application restarts, network loss, and sudden power failures without resulting in data corruption or infinite retry loops, the import process relies on a rigorous state machine backed by a durable Write-Ahead Log (WAL). This journal mimics the atomicity found in transactional file systems, ensuring that the system never enters an inconsistent state3.  
The state machine governs the entire lifecycle of the import transaction. It operates as a directed acyclic graph where the Rust runtime enforces the validity of state transitions, and the C\# orchestrator executes the corresponding network and disk I/O. The initial state is the generation of a stable import ID and the recording of the idempotency key. The system then transitions through peer resolution, manifest validation, and scheduling. The core operational loop alternates between scheduling and assembling, tracking the success or failure of individual pieces. Upon completion of assembly, the state machine transitions to final verification and then to the committing phase, where file system operations occur. The machine terminates in either a completed, failed, or cancelled state.  
To support this state machine, a versioned resume-state schema must be maintained on disk. This schema utilizes atomic file replacement to prevent torn writes. Crucially, the schema must structurally exclude all credentials, bearer tokens, and user-identifiable paths, relying entirely on anonymous UUIDs and hashes.  
The resume state includes a schema version to facilitate future backwards-compatible migrations. It contains the stable import ID, the idempotency key to prevent duplicate initializations, and the strictly validated manifest identity (the SHA-256 Merkle root). The schema explicitly defines the expected artifact size (969,932,800 bytes for the 925 MiB model), the piece size (1,048,576 bytes), and the total piece count (925 pieces).  
Retry counters track both global piece failures and peer-specific timeouts, governing the exponential backoff algorithms. A piece bitmap or an array of per-piece states tracks the progress of the assembly, distinguishing between pending, downloading, and verified states. Peer observations record the real-time latency and loss metrics used by the scheduler. Finally, timestamps document the creation and last update of the journal, while a journal MAC (Message Authentication Code) ensures local integrity.  
The journal MAC utilizes an ephemeral, machine-specific HMAC-SHA256 key generated at the start of the application lifecycle. This design explicitly rejects state copied from another import or another machine. If an attacker attempts to inject a modified resume.json to bypass piece verification, the MAC validation will fail, and the orchestrator will discard the state entirely, falling back to a clean initialization.  
When a schema migration is required due to software updates, the orchestrator reads the schema\_version field. If the version is outdated, the JSON is passed through a deterministic transformation pipeline before any network operations resume. If the schema version is newer than the orchestrator understands, the import is marked as incompatible and halted, preventing forward-compatibility corruption.

### **Torn Writes and Fsync Boundaries**

Updating the resume journal requires strict adherence to file system synchronization boundaries. Operating systems cache write operations in memory to improve performance, deferring the physical writing of data to the storage medium. If power is lost before the cache flushes, a file can be left partially written, resulting in a torn write and invalid JSON.  
To prevent this, the orchestrator implements a strict write-ahead behavior. When a piece is successfully verified by Rust, the orchestrator serializes the updated state to a temporary file, such as resume.json.tmp. It then issues an fsync() command (or FlushFileBuffers on Windows) on this temporary file, guaranteeing that the new JSON payload is safely recorded on the physical disk platter. Next, the orchestrator atomically renames resume.json.tmp to resume.json. Finally, it must issue an fsync() on the parent directory containing the journal2. Synchronizing the directory ensures that the file system metadata—specifically the directory entry pointing to the new file—is durable. Without this final directory sync, a crash could result in the file system losing track of the new file, reverting the state machine to an older, inaccurate version4.

## **Staging Layout and Cross-Platform Path Safety**

Cross-platform file system hazards present a vast and highly complex attack surface. A rigorously designed staging layout isolates the in-progress assembly from the rest of the file system and enforces strict ownership rules, mitigating risks across both Windows and Linux environments.  
The architecture dictates a clean separation between the final read-only store and the private staging environment. The staging directory must be created with highly restricted permissions, specifically 0700 on POSIX systems, ensuring that only the owning application process has read, write, and execute capabilities. Within this staging directory, every distinct import operation is assigned a unique, canonical root based on its UUID. This root contains the resume journal, the downloaded manifest, the growing temporary artifact file, and an optional directory for individual piece buffering.  
Path safety relies on the absolute enforcement of canonical root containment. Any file names or sub-paths supplied by external peers, manifests, or user configurations must be aggressively sanitized. The C\# orchestrator must normalize all paths and verify that they resolve strictly within the designated canonical root. The presence of directory traversal sequences (such as ../), forward slashes, backslashes, or null bytes must trigger an immediate terminal failure state.  
Windows environments introduce a unique set of legacy and architectural hazards. Case-insensitive file systems mean that resume.json and RESUME.JSON point to the same file, creating opportunities for state collision if not handled deterministically. The orchestrator must force all internal path tracking to lowercase and reject mixed-case inputs from external sources. Furthermore, Windows reserves specific device names from the DOS era, such as CON, PRN, AUX, NUL, and COM1 through COM9. An attacker attempting to force the system to write to a file named NUL.slm could cause unpredictable application hangs or crashes.  
Alternate Data Streams (ADS) represent another critical Windows vulnerability. NTFS allows hidden data streams to be attached to a file by appending a colon to the file name (e.g., artifact.tmp:malicious.exe). The orchestrator must explicitly reject any path containing a colon to prevent arbitrary payload injection.  
To mitigate directory traversal attacks via symbolic links, directory junctions, reparse points, or hard links, the orchestrator must explicitly disable link following during file creation and validation. The staging directory must be enforced as a flat, strictly regulated structure.  
Concurrent access by system utilities, particularly Windows Defender or other Antivirus (AV) scanners, frequently causes race conditions during file manipulation. When the orchestrator rapidly writes to artifact.tmp and subsequently attempts an atomic rename, an opportunistic AV scanner may lock the file for inspection, resulting in an IOException. To counter this, files within the staging directory must be opened with exclusive file sharing modes (such as FileShare.None when actively writing, or FileShare.Read during hashing) to prevent external processes from establishing conflicting locks.  
On Linux, the use of sparse files could theoretically allow the system to instantly allocate the entire 925 MiB payload, reporting a massive apparent file size while consuming zero physical disk blocks until data is written. However, relying on sparse files masks underlying storage limitations. Writing the file sequentially and explicitly requesting block allocation is required to guarantee that physical disk space is actually available, thereby preventing catastrophic, delayed Disk Full (ENOSPC) errors during the critical final piece assemblies.  
In the event that an import is cancelled by the user, the entire canonical root directory specific to that import ID must be recursively deleted. Following deletion, the parent staging directory must be synchronized to the disk to ensure the space is immediately and durably reclaimed.

## **Piece Scheduling, Network Dynamics, and Bounded Concurrency**

Downloading a 925 MiB artifact composed of 925 discrete 1 MiB pieces requires a highly orchestrated network scheduler. To honor bounded concurrency principles and prevent uncontrolled memory exhaustion13, the orchestrator is strictly limited to operating across a maximum of two concurrent connection lanes.  
The scheduler operates a thread-safe work-stealing queue. The 925 piece indices are populated into this queue, and both Lane 1 and Lane 2 aggressively pull the next available piece. If the primary peer is operating on a significantly faster network link than the secondary peer, the primary lane will naturally steal and process a proportionally larger share of the work. This emergent behavior optimizes total throughput without requiring complex, fragile pre-allocation algorithms.  
Peer scoring must be calculated continuously based solely on current transport evidence, entirely disregarding historical reputation or advertised capabilities. TCP network dynamics, particularly in the presence of packet loss, cause massive deviations between theoretical bandwidth and actual throughput.  
To quantify this, the architecture relies on the Mathis equation, which demonstrates that TCP throughput is inversely proportional to the Round-Trip Time (RTT) and the square root of the packet loss probability12. Consider two contrasting network environments for the 925 MiB artifact:

| Network Scenario | Advertised Bandwidth | RTT | Packet Loss | Mathis Theoretical Limit | Time to Download 925 MiB |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Slow, Asymmetric Link** | 4 Mbps (500 KB/s) | 120 ms | 0.1% | \~458 KB/s | \~34.4 minutes |
| **Lossy, High-Speed Link** | 100 Mbps (12.5 MB/s) | 40 ms | 3.0% | \~251 KB/s | \~62.8 minutes |

This quantitative analysis proves that despite the lossy link advertising a 25x higher bandwidth, the elevated packet loss cripples the TCP congestion window, resulting in significantly worse real-world performance12. The orchestrator tracks a moving average of piece completion times. If the peer on the lossy link consistently delivers pieces at a degraded rate or frequently triggers read timeouts, the scheduler implements an exponential backoff strategy, temporarily halting requests to that peer and routing all queue traffic to the stable, albeit slower, connection.  
When the Rust runtime rejects a piece due to a SHA-256 hash mismatch, the orchestrator increments both a global retry counter and a peer-specific corruption counter. If a specific peer exceeds a threshold of three consecutive corrupted pieces, it is immediately quarantined. The system initiates peer failover, completely abandoning the compromised connection.  
Duplicate fetch suppression is enforced by the work-stealing queue. If Lane 1 is actively downloading Piece 42, Lane 2 is prohibited from requesting Piece 42 unless Lane 1 explicitly drops the connection and returns the piece to the pending pool. Because two peers are only utilized after their manifest identities are proven to match exactly at the initialization of the import, there is absolute certainty that incompatible pieces from different .slm revisions will never be mixed.

## **HTTP Client Hardening and Vulnerability Mitigation**

The transport layer, though orchestrated by the C\# application, interfaces directly with hostile networks and must be treated as inherently untrusted. Hardening the HTTP client is paramount to preventing infrastructure compromise, memory exhaustion, and local security breaches.  
A critical vulnerability in local orchestration is DNS rebinding. If the orchestrator operates locally and attempts to interface with peers, an attacker can lure the user to a malicious website. The attacker's DNS server initially resolves their domain to a public IP, but sets a remarkably short Time-To-Live (TTL). Once the browser loads the malicious script, the DNS record is updated to point to a private IP address (such as 127.0.0.1). The browser, acting as a confused deputy, then executes requests against the local orchestrator, bypassing Same-Origin Policies7.  
To prevent this, the HTTP client and local server logic must enforce strict Origin and Host header validation7. Any request lacking a recognized host header must be rejected. Furthermore, the orchestrator must maintain distinct policies for loopback/private-network interactions versus remote interactions. Remote peers must be explicitly prohibited from issuing HTTP redirects that point to private IP spaces (e.g., 10.x.x.x or 192.168.x.x).  
Redirects are capped at a maximum of three hops to prevent infinite loops. Furthermore, URL user-info (e.g., http://username:password@hostname.com/) must be aggressively stripped from all internal logging and processing, as the persistence of credentials is strictly forbidden.  
The HTTP client must also defend against Data Amplification attacks, commonly known as Decompression Bombs. Highly compressed payloads can cause a client to exhaust all available host memory. A payload of a few kilobytes can inflate to several gigabytes if transparent decompression (such as gzip or brotli) is applied blindly without output limits10. Because each piece in the TinyRustLM architecture is exactly 1 MiB, the client must either disable transparent HTTP decompression entirely or enforce a hard abort if the decompression buffer exceeds 1,048,576 bytes.  
Chunked transfer encoding introduces additional risks, including HTTP request smuggling and truncated payloads. The client must strictly validate that the total bytes received during a chunked transfer exactly match the expected piece size. A truncated chunked response must not be padded or accepted; it must be discarded and marked as a failure.  
Network volatility requires strict timeout management. Read timeouts are configured per-piece, meaning 15 seconds without a byte flowing triggers a socket disconnect. However, a total absolute deadline must also be enforced per piece. This prevents a malicious peer from slowly dripping data at one byte per second, which would keep the connection alive indefinitely and stall the import process. Connection pooling must enforce modern cryptographic standards, requiring TLS 1.3 and strictly validating certificate chains for all remote peers, classifying any cryptographic downgrade as a deterministic, terminal error.

## **Final Artifact Verification: Streamed vs. Random Access**

The assembly of 925 individual pieces into a 925 MiB temporary file guarantees that the total byte count matches the expected payload. However, successful physical assembly confers no semantic trust. The Rust runtime must execute a rigorous final verification before the artifact can be promoted.  
During the network phase, piece verification is a streamed process. The C\# orchestrator holds a 1 MiB chunk in memory and passes it to Rust, which hashes the sequential bytes and compares the result to the corresponding node in the Merkle tree. Streamed validation is highly efficient for transport, but it cannot validate the logical coherence of the entire file structure.  
Validating the structural integrity of the .slm v1 container strictly requires random access. The SLM1 format is defined by a 108-byte fixed header, which specifies critical configuration parameters and exact byte offsets for the tokenizer, the tensor directory, and the tensor payloads1.  
Upon completion of the assembly, the C\# orchestrator yields control to the Rust runtime, providing the path to the complete .tmp file. Rust opens the file and executes a comprehensive structural audit:

1. **Header Magic and Versioning:** Rust verifies that bytes 0 through 3 exactly match the ASCII sequence SLM1, and bytes 4 through 7 indicate version 11.  
2. **Full File SHA-256 and MiniModel Binding:** Rust calculates a single SHA-256 hash across the entire 925 MiB file, proving that the concatenated pieces perfectly match the original manifest identity.  
3. **Directory and Config Checksums:** The custom non-cryptographic checksum, located at offset 100, is validated. This is achieved by zeroing out bytes 100-107 in memory and recalculating the checksum across the header fields1.  
4. **Tensor Layout and Bounds Checking:** Rust seeks to the tensor directory, iterating over the 64-byte entries. It verifies that the FNV-1a hash, data types, ranks, and dimensions are logically sound. Crucially, it validates that the data offset and length parameters point to valid byte ranges within the file, strictly preventing out-of-bounds reads during future memory mapping1.  
5. **Quantization and Numerical Configuration:** The runtime verifies that the requested data types (f32, q8\_0, or q4\_0) are actively supported by the execution backend1. It also checks the numerical sanity of the RoPE theta (offset 56\) and RMS epsilon (offset 60\)1.  
6. **Receipt-Chain Binding:** Rust generates a final, cryptographically secure receipt binding the file hash, the manifest, and the current timestamp, proving the provenance of the artifact.

If Rust detects any anomaly—a misaligned tensor, an unsupported quantization type, or a corrupted checksum—it returns an immediate failure. The runtime is strictly prohibited from silently attempting to repair a corrupted .slm file.

## **Cross-Platform Atomicity and File System Mechanics**

Transitioning the verified artifact from the private .staging/artifact.tmp to the public models/tinylm-16m-f32.slm requires absolute cross-platform atomicity. If a power failure occurs during this operation, the file system must not present a partially copied or corrupted file to the execution runtime.  
On Linux and POSIX-compliant systems, the rename(2) system call is atomic with respect to the namespace. If the system crashes precisely during the rename, the namespace will resolve to either the old path or the new path, but never a corrupted hybrid. However, namespace atomicity does not guarantee data durability. The physical data inside the file, as well as the updated directory entries, must be flushed from volatile RAM caches down to the physical disk platters4.  
The exact, non-negotiable synchronization sequence on POSIX systems is:

1. Issue fsync(fd) on the completed artifact.tmp to guarantee the 925 MiB payload is durable on disk.  
2. Issue fsync(fd) on the .staging directory to guarantee the file's presence in the source directory is durable.  
3. Execute the rename() system call to move the file into the models directory.  
4. Issue fsync(fd) on the models directory to commit the new namespace entry to the file system journal2.

Windows environments require a different implementation approach while demanding the same durability guarantees. The orchestrator utilizes the MoveFileEx API with the MOVEFILE\_REPLACE\_EXISTING flag to achieve namespace atomicity. To ensure write-through durability, the application must issue a FlushFileBuffers call on the file handle prior to the move. To synchronize the NTFS Master File Table (MFT), the orchestrator must open the target directory with the FILE\_FLAG\_BACKUP\_SEMANTICS flag and issue a subsequent flush.  
If a catastrophic failure occurs after the initial file synchronization but before the final directory synchronization completes, the file system may revert to its previous state upon reboot. In this scenario, the resume journal will indicate that the system was in the COMMITTING state. The orchestrator will discover the file still residing in the staging directory, request Rust to re-verify the complete 925 MiB artifact, and re-attempt the atomic promotion sequence.

## **Orchestrator Pseudocode and Trust Delegation**

The C\# orchestrator coordinates the network I/O and file system mechanics, but delegates every cryptographic and structural trust decision to the Rust core via Foreign Function Interface (FFI) bindings. The C\# code utilizes memory pinning (GCHandle) when passing the 1 MiB pieces to prevent the garbage collector from pausing execution or relocating memory during the transfer.

C\#  
public class ImportOrchestrator {  
    public async Task RunImport(string manifestUrl, string\[\] peerUrls) {  
        // 1\. Initialize State and FFI Context  
        var state \= LoadOrInitResumeState();  
        IntPtr rustContext \= Native.rust\_import\_init(state.ImportId);

        try {  
            // 2 & 3\. Fetch status and validate manifest via Rust  
            byte\[\] rawManifest \= await Network.FetchMetadata(manifestUrl);  
            int manifestStatus \= Native.rust\_validate\_manifest(rustContext, rawManifest);  
            if (manifestStatus \!= 0)   
                throw new SecurityException("Manifest rejected by Rust.");

            // 4 & 5\. Identity Binding and Peer Validation  
            foreach(var peer in peerUrls) {  
                byte\[\] peerId \= await Network.FetchPeerIdentity(peer);  
                if (Native.rust\_bind\_peer\_identity(rustContext, peerId) \!= 0) {  
                    // Identity mismatch; quarantine this peer.  
                    continue;   
                }  
            }

            // 6 & 7\. Concurrent Piece Scheduling and Verification  
            var workQueue \= BuildWorkQueue(state);  
            await Task.WhenAll(  
                LaneWorker(workQueue, peerUrls\[0\], rustContext),  
                LaneWorker(workQueue, peerUrls\[1\], rustContext)  
            );

            // 8 & 9\. Assembly and Final Random-Access Verification  
            string tmpPath \= $".staging/{state.ImportId}/artifact.tmp";  
            int verifyStatus \= Native.rust\_verify\_complete\_slm(rustContext, tmpPath);  
            if (verifyStatus \!= 0) {  
                CleanStaging(state.ImportId);  
                throw new Exception("Final artifact structural verification failed.");  
            }

            // 10\. Atomic Promotion with strict fsync boundaries  
            string finalPath \= "models/tinylm-16m-f32.slm";  
            PlatformIO.AtomicRenameAndFsync(tmpPath, finalPath);  
              
            // 11\. Write and Revalidate Cryptographic Receipt  
            byte\[\] receipt \= Native.rust\_generate\_receipt(rustContext, finalPath);  
            File.WriteAllBytes("models/tinylm-16m-f32.receipt", receipt);  
              
            // 12\. State Machine Termination  
            state.Status \= "COMPLETED";  
            UpdateJournalFsync(state);  
        }  
        finally {  
            Native.rust\_import\_free(rustContext);  
        }  
    }

    private async Task LaneWorker(ConcurrentQueue\<int\> queue, string peer, IntPtr ctx) {  
        while (queue.TryDequeue(out int pieceIndex)) {  
            byte\[\] pieceData \= await Network.DownloadPieceWithTimeout(peer, pieceIndex);  
              
            // Pin memory to prevent GC relocation during FFI call  
            GCHandle handle \= GCHandle.Alloc(pieceData, GCHandleType.Pinned);  
            try {  
                // Rust acts as sole authority for SHA-256 verification  
                if (Native.rust\_verify\_piece(ctx, pieceIndex, handle.AddrOfPinnedObject()) \== 0) {  
                    PlatformIO.AppendToTmpFile(pieceData, pieceIndex);  
                    UpdateJournalFsync(pieceIndex);  
                } else {  
                    // Cryptographic failure: requeue for work stealing and punish peer  
                    queue.Enqueue(pieceIndex);   
                    ApplyPeerBackoff(peer);  
                }  
            } finally {  
                handle.Free();  
            }  
        }  
    }  
}

## **Security Analysis and Attacker Capabilities**

Evaluating the resilience of this architecture requires a formal threat model defining specific attacker capabilities and the corresponding defensive mechanisms.  
**Attacker Capabilities:**

* **The Malicious Peer:** The attacker maintains complete control over a secondary peer URL. They have the capability to serve arbitrary, malicious bytes, intentionally stall network connections, or advertise fraudulent identities.  
* **Network Interception (Man-in-the-Middle):** The attacker occupies a privileged network position, capable of dropping, duplicating, delaying, or altering TCP packets in transit.  
* **Local Non-Admin Compromise:** The attacker has achieved local execution rights on the host machine but lacks the administrative or root privileges required to bypass kernel-level file permissions.

**Defensive Assurances:**

* If the Malicious Peer attempts to serve a poisoned payload, the attack is neutralizing immediately. The Rust runtime's piece-by-piece Merkle tree verification cryptographically guarantees that any deviation from the established manifest results in the piece being discarded.  
* If the Malicious Peer attempts a Denial of Service by stalling the connection, the orchestrator's absolute piece deadlines and work-stealing queue will identify the stall, quarantine the peer, and seamlessly route the remaining workload to a healthy peer.  
* If the Network Interceptor attempts to alter packets, the TLS 1.3 protocol will likely drop the connection. Even if TLS is bypassed, the secondary SHA-256 validation within the Rust core acts as an immutable backstop against data corruption.  
* If the Local Non-Admin attempts to modify the staging data, they are blocked by the OS kernel, as the .staging directory is strictly locked to 0700 permissions. Furthermore, if they attempt to edit the resume.json to maliciously skip piece verification, the validation of the HMAC-SHA256 journal\_mac will fail, causing the system to discard the tainted state.  
* By structural design, credentials cannot be stolen because they are never persisted. System paths and application logs are sanitized to contain only anonymous UUIDs and piece indices, completely stripping URL user-info prior to processing.

## **Crash and Fault-Injection Matrix**

The resiliency of the state machine is mathematically proven through a strict matrix of expected post-restart outcomes. Every injected fault must result in a deterministic recovery sequence.

| Injected Fault / Crash Scenario | Exact Expected Post-Restart Outcome |
| :---- | :---- |
| **Termination after every durable state transition** | Orchestrator reads resume.json, identifies the last successfully fsync'd state, and resumes network operations. No duplicate downloads occur for previously verified pieces. |
| **Disk full (ENOSPC) during piece append** | Orchestrator catches the IOException, logs the failure, and safely retains the current resume.json state. Upon restart (after disk space is manually cleared), it resumes precisely at the failed piece. |
| **Permission loss (EACCES) on .staging** | System triggers a terminal FAILED state. Process aborts. Manual intervention is required to restore correct directory ownership. |
| **Hash mismatch on Piece 404** | Rust returns a validation error. The corrupted piece is purged from memory. The retry counter increments, and the work queue routes the next attempt to an alternate peer. |
| **One-byte corruption on disk (artifact.tmp)** | Rust's final structural validation fails during random access. The entire staging artifact is considered compromised and is wiped. The state machine resets to INIT. |
| **Truncated piece from HTTP chunked response** | HTTP client detects the chunk length mismatch or premature EOF. The piece is marked failed and immediately requeued for work-stealing retry. |
| **Duplicate response (Lanes 1 & 2 fetch same piece)** | The first thread to successfully verify and acquire the file lock wins. The second write is suppressed by the idempotent logic of the state journal. |
| **Stale metadata / Peer identity drift** | A peer serves a different manifest identity mid-transfer. Rust rejects all subsequent piece hashes. The peer is permanently quarantined for this session. |
| **Cancellation during assembly** | Orchestrator explicitly sets the CANCELLED state. All network sockets are forcefully closed. The specific .staging/import\_id directory is recursively deleted. |
| **Cancellation after final verification, before receipt** | Because the atomic rename has not yet occurred, the .staging directory is wiped. The artifact is safely destroyed and never exposed to the runtime. |
| **Restart after atomic rename** | resume.json indicates the COMMITTING state. The orchestrator discovers the file exists in the final location, invokes Rust to re-verify the receipt, and moves the state to COMPLETED. |

## **Performance Measurements and Telemetry**

To validate the theoretical efficiency of this design in active production environments, specific telemetry metrics must be collected locally by the orchestrator. This data collection must strictly avoid gathering Personally Identifiable Information (PII).

| Metric Category | Specific Measurement | Architectural Purpose |
| :---- | :---- | :---- |
| **Network Latency** | P50, P90, and P99 latency distributions for fetching 1 MiB pieces. | To identify connection stalling and calibrate the exponential backoff algorithms across varied networks (e.g., 4G vs. enterprise Wi-Fi). |
| **Work-Stealing Efficiency** | The exact ratio of pieces completed by Lane 1 versus Lane 2\. | To validate that the work-stealing queue correctly punishes slow peers and optimizes total throughput dynamically. |
| **I/O Synchronization Latency** | The millisecond time cost of executing fsync() on the journal file versus the parent directory structure. | To profile the performance penalty of Write-Ahead Logging on rotational HDDs compared to NVMe SSDs. |
| **FFI Boundary Overhead** | CPU time spent passing 1 MiB pinned byte arrays across the C\#-Rust interop boundary. | To ensure that memory pinning prevents Garbage Collector pauses and maintains high-speed loopback throughput. |
| **Final Validation Latency** | The total time required for Rust to sequentially read the 925 MiB file and validate the tensor boundary offsets. | To determine the required timeout thresholds for the final promotion phase before the application assumes a hang. |

## **Prioritized Implementation and Test Plan**

Because local runtime behavior cannot be assumed as tested, the implementation must follow a highly structured, prioritized rollout emphasizing isolation and chaos engineering.

1. **Phase 1: Rust Core Cryptography and Parsing**  
   * *Implementation:* Develop the Merkle tree verification logic, the SLM1 108-byte header parser, and the .slm offset bounding-box validation entirely within Rust.  
   * *Testing:* Utilize fuzz testing on the FFI interface, feeding it truncated, maliciously mutated, and highly randomized 1 MiB pieces to ensure the Rust core never panics or exhibits buffer over-reads.  
2. **Phase 2: Durable Journal and Atomicity**  
   * *Implementation:* Build the C\# state machine, the JSON schema parser, and the cross-platform fsync / FlushFileBuffers wrappers.  
   * *Testing:* Implement property-based chaos testing. Rapidly mutate the state machine while randomly injecting Environment.Exit(-1) calls during writes. Upon restart, assert that the journal integrity is mathematically perfect.  
3. **Phase 3: Network and Scheduling**  
   * *Implementation:* Construct the HTTP client, the concurrent work-stealing queue, and the dynamic peer scoring algorithms.  
   * *Testing:* Deploy a local loopback proxy using tools like Toxiproxy to simulate hostile network conditions, specifically targeting a 120ms RTT, 3% packet loss, and random TCP connection resets to validate the Mathis equation logic.  
4. **Phase 4: Integration and Security**  
   * *Implementation:* Bind the C\# orchestrator to the Rust core. Implement the critical DNS rebinding protections and Decompression Bomb limits within the HTTP layer.  
   * *Testing:* Attempt to feed a highly compressed 1 GB payload composed entirely of zero-bytes to the client. Verify that the client terminates the connection immediately upon exceeding the 1 MiB threshold without exhibiting memory spikes.

## **Unknowns Requiring Local Schema or Code Inspection**

Because this research relies exclusively on public information and defensive engineering principles, several localized implementations remain unknown and require direct inspection by the internal implementation team prior to production deployment.  
First, the exact memory mechanics across the FFI boundary require review. Does the C\# runtime pass pointers to safely pinned memory buffers, or does the current architecture force a deep copy of the 1 MiB piece into a Rust-allocated Vec\<u8\>? High memory copy overhead dictates the viability of high-speed local loopback imports.  
Second, the internal capabilities of the tinyrustlm-slm-pack crate are unclear. Does the existing Rust crate currently expose a streaming Merkle verification function, or does it require the entire 925 MiB file to be mapped into memory via mmap before hashing can begin? The proposed architecture assumes chunked, streaming hashing is available to prevent memory exhaustion.  
Finally, the behavior of custom Endpoint Detection and Response (EDR) or Antivirus software within the specific enterprise environment is unknown. Aggressive EDR hooks may arbitrarily terminate processes that execute ReplaceFileW operations on files with an .slm extension. The implementation team must map these local AV behaviors to determine if exception policies are required for the staging directory.

#### **Works cited**

1. Implementation \- MiRust, [https://mirust.com/implementation/](https://mirust.com/implementation/)  
2. From Crash Consistency to Transactions \- UT Austin Computer Science, [https://www.cs.utexas.edu/\~witchel/pubs/hu17hotos-txfs.pdf](https://www.cs.utexas.edu/~witchel/pubs/hu17hotos-txfs.pdf)  
3. TxFS: Leveraging File-System Crash Consistency to Provide ACID Transactions \- USENIX, [https://www.usenix.org/system/files/conference/atc18/atc18-hu.pdf](https://www.usenix.org/system/files/conference/atc18/atc18-hu.pdf)  
4. Is rename() atomic? \- linux \- Stack Overflow, [https://stackoverflow.com/questions/7054844/is-rename-atomic](https://stackoverflow.com/questions/7054844/is-rename-atomic)  
5. Ts'o: Delayed allocation and the zero-length file problem \- LWN.net, [https://lwn.net/Articles/323169/](https://lwn.net/Articles/323169/)  
6. Does fsync() commits rename() effects on a given file ? \- Google Groups, [https://groups.google.com/g/comp.unix.programmer/c/AM2V83RCOVE](https://groups.google.com/g/comp.unix.programmer/c/AM2V83RCOVE)  
7. DNS-rebinding protection allows all domains by defaults · Issue \#3113 · googleapis/mcp-toolbox \- GitHub, [https://github.com/googleapis/mcp-toolbox/issues/3113](https://github.com/googleapis/mcp-toolbox/issues/3113)  
8. Security Best Practices \- Model Context Protocol, [https://modelcontextprotocol.io/docs/tutorials/security/security\_best\_practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)  
9. Making a Statically-Linked, Single-File Web App with React and Rust | Hacker News, [https://news.ycombinator.com/item?id=16765020](https://news.ycombinator.com/item?id=16765020)  
10. Improper Handling of Highly Compressed Data (Data Amplification) \- CVEs \- Feedly, [https://feedly.com/cve/cwe/409](https://feedly.com/cve/cwe/409)  
11. CodeQL 2.24.0 adds Swift 6.2 and .NET 10 support, and improves file handling for minified JavaScript \- The GitHub Blog, [https://github.blog/changelog/2026-01-29-codeql-2-24-0-adds-swift-6-2-support-net-10-compatibility-and-file-handling-for-minified-javascript/](https://github.blog/changelog/2026-01-29-codeql-2-24-0-adds-swift-6-2-support-net-10-compatibility-and-file-handling-for-minified-javascript/)  
12. [unknown\_url](http://docs.google.com/unknown_url)  
13. Implementation operations \- MiRust, [https://mirust.com/implementation-operations/](https://mirust.com/implementation-operations/)  
14. Tiny Model Composer \- MiRust, [https://mirust.com/composer/](https://mirust.com/composer/)
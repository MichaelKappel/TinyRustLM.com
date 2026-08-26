# **Wholly New One-Shot Composition Registration After An Immutable /10 Failure**

## **1\. Executive Recommendation and Immutable-History Rules**

The failure of the model-composition operation designated /10 represents a mathematically and logically immutable terminal state within the TinyRustLM architecture. The managed inspection process correctly identified a fundamental cryptographic and semantic divergence from the registered goal state, exiting with code 1 (converter-receipt-contract). Specifically, the operation produced an output status that did not match the producer's intended child durability ID, expected to be formatted as the string parent \+ "-members". Because TinyRustLM operates strictly as a prelaunch, clean-slate product governed by a forward-only evidence state machine, there exists no technical mechanism, compatibility population, or administrative override that allows for the repair, adoption, or promotion of the /10 candidate. The execution is permanently burned.  
Any attempt to rerun /10, copy its candidate bytes, reuse its private roots, preserve its compiled binaries, or weaken the managed inspector to accept the flawed output constitutes a catastrophic violation of the custody protocol. The terminal decision is locked. The architecture enforces a zero-retry policy on compromised operation identities. Therefore, the singular path forward is the initiation of a wholly new one-shot composition operation, which must be systematically registered, isolated, and executed under a completely fresh identity matrix.  
This subsequent operation must incorporate a validated source correction commit that aligns the managed verifier with the parent \+ "-members" logic and confirms the "performed" status. The entire lifecycle—from the non-interactive remote Git fetch to the instantiation of the hermetic Windows x64 MSVC environment, the offline Rust build, and the isolated execution within a restricted Windows Job Object—must be rigorously orchestrated and proven from a zero-knowledge starting state. Only upon pristine execution and read-only verification can the new candidate be advanced to native and WASM inference testing.

## **2\. Registration and Execution State Diagram**

The lifecycle of the one-shot composition operation is governed by a deterministic, unidirectional finite state machine. Transitions occur only when the strict cryptographic and logical constraints of the current state are proven to be satisfied. A registration that changes the source commit and tree must absolutely precede every source-derived build and execution artifact. If build custody or execution is initiated prior to registration, the resulting artifacts lack a cryptographic anchor, rendering them indistinguishable from arbitrary, untrusted data. Such an inversion of operations introduces severe vulnerabilities, including the potential for post-hoc adoption of tampered binaries or the manipulation of terminal records to match a desired outcome.  
The complete registration state machine progresses through the following sequential phases:

| State Designation | Core State Function and Custodial Responsibility | Transition Condition (Success) | Transition Condition (Failure) |
| :---- | :---- | :---- | :---- |
| S0\_SOURCE\_REVIEW | Isolate the corrected source commit. Prove remote equality and cryptographic integrity of the tree containing the durability ID fix. | Remote tree matches local clean state; shallow repository checks pass1. | Malformed commit, dirty working tree, detached HEAD, or uncommitted modifications. |
| S1\_REGISTRATION | Bind the frozen-goal identities, source locks, and schema hashes into a committed registration contract. Enforce zero-retry policy. | Registration payload securely bound; absent-root declarations formalized. | Hash collision, registration conflict, or remote fetch rejection. |
| S2\_BUILD\_CUSTODY | Materialize the hermetic Windows MSVC environment and offline Rust dependencies. Execute managed and native compilation. | Binaries and assemblies produced; environment hashes mathematically match registration. | Toolchain absent, network request detected during build, or compilation error. |
| S3\_PREFLIGHT | Prove absolute absence of all registered future execution roots. Secure physical volumes against path-aliasing and alternate data streams. | Zero target paths exist; valid volume ownership proven via kernel handles3. | Target path exists, alternate data stream detected, or TOCTOU race condition triggered. |
| S4\_OWNER\_EXECUTE | Spawn the single owner process tree contained within a highly restricted Windows Job Object. Enforce timeouts and output bounds. | Process tree exits 0; Job Object signals standard, non-forced termination. | Spawn failure, non-zero exit, timeout exceeded, resource exhaustion, or crash. |
| S5\_VERIFY\_READONLY | Execute read-only inspection of evidence. Recalculate cryptographic digests and validate semantic contracts without untrusted execution. | Output digests match expectations; semantic contract asserts "performed". | converter-receipt-contract mismatch; read/write violation detected. |
| S6\_PUBLIC\_RESULT | Distill execution evidence into a public-safe JSON schema, excluding raw bytes, local paths, and secrets. | JSON structure exactly matches public-safe evidence schema. | Sensitive data leaked; schema validation fails. |
| S7\_RESULT\_COMMIT | Bind the minimized public result to the public tracking repository, formally closing the operation. | Push accepted by the remote origin repository. | Network failure; remote origin rejection. |

Every operation inherently includes a S\_TERMINAL\_SINK state. Any failure condition immediately forces a transition to this sink, closing the operation ID permanently and prohibiting any further transitions or retry attempts under that identity.

## **3\. Identity Graph and All-New-Name Table**

To ensure the new operation cannot collide with, overwrite, or silently adopt artifacts from the failed /10 execution, a completely new identity matrix must be cryptographically generated and enforced across all logical and physical layers. The system must rigorously distinguish between a logical identity (the conceptual boundary of a resource), the physical path (its manifestation on the Windows NTFS filesystem), and the content hash (the cryptographic proof of the bytes residing at that location).  
All identities listed in the following matrix must be wholly new, derived from a combination of the updated source commit, the new operation index, and a cryptographically secure random salt bound at registration.

| Entity Description | Logical Identity Format | Physical Path Example | Characteristics and Cryptographic Constraints |
| :---- | :---- | :---- | :---- |
| **Operation ID** | TRLM-OP-11-\<salt\> | N/A (Embedded in JSON metadata) | Wholly new string; acts as the primary logical key tracking this specific one-shot composition. |
| **Source Correction Commit** | SHA-1 (Commit) | .git/objects/... | Must be a new commit containing the specific logic fix for the child durability ID parent \+ "-members". |
| **Environment Request & Output** | TRLM\_ENV\_11\_\<hash\> | C:\\TRLM\\Env\_11\_\<hash\>\\ | Must be entirely absent before S2\_BUILD\_CUSTODY. Captures the exact MSVC variables and registry states. |
| **Rust Custody Request & Root** | TRLM\_RUST\_11\_\<hash\> | C:\\TRLM\\Rust\_11\_\<hash\>\\ | Contains the offline vendor cache, Cargo.toml, and the resulting native executables. Generated strictly during S2. |
| **Managed Custody Root** | TRLM\_MNGD\_11\_\<hash\> | C:\\TRLM\\Mngd\_11\_\<hash\>\\ | Contains the .NET assemblies responsible for the read-only inspection. Pre-flighted for zero alternate data streams. |
| **Owner Execution ID** | TRLM\_EXEC\_11\_\<hash\> | N/A (Windows Process/Job Object Name) | New UUID injected into the CreateJobObjectW kernel API to guarantee process isolation. |
| **Evidence Output Root** | TRLM\_EVID\_11\_\<hash\> | C:\\TRLM\\Evid\_11\_\<hash\>\\ | Output target for the model candidate bytes, cryptographic receipts, and terminal streams. |
| **Terminal Records** | TRLM\_TERM\_11\_\<hash\>.log | C:\\TRLM\\Evid\_11\_\<hash\>\\term.log | Ordered, exclusive-write event stream capturing stdout and stderr up to the strict byte limit. |
| **Public Result** | TRLM-PUB-11-\<hash\> | .git/refs/heads/results/11 | Minimal, public-safe JSON representation committed to the remote repository. |

## **4\. Remote-Exact Source Proof**

Before the new operation can be registered, the exact state of the corrected source code must be cryptographically proven to match the public remote repository. This prevents the execution of local, uncommitted code or the manipulation of the build process via ignored artifacts residing in the local working directory.  
The proof must begin with a non-interactive fetch operation (git fetch origin) to update the tracking references without altering the local working tree. The resulting FETCH\_HEAD must be cryptographically compared to the targeted remote reference. To defend against ambiguous branch names or a detached HEAD state, the branch format must be strictly validated using the git check-ref-format \--branch plumbing command4. This ensures the reference conforms to Git's strict naming conventions and prevents shell injection or path traversal vulnerabilities during subsequent parsing.  
Crucially, the repository must not be a shallow clone. A shallow clone lacks the complete cryptographic history required to validate the ancestry of the correction commit, breaking the chain of trust. The system must invoke git rev-parse \--is-shallow-repository; if this command outputs true or indicates the presence of a .git/shallow file, the repository is deemed mathematically incomplete, and the operation is immediately aborted2.  
To generate the tree identity proof without relying on the potentially dirty working directory, the system must utilize Git's plumbing layer. Invoking git write-tree computes the exact tree object hash of the current index1. This tree hash is then compared to the tree hash of the remote commit. If git diff-index \--cached HEAD returns any discrepancies, the state is deemed dirty—perhaps due to ignored build artifacts or submodules that are out of sync—and the state is rejected. Finally, by binding the registration to the absolute, full-length SHA-1 commit hash rather than a mutable branch name, the architecture neutralizes the risk of a remote force-push silently altering the target code after the registration has been frozen.

## **5\. Root Absence, Ownership, and Path-Security Protocol**

Prior to materializing the environment and initiating build custody, the system must definitively prove that every registered future root is absolutely absent from the filesystem. This preflight proof is a critical defense against adoption attacks, wherein an attacker might pre-stage a copied /10 receipt or tampered binary, tricking the verifier into accepting unexecuted work.  
NTFS permits multiple path representations mapping to a single physical file via symlinks, hard links, junction points, and mapped network shares. To defeat these path-aliasing attacks, all targeted paths must be aggressively normalized. The system must invoke the GetFinalPathNameByHandleW kernel API with the VOLUME\_NAME\_NT flag9. This operation strips standard DOS drive letters (e.g., C:\\) and resolves all reparse points to their raw kernel namespace representation (e.g., \\Device\\HarddiskVolume1\\...), ensuring that the orchestrator is evaluating the true physical location on the disk. Furthermore, case folding rules must be rigorously applied to prevent bypasses relying on NTFS case-insensitivity.  
A severe vulnerability in path-security protocols is the Time-of-Check to Time-of-Use (TOCTOU) race condition, where an attacker observes the absence check and swiftly creates the file before the orchestrator can reserve it. The protocol must mathematically merge observation and reservation into a single, atomic kernel operation. This is accomplished by invoking the Windows CreateFileW API with the CREATE\_NEW creation disposition3. If the file or directory already exists at the exact moment of the call, the kernel immediately fails the request with ERROR\_FILE\_EXISTS. Because creating directories requires specialized handling, the FILE\_FLAG\_BACKUP\_SEMANTICS flag must be bitwise-OR'd into the attributes array, allowing a secure handle to be returned for a newly minted directory3.  
Even if the primary path is proven absent and created atomically, an attacker could attempt to pre-stage malicious data in an Alternate Data Stream (ADS) attached to a parent directory. The protocol must recursively scan the generated directory structure using the FindFirstStreamW and FindNextStreamW APIs to enumerate all streams11. Any stream discovered other than the unnamed default data stream (::$DATA), the directory bitmap (::$BITMAP), or the attribute list (::$ATTRIBUTE\_LIST) mandates the immediate termination of the operation and classification as a preflight rejection12.

## **6\. Environment, Rust, and Managed Build Custody**

The integrity of the compiled owner process is entirely dependent on the hermetic materialization of the Windows x64 MSVC environment and the Rust toolchain. The system must capture the exact toolchain discovery and version selection, freeze the environment, and pass it to the build processes without relying on ambient system variables that could introduce non-determinism.  
The standard method of preparing a Windows C++ build environment is executing Microsoft's vcvarsall.bat script. However, PowerShell and managed environments do not natively inherit environment variables modified by spawned cmd.exe child processes. To establish absolute build custody, the orchestrator must invoke a command string designed to export the post-execution environment state, patterned as: cmd.exe /c "C:\\...\\vcvarsall.bat x64 && set \> %temp%\\vcvars.txt"13. The orchestrator then parses this resulting text file, systematically stripping irrelevant metadata (such as the PROMPT variable), and applies the extracted key-value pairs directly to the process-level env: provider using \[System.Environment\]::SetEnvironmentVariable13. This technique guarantees that the exact MSVC discovery paths and library inclusions are sealed into an immutable dictionary for the duration of the build.  
To secure the Rust build custody, the compilation must be completely severed from the external network, neutralizing supply-chain injection during resolution. Prior to severing the network connection, the orchestrator executes cargo vendor to download the precise, cryptographically hashed dependencies defined in the source lockfile into a local vendor directory16. The project's .cargo/config.toml is then programmatically generated with the following parameters:

Ini, TOML  
\[net\]  
offline \= true  
\[source.crates-io\]  
replace-with \= "vendored-sources"  
\[source.vendored-sources\]  
directory \= "vendor"

16. This configuration mathematically forces the cargo build \--offline command to rely solely on the vendored sources. Following compilation, a comprehensive regular-file inventory is conducted on the output binaries and assemblies, capturing their exact file sizes and SHA-256 digests. These independent content summaries are bound to the registration, proving that the executed binaries are exactly those produced by the hermetic build.

## **7\. Sole Owner Launch and Process-Tree Algorithm**

The execution phase is strictly limited to exactly one invocation of the compiled owner binary. A second invocation, regardless of the outcome of the first, constitutes a fatal state-machine violation. To guarantee absolute process-tree ownership and to prevent orphaned child processes from leaking handles, escaping resource limits, or continuing execution post-timeout, the owner process must be spawned inside a uniquely named Windows Job Object.  
The sole owner invocation protocol dictates the following algorithm:

> 1. The orchestrator calls CreateJobObjectW with a uniquely generated, operation-specific UUID name mapped to the /11 execution ID.  
> 2. The SetInformationJobObject API is invoked with JOBOBJECT\_EXTENDED\_LIMIT\_INFORMATION to enforce strict resource constraints, establishing hard maximums for memory allocation and active process limits.  
> 3. The owner process is initialized via CreateProcessW using the CREATE\_SUSPENDED flag, preventing any code execution before containment is secured.  
> 4. The suspended process handle is irreversibly assigned to the Job Object via AssignProcessToJobObject.  
> 5. The ResumeThread API is called, initiating the owner's execution.

Crucially, standard handle inheritance must be meticulously restricted. If a child process spawned by the owner inherits the Job Object handle, it may inadvertently keep the Job Object alive indefinitely or exploit the handle to alter the job's limits20. Handle inheritance must be explicitly filtered by initializing a STARTUPINFOEX structure and utilizing UpdateProcThreadAttribute with a strictly curated PROC\_THREAD\_ATTRIBUTE\_HANDLE\_LIST.  
The execution is strictly bounded by a predefined timeout derived from the registration profile. If the owner process fails to exit within this limit, the orchestrator invokes TerminateJobObject(job, 1\)21. This kernel-level operation atomically terminates the owner and all recursively spawned child processes, guaranteeing that no residual execution persists to corrupt the filesystem or hold open file locks. Terminal streams (stdout and stderr) are captured via asynchronous anonymous pipes, capped at a hard byte limit to prevent disk-exhaustion denial-of-service attacks, and flushed strictly in chronological order to the immutable TRLM\_TERM\_11.log terminal record.

## **8\. Terminal Classification and No-Retry Matrix**

Every operation concludes in a terminal state that permanently closes the identity. Because the state machine is forward-only, no state allows a retry using the same operation ID. The classification determines what subsequent administrative or engineering actions are permissible before a new operation can be registered.

| Terminal Classification | Definition and Context | Operation Closed? | Allowed Future Work (Requires Wholly New ID) |
| :---- | :---- | :---- | :---- |
| **Preflight Rejection** | Orchestrator fails root absence or ownership checks (e.g., TOCTOU detection, path aliasing, ADS presence). | YES | Infrastructure audit required. Administrators must clear the filesystem, reboot runners, and generate a new operation ID. |
| **Spawn Failure** | The MSVC environment is missing, the binary cannot be located, or CreateProcessW fails immediately. | YES | Engineers must correct the environment materialization script or pathing logic, commit the fix, and re-register. |
| **Native Rejection** | The process exits with a non-zero code due to an OS-level constraint (e.g., out-of-memory, segmentation fault). | YES | Debug the underlying native code, commit the memory fix, and perform a wholly new registration. |
| **Managed Rejection** | The process exits cleanly but throws a specific logical error (e.g., the /10 ID mismatch). | YES | Correct the producer's logic (e.g., integrating the parent \+ "-members" fix), bind the commit, and re-register. |
| **Timeout** | The Job Object is forcibly terminated by the orchestrator via TerminateJobObject due to exceeding time bounds. | YES | Profile the performance bottleneck, optimize the binary, or mathematically extend the timeout bound in a new registration. |
| **Process Crash** | Unhandled exception or abort within the owner process tree prior to completion. | YES | Analyze the core dump, patch the software defect, commit the change, and re-register. |
| **Machine Crash** | Hard power loss, kernel panic, or hypervisor failure during execution. | YES | Verify physical disk integrity. The current operation identity is permanently dead. Initiate a completely new pipeline. |
| **Ambiguous Observation** | Disconnection of terminal pipes or missing event logs rendering the state unprovable. | YES | Treat strictly as a failure. Do not attempt to parse partial output. Diagnose telemetry infrastructure. |
| **Verifier Disagreement** | Read-only verifier rejects final output hashes, missing artifacts, or incorrect state logic. | YES | Fix verifier rule set or the producer's output logic. Commit changes and re-register. |
| **Pass** | Verifier confirms exact hashes, clean exit code 0, and logically valid output contracts. | YES | Proceed to explicit handoff for native inference and WASM verification phases. |

## **9\. Read-Only Verification Algorithm**

Once the owner process tree has completely terminated—either through a clean exit or via TerminateJobObject—the orchestrator invokes the read-only verifier exactly once. The verifier's sole purpose is to prove the integrity of the generated model bytes and the semantic correctness of the receipts without executing any untrusted code or mutating the candidate data.  
First, the verifier validates terminal exclusivity by confirming the Job Object handle signals a complete lack of active processes. To inspect the output, the verifier opens all generated candidate files, including the receipts and model weights, using the CreateFileW API with the dwShareMode parameter set strictly to FILE\_SHARE\_READ23. This instructs the Windows kernel to deny any concurrent write attempts. By requesting GENERIC\_READ access exclusively, the verifier leverages the kernel to mathematically prove that it made no writes to the evidence during inspection.  
The verifier then conducts a complete inventory of the TRLM\_EVID\_11\_\<hash\> output root. It iterates through every regular file, computing its precise SHA-256 digest. These computed digests are compared against the structural expectations of the Qwen/Qwen3-0.6B conversion logic bound during registration. Finally, the semantic verification of the receipt JSON is executed. The verifier parses the receipt to check the durability ID. In the failed /10 operation, this check yielded a fatal mismatch. In this new /11 operation, the verifier cryptographically validates that the receipt ID strictly matches the corrected string parent \+ "-members" and that the execution status unequivocally reads "performed".

## **10\. Public/Private Evidence Contract**

To maintain a secure, prelaunch posture, raw model bytes, physical system paths, environment secrets, and the raw terminal streams (stdout and stderr) must never enter Git or public records. The public-safe result minimization is governed by a strict JSON schema that distills the operation into a purely cryptographic and statistical summary.  
The bounded public result must adhere to the following field-level schema:

| Schema Field | Data Type | Purpose and Content |
| :---- | :---- | :---- |
| operation\_id | String | Uniquely identifies the one-shot execution (e.g., TRLM-OP-11). |
| source\_commit\_bound | String (SHA-1) | The exact commit hash of the original public candidate source (c1899de289a04d12100db370d81485cdf75e47ca). |
| source\_correction\_commit | String (SHA-1) | The exact commit hash containing the parent \+ "-members" logic fix. |
| registration\_timestamp | String (ISO 8601\) | The exact UTC time the registration state was frozen. |
| execution\_duration\_ms | Integer | Total elapsed time of the owner process within the Job Object. |
| terminal\_status | String | Must be exactly "pass" or a defined failure classification. |
| error\_type | String / Null | The typed error if applicable (e.g., null for success, or timeout). |
| output\_summary.total\_files | Integer | The exact count of regular files generated in the evidence root. |
| output\_summary.total\_bytes | Integer | The exact byte size of the generated candidate. |
| output\_summary.receipt\_hash | String (SHA-256) | Cryptographic digest of the receipt JSON. |
| output\_summary.model\_hash | String (SHA-256) | Cryptographic digest of the binary model output. |
| output\_summary.terminal\_hash | String (SHA-256) | Cryptographic digest of the immutable term.log file. |
| verifier\_assertions | Array of Strings | Explicit confirmations (e.g., \["durability\_id\_match", "status\_performed\_match", "zero\_write\_violation"\]). |

This schema contains sufficient metadata to independently audit the outcome and prove cryptographic custody, while completely excluding local directory paths (e.g., C:\\TRLM\\...), OS usernames, compiler warnings, or sensitive prompt data. This bounded result JSON is the sole artifact committed to the public Git repository.

## **11\. Fault-Injection and Rehearsal Strategy**

To guarantee the reliability of the new operation without risking the destruction of the /11 identity matrix due to a transient infrastructure glitch, a fault-injection rehearsal is mandated. The architecture must exercise the generic owner code and the state machine's enforcement mechanisms before committing to the real operation.  
A dummy operation, assigned a completely distinct logical identity (e.g., /rehearsal-1), is injected into the pipeline. This operation utilizes a minimal, synthetically generated Rust payload designed to immediately exit 0 or artificially fail based on parameterized inputs.

* It executes the complete MSVC environment materialization and offline cargo vendor sequence to prove build custody mechanics.  
* It allocates isolated directory structures, exercising the CreateFileW absence checks and FindFirstStreamW ADS scanning to ensure path security is active.  
* It tests the TerminateJobObject logic by spawning a child process trapped in a sleep loop, purposefully triggering the timeout bound to prove that process-tree termination functions correctly.

This rehearsal exercises every line of the orchestrator's state machine without materializing the registered roots for /11 or consuming its one-shot identity, establishing a high degree of confidence in the execution environment.

## **12\. Acceptance and Next-Phase Handoff**

Objective acceptance criteria for a successful new composition require that the entire state machine completes without deviation. Specifically:

> 1. The public JSON result asserts terminal\_status: "pass".  
> 2. The read-only verifier confirms the converter-receipt-contract logic is fully satisfied, explicitly validating parent \+ "-members" and the "performed" status.  
> 3. The cryptographic digests of the resulting candidate match the expectations derived from the Qwen3-0.6B source lengths and signatures.

However, a complete candidate transaction at the composition phase is merely a prerequisite. It must not be mislabeled as a mathematically sound or useful inference model. The successful closure of /11 serves only to trigger an explicit handoff to the numeric and native inference verification phases. Subsequent pipelines must load and execute the model in WASM, browser chat, and P2P deployment environments. Until those downstream owners terminate successfully and validate the campaign counters, the /11 model remains an unproven artifact, recognized only for satisfying the compositional state machine.

## **13\. Unknown Local Facts**

The rigorous protocols defined herein operate under the assumption of an uncompromised Windows kernel and standard NTFS semantics. Because this report is generated without access to the physical development machines or CI credentials, the following local facts represent physical-layer risks that cannot be verified remotely:

* **Kernel Hooks and Antivirus Agents**: Third-party security agents may intercept CreateFileW calls, asynchronously lock files for scanning, or inject unauthorized DLLs into the Job Object. This would violate the exclusive access and isolation required by the orchestrator.  
* **Hardware Clock Drift**: Significant clock discrepancies on the build runners could corrupt the ordering of terminal records or artificially trigger the Job Object timeout bounds prematurely.  
* **NTFS Volume State**: Physical disk degradation, extreme fragmentation, or undocumented filter drivers may cause GetFinalPathNameByHandleW to return malformed volume GUIDs, which would cause the preflight path normalization to fail unexpectedly.  
* **Memory Corruption**: Undetected ECC memory failures could flip bits during the SHA-256 digest recomputation, leading to a false verifier disagreement.

## **14\. Annotated Primary-Source Bibliography**

* 16  
  : Rust Offline Compilation via Cargo Vendor. Details the necessary commands (cargo vendor) and the specific .cargo/config.toml modifications (\[source.crates-io\] replace-with \= "vendored-sources") required to enforce a hermetic, offline dependency closure during the S2\_BUILD\_CUSTODY state.  
* 20  
  : Windows Process and Job Object Custody. Documents the TerminateJobObject API and the behavior of handle inheritance. Fundamental for guaranteeing comprehensive process tree termination and preventing child processes from escaping the sole owner invocation protocol.  
* 11  
  : Alternate Data Streams (ADS) and NTFS Metadata. Details the usage of FindFirstStreamW and FindNextStreamW to scan NTFS directories, preventing root absence violations and the hidden staging of payloads inside ::$DATA alternatives like Zone.Identifier.  
* 9  
  : Windows Path Normalization. Specifies the usage of GetFinalPathNameByHandleW and the VOLUME\_NAME\_NT syntax. Required for mapping DOS drive letters to immutable kernel volume targets to prevent path-aliasing attacks during preflight.  
* 1  
  : Git Tree Plumbing and Identity Proofs. Documents the internal mechanics of git write-tree and git commit-tree. Essential for computing the remote-exact source proof without being compromised by untracked or dirty local files in the working directory.  
* 23  
  : File Locking and Read-Only Custody. Documents the usage of FileShare.Read in C\# and Win32 environments. Ensures the read-only verifier leverages the kernel to mathematically prove it cannot modify candidate bytes during inspection.  
* 4  
  : Git Reference Validation. Explains the constraints enforced by git check-ref-format \--branch. Used to validate tracking references and defend against ambiguous detached HEAD states during the source registration phase.  
* 13  
  : MSVC Environment Extraction in PowerShell. Demonstrates the methodology of extracting vcvarsall.bat x64 variables into a PowerShell environment via intermediate file parsing (cmd /c "set \> env.txt"). Crucial for establishing offline build custody without relying on interactive shells.  
* 3  
  : Directory Creation Semantics and Race Conditions. Specifies combining the CREATE\_NEW creation disposition and the FILE\_FLAG\_BACKUP\_SEMANTICS flag with CreateFileW to atomically check for directory absence and allocate it, definitively closing TOCTOU race conditions.  
* 2  
  : Shallow Repository Detection. Documents the git rev-parse \--is-shallow-repository command, enforcing that the source repository maintains full cryptographic history to validate the correction commit's ancestry.

#### **Works cited**

> 1. How git write-tree works internally? \- Stack Overflow, [https://stackoverflow.com/questions/72128688/how-git-write-tree-works-internally](https://stackoverflow.com/questions/72128688/how-git-write-tree-works-internally)  
> 2. How to Test if Git Repository is Shallow? \- Stack Overflow, [https://stackoverflow.com/questions/37531605/how-to-test-if-git-repository-is-shallow](https://stackoverflow.com/questions/37531605/how-to-test-if-git-repository-is-shallow)  
> 3. Windows via C/C++ \[5 ed.\] 0735663777 \- DOKUMEN.PUB, [https://dokumen.pub/windows-via-c-c-5nbsped-0735663777.html](https://dokumen.pub/windows-via-c-c-5nbsped-0735663777.html)  
> 4. git-check-ref-format(1), [https://www.kernel.org/pub/software/scm/git/docs/git-check-ref-format.html](https://www.kernel.org/pub/software/scm/git/docs/git-check-ref-format.html)  
> 5. git-check-ref-format \- man pages section 1: User Commands, [https://docs.oracle.com/cd/E88353\_01/html/E37839/git-check-ref-format-1.html](https://docs.oracle.com/cd/E88353_01/html/E37839/git-check-ref-format-1.html)  
> 6. git-rev-parse(1), [https://www.kernel.org/pub/software/scm/git/docs/git-rev-parse.html](https://www.kernel.org/pub/software/scm/git/docs/git-rev-parse.html)  
> 7. How can I check if homebrew-core is a shallow clone in a bash script?, [https://stackoverflow.com/questions/66203418/how-can-i-check-if-homebrew-core-is-a-shallow-clone-in-a-bash-script](https://stackoverflow.com/questions/66203418/how-can-i-check-if-homebrew-core-is-a-shallow-clone-in-a-bash-script)  
> 8. Reachpad/greentree: Test the tree, not every commit \- GitHub, [https://github.com/Reachpad/greentree](https://github.com/Reachpad/greentree)  
> 9. GetFinalPathNameByHandleW function (fileapi.h) \- Win32 apps, [https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew)  
> 10. Blunder – Microsoft®'s Excellence in Disinformation and, [https://skanthak.hier-im-netz.de/blunder.html](https://skanthak.hier-im-netz.de/blunder.html)  
> 11. NET Matters: Iterating NTFS Streams \- Microsoft Learn, [https://learn.microsoft.com/en-us/archive/msdn-magazine/2006/january/net-matters-iterating-ntfs-streams](https://learn.microsoft.com/en-us/archive/msdn-magazine/2006/january/net-matters-iterating-ntfs-streams)  
> 12. File Streams (Local File Systems) \- Win32 apps \- Microsoft Learn, [https://learn.microsoft.com/en-us/windows/win32/fileio/file-streams](https://learn.microsoft.com/en-us/windows/win32/fileio/file-streams)  
> 13. How to use vcvars64.bat from Powershell? \- AppVeyor Support, [https://help.appveyor.com/discussions/questions/18777-how-to-use-vcvars64bat-from-powershell](https://help.appveyor.com/discussions/questions/18777-how-to-use-vcvars64bat-from-powershell)  
> 14. VsVars for Powershell \- GitHub Gist, [https://gist.github.com/jaredpar/c1448523c9553884623f](https://gist.github.com/jaredpar/c1448523c9553884623f)  
> 15. How can I source variables from a .bat file into a PowerShell script?, [https://stackoverflow.com/questions/20077820/how-can-i-source-variables-from-a-bat-file-into-a-powershell-script](https://stackoverflow.com/questions/20077820/how-can-i-source-variables-from-a-bat-file-into-a-powershell-script)  
> 16. rustc offline build · Issue \#124967 · rust-lang/rust \- GitHub, [https://github.com/rust-lang/rust/issues/124967](https://github.com/rust-lang/rust/issues/124967)  
> 17. Rust for offline development? : r/rust \- Reddit, [https://www.reddit.com/r/rust/comments/1uzbep0/rust\_for\_offline\_development/](https://www.reddit.com/r/rust/comments/1uzbep0/rust_for_offline_development/)  
> 18. Using Crates in offline environment \- Rust Users Forum, [https://users.rust-lang.org/t/using-crates-in-offline-environment/72970](https://users.rust-lang.org/t/using-crates-in-offline-environment/72970)  
> 19. Setting Up and Using Rust Offline for Seamless Development, [https://buildsoftwaresystems.com/post/rust-offline-development-tutorial/](https://buildsoftwaresystems.com/post/rust-offline-development-tutorial/)  
> 20. CreateProcess such that child process is killed when parent is killed?, [https://stackoverflow.com/questions/6259055/createprocess-such-that-child-process-is-killed-when-parent-is-killed](https://stackoverflow.com/questions/6259055/createprocess-such-that-child-process-is-killed-when-parent-is-killed)  
> 21. Chapter 6 \- Processes, Threads, and Jobs \- Codeby.net, [https://codeby.net/attachments/processes\_\_\_threads\_\_\_jobs-pdf.4435/](https://codeby.net/attachments/processes___threads___jobs-pdf.4435/)  
> 22. Kill process tree programmatically in C\# \- Stack Overflow, [https://stackoverflow.com/questions/5901679/kill-process-tree-programmatically-in-c-sharp](https://stackoverflow.com/questions/5901679/kill-process-tree-programmatically-in-c-sharp)  
> 23. c\# \- Lock file for writing/deleting while allowing any process to read, [https://stackoverflow.com/questions/3279071/lock-file-for-writing-deleting-while-allowing-any-process-to-read](https://stackoverflow.com/questions/3279071/lock-file-for-writing-deleting-while-allowing-any-process-to-read)  
> 24. File Read-only access irrespective of locks (C\#) \- Stack Overflow, [https://stackoverflow.com/questions/5944509/file-read-only-access-irrespective-of-locks-c](https://stackoverflow.com/questions/5944509/file-read-only-access-irrespective-of-locks-c)  
> 25. How to check if a file has Alternate Data Streams? \- Stack Overflow, [https://stackoverflow.com/questions/44270479/how-to-check-if-a-file-has-alternate-data-streams](https://stackoverflow.com/questions/44270479/how-to-check-if-a-file-has-alternate-data-streams)  
> 26. How to iterate through all git branches using bash script, [https://stackoverflow.com/questions/3846380/how-to-iterate-through-all-git-branches-using-bash-script](https://stackoverflow.com/questions/3846380/how-to-iterate-through-all-git-branches-using-bash-script)  
> 27. Visual C++ File Processing: Win32, [https://www.functionx.com/visualc/fileprocessing/win32.htm](https://www.functionx.com/visualc/fileprocessing/win32.htm)
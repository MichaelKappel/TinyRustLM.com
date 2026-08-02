# **Production Service Lifecycle, Resource Governance, And Operator Runbooks**

## **1\. Recommended Lifecycle Architecture**

The operational architecture for the downloadable TinyRustLM peer-to-peer (P2P) seed host necessitates a highly resilient, actively supervised dual-process model designed for continuous availability on consumer-grade, user-controlled hardware. The architecture explicitly divides the fleet into exactly two independently restartable "lane" processes, designated as Lane A and Lane B. This active-active or active-standby topology ensures that model pieces (MiniModel .slm files) remain available to the P2P network during binary updates, configuration reloads, or localized crash loops within a single lane.  
Because the underlying TinyRustLM runtime implements a single global mutex for model execution, parallelizing requests within a single process is blocked by the runtime's internal state machine1. Deploying two distinct processes bypasses this concurrency limitation, effectively doubling the transaction handling capacity of the host. Both lanes share read-only access to the local model and piece files, ensuring zero duplication of the storage footprint. However, the lanes maintain strict separation of process memory, endpoint bindings, runtime-state, and shutdown identities.  
To maintain security on user-controlled hardware without bypassing LocalEndpoint Connect approval controls, the architecture mandates strictly unprivileged execution. The processes operate entirely in user space, persisting no elevated credentials in the fleet configuration or logs. Install and uninstall routines are guaranteed to be idempotent, modifying only the definitions explicitly owned by the companion application and safely preserving the user's downloaded .slm artifacts unless an explicit purge is requested.

## **2\. Windows Mode Comparison and Recommended Task/Service Definition**

Operating a continuous, unprivileged background service on Windows requires navigating the complex trade-offs between Scheduled Tasks and native Windows Services. The primary distinctions involve startup timing, account identity, least-privilege enforcement, service recovery, session isolation, and graceful shutdown capabilities.  
A Windows Service configured for automatic startup initializes at system boot, running under a defined service account such as LocalService or NetworkService before any interactive user logs on2. This provides excellent uptime and robust recovery via the Service Control Manager (SCM), which enforces backoff and restart limits. Furthermore, Windows Services natively receive the SERVICE\_CONTROL\_PRESHUTDOWN control code3. This preshutdown notification allows a service to block the system shutdown temporarily (traditionally bounded by a registry-defined timeout) to gracefully drain P2P listeners, finalize local states, and cleanly revoke network announcements5.  
Conversely, a Scheduled Task triggered at logon inherits the interactive user's environment, seamlessly isolating the session but tying the host's background availability to the user's logon state7. To achieve boot-level persistence without storing the user's plaintext password in the Task XML definition, the task must utilize the TASK\_LOGON\_S4U (Service for User) logon type9. The S4U extension generates a restricted execution token that does not cache credentials9. While Microsoft documentation notes that S4U restricts "network access," this limitation strictly applies to Active Directory domain authentication and encrypted SMB file shares; it does not impede the allocation of raw TCP/IP sockets required by a P2P seed host9.  
Scheduled Tasks executed via S4U inherently run in a non-interactive desktop, isolating them from the user's immediate visual session while enforcing a TASK\_RUNLEVEL\_LUA (Least Privilege) context12. However, Scheduled Tasks suffer from abrupt termination upon system shutdown or user logoff, entirely lacking the SERVICE\_CONTROL\_PRESHUTDOWN drain capabilities of a native service. Furthermore, task definition security relies on the Discretionary Access Control List (DACL) applied to the XML definition file located in %SystemRoot%\\System32\\Tasks, which dictates update rights and executable replacement protections12. To prevent privilege escalation or unauthorized executable replacement, all executable paths within the Task XML must be safely quoted, and the parent directory of the binary must restrict write access to the executing user.  
The recommended initial production mode is the Windows Scheduled Task utilizing the S4U logon type. This approach avoids the administrative friction of installing custom SCM binaries, guarantees no password persistence, and perfectly aligns with the constraint of unprivileged user-controlled execution. The criteria for advancing to a reviewed Windows Service include empirical evidence that the P2P network severely penalizes the abrupt disconnection of nodes during system reboots, thereby necessitating the SCM's graceful shutdown signals. *\[Requires Local Confirmation\]*: Evaluate the P2P swarm's tolerance for abrupt TCP resets; if the protocol cannot handle sudden node disappearance, the development of a native Windows Service must be prioritized.

### **Recommended Windows Task Definition**

The following XML definition template provisions one of the lanes (Lane A) without persisting credentials, utilizing S4U for local execution and explicitly disabling battery-based execution constraints to ensure continuous availability.

XML  
\<?xml version="1.0" encoding="UTF-16"?\>  
\<Task version\="1.2" xmlns\="http://schemas.microsoft.com/windows/2004/02/mit/task"\>  
  \<RegistrationInfo\>  
    \<Description\>TinyRustLM P2P Seed Host (Lane A) \- Managed by Companion\</Description\>  
  \</RegistrationInfo\>  
  \<Triggers\>  
    \<BootTrigger\>  
      \<Enabled\>true\</Enabled\>  
    \</BootTrigger\>  
  \</Triggers\>  
  \<Principals\>  
    \<Principal id\="Author"\>  
      \<LogonType\>S4U\</LogonType\>  
      \<RunLevel\>LeastPrivilege\</RunLevel\>  
    \</Principal\>  
  \</Principals\>  
  \<Settings\>  
    \<MultipleInstancesPolicy\>IgnoreNew\</MultipleInstancesPolicy\>  
    \<DisallowStartIfOnBatteries\>false\</DisallowStartIfOnBatteries\>  
    \<StopIfGoingOnBatteries\>false\</StopIfGoingOnBatteries\>  
    \<ExecutionTimeLimit\>PT0S\</ExecutionTimeLimit\>  
    \<RestartOnFailure\>  
      \<Interval\>PT1M\</Interval\>  
      \<Count\>10\</Count\>  
    \</RestartOnFailure\>  
  \</Settings\>  
  \<Actions Context\="Author"\>  
    \<Exec\>  
      \<Command\>"C:\\Users\\Public\\TinyRustLM\\tinyrustlm-local-server.exe"\</Command\>  
      \<Arguments\>\--lane A \--port 5050\</Arguments\>  
    \</Exec\>  
  \</Actions\>  
\</Task\>

## **3\. Hardened systemd Unit Template and Rationale**

On Linux, systemd user units offer an optimal balance of autonomous background execution and unprivileged sandboxing. To ensure the seed host starts at system boot independently of user login sessions, the operator or installation script must execute the loginctl enable-linger \<user\> command15. This directive spawns the user manager at boot and prevents the destruction of the unit's resources and $XDG\_RUNTIME\_DIR upon logout, allowing long-running P2P services to persist across interactive sessions16.  
Designing a hardened user unit requires a nuanced understanding of systemd's sandboxing limitations. Because user units execute without root privileges, they cannot utilize kernel features that require unprivileged user namespace creation unless specifically enabled by the host operating system. Consequently, powerful sandboxing directives such as ProtectSystem=strict, ProtectHome=true, PrivateTmp=true, and DynamicUser=true are either silently ignored or explicitly unsupported in user-mode instances of the service manager19. The security posture must instead rely on directives that restrict the process's own capabilities rather than modifying the filesystem namespace.  
The NoNewPrivileges=true directive is universally supported in user units and is critical for security. It strictly prevents the binary and any spawned child processes from elevating privileges via setuid or setgid bits, neutralizing a broad class of local privilege escalation vectors20. The RestrictAddressFamilies=AF\_INET AF\_INET6 AF\_UNIX directive limits the network attack surface by explicitly denying the creation of exotic or raw socket types not required by the P2P networking stack22.  
For resource control, modern Linux distributions utilize unified control groups (cgroups v2). Systemd delegates these controls to user units, allowing precise governance over process behavior23. The MemoryMax directive establishes a hard upper boundary for RAM allocation; if breached, the kernel Out-Of-Memory (OOM) killer selectively terminates the lane23. MemoryHigh serves as a soft threshold, triggering aggressive memory reclamation and paging before the hard limit is reached, which gracefully throttles the service under extreme load23. CPUQuota governs execution time, ensuring the background hashing and tensor materialization phases do not monopolize the user's processor24.  
Temporary states, sockets, and local databases are managed via RuntimeDirectory and StateDirectory. RuntimeDirectory securely provisions an isolated directory under $XDG\_RUNTIME\_DIR that is automatically destroyed when the service stops, providing an ideal location for ephemeral PID files or Unix domain sockets21. StateDirectory provisions persistent storage under \~/.local/share/ ensuring that long-term data survives restarts without requiring hardcoded absolute paths in the unit file21.

### **Hardened systemd User Unit Template**

The following template implements the described constraints, utilizing Type=exec to ensure the service manager registers failures if the binary cannot be successfully invoked, rather than masking execution failures28.

Ini, TOML  
\[Unit\]  
Description\=TinyRustLM P2P Seed Host (%i) \- Managed by Companion  
Documentation\=https://mirust.com/implementation-operations/  
After\=network-online.target  
Wants\=network-online.target

\[Service\]  
Type\=exec  
ExecStart\="%h/.local/bin/tinyrustlm-local-server" \--lane %i \--port %i  
Restart\=on\-failure  
RestartSec\=10s  
StartLimitBurst\=5  
StartLimitIntervalSec\=120s

\# Security and Sandboxing (User-Unit Compatible)  
NoNewPrivileges\=true  
RestrictAddressFamilies\=AF\_INET AF\_INET6 AF\_UNIX  
LockPersonality\=true  
MemoryDenyWriteExecute\=true  
RestrictRealtime\=true

\# Resource Governance (cgroups v2)  
MemoryMax\=3G  
MemoryHigh\=2.5G  
CPUQuota\=200%  
IOWeight\=50

\# Lifecycle Directories  
RuntimeDirectory\=tinyrustlm-%i  
StateDirectory\=tinyrustlm-%i  
Environment\="TINY\_RUST\_LOG=info"

\[Install\]  
WantedBy\=default.target

## **4\. Install/Control State Machine with Idempotency Rules**

The lifecycle control companion must implement a strict, deterministic state machine to prevent race conditions and ensure idempotent execution across the user's environment. Executing the installation or configuration routine multiple times must result in the exact same fleet configuration without generating duplicate definitions, stranding orphaned files, or launching conflicting background processes.  
Idempotency heavily relies on atomic definition replacements. On Linux, writing the systemd unit directly to \~/.config/systemd/user/ can result in partial reads if the system manager attempts to parse the file during the write operation. The state machine must write the configuration to a temporary file (e.g., tinyrustlm@lane-a.service.tmp), utilize the atomic mv POSIX operation to overwrite the destination, and subsequently invoke systemctl \--user daemon-reload to flush the systemd cache29. On Windows, the XML payload is injected via the PowerShell Register-ScheduledTask \-Force parameter, which inherently overwrites existing definitions sharing the identical task name, bypassing the need for manual deletion and recreation30.  
The state machine implements a rigorous partial-install rollback protocol. If the installation fails at any intermediate stage—such as successfully registering Lane A but encountering a permissions error while registering Lane B—the machine immediately reverts the environment. It issues stop and delete commands for any registered definitions matching the current version block, effectively returning the system to its pre-invocation state. To facilitate this targeted rollback and eventual uninstallation, all generated definitions are explicitly tagged with ownership markers. On Windows, this is achieved by injecting a specific string into the \<Description\> block of the Task XML; on Linux, it is placed in the unit's Description= field. The uninstallation routine parses these metadata fields, proving mathematically that unrelated user services or third-party tasks cannot be inadvertently deleted.  
Missing-definition behavior is deliberately non-fatal. Commands requesting status, stop, or uninstall operations on a missing definition must return a successful (0) exit code, as the desired end-state has already been achieved. Repeated calls to start an already-running lane must likewise resolve safely without spawning duplicate PIDs. To guarantee safety during concurrent companion operations, the state machine acquires an exclusive local file lock (flock on Linux, exclusive file handle on Windows) to prevent simultaneous background upgrades and foreground user-initiated uninstalls. *\[Requires Local Confirmation\]*: Confirm the local filesystem utilized by the user's profile permits exclusive locking on the designated lock file path, particularly if the profile resides on a network-attached or roaming drive.

## **5\. Readiness and Restart Model**

Supervising the host processes requires a clear programmatic distinction between basic process health and network readiness. The P2P network cannot route traffic to a node simply because its Process ID (PID) exists; the node must have successfully initialized its memory allocations, parsed the .slm headers, and pre-bound its listening sockets.  
Pre-bind readiness mandates that each lane explicitly bind to its configured TCP endpoints before signaling readiness to the companion application. If a port conflict occurs due to a lingering socket from a previous crash or interference from a third-party application, the process must not enter a silent retry loop that consumes background CPU. Instead, it must exit immediately with a non-zero code, allowing the supervisor to apply its Restart=on-failure backoff logic28. The systemd StartLimitBurst prevents infinite crash loops by capping the number of restart attempts within a specific StartLimitIntervalSec window, preserving system stability32.  
Startup revalidation bounds the time required for a lane to become ready. Upon launch, the binary performs extensive header validation on the 108-byte header and 64-byte tensor entries of the SLM1 format33. It then calculates a custom non-cryptographic checksum to verify artifact integrity33. Transferring up to 128 MiB of artifact bytes into working memory and verifying these checksums requires measurable CPU cycles1. The service definitions grant a bounded startup window (e.g., 60 seconds) for the application to complete this long verification progress. If the timeout is breached, the supervisor considers the process deadlocked and issues a forced termination signal (SIGKILL on Linux, task termination on Windows).  
Upon receiving a graceful stop signal (SIGTERM), the process initiates a graceful listener drain. The node immediately halts the acceptance of new inbound P2P connections, completes the transmission of any active model pieces, and broadcasts a network-offline announcement to the swarm. A forced termination deadline acts as a backstop, terminating the process unceremoniously if the listener drain exceeds 20 seconds. Because the lanes are distinct services (@lane-a and @lane-b), a crash loop or prolonged validation inside Lane A remains entirely isolated from Lane B's supervisor state, preserving 50% fleet availability at all times.

## **6\. Resource-Budget Formulas and a 1/5/20-Model Capacity Table**

Resource governance is paramount to guarantee that the continuous background host does not aggressively consume the user's primary hardware, leading to uninstallation out of frustration. Memory limits must be rigorously computed using the exact code paths observed in the TinyRustLM Application Binary Interface (ABI) and the physical constraints of the SLM1 container format1.  
The total active memory footprint per loaded model consists of the forward scratch buffer, Key-Value (KV) cache, logits buffer, and the host transfer overhead.  
The underlying mathematical formulas dictating these allocations are defined as follows:

* **Forward Scratch**: ![][image1] bytes.  
* **KV Cache**: ![][image2] bytes.  
* **Logits**: ![][image3] bytes.  
* **Host Transfer Allocation**: A contiguous buffer accommodating the complete artifact bytes, capped at a hard transfer ceiling of 134,217,728 bytes (128 MiB)1.

For a standard TinyLM-16M-shaped specialist model, the baseline variable sizes yield the following precise allocations:

* Forward Scratch: ![][image4] bytes (\~47 KB)  
* KV Cache: ![][image5] bytes (\~8 MB)1  
* Logits: ![][image6] bytes (\~1 KB)  
* Transfer Allocation: Up to 128 MiB per transaction.  
* Model Disk Footprint: Approximately 32 MiB of mapped physical storage.

When a model is actively loaded into the runtime for P2P distribution, it requires an estimated 140 MiB of total working set memory. Because both lanes share read-only disk access to the downloaded .slm models, the physical disk budget does not duplicate per-lane. However, process memory, file descriptors, and upload bandwidth are heavily dependent on the number of concurrently admitted models and active network peers. The CPU spent hashing the artifacts during startup revalidation scales linearly with the parameter count and total file size, creating a direct cost for restarting a lane.

### **Capacity Sizing Table (Estimates)**

| Governance Metric | 1 Model (Estimate) | 5 Models (Estimate) | 20 Models (Estimate) |
| :---- | :---- | :---- | :---- |
| **Disk Storage Budget (Shared)** | 32 MiB | 160 MiB | 640 MiB |
| **Piece-Store Indexing Overhead** | \< 1 MiB | \~2 MiB | \~10 MiB |
| **Per-Lane Peak Memory** | \~140 MiB | \~700 MiB | \~2.8 GiB |
| **Total Fleet Memory (Both Lanes)** | \~280 MiB | \~1.4 GiB | \~5.6 GiB |
| **File Descriptors (Max Bound)** | 100 | 500 | 2000 |
| **Log Storage Budget (Rotated)** | 50 MiB | 100 MiB | 250 MiB |

*Note: The memory estimations represent a worst-case load wherein all admitted models are concurrently initialized and occupying the global runtime mutex. Caching, piece compaction, and the safe explicit purge of stale data will actively reduce the steady-state disk footprint.*

## **7\. Logging, Redaction, and Retention Contract**

Bounded, privacy-preserving diagnostics are critical for maintaining user trust. The companion application and runtime architecture must never assume the existence of a remote telemetry backend; all observability is strictly bounded locally, placing the burden of log management squarely on the host system.  
**Structured Event Schemas**: All diagnostic output is emitted as single-line JSON strings to stdout and stderr. This structured event schema ensures that subsequent parsing by local diagnostic tools or systemd's journalctl \-o json remains resilient against multiline parsing errors. Every significant network or processing event includes a correlation ID that tracks a P2P request from the initial connection handshake, through token generation, and to final teardown1. Per-lane status and import progress are distinctly labeled, ensuring that interleaved logs from both lanes can be easily separated.  
**Redaction Contract**: Before serialization, the logging abstraction aggressively redacts Uniform Resource Identifiers (URIs). Any user:password@ components in internal connection strings or proxy configurations are irrevocably masked. Internal memory pointers, explicit prompt text content processed by the models, and cryptographic payload bytes are strictly defined as "secret-like" fields and are denied from the log output by design. Native error preservation ensures that underlying OS error codes (e.g., EADDRINUSE or ENOSPC) are captured without modification, providing reliable crash evidence.  
**Rotation and Retention**: On Linux, stdout logging relies on the host's systemd-journald daemon, which governs its own rotation via journald.conf parameters (e.g., SystemMaxUse)34. The service unit should explicitly define a LogsDirectory if independent rotation is desired, allowing systemd to manage ownership safely without recursive permission issues35. On Windows, the Scheduled Task operator runbook directs standard output to a dedicated rolling text file appender managed by the executable itself, retaining a finite number of historical log files. *\[Requires Local Confirmation\]*: Validate the maximum allowable disk space for background text log persistence on Windows to perfectly calibrate the rolling file appender size limits, preventing silent disk exhaustion.

## **8\. Upgrade/Rollback Procedure**

The operational upgrade mechanism must strictly avoid taking both lanes offline simultaneously, ensuring continuous P2P seeding availability. To achieve this, the upgrade utilizes side-by-side version staging and sequential lane restarts.

1. **Side-by-Side Version Staging**: The companion downloads the new runtime binary and executes a package hash check, validating the SHA-256 hash against the published release manifest. The binary is written to a distinct, side-by-side directory path containing the version number (e.g., \~/.local/bin/tinyrustlm-v1.2.0/). This eliminates executable file-lock contention and ensures the old binary remains intact for immediate rollback.  
2. **Lane A Draining**: The operator sequence issues a stop command targeting only Lane A. Lane A triggers its graceful listener drain, finishes pending P2P transfers, and halts. Lane B continues serving the swarm uninterrupted.  
3. **Configuration Compatibility**: The installation state machine parses the existing configuration to confirm compatibility with the new version. Lane A's systemd service or Windows Task definition is updated to point to the newly staged binary path.  
4. **Lane A Start & Native ABI Compatibility**: Lane A is started. The process maps the existing .slm artifacts (preserving model bytes) and attempts to bind to its ports. The companion queries Lane A's local /health endpoint to verify native ABI compatibility, successful initialization, and port readiness.  
5. **Rollback After Failed Readiness**: If Lane A fails readiness, reports incompatible model bytes, or crashes during startup revalidation, the state machine immediately reverts Lane A's service definition to the previous version's path. It restarts Lane A on the known-good binary and aborts the upgrade sequence entirely. Lane B remains untouched, and an error is surfaced to the user.  
6. **Lane B Upgrade & Revocation**: Upon confirming Lane A's health and successful integration into the swarm, the operator sequence is repeated for Lane B. Stale P2P announcements linked to the old process sessions are systematically revoked prior to final shutdown to prevent routing blackholes in the peer network.

## **9\. Failure-Mode and Recovery Matrix**

| Failure Mode | Diagnosis / Crash Evidence | Operator Recovery Action |
| :---- | :---- | :---- |
| **OOM (Out of Memory) Event** | SIGKILL from cgroups (Linux) or sudden process exit; visible in dmesg or journal. | Check MemoryMax limit. Execute explicit data purge for stale models. Lower concurrent connection limits. |
| **Pre-Bind Port Failure** | Immediate exit code 1; EADDRINUSE preserved in structured logs. | Increment port configuration in task XML/systemd unit; reload configuration and restart the lane. |
| **Corrupted .slm Artifact** | Checksum validation failure during tensor materialization or header parsing33. | Quarantine the specific model artifact. Delete the corrupted .slm and trigger a fresh download. |
| **Global Mutex Deadlock** | /health endpoint times out continuously; active memory remains high1. | Issue a forced termination (SIGKILL). The supervisor's Restart=on-failure handles the recovery. |
| **Failed Connect Approval** | LocalEndpoint connect rejection in logs; zero inbound P2P connections. | Review user-visible firewall prompts or permissions specifically for the executable path of the affected lane. |
| **Disk Exhaustion** | ENOSPC during piece store accounting; log rotation failures. | Execute explicit data purge runbook. Compact log retention. Evict least-recently-used (LRU) models. |

## **10\. Detailed Operator Runbooks**

The following runbooks provide explicit narrative procedures for local operators managing the fleet's lifecycle.  
**Runbook 1: First Install and Service Provisioning** To provision the host environment, first extract the cryptographically verified binaries to a permanent user-owned path, such as \~/.local/bin/ (Linux) or %LOCALAPPDATA%\\TinyRustLM\\ (Windows). On Linux, place the systemd unit templates into the user's configuration directory at \~/.config/systemd/user/. Execute systemctl \--user daemon-reload to register the units, and enable background persistence via loginctl enable-linger $USER15. Start both lanes sequentially. On Windows, utilize PowerShell to pipe the Task XML template directly into the Register-ScheduledTask cmdlet, specifying the S4U principal and forcing overwrites30. Verify that the task status indicates readiness.  
**Runbook 2: Adding the First Model and Verifying Local Health** Download the .slm model and verify its 108-byte header and 64-byte tensor alignment offline. Move the artifact into the shared read-only models directory. Trigger the local /reload loopback endpoint on Lane A. Monitor Lane A's structured JSON logs to confirm successful tensor materialization and KV cache allocation1. Once Lane A validates the custom checksum, query the http://127.0.0.1:\<port\>/health endpoint to obtain local health status. Upon receiving a 200 OK response containing the runtime state, repeat the reload trigger for Lane B.  
**Runbook 3: Configuring Ports and Rotating URLs** If local port exhaustion occurs or a conflict arises, edit the \--port argument in the service definition. For Windows, execute Set-ScheduledTask with the modified action block. For Linux, edit the specific user unit and execute systemctl \--user daemon-reload. Issue a drain command to the affected lane, wait for the process to exit, and restart the service to apply the new socket binding. To rotate URLs, update the companion's manifest mapping and trigger a metadata reload.  
**Runbook 4: Obtaining Outside Proof and Responding to Disk Pressure** To verify swarm participation, query the public P2P network index from an external connection to prove that the node's public IP and rotated port are actively broadcasting piece availability. When local disk thresholds are breached, halt Lane B to release file locks on the model directory. Execute the explicit data purge tool to delete deprecated .slm models and stale runtime pieces from the shared volume. Verify the reclaimed storage budget, then restart Lane B.  
**Runbook 5: Handling a Failed Lane and Revoking a Model** If Lane A enters an infinite failure loop, interrogate local diagnostics using journalctl \--user \-u tinyrustlm@lane-a.service. If the evidence points to a corrupted model transfer, immediately quarantine the artifact and issue a revocation command to remove the model from the active manifest. If the failure is a hung process due to a mutex deadlock, manually send a forced termination signal. Ensure Lane B remains active throughout the troubleshooting process to maintain seeding capacity.  
**Runbook 6: Uninstalling and Explicit Data Purge** To cleanly remove the fleet, issue graceful stop commands to both lanes. Unregister the Windows Tasks via PowerShell or execute systemctl \--user disable for the Linux units. Remove the binary payload directories. By default, model artifacts are retained to respect user data ownership. To execute an explicit data purge, the operator must pass the \--purge-models flag to the uninstall script, which recursively deletes the shared model directory. Ensure no other applications maintain file locks on the .slm pieces prior to deletion.

## **11\. Automated Test Plan for Windows and Linux**

Automated continuous integration tests must validate the operational boundaries of the runtime on both operating systems prior to release.  
**Windows Testing Matrix:**

1. **Idempotent Injection**: A script repeatedly invokes Register-ScheduledTask with the XML payload. The test asserts that exactly one task exists in the Task Scheduler, proving that atomic definition replacement prevents duplicates30.  
2. **Account Validation**: Assert that the task's LogonType is successfully mapped to S4U and that the execution token correctly lacks Windows domain authentication privileges but successfully binds a local TCP socket for P2P routing10.  
3. **Restart Limits**: Inject a faulty binary path into the definition. Assert that the SCM triggers the RestartOnFailure interval and correctly halts execution after the specified retry count is exhausted.

**Linux Testing Matrix:**

1. **Unit Validation**: Execute systemd-analyze verify \~/.config/systemd/user/tinyrustlm@lane-a.service to structurally validate the syntax and directive compatibility of the generated unit files.  
2. **Sandboxing Enforcement**: Assert that the process executes under strict NoNewPrivileges=true by attempting a deliberate privilege escalation via a mock setuid binary within the test harness20.  
3. **Linger State**: Assert that executing loginctl show-user $USER \--property=Linger correctly returns Linger=yes, proving that the background daemon survives session termination15.  
4. **Resource Thresholds**: Inject a synthetic workload that artificially inflates the KV cache allocation beyond the defined parameters. Assert that the cgroups limit (MemoryMax) successfully intercepts and terminates the specific lane without impacting the parallel second lane or the host operating system23.

## **12\. Local Facts Still Needed**

The implementation requires the following dynamic environment constraints to be explicitly verified by the local operator before finalizing the fleet initialization sequence:

* *\[Requires Local Confirmation\]*: Does the target Windows environment permit the execution of Scheduled Tasks using the TASK\_LOGON\_S4U logon type while connected to the required network topology, or do local group policies prohibit restricted token generation?  
* *\[Requires Local Confirmation\]*: Confirm the local firewall policies allow inbound TCP port binding for the chosen endpoints (e.g., 5050/5051) without requiring elevated interactive User Account Control (UAC) prompts, as the installation routine operates without administrative rights.  
* *\[Requires Local Confirmation\]*: Verify that the host's primary filesystem permits exclusive locking on the state machine's lock file to prevent race conditions during updates, particularly if the user profile resides on a network-attached or roaming drive.  
* *\[Requires Local Confirmation\]*: Verify the maximum allowable disk space for text log persistence on Windows to perfectly calibrate the rolling file appender size limits, preventing silent disk exhaustion over long uptimes.  
* *\[Requires Local Confirmation\]*: Determine whether the specific P2P swarm heavily penalizes abrupt network disconnects. This metric dictates the urgency of migrating from the Windows Scheduled Task architecture to a native Windows Service equipped with SERVICE\_CONTROL\_PRESHUTDOWN drain capabilities.

## **13\. Direct Links to Current Official Platform Sources with Dates**

* **systemd documentation**: systemd.exec execution environment configuration. Retrieved July 13, 2026\. https://www.freedesktop.org/software/systemd/man/systemd.exec.html36.  
* **systemd documentation**: loginctl control manager. Retrieved July 13, 2026\. https://www.freedesktop.org/software/systemd/man/loginctl.html16.  
* **systemd documentation**: systemd.resource-control cgroups and limits. Retrieved July 13, 2026\. https://www.freedesktop.org/software/systemd/man/systemd.resource-control.html24.  
* **systemd documentation**: systemd.unit common configuration options. Retrieved July 13, 2026\. https://www.freedesktop.org/software/systemd/man/systemd.unit.html37.  
* **Microsoft documentation**: Task Scheduler Logon Types (TASK\_LOGON\_TYPE). Retrieved July 13, 2026\. https://learn.microsoft.com/en-us/windows/win32/api/taskschd/ne-taskschd-task\_logon\_type10.  
* **Microsoft documentation**: Windows Service Control Handler (SERVICE\_CONTROL\_PRESHUTDOWN). Retrieved July 13, 2026\. https://learn.microsoft.com/en-us/windows/win32/services/service-control-handler-function6.  
* **MiRust documentation**: TinyRustLM Implementation Operations and limits. Retrieved July 13, 2026\. https://mirust.com/implementation-operations/1.  
* **MiRust documentation**: SLM1 Container Format and Header definitions. Retrieved July 13, 2026\. https://mirust.com/implementation/33.

#### **Works cited**

1. Implementation operations \- MiRust, [https://mirust.com/implementation-operations/](https://mirust.com/implementation-operations/)  
2. Windows service \- Grokipedia, [https://grokipedia.com/page/Windows\_service](https://grokipedia.com/page/Windows_service)  
3. Windows with C++: Windows Services Enhancements | Microsoft Learn, [https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/launch/windows-with-c-windows-services-enhancements](https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/launch/windows-with-c-windows-services-enhancements)  
4. LPHANDLER\_FUNCTION\_EX (winsvc.h) \- Win32 apps | Microsoft Learn, [https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nc-winsvc-lphandler\_function\_ex](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nc-winsvc-lphandler_function_ex)  
5. Shutdown & Teardown · aelassas/servy Wiki \- GitHub, [https://github.com/aelassas/servy/wiki/Shutdown-&-Teardown](https://github.com/aelassas/servy/wiki/Shutdown-&-Teardown)  
6. Service Control Handler Function \- Win32 apps | Microsoft Learn, [https://learn.microsoft.com/en-us/windows/win32/services/service-control-handler-function](https://learn.microsoft.com/en-us/windows/win32/services/service-control-handler-function)  
7. schtasks create \- Microsoft Learn, [https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-create](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-create)  
8. Make Scheduled Task Accessible to Non-Admins | Page 2 | Windows 11 Forum, [https://www.elevenforum.com/t/make-scheduled-task-accessible-to-non-admins.37949/page-2](https://www.elevenforum.com/t/make-scheduled-task-accessible-to-non-admins.37949/page-2)  
9. Will the job scheduled in Windows Task Scheduler continue to run if the password of the system account who set up the job expires or changes? \- Microsoft Learn, [https://learn.microsoft.com/en-us/answers/questions/3850707/will-the-job-scheduled-in-windows-task-scheduler-c](https://learn.microsoft.com/en-us/answers/questions/3850707/will-the-job-scheduled-in-windows-task-scheduler-c)  
10. TASK\_LOGON\_TYPE (taskschd.h) \- Win32 apps | Microsoft Learn, [https://learn.microsoft.com/en-us/windows/win32/api/taskschd/ne-taskschd-task\_logon\_type](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/ne-taskschd-task_logon_type)  
11. Principal.LogonType property \- Win32 apps | Microsoft Learn, [https://learn.microsoft.com/en-us/windows/win32/taskschd/principal-logontype](https://learn.microsoft.com/en-us/windows/win32/taskschd/principal-logontype)  
12. Security Contexts for Tasks \- Win32 apps | Microsoft Learn, [https://learn.microsoft.com/en-us/windows/win32/taskschd/security-contexts-for-running-tasks](https://learn.microsoft.com/en-us/windows/win32/taskschd/security-contexts-for-running-tasks)  
13. Create a scheduled task natively \[AHK\_L\] \- Scripts and Functions \- AutoHotkey Community, [https://www.autohotkey.com/board/topic/61042-create-a-scheduled-task-natively-ahk-l/](https://www.autohotkey.com/board/topic/61042-create-a-scheduled-task-natively-ahk-l/)  
14. Ultimate Guide to Windows Task Scheduler Hardening \- CalCom Software, [https://calcomsoftware.com/task-scheduler-windows-hardening-guide/](https://calcomsoftware.com/task-scheduler-windows-hardening-guide/)  
15. How to Use loginctl enable-linger for Rootless Podman Services \- OneUptime, [https://oneuptime.com/blog/post/2026-03-17-use-loginctl-enable-linger-rootless-podman/view](https://oneuptime.com/blog/post/2026-03-17-use-loginctl-enable-linger-rootless-podman/view)  
16. loginctl \- Freedesktop.org, [https://www.freedesktop.org/software/systemd/man/loginctl.html](https://www.freedesktop.org/software/systemd/man/loginctl.html)  
17. org.freedesktop.login1, [https://www.freedesktop.org/software/systemd/man/org.freedesktop.login1.html](https://www.freedesktop.org/software/systemd/man/org.freedesktop.login1.html)  
18. logind.conf \- Freedesktop.org, [https://www.freedesktop.org/software/systemd/man/logind.conf.html](https://www.freedesktop.org/software/systemd/man/logind.conf.html)  
19. systemd/Sandboxing \- ArchWiki, [https://wiki.archlinux.org/title/Systemd/Sandboxing](https://wiki.archlinux.org/title/Systemd/Sandboxing)  
20. NoNewPrivileges setting \- Linux Audit, [https://linux-audit.com/systemd/settings/units/nonewprivileges/](https://linux-audit.com/systemd/settings/units/nonewprivileges/)  
21. systemd \- does the \`DynamicUser\` option work with user units and if so, how?, [https://unix.stackexchange.com/questions/714819/systemd-does-the-dynamicuser-option-work-with-user-units-and-if-so-how](https://unix.stackexchange.com/questions/714819/systemd-does-the-dynamicuser-option-work-with-user-units-and-if-so-how)  
22. How to Configure systemd Service Sandboxing on Ubuntu \- OneUptime, [https://oneuptime.com/blog/post/2026-03-02-configure-systemd-service-sandboxing-ubuntu/view](https://oneuptime.com/blog/post/2026-03-02-configure-systemd-service-sandboxing-ubuntu/view)  
23. How to Configure Resource Limits for Services Using systemd Cgroups on RHEL, [https://oneuptime.com/blog/post/2026-03-04-configure-resource-limits-systemd-cgroups-rhel-9/view](https://oneuptime.com/blog/post/2026-03-04-configure-resource-limits-systemd-cgroups-rhel-9/view)  
24. systemd.resource-control \- Freedesktop.org, [https://www.freedesktop.org/software/systemd/man/systemd.resource-control.html](https://www.freedesktop.org/software/systemd/man/systemd.resource-control.html)  
25. Using systemd-run to limit something's memory usage in cgroups v2, [https://utcc.utoronto.ca/\~cks/space/blog/linux/SystemdForMemoryLimitingII](https://utcc.utoronto.ca/~cks/space/blog/linux/SystemdForMemoryLimitingII)  
26. Dynamic Users with systemd \- 0pointer.net, [https://0pointer.net/blog/dynamic-users-with-systemd.html](https://0pointer.net/blog/dynamic-users-with-systemd.html)  
27. Difference between CacheDirectory and StateDirectory in systemd, [https://unix.stackexchange.com/questions/804693/difference-between-cachedirectory-and-statedirectory-in-systemd](https://unix.stackexchange.com/questions/804693/difference-between-cachedirectory-and-statedirectory-in-systemd)  
28. systemd.service \- Freedesktop.org, [https://www.freedesktop.org/software/systemd/man/systemd.service.html](https://www.freedesktop.org/software/systemd/man/systemd.service.html)  
29. puppet/systemd · Puppet Systemd module \- Puppet Forge \- Perforce Puppet, [https://forge.puppet.com/modules/puppet/systemd/readme](https://forge.puppet.com/modules/puppet/systemd/readme)  
30. Register scheduled task from XML source \- Stack Overflow, [https://stackoverflow.com/questions/42325801/register-scheduled-task-from-xml-source](https://stackoverflow.com/questions/42325801/register-scheduled-task-from-xml-source)  
31. Register-ScheduledTask \- Microsoft Learn, [https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/register-scheduledtask?view=windowsserver2025-ps](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/register-scheduledtask?view=windowsserver2025-ps)  
32. Systemd Service Settings – Posit Chronicle Admin Guide, [https://docs.posit.co/chronicle/appendix/library/systemd-service-settings.html](https://docs.posit.co/chronicle/appendix/library/systemd-service-settings.html)  
33. Implementation \- MiRust, [https://mirust.com/implementation/](https://mirust.com/implementation/)  
34. journald.conf \- Freedesktop.org, [https://www.freedesktop.org/software/systemd/man/journald.conf.html](https://www.freedesktop.org/software/systemd/man/journald.conf.html)  
35. LogsDirectory{Owner,Group} and LogsDirectoryFileMode required \#28876 \- GitHub, [https://github.com/systemd/systemd/issues/28876](https://github.com/systemd/systemd/issues/28876)  
36. systemd.exec \- Freedesktop.org, [https://www.freedesktop.org/software/systemd/man/systemd.exec.html](https://www.freedesktop.org/software/systemd/man/systemd.exec.html)  
37. systemd.unit \- Freedesktop.org, [https://www.freedesktop.org/software/systemd/man/systemd.unit.html](https://www.freedesktop.org/software/systemd/man/systemd.unit.html)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAaCAYAAAD43n+tAAAB60lEQVR4Xu2WvyuFURjHH/lRopRELCQGSZGQZFBWBmWzMwmFMihkEBYZhIEUizIZLLql/AEWk4FFKRsG5cf367xv99znXvee9711p/Opz3Df5/S+53vPec77ing8nnypgTfwx/ITDltjyuCZGrNg1QtJEZyBU7qgGREz0WNdCCiGp3AJlqpaIemD73BRFzTdYgaewxJVI7zRCSzXhQJSBa/F/PE5AzXDZ5iAlamlvxBHsEtdz0Z14H9wxRvEbCEXOG4OborjCtXBB/gI61VtAq6I+8NJK7yAjbogZssuw3lxvyd3yBbsF8dAXJUEfIVt1vUmMROrta650gmvJDVUnDDcavti5hK2Rs5A7Bv2zwfsCa7xgRtwNBwUAztUnDAcNwvHg9/OgcihmIbjiUcG4a7kf6oxFJv5QKKFIb1wW5JziBSIgxiIzcdl5runJWVEPDiZHTE9ysPHFbbBnpitFhIp0JiYQOtiQk2mlmPBMDyZuDLt8FIyHxSZ6IB38MnyRcwc34Lf9gdAGix+w3sx7xx9fEfFDhNuMx44UUJpIq1QOJjymMwHhuGBwobWPZNPKB5YPLj4xZITvn/4HlqT9ElEZQhOy//3YW+uivlOdIGvjVv4JcnvSW6/rFuO/+oArNAFj8fj8Xg8ufkFMKBdS1jyMOoAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD0AAAAZCAYAAACCXybJAAACtElEQVR4Xu2WS6hNURjH/0IReZRIlMPMQJKQMrgDBgZSXilDiZlHSZQMZORSHgMhMvJIJkpGUiSlFGWi1KVQioGQksf/33eWs+631zpn7XMnHvtXv+7de+211vet/e2zFtDQ0PA/MJlepAuiexPb97bQ2XSmc0rn0WJG00205e4HJtGd9Cw9CJunG6PoLrrDN/RCHffTz3RxdF8TvqQ/M57sPNqV8XQNPUFfozpPYA59QrfRcXQ1fU6Xxg85lsHG2+cbeqGOH1ANRv8/hq167E36DBZkCUpaCQzQQ6jOI8bQ8/R6+//AEXobNoZH1XkH9gJqJa2O52DJ+GD0drZH12IsPUNXufulKDg/j5hH36Ia/Dqkn1d17qFHUfNNh47rkQ5mPp0VXQstwl5Y335IzSNW0h+oBq+F15vU70qMqnOQLkfNpPWtHIO9vVwwMYvoDVh19EtunpCcDz51X/OrMluwcYqTjjuKXDABLcxVutk31CQ3j+775IRPWhW2m25sXxcn7TuKXDABldEQrORHQm4efWYlScfVKYqTVpnGHUUuGKFFOk0f0amurS65eXxyqfs6N+hHtBW1FyetjfyV8xNs8Hf0Hp3++2lgGmyLugubeCTkkl5Bv6EafEhav+I6OD3F8LgVr9oVv671g1hMLhixkH5EdQ8N6JSlRdKBohe5ebRLDKF64NFu8R75z6r4Tac4QL/QJb4Bne3kkm9osxW22peRXpQYBZeaR5/QYfoQnd1Bn981dB9X42g8xV+MEgolIr/TBxhe3jpNqS2XtErwK32B9Fl5Ar0CO/WFeeQbejx6Tsnegu0SmvMCvQ8793sUn+JUvGE85VGrvLuhFR9AOqGASvsUneEbaqJPRSW7of1X138sc2EnpFwZ/nPobSjhfs/jfyUq+7Xo/zze0NDQUItfyouti9qnltAAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAAAZCAYAAACxZDnAAAAE3UlEQVR4Xu2YaahvYxTGHyFk7hqLLuIaCykiwyFjIiH3dokbGdKNECLEBx+IlESkriFDiGQIn0whbqRMGRIZQojygTI8v7ve1X7/++xzzj73f8Kp/dTTPe/+v3u9a613TftKAwYMGDBgPmA9c6l5l3mjuZu5xsiOftjIvFAh5zpzkbrl7Kw4h32nmeuP/rwKtayrzW1Hf54VallXlnUNdNzPvNW83TzWXHNkR2AsnTY2HzdPN7c29zRfNi9Rt5OmAu+9aE6Ym5rnmn9ospyTzEfMXc1tzAvMt8yF1R7+ft48WqHThPmueWK1py8OMz9RY9+lCnsJLoBul5kvmdubC8wHFM5cu+wBY+u0XHHLNfYw31Ec3BdEw5/m8WWNs3Hgjwqngi3N5xQOTmDobea1rXXbAAwkAAiMvtjd/NpcXNac/5n5hcJZYB/zO/PAsgY7KPZwJpgTne41b9Bo1KEEjiZK++Jm82/zrLLe0HzF/FWNHIz6yNyprBOXm3eXvzdQZMay/LGAd1cqnNUHaylkvm9uVp5h46nmmeV3cL1GHQ9S9xWKd+ZEJw7CQURk1koi4BnFAX1BmmFQ1jay4meFgimHSPnW/NQ8pDwjGl5Qkwk44DFF2SHNkYuxV5h3lN/7gGz8SiFrHXMLRVmoA2pdhZ1tR6djyUgyc050ovZ8rHA2DsDx3GZdM2cLmgZ17ktzr+o5ylEPOQsSMU9qch3fV3FJ7HnTvMV8Qj1TtOBw8y/zafNO82LzIfNVNaUrHTqVo+vnc6HTqhqKU9IBlJN2Z+4DMuJhhSxq4VGa3L1ZZxbBH8wjNLnxHmr+rmbfNWoaWB8cp3jvN0WKAyIR55BBOBMn4sw+jgZj6cTtEsFMCXRmFEPIa4pUW13sYn5j3q+mJOHM5QpDD1BEM2fRRDk7QRa8bZ6gSE9+Z9996m9YOprSQIlI0A+IdCK+qzmCLkePpRMbnlIcnsDx6QCcsrrAqZQP5JxXnhG576mZP4nupYrL/VBhOLUUg+oOz1xPc8ZBOQnMhGPUZGcNbOU5/3Y5FLSfj60T0wD1OcevBBfAGNZWciqQkhcV1rNnGpVymAJoum2g6E+KFMdBXEZOCgkugcuog2I6YBsTT9uG2tHZ5KZyNJnOBDK2Thj2gWIaaIPZunYKh7e7dgI5RGVdDwFGYlTKYU19boMsWqm4cFI+u32NzBBKXGKTwi7QpN5QOLKeCurSket61gc4lLEw9Z6NTp3AedRLak7twM0VN7p/WeNgvoJoBPmsBqWAr6971HRh3qE706n3Ls8Y4TBgu7IGnLvMfFDhEJzOWYurPYCa/7qajyg+4/nQYITLZ21QssjYLFXtZgh2VMhYUtbgIPN7Nbb21WlacBBCOJxhnkjGGTSndD5KPauIBObILpBejId8/KA0TeiX8jxBTWa8I4KuUpz3qOLTdqtqHwYyb9NokIVMUpTP6UQaj05EXBdowisU9fUMxXjHOwvrTYra+7l5jmIfWX6+RoOvj04zAgeQ8iebR6r7P3kA6TZdg6S7TyjkHKzRel2DaMc57Fuk7nLEu8iYSdbZGr3MNpDNGTPJSZ3gVNNWX53GBtHYVTr+K1BqblLP1J0voIszNcw4M/6LYFohhbsyYt6ClMpP1/8DiOZTNMtP4AEDBgwYMKDGP2GWJO05196pAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAZCAYAAABzVH1EAAACZklEQVR4Xu2WT4iOURTGH6GISIomysfCn4UoMZlkZWNhmvwpYSuSUgqlrDSlaWxs1JCyEKbZmpQaioWyolBKzUisWLFA/jxP572577n3++adma8v6n3q1/e95773nnPuve+5F6hVq9ZU1SAHvXEKmk8OkSEyQNaVm7Pqg73rtYicgo11gXSVm1NtICfIGPlJbpabK2sxeUAukoVkM3lF9sUvOTXIW6Q+V5Hn5CiZR3aTN2Rb/JKXEtGs9JD3SAetqnPkGVkS2Q6T12R5ZAuaS66T3yj7nFPYR4r/Qf3kPmzVW0pLN4HpJaLglYTvu5V8Ib3OLh0gl5FO3hryETYxsfaSr2SLsyeaSSJa1U9I+8qpnGs2YzVge389Up+7yC+kieyBrZ5WuaVmkkgI2PfN2bWlBkk38j5DwM0S8fZEuUGrKjjxfXOJ6OM/TWYh71OB5gLuSCKqKlUSUTW6BqtwUs6nkswF3JFEfMA5uyrQJdiWCsr5bBZwM3ui3KBVFSqN7xsSOU+WkcfkXcQHWHDfi+fjZAf5gTTgkIiqV0tNlogOuaWwve2ltkfkHuwAC1IFUpD6zSnncwUZJ1cim3QMVhlVIVsqDHoLabBKQCftN7LdtQUdgc3q6uJZY+iUf4q/34TXStg5EvvM9VOlGya3UT4kS9JsaTBdT7R0QofYC7KxeEczPgqr72cKm5ecXSUPYTcFBfMSdlXxWkDuwFYr+PwM21qSEpC/u7BCcoM8gSXeFinpk94YSbO5luwnO2HJTVezYd+YxtKvntums2i+tf4bbYJd5ia9tP3rUvlr2x6tVatW5/QHl/eVxRYuSj8AAAAASUVORK5CYII=>
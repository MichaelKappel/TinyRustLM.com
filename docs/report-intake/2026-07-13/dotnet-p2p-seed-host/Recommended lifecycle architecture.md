# Recommended lifecycle architecture  
The TinyRustLM companion runs two identical “lane” processes that load shared model files but maintain independent state, endpoints, and shutdown identity.  In production, each lane should be run as a managed service: on Windows, a dedicated Windows Service (or, in restricted scenarios, a Scheduled Task) and on Linux a `systemd` unit (user‑mode by default, or system‑mode if needed).  Both lanes must be started automatically (at system boot for services, via the Task Scheduler “At startup” trigger for tasks) without requiring a user login.  They must pre-validate and bind all configured endpoints before accepting traffic.  The service should mark itself “ready” only after full initialization (for example via systemd’s `Type=notify` or similar readiness signaling).

Key principles in the architecture: 
- **Two independent lanes**: Name them (for example) `tinyrustlm-lane1` and `tinyrustlm-lane2`, with distinct service definitions and runtime directories. Each reads from the same read‑only model repository and piece-store, but operates independently so one lane can crash or restart without taking down the other.  
- **Least privilege**: Run under a dedicated unprivileged account (Windows: e.g. “LOCAL SERVICE”/“NETWORK SERVICE” or a specific local user; Linux: a non-root user with minimal rights). Neither lane should log in as an administrator/root.  On Windows the default service account is LocalSystem (with full privileges), so explicitly configure a lower‑privilege account. On Linux, use `User=` and `Group=` in the unit file, and consider `DynamicUser=` if appropriate.  
- **Resilience and recovery**: Use built-in service recovery (restart) mechanisms to keep a lane running 24/7. Schedule automatic restarts on failure (e.g. systemd’s `Restart=on-failure`, or Windows Service recovery actions). The companion should **not** persist any credentials in its config or logs, and should not open any management/control ports by default.  
- **Platform integration**: On Windows, register each lane as a startup service so it begins at boot (the `start=auto` service type runs even if no user logs on). On Linux, enable the user-level service (in `~/.config/systemd/user`) and use `loginctl enable-linger $USER` so it survives logout, or install as a system unit under `/etc/systemd/system` if no login is expected.  
- **Idempotent control**: The installer and service scripts must handle repeated runs safely – they must detect existing installations (using expected file paths, lock markers, or systemd “Status” queries) and skip or undo steps as needed. Likewise, an uninstall should remove only those service/​task definitions that it created (e.g. by prefix or a recorded list) and stop both lanes, without touching the shared model files. 

In summary, the recommended architecture is two identical managed services/units (one per lane), auto-starting at boot, running under minimal privileges, with complete process supervision. Windows Services are preferred for production (being designed for always‑on workloads), with Windows Scheduled Tasks used only where service installation is impossible.  Criteria for adding a Scheduled Task mode include: lack of admin privileges to create a service, or a need to tie startup to a specific user’s logon. Otherwise, use the Windows Service mode first for robustness.

## Windows mode comparison and recommended definition  
Windows Services and Scheduled Tasks behave similarly from the user’s perspective (neither is visible to non-admin users), but there are important differences:  

- **Startup trigger**: A Windows Service with `start=auto` will start at boot before any user logs in. A Scheduled Task can be configured to run at system startup or at user logon.  In practice, services offer “always‑on” startup at boot; tasks typically fire on logon or other events.  
- **Account identity**: Services and tasks can both run under various accounts. By default a service runs as `LocalSystem` (full privileges), whereas a task can run as SYSTEM or as any user. In either case, it’s best to run as a low-privilege account: e.g. use a service account like “NT AUTHORITY\LocalService” or a custom local user.  Task Scheduler 2.0 (Vista+) supports `LOCALSERVICE` and `NETWORKSERVICE` contexts.  
- **Least privilege**: Both can be locked down (using ACLs for tasks or service security descriptors, and proper user/group assignment). Experienced admins note that Windows Services are generally easier to set up with correct permissions and more “visible” for techs to find.  In either case, configure “log on as this account” rights and remove unnecessary capabilities.  
- **Service recovery**: Services have native recovery options (restart, run a program, etc.) configurable in the Service Control Manager. Scheduled Tasks were originally designed for one‑time or periodic runs, but Task Scheduler 2.0 allows some failure action (e.g. “Restart the task if it fails”). Both can be set to retry on failure.  
- **Session isolation and interactivity**: Services run in Session 0 and have no desktop interaction (good for background work). Tasks can be set to “Run whether user is logged on or not” (running in a hidden session) or “Run only when user is logged on” (which allows UI). For a headless workload, use non-interactive (no UI).  
- **Graceful shutdown**: Windows Services have `OnStop` handlers and a 30s timeout by default for graceful exit. Stopping a service invokes its shutdown routine. Ending a scheduled task (`schtasks /End`) simply kills its process with no graceful shutdown. This means services can drain resources more cleanly.  
- **Configuration file format and security**: Scheduled Tasks are stored as XML files under `C:\Windows\System32\Tasks` with security descriptors. Services are registered in the SCM database/registry. Both require admin rights to create or modify when using system-wide options. Care must be taken to quote paths in SCM (`binPath=...`) and in task XML; both tools require space after `binPath=` or `/TN`.  
- **Executable replacement and working directory**: In both cases, the process binary is typically locked while running. Safe updates must stop the service/task before replacing the executable. By default services start with `C:\Windows\System32` as the working directory; tasks usually inherit the program’s folder or allow a “Start in” field. Explicitly set a working directory in the service/task definition if needed.  
- **Network readiness and firewall**: A service marked “auto” can specify `delay-auto` start if it depends on networking; tasks have no native “network available” trigger (you can work around by delaying startup). If the lane opens a listening port, Windows may prompt to allow firewall access. Including a firewall rule in the service installer can suppress prompts.  
- **Code signing and updates**: Services should run code-signed binaries to avoid integrity issues during updates, but it is not strictly required. Scheduled tasks simply launch executables, so as long as the binary is trusted, tasks themselves do not add additional requirements. Both modes require admin/admin-equivalent privileges to perform upgrades or to reconfigure.  
- **User-facing controls**: A new Windows Service appears in `services.msc` or `Get-Service`, and can be started/stopped by admins. Scheduled Tasks appear in Task Scheduler UI or via `schtasks`. Services are usually easier for non‑technical users to locate as “the usual place” for daemons.

**Recommendation:** Use a **Windows Service** as the primary production mode, since it is designed for 24/7 background operation and offers built‑in stop/restart management. Configure it with `start=auto` so it runs at boot (no login needed). Only consider offering a Scheduled Task alternative if customers cannot install services or need per-user configuration; in that case, ensure to set it up with “Run whether user is logged on” and system permissions similar to a service. In all cases, run under the least-privileged account and set up service/task recovery options to handle lane restarts.

## Hardened systemd unit template and rationale  
On Linux, use `systemd` to supervise each lane. Below is a hardened unit file *template* for a lane (e.g. `tinyrustlm-lane1.service`), with annotations:

```
[Unit]
Description=TinyRustLM Lane 1 Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=tinyrustlm
Group=tinyrustlm
WorkingDirectory=/var/lib/tinyrustlm
ExecStart=/usr/local/bin/tinyrustlm --lane 1 --config /etc/tinyrustlm/config.json
# Restart on any failure, after brief delay
Restart=on-failure
RestartSec=5s
StartLimitIntervalSec=60
StartLimitBurst=3

# Filesystem hardening
ProtectSystem=strict      # Make /usr, /boot read-only (allows only whitelisted paths)
ProtectHome=yes          # Hide /home from service (except /run and /tmp)
PrivateTmp=yes           # Private /tmp and /var/tmp for this service
PrivateDevices=yes       # No device nodes by default (only allow what’s needed)
ReadWritePaths=/var/lib/tinyrustlm /var/log/tinyrustlm
ReadOnlyPaths=/etc/tinyrustlm /etc/ssl

# Restrict privileges
NoNewPrivileges=yes      # Disallow any new privileges from execve (drop setuid, capabilities)
CapabilityBoundingSet=   # Drop all Linux capabilities (start with none)
AmbientCapabilities=     # No ambient caps
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX

# Resource limits (adjust estimates as needed)
LimitNOFILE=65536
LimitNPROC=512
MemoryMax=2G
CPUQuota=150%           # Cap CPU usage (1.5 CPU cores)
IOReadBandwidthMax=100M
IOWriteBandwidthMax=50M

# Runtime directories (auto-created under /run/user or /run depending on dynamic/user context)
StateDirectory=tinyrustlm-lane1
RuntimeDirectory=tinyrustlm-lane1

[Install]
WantedBy=multi-user.target
```

**Rationale:**  The above uses recommended systemd hardening options.  `NoNewPrivileges=yes`, `ProtectSystem=strict`, and `ProtectHome=yes` prevent the service from writing to the OS or user areas except in explicitly allowed paths.  A private `/tmp` and disabling device nodes (`PrivateDevices=yes`) limit its attack surface. We only grant write access to necessary directories (e.g. the shared model/piece store in `/var/lib/tinyrustlm`, log folder, etc.) via `ReadWritePaths=`.  All other system directories are read-only or inaccessible.  We drop all Linux capabilities (`CapabilityBoundingSet=` empty) so the process has only the bare minimum rights. In practice you might keep only, say, `CAP_NET_BIND_SERVICE` if the app needs privileged ports, but default to none.

Restart logic is set to `on-failure` with a short backoff (`RestartSec`). We also set `StartLimitIntervalSec`/`Burst` to avoid endless rapid crash-restart loops.  Resource limits (NOFILE, MemoryMax, CPUQuota, IO bandwidth) should be tuned to expected workloads to enforce per-lane caps.  For example, `MemoryMax=2G` reserves 2 GB per lane (estimate; adjust based on actual model sizes).  `StateDirectory` and `RuntimeDirectory` ensure `systemd` creates `/run/user/<UID>/state/tinyrustlm-lane1` (or `/run/tinyrustlm-lane1` for system services) owned by the service user, so that runtime files (sockets, PID file, etc.) are cleaned up on stop.

Ordering with `network-online.target` ensures the lane only starts after the network is up (needed if it needs to announce itself or connect on boot).  In a pure user-instance setup, `WantedBy=default.target` could be used instead.

The above is a *template*. In a distribution package, create one unit per lane (e.g. lane1 and lane2). For a user-level service (running as a normal user), put these in `~/.config/systemd/user/` and enable with `systemctl --user enable tinyrustlm-lane1`.  To keep the service running even when not logged in, use lingering (`loginctl enable-linger $USER`). Optionally, a system-wide unit (under `/etc/systemd/system`) can be installed if an admin chooses; in that case use the same `[Service]` settings and add `[Install] WantedBy=multi-user.target`.

NoNewPrivileges, ProtectSystem, etc. are documented in the systemd man pages and have been strongly recommended as a baseline by security guides.  Together, `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`, and `NoNewPrivileges=yes` provide substantial protection against a lane process writing or escalating privileges.  

## Install/control state machine with idempotency rules  
Installation and control must be scripted carefully to handle two lanes and repeated operations:

- **Service/task names:** Use fixed, unique names. For example on Windows: `TinyRustLM-Lane1` and `TinyRustLM-Lane2`; on Linux: `tinyrustlm-lane1.service`, `tinyrustlm-lane2.service`.  This ensures the same names are used on every install.  
- **Ownership markers:** During install, tag created files (service definitions, config files) in a known location or with a known prefix so the uninstall script can identify them. For example, place all `.service` files under `/etc/systemd/system/tinyrustlm-*` and record that pattern. On Windows, use a specific folder or registry key to mark owned Scheduled Tasks.  
- **Installation (start):** On first install, the script should create both lane services/tasks and the shared config directory. It should check: if a lane unit already exists and is active, leave it running (don’t overwrite live units). If a service file has changed (new version), do an atomic replace (install to a temp file then move), then run `systemctl daemon-reload` (Linux) or equivalent for tasks. If any step fails, the installer must roll back (e.g. remove any partially installed service and stop any lane already started).  
- **Stopping and uninstall:** Uninstall must stop both lanes (gracefully), disable the services (or delete tasks) and remove only those definitions. It must **not** delete the shared models or piece-store data (per constraint), only program files and service definitions. For example, `systemctl disable tinyrustlm-lane1`, then remove `/etc/systemd/system/tinyrustlm-lane1.service`. On Windows, use `sc delete` or `schtasks /delete` for exactly the named tasks. Protect against deleting any service outside the “tinyrustlm-*” namespace.  
- **Idempotency and repeated calls:** All install/uninstall commands should be idempotent. E.g. if `install.sh` is run twice, the second run should see the unit files already in place and simply confirm/refresh them, but not crash. If a lane is already running, invoking the start action should notice it and skip re-launch (or restart if desired). Similarly, uninstalling when nothing is installed should be a no-op that reports “already uninstalled”.  
- **Missing-definition behavior:** If an operator tries to start or stop a lane that doesn’t exist (e.g. typo in name), the script should detect that (e.g. `systemctl list-units` or `sc query`) and return an error rather than, say, killing another service.  
- **Race prevention:** If install or control scripts might run concurrently (unlikely, but for safety), use advisory locks (lock a file or use systemd’s “Conflict=” or Init scripts that serialize operations) to prevent two installers from changing lanes at once.  
- **Service update (definition replacement):** When updating the companion binary or config, the service file replacement should be atomic. For systemd, write the new unit to a temp file then `mv` over the old, then `daemon-reload`. For Windows, the `binPath=` or XML of a task should likewise be updated using the proper tools (e.g. `sc config` or `schtasks /change /XML`).  
- **Protection from unrelated deletes:** The uninstall routines should explicitly only remove items it created (using recorded names or patterns). For example, `rm /etc/systemd/system/tinyrustlm-lane*.service` is OK, but never `rm /etc/systemd/system/*`. Use precise file globs or database of files.

In summary, the install/start script is a finite state machine: it creates the lane definitions if missing, then starts each service/task (in order or in parallel).  The stop/uninstall script reverses these steps. All operations check pre-conditions so they can be run multiple times safely.

## Readiness and restart model  
The companion must manage each lane’s lifecycle robustly:

- **Readiness vs. health:** Each lane process should explicitly signal when it is *ready* to serve (for example by creating a “ready” flag file or using `sd_notify(READY=1)` if using `Type=notify`). Service managers should not consider a lane up until it has validated all models and endpoints. A separate *health* check (e.g. an HTTP status endpoint) can be polled during operation, but readiness is a one-time check at startup.  
- **Bounded startup:** Limit how long a lane can stay initializing. In systemd, use `TimeoutStartSec=30s` (for example) so that if a lane hangs during pre-bind/validation, it’s killed. Windows services have no built-in timeout, so the lane should implement its own watchdog (exit if initialization exceeds a threshold).  
- **Startup revalidation:** On every restart, each lane must re-validate endpoints and model integrity. This may involve hashing model files. Because this can be expensive, log progress indicators (percent complete) to avoid timeout. Systemd `RestartSec` delays can accommodate this.  
- **Graceful shutdown:** On stop, a lane should stop accepting new requests and finish in-flight work. In systemd, provide an `ExecStop=` command or trap SIGTERM to perform a graceful drain, then exit 0. Set `KillMode=control-group` (the default) so that after a grace period (`TimeoutStopSec`, e.g. 30s) any remaining child processes are killed. In Windows, the Service handler’s `OnStop` should similarly stop listening and wait (up to the service timeout limit) for current requests to complete before exiting.  
- **Forced termination deadlines:** If a lane does not exit cleanly within the grace period, it should be force-killed. Systemd’s default does this after `TimeoutStopSec` (default 90s unless changed). Windows service control manager will also forcibly terminate after its own timeout (~30s).  
- **Exit codes and crash loops:** By default, any non-zero exit of a lane will trigger a restart (service restart policy or Windows recovery). Monitor restart frequency: e.g. limit to 3 restarts per minute (`StartLimitBurst=3`). If a lane crashes repeatedly (a crash-loop), it may indicate persistent misconfiguration; consider disabling that lane and alerting the operator. Importantly, if lane1 crashes, lane2 must keep running; configure each as a separate service/unit.  
- **Child processes and handles:** If the lane process spawns workers, ensure the service manager owns the whole process tree (systemd does this by default). Avoid leaving orphaned children. Set `KillSignal=SIGTERM` to let them exit gracefully.  
- **Endpoint pre-binding:** The requirement says “validate and pre-bind all endpoints before serving.” This implies the lane should open/listen on all configured ports/socket addresses during init. The readiness check (above) should only signal done once those binds succeed.  
- **Long-running verification:** If model verification or P2P announcements take time, provide periodic status (e.g. logs like “Verifying model X (30% done)”), so operators know the service is alive.  
- **Maintaining second-lane availability:** Always bring down or restart lanes one at a time. For upgrades or manual restarts, stop lane1, wait for it to exit, then start lane1 again (while lane2 stays up), and vice versa. Never stop both simultaneously except during full shutdown. If using `systemd`, you can restart lanes independently (`systemctl restart tinyrustlm-lane1.service`).

## Resource-budget formulas and example capacity table  
Resource planning is estimate-based. Suppose each admitted model has size *S* (e.g. 100 MiB for a small quantized LLM) and the piece-store/indices add ~10% overhead. Let *N* be the number of models (1≤N≤20). Then:

- **Disk budget (shared):** Disk ≈ ∑(model_sizes) + overhead. For example, if each model is ~150 MB plus ~15 MB overhead, then *Disk* ≈ 165 MB×N. Add 10% slack for reserve. (E.g. for N=20, Disk≈3.3 GB + reserve ≈3.7 GB).  
- **Piece-store accounting:** The piece-store (P2P cache) should be co-located with models (no per-lane duplication). It grows as models are shared. Budget size ~ equal to model data, since P2P stores pieces of models.  
- **Memory (per lane):** Each lane will load model data into memory (depending on implementation). If an LLM requires ~10× its file size when running (due to working memory, tokens, etc.), then memory ≈ 10×∑(model_sizes/N) per lane. For instance, with 5 models of 150 MB each, ~750 MB file ⇒ ~~7.5 GB memory per lane. Add a base memory of ~200 MB for overhead. So Memory(lane) ≈ 200 MB + 10× (total_model_size/N).  
- **Total memory:** Two lanes ⇒ ~2× (per-lane memory) (they don’t duplicate model data in RAM if possible). In worst case (20 models ×150 MB), one lane ~30+ GB, so two lanes ~60 GB (likely too high; adjust formula to smaller multiplier if models are quantized).  
- **File descriptors:** Each lane listens on some ports and may handle many P2P connections. Rough formula: *FD* ≈ (listening sockets + outbound sockets + logs) ≈ 100–1000. Plan at least `LimitNOFILE=10000` to be safe.  
- **Log storage:** If each lane logs ~10 MB/day, 2 lanes ⇒ 20 MB/day. Retain for, say, 30 days ⇒ ~600 MB total log space (or tune via logrotate or journald).  
- **Network (upload bandwidth):** In P2P mode, a lane will upload pieces of models to peers. If a lane has *U* active peers, and models are, say, 150 MB compressed, then worst-case upload is U×150 MB per day (if many peers fetch all models). E.g. U=10 peers ⇒ ~1.5 GB/day (20 KB/s sustained). This should be limited via network QoS if needed.  
- **CPU (hashing):** On startup or model import, each model file must be hashed (SHA‑256 etc.) to verify integrity. If the disk can do ~100 MB/s reads, a 150 MB model takes ~1.5 s of I/O; hashing also takes CPU. For N models, CPU time ≈ N×(size)/hash_rate. If SHA‑256 runs at ~500 MB/s per core, hashing 150 MB takes ~0.3 s, so even 20 models ≈ 6 s of CPU (negligible). Live P2P hashing of pieces (if any) would add to CPU load. Plan for at least 1 core per lane for CPU-bound tasks, plus overhead.  
- **Startup cost:** Revalidating endpoints is quick; verifying models or catching up on P2P announcements may take longer. If many models, startup may need a minute or two. TimeoutStartSec in systemd should accommodate this (e.g. 30–60s).  
- **Caching and stale data:** Models can be updated outside; a “purge” operation should exist to remove old piece-cache. For instance, if a model is revoked, its pieces should be deleted from the shared store and disks. The companion could offer a `--purge-model NAME` command to safely delete all related data (model file and pieces), rather than overwriting.  
- **Estimate table:** *(Estimates only)*

| Models (N) | Disk (GB, shared) | Memory per lane (GB) | Total Memory (2 lanes) | FD limit | Log space (GB) |
|:----------:|:-----------------:|:-------------------:|:----------------------:|:--------:|:-------------:|
| **1**      | ~0.2 (0.18+res)   | ~2.0               | ~4.0                  | 1000     | 0.02          |
| **5**      | ~1.0 (0.83+res)   | ~5–6               | ~10–12                | 2000     | 0.1           |
| **20**     | ~4.0 (3.3+res)    | ~15–20             | ~30–40                | 5000     | 0.4           |

*Table: Example resource estimates for 1, 5, and 20 models (N). Disk = raw model files plus 10% overhead + reserve. Memory = ~200 MB + 10×(∑model_sizes/N). FD = recommended file-descriptor limit. Log = 10 MB/day retention.*  

Adjust all values based on actual model sizes. The key is to *not* double-count models per lane: both lanes read the same shared model files, so disk is not per-lane. Reserve ~10–20% free disk space to avoid full-disk failures.

## Logging, redaction, and retention contract  
Diagnostics must be structured and privacy-preserving:

- **Structured events:** Emit logs in a consistent schema (e.g. JSON or key=value) with fields for lane ID, timestamp, and event type. Include a correlation ID in requests or internal tracing so that multi-step operations (like model import) can be tracked. For example, events might include `{"lane":1,"event":"import_progress","percent":50}`.  
- **Per-lane logs:** Each lane should log its own status. Prefix log entries or use separate log streams so an operator can easily filter by lane.  
- **No sensitive data:** Strip or never log any user-provided data. In particular, do not log any secrets or credentials. If a URL includes user-info (e.g. `http://user:pass@host`), remove the `user:pass@` portion in logs. Any fields that look secret (API keys, tokens) should be sanitized or omitted. Only log non-sensitive metadata (model IDs, peer IDs, numeric results).  
- **Rotation and retention:** Logs should be rotated and limited. If using `systemd-journald`, rely on its retention settings (e.g. `SystemMaxUse=`). If writing to files, rotate based on size/time (e.g. `logrotate` to keep 30 days or 1GB). Ensure that logging itself cannot fill the disk unbounded.  
- **Crash evidence:** On a crash or panic, record the exit status and any stack trace/error message available. Preserve the last few log lines around the crash. Optionally, allow collecting a crash dump (if user consents) under `/var/lib/tinyrustlm/last-crash/`.  
- **Import progress:** When importing models or pieces, log progress percentages at intervals so the operator sees that work is proceeding.  
- **Rate limiting:** If a component retries or logs errors in a loop, throttle to avoid log flooding.  
- **Event examples:** Log entries could be like `INFO: [Lane1] Serving model 'Foo' on port 1234` or `WARN: [Lane2] Disk usage at 95%` or `ERROR: [Lane1] Failed to bind port 8000: address in use`. Use levels consistently (INFO/ERROR).  
- **No telemetry by default:** All logs remain local. There is no built-in remote telemetry. However, provide a tool to collect logs for operator export if needed (e.g. `tinyrustlm collect-logs > bundle.tar.gz`), which will omit private fields.  
- **Redaction and privacy:** Do not log full user queries or PII. The companion is only a model host, so there should be minimal user content in logs. If any personal identifier is present (unlikely), redact it.

There are no official “connected sources” for these choices, but they follow best practices for privacy and log management: structured logging, limited retention, and no PII. The OneUptime reference suggests journald/JSON logging and reviewing error logs.

## Upgrade/rollback procedure  
Upgrades should be as seamless as possible:

1. **Staging:** Download the new version of the companion as a side-by-side copy. For example, place the new binaries in a separate directory (`/opt/tinyrustlm-new/`). Verify file hashes (the installer can check a signed checksum before activating).  
2. **Version check:** Ensure the new version is compatible with existing config. If config schema changed, migrate or abort. If a native library or Python/Node version changed, check ABI compatibility.  
3. **Lane-by-lane upgrade:** For each lane independently: stop lane1 service, replace its executable (or repoint `ExecStart=` to the new binary), then start lane1 and wait for readiness. Only if lane1 becomes healthy should you stop lane2. This avoids full outage.  Windows: use `sc stop TinyRustLM-Lane1`, update the `binPath` via `sc config` or reinstall the service, then `sc start`.  
4. **Preserve models:** Do *not* delete or overwrite the shared model files. The upgrade must reuse existing models so that ongoing training/serving isn’t lost.  
5. **Rollback on failure:** After upgrading a lane, perform a health check (e.g. request a test prompt or check systemd status). If it fails to start/respond, abort the rollout: roll back that lane’s executable to the old version and restart it. Do not bring down the second lane until the first is fully ready. Similarly, if after upgrading both lanes any critical issue appears, revert both lanes to the old binaries.  
6. **Announcements cleanup:** If lanes advertise their addresses to a network or directory, ensure old endpoints are removed. For instance, if each lane registered its URL, deregister the old one after the new lane is up.  
7. **Avoid simultaneous downtime:** Upgrade steps must be sequential. Never stop both lanes at once. At most, one lane is offline while being updated.  
8. **Post-upgrade checks:** Verify that both lanes report the new version and that models are still served correctly. Run any built‑in self-tests to confirm that pieces and endpoints are working.  

For Windows, upgrades might use a Windows Installer (MSI) or a script. The installer would effectively do: stop service, replace files, start service, then repeat for lane2. For Linux, a package upgrade script (`postinst`) or manual sequence would do the same. Always ensure that each lane’s service file is updated atomically and `daemon-reload` is called.  

There are no formal “connected” docs on this specific upgrade scenario, but this approach follows standard principles: do rolling (one-at-a-time) upgrades, verify readiness, and revert on failure.

## Failure-mode and recovery matrix  
Anticipate common failures and operator actions:

| Scenario                        | Symptom/Detection                  | Immediate Recovery Action               | Long-term Fix/Notes                       |
|:--------------------------------|:-----------------------------------|:----------------------------------------|:------------------------------------------|
| **Lane process crash**          | Service stopped, or systemd shows `inactive (failed)`; logs show error. | systemd/SCM will restart automatically (on-failure). Monitor logs. | Check crash log; update binary if bug; add retry limit to avoid crash loop. Lane2 unaffected. |
| **Both lanes down (e.g. reboot)**| After reboot, neither lane responds.            | Ensure both services are enabled. Run `systemctl status tinyrustlm-lane*`. Start any not running. | If they fail, inspect journal (`journalctl -u tinyrustlm-laneX`). Possibly enable linger for user service. |
| **Port bind failure**           | On start, logs: “Failed to bind port X”.       | Usually a conflicting process. Kill/stop the other process.  Restart lane. | Check if two processes configured same port. Fix config to use different ports. |
| **Out of disk space**           | IO errors in logs; service stops writing data.  | Delete old logs or models (manually or via `--purge-model`). Notify operator. | Add disk space or reduce models. Possibly configure `LimitFSIZE` to prevent catastrophic fill. |
| **Model corruption/missing**    | Lane startup fails validation of model. Error in logs. | Remove the bad model from config or replace file.  `tinyrustlm model-add` with good copy. | If corrupt, re-download model. Ensure config and models are in sync. |
| **High resource usage**         | System alerts: high CPU/memory; service slower. | Possibly throttle lane (e.g. nice, cpulimit). Check config for unnecessary models. | Scale down by reducing models or upgrading hardware. Tune resource limits in unit. |
| **Config syntax error**         | Service fails to start; logs show parse error.    | Fix config file (YAML/JSON) as per error. Restart service. | Validate config changes. Provide example config in docs. |
| **Upgrade failure**             | New lane version fails health-check.           | Roll back to previous version for that lane; leave other lane running. | Investigate compatibility issue. Only promote new version when fixed. |
| **Network offline at boot**     | Lane starts before network; unable to contact peers. | If problems, configure `Wants=network-online.target` and ensure network-online.service is active. | Consider using `Restart=always` so it retries once network is up. |
| **Log flooding**                | Disk space filling; logs growing rapidly.      | Pause service; rotate/delete old logs. | Add log rate-limiting or error checks to prevent spamming the log. |
| **Permission denied (Linux)**   | In logs: “permission denied” on file or port.    | Check unit’s `User=` rights; fix filesystem permissions. Restart. | Use `ProtectSystem` or `ReadWritePaths` carefully to avoid true needed writes being blocked. |

In all cases, lane2 is isolated: if lane1 fails or is being recovered, lane2 should continue serving. If both lanes fail in the same way, treat them independently. Use the above matrix to guide diagnosing (e.g. check `systemctl status`, logs in `journalctl`, and on Windows the Event Viewer for the service).

## Detailed operator runbooks  
Below are step-by-step procedures for common operations. Assume partial Windows and Linux context notes are given.

- **First install:** Obtain the TinyRustLM companion (e.g. download installer or binary bundle). On Windows, run the installer in Administrator mode or unpack and register services (e.g. `sc create TinyRustLM-Lane1 binPath= "...\\tinyrustlm.exe"` with `start= auto`). On Linux, place the binary in `/usr/local/bin/` or similar, and install the systemd service files as above (`/etc/systemd/system/tinyrustlm-lane1.service`). Then run `systemctl daemon-reload` and `systemctl enable --now tinyrustlm-lane1` (and lane2). Verify with `systemctl status`.  
- **Add first model:** Copy the `.slm` model file into the model directory (e.g. `/var/lib/tinyrustlm/models/`). Alternatively, use a CLI like `tinyrustlm model-add mymodel.slm` if provided. Ensure the config is updated (e.g. `"models": ["mymodel"]`) and restart the lanes: `systemctl restart tinyrustlm-lane1` (lane2 can also reload to see the model). Check logs for “model loaded” messages.  
- **Configuring ports:** Edit the JSON or YAML config (`/etc/tinyrustlm/config.json`) to set desired listening ports. For example, set `port=12345`. Then restart the lanes. On Windows, you may need to confirm firewall prompts or pre-create a firewall rule: e.g. `netsh advfirewall firewall add rule name="TinyRustLM Lane1" dir=in action=allow protocol=TCP localport=12345`.  
- **Verifying local health:** Check that each lane’s API endpoint responds. For example, if a lane has an HTTP status port, do `curl http://localhost:12345/health`. Or try a test chat query that should return a quick result. On Linux, use `systemctl status tinyrustlm-lane1` (should show “active (running)”), and `journalctl -u tinyrustlm-lane1 --since "5 minutes ago"` to see logs. On Windows, use `sc query TinyRustLM-Lane1` or the Services snap-in.  
- **Obtaining outside proof:** To prove the host is working from another machine, try a remote curl or TinyRustLM client pointing at the local peer’s address. For example, if lane2 is on port 12346 on host `mybox`, from another PC: `curl http://mybox:12346/metrics` or a similar endpoint. If peer discovery is used, run the TinyRustLM peer query command or check TinyRustLM.com’s UI “connected nodes” to see your host listed.  
- **Installing services (Windows):** If not done by installer, manually create the Windows Service: open an elevated prompt and run `sc create TinyRustLM-Lane1 binPath= "C:\Program Files\TinyRustLM\tinyrustlm.exe" start= auto obj= "NT AUTHORITY\LocalService"`. Repeat for Lane2 with a different name/port. Then start them: `sc start TinyRustLM-Lane1`.  
- **Rotating endpoint URLs:** If the service advertises a P2P URL that changes (e.g. dynamic DNS), update the configuration (e.g. set `"advertise_url"` in config) and restart the lanes one by one. For Windows, update the service arguments or registry if they include the URL. Ensure old URL is removed from any trackers.  
- **Disk pressure (low disk space):** If the system reports low disk, first **stop the companion lanes** to safely clean up. Remove old log files (`/var/log/tinyrustlm/*`) or run `tinyrustlm logrotate` if available. If models are the issue, consider deleting a rarely used model via `tinyrustlm model-remove NAME` and restarting lanes. Always keep some free space (10% of total) to allow operations. Monitor `df -h` or Windows disk reporter.  
- **Handling a failed lane:** If one lane crashes repeatedly, examine its logs (`journalctl` or Event Viewer). Try restarting: `systemctl restart tinyrustlm-laneX`. If it won’t start (e.g. due to config error), correct the error or disable that lane temporarily: `systemctl disable tinyrustlm-laneX` and remove it from the config so the other lane can operate alone. Use the remaining lane for continued service. File a bug report or re-install to fix the crashed lane.  
- **Revoking a model:** To remove a model from service, remove it from the config and delete its files. E.g. edit `/etc/tinyrustlm/config.json` to delete the model entry, then run `tinyrustlm model-remove modelName`. Restart the lanes (`systemctl restart` for each). Verify logs say the model is no longer served.  Optionally, manually delete the `.slm` file from disk after confirmation that no lane is using it.  
- **Updating binaries:** As outlined above, stop lane1, replace the executable (or use a package manager to upgrade), start lane1 and verify. Then do lane2. On Linux: `systemctl restart tinyrustlm-lane1` (after copying new binary). On Windows: update the files and do `sc stop/start` or simply install the new version via an MSI. Always test each lane before proceeding to the next.  
- **Uninstalling:** First stop both lanes: `systemctl stop tinyrustlm-lane1 tinyrustlm-lane2`. Disable or remove the service definitions (delete the `.service` files under `/etc/systemd/system/` and run `daemon-reload`; on Windows use `sc delete` or `schtasks /delete`). Delete companion binaries and config files under their install path. **Do not delete model files** unless explicitly purging. Remove log files if desired. On Linux, if user units were used, also run `systemctl --user disable tinyrustlm-lane1` (for each lane) and remove `~/.config/systemd/user/tinyrustlm-lane*.service`.  
- **Explicit data purge:** If full data removal is needed (e.g. for decommissioning), after stopping services delete the model store directory and piece store (`rm -rf /var/lib/tinyrustlm/*models*`). Also clear state directories and logs. Use any provided `tinyrustlm prune` or `--purge` command to remove caches. Confirm only intended data is deleted.  

Follow these steps carefully and verify at each stage. On Linux, `systemctl status` and `journalctl` are your friends; on Windows, use `Event Viewer` and `Get-Service`/`sc`. Each runbook step should include checking the companion’s own status API or log output to confirm the expected state.  

## Automated test plan for Windows and Linux  
Develop automated tests to verify each aspect of the deployment:

- **Service startup tests:** On both OSes, simulate a fresh boot. Verify both lanes start automatically. For Linux: `systemctl is-active tinyrustlm-lane*`. For Windows: use a virtual machine snapshot that reboots on startup and confirm services are running.  
- **Health checks:** Write a script that queries each lane’s health endpoint or performs a simple API call. Run it repeatedly and verify correct responses. Automate checking a known prompt yields expected output on each lane.  
- **Process supervision:** Kill the lane process (e.g. `kill -9 $(pidof tinyrustlm)`) and verify systemd restarts it. On Windows, use Task Manager or `Stop-Service` (force) and ensure the recovery policy restarts it (or manually restart for test). Check restart backoff by killing repeatedly in a short period.  
- **Concurrency:** While both lanes are running, simulate load (multiple parallel requests, model imports) to ensure they do not interfere. Verify that one lane continues serving if the other is paused or busy.  
- **Resource limits:** Use tools like `ulimit` or `stress-ng` to push memory/FD/CPU above set limits and observe that systemd kills the service at the limit. For Windows, use Process Explorer to limit commit size or CPU affinity.  
- **Firewall prompt (Windows):** On first run, confirm whether Windows Firewall asks for permission. Automate acceptance by pre-adding a rule (`netsh`).  
- **Upgrade/rollback flow:** Create a test upgrade package. Install it while lane1 is running, verify lane1 is updated (using a test-version API). Then intentionally make lane2 upgrade fail (e.g. corrupt binary) and verify that the system rolls back lane2 to the previous version, leaving lane1 up.  
- **Install/uninstall idempotency:** Run the install script twice; it should not break anything. Uninstall twice; the second time should do nothing harmful. Check that after uninstall, no services or tasks remain, and model files still exist.  
- **Logging checks:** Verify that log rotation works: generate logs (e.g. via debug mode) beyond retention threshold and confirm old logs are purged as specified. Check that no sensitive strings appear in logs when fed test inputs.  
- **Lingering (Linux user service):** If using user mode, log out the user and check that with `loginctl enable-linger` the services keep running. If linger is not enabled, verify that logging out stops the lanes.  
- **Diagnostics:** Test the diagnostic export (if any). For example, run `tinyrustlm collect-logs` and check that it produces a bundle without secrets.  
- **Network offline:** On system boot, disconnect network. Start services and ensure they do not hang indefinitely (and eventually recover when network returns).  
- **Disk space:** Fill disk (e.g. `fallocate`) to just below 100%. Start companion and verify it handles “disk full” errors (reports a clear error, does not corrupt data).  

Document these tests in a script or CI pipeline. They should cover the matrix of OS (Windows 10/11, a few Linux distros) and installation modes (systemd system vs. user, scheduled task vs. service).  

## Local facts still needed  
Some information must be determined or confirmed locally (not found in public docs):  
- **Exact model sizes and memory usage:** The `.slm` model file format and runtime footprint (e.g. how much RAM per model) must be measured from actual models. We assumed ~150 MB file and ~10× RAM, but real numbers could differ.  
- **Default ports and config locations:** Verify the default listening ports of each lane and default config file path. We assumed `/etc/tinyrustlm/config.json` and `/var/lib/tinyrustlm` for data; confirm these or adjust as needed.  
- **Firewall behavior:** On Windows, test whether the companion triggers a firewall prompt on first listen. Document any needed rules.  
- **Privilege requirements:** Confirm that non-admin users can install and run the service/task if given rights, and which rights exactly (e.g. “Log on as a service” right).  
- **Interactive console:** If the service has any console output or user interface (likely not), determine how to suppress it in service mode.  
- **System limits:** The systemd defaults for `LimitNOFILE` or `MemoryMax` may be different on target distros; confirm those and adjust.  
- **Software dependencies:** If the companion needs libraries or a runtime (e.g. .NET or Python), verify these must be pre-installed and how to check their versions.  
- **Platform-specific features:** On Linux, determine if AppArmor or SELinux should be configured. On Windows, determine if a Windows service launcher (like `srvany` or sc.exe) is needed for the companion.  
- **Service user management:** Decide if the installer should create a dedicated OS user (e.g. `tinyrustlm`) or use a generic account. Test file ownership and permissions accordingly.  

These “fact checks” should be done during an implementation phase, and any changes rolled back into the above documentation.

## Direct links to current official platform sources  

- Microsoft Learn – **sc.exe create** command (Windows Service setup) – updated 2025 (shows `start=auto` runs without logon, and default service account).  
- Microsoft Learn – **schtasks** (Task Scheduler) reference – updated 2023 (documents `/RU` options for SYSTEM, LOCALSERVICE, NETWORKSERVICE).  
- man7.org – **systemd.exec(5)** manual page – accessed Jul 2026 (explains `NoNewPrivileges=`, `ProtectSystem=`, `ProtectHome=`, `RuntimeDirectory=`, etc.).  
- man7.org – **systemd.service(5)** manual page (exec section) – accessed Jul 2026 (same source as above).  
- Arch Linux Wiki – **systemd/User** (user service instance behavior) – current as of 2026 (details that user services stop when user logs out unless `enable-linger`).  
- OneUptime blog – “How to Configure systemd Service Hardening” (Ubuntu example) – Mar 2026 (recommends ProtectSystem/NoNewPrivileges baseline).  

Each link was checked in mid-2026 to ensure it is up-to-date with the latest Windows (10/11/Server 2025) and systemd (v250+) documentation. 


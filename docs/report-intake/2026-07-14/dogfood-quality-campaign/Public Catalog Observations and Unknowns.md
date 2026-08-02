# 1. Public Catalog Observations and Unknowns
We found no public documentation on “MiniModel.org” beyond references in the TinyRustLM UI.  The TinyRustLM interface mentions loading “MiniModel metadata” (e.g. `models.v0.json`) and a “MiniModel demo autoload” which “loads a tiny verified demo model from MiniModel.org”.  This implies MiniModel.org hosts a catalog JSON (likely `models.v0.json`) and peer announcements, but we found no public schema or API doc.  We assume it publishes a catalog of model entries and feeds of lane announcements.

**Unknowns** include the exact format of the catalog/manifest JSON, trust anchors (which keys or certificates MiniModel uses), and any rate-limits or API endpoints.  We also lack detail on who the “outside-network observer” might be (an independent server, volunteer node, or dedicated service) and how it obtains its identity or trust anchors.  It’s unclear how federated or centralized the catalog is, and whether it supports multi-sig (quorum) proof.  We will design assuming a single global catalog at MiniModel.org and Ed25519 signatures for identity, but note these as assumptions.

# 2. Fleet/Process/Network Architecture
A high-level P2P model distribution is illustrated below.  We run 20 distinct models, each served by two independent lane processes (red nodes) that share a read-only piece store (grey).  Peers fetch model pieces directly from these lanes.  MiniModel.org provides only metadata and catalog feeds (yellow). External observers (green) connect over the Internet to verify both lanes and issue signed receipts. This design ensures redundancy (two lanes) and direct peer-to-peer distribution.

 *Figure: Conceptual P2P architecture. Each model (blue) is served by two independent “lanes” (red processes) on the host, sharing a common piece store. Clients fetch pieces directly from lanes. MiniModel.org (yellow) holds the catalog; outside observers (green) attest reachability.*

Internally, each **lane** is an OS process hosting an HTTP file server on configured endpoints (IP/port or UNIX socket).  The two lanes per model share a single on-disk piece store (content-addressable blocks of the model) to avoid duplication.  Each lane is “restartable”: if one crashes, the other stays up, and the failed one can be relaunched independently.  A high-level network diagram is in Figure 2.

# 3. Identity and Configuration Schema
We assign *cryptographic identities* to every object:

- **Fleet ID**: a human-meaningful name or UUID for this host’s fleet (e.g. the hostname or owner key fingerprint). Not strictly needed in protocol, but useful for grouping models.
- **Model ID**: the SHA-256 hash of the model’s manifest or full artifact (immutable). This uniquely identifies each model artifact.
- **Artifact ID**: equivalent to Model ID (the complete .slm file hash).
- **Manifest ID**: the hash of the model’s JSON manifest (if separate).
- **PieceSet ID**: the Merkle-root (or concatenated hash) of all piece data blocks. Alternatively, a unique hash of the entire piece list.
- **Lane ID**: a random UUID or Ed25519 key pair for each lane process. We generate a new key pair per process; the public key is its Lane ID and is used in receipts.
- **Process ID**: the OS PID (for local use only) or a UUID to correlate restarts.
- **Endpoint ID**: the concrete address (scheme, hostname, port, path prefix) each lane listens on.  Because lanes “pre-bind” endpoints, this is known at startup.
- **Service Definition ID**: a signature or hash of the service API (e.g. version string of the server software). Ensures we know exactly which code is running.
- **Proof Receipt ID**: a random nonce or hash of the receipt payload, uniquely identifying each signed proof.
- **Announcement ID**: a timestamp or sequence number used in the catalog feed so announcements can be ordered or superseded.

These identities are bound cryptographically: e.g. each lane’s public key (Lane ID) is used to sign status updates, and each proof receipt is an Ed25519 signature over its contents by the observer.

We define configuration schemas as C# classes (with `[Display(Name="…")]` for UI clarity), for example:

```csharp
public class ModelEntry {
    [Display(Name="Model")]     public string ModelId       { get; set; }
    [Display(Name="Artifact")]  public string ArtifactId    { get; set; }
    [Display(Name="Manifest")]  public string ManifestId    { get; set; }
    [Display(Name="Piece Set")] public string PieceSetId    { get; set; }
    [Display(Name="License")]   public string License       { get; set; }
    [Display(Name="Provenance")]public string ProvenanceReceipt { get; set; }
}

public class LaneConfig {
    [Display(Name="Lane")]      public string LaneId        { get; set; }
    [Display(Name="Process")]   public string ProcessId     { get; set; }
    [Display(Name="Endpoints")] public string[] Endpoints   { get; set; }
}

public class ProofReceipt {
    [Display(Name="Receipt")]   public string ReceiptId     { get; set; }
    [Display(Name="Model")]     public string ModelId       { get; set; }
    [Display(Name="Artifact")]  public string ArtifactId    { get; set; }
    [Display(Name="Piece Set")] public string PieceSetId    { get; set; }
    [Display(Name="Lane")]      public string LaneId        { get; set; }
    [Display(Name="Observer")]  public string ObserverId    { get; set; }
    [Display(Name="Nonce")]     public string Nonce         { get; set; }
    [Display(Name="Observed")]  public DateTime ObservationTime { get; set; }
    [Display(Name="Issued")]    public DateTime IssueTime       { get; set; }
    [Display(Name="Expires")]   public DateTime ExpiryTime      { get; set; }
    [Display(Name="Signature")] public byte[] Signature    { get; set; }  // Ed25519
}
```

In the TypeScript companion (for e.g. front-end or tool config), we use standard JSON-like schemas.  For example:
```typescript
interface ProofReceipt {
  modelId: string;
  artifactId: string;
  pieceSetId: string;
  laneId: string;
  observerId: string;
  nonce: string;
  observationTime: string; // ISO 8601 UTC timestamp
  issueTime: string;       // UTC
  expiryTime: string;      // UTC
  signature: string;       // base64 Ed25519 signature
}
```
Note we use **camelCase** keys per JS convention and `"number"` or `"string"` types (no `Int32` in TS).  Dates are in ISO-8601 strings with timezone info (UTC).  The `signature` is encoded (e.g. base64).  We avoid non-standard types (TS uses `number` for all numeric fields).

All identities (ModelId, ArtifactId, etc.) are the hex or base64 of SHA-256 digests.  Piece names on the HTTP server are fixed, e.g. an index (`piece0000.bin`) or content hash; the schema ensures these are immutable and public.  For example, our routes might be `/models/{modelId}/pieces/{hash}`.

# 4. Admission Workflow and State Machines
We enforce a **strict, fail-closed pipeline** for each new model:

1. **Quality Receipt**: Verify a source provenance receipt or QA certificate (obtained from trusted training source).  If missing or invalid, reject.  _Fail-closed:_ no receipt, abort.
2. **.slm Validation**: Parse the `.slm` container and manifest, checking internal checksums and format.  If parsing or checksums fail, abort.
3. **Provenance/License Review**: Check manifest metadata for license.  Only allow OSI-approved or explicitly permissive licenses.  (E.g. proprietary by default is forbidden.)  If disallowed, mark as “revoked/quarantined” and abort.
4. **Piece Generation**: Split the artifact into fixed-size pieces, hash each piece, and write into the shared piece store (read-only).  Generate a Merkle root or piece list checksum.  If any file-write or hash fails, abort.
5. **Local Round-Trip**: Attempt to load the assembled model on each lane locally (run a short inference or health check).  If one lane fails to load, do not admit model.
6. **Two-Lane Serving**: Start two lane processes bound to all configured endpoints.  Each lane must confirm it has loaded the model.  (If one lane crashes immediately, mark as “degraded” but proceed to proof stage.)
7. **External Proof**: Wait for outside observer to fetch a test piece from *both* lanes and sign a receipt (see §8).  Require successful proofs for both lanes.  On failure or timeout, model remains unadvertised.
8. **Catalog Publication**: Once a valid signed receipt (with expiry) covering both lanes is obtained, publish the model entry in MiniModel’s catalog (`models.v0.json`) as “active” with metadata and the proof.

At *each step*, failure is terminal for admission.  For example, if license is problematic, we abort and do not proceed to piece-splitting.  If initial lane binding fails (port conflict), the entire model entry is invalid.  If proof is missing, we do not list the model.

# 5. Independent Process Supervision
Each lane process must be supervised independently.  At startup, each lane **pre-binds all configured endpoints** (e.g. listens on IP/port) before declaring “ready.”  If any bind fails (address/port conflict), the process must immediately exit (fail-closed) and not serve partial content.  We implement this by opening all sockets early (e.g. in .NET `KestrelServerOptions` or Rust `TcpListener::bind`) and checking errors.

A lane uses graceful shutdown: on SIGTERM or StopService, it stops accepting new connections and **drains** active transfers (e.g. finish current GET requests) before exit.  This ensures no partial piece delivery.  If a lane unexpectedly dies (exception or OS kill), the supervisor (Windows Service Manager or systemd) must automatically restart it.  Each lane’s configuration and keys are persisted so restart is seamless.

- **Windows**: We install each lane as a Windows Service (using `sc.exe create` or a tool like NSSM), configured to restart on failure. The service’s `OnStart` handler binds sockets; `OnStop` triggers a graceful drain then exit.
- **Linux**: We use two `systemd` user-services (`[Service]` units with `ExecStart=/path/to/lane`) and optional `.socket` units if socket-activated. `Restart=on-failure` ensures automatic restarts.  The unit file sets `KillMode=process` so each lane dies independently, and `TimeoutStopSec` allows graceful wait.  On `systemctl stop`, the service will remove endpoints after draining.

Both systems ensure **isolation**: one lane failure doesn’t affect the other, and collisions (same port) cause immediate restart of the offending lane only.  Configuration and identity (keys) are read-only and shared as needed; e.g. both lanes read the same piece store.  We also constrain each lane’s OS process: run under a dedicated user or sandbox, with no file-write access to global FS (only to read pieces and write logs).

# 6. Resource Governance and Capacity Model
We assume *M* models (target 20), each of size *S* (bytes).  For planning: TinyLM-16M q4_0 is ~10.16 MiB; assume average S≈10 MiB.  Then total storage ≈ *M·S* ≈ 20×10 MiB = **200 MiB** of artifacts. The shared piece store adds only metadata (few KB per piece) so <1 MiB extra.  Page cache usage will be similar (OS caching of model files).

**Memory:** Each lane loads one model at a time. TinyRustLM’s KV-cache for TinyLM-16M is ~8 MiB; the WASM runtime overhead ~1–2 MiB. So one lane uses ~10 MiB VM. Two lanes per model ≈20 MiB per model memory in use if both active. Worst-case 20 models concurrently (assuming concurrent serving) ≈400 MiB.  Plus OS (say 2 GiB free recommended). CPU: hashing the pieces for each model happens at admission/verification; suppose SHA-256 of 10 MiB takes ~0.1s on one core, negligible for on-demand. Ongoing CPU is minimal (just I/O and serving).

**File descriptors:** Each lane listens on one or more sockets (TCP). If we allow X connections concurrently per lane (e.g. X=8), then FDs ≈ *2 lanes/model · M* + *2* (listener sockets) + *2·M·X* (client sockets). For M=20, X=8: ~40 listeners + (20·16)=320 client FDs = ~360 FDs. Keep conservative limits (ulimit ~1024).

**Connections and Fairness:**  We enforce *per-lane and per-peer concurrency caps*.  By default, each lane allows ~8 simultaneous GETs (threads or async tasks).  Globally, we may allow 16 per model (8 per lane) so 320 concurrent across 20 models.  We use *weighted fair queuing*: if one model is “hot” (many requests), it gets at most its share (8). Unused slots from idle models can be borrowed by busy ones.  Each HTTP response stream is limited (e.g. 1 MiB/s per connection, or configurable). We also set a *max upload rate* per peer IP (say 10 MB/s) to prevent abuse.

**Hot/Cold Policy:** Models not requested recently may be demoted to “cold” pool: lanes will still keep the pieces on disk but drop cached WASM pages (after an LRU timeout) to free memory.  On a new request, the lane may need to reload the model (we will detect via manifest checksum if needed).   If a model is active but infrequently used, threads will idle after a timeout (configurable, e.g. 30s).

**DoS Controls:** We limit requests per minute per IP (e.g. 60 piece fetches/min).  We drop requests without a valid Referer or Origin (only known P2P peers or browsers that were allowed).  We reject overly large or repeated range requests (see next).  If a client repeatedly times out or sends bad hashes, we temporarily blacklist its IP.  Logging tracks abnormal patterns.

**Capacity for 1, 5, 20 models:**  If only 1 model, resources scale down.  E.g. 1 model uses 10–20 MiB memory, ~16 FDs, ~10 MiB disk.  For 5 models: ~50–100 MiB, ~80 FDs.  For 20 models, as above (~400 MiB, ~360 FDs).  We dimension the host machine accordingly (recommend >=2 GiB RAM, 1 GHz CPU, 1 Gbps NIC).

# 7. Strict HTTP Serving Profile
We design the HTTP API with minimal attack surface.  Only the following are **allowed**:

- **Methods**: `GET` (for pieces and manifests) and `HEAD`.  All others (`POST`, `PUT`, `DELETE`, etc.) are rejected with 405.  We do *not* allow any write operations via HTTP.
- **Routes**: Fixed, parameterized routes only. For example, `/v1/models/{modelId}/pieces/{pieceIndex}` or `/v1/pieces/{hash}`.  We validate `{modelId}` as a 64-char hex and `{pieceIndex}` as an integer within range.  No directory listings or implicit globbing.
- **Piece Names**: Only exact names are served.  E.g. `/pieces/0000, /pieces/0001, …`.  We do not serve from `.` directories or accept path navigation (no `..` segments). All paths are normalized per [RFC 7230].
- **Headers**: We allow only a minimal set of request headers: `Host`, `User-Agent`, `Accept`, `Range`, `If-None-Match` (for caching), and standard connection control (`Connection`, `Keep-Alive`).  We impose limits on header size (e.g. 16 KB total) to prevent header-based DoS.  We include strict response headers: `Content-Type: application/octet-stream; charset=utf-8` for pieces.  If a request has unknown or unsafe headers (e.g. `Transfer-Encoding: chunked` with no `Content-Length`), we reject it.
- **CORS**: Since the browser UI runs on `localhost`, we allow CORS from `http://localhost:<UI port>` only.  (Otherwise, we would not allow arbitrary `Origin=*` because these endpoints are not meant for general web use.)  Specifically, responses include `Access-Control-Allow-Origin: http://localhost` and `Access-Control-Allow-Methods: GET, HEAD`, and we do not allow credentials (`Access-Control-Allow-Credentials: false`).
- **Ranges**: We support HTTP Range requests (RFC 7233) *only for a single contiguous range*.  We explicitly **reject** multi-part or overlapping ranges.  Per RFC 7233 security guidance, we coalesce any overlapping ranges or reject requests with more than 2 range-specs.  In practice, each range request must request one piece or a contiguous slice – any request for many small or overlapping ranges is returned 416 “Range Not Satisfiable”.
- **Content-Length**: All GET responses include an exact `Content-Length`.  We do not support `Transfer-Encoding: chunked` on responses (except if TLS or proxies automatically chunk).
- **Timeouts**: We close idle connections after 10 seconds and abort any response taking longer than 60 seconds.  A single piece (e.g. 64 KB) should serve quickly; any transfer larger than ~100 ms for a 64 KB block indicates trouble and is aborted.
- **Path Normalization**: The server normalizes the request target according to RFC7230 (removing any “../” or redundant “/”).  We never resolve symlinks in the piece store path: the directory holding pieces has restricted permissions, and we use functions that disable symlink traversal.  Thus even if a crafted path got through, it cannot escape the intended directory.
- **Request Smuggling**: We disable “HTTP/0.9” (only HTTP/1.1 or later) and require `Host:` in every request (rejecting missing Host).  We also forbid dual content-length: if both `Content-Length` and `Transfer-Encoding` are present, we reject the request per best practice.  Our HTTP library (e.g. ASP.NET Core) should handle normal parsing, but we double-check the message framing is unambiguous.
- **Connection Close**: While we allow keep-alive, any client can include `Connection: close` to drop the connection.  On server shutdown, we send `Connection: close` to signal end.  We do not rely on HTTP/0.9 keep-alive hacks.
- **No HTTP/2/0-MIB Features**: We use HTTP/1.1 only.  Advanced features like HTTP/2 PUSH or websockets are not supported.  We also do not allow GET with a body.

This strict profile minimizes risk.  For example, the RFC warns that overlapping Range queries can cause DoS.  We follow that advice by rejecting such patterns.

# 8. NAT and Reachability Workflow
We report each lane’s reachability as follows:

- **Local only**: If no NAT traversal is configured, the lane is only bound to loopback or LAN. This is not “public”.
- **LAN**: We test on the LAN (e.g. using a second machine on the same network) to see if the lane is reachable by its local IP.  Success means the host firewall allows LAN, but still not necessarily public.
- **Hairpin NAT**: Some routers support hairpinning (NAT reflection). We test if accessing the host’s public IP (from inside) loops back to the service.  A success here only indicates NAT reflection works, not true public reachability.
- **IPv4 Forwarding**: We test if the router has port-forward (either manually set up or via UPnP/NAT-PMP) so that the host’s lane port is reachable from the Internet.  If the host has a real public IPv4, this is trivial; if behind NAT, this requires configuration.
- **IPv6**: If the host has a global IPv6 address (not just link-local), we treat that as a direct route (no NAT needed). We then test reachability via IPv6.
- **CGNAT / Double NAT**: If the host is under a Carrier-Grade NAT or multiple NATs, IPv4 connectivity may not be directly achievable.  With DS-Lite or CGNAT, one can use PCP (Port Control Protocol, RFC6887) or NAT-PMP/UPnP to request a mapping, but note: PCP is not widely supported in client OS’s; many residential gateways support UPnP IGD but not always PCP.  In practice, as one answer notes, “with DS-Lite, the home router will translate UPnP/NAT-PMP to PCP and forward it”, but this is not guaranteed on all routers.
- **Operator Tunnels/Relay**: Advanced options (e.g. a configured VPN relay or Reverse SSH tunnel) are out of scope.  We do *not* open UPnP or PCP automatically (per constraint). The first release requires manual setup if needed.

We report statuses in the catalog as: **Not Configured**, **LAN-Only**, **IPv4-NAT**, **IPv6-Direct**, **IPv4-CGNAT**, or **Public**. “Public” means an outside observer successfully reached the lane. We never advertise “public” just because hairpin or LAN succeeded. Only a true external test (below) counts.

# 9. Outside Proof and Announcement Protocol
We design a **signed proof receipt** that an external observer fetches from each lane.  The observer (with its own Ed25519 key pair) performs these steps:

1. Observer retrieves a fresh authenticated base piece from Lane A’s external address (HTTPS).  It verifies the content hash matches the manifest, and records the hash.
2. It does the same for Lane B (the second endpoint).
3. It constructs a canonical JSON payload that includes at least: modelId, artifactId, pieceSetId, laneA endpoint URL, laneB endpoint URL, observerId (public key or ID), the content-hashes of the responses (should match each other), implementation version, a random nonce, observationTime (UTC), and a short expiration time (e.g. +24h).
4. It signs this payload with its Ed25519 private key (RFC8032) to produce a receipt.  The canonical form should follow Ed25519’s rules (e.g. using little-endian byte encoding for fields as needed).
5. The signed receipt is submitted back to the host (or directly to MiniModel.org).

For example, a JSON receipt might look like:
```json
{
  "modelId": "5ac2bd...bb365b",     // SHA-256 of artifact
  "laneA": "https://1.2.3.4:8000/",
  "laneB": "https://1.2.3.4:8001/",
  "observerId": "03fda1...9bf0",   // observer's public key (hex)
  "pieceHash": "abcd1234...fedc",  // SHA-256 of piece fetched
  "version": "tinyhttpd 1.2.3",
  "nonce": "rY7kQfZ8",            // random
  "observedAt": "2026-07-14T20:00:00Z",
  "expiresAt": "2026-07-15T20:00:00Z"
  // ...signed by observer...
}
```
The observer’s **Ed25519 signature** covers the entire payload.  (By RFC8032, Ed25519 signatures are non-malleable and cover all fields; any JSON canonicalization must ensure consistent field ordering and no additional whitespace.)

**Security considerations:** The receipt ties identities together: the model and lanes (by content-hash and URL) and the observer’s key.  We protect against replay by including a unique nonce and a short expiry.  Clock skew is mitigated by using UTC in all parties and allowing a small margin (e.g. 5 min).  If the observer’s key is later compromised, we can revoke by publishing a new observer list; old receipts can be invalidated by expiry or revocation list.  We consider requiring *multiple observers* in the future (quorum) for high-value models, but initially one trusted observer suffices.

We store the proof receipt in MiniModel’s catalog: each lane announcement references the receipt ID and expiry.  A model is advertised only when a valid receipt exists for *both* lanes.  If either lane’s proof expires or becomes invalid (e.g. the lane changed IP), the model reverts to Pending and is removed from Public view until reproof.

# 10. Catalog Lifecycle and User-Facing States
Models transit through states: **Pending → Active → Degraded → Stale → (Superseded) → Removed/Revoked** (with “quarantined” as a special state).

- *Pending*: Just admitted locally, awaiting outside proof or awaiting the second lane to come up. Not shown publicly.
- *Active*: Both lanes are serving, proof is valid and unexpired. Model appears in public catalog as available.
- *Degraded*: One lane has failed or proof for one lane expired, but the other is still up. We mark the model “Degraded” in catalog (gray banner).  Peers see only one endpoint available, but can still download (less redundancy). The UI will show a warning (e.g. “One lane offline”).
- *Stale*: Both lanes are offline or unreachable, or proof has expired for both. The model is not advertised (or shown as “Offline”). Clients see it as unavailable.
- *Superseded*: If a new version of the model (distinct artifact) is admitted, the old one goes to “Superseded” and eventually “Removed”. It may remain downloadable via P2P peer if a copy exists, but not listed as current.
- *Quarantined*: If a manifest or license later proves invalid (e.g. license revocation or security issue), we mark the model “Quarantined” and take it down until investigation.  Users see a warning that it’s under review.
- *Revoked/Removed*: If e.g. license is non-compliant or safe use broken, the model is removed entirely and not downloadable.

**User view examples:** If one lane dies, the catalog entry might say “Model X (degraded)” and on click show only Lane B’s endpoint. If both fail, the entry is hidden or marked “offline”. If proof expires (e.g. after 24h) without renewal, the entry becomes “stale”. If license is flagged, the entry is grayed out or removed. If model quality is updated (unlikely for immutable artifact), we could mark “old”.

# 11. Resumable Import and Corruption Handling
Clients importing models from peers must verify identity before mixing data.  Our import protocol:
- The client fetches the manifest from the peer and verifies its hash equals the expected Model ID.  It also verifies the peer’s proof receipt matches the manifest.  If the peer’s model identity differs, the import is aborted (strict identity agreement).
- The client then downloads pieces (parallel or sequential).  Each piece is fetched and its SHA-256 is checked against the manifest’s list.  We use a **durable journal**: after downloading each piece to disk, we log the piece index and hash in a temp file.  If the process is interrupted, it can resume from the last logged piece.
- If a piece fails hash, we **quarantine** that piece: delete it and ban/notify the peer of data corruption.  The client may retry from another peer (if available) or abort.
- Only when all pieces have been fetched and verified do we *atomically promote* the model: rename the temp directory into place.  This ensures partial imports are not treated as complete.
- Finally, the client does a local load of the new model (TinyRustLM load) to double-check integrity (as a sanity test).  If this fails, the entire import is rejected and the model is quarantined for this client.

This process ensures corruption is caught and no mixed identities are allowed.  The journal and atomic rename guarantee resumability.

# 12. Continuous Verification and Operations Runbooks
Once models are live, we maintain them:

- **Local Health Checks:** Each lane process pings itself periodically (e.g. fetch a trivial endpoint like `/health`).  If no response, supervisors restart the lane.  We also periodically (every 5 min) verify a random piece from disk locally to detect silent corruption.
- **Proof Renewal:** The outside proof has a TTL (e.g. 24h). We schedule renewal attempts each lane (e.g. at 80% expiry) by asking the observer to re-fetch a piece.  If renewal fails, the model is marked “pending” again and eventually stale.
- **Announcement Heartbeat:** We re-publish the presence in the MiniModel catalog every X minutes (e.g. 30 min) even if nothing changed, to indicate liveliness.  This “heartbeat” is an updated timestamp in the announcement.
- **Stale Timeout:** If no activity on a model for a configurable time (e.g. 7 days) and no proof renewal, we mark it Stale.  Stale models may auto-remove after a further grace period unless revived.
- **Random Spot-Checks:** Occasionally (e.g. daily), we run a peer-to-peer loopback: one lane tries to fetch a piece from the other lane through the local network.  If it fails (inconsistent data or broken link), we raise an alarm.
- **Full Revalidation:** Periodically (monthly), we re-hash entire model artifacts on disk and compare to the recorded SHA-256 in the manifest (e.g. re-compute ModelId).  This guards against bit-rot or storage corruption.
- **Bandwidth Accounting:** We maintain counters of bytes uploaded per model and per peer IP.  These counters are logged (rotated daily) for monitoring and billing if any.  We ensure no personal data is logged: logs contain only (anonymized) IPs, timestamps, bytes transferred, and Model IDs.
- **Privacy-preserving Diagnostics:** We do not phone home any usage. All logs are local or sent to standard output. Any telemetry (e.g. crashed processes) is collected by local tools only. No proprietary telemetry services are used; we may optionally support an open metrics API (Prometheus) without identifying information (e.g. counts and latencies per model, but no user content).

A runbook is defined for common issues:
- *Lane down*: check supervisor logs, restart lane process, verify disk space.
- *Proof fails*: instruct observer to re-verify, check port forwarding.
- *High CPU/Memory*: check for unexpected traffic, consider throttling.
- *License flagged*: quarantine the model and escalate for audit.

# 13. Test Matrix and Acceptance Criteria
We propose the following staged testing:

- **Unit Tests / CI**: Validate core logic (manifest parsing, hashing, HTTP routing) in CI.  Simulate one lane with a fake HTTP GET to test endpoints.  These tests can run without any network.
- **Local Fixture**: On a dev machine, set up two lane processes for **one real model** (e.g. TinyLM-16M q4_0 from MiRust) with two different ports. Verify each lane serves pieces to localhost. Test with TinyRustLM browser UI to import via P2P using `localhost`. Kill one lane (e.g. `kill -9`), verify supervisor restarts it and the catalog shows “degraded” then “active” again.
- **External Observation**: Use a second machine (or VM) on the Internet (with its own IP) to connect to the host’s lanes. Configure port-forwarding or IPv6 so it can reach the lanes. Have it fetch a piece and generate a receipt. Verify the receipt is accepted and the model appears “active” in the catalog. Also test with one lane down (simulate) to see that no combined receipt is issued and model stays pending.
- **Peer Import Test**: On a third machine running TinyRustLM UI, use the P2P “Known Peer URL” feature to import the model from the first machine. Verify resumable download (e.g. interrupt and resume) and that the final model loads correctly.
- **Incremental Scaling**: Repeat with 5 models: observe resource usage and ensure fairness (e.g. simultaneously request pieces from multiple models). Finally go to 20 models and repeat. Monitor CPU, memory, and throughput to ensure stability.
- **Failure Scenarios**: Test cases: HTTP malformed requests (blocked), overlapping range (rejected), unauthenticated methods (rejected), symlink attempts (denied). Also simulate NAT change (disable IPv6 or change public IP) and verify status changes appropriately.
- **License/Quality**: As a negative test, try admitting a “bad” model (e.g. manually edit a manifest to have a GPL license if proprietary is disallowed). Confirm the system refuses admission.

We separate what CI can prove (logic, unit, and multi-lane on localhost) from what needs manual or infra (external reachability, NAT setups, real observer keys).  For external tests we rely on either test observers or our own cloud instance acting as observer.

# 14. Implementation Backlog
We recommend iterative rollout: first build single-lane HTTP serve + piece store + admission parser; then add dual lanes and supervisor scripts; then integrate proof handling.  The final cutover to production should wait until external observers and catalog submission are tested end-to-end.  Key backlog items:
- Implement lane server (HTTP GET with range support) with strict routing.
- Build admission pipeline (manifest validator, license checker).
- Develop piece store format (e.g. one file per piece).
- Add dual-lane supervisor and config.
- Integrate proof receipt handling (Ed25519 signing & verification).
- Write systemd service files and Windows service installer.
- Test NAT detection (integrate STUN or manual).
- Finalize catalog API usage (push JSON to MiniModel.org).
- Write runbook docs.

# References
- Fielding *et al.*, *“RFC 7233: HTTP/1.1 Range Requests”* (June 2014) – advises rejecting overlapping/many ranges.
- Josefsson & Liusvaara, *“RFC 8032: EdDSA (Ed25519)”* (Jan 2017) – defines Ed25519 signature format.
- Grawity (StackExchange), *“Using PCP (Port Control Protocol) in practice?”* (Mar 2018) – notes that UPnP IGD is common, PCP/NAT-PMP support is limited.
- Tailscale Blog (15 Oct 2025), *“NAT traversal”* – reports CGNAT often uses short timeouts and symmetric NAT, forcing relays.
- MiRust.com *“TinyLM-16M deterministic smoke — q4_0”* (2026-06-25) – artifact size ~10.16 MiB and license metadata.
- TinyRustLM.com Developer UI (Jul 2026) – indicates a “MiniModel demo autoload” from MiniModel.org.
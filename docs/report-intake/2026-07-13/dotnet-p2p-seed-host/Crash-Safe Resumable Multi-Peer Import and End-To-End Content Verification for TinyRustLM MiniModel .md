# Crash-Safe Resumable Multi-Peer Import and End-To-End Content Verification for TinyRustLM MiniModel `.slm`

This report proposes a resumable, crash-safe import design for TinyRustLM/MiniModel `.slm` artifacts using only public internet sources and the constraints in your prompt. I did **not** inspect any private repository, unpublished schema, local file, runtime artifact, or test result, and I do **not** claim any local behavior was executed or verified. Where TinyRustLM public sources are silent, I label the result as a proposal or an assumption rather than a fact.

## Evidence boundary and assumptions

Public TinyRustLM materials already establish the core trust boundary that this design should preserve. The public app surface exposes local `.slm` import, P2P import, share metadata, peer status, companion inventory, and a receipt ledger, and the developer portal describes TinyRustLM as a browser-local Rust/WASM runtime with verified `.slm` artifacts, checksums, receipts, and tests. The public `.slm` page also says the format is validated through header checks, tensor-directory checks, tokenizer checksum, layout checksum, and finite-payload checks. The public adapter page is even more explicit: the browser may fetch and checksum bytes, but Rust remains the authority for semantic validation. citeturn19search0turn30search2turn32search1turn30search1

A particularly important public implementation note says that, in the currently documented local `.slm` path, the browser fetches the complete artifact and calls `load_model`, Rust validates SLM structure, checksum, tokenizer, tensor directory, required names, shapes, and storage encodings, and the runtime reports `Ready` only after model storage, scratch, KV cache, and logits succeed. That same note also says the adjacent manifest is fetched **after** model acceptance and is not yet cryptographically verified. Another public note describes model loading as a commit-like transaction that only succeeds after parsing, tensor materialization, scratch creation, KV allocation, and logits allocation all succeed. Those public notes are valuable because they justify a stricter import design for P2P: for resumable network import, the manifest and piece-set need to become part of the **pre-runtime** trust chain, not operator-only decoration after acceptance. citeturn36view0turn37view0

The assumptions below are therefore the minimum I am using for the proposal. First, Rust remains the sole authority for import-request validation, peer-status validation, manifest and piece-set validation, per-piece verification, whole-artifact `.slm` validation, and receipt validation. Second, the first production artifact is approximately 925 MiB with approximately 925 fixed-size pieces, which implies an engineering target of about 1 MiB per piece. Third, the same wire objects must be understood by Rust, browser, and .NET clients, so the on-disk and over-the-wire representations should be canonical and versioned. Fourth, no partial artifact may be visible to the runtime, which means the final runtime-visible path must appear only after complete verification and atomic promotion. Fifth, because browser durability semantics are partly API- and implementation-dependent, browser persistence should use OPFS for piece bytes and IndexedDB with `strict` durability for state metadata where available, but this still requires local compatibility testing before claiming guarantees for a specific browser/version. The IndexedDB specification explicitly distinguishes `strict` from `relaxed` durability, and OPFS exposes synchronous file access plus an explicit `flush()` method to persist writes. citeturn42view0turn11search3turn11search7turn11search15

The largest public gap is schema detail. Public TinyRustLM pages show that the system has a manifest, share metadata, peer status, companion inventory, receipts, and state ledgers, but they do **not** publish the exact JSON schemas or canonicalization rules for those objects. Accordingly, the schema in this report is a proposed interoperable design, not a reverse-engineered statement of what the private implementation already does. citeturn19search0turn35search16turn36view0

## Trust order and import state machine

The safest order is the order in your prompt, with one additional rule: every state change that matters for resumption must be durable **only after** the predicate that justifies it has already been decided by Rust. That rule matches the current public TinyRustLM posture that Rust owns validation and that commit-like transitions only succeed after all required allocations and validation gates complete. citeturn30search1turn36view0turn37view0

### Trust and fetch order

| Durable state | Operation | Rust-owned predicate | Why this must happen before the next step |
|---|---|---|---|
| `RequestValidated` | Normalize and validate the local import request | Request syntax valid; selected manifest identity acceptable; destination policy acceptable; peer URL policy acceptable | Prevents SSRF-style fetches, credential leakage, path misuse, and manifest ambiguity before any network I/O |
| `PeerStatusValidated` | Fetch bounded peer status from one peer | Peer-status schema valid; endpoint class acceptable; claimed content identity fields structurally valid | Prevents unbounded or unsafe network traversal before chasing piece metadata |
| `PieceSetValidated` | Fetch and validate piece-set metadata | Piece size/count/hash algorithm/Merkle metadata bind to selected manifest | Without this, piece indices and hashes have no trustworthy meaning |
| `CompanionValidated` | Fetch and validate companion state | Companion state is syntactically valid, sufficiently fresh, and refers to the same manifest/piece-set | Availability data is meaningless until the piece namespace is validated |
| `PreflightBound` | Bind request, manifest, piece-set, Merkle root, companion state, and peer observations into one immutable preflight identity | Rust returns a canonical `content_identity` for the import | This is the line that forbids mixing peers or metadata that disagree |
| `FetchingPieces` | Schedule and fetch one or two lanes | Scheduler only asks for pieces in the bound preflight | Prevents incompatible-manifest mixing |
| `PiecesVerified` | Verify every piece | Rust verifies size, piece hash, and Merkle binding for each completed piece | A piece may only become complete after the Rust verdict |
| `TempAssembled` | Assemble a hidden temporary artifact | All pieces are complete for the bound artifact | Concatenation before complete piece coverage creates truncation and hole risks |
| `ArtifactVerified` | Verify the whole `.slm` | Rust validates full `.slm` structure, checksums, tokenization/layout/config/runtime gates | Prevents a merely piece-correct but semantically invalid model from becoming visible |
| `Promoted` | Atomically promote into final store | Destination replacement succeeded atomically on the same filesystem/volume | Prevents runtime visibility of partial assembly |
| `ReceiptValidated` | Write receipt and immediately re-read/revalidate it | Rust validates the receipt contents and the receipt chain binding | Prevents exposing a model with missing or malformed provenance |
| `Completed` | Expose model to runtime/catalog | Only after all prior durable gates succeeded | This is the only visibility point |

Changing that order creates crisp attack or corruption paths. If peer status is skipped or fetched without bounds, an attacker can force the client into unsafe hosts, oversized status bodies, redirect chains, or local-network targets before the import ever knows what it is importing. If piece-set metadata is fetched after companion inventory, then piece numbers, counts, and availability are interpreted in an untrusted coordinate system, which is a textbook confusion bug. If companion state is not bound to the manifest and piece-set before scheduling, two peers can both look “healthy” yet serve different piece universes. If a piece is marked complete before Rust verifies it, the resume journal becomes a corruption amplifier. If the runtime can see the final path before whole-artifact verification and atomic replacement, a power loss can expose a truncated or structurally invalid `.slm`. If exposure happens before receipt revalidation, the system can end with a loaded model but missing provenance, which breaks your chain-of-custody requirement. Public TinyRustLM documentation already treats validation and acceptance as explicit commit points, so the proposed order extends that same discipline to network import. citeturn36view0turn37view0turn10search2turn26view0

### Explicit import state machine

The durable state machine should be small, monotonic, and restart-friendly. In-flight work is deliberately **not** durable state; after a crash, the importer restarts from the last durable checkpoint, not from an in-memory substep.

| State | Allowed durable transitions | Terminal |
|---|---|---|
| `New` | `RequestValidated`, `Rejected`, `Cancelled` | No |
| `RequestValidated` | `PeerStatusValidated`, `Rejected`, `Cancelled` | No |
| `PeerStatusValidated` | `PieceSetValidated`, `Rejected`, `Cancelled` | No |
| `PieceSetValidated` | `CompanionValidated`, `Rejected`, `Cancelled` | No |
| `CompanionValidated` | `PreflightBound`, `Rejected`, `Cancelled` | No |
| `PreflightBound` | `FetchingPieces`, `FailedPermanent`, `Cancelled` | No |
| `FetchingPieces` | `FetchingPieces`, `AllPiecesVerified`, `FailedPermanent`, `Cancelled` | No |
| `AllPiecesVerified` | `TempAssembled`, `Cancelled` | No |
| `TempAssembled` | `ArtifactVerified`, `FailedPermanent`, `Cancelled` | No |
| `ArtifactVerified` | `Promoted`, `FailedPermanent`, `Cancelled` | No |
| `Promoted` | `ReceiptValidated`, `FailedPermanent` | No |
| `ReceiptValidated` | `Completed`, `FailedPermanent` | No |
| `Completed` | none | Yes |
| `Rejected` | none | Yes |
| `Cancelled` | none | Yes |
| `FailedPermanent` | none | Yes |

Crash handling is deterministic: if the process dies during status fetch, piece download, piece verification, assembly, rename, or receipt write, restart logic replays the durable journal and resumes from the last committed state. There is no “half state” in the durable model. That approach follows the same operational idea reflected in the public TinyRustLM notes about load and generation being explicit transactions with rollback or recovery behavior. citeturn37view0turn39view1turn20search10

### Orchestrator pseudocode

```text
function ImportCoordinator(request):
    ctx = ResumeOrCreateImport(request)

    if ctx.state < RequestValidated:
        req_ok = Rust.ValidateImportRequest(request)
        Journal.Commit("RequestValidated", req_ok.normalized_request)

    if ctx.state < PeerStatusValidated:
        peer_status_bytes = Http.GetBounded(req_ok.peer_status_url, policy=ctx.net_policy)
        peer_status = Rust.ValidatePeerStatus(req_ok, peer_status_bytes)
        Journal.Commit("PeerStatusValidated", peer_status.observation)

    if ctx.state < PieceSetValidated:
        piece_set_bytes = Http.GetBounded(peer_status.piece_set_url, policy=ctx.net_policy)
        piece_set = Rust.ValidatePieceSetMetadata(req_ok, peer_status, piece_set_bytes)
        Journal.Commit("PieceSetValidated", piece_set.binding)

    if ctx.state < CompanionValidated:
        companion_bytes = Http.GetBounded(peer_status.companion_url, policy=ctx.net_policy)
        companion = Rust.ValidateCompanionState(req_ok, peer_status, piece_set, companion_bytes)
        Journal.Commit("CompanionValidated", companion.binding)

    if ctx.state < PreflightBound:
        preflight = Rust.BindImportPreflight(
            request=req_ok,
            peer_status=peer_status,
            piece_set=piece_set,
            companion=companion
        )
        Journal.Commit("PreflightBound", preflight.identity)

    if ctx.state < AllPiecesVerified:
        RunPieceScheduler(preflight, Journal, Rust, Http, Store)

    if ctx.state < TempAssembled:
        tmp_artifact = Store.CreateHiddenAssemblyFileSameVolume(preflight.final_path)
        Assembler.ConcatenateVerifiedPieces(preflight, tmp_artifact)
        Store.FlushAssembly(tmp_artifact)
        Journal.Commit("TempAssembled", { "tmp_name": tmp_artifact.name })

    if ctx.state < ArtifactVerified:
        artifact_verdict = Rust.ValidateCompleteSlm(preflight, tmp_artifact.path)
        Journal.Commit("ArtifactVerified", artifact_verdict)

    if ctx.state < Promoted:
        Store.AtomicPromote(tmp_artifact.path, preflight.final_path)
        Store.FlushPromotedFile(preflight.final_path)
        Journal.Commit("Promoted", { "final_path_token": Store.LogicalToken(preflight.final_path) })

    if ctx.state < ReceiptValidated:
        receipt = Rust.BuildImportReceipt(preflight, preflight.final_path)
        Store.WriteReceiptTemp(receipt)
        receipt2 = Store.ReReadReceipt()
        Rust.ValidateReceipt(preflight, receipt2)
        Store.AtomicPromoteReceipt()
        Journal.Commit("ReceiptValidated", { "receipt_hash": receipt2.sha256 })

    if ctx.state < Completed:
        ExposeModel(preflight.final_path, receipt_hash)
        Journal.Commit("Completed", { "exposed": true })
```

The important property is that .NET or browser orchestration never substitutes its own trust rules for Rust’s. The coordinator may manage retries, storage, deadlines, and resource budgets, but every trust-bearing decision is a Rust verdict. That matches the public TinyRustLM statement that the browser may fetch and checksum bytes while Rust remains the semantic authority. citeturn30search1turn36view0

## Durable resume journal and safe staging layout

The resume system should be a **versioned event journal plus compacted snapshot**, not a single mutable blob. At 925 pieces, resumption is still small enough to replay quickly, and the event log gives much cleaner crash semantics than ad hoc mutation. This is the same reason database and update systems favor write-ahead logging and consistent metadata views. TUF’s metadata model also illustrates why identity-bearing metadata should carry hashes and sizes explicitly, while OCI descriptors illustrate the same pattern for content-addressed artifacts. citeturn18search0turn18search16

### Proposed versioned resume-state schema

The schema below is a proposal for `import-resume.v1`. Field names are canonical, UTF-8 JSON with lowercase hex digests and UTC timestamps. The same schema is used in Rust, browser, and .NET.

```json
{
  "schema_version": "import-resume.v1",
  "store_instance_id": "uuidv7-or-v4",
  "import_id": "uuidv7-or-v4",
  "created_utc": "2026-07-13T00:00:00Z",
  "updated_utc": "2026-07-13T00:00:00Z",
  "journal_seq": 0,
  "state": "PreflightBound",

  "request": {
    "request_hash_sha256": "hex",
    "manifest_selector": {
      "manifest_id": "string",
      "manifest_hash_sha256": "hex"
    },
    "logical_target_store": "models",
    "peer_mode": "single-or-dual"
  },

  "binding": {
    "manifest_hash_sha256": "hex",
    "artifact_sha256": "hex",
    "artifact_size_bytes": 969932800,
    "piece_size_bytes": 1048576,
    "piece_count": 925,
    "piece_hash_alg": "sha256",
    "piece_set_hash_sha256": "hex",
    "merkle_root_sha256": "hex",
    "slm_format_version": "SLM1-or-public-equivalent",
    "tokenizer_checksum": "hex",
    "layout_checksum": "hex",
    "quantization_mode": "q4_0|q8_0|f32",
    "content_identity_hash_sha256": "hex"
  },

  "preflight": {
    "preflight_hash_sha256": "hex",
    "selected_peers": [
      {
        "peer_slot": 0,
        "peer_origin": "scheme://host:port/path-base",
        "peer_content_identity_hash_sha256": "hex",
        "peer_status_observed_utc": "2026-07-13T00:00:00Z",
        "companion_observed_utc": "2026-07-13T00:00:00Z"
      }
    ]
  },

  "pieces": {
    "verified_bitmap_base64": "bitset",
    "verified_count": 0,
    "retry_counts": [0, 0, 0],
    "last_error_codes": ["", "", ""],
    "quarantine_until_utc": ["", "", ""],
    "peer_owner_slot": [-1, -1, -1]
  },

  "assembly": {
    "temp_artifact_name": "assembly/model.slm.tmp",
    "assembly_started_utc": null,
    "assembly_completed_utc": null
  },

  "receipt": {
    "receipt_state": "none|pending|validated",
    "receipt_hash_sha256": null,
    "previous_receipt_hash_sha256": null
  },

  "integrity": {
    "snapshot_sha256": "hex",
    "snapshot_mac_hmac_sha256": null,
    "prev_snapshot_sha256": "hex-or-null"
  }
}
```

`import_id` should be a UUID because the RFC-defined 128-bit format is widely interoperable; UUIDv7 is a good fit if you want roughly time-ordered identifiers. `store_instance_id` binds state to one logical store instance and is checked on every resume. citeturn23search0turn23search2

Secret exclusions must be absolute. The resume journal, request object, logs, receipts, and peer URLs must contain **no** Authorization headers, cookies, bearer tokens, signed query strings, username/password URL userinfo, OS credential-store references, or absolute user-origin paths. RFC 3986 explicitly says `user:password` in URI userinfo is deprecated, may be rejected, and should not be stored unencrypted because URIs are logged and displayed widely. I would therefore reject any peer URL containing userinfo, query, or fragment for the first implementation. If a future deployment truly needs credentials, keep them memory-only and header-only, never journaled and never embedded in URLs. citeturn27view0turn27view2

### Write-ahead behavior, checksums, MACs, and copied-state rejection

The journal should use append-only events such as `RequestValidated`, `PeerStatusValidated`, `PieceVerified(index)`, `PieceRejected(index, reason)`, `ArtifactVerified`, `Promoted`, and `ReceiptValidated`. Each event frame is length-prefixed and CRC-protected so torn writes are detectable and replay can stop at the last good frame. Periodically, the importer writes a compact `snapshot.json.new`, flushes it, atomically replaces `snapshot.json`, and then continues appending events. On restart, it loads the snapshot, verifies its checksum or MAC, replays events in sequence order, and truncates any trailing torn frame. On Linux, file `fsync()` is not enough to persist the containing directory entry; the man page explicitly says the directory must also be `fsync()`’d. citeturn39view0turn39view1

For integrity, `snapshot_sha256` is mandatory and an HMAC is recommended **if** a store-local key exists outside the journal, for example in an OS keystore or another trusted secret store. The HMAC is not a content trust root; Rust piece and artifact verification remain the trust roots. The HMAC only detects local tampering or accidental cross-import substitution sooner. If no safe local key exists, keep the checksum only and rely on Rust revalidation for all content-bearing recovery. This means a copied journal cannot trick the importer into trusting bad content, but it might still waste work or cause denial of service. That is acceptable for a first version if clearly documented. citeturn18search0turn24view3

State copied from another import is rejected by binding four things together: `store_instance_id`, `import_id`, `request_hash_sha256`, and `content_identity_hash_sha256`. The import directory name should also equal `import_id`, and `owner.json` inside the directory should repeat that identity. If any of those bindings disagree, the journal is rejected as “foreign or mismatched import state.” This blocks the most common accidental cross-import substitution without claiming to defeat a privileged local attacker who can rewrite the entire store. That distinction matters: the artifact trust decision still comes from Rust verification, not from the journal itself. citeturn37view0turn18search16

### Fsync boundaries and atomic replacement

On Linux, the safe sequence is straightforward: write temp file in the target directory or same filesystem; `fsync(temp_fd)`; `rename()` into place; then `fsync(dir_fd)`. POSIX `rename()` on the same filesystem is atomic, and the Linux man page is explicit that an existing destination is atomically replaced and never observed missing; it is equally explicit that cross-filesystem rename fails with `EXDEV`. The `fsync()` man page is equally explicit that file `fsync()` alone does not guarantee the directory entry is on disk. citeturn39view4turn39view3turn39view1

On Windows, the safest practical analogue is “write temp on the same volume, `FlushFileBuffers(temp)`, then `ReplaceFile` into the final name.” Microsoft documents `ReplaceFile` as replacing one file with another, and `FlushFileBuffers` as forcing buffered file data to disk. Windows documentation does **not** document `FlushFileBuffers` as a directory-handle operation; the file-management and directory-handle pages list file flushing and directory-handle functions separately. So the exact directory-entry durability story is less explicit than on Linux. My recommendation is therefore: same-volume replacement only, explicit `FlushFileBuffers` on the temp file before replace and on the promoted file after replace, and acceptance that directory-entry crash durability on Windows is “best documented effort” rather than a POSIX-style `fsync(dir)` guarantee unless you are willing to require privileged volume flushing. citeturn9search3turn9search0turn41view0turn41view2turn40search0

### Safe staging directory tree and ownership rules

A staging tree that keeps final visibility and temporary work cleanly separated is more important than fancy scheduling. I recommend this layout:

```text
<store-root>/
  store.instance.json
  imports/
    <import_id>/
      owner.json
      snapshot.json
      events.log
      lock
      request.json
      peers/
        peer-0.status.json
        peer-0.companion.json
        peer-1.status.json
        peer-1.companion.json
      pieces/
        piece-000000.part
        piece-000000.bin
        ...
      assembly/
        model.slm.tmp
      receipt/
        receipt.pending.json
        receipt.final.json
      trash/
  models/
    <manifest_hash>.slm
    <manifest_hash>.receipt.json
```

Ownership is simple. The active importer process is the only writer under `imports/<import_id>/`. The runtime never reads from `imports/`. The runtime may only open files under `models/`, and only after the state has reached `Completed`. If an import is cancelled or permanently failed, cleanup may delete `imports/<import_id>/` after its terminal event is durable. If cleanup itself crashes, the import remains terminal and unexposed; a later scavenger can safely finish deletion. This is the simplest way to satisfy “no partially assembled artifact may become visible to the runtime.” citeturn36view0turn37view0turn39view4turn9search3

Path safety rules need to be strict. On Linux, resolve all relative paths beneath an already-open root directory using `openat2()` with `RESOLVE_BENEATH`, `RESOLVE_NO_SYMLINKS`, and `RESOLVE_NO_MAGICLINKS`; if your deployment can tolerate it, also use `RESOLVE_NO_XDEV` to forbid mount traversal. Those flags exist specifically to keep untrusted paths inside a trusted subtree and to block symlink or magic-link escapes. On Windows, never compose names from peer-provided filenames; instead use importer-generated lowercase hex names only. Microsoft’s naming rules say Windows paths are case-insensitive by default, forbid reserved characters including colon, and reserve names such as `CON`, `PRN`, `AUX`, `NUL`, `COM1` through `COM9`, and `LPT1` through `LPT9`. Because colon is also the alternate-data-stream separator on NTFS, forbidding it also blocks ADS abuse in generated names. citeturn43view2turn43view0turn43view1turn21view0turn21view1turn21view3

Links must be treated as hostile inside staging. Windows reparse points include symbolic links and junctions, and CreateFile’s `FILE_FLAG_OPEN_REPARSE_POINT` exists precisely because normal name resolution would otherwise traverse them. Linux hard links are also dangerous because two names can refer to the same file and there is no “original” name. The safest rule is: staging directories themselves must not be symlinks, junctions, or reparse points; piece files and assembly files must be newly created with exclusive semantics; and anything discovered as a preexisting link object is rejected. On Windows, `CreateFile` sharing rules also matter: rename and delete operations are controlled by `FILE_SHARE_DELETE`, and sharing violations should be treated as retryable environmental failures, not as content failures. This is the right place to handle antivirus/indexer races. citeturn7search12turn14view0turn14view1turn22search1turn22search0

I would also disable sparse-file tricks for the first importer. Windows sparse files are real and behave differently in storage allocation and quotas. Because the artifact is only about 925 MiB and you care more about correctness than hole-punch optimization, fully allocated ordinary files are safer for assembly and crash reasoning. citeturn13search0turn13search1turn13search3

## Piece scheduling, HTTP hardening, and resource budgets

A two-lane scheduler is enough here. With roughly 925 one-mebibyte pieces, there is no need for BitTorrent-scale swarming logic; the hard problems are identity binding, duplicate suppression, backoff discipline, and keeping memory bounded while still hiding latency. The final artifact identity is deterministic because it is bound by the manifest, piece hashes, and Merkle root, not by fetch order. Public TinyRustLM sources also repeatedly emphasize deterministic proof paths and drift rejection, which supports choosing deterministic scheduling inputs even if the transport evidence changes at runtime. citeturn30search0turn24view3

### One-lane and two-lane scheduling model

Use one lane by default until `PreflightBound` completes and every selected peer has the **same** `content_identity_hash_sha256`. Only then may the scheduler enable lane two. Each lane owns at most one piece reservation at a time, and duplicate suppression is global: if piece `i` is already reserved or verifying, no second lane may request it. Peer scoring should be based only on current transport evidence, not on any notion of “trusted peer.” Suitable score components are recent success rate, moving-average throughput, time-to-first-byte, read-timeout frequency, and recent content failures. Content trust itself is binary and Rust-owned: either the peer matches the bound identity, or it is ineligible. citeturn30search1turn30search0turn10search2

A simple and defensible reservation policy is “deterministic low-gap first.” Lane one asks for the lowest missing piece index. Lane two, if enabled, steals the next lowest missing index not already reserved. If the assembly writer is trying to stream contiguous verified pieces, it may bias toward a short contiguous gap near the front to reduce disk seeks during assembly, but it must never change the content identity or completeness rules. That keeps final identity deterministic while remaining easy to reason about in logs and fault injection.

Corrupt-piece quarantine must be explicit. When a peer returns a piece that fails the Rust hash check, record `(peer_slot, piece_index, expected_piece_hash, observed_utc)` and quarantine that peer for that piece for a cooldown window. One mismatch should not permanently ban the whole peer, because corruption can be piece-local and transient. Repeated mismatches on different pieces should rapidly lower the transport score and eventually eject the peer from this import. If a peer’s status or companion state later drifts so that its declared identity no longer matches the bound preflight, it is ejected immediately and never consulted again for this import. There is no last-write-wins rule for identity drift. citeturn36view0turn30search0turn10search2

### Quantitative examples and resource bounds

Using your prompt’s artifact size of about 925 MiB, the total payload is about 969,932,800 bytes; if there are about 925 equal pieces, each piece is about 1 MiB. At 10 Mb/s of line rate, the full artifact takes about 12.93 minutes ignoring protocol overhead; at 5 Mb/s, about 25.86 minutes; at 2 Mb/s, about 64.66 minutes. A single 1 MiB piece takes about 0.84 seconds at 10 Mb/s and about 4.19 seconds at 2 Mb/s ignoring overhead. citeturn25calculator0turn25calculator1turn25calculator2turn25calculator3turn25calculator4turn25calculator5

Those numbers lead to concrete scheduler choices. On a slow but stable 2 Mb/s link, one lane is often enough because two concurrent lanes only double head-of-line retry damage when the link is lossy. On an asymmetric home uplink/downlink where peers have uneven performance, two lanes help only if the second peer’s measured throughput plus timeout profile is actually better than letting lane one continue uninterrupted. On a lossy public link, piece timeouts should be longer than one ideal transfer time by a generous factor. For 1 MiB pieces, I would start with a per-piece read deadline around 20 seconds, a total attempt deadline around 30 seconds, and exponential backoff such as 1, 2, 4, 8, and 16 seconds with jitter, capped by an overall import deadline or cancellation.

Memory can stay bounded very tightly. With two lanes and 1 MiB pieces, the importer can use one 1 MiB receive buffer per lane, one verification buffer per lane if the API requires separation, and a small assembly buffer. In practice, you can keep incremental import memory under roughly 8 to 16 MiB above normal runtime overhead even with retry accounting and small metadata maps. That is much safer than holding large partially assembled regions in memory.

### HTTP client hardening

HTTP must be treated as hostile input, even for “friendly” peers. RFC 9110 and RFC 9112 give the relevant framing facts: `Content-Length` is framing-critical, recipients must protect against integer overflow, chunked transfer must be parsed correctly, the protocol itself sets no global header-size limit, and recipients are expected to impose their own limits. I would therefore set explicit limits for maximum status/metadata body size, maximum header section size, maximum redirect count, and maximum total read time per request. I would also reject malformed duplicate `Content-Length` values, reject multipart or multi-range responses for single-piece endpoints, and treat missing or inconsistent response framing as a transport error class, not a content mismatch. citeturn16view0turn16view1turn26view0turn26view1turn16view3

For piece endpoints, request `Accept-Encoding: identity` and reject any unexpected `Content-Encoding`. RFC 9110 is explicit that content codings change the representation and that metadata refers to the coded form. For piece import, you want bytes that exactly match the advertised piece hash, not an automatically decompressed variant that can create decompression bombs or digest ambiguity. citeturn16view4

Redirects should be disabled by default. OWASP’s SSRF guidance explicitly recommends allow-listing destinations and disabling automatic HTTP redirection, partly because of DNS rebinding and TOCTOU risks. If you choose to allow redirects for some metadata URL, the new target must pass the same scheme/host/IP-class policy as the original URL, and the identity preflight must not silently inherit a new host. I would not allow redirects at all for piece URLs. citeturn10search2turn10search6

Peer URLs must also be normalized aggressively. Reject userinfo, fragments, and queries in configured peer base URLs. Normalize hostnames, default ports, and path bases before logging or binding them. RFC 3986 warns that userinfo is misleading and widely logged; it even uses an example where the apparent host differs from the real host hidden after `@`. citeturn27view0turn27view1

Local-network policy must differ between browser and native clients. Current browser standards and browser documentation show that requests to local and loopback addresses are increasingly gated by Local Network Access rules and secure-context requirements, with distinct concepts for public, local, and loopback address spaces. Native Rust and .NET clients do not get those protections automatically. So the import policy should explicitly distinguish two modes: `local-peer-mode`, which permits loopback or RFC1918 targets only after explicit operator consent, and `remote-peer-mode`, which permits only public HTTPS targets. Browsers should rely on the browser’s local-network policy **and** on application policy; native clients must implement the application policy themselves. citeturn15search0turn15search6turn15search7turn15search14

For TLS, require normal certificate validation and modern protocol/cipher defaults for any non-loopback peer. RFC 9325 is the current IETF best-practice recommendation set for deployed TLS. Plain HTTP should be reserved to explicit local-peer mode, never to silent remote peer import. citeturn10search0turn10search4

Deterministic error categories should be returned to the coordinator without leaking secrets. I recommend exactly these classes: `PolicyRejected`, `TransportTimeout`, `TransportRedirectRejected`, `TransportFramingInvalid`, `DnsOrAddressRejected`, `PeerIdentityMismatch`, `MetadataInvalid`, `CompanionStateInvalid`, `PieceHashMismatch`, `WholeArtifactInvalid`, `DiskFull`, `PermissionDenied`, `SharingViolation`, `Cancelled`, and `ReceiptInvalid`. That vocabulary cleanly separates transport problems, local environmental problems, trust failures, and user cancellation.

## Final artifact verification, promotion semantics, and fault outcomes

Public TinyRustLM `.slm` documentation is already specific enough to drive the whole-artifact gate. The format is described as a project-specific binary artifact with strict browser loading, bounded validation, explicit model dimensions and tensor entries, non-zero header fields, tensor entries that must point inside the file, payload-count/shape agreement, tokenizer checksum, layout checksum, and finite payload checks. The public runtime page also treats assembly checksums and diagnostics as correctness surfaces, not decoration. citeturn30search2turn32search1

### What Rust should verify before promotion

Before promotion, Rust should verify all of the following against the bound preflight:

- exact byte count
- whole-artifact SHA-256
- manifest binding and `content_identity_hash_sha256`
- `.slm` format version support
- header invariants and directory bounds
- tokenizer checksum
- tensor-layout checksum
- quantization-mode support for the current runtime
- finite numerical configuration and finite tensor payload requirements
- runtime compatibility gates that are purely semantic and local
- receipt-chain parent hash, if a receipt chain exists

Piece verification and whole-file SHA-256 are naturally streamable. The Merkle root can be recomputed from verified piece hashes without rereading the entire artifact. By contrast, many structural `.slm` checks look like they require complete-file knowledge or random access because public docs describe file-internal tensor entries, offsets, bounds, and shape/payload relationships. In other words, the importer can stream **toward** validity, but the final semantic `.slm` verdict should be based on the complete assembled artifact unless the full public format later proves that a single-pass structural validator is sound. citeturn24view3turn30search2turn32search1

### Promotion and receipt semantics

Promotion should always be same-filesystem or same-volume. The assembly file lives in staging, hidden from runtime. After Rust returns `ArtifactVerified`, the coordinator performs atomic replacement into the final store and only then writes the receipt. The receipt is then re-read and revalidated by Rust before `Completed`. That re-read matters because receipt persistence problems are a separate class from artifact validity problems. The runtime/catalog should discover or load only `Completed` entries, never `Promoted`-but-unreceipted entries. citeturn39view4turn9search3turn20search10

### Security analysis and attacker capabilities

The relevant attacker capabilities are not exotic. A peer can be malicious, stale, or simply corrupted. A network intermediary can redirect or rebind requests if destination policy is weak. A local process such as antivirus, backup, or indexing software can create sharing violations or handle races. A local user with write access to staging can tamper with files or journals. The design above counters those threats by moving every trust-bearing predicate into Rust, binding all metadata into one immutable preflight identity, rejecting userinfo and unsafe path forms, creating files only under generated names inside validated roots, never trusting on-disk presence alone, and withholding runtime visibility until after full verification, atomic promotion, and receipt revalidation. citeturn10search2turn27view0turn43view2turn14view2turn36view0

What this design does **not** solve by itself is privileged local tampering. If an attacker can rewrite the entire store while the importer is offline, the journal itself is not a trust anchor. The defense there is that every piece and every final artifact must still be reaccepted by Rust verification before exposure. The result is strong integrity against remote peers and crash/fault corruption, and limited but honest protection against same-user local tampering.

### Fault-injection matrix with expected post-restart outcomes

| Fault injected | Expected durable state at crash | Expected restart outcome |
|---|---|---|
| Termination immediately after any durable transition | Last committed durable state | Resume from that exact state; no re-exposure of temp files |
| Power loss during `events.log` append | Previous valid frame only | Replay stops at last good frame; torn frame ignored/truncated |
| Disk full during piece write | `FetchingPieces` | Piece remains incomplete; partial `.part` file deleted or retried; no completion bit |
| Permission loss on piece directory | `FetchingPieces` | Import pauses/fails with `PermissionDenied`; final store unchanged |
| Peer returns wrong piece hash | `FetchingPieces` | Piece stays incomplete; peer-piece quarantine entry written; retry another peer or backoff |
| One-byte corruption in a previously verified piece file before restart | `FetchingPieces` or later | Startup rehash of referenced piece clears completion bit; piece is re-fetched |
| Truncated piece response | `FetchingPieces` | Treated as framing/size error; no completion bit; retry |
| Duplicate piece response after retry race | `FetchingPieces` | Single-flight map suppresses duplicate commit; at most one verified event for that index |
| Stale or mismatched piece-set metadata | `PieceSetValidated` or earlier | `Rejected` or `FailedPermanent`; no piece scheduling begins |
| Peer identity drift after preflight | `FetchingPieces` | Drifting peer ejected immediately; continue only if another bound-identical peer remains |
| Cancellation during assembly | `AllPiecesVerified` or `TempAssembled` | If cancel event is durable, terminal `Cancelled`; temp artifact deleted later; final store unchanged |
| Cancellation after final verification but before receipt | `ArtifactVerified` or `Promoted` | Model remains unexposed; restart either honors durable cancel or resumes from `ArtifactVerified`/`Promoted` and completes receipt |
| Crash after atomic rename but before receipt write | `Promoted` | Restart sees promoted artifact and missing valid receipt; writes/revalidates receipt, then exposes |
| Crash after receipt write but before receipt revalidation | `Promoted` or `ReceiptValidated` depending commit point | Restart re-reads and revalidates receipt; expose only if validation succeeds |
| Restart after atomic rename on Linux same filesystem | `Promoted` | Final file exists atomically or old file remains; no partial visibility |
| Antivirus/indexer holds destination without delete share | `ArtifactVerified` | Replace step returns sharing violation; retry with backoff until deadline; no temp exposure |

The expected outcomes above follow directly from the combination of atomic replacement semantics, file versus directory durability rules, CreateFile sharing behavior, and the explicit “commit only after validation” model already visible in public TinyRustLM notes. citeturn39view4turn39view1turn14view0turn14view2turn36view0turn37view0

## Implementation priorities, local measurements, unknowns, and annotated bibliography

The first implementation should optimize for correctness, not cleverness. A single-peer importer with the full trust chain, durable journal, hidden assembly, atomic promotion, and receipt validation is far more valuable than a dual-peer importer with weak preflight binding. Public TinyRustLM sources already show that the project values drift rejection, semantic preflight, and deterministic proof paths; that makes a staged rollout especially appropriate here. citeturn30search0turn30search1

### Prioritized implementation and test plan

Start with canonical schemas and Rust validators. That means publishing or stabilizing the manifest, piece-set, companion-state, preflight, and receipt schemas first, along with canonical serialization rules and Rust validation entry points. Without that, resumability will exist but cross-client interoperability will not.

Next, implement the durable journal and staging primitives. That includes snapshot plus event log, Linux `fsync()` discipline, Windows `FlushFileBuffers` plus `ReplaceFile`, import locking, generated path naming, and startup replay. Only after that should piece downloads be added.

Then implement single-peer piece fetch and per-piece verification. Make sure the only durable “piece complete” event is emitted **after** the piece file is flushed and Rust has accepted it. Add restart recovery, orphan `.part` cleanup, and restart rehash of referenced completed pieces before trusting the bitmap.

After that, add whole-artifact assembly, Rust final `.slm` verification, atomic promotion, receipt write, and receipt revalidation. At that point you already have a useful, crash-safe, resumable single-peer importer.

Only then should you add lane two. Gate it behind exact equality of the bound content identity. Add peer scoring, per-piece quarantine, and peer drift ejection. Do **not** add any peer-merging behavior before the identical-content gate is complete.

Finally, add browser parity storage. Store piece bytes in OPFS, persist journal metadata in IndexedDB with `strict` durability where supported, and run the same fault matrix in at least the exact browser versions you plan to support. The IndexedDB spec makes clear that durability is a hint and that `strict` and `relaxed` have different semantics, so browser support claims must be measured locally rather than assumed. citeturn42view0turn11search3turn11search7

### Performance measurements that should be collected locally

Do not invent performance values for these. Measure them locally on representative hardware, filesystems, browsers, and networks.

Measure piece goodput by lane and by peer, including mean and tail latency. Measure per-piece Rust verification CPU time, total SHA-256 throughput, Merkle recomputation time, and full `.slm` validation time. Measure the cost of `fsync()` or `FlushFileBuffers` for piece files, temp artifact, promoted artifact, and receipt. Measure rename/replace latency and failure rates under antivirus/indexer activity. Measure startup replay time versus number of journal events. Measure the probability and latency impact of browser `strict` versus default IndexedDB durability, OPFS `flush()` latency, and restart reconciliation time when recovering many already-downloaded pieces. Also measure peak importer memory above baseline with one lane and two lanes. Those are the only numbers that can justify concurrency defaults or cross-platform claims.

### Unknowns that require local schema or code inspection

Several questions remain genuinely open from public materials:

- the exact manifest JSON schema and canonicalization rules
- whether the piece-set carries per-piece hashes directly, Merkle proofs per piece, or both
- how companion state encodes freshness, inventory, and peer identity
- the exact receipt schema and whether there is already a local receipt chain or ledger hash
- the exact public `.slm` version identifier and whether additional checksums exist beyond the publicly documented tokenizer and layout checksums
- whether Rust already exposes separate validators for request, status, piece-set, companion state, preflight, piece, artifact, and receipt
- which browsers and browser versions are target-supported for OPFS plus IndexedDB `strict` durability
- whether a store-local MAC key already exists, or if checksum-only journal integrity is the realistic first version
- whether the final store may live on network shares or read-only mounts in production

Those unknowns are the boundary between a rigorous public design and an implementation claim. They should be resolved before promising exact runtime behavior.

### Annotated bibliography using current primary sources

| Source | Why it matters here |
|---|---|
| TinyRustLM public app surface. citeturn19search0turn35search16 | Establishes that public objects already include local `.slm` import, P2P import, peer status, companion inventory, share metadata, and receipt ledger. |
| TinyRustLM `.slm` format page. citeturn30search2 | Public basis for header validation, tensor-directory validation, tokenizer checksum, layout checksum, and finite-payload checks. |
| TinyRustLM adapter validation page. citeturn30search1 | Public evidence that the browser may fetch/checksum bytes but Rust is the semantic authority. |
| MiRust public note on admission stages. citeturn36view0 | Public implementation note that current local load validates in Rust before `Ready` and that an adjacent manifest fetched afterward is not yet a cryptographic trust root. |
| MiRust public note on ownership/state/recovery. citeturn37view0 | Supports transaction-style reasoning for state transitions and restart behavior. |
| RFC 9110 and RFC 9112 HTTP semantics. citeturn16view0turn16view1turn16view4turn26view0 | Primary source for framing, `Content-Length`, chunked transfer, content codings, and header-size responsibility. |
| RFC 3986 URI generic syntax. citeturn27view0turn27view1 | Primary source for rejecting userinfo-bearing peer URLs and avoiding credential leakage or misleading authorities. |
| RFC 9162 Merkle tree definitions. citeturn24view3turn24view1 | Primary source for a precise ordered binary Merkle tree construction with distinct leaf and interior prefixes. |
| W3C IndexedDB 3.0 plus OPFS docs. citeturn42view0turn11search3turn11search7 | Primary and official web-platform basis for browser-side journal durability and file flushing. |
| Linux `fsync(2)`, `rename(2)`, and `openat2(2)`. citeturn39view1turn39view4turn43view2turn43view0 | Primary source for directory `fsync`, same-filesystem atomic rename, and secure path containment under a trusted root. |
| Microsoft Windows file, naming, and replace documentation. citeturn9search3turn9search0turn41view0turn21view0turn7search12turn14view0 | Official basis for Windows atomic replacement strategy, flushing, directory-handle limits, reserved names, reparse points, and sharing violations. |
| OWASP SSRF guidance and Local Network Access docs. citeturn10search2turn15search0turn15search6 | Strong practical basis for redirect policy, DNS rebinding awareness, and browser-vs-native network policy differences. |
| RFC 9325 TLS recommendations. citeturn10search0turn10search4 | Best-current-practice source for secure transport expectations for non-local peers. |
| TUF specification and OCI descriptor specification. citeturn18search0turn18search16 | Primary design references for binding artifacts by both digest and size, and for separating metadata trust from transport. |

The bottom line is straightforward: the safest importer is one that treats the network as untrusted, the journal as resumability state rather than a trust root, Rust as the only validator of trust-bearing facts, and the final runtime-visible path as the **last** step rather than the first. Public TinyRustLM materials already point in that direction; the design above turns that direction into a crash-safe, resumable, multi-peer import protocol.
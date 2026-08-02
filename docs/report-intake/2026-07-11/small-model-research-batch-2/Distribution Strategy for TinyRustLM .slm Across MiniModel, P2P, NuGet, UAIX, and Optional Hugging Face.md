# Distribution Strategy for TinyRustLM `.slm` Across MiniModel, P2P, NuGet, UAIX, and Optional Hugging Face

## Research basis and current public state

**Verification date:** 2026-07-12 UTC.  
**Confidence:** high for the current public-web facts below; medium for the forward-looking interoperability recommendations, because several public surfaces are explicitly marked as planned, draft, or metadata-only.

The current public record shows a consistent boundary picture. TinyRustLM.com presents a browser-local Rust/WASM runtime with local `.slm` import, optional Hugging Face discovery, and P2P import, and it states that prompts stay in the browser. MiniModel.org presents itself as a planned metadata catalog and exchange surface, not a model host and not an inference host; it emphasizes discovery, external source routing, peer transfer by consent, checksum verification, and local import rather than serving runnable model bytes. MiRust documents a strict source-of-truth boundary in which MiRust.com is explanatory documentation only, while runtime releases, model artifacts, and measured compatibility are governed separately. citeturn4search1turn5view0turn25search4

Two current-state findings are especially important for the public strategy. First, MiniModel’s public catalog already exists as static JSON, but its current public peer-source announcement feed is empty, so the public site is not yet advertising any live P2P-ready inventory. Second, MiRust documents a present trust gap: the “adjacent line-based manifest” is fetched after model acceptance and rendered as operator information, but is **not yet cryptographically verified** and cannot authorize an artifact by itself. That gap is exactly where a signed, canonical, public `.slm` manifest should be inserted. citeturn6view2turn5view0turn24view0

The public implementation notes also make the runtime constraints clear. MiRust describes the current TinyRustLM runtime as a single global runtime serialized by a mutex, with a 128 MiB transfer ceiling, scalar CPU execution on the main browser thread, and model-load readiness only after parse, tensor materialization, scratch allocation, KV allocation, and logits allocation all succeed. The same handbook explicitly says persistent verified storage and worker execution are not yet public claims. Those facts strongly favor a fail-closed manifest, staged storage promotion, and modest first-release P2P semantics. citeturn24view1turn25search0

A notable changed finding appears in the public package ecosystem. MiniModel.org says that, as of 2026-07-06, its protected TinyRustLM NuGet SDK was “locally package-feed verified” and that a public NuGet.org listing was still pending. However, the public NuGet profile for Michael.Kappel now shows related UAIX/TinyRustLM browser packages on NuGet.org, including `UAIX.Browser.Core.Abstractions`, `UAIX.Browser.p2pLLM.Runtime`, `UAIX.Browser.p2pLLM.Conversion`, `UAIX.Browser.Memory`, and `UAIX.Browser.p2pRuntime.P2P`, all publicly visible and updated on 2026-07-07. That means the distribution strategy should assume there is now a public NuGet presence to stabilize rather than a blank slate to create. citeturn5view0turn31view0turn31view1turn31view2turn39view0

## Authority map and public-private boundary

The ecosystem should make authority obvious to both humans and tooling.

**TinyRustLM runtime authority** should cover only runtime compatibility, loading, validation behavior, deterministic execution gates, and the public loader/harness APIs. This follows the public boundary already described by MiRust, where the documentation site is not itself the runtime authority and does not ship weights or inference. citeturn25search4turn25search6

**MiniModel authority** should be the public catalog, signed manifest envelope, signed announcement feed, share-kit format, revocations, and tombstones. That aligns with the public MiniModel description of metadata-only discovery, checksum-bound packages, peer transfer by consent, and no project-hosted model bytes. MiniModel should therefore be the authoritative public registry of **what** an artifact is, **which signatures and hashes bind it**, and **whether it is still admitted**, but not the place where inference happens. citeturn5view0turn6view2turn6view4

**UAIX authority** should stay confined to memory and handoff schemas, not runtime scheduling, orchestration, or execution internals. UAIX publicly describes itself as an exchange, evidence, and handoff layer, and its public memory surfaces are centered on `.uai` packages, Project Handoff, AI Memory, and bounded memory records such as `short-term-memory.uai` and `decisions.uai`. That makes UAIX a natural public contract for memory integration around `.slm` workflows, while keeping runtime-specific private logic out of scope. citeturn28search1turn28search7turn38search5turn38search2turn38search9

**NuGet authority** should be software package distribution only: wrappers, abstractions, validators, harnesses, and memory connectors. It should never be treated as the source of truth for model bytes or artifact provenance. NuGet packages are ZIP-based software packages with descriptive metadata, signatures, README content, and repository metadata; they are ideal for SDK delivery, not for deciding whether a mirrored `.slm` file is authentic. citeturn21search14turn10search0turn20search2

**Optional Hugging Face authority** should be explicitly secondary. The Hub is a Git-based repository platform with model cards in `README.md`, license metadata in the card, revision pinning by commit hash, and a large-file workflow, so it is a very useful mirror. But for this ecosystem it should be treated as a **qualified mirror** whose files must match MiniModel manifest identities and signatures, never as the primary authority for `.slm` identity or admission. citeturn14search8turn14search1turn14search9turn14search19turn14search15

The public/private split should therefore be enforced as follows:

Public interfaces should include the `.slm` manifest schema, DSSE/TUF-style verification metadata, chunk maps, P2P share-kit schema, runtime capability descriptors, receipt formats, UAIX memory connector contracts, conformance tests, and package APIs. Private boundaries should continue to exclude model-authoring internals, conversion implementation details, quantization recipes, premium weights, selector registry generation, lineage promotion logic, optimizer logic, routing policy, encryption keys, telemetry backends, license-server internals, and any commercial orchestration or ranking system. That recommendation is consistent with the explicit public boundaries on MiRust and UAIX, both of which separate public evidence/contracts from the execution and orchestration layers. citeturn25search4turn38search8turn38search14

## Public-safe manifest and content-addressed identity

The public `.slm` manifest should be **canonical JSON payload + detached or enveloped signature**, with a stable, machine-verifiable schema. I recommend:

- a canonical JSON document named `*.minimodel.manifest.v1.json`;
- a DSSE envelope for transport and signature portability;
- a TUF-style root and targets key hierarchy for long-term key rotation and revocation resilience;
- multihash-encoded content identifiers so identities survive mirrors, renamed files, and alternate transport paths. citeturn16search6turn16search0turn37search2turn37search0turn36search0turn36search1

The manifest should carry the following top-level blocks:

`identity` for `model_id`, `artifact_id`, `artifact_cid`, immutable source revision, tokenizer revision, source family, and human display name. `license` for SPDX identifier, redistribution class, approval receipt reference, attribution obligations, and “mirror_allowed” / “p2p_allowed” booleans. `conversion` for conversion profile ID, converter version, source config hash, tokenizer identity, prompt format ID, quantization kind, tensor layout checksum, and any public-safe compatibility flags. `artifact` for exact bytes, segment inventory, whole-file hash, chunk-map hash, Merkle root, and optional external mirror routes. `runtime` for ABI version, supported TinyRustLM loader versions, browser/native compatibility, memory budgets, context tier, and safety limits. `capabilities` for task family, prompt roles, modalities, tool-use flags if any, and explicit non-claims. `evaluation` for receipt references, seeded determinism gate results, parity gate results, corruption test status, and browser/native smoke receipts. `provenance` for the signed chain that links source revision, tokenizer revision, conversion receipt, build receipt, package receipt, and publication receipt. This general shape is consistent with the public MiniModel draft direction, which already calls for source identity, license route, tokenizer/config checksums, eval evidence, artifact checksum, chunk metadata, and signature fields. citeturn5view0turn6view2turn6view4

For identities, use **content addressing first, filenames never**. A good public identifier pattern is:

`slmca:v1:<multihash-of-full-artifact>` for the whole `.slm`  
`slmcm:v1:<multihash-of-canonical-chunk-list>` for the chunk map  
`slmmf:v1:<multihash-of-canonical-manifest-payload>` for the unsigned manifest payload  
`slmds:v1:<multihash-of-DSSE-envelope>` for the signed manifest envelope

This follows well-established content-addressing practice: CIDs are self-describing content-addressed identifiers, and multihash is specifically designed to encode both hash algorithm and digest in a future-proof way. Using that model means a byte-identical artifact keeps the same identity across MiniModel, local disk, a peer companion, or an optional Hugging Face mirror. citeturn36search0turn36search1turn36search11

For signing, use **offline root trust + rotating online publication keys**. TUF is the right design influence here because it is explicitly built for secure update distribution, recommends very secure offline root keys, and defines normal root-key rotation and revocation workflows. DSSE gives you a portable signed envelope around JSON claims, while TUF-style role separation gives you recovery and rollback resistance without publishing any private signing material or any model-encryption keys. citeturn37search2turn37search0turn37search3turn16search6

A public-safe manifest example could look like this:

```json
{
  "manifest_kind": "minimodel.manifest.v1",
  "schema_version": 1,
  "identity": {
    "model_id": "tinyrustlm/example-safe-demo-q4",
    "display_name": "Example Safe Demo q4_0",
    "artifact_id": "slmca:v1:uEiDPLACEHOLDER_FULL_ARTIFACT_MULTIHASH",
    "artifact_cid": "bafyPLACEHOLDER",
    "manifest_id": "slmmf:v1:uEiDPLACEHOLDER_MANIFEST_MULTIHASH",
    "source": {
      "kind": "external-source-model",
      "canonical_repo": "https://example.invalid/org/source-model",
      "source_revision": "git:1111111111111111111111111111111111111111",
      "tokenizer_revision": "git:2222222222222222222222222222222222222222"
    }
  },
  "license": {
    "spdx_id": "Apache-2.0",
    "redistribution_class": "approved-converted-weights",
    "mirror_allowed": true,
    "p2p_allowed": true,
    "approval_receipt_refs": [
      "receipt:license-approval-placeholder"
    ]
  },
  "conversion": {
    "profile_id": "tinyrustlm-public-q4-browser-v1",
    "converter_version": "0.0.0-public-placeholder",
    "quantization": "q4_0",
    "tensor_layout_checksum": "0x0000000000000000",
    "tokenizer_id": "tokca:v1:uEiDPLACEHOLDER_TOKENIZER_MULTIHASH",
    "prompt_format_id": "chatfmt:v1:alpaca-like-safe-demo"
  },
  "artifact": {
    "file_name_hint": "example-safe-demo-q4.slm",
    "byte_count": 12345678,
    "sha256": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "chunk_map_id": "slmcm:v1:uEiDPLACEHOLDER_CHUNKMAP_MULTIHASH",
    "chunk_algorithm": "sha2-256-merkle-v1",
    "chunk_size": 1048576,
    "merkle_root_sha256": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  },
  "runtime": {
    "abi": "slm1",
    "tiny_rust_lm_loader_min": "1.0.0",
    "tiny_rust_lm_loader_max_exclusive": "2.0.0",
    "browser_compat": {
      "requires_opfs": true,
      "requires_indexeddb": true
    },
    "context_tier": "small",
    "memory_budget_bytes": 33554432
  },
  "capabilities": {
    "tasks": ["local-demo-chat"],
    "trained_quality_claim": "not-claimed",
    "non_claims": ["tool-use", "vision", "server-inference"]
  },
  "evaluation": {
    "receipt_refs": [
      "receipt:seeded-determinism-placeholder",
      "receipt:browser-smoke-placeholder",
      "receipt:native-smoke-placeholder"
    ]
  },
  "provenance": {
    "chain": [
      "receipt:source-intake-placeholder",
      "receipt:conversion-placeholder",
      "receipt:package-placeholder",
      "receipt:publish-placeholder"
    ]
  }
}
```

## P2P exchange, browser storage, and state machines

MiniModel’s current public design already points in the right direction: static catalog metadata, a signed announcement/feed concept, share metadata exported from verified local imports, a first direct peer-piece fetch prototype for known consenting HTTP peers, and a future user-run “MiniModel Peer Companion.” The public examples also already use artifact SHA-256, chunk hashes, a chunk-list hash, a Merkle root, and a peer-import request. I recommend stabilizing that trajectory rather than replacing it. citeturn5view0turn6view2turn6view4turn6view6

The P2P model should have **five public objects**:

`catalog entry` — discovery metadata signed by MiniModel  
`announcement` — short-lived availability metadata signed by a peer or peer companion  
`share-kit` — exportable metadata bundle from a locally verified `.slm`  
`piece set` — chunk-addressed transfer unit  
`receipt ledger` — append-only local evidence of import, validation, promotion, tombstones, and revoke decisions

The announcement should be metadata-only and should never be sufficient to authorize loading by itself. It should contain `artifact_id`, `chunk_map_id`, supported protocols, peer endpoint hints, sequence number, expiration, supersedes pointer, optional bandwidth hints, and the key ID used to sign it. The apply path should always be: **catalog or share-kit resolution → manifest signature validation → policy check → piece fetch → chunk-hash verification → full-artifact hash verification → `.slm` structural validation → atomic promotion → runtime admission**. That closes the trust gap documented in the current MiRust notes. citeturn24view0turn5view0turn39view2

For chunking, the best public default is to keep the current MiniModel example convention of **1 MiB fixed chunks** for v1 manifests, because it is already present in the public examples and is large enough to avoid excessive metadata overhead while still supporting resumable range fetches and deduplication. The chunk map should be canonical and ordered by byte offset. Each chunk gets its own hash; the chunk list gets its own canonical hash; and the whole artifact gets its own Merkle root plus whole-file digest. This makes resumption, dedupe, and corruption isolation straightforward. citeturn6view2turn6view4

For peer semantics, reputation must be **advisory only**. A peer can gain local trust for availability and throughput, but never for authenticity. Good cryptographic checks make peer reputation a scheduling hint, not an authorization signal. That directly limits the damage from malicious peers, stale announcements, and spoofed mirrors. If a peer lies, the import fails on signature, chunk, or artifact verification and the staged bytes are discarded. This is also compatible with libp2p, BitTorrent-style piece exchange, or Iroh-style verified streaming later, because all of those systems separate peer routing from content verification. citeturn17search1turn17search0turn18search0turn18search5

For browser persistence, use a **split storage model**: OPFS for chunk files and promoted `.slm` blobs, IndexedDB for metadata, locks, receipts, piece bitmaps, and revocation state. OPFS is origin-private and quota-bound, `navigator.storage.estimate()` gives usage/quota preflight, `persist()` / `persisted()` can request durable storage mode, `createWritable()` provides a commit-style write path where changes become visible on close, and Web Locks plus BroadcastChannel provide same-origin multi-tab coordination. IndexedDB durability hints should default to `strict` for final receipt/promotion writes and may use `relaxed` only for ephemeral progress state. citeturn11search0turn12search8turn12search4turn12search0turn40search0turn13search0turn12search3turn12search21

A practical browser state machine is:

`Planned` → quota preflight  
`Staging` → chunk files written under temporary artifact directory  
`Verifying` → per-chunk hash, full hash, manifest signature, `.slm` structure  
`Promoting` → promoted under content-addressed OPFS path with strict receipt commit  
`Admitted` → available for runtime load  
`Revoked` → blocked from new loads/shares; bytes optionally retained for forensics  
`RolledBack` → previous admitted version restored if the new candidate fails before promotion

That state machine should be guarded by a named Web Lock such as `slm-import::<artifact_id>` so only one tab progresses an import at a time, while BroadcastChannel keeps observers synchronized. citeturn13search0turn12search3turn40search0

Fail-closed behavior should be strict and diagnosable. Zip/path traversal, symlink/reparse entries, oversized tensors, declared-size mismatches, tokenizer identity mismatch, missing signatures, expired announcements, revoked keys, stale metadata version, and unsupported runtime ABI should all hard-stop the operation. Diagnostics should always return stage, error code, expected and actual hash/byte count, key ID, policy source, and cleanup outcome. That is also consistent with the public MiniModel posture of rejecting oversized JSON before parsing and with MiRust’s stage-based operational diagnostics guidance. citeturn5view0turn24view1

## NuGet package strategy and developer adoption

The public NuGet surface now exists, so the strategy should be **stabilize, clarify, and layer**, not restart. Publicly visible packages already include `UAIX.Browser.Core.Abstractions`, `UAIX.Browser.p2pLLM.Runtime`, `UAIX.Browser.p2pLLM.Conversion`, `UAIX.Browser.Memory`, `UAIX.Browser.p2pRuntime.P2P`, and `UAIX.UAI.Abstractions`, with descriptions that match the intended ecosystem roles for `.slm` validation, runtime harnessing, P2P workflows, and `.uai` memory integration. citeturn31view0turn31view1turn31view2turn39view2turn31view3

The cleanest public package matrix is:

| Package role | Canonical future-facing package | Relationship |
|---|---|---|
| Stable contracts | `MiniModel.Abstractions` | Thin facade over current `UAIX.Browser.Core.Abstractions` |
| `.slm` validator | `TinyRustLM.Validation` | Product-specific validator and inspection API |
| Runtime loader/harness | `TinyRustLM.Runtime` | Facade over current `UAIX.Browser.p2pLLM.Runtime` |
| P2P exchange | `MiniModel.P2P` | Facade over current `UAIX.Browser.p2pRuntime.P2P` |
| Conversion request contracts | `TinyRustLM.Conversion` | Public request/receipt surface only |
| Memory integration | `UAIX.Memory.Connectors` | UAIX-native; stays neutral |
| Samples and conformance | `MiniModel.Conformance` | Fixtures, validators, malformed cases |
| Meta package | `TinyRustLM.SDK` | Brings runtime + validation + MiniModel manifest reader |

That layout keeps **authority names aligned with responsibility**. `MiniModel.*` means discovery, manifest, and P2P metadata. `TinyRustLM.*` means runtime-specific loading and local inference. `UAIX.*` means memory and handoff exchange. `p2pRuntime` and `p2pLLM` should stay as tags, domains, or marketing labels, not as the primary long-term package namespace. That reduces brand confusion without breaking the existing public UAIX package line.

Every production package should include a package README, embedded license metadata, repository URL/type, release notes, tags, and Source Link information. NuGet’s own guidance recommends rich metadata and README inclusion; Source Link automatically adds repository metadata and commit information; and package consumers now routinely see README content directly in NuGet surfaces and Visual Studio. citeturn20search1turn20search2turn21search17turn20search10

Symbols and source should follow current NuGet practice: publish `.snupkg` symbol packages with portable PDBs, enable Source Link, and ensure package builds are deterministic. NuGet supports `.snupkg`; Source Link improves debugging and records repository/commit metadata; and Microsoft’s secure supply-chain guidance explicitly recommends reproducible builds with source links. For official builds, set `ContinuousIntegrationBuild=true`, keep deterministic compilation enabled, and pin the SDK with `global.json`. citeturn19search1turn19search15turn21search2turn21search3turn33search2turn33search18turn33search11

Package signing should use **both author signing and repository signing**. NuGet supports signed packages for integrity and authenticity, author signing is supported with `nuget.exe` on Windows, and packages uploaded to nuget.org are automatically repository-signed. Verification should be part of CI and docs using `dotnet nuget verify` or `nuget verify -signatures`, and consumers in controlled environments should be encouraged to set `signatureValidationMode=require`. New publishing should use NuGet Trusted Publishing with short-lived OIDC credentials rather than long-lived API keys. citeturn10search0turn10search4turn10search18turn22search7turn22search3turn22search1turn23search0

Because a mix of public and private feeds creates dependency-confusion risk, all public SDK repos should publish a sample `nuget.config` with Package Source Mapping and, where possible, a single explicit ingestion feed. Microsoft’s NuGet guidance now strongly recommends Package Source Mapping for mixed-source environments. citeturn32search0turn32search1turn32search4

## Optional Hugging Face mirror and discoverability

If Hugging Face is used, it should be an **opt-in, post-gate mirror** only. The Hub is well-suited for this because model repositories are version-controlled Git-based folders, model cards are `README.md`, repository revisions can be pinned by commit hash, and the platform supports large-file workflows. But the mirror should be mechanically subordinate to MiniModel identities and signatures. citeturn14search8turn14search1turn14search19turn14search5

A good mirror repository layout is:

```text
README.md
artifacts/
  example-safe-demo-q4.slm
manifests/
  example-safe-demo-q4.manifest.dsse.json
checksums/
  SHA256SUMS
receipts/
  publish-receipt.json
  eval-receipt.json
licenses/
  LICENSE.txt
samples/
  csharp/
  rust/
  browser/
```

The `README.md` model card should contain: canonical MiniModel model ID, exact source revision, tokenizer revision, artifact size, SHA-256, `artifact_cid`, runtime compatibility matrix, context tier, public limitations, intended uses, out-of-scope uses, redistribution notice, and a statement that MiniModel signatures and manifest IDs remain authoritative. Hugging Face license metadata should also be set in the card’s YAML metadata, because that is how the Hub exposes repository license information for discoverability. citeturn14search1turn14search9

Synchronization should be one-way and human-gated:

MiniModel admitted release → human approval → signed publication receipt → mirror push → mirror verification against canonical manifest → pinned public release note. No automatic mirroring from CI on every tag, and no reverse-sync from Hugging Face into MiniModel. Mirror drift is detected by comparing `manifest_id`, `artifact_id`, bytes, and checksum files against the canonical MiniModel publication receipt. That fits the user’s “explicit human authorization; never publish automatically” rule and aligns with HF’s revision-aware repository model. citeturn14search19turn14search2turn14search3

For discoverability, use a **multi-surface metadata discipline**:

On MiniModel pages, publish canonical URLs, sitemap entries, and structured data. Google recommends canonicalization for duplicate pages, sitemap submission for efficient crawling, and structured data to help Search understand content. For MiniModel specifically, `Organization` structured data belongs on the home page, while model landing pages can use `Dataset`-style structured data for downloadable artifact records, because Google’s dataset markup explicitly supports `identifier`, `license`, `sameAs`, version, and distribution metadata. citeturn34search7turn35search0turn34search1turn34search4

On NuGet, optimize titles, descriptions, tags, README headers, and repository metadata around search terms developers will actually use: `slm`, `TinyRustLM`, `MiniModel`, `local inference`, `browser wasm`, `manifest verification`, `peer-to-peer model sharing`, `UAIX memory`, and `deterministic local LLM`. On Hugging Face, keep the card concise, use explicit task/library tags only when true, and pin instructions to commits rather than floating branches. On the general web, publish a small standards-and-artifacts sitemap cluster so search engines can separate model pages, docs pages, package pages, and release notes. citeturn20search1turn20search2turn35search0turn14search15

## Supply-chain controls, release gates, rollback, and phased backlog

The supply-chain baseline should include: deterministic official builds, SBOM generation on every release build, signed packages, signed manifest envelopes, dependency auditing, malware scanning, source/model license review, and publication receipts. SPDX 3.0.1 and CycloneDX both support rich provenance and BOM inventory; SLSA emphasizes provenance for build trust; NuGet now supports dependency auditing and a more secure Trusted Publishing flow; and Microsoft’s current security guidance explicitly recommends SBOM generation, centralized ingestion, and stronger CI/CD controls. citeturn15search4turn15search1turn15search6turn23search15turn23search0turn32search10turn10search21

The release gates before any public mirror should be exactly the ones in your brief, with hard fail semantics:

source license and converted-weight redistribution approval; immutable source and tokenizer provenance; fixed/seeded behavior gates; source-to-quantized first-token and multi-step parity; native and browser generation tests; corruption/truncation/oversize/malicious-manifest tests; package metadata and sample verification; deterministic build, SBOM, signing, and checksum verification; public-safe documentation review; and explicit human authorization. The public TinyRustLM and MiRust records already distinguish source presence, smoke tests, evaluation, browser verification, and production support as separate gates, and the UAIX public record already emphasizes evidence and support-boundary separation. citeturn24view1turn24view2turn38search8

For rollback and revocation, use three signed record types:

`supersession` means “a newer admitted artifact exists” and is advisory;  
`tombstone` means “this artifact must no longer be newly imported or shared” and is blocking;  
`revocation` means “a signing key or trust root is no longer valid” and is globally blocking.

Security tombstones should block new loads and new shares immediately. License tombstones should block new shares and new mirror publication, and should block new loads if the policy route requires that. Existing loaded sessions may continue until process end, but they must not be re-admitted after restart without a fresh policy pass. Root-key compromise recovery should follow TUF-style offline root rotation; publication-key compromise should rotate through the current trusted root. citeturn37search0turn37search3

A practical phased backlog is:

**Phase Alpha** — ship canonical manifest v1, DSSE signing, content-addressed import cache, and validator CLI/API.  
**Acceptance:** byte-identical files imported under different names dedupe to one `artifact_id`; invalid signature, invalid full hash, invalid chunk hash, oversize tensor, and bad tokenizer identity all fail closed with stage-coded diagnostics.

**Phase Beta** — ship MiniModel signed catalog v1, announcement v1, share-kit v1, receipt ledger v1, and browser atomic promotion with OPFS/IndexedDB/Web Locks.  
**Acceptance:** interrupted imports resume; two tabs cannot corrupt the same artifact state; catalog rollback attempts are rejected by version/expiry policy; public feed size limits are enforced before parse.

**Phase Gamma** — ship stable NuGet 1.0 facades, `.snupkg`, Source Link, Trusted Publishing, package signing verification docs, and conformance fixtures.  
**Acceptance:** packages verify in CI; README, license, repository metadata, release notes, and tags appear correctly on nuget.org; sample apps pass browser/native smoke.

**Phase Delta** — ship optional Hugging Face mirror path, compatibility badges, public sample models, and search-friendly model landing pages.  
**Acceptance:** mirror bytes and manifest IDs match MiniModel publication receipt; model card includes same release facts as MiniModel; sitemap and canonical indexing validate; mirror publication still requires explicit human approval.

The growth plan should emphasize **public validation and interchange, not reconstructability of the commercial system**. Publish tiny safe fixtures, malformed fixture packs, compatibility badges, browser/native verification badges, and conformance packs. Publish extension points and protocol contracts. Do **not** publish premium recipes, selector generation internals, routing logic, training data, or private orchestration. That gives developers a real ecosystem to build against while preserving the proprietary moat where it actually matters. citeturn27view0turn38search10turn5view0
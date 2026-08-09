# ADR-009: Service-Worker Release Model

## Status

Accepted as the target architecture. TinyRustLM currently has no promoted
service worker or offline release cache.

## Decision Date

2026-08-08

## Scope

This ADR defines web release identity, mutable pointers, immutable assets,
service-worker installation and activation, multi-tab coordination,
last-known-good recovery, forced security updates, and bounded cleanup.

## Decision

Every web publication has one immutable release identity derived from a
canonical release manifest. The manifest binds source revision, build tools,
all public file paths, byte counts, SHA-256 values, content types, security
headers, service-worker bytes, and the release claim/update entry. Model bytes,
prompts, hosted-memory payloads, credentials, and private evidence are never
members of the web release graph.

The origin exposes two mutable, `no-store` entry points:

- the root/bootstrap document; and
- `/.well-known/site-release.json`.

They identify exactly one immutable release manifest. All release assets use
content-addressed or release-addressed URLs and immutable caching. A mutable
pointer is never treated as proof until its referenced manifest, asset hashes,
source revision, publication receipt, and HTTPS readback agree.

The cache namespace is `tinyrustlm-web-release:<release-sha256>`. Staging
caches use a distinct attempt identity and are never used for fetch responses.
The service worker obtains the manifest with cache bypass, validates its exact
closed schema and release authorization, enforces count and byte limits, and
fetches only the required same-origin allowlist. Every response must have the
expected status, final URL, content type, byte count, and SHA-256. Installation
is committed only after the complete set validates; otherwise the staging
cache is deleted and the active release remains unchanged.

Activation uses a bounded two-phase client protocol:

1. the installed worker announces its release identity to every controlled
   client and records their generation and activity state;
2. activation proceeds when there are no controlled clients or every live
   client acknowledges a safe checkpoint with no active generation, import,
   persistence mutation, or evidence write.

An unresponsive client never causes silent mixed activation. The update stays
waiting and the UI offers a visible reload/close action. Client messages carry
release and generation identities; stale or duplicate acknowledgements are
rejected. BroadcastChannel may improve UI coordination, but the service
worker/client protocol remains authoritative and works without it.

After activation, a controlled client performs a bounded launch check against
the exact release: shell load, WASM hash/load, required route availability,
offline fetch behavior, and release identity agreement. Only then is the
release recorded as last-known-good (LKG) in a small atomic IndexedDB record.
The active and immediate LKG caches are retained. Failed staging caches and
older unreferenced generations are deleted after validation; cache count and
total bytes are bounded.

If launch health fails before user work begins, the worker serves the LKG
asset graph and emits a rollback receipt. If failure occurs during work, it
does not rewrite the current page or duplicate generation; it blocks new work,
preserves local user/model state, and requests a controlled reload into LKG.
Rolling back service-worker code itself requires publishing the previously
verified worker as a new authorized release; an executing worker is never
assumed to rewrite its own registration atomically.

A forced security update is permitted only when a signed release manifest
contains a bounded security-update policy and expiry. Before expiry, clients
receive a visible update request. At expiry, the old release may block new
model activation or generation but does not erase models, memory, or user
content. Existing output is committed once, evidence writes finish, and a
controlled reload is required. Security policy never weakens TLS, CSP,
cross-origin isolation, origin checks, or signature verification.

Fetch handling is closed and fail-safe:

- immutable release assets are cache-first by exact manifest key;
- mutable release pointers are network-first with no-store and bounded LKG
  fallback clearly marked stale;
- application navigation resolves to one release generation, never a mixture;
- companion loopback, MiniModel metadata, MemoryEndpoints, and P2P traffic are
  not cached by the service worker;
- Cache Storage never stores model bytes, prompts, conversation text,
  credentials, memory payloads, or evidence receipts.

## Alternatives

- **No service worker** remains acceptable until this profile passes, but it
  does not provide an offline product claim.
- **Cache on first fetch** was rejected because it permits mixed and
  incomplete release generations.
- **`skipWaiting()` plus immediate `clients.claim()`** was rejected as the
  normal path because it can replace code during active inference or writes.
- **Delete all previous caches at activate** was rejected because it destroys
  rollback before launch health is known.
- **Use a mutable cache name** was rejected because it makes release identity
  and cleanup ambiguous.
- **Cache models in Cache Storage** was rejected because model ownership,
  quota, deletion, and verification belong to File, OPFS, or the companion.

## Authoritative Evidence

- **Observed local fact**: current public release tests deliberately block or
  count service workers; no production service-worker registration exists.
- **Observed local fact**: TinyRustLM already emits a SHA-256-bound site release
  record and immutable deployment/readback evidence that can seed the release
  graph.
- **Sourced public fact**: service-worker install, waiting, activate, clients,
  and Cache Storage semantics are defined by the Service Workers specification
  at https://w3c.github.io/ServiceWorker/.
- **Sourced public fact**: IndexedDB transactions and durability semantics are
  defined at https://w3c.github.io/IndexedDB/.
- **Engineering decision**: complete staged verification plus client-safe
  activation is required to prevent mixed releases and restart loss.
- **Local verification required**: the profile must pass the declared browser,
  offline, crash, quota, multi-tab, and deployment matrices before promotion.

## Threat Analysis

Threats include cache poisoning, mixed generations, stale pointers, manifest
substitution, redirect drift, oversized asset sets, quota exhaustion, partial
install, malicious content types, compromised old workers, cross-tab races,
active-generation interruption, stale rollback, secret persistence, and model
bytes entering web caches.

Closed manifests, same-origin final-URL checks, bounded streaming hashes,
signature/authorization validation, isolated staging, generation IDs,
two-phase activation, atomic LKG state, and post-deploy readback address these
threats. The worker logs only bounded public identities and error codes.

## Performance Evidence

No offline or startup improvement is claimed yet. Promotion measures cold and
warm install time, bytes transferred, hash time, storage use, navigation and
WASM startup, cache hit rate, update waiting time, LKG rollback time, and
multi-tab responsiveness on each browser/OS profile. Asset hashing is streamed
with bounded buffers. Cache limits are based on measured release size plus a
fixed active-and-LKG multiplier, never unbounded historical retention.

## Compatibility Impact

Browsers without a qualified service-worker profile use the network release
and receive no offline claim. This is a capability choice, not a legacy
service-worker path. Every promoted browser follows the same release manifest
and identity rules.

Old unpublished cache names, mutable precaches, and route aliases are not read
or migrated. They are removed during clean profile testing and deployment
cleanup.

## Clean Deletion Impact

Promotion deletes superseded worker implementations, old cache schemas,
duplicate bootstrap logic, and obsolete update tests. Cleanup retains only the
active release, immediate validated LKG, and a bounded in-progress staging
cache. User-owned models and memory are outside this deletion boundary.

## Unknowns

- Browser-specific timing and durability behavior under crash and disk full.
- The final required offline asset set and maximum release-byte budget.
- Whether all target browsers expose enough client activity state for the same
  update UX.
- Appropriate forced-security expiry and grace policy.
- How hosting/CDN cache behavior affects mutable pointer freshness.
- Whether cross-origin isolation headers remain stable on every offline route.

## Acceptance Tests

1. Deterministic manifests and release identities reproduce byte-for-byte from
   the same source and tools.
2. Truncation, redirect, wrong status/type/length/hash, extra asset, unknown
   field, oversized set, quota failure, and interrupted install never alter the
   active cache.
3. Two or more tabs with active and idle generations cannot produce mixed
   assets, duplicate output, stale acknowledgement, or interrupted evidence.
4. Launch failure, worker crash, browser restart, power-loss simulation, and
   rollback preserve one validated LKG and produce immutable receipts.
5. Offline startup serves one complete release and reports mutable metadata as
   stale rather than current external evidence.
6. Forced security update tests enforce authorization, expiry, visible state,
   safe checkpoint, and no user/model data deletion.
7. Cache and profile scans prove no model bytes, prompts, credentials, hosted
   memory, private paths, or raw evidence entered Cache Storage or logs.
8. Public HTTPS readback proves root, pointer, manifest, worker, every asset,
   headers, update log, and source revision match the release graph.

## Rollback

Keep the current network-only release until all acceptance tests pass. For a
promoted regression, publish an authorized release whose manifest selects the
last verified asset graph and, when necessary, the previous worker code. Do
not mutate an existing manifest, reuse its identity, or silently serve a mixed
cache. Preserve the failed release and rollback receipt, then delete its cache
only after no client references it.

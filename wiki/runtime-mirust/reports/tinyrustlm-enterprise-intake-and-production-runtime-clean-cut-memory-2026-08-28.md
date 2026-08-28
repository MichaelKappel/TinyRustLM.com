# TinyRustLM Enterprise Intake And Production Runtime Clean Cut

## Purpose And Authority

This is the durable cross-batch strategy and resume node for TinyRustLM report
intake through 2026-08-27 and the production-runtime clean cut in progress on
2026-08-28. It routes the detailed evidence instead of copying 18 MB of report
prose into hot `.uai` memory.

The reviewed report-by-report decision route is
`wiki/runtime-mirust/reports/tinyrustlm-report-intake-decision-index-2026-08-28.md`.
It covers every report in the 2026-08-26 and 2026-08-27 intake batches exactly
once and separates adopted production invariants, corrections, rejected
directions, research-only work, and facts requiring local proof.

The reports are advisory research. They do not prove private source behavior,
model correctness, browser execution, quality, P2P reachability,
MemoryEndpoints continuity, deployment, or campaign progress. Local source,
tests, immutable receipts, real browsers, authorized services, outside
observers, and HTTPS readback remain the authorities for those claims.

TinyRustLM is one prelaunch product. SLM2, Tokenizer2, Template2, Sampling2,
Prompt2, and ACG2 are technical format identities, not product generations.
There is no launched predecessor and therefore no legacy population,
compatibility obligation, migration duty, dual runtime, fallback reader,
repair path, alias, shim, or accepted debt.

## Intake Custody

The authoritative `docs/report-intake` tree contains 344 files totaling
18,312,842 bytes in 23 manifest-owned batches. It includes raw reports,
provenance prompts or support records, manifests, corrected syntheses, and TDD
plans. `.uai/intake-outcome-ledger.uai` is the report-level disposition
authority: each source has an identity, category, outcome, source-custody
statement, and proof of use. The authoritative active `Content` and
`Improvement` handoff buckets remain placeholder-only.

The intake protocol is:

1. Preserve raw advisory material byte-exactly where available and record any
   historical normalization defect rather than hiding it.
2. Distinguish public facts, project-supplied facts, recommendations,
   uncertainty, and local unknowns.
3. Correct unsupported or conflicting claims in a synthesis.
4. Give every report one disposition and one implementation or research route.
5. Convert accepted invariants into red-first tests or bounded backlog items.
6. Keep rejected architecture out of production source.
7. Deep-link the durable node from hot memory rather than duplicating raw
   report bodies.

## Consolidated Enterprise Decision

The reports converge on a smaller and stricter product, not a larger framework:

- one six-member SLM2 composition is the unit of installation and execution;
- one Rust semantic runtime is authoritative for converted-byte
  interpretation;
- scalar native execution is the numerical oracle for optimized native and
  browser-WASM implementations;
- one dedicated browser worker owns composition, tokenizer, generation, and KV
  state;
- the UI has one typed event path and renders each assistant result exactly
  once;
- the browser accepts only exact, independently verified composition members;
- a qualified exact peer composition is preferred, otherwise the companion
  performs one pinned-source local conversion;
- model, tokenizer, template, sampling, prompt, source, tool, browser, and
  evidence identities are bound independently;
- failures and obsolete evidence are immutable and never repaired into passes;
- memory records are untrusted data with provenance, not hidden authority;
- current user intent outranks stale profile or retrieved memory;
- every capability, mutation scope, cancellation, terminal decision, and
  release claim is typed and bounded;
- documentation, release logs, committed source, deployed bytes, and HTTPS
  readback move together.

## Architecture Decisions By Domain

### Contract And Evidence

Adopt one normative contract plus generated or mechanically checked syntax
types and independently implemented semantic validators. Operation graphs bind
parent and child identities, exact member closure, source locks, tool versions,
terminality, and immutable results. Producer claims are never accepted where a
verifier can recompute file type, length, digest, member set, containment, or
semantic consistency.

The preserved attempt `/10` remains terminal failure. Its producer used the
durability child identity `parent + "-members"` and status `performed`; the
managed verifier required the wrong parent identity and status. Tests may
preserve that mismatch, but production must accept only the corrected sole
contract. `/10` bytes, roots, and evidence are permanently ineligible for
adoption, repair, retry, or promotion.

Use canonical bounded records, typed errors, append-only history, streamed
hashing, same-directory atomic persistence, explicit durability claims, and
content-addressed invalidation. Never use a single `passed` boolean as the
campaign control plane.

### Model Composition And Numerical Runtime

The composition is exactly:

1. `model.slm2`
2. `tokenizer.tokenizer2`
3. `template.template2`
4. `sampling.sampling2`
5. `prompt.prompt2`
6. `composition.acg2`

The first source candidate remains `Qwen/Qwen3-0.6B` at immutable revision
`c1899de289a04d12100db370d81485cdf75e47ca`. Conversion and structural
inspection do not prove numerical inference or quality. The required proof
chain is source framework to scalar native to optimized native to real-browser
WASM, with first-divergence diagnostics at tokenizer, template, embeddings,
layers, logits, sampling, and token sequence boundaries.

Quantization is an explicit semantic contract: signed range, scale placement,
group size, packing order, tails, accumulator precision, rounding, and special
unquantized tensors must be exact. Mixed-Q8 is the current planned profile; it
is neither 1-bit nor a TurboQuant claim. TurboVec, TurboQuant, Colibri, sparse
submodels, overlays, speculative decoding, WebGPU, and independently trained
specialists remain separate baseline-gated research until exact artifacts and
noninferiority evidence exist.

### Tokenizer, Template, Prompt, And Sampling

Publisher tokenizer behavior is part of the model contract. Encoding,
decoding, byte fallback, merges, special tokens, Unicode edge cases, template
whitespace, thinking controls, stop IDs, RNG, tie order, top-k/top-p,
repetition penalty, and termination cannot come from ambient library defaults.
User or retrieved text cannot inject trusted role separators or generation
markers.

Prompt assembly is authority ordered and token-budgeted. System/product policy,
current user turn, prior conversation, trustworthy local state, and untrusted
retrieved memory remain distinct inputs. Truncation is deterministic and
visible in evidence; it does not silently rewrite meaning.

### Browser Runtime And Conversation

The worker owns installed composition identity, parsed model state, tokenizer,
KV cache, generation state, and cancellation. UI/worker messages bind protocol,
composition, conversation, turn, generation, message, sequence, and bounded
payload identities. Late events from an old worker are non-authoritative.

Cancellation stops real work. A trapped or terminated worker is discarded; a
fresh worker reopens and verifies immutable installed bytes. No hidden retry,
JavaScript inference fallback, server inference fallback, output repair, or
best-of-N path exists.

Real browser evidence includes exact Chromium build, worker and WASM hashes,
composition identity, raw private outputs, message/render counts, network
summary, resource ceilings, browser-process closure, owned profile deletion,
and a typed terminal result. Node execution, a reload, an incognito context,
or `localStorage.clear()` is not that proof.

### Acquisition And Companion

Selecting a model must perform the operation. The product must never download
TXT, README, JSON, PowerShell, or other handoff instructions as the primary
action.

Route selection is deterministic:

1. import an exact, current, quality-qualified composition from proven direct
   peers when one exists;
2. otherwise ask the installed companion to acquire the pinned public source,
   convert once, independently verify, install atomically, and activate;
3. fail with one concrete prerequisite when the companion or capability is
   unavailable.

MiniModel.org is catalog and discovery authority, not a model-byte proxy.
Loopback APIs are origin-bound, session-bound, least privilege, typed, bounded,
and unable to accept arbitrary commands, paths, or URLs. The remaining
one-file catalog vocabulary and obsolete browser REST bridge are release
blockers, not compatibility surfaces to preserve.

### Quality, Distillation, And Specialists

Screen the untouched source before conversion or training. Preserve raw
outputs, preregister seeds, use unseen paraphrase families and genuine
multi-turn cases, and permit honest rejection. Structural success, model size,
popularity, benchmark familiarity, or one attractive response is not quality.

Use layered evaluation: deterministic structure, scenario-specific semantic
invariants, non-authoritative model judges, and blinded human adjudication.
Positive helpful cases substantially outnumber refusal cases. No evaluation
prompt, expected concept, failed holdout, judge artifact, hidden reasoning,
credential, or private memory may enter training.

Specialists are independently trained, provenance-bound artifacts with sealed
incremental benefit and general-helpfulness noninferiority. Arbitrary tensor
slicing, renamed identical bytes, precision-only relabeling, and cross-model KV
reuse are catalog theater, not meaningful model diversity.

### Memory And User Authority

Keep weights, adapters, KV cache, transcript, local UAIX memory, retrieval
indexes, and MemoryEndpoints records as separate identities. Runtime memory
never mutates model weights. Retrieved or quoted instructions are data.
Durable writes, supersession, conflicts, tombstones, reconciliation, and
deletion are explicit.

Local memory files remain the offline and device-local lane.
MemoryEndpoints.com is authorized and strongly recommended with two distinct
uses. First, agents across every ecosystem site use it directly for
agent-to-agent long-term memory, meetings, handoffs, and coordination. Second,
the TinyRustLM.com Connect plugin lets a user sign in to MemoryEndpoints.com
and explicitly use it as the long-term-memory provider for TinyRustLM.com
Connect. The lanes have separate identities, credentials, consent, scopes,
provenance, and evidence; neither silently authorizes the other.

During prelaunch, important memory may also be duplicated in current `.uai`,
wiki, source-controlled public-safe notes, and approved private stores for
resilience. Every maintained copy must remain current, secret-safe,
provenance-labeled, and noncontradictory. Configuration or reachability is not
a live continuity receipt. Production agent meetings, plugin enrollment,
scoped token flow, cross-browser restore, replay rejection, 25-company
cleanup, and post-delete proof remain separately gated.

### P2P And Fleet Operations

Only quality-qualified, provenance-bound, cryptographically distinct artifacts
enter the fleet. Two lanes mean two independently restartable processes sharing
one read-only piece store, not two URLs in one process. Public reachability
requires current signed outside-observer receipts; loopback, LAN, hairpin, or
local imports do not count.

Piece mixing requires complete artifact and piece-set identity agreement,
per-piece hashes, bounded concurrency, a durable journal, corruption
quarantine, whole-member verification, and atomic promotion. Expired, changed,
revoked, or unreachable endpoints leave the catalog.

### Release, Supply Chain, And Documentation

Every coherent green major change is committed and pushed. Deployment occurs
only when all affected gates pass from committed, pushed, remote-exact source.
The release binds lock files, dependency closure, SBOM/provenance, package and
native asset hashes, browser assets, service worker, security headers, tests,
publication log, rollback identity, and public HTTPS readback.

Architecture, format, tokenizer, quantization, performance, browser,
acquisition, memory, operator, troubleshooting, security/privacy, marketing,
and release documentation are product deliverables. A release gate must fail
when maintained documentation contradicts source or claims evidence that does
not exist.

## Explicit Rejections

Do not add or retain:

- SLM1, ACG1, a one-file `.slm` product path, an old runtime, packer, or
  browser harness;
- compatibility readers, migrations, aliases, response repair, hidden retry,
  provider fallback, dual protocols, or deferred deletion;
- a monolithic OMI kernel, generic cognitive IR, language-cloned semantic
  services, speculative microservices, graph databases, alternate model
  runtimes, or executable artifact programs;
- runtime self-modification, test-time weight updates, silent memory
  consolidation, latent machine-control protocols, or physical-control scope;
- arbitrary model slicing, unverified specialist overlays, cross-composition KV
  reuse, or invented compression/performance claims;
- project-hosted model-byte fallback, remote inference fallback, instruction
  file downloads, or unrestricted browser-to-filesystem APIs;
- opaque LLM judges as sole quality authority, keyword gates, repaired output,
  best-of-N selection, training on holdouts, or threshold changes after seeing
  results;
- simulated MemoryEndpoints, local P2P probes presented as public proof,
  cross-compilation presented as physical execution, or package creation
  presented as publication;
- stale documentation, stale publication logs, deployment from uncommitted
  source, or campaign counter inflation.

## Historical Checkpoint Routes

These immutable pages preserve detailed execution and correction evidence.
They are reached from this canonical node rather than copied into every hot
`.uai` file:

| Checkpoint | Durable route |
| --- | --- |
| Post-/10 reviewed intake | `wiki/runtime-mirust/reports/tinyrustlm-post-v10-native-browser-release-intake-memory-2026-08-26.md` |
| Qwen3 model-load correction | `wiki/runtime-mirust/reports/tinyrustlm-qwen3-model-load-correction-memory-2026-08-26.md` |
| Numerical execution terminal | `wiki/runtime-mirust/reports/tinyrustlm-qwen3-numerical-execution-terminal-memory-2026-08-26.md` |
| Composition /12 structural pass | `wiki/runtime-mirust/reports/tinyrustlm-qwen3-composition-v12-structural-pass-memory-2026-08-26.md` |
| Source-terminal process identity correction | `wiki/runtime-mirust/reports/tinyrustlm-qwen3-source-terminal-process-identity-correction-memory-2026-08-26.md` |
| Source-terminal verification v1 | `wiki/runtime-mirust/reports/tinyrustlm-qwen3-source-terminal-verification-v1-memory-2026-08-26.md` |

Their historical MemoryEndpoints statements describe what those operations did
or did not prove at the time. They do not override the current two-lane policy
in this node and the report decision index.

## Manifest-Owned Intake Routes

| Batch | Durable route | Principal use |
| --- | --- | --- |
| 2026-06-30 | `docs/report-intake/2026-06-30/MANIFEST.md` | Rust/runtime, browser fit, tokenizer, packaging foundations |
| 2026-07-01 | `docs/report-intake/2026-07-01/MANIFEST.md` | MiniModel P2P research and SLMComposer dashboard UX |
| 2026-07-02 | `docs/report-intake/2026-07-02/MANIFEST.md` | TinyRustLM/MiniModel source and peer announcement flows |
| 2026-07-02 follow-up | `docs/report-intake/2026-07-02-followup/MANIFEST.md` | Follow-up direct-peer and usability guidance |
| 2026-07-03 | `docs/report-intake/2026-07-03/MANIFEST.md` | Desktop companion, P2P, and documentation |
| 2026-07-07 | `docs/report-intake/2026-07-07/MANIFEST.md` | Focused response-quality research |
| 2026-07-08 | `docs/report-intake/2026-07-08/MANIFEST.md` | Distillation, compression, quality, and system plan |
| 2026-07-10 | `docs/report-intake/2026-07-10/MANIFEST.md` | MemoryEndpoints connector and response-quality work |
| 2026-07-11 | `docs/report-intake/2026-07-11/MANIFEST.md` | Small-model and response-quality footprint research |
| 2026-07-11 batch 2 | `docs/report-intake/2026-07-11/small-model-research-batch-2/MANIFEST.md` | Additional model families, adapters, and evaluation |
| 2026-07-12 | `docs/report-intake/2026-07-12/memory-connectors-and-notifications/MANIFEST.md` | Browser memory connectors and notifications |
| 2026-07-13 | `docs/report-intake/2026-07-13/dotnet-p2p-seed-host/MANIFEST.md` | .NET companion, seed host, fleet, proof, and packages |
| 2026-07-14 | `docs/report-intake/2026-07-14/dogfood-quality-campaign/MANIFEST.md` | No-cheat quality, 50 rounds, memory, P2P, release evidence |
| 2026-07-15 deep models | `docs/report-intake/2026-07-15/deeper-small-model-research/MANIFEST.md` | Architecture screening, training, and small-model quality |
| 2026-07-15 liquid edge | `docs/report-intake/2026-07-15/liquid-edge-research/MANIFEST.md` | Liquid/edge architecture research and rejection boundaries |
| 2026-07-18 | `docs/report-intake/2026-07-18/turbovec-turboquant-and-handoff-audit/MANIFEST.md` | TurboVec/TurboQuant, KV compression, and custody audit |
| 2026-07-21 specialists | `docs/report-intake/2026-07-21/champion-specialist-submodel-research/MANIFEST.md` | Champion/specialist portfolio and sealed routing evidence |
| 2026-07-21 Colibri | `docs/report-intake/2026-07-21/colibri-specialist-portfolio/MANIFEST.md` | Colibri placement lessons and model-slicing corrections |
| 2026-08-01 | `docs/report-intake/2026-08-01/enterprise-vnext-development-research/MANIFEST.md` | Enterprise clean-slate architecture and implementation plan |
| 2026-08-08 | `docs/report-intake/2026-08-08/active-handoff-closure/MANIFEST.md` | Handoff closure, vector experiments, and durable goal state |
| 2026-08-26 | `docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md` | Corrected receipt contract and first real native/browser slice |
| 2026-08-27 OMI architectures | `docs/report-intake/2026-08-27/omi-computational-architectures-research/MANIFEST.md` | Typed state/evidence lessons and bounded research queue |
| 2026-08-27 ontological MI | `docs/report-intake/2026-08-27/ontological-machine-intelligence-research/MANIFEST.md` | Authority, user sovereignty, promotion, and speculative boundaries |

For report-level hashes and dispositions, read
`.uai/intake-outcome-ledger.uai`. For topic-specific reasoning, follow the
synthesis, TDD, and wiki routes named by the corresponding manifest. Raw
reports are consulted only for a named question or source audit.

## Current Worktree Truth

The implementation checkpoint entering this memory consolidation is commit
`5a9c097e66a83ceb6ee71ebe36462981e311baf6`, tree
`e3ebbec3c910b60e54280eff4d4643196b28b87f`, followed by remote-exact memory
checkpoint `da8bfacc138e4ab12291a9e90f77d6e5d62471b4`. At that checkpoint, the
managed Release solution passed 252/252, the standard Node partition passed
1,702 with zero failures and three declared skips, the focused browser/vector
partition passed 19/19, formatting passed, and diff hygiene passed.

The sole current Companion contract is `loopback-capability/4` with
`acquire.v2`, `operation.v3`, and `operation-projection.v2`. It binds one
explicit attempt to the exact pinned Qwen3 source, source-only routing, private
create-only operation/source evidence, a canonical nine-file payload
inventory, monotonic terminal state, and exact six-member fixed-chunk
transfer. Superseded operation readers and arbitrary inventory identities are
not accepted.

This is source and test evidence only. The production listener still returns
typed `operation-not-available`: no production operation executor or source
network owner exists. The browser client is not loaded by the product UI. No
real source acquisition, conversion, model, numerical parity, browser chat,
quality, P2P reachability, deployment, publication, agent meeting, user plugin
connection, or live MemoryEndpoints lifecycle has been proven.

## Ordered Resume

1. Keep the report corpus immutable, finish the bounded `.uai` consolidation,
   and route active memory through this node and the decision index.
2. Implement the preregistered exclusive restart-safe Companion source
   operation owner with bounded pinned-source streaming, contained converter
   launch, immutable terminal evidence, and independent six-member inspection.
3. Wire the proven operation only after the production executor exists; then
   load the sole browser client and delete the obsolete bridge and one-file
   acquisition vocabulary in one green clean cut.
4. Run syntax, formatting, Cargo metadata/build/test/clippy/doc, .NET, complete
   Node, real browser, accessibility, privacy, package, documentation, and
   release-surface gates.
5. Commit and push every coherent green change, fetch, and verify local,
   tracking, `FETCH_HEAD`, and direct remote equality.
6. Deploy each affected site only from its bound green commit; verify public
   HTTPS bytes, headers, service-worker state, publication log, and rollback.
7. Register and execute a wholly new source-to-six-member conversion. Never
   reuse `/10` or its output.
8. Establish composition, scalar, optimized-native, and real-browser numerical
   evidence before behavioral qualification.
9. Qualify one model without repair or best-of-N, then prove P2P-or-convert,
   clean-profile chat, direct agent coordination, the TinyRustLM.com Connect
   MemoryEndpoints plugin lifecycle, and outside-observed P2P lanes.

## Objective Counters And Claims

Until exact live receipts exist, campaign counters remain:

- qualified models: `0/20`
- clean browser rounds: `0/50`
- live MemoryEndpoints continuity rounds: `0/25`
- externally proven P2P lanes: `0/40`
- catalog announcements: `0/20`

The current work may claim source cleanup and passing named tests only. It may
not claim a real converted model, numerical parity, useful assistant quality,
live cross-browser memory, public P2P availability, catalog publication, or
campaign completion.

## Hot-Memory Routing

Hot `.uai` files should preserve only domain-specific decisions, current state,
and this route. The canonical deep link is:

`wiki/runtime-mirust/reports/tinyrustlm-enterprise-intake-and-production-runtime-clean-cut-memory-2026-08-28.md`

The report decision index is:

`wiki/runtime-mirust/reports/tinyrustlm-report-intake-decision-index-2026-08-28.md`

These nodes supersede stale UAI status and policy prose. Historical receipts
and wiki records remain immutable, but current `.uai` memory contains only
present-tense decisions, concise pointers, current blockers, and the two-lane
MemoryEndpoints product rule.

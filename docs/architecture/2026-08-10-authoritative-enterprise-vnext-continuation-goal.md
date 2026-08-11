# Authoritative Enterprise TinyRustLM vNext Continuation Goal

This document is one self-contained execution assignment for the next principal
engineering agent. It supersedes stale startup observations and phase ordering
in earlier goal prompts, but it does not reduce their final acceptance scope.
The receiving agent must inspect the actual workspace, implement production
code, run the complete affected gates, publish fully qualified site releases,
and preserve objective evidence. It is not a request for another research
report or a high-level proposal.

## 1. Role And Mission

You are the principal engineer, Rust runtime architect, browser reliability
lead, ML systems engineer, security engineer, release operator, evidence-system
owner, and documentation steward for the TinyRustLM ecosystem.

Build an enterprise-quality, browser-local small-language-model platform that:

1. Acquires verified `.slm` model bytes through direct P2P when a current,
   consenting peer is available.
2. Automatically starts a reviewed local companion conversion when no verified
   P2P artifact is available and the user selects a supported source model.
3. Never substitutes a text file, request JSON, shell script, or explanatory
   download for the user's intended working-model acquisition action.
4. Keeps prompts and model bytes off TinyRustLM.com, MiniModel.org, and every
   other project-hosted public server.
5. Runs one deterministic Rust inference core natively and through WebAssembly.
6. Treats scalar Rust as the correctness oracle and promotes SIMD, threads, and
   WebGPU only after exact or explicitly budgeted conformance evidence.
7. Supports one strong general conversational champion plus compact specialists
   only where measured end-to-end quality and total-system cost justify them.
8. Preserves exact source revision, tokenizer, chat template, conversion,
   quantization, runtime, sampling, evaluation, and publication lineage.
9. Uses deterministic context compilation, typed authority and provenance,
   bounded memory, grammar-constrained output, and deterministic local tools.
10. Uses a separately installed local companion for native acceleration,
    conversion, and direct P2P through one versioned origin-bound protocol.
11. Integrates MemoryEndpoints only through a publicly advertised, versioned,
    authorized contract. Never guess production routes or infer success from a
    missing capability, fixture, mock, or HTTP error.
12. Produces immutable, content-addressed, public-safe receipts without storing
    credentials, prompts, model bytes, private paths, or hosted-memory payloads.
13. Keeps product, catalog, download, package, marketing, support,
    documentation, and release-history surfaces synchronized with current
    evidence.
14. Completes the real 20-model, 50-clean-browser-round, 25-live-memory-round,
    40-outside-lane, and 20-live-catalog-announcement campaign honestly.

## 2. Non-Negotiable Product Policy

TinyRustLM and the related sites are pre-public dogfood systems. There is no
customer compatibility obligation. Until the human explicitly revokes this
policy, apply all of the following:

1. No legacy support.
   - No old `.slm` reader.
   - No dual writer or dual reader.
   - No deprecated route alias.
   - No migration shim.
   - No fallback schema.
   - No retained obsolete dashboard, release, evidence, or store API.
   - Historical receipts remain immutable data, not executable compatibility
     behavior.
2. No technical debt.
   - No knowingly temporary production architecture.
   - No TODO-backed required behavior.
   - No skipped validation hidden behind documentation.
   - No unbounded input, allocation, cache, queue, retry, log, archive, or
     traversal.
   - No test weakening, expected-output repair, or exception swallowing to
     manufacture green status.
3. Rewrite wrong boundaries completely.
   - Reuse only code that meets the clean target.
   - Replace weak unpublished contracts rather than wrapping them.
   - Delete superseded code, tests, commands, docs, and configuration in the
     same verified cutover.
4. Enterprise quality is the minimum.
   - Treat every external byte as hostile.
   - Use checked arithmetic before allocation or range access.
   - Make every persistent mutation create-only or atomic, restart-safe, and
     independently verifiable.
   - Bind every public claim to current exact evidence.
   - Preserve every failed operation as bounded evidence.
5. Documentation and marketing are release artifacts.
   - Stale docs are release failures.
   - Product wording cannot lead implementation evidence.
   - Every affected site receives current version, release date, last-published
     time, update history, limitations, and evidence-bound claims.
6. User autonomy and cognitive liberty remain product requirements.
   - Lawful adult requests receive substantive help.
   - Security and nonconsensual-harm boundaries remain narrow and explicit.
   - Memory and retrieved text are untrusted data, not higher-priority
     instructions.

Keep this policy in applicable `totem.uai` and `taboo.uai` files. Do not weaken
it merely to satisfy an old test or an unpublished interface.

## 3. Authoritative Starting State To Revalidate

Do not assume these mutable facts remain true. Revalidate them before changing
anything, then update the handoff if reality differs.

### 3.1 Source Authority

- Workspace root: `E:\Source`
- Active TinyRustLM worktree: `E:\Source\.tinyrustlm-model-acquisition`
- Active branch: `codex/model-acquisition-v2`
- Expected active and upstream head:
  `b103edc6e839ad420fb5fcd72e1a9fc9f7a3949c`
- Canonical checkout `E:\Source\Rust\TinyRustLM.com` is dirty user-owned
  state. Never reset, clean, revert, overwrite, or use it for this branch.
- Machine routing account: `E:\Source\Rust\workspace.uai`, profile
  `rust-site-family.workspace.v44`, observed SHA-256
  `4d2cd1252d8baf7091b3761df0cd823340368bdb0d33109a8d8a81019b3d1758`.
- Large models, third-party repositories, training environments, downloaded
  artifacts, and review-only source belong under
  `E:\Source\External\{project-name}` and never in project Git.
- Model bytes, model pieces, conversion workspaces, and large output artifacts
  stay outside source control. Only explicitly allowlisted small deterministic
  fixtures may be tracked, and they never count as product models.

### 3.2 Seven-Site Source-Control Boundary

All seven authoritative worktrees were fetch-audited clean and upstream-exact
on 2026-08-10. Revalidate each:

| Site | Authoritative head | Current bounded truth |
|---|---|---|
| TinyRustLM.com | `b103edc6e839ad420fb5fcd72e1a9fc9f7a3949c` | Product source; immutable public release remains 0.2.1 because current internal work changed no production web closure bytes. |
| TinyRustLM.MiRust.com | `6d77afc4b54f7f84db7efa33d8798aef61e9733f` | Documentation release 1.7.0 is published and readback-verified. |
| MiniModel.MiRust.com | `cb18263ac739b64af717aa6c5568b65b05af9962` | Frozen release 1.0.0 is validated and unpublished. |
| MiniModel.org | `b5a0248d76ce543eb3ce02fc016ff611b7e41c19` | Frozen release 1.0.0 is validated and unpublished; closure contains zero model bytes. |
| Runtime.MiRust.com | `4b179a1c6d458cf9b85ae2f5cde2925fe1fad086` | Retired redirect package; live redirect was observed, but its FileZilla profile is misbound and must not be used. |
| MiRust.com | `4e3d8f52b0b20d9ccb51751e4182e8ab87fb3e43` | Bounded metadata and governance source, not a complete deployable WordPress production snapshot. |
| LMComposer.com | `36d6389fe82b0f53c4d8951aa6af5cb896fd8bf6` | Private `MichaelKappel/LMComposer.com` redirect source; source control is complete, publication receipt is absent. |

If an applicable site ever lacks a remote repository, create a private remote,
push a complete clean source closure, set upstream tracking, and verify exact
remote equality before proceeding. Never leave the only source copy local.

### 3.3 Completed Documentation Publication

TinyRustLM.MiRust.com 1.7.0 is terminally successful. Do not replay it as an
ordinary resume operation.

- Frozen source commit:
  `5c492e3a8fd96d1c676944755d73755c7b56eddb`
- Frozen source tree:
  `cf0ea1442b0fb0dd251276ea602ee7275f35173c`
- Closure: 224 files, 7,711,238 bytes
- Manifest SHA-256:
  `6407606c8ffcf5b4f966b77c54f511d25e1afa236ad1b148350d6e2bd4314500`
- Completion: `2026-08-09T23:59:28.1969079Z`
- Success receipt:
  `deploy/receipts/site-deployment-20260809T234347Z.json`
- Receipt SHA-256:
  `746666fc3b631b8f361c6d57e2debdc167cab0e315556ddc4e50f5cde1c20646`
- Receipt commit:
  `499f2775582c5cd14ec04a93c0176baace388384`
- Terminal handoff head:
  `6d77afc4b54f7f84db7efa33d8798aef61e9733f`

Prior failed receipts remain immutable history and must not be overwritten.
This successful site receipt proves only that bounded site publication. It does
not prove model quality, campaign rounds, MemoryEndpoints continuity, public
P2P reachability, or catalog announcement.

### 3.4 Current Campaign Truth

The live campaign counters remain exactly:

- Qualified useful model artifacts: `0/20`
- Deletion-backed clean browser rounds: `0/50`
- Authorized live MemoryEndpoints continuity rounds: `0/25`
- Current outside-network lane proofs: `0/40`
- Live MiniModel catalog announcements: `0/20`

Local fixtures, unit tests, mapped-host browser runs, loopback peers, structural
validation, package creation, cross-compilation, and partial uploads do not
advance these counters.

### 3.5 Current vNext Implementation Boundary

The active phase is `phase_3_release_surface_cutover`.

Already pushed foundations include:

- Canonical receipt identity and create-only receipt storage.
- Signature authority and currentness graphs.
- Public-safe redaction.
- Phase invalidation.
- Offline verification bundles.
- Rust campaign-plan and campaign-projection parity.
- Browser-to-Rust campaign-evidence WASM boundary.
- Public subject storage and exact campaign runner.
- Acyclic `release_manifest.v3` release graph.
- Fresh campaign release surface.
- Release preparation and authorization.
- Deployment-attempt admission.
- Exact production HTTPS byte verifier and readback admission.
- Pure site-publication descendant materialization.

Important current milestones:

- `c95e28901db287923f36869c4594ba66c221f71d`: exact web publication graph.
- `17fac947762f73abbbb5f27a2d9bef85757b94f9`: immutable deployment-attempt admission.
- `900a3f3`: exact production HTTPS byte verifier.
- `316b74fac98863e2e37d9b78b3380902393c1dc3`: production readback admission.
- `0f145bb02bb97dd3554a9596c67a47a48a2bbb26`: pointer, history, and published-claim descendant materialization.

Current sole-path candidates include:

- `tinyrustlm/tools/vnext-campaign-release-surface.js`
- `tinyrustlm/tools/vnext-site-publication.js`
- `tinyrustlm/tools/vnext-campaign-runner.js`
- `tinyrustlm/tools/vnext-receipt-store.js`
- `tinyrustlm/tools/vnext-subject-store.js`
- `contracts/vnext/campaign-release-surface-profile.v1.json`
- `contracts/vnext/site-publication-profile.v1.json`

The old mutable stack still exists and must be removed after the current
replacement is integrated and fully verified:

- `tinyrustlm/tools/campaign-evidence-dashboard.js`
- `tinyrustlm/tools/campaign-final-attestation.js`
- `tinyrustlm/tools/campaign-release-authorization-evidence.js`
- `tinyrustlm/tools/campaign-public-readback-evidence.js`
- `tinyrustlm/tools/campaign-public-artifact-scope.js`
- `tinyrustlm/tools/campaign-release-evidence.js`
- Their dedicated old tests, maintained docs, commands, and configuration.

Historical blobs and receipts may retain old names as inert history. Do not
delete or rewrite immutable evidence merely to make a text search empty.

### 3.6 Known External Boundaries

- The live MemoryEndpoints enrollment, reconnect, and cleanup contract is not
  currently proven available to this workspace.
- Authorized access for 25 disposable live companies is absent.
- Independent outside-network P2P observers and current signing authority for
  40 lane proofs are absent.
- Twenty distinct qualified useful model artifacts do not yet exist.
- Physical linux-arm64 execution evidence remains absent.
- Runtime.MiRust.com's deployment profile is misbound.
- MiRust.com is not a complete production snapshot.

These block only dependent branches. Continue every independent local,
contract, implementation, test, documentation, packaging, and site task.

## 4. Evidence And Authority Order

Use this precedence when facts conflict:

1. Current repository bytes and current tests.
2. Current frozen machine-readable vNext contracts.
3. Authorized live responses and physical execution evidence.
4. Immutable source/model/dependency revisions and official primary sources.
5. Current immutable receipts and their validated dependency graph.
6. Accepted architecture decisions and threat reviews.
7. Archived research reports as advisory input.
8. Explicitly labeled engineering assumptions.

Never let a report, old handoff, stale public page, attractive response, or
passing fixture override stronger current evidence.

## 5. Full Objective And Definition Of Complete

The objective is not merely to finish Phase 3. Build and verify the complete
enterprise vNext platform and execute its real release campaign.

Complete means all of the following are objectively true at the same current
revision:

1. One clean `.slm` vNext format and one runtime path exist; no legacy reader,
   writer, route, or compatibility behavior remains.
2. Parser, writer, converter, inspector, native runtime, WASM runtime, browser,
   companion, memory, P2P, package, and release gates pass.
3. One strong general champion and useful specialists are qualified by unseen,
   contamination-controlled semantic evidence.
4. Twenty distinct provenance-bound artifact hashes qualify.
5. Fifty real clean-profile browser conversations pass, with every model
   exercised in at least two independent restarts.
6. Exactly twenty-five designated rounds complete authorized live
   MemoryEndpoints claim, continuity, replay rejection, cleanup, and deletion.
7. Every model is served by exactly two independently restartable process
   lanes sharing one read-only piece store.
8. Forty current signed proofs come from genuinely outside the serving network.
9. Twenty live MiniModel announcements pass public readback and remain current.
10. Required Rust, WASM, C ABI, .NET, NuGet, symbols, archives, SBOM,
    provenance, signing, malware-scan boundary, and secret-scan gates pass.
11. `win-x64`, `linux-x64`, and physical `linux-arm64` execution evidence meets
    the declared release-channel minimum.
12. All seven sites are source-controlled, current, versioned, documented,
    published where deployable, and evidence-consistent.
13. Final attestation binds exact source, tools, contracts, models, tests,
    packages, sites, authorizations, and external proofs.
14. Remaining risks and unavailable external authority are explicit.

Do not mark the objective complete from local tests, site publication, a small
model smoke, or a partial campaign.

## 6. Dependency-Aware Execution Plan

Follow this order unless current evidence proves a dependency change. Update a
live plan while working. Complete independent work behind external blockers.

### Gate A: Recover And Protect The Workspace

1. Read this entire assignment, `workspace.uai`, `.uai/totem.uai`,
   `.uai/taboo.uai`, `.uai/short-term-memory.uai`, and the root
   `E:\Source\Rust\workspace.uai`.
2. Fetch all seven repositories and record local head, upstream head, branch,
   clean status, and remote URL.
3. Leave the protected dirty TinyRustLM checkout untouched.
4. Verify no deployment or verifier process from a prior session remains.
5. Revalidate the TinyRustLM.MiRust.com success receipt and selected public
   readbacks without replaying its terminal publication.
6. Record exact campaign zeros and external blockers.
7. Preserve unrelated user changes and every prior failed receipt.

Gate evidence:

- Seven clean/upstream-exact source records or explicit per-repo divergence.
- Valid TinyRustLM.MiRust.com receipt hash and dependency identities.
- No leaked credentials or model payloads in Git.
- Updated private handoff when any mutable fact differs.

### Gate B: Close The Remaining Site Publication Checkpoint

#### B1. Runtime.MiRust.com

1. Work in
   `E:\Source\Worktrees\rust-site-release-20260809\Runtime.MiRust.com`.
2. Run `tools/verify-runtime-mirust.ps1` and the shell equivalent where
   available.
3. Prove the expected redirect and followed destination route now that
   TinyRustLM.MiRust.com 1.7.0 is current.
4. Preserve a bounded verifier receipt.
5. Never use the misbound FileZilla profile.
6. Do not claim a new Runtime publication unless a Runtime-only deployment
   identity is independently verified and a complete publication receipt is
   produced.

#### B2. MiniModel.MiRust.com 1.0.0

1. Work in
   `E:\Source\Worktrees\rust-site-release-20260809\MiniModel.MiRust.com`.
2. Revalidate the exact 32-file, 297,572-byte closure.
3. Require manifest SHA-256
   `cd26d06a393ef99fde0c4b009b500905530ce76a8abfe0e282e15e20869354f5`.
4. Run `& .\tools\deploy-site.ps1` first as validation, then
   `& .\tools\deploy-site.ps1 -Publish` only from the clean pushed closure.
5. Preserve every attempt receipt append-only.
6. Require complete authoritative transport verification and public HTTPS
   readback before success.
7. Commit and push the successful receipt and terminal handoff immediately.

#### B3. MiniModel.org 1.0.0

1. Work in
   `E:\Source\Worktrees\rust-site-release-20260809\MiniModel.org`.
2. Retain the current passing Node 12/12 and complete Rust source gate.
3. Revalidate the exact 34-file, 546,253-byte closure.
4. Require manifest SHA-256
   `4052e62970b1968b2849a14954d6420d9a3e063c4e6e6257d5b3523ca4c8dc83`.
5. Prove the closure contains zero model bytes.
6. Run `& .\tools\deploy-site.ps1` first as validation, then
   `& .\tools\deploy-site.ps1 -Publish` only from the clean pushed closure.
7. Preserve every attempt receipt append-only.
8. Require complete transport and public HTTPS readback before success.
9. Commit and push the successful receipt and terminal handoff immediately.

#### B4. Seven-Origin Reconciliation

1. Reverify all seven public origins and expected redirect behavior.
2. Update version, release date, last-published time, update history, and
   bounded status on each affected site.
3. Update every source-controlled site handoff and the root workspace router.
4. Keep unknown publication dates unknown when no immutable receipt exists.
5. Do not publish MiRust.com from an incomplete WordPress snapshot.

### Gate C: Complete The Phase 3 Clean-Slate Release Cutover

The target is one release truth path from current receipt/subject stores through
campaign projection, final attestation, release preparation, authorization,
deployment admission, exact readback, site-publisher authorization,
publication descendant materialization, and published claim admission.

Required implementation:

1. Integrate `vnext-site-publication.js` into the sole current release surface.
2. Bind one current site-publisher Ed25519 authority role, key, scope, issue
   time, expiry, source revision, release ID, site, origin, and exact static
   readback receipt.
3. Generate pointer and append-only history documents deterministically from
   the finalized release and site-publication profile.
4. Generate direct evidence-bound `claim.v2` publication descendants only
   after exact deployed-byte readback and current site-publisher authorization.
5. Make generated public documents forward-only descendants. They must not
   participate in a cyclic release identity or self-reference their own wire
   bytes.
6. Persist every receipt and public subject create-only, with redaction before
   persistence and no mutable `latest` authority.
7. Reconstruct all lineage from stores on restart. Caller-provided status,
   counters, verdicts, currentness, or publication truth are forbidden.
8. Reject expired authorization, stale keys, replayed operation IDs, source
   drift, snapshot drift, byte drift, origin drift, route drift, generated
   document backreferences, missing claims, extra claims, and cyclic ancestry.
9. Ensure failed publication materialization cannot leave an accepted pointer,
   partial history, published claim, or mutable alias.
10. Keep public evidence minimal and secret-free.

Then perform the clean cutover:

1. Redirect every maintained caller, command, package entry point, test helper,
   architecture document, and operator view to the vNext replacement.
2. Delete the six old mutable tool files listed in Section 3.5.
3. Delete their old tests and stale maintained documentation.
4. Delete obsolete mutable stores, dashboard snapshots, aliases, schemas, and
   configuration paths that exist only for the removed stack.
5. Add negative conformance checks forbidding import, execution, documentation,
   or configuration references to removed production paths.
6. Preserve immutable historical blobs and receipts as inert evidence only.
7. Add no compatibility wrapper, deprecated export, migration reader, or dual
   path.

Minimum Gate C tests:

- Current happy path from fresh campaign projection through publication
  descendants.
- Honest zero/incomplete campaign remains incomplete.
- Caller truth injection fails.
- Expired and revoked authority fails.
- Signature, source, manifest, snapshot, origin, route, and byte drift fail.
- Operation replay fails.
- Process interruption at every persistence boundary is restart-safe.
- Redaction failure persists only bounded failure evidence.
- Generated pointer/history/claim outputs are deterministic and defensive.
- History is strictly ordered and bounded.
- Old ledger, mutable dashboard, and obsolete entry points are absent.
- Complete Node and Rust gates pass after deletion.

Required commands include, adjusted only when current repository scripts prove a
new canonical equivalent:

```powershell
npm --prefix tinyrustlm run test:vnext-campaign-release-surface
node --test tinyrustlm/tests/vnext-site-publication.test.js
npm --prefix tinyrustlm run test:unit
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
git diff --check
```

Run every deterministic generator in check mode and prove regenerated bytes are
unchanged. Run affected browser and deployment tests when the cutover changes a
web or release entry point.

### Gate D: Close Durability And Hostile-Input Foundations

1. Implement the Rust/Win32 directory-flush helper required for an honest
   Windows durable-publication claim.
2. Bind file fsync, directory durability, create-only publication, and readback
   into explicit receipts.
3. Implement bounded compressed archive-member scanning before package or
   evidence admission.
4. Reject traversal, duplicate normalized paths, links, reparse points,
   decompression bombs, excessive ratios, oversized members, too many members,
   and nested archive abuse.
5. Complete protected equality-list custody so release allowlists cannot drift
   silently or be caller-substituted.
6. Run restart, disk-full, lock-contention, truncation, bit-flip, stale-temp,
   Windows rename, and quarantine tests.
7. Expand fuzz, property, differential, and hostile corpus coverage around all
   parsers and persistence boundaries.

Do not claim full Windows durability until physical evidence proves the helper
and filesystem behavior.

### Gate E: Freeze And Implement One `.slm` vNext Format

1. Resolve and record final incompatible decisions for header, sections,
   metadata grammar, tokenizer representation, tensor table, quantization,
   piece identity, signatures, adapters/specialists, and forward-only extension
   policy.
2. Use one bounded parser and one deterministic writer.
3. Use checked arithmetic for every offset, size, product, alignment, tensor
   shape, KV allocation, and decompression bound.
4. Reject unknown required fields, duplicate keys, overlap, gaps forbidden by
   the profile, malformed UTF-8, noncanonical metadata, unsafe tensor shapes,
   bad tails, hash drift, and signature drift before activation.
5. Stream large artifacts and hashes. Do not load multi-gigabyte files solely
   to compute identity.
6. Implement source conversion, provenance, public-safe inspection, piece
   generation, and final Rust verification.
7. Delete the old format path after full cutover; do not retain a legacy reader.
8. Add parser/writer round trips, language-neutral vectors, differential tests,
   fuzz targets, and malicious corpus cases.

Research involving TurboQuant, TurboVec, Colibri, extreme quantization, sparse
specialists, or partial-model reuse is advisory until independently reproduced.
Promote no 1-bit, ternary, vector-quantized, low-rank, sparse, shared-backbone,
or KV-compressed path from a paper or attractive benchmark alone. Require:

- Exact source and implementation revision.
- Legal and provenance review.
- Deterministic conversion.
- Scalar numerical oracle comparison.
- Tail and pathological-shape coverage.
- Real browser/runtime memory and latency measurement.
- Unseen semantic quality evaluation.
- Explicit regression budgets against the uncompressed baseline.
- Total-system accounting, including codebooks, scales, routing, tokenizer,
  adapters, KV cache, and activation memory.

### Gate F: Build The Reference Runtime And Conformance System

1. Implement tokenizer and chat-template oracles.
2. Implement scalar Rust operators and deterministic sampling as correctness
   authority.
3. Bind model-family semantics explicitly: RoPE, normalization, activation,
   attention grouping, masks, logits, stop behavior, and context limits.
4. Produce source-framework, converted-artifact, native, WASM scalar, WASM
   SIMD, and optional WebGPU comparison vectors.
5. Make repeated seeded output byte-reproducible where deterministic product
   behavior is declared.
6. Add operator, layer, logit, token, and end-to-end differential tests.
7. Promote threaded WASM only where isolation, browser support, determinism,
   cancellation, and memory behavior are proven.
8. Preserve backend identity and exact limits in every runtime receipt.

### Gate G: Build The Browser-Owned Lifecycle

1. Move heavy ingestion, hashing, validation, and generation off the UI thread.
2. Preflight model, activation, scratch, tokenizer, and KV memory before
   allocation.
3. Use a fail-atomic active-model transaction. A failed import cannot replace a
   working model.
4. Keep one authoritative assistant-rendering path and one completion event.
5. Implement cancellation, timeout, worker crash, stale-message rejection,
   restart, persistence, deletion, and storage-pressure behavior.
6. Preserve the approved visual language while fixing functionality. Do not
   casually redesign the product.
7. Verify desktop, narrow desktop, and mobile layouts; keyboard navigation;
   screen-reader labels; reduced motion; long names; long outputs; fixed
   composer behavior; and no overlap.
8. Assert the network boundary: static project assets and metadata only;
   model bytes from local file, loopback companion, or consenting direct peer;
   no prompt upload, project-hosted model bytes, hidden telemetry, or
   credential-bearing URLs.
9. A user's model action must result in a usable model or an explicit bounded
   blocker. Never end the workflow by downloading a `.txt` explanation.

### Gate H: Deterministic Intelligence Support

1. Compile context deterministically with typed source, authority, trust,
   timestamp, supersession, token budget, and truncation evidence.
2. Ensure current user instructions and preferences supersede stale memory.
3. Treat quoted, retrieved, and hosted memory content as untrusted data.
4. Implement grammar-constrained JSON and extraction without response repair.
5. Delegate arithmetic to a deterministic calculator where appropriate.
6. Use a bounded local tool envelope with explicit user intent and no hidden
   network capability.
7. Implement exact speculative decoding only if output distribution and seeded
   product behavior match the declared baseline. Otherwise leave it unpromoted.

### Gate I: Qualify WebGPU

1. WebGPU is optional acceleration, never correctness authority.
2. Preflight adapter features, limits, memory, alignment, and shader profiles.
3. Use bounded kernels with exact shape and tail handling.
4. Compare each promoted profile against scalar Rust and WASM vectors.
5. Test compilation failure, device loss, memory pressure, cancellation,
   adapter changes, and browser restart.
6. Collect physical browser/GPU measurements. Do not invent speedups or infer
   them from shader compilation.
7. Fall back only through an explicit declared backend selection state, not a
   silent correctness-changing path.

### Gate J: Build The Companion And Direct P2P Fleet

1. Freeze one origin-bound pairing, capability, request, response, error, and
   revocation protocol.
2. Keep browser tokens agent/user scoped and least privilege. Never return an
   administrator or workspace credential to browser code.
3. Make conversion and native inference local, explicit, bounded, cancellable,
   and receipt-producing.
4. Serve admitted model pieces through exactly two independently restartable
   process lanes per model.
5. Let both lanes share one read-only content-addressed piece store.
6. Prebind all endpoints before readiness; fail atomically on collision; stop
   the lane when a serving task dies; drain on shutdown.
7. Permit only exact methods, routes, headers, ranges, sizes, timeouts, CORS,
   normalized names, and immutable hashes.
8. Do not silently modify router or firewall state.
9. Distinguish configured, locally healthy, LAN reachable, externally proven,
   advertised, degraded, stale, revoked, and removed.
10. Require a signed, expiring, identity-bound outside observer receipt for
    each of 40 lanes before public announcement.
11. Support resumable multi-peer import only when artifact, manifest, piece-set,
    and per-piece identities agree exactly.
12. MiniModel.org publishes catalog/discovery metadata only. No project-hosted
    fallback may proxy model bytes.

### Gate K: Build And Qualify The Model Portfolio

Target architecture:

- One highest-quality streamlined general champion for ordinary conversation,
  ambiguity, common sense, practical planning, source conflict, current-turn
  precedence, multi-turn continuity, summaries, rewrites, structured output,
  code explanation, and lawful adult inquiry.
- A small number of compact specialists only where measured routing plus
  specialist quality exceeds the champion at lower total cost.
- Shared immutable components or adapters are allowed only when the artifact
  contract, activation transaction, provenance, memory budget, and independent
  identity are explicit. Do not pretend a relabeled shared byte set is a
  distinct model.

Required process:

1. Screen untouched source models before conversion or training.
2. Preserve exact raw outputs under fixed and seeded unseen paraphrases.
3. Reject candidates that repeatedly violate practical constraints, source
   authority, current user preference, quoted-instruction boundaries, or
   ordinary helpfulness.
4. Use assistant-only SFT, LoRA/DoRA, preference optimization, sequence-level
   distillation, top-k logits, hidden-state matching, or full tuning only when
   corpus, licensing, compute, and expected benefit justify them.
5. Teach general rules through scenario-factor generation, authority
   permutations, counterfactual resources, entity/unit substitution, discourse
   variation, state changes, hard negatives, and teacher disagreement.
6. Keep helpful positive examples substantially more common than refusals.
7. Exclude sealed evaluation prompts, expected answer terms, paraphrase
   families, semantic neighbors, and public benchmark overlap through auditable
   contamination controls.
8. Compare source, adapter, merged model, quantized artifact, and final `.slm`
   using untouched outputs, repeated declared seeds, unseen paraphrases,
   multi-turn cases, latency, memory, and explicit regression budgets.
9. Count only cryptographically distinct, provenance-bound, useful artifacts.
   Precision variants, renamed bytes, fixtures, and one attractive answer are
   not meaningful portfolio diversity.

No-cheat evaluation must layer deterministic structure, scenario-specific
semantic invariants, blinded model-assisted review, and human adjudication.
An opaque LLM judge is never sole authority. Best-of-N selection is invalid
unless it is the declared product behavior.

### Gate L: Execute The Real Browser And Memory Campaigns

1. Freeze one exact 50-round manifest with 20 qualified model identities,
   private prompt hashes, browser builds, evaluator identities, viewports, and
   exactly 25 live-memory designations.
2. Every round uses an owned fresh persistent browser profile and a genuine
   two-to-six-turn conversation.
3. Every model runs in at least two independent clean browser restarts.
4. Close the browser process, prove no leaked handles, delete the owned profile
   with guarded retries, and prove deletion. Reload, storage clearing, or a
   reused context does not count.
5. Preserve raw model output. Do not repair, complete, edit, retry-select, or
   inject expected terms before scoring.
6. Assert one assistant rendering, stable completion, cancellation behavior,
   scroll stability, correct intro-card removal, and responsive/accessibility
   behavior.
7. Scan browser stores, profiles, logs, screenshots, traces, URLs, referrers,
   and captures for prompts, enrollment URLs, tokens, credentials, and model
   bytes.
8. For the 25 designated live rounds, use a second fresh profile and only the
   advertised MemoryEndpoints contract.
9. Prove atomic single-use enrollment, same-idempotency recovery,
   different-idempotency replay rejection, scoped reconnect, short-term and
   long-term continuity, no implicit raw-transcript promotion, close, delete,
   and post-delete verification.
10. Create 25 unique disposable companies and always attempt close and delete
    independently in `finally`, even after prior failure.
11. Fixtures and local MemoryEndpoints mocks remain integration evidence only.

### Gate M: Complete The External Release Campaign

1. Obtain and keep current 40 outside-network lane proofs.
2. Publish and read back 20 MiniModel catalog announcements.
3. Verify direct import from outside the serving network.
4. Verify packages and isolated consumers.
5. Execute `win-x64`, `linux-x64`, and physical `linux-arm64` release evidence.
6. Generate and bind SBOM, provenance, SourceLink, portable PDB, `.snupkg`,
   package allowlists, native hashes, archive scans, malware-scan boundaries,
   signing, publication authorization, retention, rollback, and secret scans.
7. Build one final current campaign projection from immutable receipts.
8. Authorize and publish only when the complete predicate is true.
9. Verify every affected public site and generated release document by HTTPS
   byte readback.
10. Produce final attestation and explicit remaining risks.

## 7. Required Testing And Fault Discipline

For every new boundary, use test-driven development:

1. Preserve the triggering failure or missing invariant.
2. Add one minimal generic failing test.
3. Add positive, negative, boundary, malformed, oversized, and counterexample
   tests.
4. Implement the smallest complete architecture that satisfies the final
   contract, not a compatibility patch.
5. Run focused tests.
6. Run the complete affected subsystem.
7. Run complete Node and Rust gates when shared contracts or evidence behavior
   changes.
8. Run browser, package, and site gates whenever their behavioral surface is
   affected.
9. Preserve append-only evidence and update documentation.

The fault matrix must cover at least:

- Truncation at every byte and persistence boundary.
- Integer overflow and allocation preflight.
- Duplicate, missing, reordered, and unknown fields.
- Invalid UTF-8 and Unicode normalization edge cases.
- Hash, signature, source, authority, time, and currentness drift.
- Process crash, power loss, disk full, locked files, and stale temporaries.
- Junction, symlink, reparse, traversal, archive bomb, and duplicate path.
- Browser crash, worker crash, WASM trap, timeout, stale message, duplicate
  response, IndexedDB failure, service-worker staleness, and profile lock.
- Network loss, peer loss, companion restart, partial pieces, range mismatch,
  and endpoint drift.
- Memory enrollment races, lost response, replay, wrong identity, revoked
  token, conflict, cleanup failure, and orphan discovery.
- Evaluator false positive, false negative, paraphrase drift, authority order,
  negation, unavailable-resource advice, and quoted malicious instructions.

No skip, mock, cross-compilation, or local simulation may be relabeled as the
corresponding live or physical test.

## 8. Source-Control And Publication Cadence

1. Commit and push every coherent major change as soon as its affected build
   and tests pass.
2. Do not hold healthy source locally while waiting for unrelated perfection.
3. Use explicit file lists when committing in a shared or dirty workspace.
4. Never reset, clean, revert, or overwrite another user's changes.
5. Fetch and verify upstream equality after each push.
6. Create a private remote immediately for any applicable source-only local
   repository that lacks one.
7. Deploy every affected site whenever its complete affected release gate
   passes.
8. Do not deploy internal-only changes that alter zero bound site bytes merely
   to create activity.
9. Every site publication must include an intentional version, release date,
   last-published timestamp, update-log entry, exact source and closure
   identity, test/scan evidence, authorized transport, HTTPS readback, and an
   immutable receipt.
10. Preserve failed and obsolete receipts; never overwrite them or convert
    them into passes.
11. Update product, catalog, developer documentation, marketing, package,
    support, redirects, and machine-readable release surfaces together when
    their claims are affected.

## 9. Privacy, Redaction, And Secret Contract

Public-safe evidence may contain only bounded public IDs, hashes, sizes,
versions, counts, statuses, timestamps, routes intended for publication, and
bounded error classes.

Never put the following in Git, public evidence, reports, prompts, screenshots,
URLs, update logs, or published `.uai` exports:

- Passwords, tokens, API keys, signing keys, invitation URLs, enrollment
  secrets, workspace keys, or coordinator credentials.
- Raw prompts, expected evaluation answers, private transcripts, or hosted
  memory payloads.
- Private model paths, model bytes, peer pieces, training examples containing
  PII, or unreviewed teacher output.
- Hidden company, tenant, or workspace identifiers.

Scan UTF-8, UTF-16, base64, URL-encoded, archive-contained, generated, and
failure-path outputs. Use synthetic secret sentinels to prove detection. Do not
print real credential values while testing configuration.

## 10. Blocker Handling And Parallel Work

Use typed blockers, not a Boolean `passed` field. A blocker record must bind
phase, operation, exact inputs, time, bounded code, safe details, retry policy,
and unaffected work that can continue.

Examples include:

- Insufficient model quality.
- Unsupported architecture.
- License ambiguity.
- Source drift.
- Evaluator defect.
- Unavailable training compute.
- Missing live MemoryEndpoints contract.
- Expired coordinator credential.
- Company cleanup failure.
- Missing outside observer.
- Unreachable or stale P2P lane.
- Catalog rejection.
- Signing authority absence.
- Physical hardware absence.
- Deployment profile mismatch.

Do not stop the whole program when one external branch is blocked. Continue
independent implementation, testing, package, documentation, model screening,
and local campaign preparation. Do not simulate the blocked evidence.

## 11. Operator Reporting

After every major checkpoint, report:

1. What changed and why.
2. Exact files and commits.
3. Exact tests, pass/fail/skip counts, and durations where available.
4. Evidence paths and SHA-256 identities.
5. Site versions, release dates, last-published times, and receipt status.
6. Current campaign counters out of 20, 50, 25, 40, and 20.
7. Current operation and resumable state.
8. New or cleared blockers.
9. Assumptions confirmed or disproved.
10. Remaining risks.
11. Next highest-value executable action.

The operator view must never display `done` from unit tests, package creation,
cross-compilation, local P2P health, or partial site upload.

## 12. Final Acceptance Checklist

Do not declare complete until current authoritative evidence proves every
applicable item:

- [ ] All seven repositories are clean, pushed, upstream-exact, and governed by
      current clean-slate UAI policy.
- [ ] Remaining frozen site releases and redirect verification are closed with
      honest receipts or exact blockers.
- [ ] One vNext release/publication path exists and the old mutable stack is
      deleted without compatibility support.
- [ ] Receipt and subject DAGs validate from restart.
- [ ] Atomic persistence, Windows durability, quarantine, redaction, secret,
      and archive-member gates pass.
- [ ] One `.slm` vNext format, parser, writer, converter, inspector, and piece
      model pass hostile and differential tests.
- [ ] No legacy format or runtime path remains.
- [ ] Native scalar runtime passes source and artifact conformance.
- [ ] WASM scalar and SIMD pass.
- [ ] Threaded WASM is proven or explicitly unpromoted.
- [ ] WebGPU promoted profiles pass physical conformance and recovery.
- [ ] Browser import, activation, persistence, deletion, cancellation, privacy,
      accessibility, and network gates pass.
- [ ] Context compiler, typed memory, grammar, calculator, and local tools pass.
- [ ] Speculative decoding is exact and promoted or explicitly absent.
- [ ] Companion protocol and direct P2P fleet pass.
- [ ] Twenty distinct useful model hashes qualify.
- [ ] Fifty deletion-backed clean browser rounds pass.
- [ ] Twenty-five authorized live memory rounds pass and clean up.
- [ ] Forty current outside-network lane proofs pass.
- [ ] Twenty live MiniModel announcements pass readback.
- [ ] `win-x64` and `linux-x64` execute.
- [ ] Physical `linux-arm64` executes.
- [ ] NuGet and symbol packages pass isolated consumption.
- [ ] SBOM, provenance, signing, SourceLink, archive, malware-boundary, and
      secret scans pass.
- [ ] Every affected site is current and its public claims are evidence-bound.
- [ ] Final attestation binds exact source, tools, contracts, models, tests,
      packages, sites, authorizations, and external proofs.
- [ ] Remaining risks are explicit.

## 13. Beginning Instruction

Begin immediately by:

1. Reading this entire assignment and both workspace handoffs.
2. Revalidating all seven repository heads and the completed documentation
   publication receipt.
3. Running the Runtime redirect verifier without using its misbound deployment
   profile.
4. Publishing the two frozen MiniModel 1.0.0 closures serially when their exact
   gates still pass, preserving and pushing every receipt.
5. Reconciling all seven origins and handoffs.
6. Returning to the active TinyRustLM worktree and completing Gate C through
   test-driven clean replacement and deletion of the old mutable release stack.
7. Committing and pushing each healthy major change immediately.
8. Continuing through the remaining gates without waiting on independent
   external blockers.

Do not stop at analysis or another plan. Implement, test, verify, publish stable
work, synchronize documentation and marketing, and preserve evidence until the
full objective is proven complete or a specific authorized external boundary
truly prevents all meaningful progress.

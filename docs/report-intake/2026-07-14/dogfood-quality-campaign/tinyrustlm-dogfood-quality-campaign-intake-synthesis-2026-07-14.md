# TinyRustLM Dogfood And Model Quality Intake Synthesis

## Purpose

This document reconciles twelve disconnected-agent reports with the actual
TinyRustLM repository, the 50-round dogfood goal, and current production
contracts. It deliberately separates useful design advice from observations
that the disconnected agents could not prove.

## Authority Order

When evidence conflicts, use this order:

1. The current human-approved goal and product boundaries.
2. Validated content-addressed receipts produced by real execution.
3. Exact local artifacts and reviewed Rust contracts.
4. Current source and tests in this repository.
5. This synthesis and its TDD plan.
6. External reports and public-site observations.

No screenshot, prose assertion, mutable summary, fixture, loopback check, or
public page can substitute for an execution receipt at a stronger evidence
class.

## Audited Starting Point

- The repository already has a 20-model/50-round/25-memory campaign manifest and runner, but its fixed round summaries are mutable indexes rather than a complete immutable receipt DAG.
- Existing runner helpers canonicalize and atomically write JSON, but do not provide a reusable strict receipt schema, content-addressed filenames, parent validation, cycle detection, startup quarantine, or a mandatory secret interceptor.
- The current qualified-model count is zero. Qwen2.5-1.5B remains the local quality anchor, not a fully promoted assistant.
- The exact locally exercised Qwen q4 artifact is 969,648,576 bytes. The reports' 128 MiB limits and guessed model sizes are not current authority.
- TinyRustLM.com and MiniModel.org have already passed narrower production/browser checks. Those checks do not count as this new 50-round campaign.
- Live MemoryEndpoints single-use enrollment, company cleanup, credential rotation, and deletion routes are not documented in a machine-readable contract available to this repository. Fixture success cannot count as one of the 25 live continuity rounds.
- No current outside-network receipt proves two public lanes for 20 models, and MiniModel.org correctly reports no active public peer rather than inventing availability.
- The approved fleet design is exactly two lane processes total. Each process serves every admitted model. The reports' 40-process interpretation is rejected.
- The local Windows host has enough CPU and memory for sequential browser work, but the installed NVIDIA K80 devices currently report `GPU is lost`. GPU training cannot be scheduled as available until a fresh capability receipt proves it.
- The E drive is space constrained for a campaign with large models. Campaign staging must use an explicitly configured owned root with a preflight disk budget, such as the available Z drive, and must never silently spill into source directories.

## Corrected Findings By Lane

### Campaign Control Plane

Accepted:

- Use a versioned, strict, content-addressed receipt DAG as the source of truth.
- Preserve every attempt, including failures, blockers, retries, cleanup evidence, and supersession links.
- Rebuild status from validated receipts after restart. Never persist a mutable `complete` Boolean as authority.
- Use same-directory temporary files, flush and sync, atomic promotion, reopen and revalidate, then update derived indexes.
- Quarantine malformed, truncated, hash-mismatched, unknown-schema, and parent-invalid receipts.
- Derive the dashboard from validated receipts and distinguish missing, blocked, failed, rejected, stale, and passed.

Corrected or rejected:

- A SHA-256 digest proves content identity, not truth. Evidence class and validator version remain mandatory.
- SLSA, Sigstore, package signing, external proof, or deployment cannot be marked complete unless the corresponding service issued real evidence.
- Existing mutable reports may remain convenience indexes, but they cannot be the restart authority.

### Browser Dogfood

Accepted:

- Each of 50 rounds uses a unique physical browser profile directory under one owned campaign root.
- A round closes the complete persistent browser context, verifies process exit, scans allowed evidence, deletes the profile tree, and verifies the tree is absent before passing cleanup.
- Local `.slm` import uses the real file chooser. Each conversation has 2 to 6 turns, raw assistant output, exact message ownership, and one rendering path.
- Browser inference is serialized by default to prevent memory and disk contention from invalidating measurements.
- The campaign must exercise desktop, narrow desktop, and mobile interaction without changing the locked visual language.
- TinyRustLM is fully browser-capable by default. A fresh visit must not probe or contact any local program. Optional desktop-companion traffic begins only after a named user action and a visible explanation that a browser or operating-system access prompt may appear.
- A local UAIX Memory Deck remains the offline memory-context option, and locally queued synchronization remains available for later delivery. MemoryEndpoints.com is optional but encouraged when memory should be available worldwide, across browsers, and across devices.

Corrected or rejected:

- The disconnected observation report did not prove its claimed screenshots, model list, browser versions, API traffic, response quality, or duplicate-free behavior.
- A guessed 128 MiB ceiling, invented load time, and invented 2-hour campaign budget are rejected.
- Service Worker blocking is a test mode, not proof that the product correctly handles real service-worker state.
- Scanning screenshots for secrets requires OCR or a separate visual detector; searching compressed image bytes is not equivalent.
- An unexpected loopback, custom-protocol, extension, native-messaging, or installed-app probe is a release-blocking trust failure.

### MemoryEndpoints Continuity

Accepted:

- The 25 designated rounds require a unique company and agent identity, a first browser conversation, remote short- and long-term memory receipts, physical deletion of that browser profile, and successful continuity in a second fresh profile.
- Enrollment links are single use. Exact retry semantics require a stable idempotency key and body; replay with a changed key or body must fail.
- Credentials remain volatile and are never placed in URLs, screenshots, HAR files, profile archives, logs, receipts, or source.
- Cleanup belongs in `finally`: revoke agent credentials, close/delete the test company through an official route, prove absence, and preserve cleanup failure separately.
- Hosted memory requires internet for new reads, writes, and synchronization. A queued local sync operation is not represented as a readable offline copy of hosted long-term memory.
- Local copied memory and local queued synchronization remain usable choices without MemoryEndpoints enrollment; hosted continuity must not become a prerequisite for local chat or local memory.

Blocked contract:

- No undocumented endpoint may be guessed from prose, browser behavior, or report examples.
- Until MemoryEndpoints publishes or provides an exact schema for company creation, one-time enrollment redemption, credential rotation/revocation, company closure/deletion, and absence verification, live rounds are `blocked_contract_missing`.
- Fixture-only tests remain useful but are labeled fixture and never counted toward 25 live rounds.

### Evaluation And Claims

Accepted:

- Separate structural validity, deterministic semantic checks, model-graded signals, and human review. Human decisions remain authoritative for conversational quality.
- Use fixed seeds, fixed generation settings, raw outputs, metamorphic/paraphrase families, no best-of-N cherry-picking, and explicit evaluator versions.
- Evaluate ordinary conversation, current-turn precedence, trusted versus untrusted memory, ambiguity, planning, source conflict, summarization, rewriting, structured output, and code.
- Math is secondary and may use a calculator tool. Conversational logic and common sense carry more product weight.
- Preserve all failures and regressions. A model cannot be promoted because it is popular, small, structurally valid, or good on one prompt.

Corrected or rejected:

- The project follows the Cognitive Liberty Charter; generic corporate safety taxonomies in reports do not override that policy.
- Wilson intervals, judge ensembles, hidden sets, or multiple-comparison corrections are useful only when sample design warrants them. They are not ceremonial gates.
- Model judges cannot promote a model without deterministic evidence and designated human review.

### P2P And Catalog

Accepted:

- Model bytes move directly between consenting peers. Project websites carry catalog metadata, not model bytes or a fallback proxy.
- Two total independent lane processes share one read-only artifact/piece store and keep separate endpoint, process, proof, and restart identities.
- Strict exact-name HTTP routes, bounded clients, narrow metadata CORS/OPTIONS, no write methods, no traversal, no directory listing, and no automatic router/firewall changes.
- Local health is distinct from outside-network proof. Announcements fail closed on expiry, identity drift, revocation, restart revalidation failure, or missing proof.
- Import remains resumable and content verified through Rust before final exposure.

Corrected or rejected:

- Forty server processes are not the approved design.
- A random challenge piece is not enough for this campaign's complete-transfer proof. Each lane proof must bind and verify a complete artifact transfer or a protocol-defined complete set of all verified pieces.
- Broad denial of OPTIONS conflicts with browser CORS; only approved metadata preflight is allowed.
- DHT, relay, automatic UPnP/PCP, and project-hosted bytes are deferred or rejected for the current direct-peer slice.

### Model Distillation

Accepted:

- Screen source behavior before paying conversion or training cost.
- Build a curriculum around conversation, ambiguity, planning, current-turn precedence, memory trust, source conflict, summarization, rewriting, structured output, and code.
- Use scenario-factor variation, counterfactuals, paraphrases, hard negatives, and sealed holdouts to teach generalization rather than answer memorization.
- Track exact upstream revision, license material, tokenizer/config, data lineage, teacher identity, generation settings, contamination filters, training configuration, checkpoints, conversion, and quantization evidence.
- Distinct quantizations, random seeds, prompts, or aliases do not create distinct catalog models. Distinctness requires independently meaningful lineage, weights, or trained behavior plus evidence.
- Use CPU pilots for pipeline correctness before scheduling expensive training. Measure actual throughput before estimating a scale-up.

Corrected or rejected:

- Candidate architecture, license, context, browser compatibility, and parameter claims require primary-source pinning and local runtime tests.
- Guessed CPU/GPU throughput, latency, RAM, record-count ceilings, and hard promotion percentages are not evidence.
- Qwen2.5-0.5B is already source-rejected by local evidence. Qwen2.5-1.5B remains an unqualified anchor; report popularity cannot promote it.
- Counting q4 and q8 of one checkpoint as two of the 20 models is catalog theater and is rejected.
- Closed-model teacher output, hidden-reasoning collection, and dataset licensing need explicit legal and provenance review before use.

## Implementation Order

1. Build and test the reusable receipt schema, canonicalization, content addressing, redaction, atomic persistence, quarantine, parent validation, and state reconstruction.
2. Integrate immutable attempt receipts into the existing campaign runner while retaining generated round summaries only as derived indexes.
3. Add capability probes and blockers for disk, browser engines, GPU, platform hosts, MemoryEndpoints contract, outside observer, public catalog write authority, and production publishing credentials.
4. Resume model qualification. Do not schedule 50 browser rounds until at least one model has a complete source-to-quality chain.
5. Execute browser rounds sequentially with physical profile deletion and preserve every failed attempt.
6. Execute the 25 live MemoryEndpoints rounds only after exact official routes and cleanup semantics are available.
7. Run two total P2P lane processes, obtain complete outside transfer receipts for each admitted model and lane, then announce only validated models.
8. Finish Windows x64, Linux x64, physical Linux ARM64, NuGet/symbol, HTTPS readback, and final secret-scan gates.

## Honest Current Status

The campaign is not complete. The intake is preserved and converted into a
testable plan. The first implementation slice is the evidence/control-plane
foundation because every later pass depends on trustworthy restart and failure
semantics.

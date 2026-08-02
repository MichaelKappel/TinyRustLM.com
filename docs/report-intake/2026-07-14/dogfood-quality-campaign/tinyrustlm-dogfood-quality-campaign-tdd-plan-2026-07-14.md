# TinyRustLM Dogfood And Model Quality Campaign TDD Plan

## Goal

Produce trustworthy, restart-safe evidence for 20 genuinely useful models, 50
clean browser dogfood rounds, 25 live MemoryEndpoints continuity rounds, two
direct P2P lanes per model identity served by exactly two total lane processes,
public catalog announcements, cross-platform packages, and deployed HTTPS
readback without weakening tests or inventing success.

Every production change begins with a failing test. A failure remains in the
receipt graph after a retry. A later pass supersedes the failed attempt; it does
not erase it.

## F0: Intake And Authority Lock

Tests first:

- `F0-001 report-count`: exactly 12 reports and one separately classified prompt provenance file.
- `F0-002 byte-preservation`: every durable file matches source byte count and SHA-256.
- `F0-003 paired-lanes`: exactly two reports in each of six research lanes.
- `F0-004 disposition-completeness`: every report has one ledger outcome and proof of use.
- `F0-005 route-completeness`: manifest, synthesis, TDD, wiki memory, and hot-memory routes resolve.
- `F0-006 authority-order`: prose cannot override human goal, Rust contracts, or real receipts.
- `F0-007 false-observation-denial`: invented screenshots, routes, models, timings, deployment, and live proof are explicitly rejected.
- `F0-008 browser-memory-choice`: browser-only chat, local copied memory, and local queued synchronization remain supported while MemoryEndpoints is optional and encouraged only for worldwide continuity.

Exit gate: active intake copies may be removed only after all preservation and
memory-route checks pass.

## F1: Canonical Receipt Contract

Tests first:

- `F1-001 canonical-order`: object key order, whitespace, and input insertion order cannot change canonical bytes.
- `F1-002 canonical-types`: only null, booleans, finite JSON numbers, strings, arrays, and plain string-keyed objects are accepted.
- `F1-003 invalid-values`: undefined, functions, symbols, bigint, NaN, infinity, cyclic objects, sparse ambiguity, custom prototypes, and invalid Unicode fail deterministically.
- `F1-004 strict-schema`: missing, extra, misspelled, duplicate, wrong-type, oversized, and unsupported-version fields fail.
- `F1-005 content-id`: receipt ID and filename equal lowercase SHA-256 of the canonical hash envelope.
- `F1-006 identity-recompute`: loading a receipt recomputes and verifies its content identity.
- `F1-007 evidence-class`: fixture, local, browser, live-service, outside-network, target-platform, package, and deployment classes are explicit and non-interchangeable.
- `F1-008 immutable-attempts`: retries produce new receipt identities and preserve prior failures.
- `F1-009 bounded-diagnostics`: receipt diagnostics are public-safe, size bounded, and cannot embed arbitrary logs or archives.

Exit gate: golden vectors pass in Node and any later Rust implementation with
identical canonical bytes and hashes.

## F2: Mandatory Redaction Interceptor

Tests first:

- `F2-001 known-secret`: every configured known secret is detected in plain, URL-encoded, JSON-escaped, base64, header, and archive-entry contexts.
- `F2-002 field-denial`: credential, authorization, cookie, password, token, secret, private-key, and equivalent structured fields fail or redact before serialization.
- `F2-003 url-safety`: URI user-info, credential query parameters, fragments, and unapproved full URLs cannot enter receipts.
- `F2-004 path-safety`: private absolute paths and user profile names are normalized or redacted while approved repository-relative evidence paths remain useful.
- `F2-005 key-patterns`: bearer tokens, API-key forms, PEM blocks, connection strings, and high-entropy credential-like values are detected.
- `F2-006 hash-allowance`: approved SHA-256, content IDs, public model hashes, and nonsecret random IDs do not become destructive false positives.
- `F2-007 recursive-boundary`: nested objects, arrays, errors, console lines, request headers/bodies, HAR data, screenshots metadata, and package manifests pass through the same interceptor.
- `F2-008 fail-closed`: inability to scan an evidence class blocks publication instead of silently accepting it.

Exit gate: no receipt, derived index, log, screenshot metadata, archive, or
dashboard payload bypasses the interceptor.

## F3: Atomic Content-Addressed Store

Tests first:

- `F3-001 same-directory-temp`: temporary and final files share a filesystem and owned receipt directory.
- `F3-002 durable-order`: write, flush, file sync, atomic rename, directory sync where supported, reopen, parse, schema validate, and hash verify occur in order.
- `F3-003 existing-idempotent`: writing identical content to an existing hash verifies and succeeds without replacement.
- `F3-004 collision-denial`: different bytes cannot occupy an existing content identity.
- `F3-005 crash-grid`: termination after every persistence step leaves either no receipt, a valid final receipt, or a quarantinable temporary file, never a false pass.
- `F3-006 startup-scan`: malformed, truncated, wrong-name, wrong-hash, unsupported-version, and oversized files are quarantined with a public-safe reason.
- `F3-007 quarantine-isolation`: bad receipts cannot invalidate or mutate valid receipts.
- `F3-008 root-containment`: traversal, symlink, junction, reparse-point, case collision, reserved name, ADS, and root escape fail.
- `F3-009 immutable-indexes`: derived latest/status indexes can be regenerated and are never receipt authority.
- `F3-010 bounded-store`: scan depth, file count, file size, and quarantine growth have explicit limits.

Exit gate: fault injection on Windows and Linux reconstructs the same valid
receipt set after restart.

## F4: Parent DAG And Campaign State

Tests first:

- `F4-001 parent-exists`: every declared parent resolves to a valid receipt unless the schema explicitly permits a root.
- `F4-002 parent-purpose`: receipt types accept only allowed parent types and campaign/model identities.
- `F4-003 cycle-detection`: cycles, self-parenting, and duplicate parent edges fail.
- `F4-004 supersession`: a retry references the attempt it supersedes without deleting it.
- `F4-005 deterministic-rebuild`: receipt enumeration order cannot change derived state.
- `F4-006 phase-order`: source, conversion, runtime, evaluation, browser, memory, P2P, catalog, package, deployment, and acceptance transitions enforce prerequisites.
- `F4-007 blockers`: missing capability, missing contract, unavailable external service, rejected model, and failed execution remain distinct.
- `F4-008 minimal-invalidation`: a changed artifact invalidates only dependent receipts; unrelated models and phases retain valid evidence.
- `F4-009 no-boolean-authority`: deleting all indexes and mutable summaries still reconstructs identical status from receipts.
- `F4-010 dashboard-truth`: displayed totals link to receipt identities and cannot count fixture/local evidence as live/external proof.

Exit gate: a synthetic multi-model campaign with failures, retries, blockers,
and supersessions rebuilds identically after process restart.

## F5: Model Qualification And Distillation

Tests first:

- `F5-001 source-identity`: immutable source revision, exact files, tokenizer/config, license material, and source hashes are complete.
- `F5-002 source-screen-first`: a behaviorally rejected source cannot proceed to conversion or training.
- `F5-003 conversion-binding`: private conversion may remain out of public packages, but its receipt binds exact inputs, tool revision, configuration, output, and no-cheat evidence.
- `F5-004 runtime-structure`: Rust validates format, tensor layout, tokenizer, finite configuration, quantization support, and runtime capabilities.
- `F5-005 raw-output`: evaluator stores exact raw generations and generation settings before any parser or judge touches them.
- `F5-006 practical-suite`: conversation, common sense, ambiguity, planning, current-turn precedence, memory trust, source conflict, summarization, rewriting, structured output, and code all have deterministic cases.
- `F5-007 calculator-boundary`: arithmetic may call a calculator; math does not dominate promotion scoring.
- `F5-008 metamorphic-families`: paraphrases and scenario-factor changes test generalized behavior rather than memorized strings.
- `F5-009 no-best-of-n`: promotion cannot select a lucky seed or silently discard failures.
- `F5-010 human-authority`: designated human review can reject; automated judges cannot independently promote.
- `F5-011 contamination`: exact, n-gram, semantic, template-family, entity-substitution, and sealed-holdout checks produce lineage receipts.
- `F5-012 meaningful-distinctness`: aliases, quantizations, random seeds, prompts, and byte-only changes do not count as distinct models without independent behavior/lineage justification.
- `F5-013 claim-boundary`: smoke, structural, conversation-proven, task-proven, and full-assistant claims require progressively stronger evidence.
- `F5-014 twenty-model-gate`: exactly 20 models have unique content IDs and each independently passes every required qualification phase.

Exit gate: 20 cannot be reported until 20 complete model DAGs exist. The
current honest count remains zero until receipts prove otherwise.

## F6: Fifty Clean Browser Rounds

Tests first:

- `F6-001 exact-schedule`: exactly 50 rounds, all 20 qualified models used, and exactly 25 memory-designated rounds.
- `F6-002 unique-profile`: each attempt creates a new physical `userDataDir` under the owned campaign root.
- `F6-003 real-file-chooser`: local model import uses the visible application flow and Playwright file chooser.
- `F6-004 identity-after-load`: UI/runtime identity, byte count, SHA-256, and qualification receipt agree before chat.
- `F6-005 conversation-depth`: every passing round has 2 to 6 real user/assistant turns with exact raw output.
- `F6-006 single-render-owner`: one generated event yields exactly one assistant message before and after finalization.
- `F6-007 active-layout`: first send removes starter cards, conversation history owns the center column, and composer remains contained.
- `F6-008 responsive-accessibility`: desktop, narrow, mobile, keyboard, reduced-motion, long names, long output, and scroll preservation pass.
- `F6-009 network-policy`: prompts, responses, credentials, and model bytes never reach an unapproved public endpoint.
- `F6-010 browser-only-no-probe`: a fresh visit, ordinary browser-local chat, model search, and optional web memory make no loopback, custom-protocol, native-messaging, extension, or installed-app request.
- `F6-011 explicit-desktop-opt-in`: before the first local-app request, the UI names the optional desktop capability, explains the data boundary and expected browser/OS prompt, then requires an affirmative user action.
- `F6-012 denial-stays-denied`: cancel, deny, disconnect, and browser-only choices produce no background retries and preserve a complete browser-only path.
- `F6-013 close-and-delete`: complete browser shutdown precedes bounded profile deletion; absence is verified from the filesystem.
- `F6-014 cleanup-failure`: locked or undeletable profile fails the attempt and remains visible; a retry uses a new profile.
- `F6-015 full-clear-restart`: no localStorage, IndexedDB, Cache Storage, OPFS, cookie, service-worker, broadcast, or profile state can carry a round without an explicit remote-memory receipt.
- `F6-016 failure-preservation`: crash, timeout, WASM trap, corrupt model, storage pressure, and duplicate event preserve partial evidence and never count as pass.
- `F6-017 contextual-offline-copy`: readiness copy follows the current state: a loaded model can continue in the current open tab, a local UAIX Memory Deck supplies offline context, and hosted memory is never described as available without internet.

Exit gate: 50 passing round receipts plus all failed-attempt receipts, with 50
verified physical cleanup receipts.

## F7: Twenty-Five Live MemoryEndpoints Continuity Rounds

Tests first after contract discovery:

- `F7-001 official-contract`: exact versioned routes, methods, auth placement, schemas, errors, idempotency, and cleanup semantics are available from an authoritative source.
- `F7-002 unique-company`: each designated round creates a new company and records only public identifiers.
- `F7-003 one-time-enrollment`: first redemption succeeds; exact retry with the same idempotency key/body is deterministic; changed-key or changed-body replay fails.
- `F7-004 agreed-name-token`: redemption returns the agreed agent identity and a secret token only through the approved confidential channel.
- `F7-005 short-and-long-write`: both memory classes receive content-bound write receipts.
- `F7-006 first-profile-destroyed`: the originating browser is closed and physically deleted before continuity retrieval.
- `F7-007 second-profile-recovery`: a separate fresh profile authenticates with agent name/token and retrieves both memory classes.
- `F7-008 semantic-continuity`: the resumed agent answers exact and paraphrased recall questions without local browser residue.
- `F7-009 credential-rotation`: rotation invalidates the old token and preserves authorized memory access through the new token.
- `F7-010 agent-revocation`: revoked credentials fail and cannot mutate memory.
- `F7-011 company-cleanup`: official close/delete succeeds in `finally` and an official absence query proves cleanup.
- `F7-012 cleanup-failure-visible`: failed deletion is a separate terminal cleanup blocker and is reported to MemoryEndpoints coordination with public-safe evidence.
- `F7-013 fixture-isolation`: mock or fixture results are labeled fixture and never increment the live total.
- `F7-014 local-choice-preserved`: enabling, disconnecting, or declining MemoryEndpoints never removes the local Memory Deck or queued-sync choices and never blocks browser-local chat.

Exit gate: 25 unique live companies complete creation, one-time enrollment,
two-profile continuity, rotation/revocation where required, and verified cleanup.
Until the official contract exists, this phase is blocked, not skipped.

## F8: Two-Lane P2P And Catalog

Tests first:

- `F8-001 exactly-two-processes`: the fleet has exactly two total lane processes, not two per model.
- `F8-002 complete-model-set`: both lanes expose exactly one endpoint for all 20 admitted model identities.
- `F8-003 shared-read-only-store`: lanes share content bytes without per-lane copies and cannot mutate artifacts.
- `F8-004 atomic-prebind`: one collision prevents that lane from serving any configured endpoint.
- `F8-005 sibling-independence`: crash/restart of one lane leaves the sibling process alive.
- `F8-006 strict-http`: only exact approved metadata and fixed piece routes pass; traversal, writes, ambiguous framing, query strings, and directory listing fail.
- `F8-007 local-not-public`: loopback, LAN, hairpin, and same-host tests never produce public eligibility.
- `F8-008 complete-external-transfer`: an outside observer obtains and validates the complete artifact or complete piece set from each lane, bound to model and manifest identity.
- `F8-009 signed-expiring-proof`: observer signature, key, URL, lane, model, content IDs, timestamps, expiry, and nonce verify.
- `F8-010 forty-proof-gate`: exactly 20 models times two lanes have current valid outside receipts.
- `F8-011 announcement-binding`: each catalog announcement references qualification and both current lane proofs.
- `F8-012 no-byte-proxy`: TinyRustLM.com, MiniModel.org, UAIX.org, and MemoryEndpoints.com carry no model bytes.
- `F8-013 stale-and-revoked`: proof expiry, URL drift, model removal, restart failure, or revocation removes active availability without deleting lawful local bytes.

Exit gate: 40 complete-transfer proofs and 20 catalog announcements survive
independent HTTPS readback. Fixture and local receipts count as zero here.

## F9: Platform, Package, Deployment, And Final Acceptance

Tests first:

- `F9-001 windows-x64`: real native runtime, browser, two-lane, package, and cleanup execution on Windows x64.
- `F9-002 linux-x64`: equivalent real execution on Linux x64.
- `F9-003 physical-linux-arm64`: execution on physical Linux ARM64; cross-compilation or emulation alone is insufficient.
- `F9-004 nuget-pairs`: every `.nupkg` has matching `.snupkg`, metadata, SourceLink, approved native assets, and clean-consumer restore evidence.
- `F9-005 package-boundary`: public packages contain no private conversion, quantization authoring, training, ranking, optimizer, key-management, telemetry backend, or commercial internals.
- `F9-006 feed-preservation`: publication archives older owned packages transactionally and never deletes unrelated packages.
- `F9-007 deployed-hash-readback`: every deployed public asset is fetched over HTTPS and matches the release manifest.
- `F9-008 catalog-readback`: active model rows, peer counts, proof age, source, license, quality, and limitations match validated announcements.
- `F9-009 secret-scan`: source, receipts, indexes, logs, traces, HARs, screenshots metadata, packages, archives, and deployed assets pass the mandatory interceptor and independent scan.
- `F9-010 final-attestation`: final summary is generated only from validated DAG state and enumerates every failure, blocker, supersession, and residual risk.

## Required First Slice

Implement in this order:

1. `F1` canonical receipt tests.
2. `F2` redaction tests.
3. `F3` atomic store and quarantine tests.
4. `F4` DAG/state reconstruction tests.
5. Integrate the store into the existing dogfood campaign runner.

Higher campaign phases must not start by manufacturing receipt-shaped data.
They start only when their prerequisites and capabilities are real.

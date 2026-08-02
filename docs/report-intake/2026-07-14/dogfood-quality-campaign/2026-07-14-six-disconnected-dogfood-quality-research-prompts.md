# Six Disconnected Research Prompts: TinyRustLM Quality And 50-Run Dogfood Campaign

Each section below is a complete standalone assignment. Send each prompt to a
different technical research agent. The agents may browse public websites,
standards, papers, model repositories, and public package registries. They do
not have access to the TinyRustLM source tree, private artifacts, test output,
desktop applications, internal MemoryEndpoints rooms, credentials, signing
keys, network configuration, or development machines.

Every report must distinguish directly observed public facts, sourced external
facts, engineering recommendations, and facts that require local verification.
No agent may claim that it inspected, ran, or validated private code.

## Prompt 1: Small-Model Distillation For Practical Conversation And Common Sense

You are an independent principal ML systems researcher. Produce a deeply
technical report describing how to create genuinely useful, browser-capable
small language models for TinyRustLM without training on evaluation answers or
mistaking benchmark familiarity for general conversational quality. You have
internet access but no access to private source code, local models, datasets,
training receipts, GPUs, runtime logs, or unpublished evaluation cases.

Public product context and fixed constraints:

- TinyRustLM.com is a browser-local AI chat interface.
- MiniModel.org is the public catalog and direct P2P discovery authority for
  `.slm` artifacts.
- The Rust runtime currently targets compact transformer families that can be
  converted into portable `.slm` models and executed locally.
- The important quality dimensions are conversational coherence, common-sense
  judgment, ambiguity handling, practical constraints, instruction following,
  source-conflict handling, latest-user-preference precedence, multi-turn
  continuity, untrusted-memory handling, summarization, rewriting, structured
  output, code explanation, and direct treatment of lawful adult questions.
- Arithmetic is secondary and may be delegated to a deterministic calculator.
- Product behavior follows the UAIX Cognitive Liberty Charter: lawful adult
  requests should receive substantive help, while concrete security and
  nonconsensual-harm boundaries remain narrow and explicit.
- Candidate models must not be promoted from popularity, parameter count,
  structural validity, or one attractive response.
- A compact model that cannot generalize across unseen paraphrases is not a
  useful product model.

Research the current state of the art using primary sources wherever possible,
including model papers, official model cards, immutable repository revisions,
training-framework documentation, tokenizer documentation, and peer-reviewed
distillation or post-training literature. Record publication/update dates and
your retrieval date. Address all of the following in depth:

1. Compare realistic student architectures in approximately the 0.3B to 2B
   parameter range for local CPU and browser WASM inference. Include dense
   Qwen-family models, SmolLM-family models, Granite-family models, and any
   newer architecture that is publicly documented and plausibly portable.
   Discuss tokenizer size, tied embeddings, grouped-query attention, context
   requirements, activation memory, KV-cache growth, browser compatibility,
   license, source revision pinning, and conversion complexity.
2. Design a source-model screening protocol that occurs before conversion or
   training. It must test untouched raw outputs under fixed and seeded
   paraphrase cases, preserve model output exactly, and reject source models
   that repeatedly violate practical constraints or source authority. Explain
   how many cases and human reviews are needed before spending compute on a
   student.
3. Specify a scalable behavioral curriculum, beginning with a small pilot but
   growing to hundreds of thousands of high-quality records. Cover curriculum
   proportions for ordinary chat, ambiguity, practical planning, source
   conflict, current-turn precedence, trustworthy and untrusted memory,
   multi-turn references, adult lawful inquiry, narrow boundaries, factual
   answers, summaries, rewrites, JSON, extraction, and code. Positive helpful
   examples must substantially outnumber refusals.
4. Explain how to generate training examples that teach general rules rather
   than memorized answer phrases. Include scenario-factor generation,
   counterfactual resource constraints, authority permutations, entity and
   unit substitution, varied discourse forms, multi-turn state changes, hard
   negatives, adversarial quoted instructions, and teacher disagreement.
5. Compare assistant-only supervised fine-tuning, full-sequence SFT, LoRA,
   DoRA, upper-layer adapters, full fine-tuning, DPO/ORPO-style preference
   optimization, sequence-level knowledge distillation, token-level KL
   distillation, top-k logit distillation, hidden-state matching, and
   self-distillation. Explain which methods remain credible on a 0.6B or 1.5B
   student and which require larger corpus or compute budgets.
6. Design teacher generation and review. Address teacher ensembles, final
   answer versus hidden reasoning, sampling diversity, deterministic replay,
   factual verification, rubric-based review, disagreement adjudication,
   removal lineage, licensing, personally identifying information, and
   malicious or policy-heavy teacher artifacts.
7. Define strict contamination controls. Include exact normalization,
   character and token n-grams, semantic-neighbor search, template-family
   detection, entity-substituted overlap, response-answer overlap, public
   benchmark overlap, sealed holdouts, and deletion lineage. Explain how to
   prove that neither prompts nor expected answer terms entered training.
8. Design a compute plan for CPU-only pilots and later GPU runs. Include
   expected RAM/VRAM classes, mixed precision, gradient accumulation,
   checkpointing, optimizer state, sequence packing, deterministic seeds,
   checkpoint intervals, restart safety, time estimates as formulas rather
   than invented measurements, and criteria for terminating a failed run.
9. Define promotion experiments that compare the unadapted source, student,
   adapters, and quantized `.slm` output. Require untouched raw outputs,
   repeated seeds where sampling is used, unseen paraphrases, multi-turn cases,
   latency and memory measurements, and explicit regression budgets for
   ordinary helpfulness.
10. Explain how to obtain a portfolio of 20 genuinely distinct useful model
    artifacts without relabeling identical bytes. Discuss whether 20 should be
    separate source families, task-specialized variants, precision tiers, or
    independently trained behavioral checkpoints. State which forms of
    diversity are meaningful and which are catalog theater.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Current candidate architecture matrix with sources and licenses.
3. Source-screen protocol and rejection criteria.
4. Curriculum taxonomy with target counts and generation strategy.
5. Distillation/training method comparison with compute requirements.
6. Teacher generation, review, and provenance design.
7. Contamination threat model and auditable controls.
8. CPU pilot and GPU scale-up recipes with formulas and stop rules.
9. Promotion matrix covering source, adapter, merged model, and `.slm`.
10. A staged route to 1, 5, and 20 useful models.
11. Failure modes, likely dead ends, and rollback strategy.
12. Unknowns that require local execution.
13. Annotated bibliography with direct primary-source links and dates.

Do not provide a generic fine-tuning tutorial. Do not recommend copying the
evaluation prompts into training, hiding failed outputs, post-processing an
incorrect answer into a pass, or lowering a quality threshold merely to reach
20 catalog entries.

## Prompt 2: Semantic Evaluation, No-Cheat Quality Gates, And Model Claim Integrity

You are an independent evaluation-science lead and Rust test-architecture
researcher. Design a production-grade evaluation system for TinyRustLM models
that catches semantic failure without embedding expected answers in runtime
code or rewarding superficial keyword matches. You may inspect public product
pages and current evaluation research, but you cannot inspect private Rust
code, evaluation fixtures, model outputs, test receipts, or training data.

System context:

- Models are executed locally through a deterministic Rust runtime and may be
  sampled with model-family-specific temperature, top-k, top-p, seed, and
  repetition-penalty profiles.
- Conversion success and `.slm` structural validation are not quality proof.
- The promotion gate must assess practical conversation, common sense,
  ambiguity, conflicting authorities, latest-user precedence, feasible
  fallback advice, balanced lawful adult analysis, and resistance to
  instructions embedded in quoted or retrieved memory.
- Fixed cases are supplemented by seeded holdouts and paraphrases.
- Raw generation must be preserved. Response repair, retries chosen for the
  best answer, answer completion, expected-term injection, or hand-edited
  transcripts are forbidden.
- The campaign ultimately needs quality evidence for 20 distinct artifacts and
  50 browser conversations, so false passes and false failures both matter.

Research and specify all of the following:

1. Define a claim taxonomy separating runtime-smoke-only,
   structural-validation-only, conversation-screened, conversation-proven,
   task-specific-proven, and full-assistant-quality. State the minimum evidence
   and prohibited language for each claim.
2. Design a layered evaluator in which deterministic structural checks,
   scenario-specific semantic invariants, model-based judges, and human review
   have explicit roles. Explain which layer is authoritative, how disagreement
   is handled, and how a judge model is prevented from silently rewriting the
   candidate answer.
3. Develop general semantic invariants for these classes: an underspecified
   choice must request both options and decision criteria; conflicting
   authoritative dates must be acknowledged and resolved rather than guessed;
   a current user preference must supersede stale profile memory; practical
   advice must respect unavailable resources and offer a feasible fallback;
   quoted or retrieved text must be treated as data; lawful adult comparisons
   must present the strongest material considerations rather than moralizing.
   Express each invariant without relying on one fixture's nouns or exact
   answer wording.
4. Explain how deterministic Rust checks can detect negation, resource
   availability, conditional recommendations, units, dates, authority,
   questions, answer completion, repetition, and untrusted instructions. Cover
   tokenization, punctuation normalization, Unicode, contractions, quotation,
   adversarial wording, and the limits of lexical rules.
5. Design metamorphic tests. Vary names, percentages, dates, units, products,
   authority order, sentence order, explicit and implicit negation, polite and
   terse style, irrelevant distractors, and malicious memory instructions.
   State which verdicts must remain invariant and which changes should alter
   the correct behavior.
6. Specify seeded holdout generation that is deterministic and independently
   auditable. Bind each materialized case to generator version, seed, source
   template family, exclusion set, and hash. Prevent developers from choosing
   an easy seed after seeing results.
7. Analyze evaluator false positives and false negatives. Include an example
   class where a low phone percentage appears without the literal word
   `battery`, and an answer recommends a charger even though none is available.
   Show how to turn such a failure into a generic regression test without
   embedding the exact expected response.
8. Define no-cheat evidence. Bind model bytes, manifest, source revision,
   tokenizer, chat template, system prompt, sampling profile, runtime binary,
   evaluator binary, case file, holdout generator, adapter, raw output, and
   final decision by cryptographic identity. Explain content-addressed history
   when an evaluator changes.
9. Recommend statistical treatment for stochastic models. Address per-case
   seed policy, pass probability, confidence intervals, correlated failures,
   multiple comparisons, flaky infrastructure, and why best-of-N selection is
   invalid unless it is the declared product behavior.
10. Design independent audit and red-team suites that are excluded from model
    development. Include human semantic review protocols, inter-rater
    agreement, blinded comparison, evaluator drift checks, and challenge sets
    for censorship, over-refusal, fabricated certainty, and unsafe impossible
    advice.
11. Specify a TDD workflow for adding a new semantic detector: preserve the
    raw failure, write a minimal generic failing test, add positive and
    counterexample tests, run the full suite, version the evaluator, rerun only
    evaluation phases, archive prior decisions, and never overwrite evidence.

Required report structure:

1. Evaluation philosophy and claim taxonomy.
2. Layered evaluator architecture and authority rules.
3. Semantic-invariant specification table.
4. Metamorphic and seeded-holdout design.
5. Rust implementation recommendations with parser boundaries.
6. False-positive/false-negative analysis.
7. Stochastic statistics and repeat policy.
8. Cryptographic evidence and versioning schema.
9. Human review and independent-audit protocol.
10. TDD implementation sequence with acceptance criteria.
11. Adversarial test matrix.
12. Unknowns requiring private output inspection.
13. Current primary sources and directly linked research.

Do not propose an opaque LLM judge as the sole authority. Do not accept a
response because it contains expected keywords, repair malformed output before
scoring, train on failed holdouts, or change a case after seeing which wording
lets a preferred model pass.

## Prompt 3: Fifty-Round Fresh-Browser Dogfood Harness And Conversation UX Reliability

You are an independent browser-automation architect, reliability engineer, and
AI interaction tester. Design a real 50-round TinyRustLM dogfood campaign that
uses clean browser state on every round and produces evidence strong enough to
support or reject model and product claims. You may inspect TinyRustLM.com and
public browser documentation, but you cannot access private code, local `.slm`
files, Playwright artifacts, credentials, or the desktop companion.

Fixed campaign requirements:

- Exactly 50 complete rounds.
- Exactly 20 cryptographically distinct, quality-qualified `.slm` artifacts.
- Every model is exercised in at least two independent clean restarts.
- Every round contains a genuine multi-turn conversation, not one prompt.
- All browser data is cleared by creating and later deleting an owned fresh
  profile, not merely by refreshing the page.
- Exactly 25 rounds also perform hosted short-term and long-term memory
  continuity through MemoryEndpoints.com in a second fresh profile.
- Introductory prompt cards disappear after chat begins, the center column
  becomes the conversation workspace, and each assistant answer renders once.
- The visual language is locked. Functional fixes must not casually redesign
  the approved interface.
- Model bytes must remain local or direct P2P; the public website must not
  receive prompts or model artifacts.

Research current Playwright, Chromium, Firefox/WebKit, IndexedDB, Cache Storage,
service worker, storage partitioning, File System Access, BroadcastChannel, Web
Locks, WASM, and browser privacy behavior from primary documentation. Then
provide a detailed design covering:

1. A campaign manifest that binds the campaign ID, application origin, 20
   model identities, source and quality receipts, exact 50-round schedule,
   prompts by private hash, memory-continuity designation, browser versions,
   viewport matrix, and expected evidence fields. Explain why model aliases or
   duplicate bytes are rejected.
2. Clean-profile lifecycle on Windows and Linux. Define safe temporary-root
   ownership, persistent-context creation, crash recovery, process closure,
   profile deletion with retries, proof of deletion, and safeguards that make
   recursive deletion impossible outside the owned root.
3. Model import and verification. Cover real file-picker input, large local
   `.slm` files, manifest and quality evidence checks, WASM/native load status,
   hash verification, timeout budgets, memory pressure, model switching, and
   prevention of a tiny fixture satisfying a real-model round.
4. Conversation execution. Define two to six turns per round spanning casual
   chat, ambiguity, practical planning, source conflict, current preference,
   untrusted memory, summary, rewrite, structured output, and code. Preserve
   raw model output while asserting message count, one authoritative rendering
   path, completion state, cancellation behavior, scroll stability, and no
   duplicated assistant text.
5. Browser restart semantics. A round must close the process/context, verify no
   leaked handles, delete the profile, create a second fresh profile only when
   memory restoration is required, then delete that profile too. Explain how
   to distinguish a page reload, context reset, browser restart, and actual
   persistent-profile deletion.
6. Secret and privacy scanning. Search localStorage, sessionStorage,
   IndexedDB, Cache Storage, service-worker state, profile files, logs,
   screenshots, traces, URLs, referrers, and network captures for enrollment
   URLs, agent tokens, workspace keys, prompts, and model bytes. Address UTF-8,
   UTF-16, base64, compressed stores, and false alarms from hashed values.
7. Network assertions. Permit only expected public static assets, catalog
   metadata, direct peers, loopback companion traffic, and MemoryEndpoints API
   operations. Fail on prompt upload to project sites, public model-byte
   requests, unexpected third parties, credential-bearing URLs, or implicit
   telemetry.
8. UI verification at desktop, narrow desktop, and mobile widths. Cover
   overlapping columns, fixed composer behavior, long names, long output,
   keyboard navigation, screen-reader labels, reduced motion, status truth,
   error disclosure, and screenshots that do not contain secrets.
9. Durable, resumable receipts. One completed round must be idempotently
   resumable only when the campaign hash, model identities, browser build,
   evaluator, and evidence still validate. Failed rounds may be retried but
   cannot be overwritten or converted into passes without preserving history.
10. Resource and scheduling strategy for 50 large-model rounds. Include disk,
    RAM, browser process, WASM memory, CPU time, timeout, checkpoint, and log
    budgets. Give formulas and a practical serial versus parallel policy.
11. Failure injection: browser crash, power loss, model corruption, WASM trap,
    generation timeout, network loss, P2P peer loss, companion restart,
    IndexedDB failure, locked profile directory, stale service worker, duplicate
    response event, and MemoryEndpoints restore conflict.

Required report structure:

1. Public TinyRustLM observation log with date, URL, and viewport.
2. Campaign manifest and state machine.
3. Fresh-profile and deletion protocol.
4. Real-model import and conversation procedure.
5. Memory-continuity branch for the designated 25 rounds.
6. Network, privacy, and secret-scanning contract.
7. Visual, responsive, and accessibility assertions.
8. Receipt schema and resume algorithm.
9. Resource budget and execution schedule.
10. Fault-injection matrix with expected evidence.
11. Acceptance report format and blocker taxonomy.
12. Unknown local facts.
13. Direct primary-source links with dates.

Do not describe `localStorage.clear()`, a page reload, or one reusable browser
context as a full data restart. Do not use the deterministic 8.6 KiB fixture as
one of the 20 models. Do not simulate assistant text, MemoryEndpoints success,
P2P availability, or browser deletion.

## Prompt 4: Live MemoryEndpoints Single-Use Enrollment And Lossless Agent Continuity

You are an independent distributed-systems, identity, and browser-security
researcher. Design and audit the live MemoryEndpoints.com workflow that lets a
TinyRustLM user create an agent from a secret one-time URL, receive an agreed
agent name and scoped token, delete the browser, and restore both short-term and
long-term memory from another browser. You may inspect public
MemoryEndpoints.com, TinyRustLM.com, UAIX.org documentation, and relevant
standards. You have no credentials, private API access, internal rooms, source
code, logs, or test fixtures.

Required product semantics:

- The enrollment URL is secret and single use.
- The first atomic claim consumes it and returns a canonical agreed agent name
  plus an agent-scoped token.
- A retry with the same idempotency key may recover the original committed
  result after a lost response.
- Reuse with a different idempotency key must be dead and produce a typed safe
  rejection without creating another agent, token, package, or receipt.
- A new browser reconnects using only the agent name and token. Hidden
  workspace/company identifiers are server-derived.
- Short-term state and long-term memory/pointers are restored without silently
  promoting raw conversation into durable memory.
- The browser must not persist the enrollment URL or token by default.
- A live dogfood campaign creates 25 unique disposable companies, runs the
  workflow, closes each company, deletes it, and proves cleanup.
- A local fixture is useful for integration tests but can never satisfy the
  live gate.
- Undocumented API guesses are forbidden. The service must advertise a
  versioned contract before the client invokes lifecycle routes.

Inspect only public-safe information. If the required production contract is
not publicly advertised, state that as a blocker and describe the exact
backend evidence needed rather than inventing endpoints. Research and specify:

1. A versioned connector/enrollment contract document. Define schema identity,
   HTTPS origin binding, advertised POST routes, maximum sizes, capability
   flags, idempotency semantics, token scope, hidden-workspace reconnect,
   cleanup routes, preview/production status, key rotation, and unknown-field
   behavior.
2. Atomic first claim. Model database uniqueness constraints, transaction
   boundaries, one-time secret hashing, expiration, canonical-name agreement,
   agent/token/package creation, receipt persistence, response delivery, and
   same-key recovery. Explain behavior under process crash at every boundary.
3. Replay and race resistance. Specify HTTP status, typed error body,
   `safeNoOp`, audit fields, and counts after a second claim. Include ten-way
   concurrent claims, replay from another IP/browser, expired URLs, malformed
   URLs, and URL leakage response. Exactly one logical operation may win.
4. Agent-scoped authentication. Cover token entropy, hashing at rest, audience,
   tenant and agent binding, least privilege, expiration, rotation, revocation,
   predecessor invalidation, rate limits, brute-force resistance, and why a
   workspace administrator credential must not be returned to a browser.
5. Memory data model. Distinguish current short-term status, durable long-term
   records, pointers, supersession, tombstones, provenance, revision conflicts,
   retrieval ranking, bounded context, untrusted content, and startup package
   order. Define what exact continuity means without promising raw transcript
   replay.
6. Cross-browser reconnect. Specify request/receipt fields, canonical agent
   verification, server-derived binding, startup checkpoint, search and pull,
   stale-index reporting, conflicts, offline outbox reconciliation, and UI
   status. Wrong agent names, wrong tokens, revoked tokens, and cross-tenant
   responses must fail closed.
7. Browser credential boundary. Analyze URL history, referrer, clipboard,
   password manager, form autofill, local/session storage, IndexedDB, Cache
   Storage, service workers, BroadcastChannel, logs, traces, crash dumps,
   analytics, prompts, screenshots, and extensions. Recommend session-only
   handling and a separate explicit persistent-secret design.
8. The 25-company live campaign. Define exact create, invite, first claim,
   memory writes, first-profile deletion, second-profile reconnect, memory
   retrieval, replay rejection, token scan, close, delete, and post-delete
   verification sequence. Every run needs unique identities and idempotency
   keys but reports contain only redacted IDs and hashes.
9. Cleanup guarantees. `finally` must attempt close and delete independently,
   even after earlier failures. Define compensating cleanup, orphan discovery,
   retention, legal/audit boundaries, and a public-safe defect report when a
   company cannot be removed.
10. Coordination protocol between the TinyRustLM agent and MemoryEndpoints
    backend agent. Define public-safe messages, expected evidence, room/task
    routing, acknowledgment, retry, stale credentials, and how a missing
    contract blocks execution without blocking local development.

Required report structure:

1. Public observation log and explicit unavailable facts.
2. Enrollment contract schema and route requirements.
3. Transaction and crash-state diagrams.
4. Replay, race, idempotency, and lost-response analysis.
5. Agent-token security model.
6. Short-term/long-term memory and reconnect semantics.
7. Browser secret-handling threat model.
8. Exact 25-company live test protocol.
9. Cleanup and orphan-recovery procedure.
10. Cross-agent defect and evidence protocol.
11. TDD matrix from fixture to authorized production test.
12. Blockers requiring MemoryEndpoints implementation.
13. Current primary sources and public URLs with dates.

Do not print or request credentials in the report. Do not put the enrollment
secret in a query log, durable browser store, prompt, screenshot, or report. Do
not treat an HTTP 404, missing capability, fixture response, or mocked company
as a successful live test.

## Prompt 5: Twenty-Model Direct P2P Fleet, Two Independent Lanes, And Public Proof

You are an independent P2P protocol architect, network-security engineer, and
service-reliability researcher. Produce a detailed design for leaving 20 good
TinyRustLM `.slm` models continuously shared through the MiniModel direct P2P
network. You may inspect MiniModel.org, TinyRustLM.com, public packages, browser
network behavior, and standards. You cannot access private model files,
manifests, servers, router settings, public IPs, receipts, source code, or
credentials.

Fixed constraints:

- Only quality-qualified, provenance-bound models may be admitted.
- The 20 models must have distinct cryptographic artifact identities. Relabeled
  copies and smoke fixtures do not count.
- Every admitted model is served by exactly two independently restartable
  process lanes.
- The lanes share one read-only artifact/piece store; bytes are not duplicated
  per lane.
- Model bytes flow directly between consenting peers. MiniModel.org provides
  catalog/discovery metadata and must not proxy model bytes.
- A lane is not public merely because loopback, LAN, browser-local, or NAT
  hairpin tests succeed.
- Public announcement requires a signed, expiring, identity-bound receipt from
  a genuinely outside-network observer for both lanes.
- A failed, changed, expired, or revoked endpoint must not remain advertised.
- The downloadable Rust/.NET companion is the operational host; the browser UI
  remains the chat interface.

Research and specify:

1. The fleet configuration and identity model for 20 artifacts and 40 lane
   memberships. Bind fleet, model, artifact, manifest, piece set, lane, process,
   endpoint, service definition, proof receipt, and announcement identities.
2. Admission ordering from quality receipt through `.slm` validation,
   provenance/license review, piece generation, local round trip, two-lane
   serve, external proof, and catalog publication. State every fail-closed gate.
3. Independent process supervision. Each lane must pre-bind all configured
   endpoints before ready, fail atomically on a collision, terminate if a
   serving task dies, drain on shutdown, and restart independently. Cover
   Windows and systemd user-service operation.
4. Resource governance for 20 models. Calculate storage, page cache, file
   descriptors, connections, hashing CPU, startup revalidation, logs, and
   outbound bandwidth from variables. Design global and per-peer concurrency,
   weighted fairness, upload caps, hot/cold policy, and denial-of-service
   controls.
5. Strict HTTP serving. Define exact allowed methods/routes, fixed piece names,
   bounded headers, CORS, ranges, content length, timeout, path normalization,
   symlink/reparse defense, request smuggling resistance, connection close, and
   omitted version-zero features.
6. NAT and reachability. Compare IPv4 forwarding, IPv6, CGNAT, double NAT,
   PCP/NAT-PMP/UPnP, operator-approved tunnels, and manual setup. The first
   release must not silently change router or firewall state. Define accurate
   statuses from configured to advertised.
7. Outside proof. Design a canonical signed receipt bound to model, artifact,
   piece set, normalized URL, lane, observer, checked routes, response hashes,
   implementation version, nonce, observation time, issue time, and expiry.
   Address Ed25519 canonicalization, observer rotation, replay, clock skew,
   endpoint drift, compromise, revocation, and eventual quorum.
8. Catalog lifecycle for pending, active, degraded, stale, revoked,
   superseded, quarantined, and removed models. Explain what users see when one
   lane fails, both fail, proof expires, quality is downgraded, or a license
   concern appears.
9. Resumable imports from one or two matching peers. Require complete identity
   agreement before mixing pieces, per-piece hashing, durable journal,
   corruption quarantine, atomic final promotion, and final Rust verification.
10. Continuous verification. Define local health cadence, external proof
    renewal, announcement heartbeat, stale timeout, model-byte spot checks,
    full revalidation schedule, bandwidth accounting, and privacy-preserving
    diagnostics without a proprietary telemetry backend.
11. A real deployment acceptance plan: local fixtures, one real model, two
    process lanes, deliberate lane death, outside observation, direct import,
    then staged growth to 5 and 20 models. Separate what CI can prove from what
    requires authorized external infrastructure.

Required report structure:

1. Public catalog observation log and explicit unknowns.
2. Fleet/process/network diagrams.
3. Identity and configuration schemas.
4. Admission and serving state machines.
5. Capacity model for 1, 5, and 20 models.
6. HTTP allow/deny profile.
7. NAT workflow and status vocabulary.
8. External proof and announcement protocol.
9. Import, corruption, and recovery model.
10. Continuous operations and runbooks.
11. Test matrix and required evidence.
12. Staged implementation backlog.
13. Direct primary-source links with dates.

Do not count two URLs in one process as independent lanes. Do not call local
health public reachability. Do not invent peer counts, observer signatures, or
catalog availability. Do not use a project-hosted model-byte fallback.

## Prompt 6: End-To-End Campaign Evidence, Release Gates, And Failure-Driven Operations

You are an independent principal release engineer, evidence-systems architect,
and production test lead. Design the end-to-end control plane for a TinyRustLM
campaign that qualifies 20 models, executes 50 clean-browser conversations,
performs 25 live MemoryEndpoints continuity runs, and leaves the 20 models
shared through two externally proven P2P lanes. You may inspect public websites,
NuGet pages, standards, and official tool documentation. You cannot inspect
private code, artifacts, CI, signing credentials, production services, or test
receipts.

The campaign must be resumable and honest. Partial success is useful evidence
but not completion. External blockers must be visible and cannot be converted
to skips or simulated passes.

Research and design:

1. A campaign state machine with phases for source discovery, acquisition,
   review, conversion, native evaluation, model qualification, browser rounds,
   MemoryEndpoints continuity, P2P preparation, two-lane serving, external
   proof, catalog announcement, deployment verification, and final memory.
   Define allowed transitions, retry transitions, terminal rejection, external
   blockage, and completion.
2. Content-addressed phase identities. Explain how acquisition receipts,
   conversion receipts, evaluation receipts, browser receipts, memory receipts,
   peer receipts, proof receipts, and release receipts bind inputs and tool
   versions. A change to the evaluator should rerun evaluation but not repeat a
   valid 3 GB acquisition or conversion.
3. Durable filesystem rules. Cover same-directory atomic writes, fsync,
   bounded JSON, checksums, history archives, staging ownership, interruption,
   disk-full behavior, Windows rename semantics, cleanup, and validation before
   resume. Large model files must be streamed for hashing.
4. Evidence minimization. Reports may contain public IDs, hashes, sizes,
   versions, counts, statuses, timestamps, and bounded error codes. They must
   exclude prompts, raw credentials, invitation URLs, tokens, workspace keys,
   private model paths where publication is unsafe, and raw hosted-memory
   payloads. Define redaction tests and secret scanning.
5. Blocker taxonomy. Include insufficient model quality, unsupported
   architecture, acquisition drift, license ambiguity, evaluator defect,
   unavailable training compute, missing live enrollment contract, expired
   coordinator credential, company cleanup failure, absent external observer,
   unreachable lane, stale proof, catalog rejection, signing credential
   absence, and deployment mismatch. Specify which work can continue behind
   each blocker.
6. Release gates for Rust, WASM, browser assets, C ABI, C# wrappers, NuGet
   packages, symbols, self-contained companion archives, MiniModel metadata,
   and public websites. Cover unit, integration, fuzz, package-consumer,
   browser, cross-platform, and live authorized tests.
7. Cross-platform evidence for `win-x64`, `linux-x64`, and `linux-arm64`.
   Distinguish successful cross-compilation, binary-header inspection, emulated
   smoke execution, and real hardware execution. Define minimum acceptable
   evidence for each release channel.
8. Supply-chain controls: pinned dependencies, `Cargo.lock`, NuGet lock and
   repository metadata, SourceLink, portable PDB, `.snupkg`, package allowlists,
   native asset hashes, SBOM, provenance, signing, malware-scanning boundaries,
   secret scanning, archive traversal, retention, rollback, and publication
   authorization.
9. Progress reporting. Design a concise operator dashboard that reports
   qualified models out of 20, completed clean rounds out of 50, completed live
   memory rounds out of 25, externally proven lanes out of 40, announced models
   out of 20, current operation, elapsed time, resumable state, and blockers.
   It must never claim `done` from unit tests alone.
10. Failure-driven improvement. When raw dogfood exposes an evaluator defect,
    UI duplicate, restart leak, memory loss, source mismatch, or P2P drift,
    define how to preserve the failure, add a general regression test, make a
    scoped fix, rerun only invalidated phases, and update long-term project
    memory.
11. Final acceptance and publication. Require 20 distinct qualifying hashes,
    50 passing deletion-backed browser receipts, 25 live company cleanup and
    restore receipts, 40 current outside-proof receipts, 20 live catalog
    announcements, package verification, public HTTPS readback, no secret
    exposure, and an explicit remaining-risk section.

Required report structure:

1. Executive control-plane recommendation.
2. Campaign phase/state diagram.
3. Receipt graph and versioned schema family.
4. Atomic persistence and resume algorithm.
5. Privacy/redaction contract.
6. Blocker matrix with parallel work paths.
7. Test and release gate matrix by component and RID.
8. Supply-chain and publication controls.
9. Progress dashboard specification.
10. Failure-to-regression workflow.
11. Final acceptance checklist with objective evidence.
12. Prioritized implementation plan.
13. Unknowns requiring local or authorized production access.
14. Annotated primary-source bibliography with dates.

Do not propose a single boolean `passed` field without phase evidence. Do not
overwrite rejected or obsolete receipts. Do not count mocks as live tests,
cross-compilation as executed ARM64 evidence, local P2P probes as public proof,
or package creation as successful publication.

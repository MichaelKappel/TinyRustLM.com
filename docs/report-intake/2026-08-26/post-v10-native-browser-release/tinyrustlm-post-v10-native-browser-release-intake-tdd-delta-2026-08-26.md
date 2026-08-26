# TinyRustLM Post-/10 Native Browser Release TDD Delta

Date: 2026-08-26

## Purpose

This document converts the useful parts of the twelve advisory reports into a
test-first implementation sequence. It does not authorize execution and does
not supersede frozen goals, registrations, local contracts, or immutable
evidence. Where a proposed test does not yet exist, its name below is a logical
test identity, not a claim that code has been implemented.

The sequence is intentionally strict. A downstream test suite is materialized
only after its input artifact has passed the preceding gate. Every real
operation receives new identities and bounded private evidence outside Git.

## Gate 0: Intake And Authority

### Tests

1. Verify all twelve durable report files against the manifest byte counts and
   SHA-256 values.
2. Reproduce the 907,733-byte report total and canonical inventory SHA-256
   `4f065f1d6594e9bdbd3bfb9ccdaf8d7f9c63e8d9c2ea7ff59e79caba2ba63f4b`.
3. Require the synthesis, TDD delta, and durable memory routes in every hot
   memory file named by the intake verifier.
4. Assert the durable memory SHA-256 in `.uai/long-term-memory.uai`.
5. Assert all twelve ledger entries are `incorporated`, point to exact durable
   paths, and are marked absent from the authoritative active intake.
6. Assert both active intake buckets contain placeholders only.
7. Assert the frozen goal hashes remain exact.
8. Assert MemoryEndpoints is unauthorized and all campaign counters remain
   zero.

### Acceptance

The intake checkpoint is committed, pushed, freshly fetched, and exact across
local `HEAD`, tracking, `FETCH_HEAD`, and the direct remote ref. No private
artifact or report-source mutation is included.

## Gate 1: Sole Receipt Contract

### Red Tests First

- Accept the exact producer child operation `parent + "-members"` with status
  `performed` when every other field is valid.
- Reject the parent operation ID without the suffix.
- Reject status `flushed`.
- Reject accepting both shapes.
- Reject duplicate fields, unknown fields, explicit null, unsafe integers,
  trailing bytes, malformed UTF-8, oversized input, and contradictory terminal
  records.
- Reject a producer digest, length, inventory, or path claim that differs from
  independently recomputed candidate facts.
- Reject duplicate, missing, extra, or incorrectly parented operations.
- Require Rust, .NET, and JavaScript to return the same typed verdict for each
  immutable vector; disagreement is failure, not majority voting.

### Implementation Constraint

Use the smallest auditable normative description that removes duplicated
constants without sharing producer business logic with the verifier. First
prototype and measure this against the existing source. Do not add Smithy, a
proprietary generator, a second parser, or a new digest algorithm merely
because a report recommends it.

### Acceptance

- Byte-reproducible vector generation.
- Stale generated output fails the build if generation is adopted.
- Parser and graph-validator property tests preserve every counterexample.
- Fuzz boundaries have explicit byte, nesting, allocation, and time limits.
- The shipping path contains one accepted contract only.

## Gate 2: Wholly New Output-Free Registration

### Red Tests First

- Reject any `/10` operation, root, binary, request, evidence, output, process,
  terminal, or verification identity.
- Reject a future private root that already exists.
- Reject root checks that create the root they claim to observe as absent.
- Reject noncanonical, relative, UNC, linked, reparse, case-aliased, or
  out-of-parent paths.
- Reject source commit/tree mismatch across local, tracking, fresh fetch, and
  direct remote.
- Reject dirty source, stale registration, source lock drift, tool-recipe
  drift, missing resource limits, retries above zero, and output-bearing
  registration.
- Reject build custody created before the registration commit is remote exact.
- Reject a second observable owner launch after any spawn attempt.

### Positive Registration

Bind:

- corrected source commit and tree;
- both frozen goal identities;
- exact source revision and source-file locks;
- sole receipt, conversion, composition, and verification profiles;
- toolchain and environment recipes;
- one bounded command and owner identity;
- timeout, stdout, stderr, file-count, and byte ceilings;
- wholly new private logical names; and
- explicit claim and campaign noncredit boundaries.

### Acceptance

The registration is output-free, committed, pushed, freshly fetched,
four-way exact, and all future roots remain absent before the sole owner starts.

## Gate 3: One-Shot Conversion And Terminal Closure

### Fault Cases

Exercise generic owner code outside the real registered names for:

- preflight rejection;
- environment or build-custody rejection;
- spawn failure and ambiguous spawn observation;
- converter nonzero exit;
- managed inspector nonzero exit;
- timeout;
- stdout/stderr overflow;
- child process escape;
- owner crash and machine interruption;
- missing or duplicate terminal;
- final verifier disagreement; and
- disk full or locked output.

Every case must produce one typed terminal classification. No case may launch a
replacement process, resume, repair, delete, or adopt partial output.

### Real Acceptance

The sole owner launches once. Its read-only verifier launches once after owner
termination. Candidate and evidence inventories are complete, bounded, and
content-addressed. A failure closes that identity forever. A pass permits only
semantic composition inspection.

## Gate 4: Six-Member Semantic Composition

### Parser Tests

- fixed header and schema identity;
- endian and alignment markers;
- checked offset and length arithmetic;
- ordered non-overlapping regions;
- exact total file length and trailing-byte policy;
- bounded tensor/member counts;
- no sparse-hole, hard-link, symlink, or reparse substitution;
- no time-of-check/time-of-use replacement during hashing;
- unsupported features return typed rejection before allocation.

### Qwen3 Oracle Tests

Require exactly the locally frozen architecture:

- vocabulary capacity 151,936;
- context 40,960;
- hidden size 1,024;
- feed-forward size 3,072;
- 28 layers;
- 16 query heads;
- 8 key/value heads;
- head dimension 128;
- tied embeddings;
- no QKV bias; and
- Q/K normalization.

Derive tensor roles and shape equations from those values. Reject the
Qwen2.5-like `24/14/2` shape imported by several reports.

### Quantization Tests

Before accepting any packed tensor, prove exact signed range, group size,
scale type and placement, zero-point policy, byte order, packing order, tail
group behavior, special unquantized tensors, accumulator width, dequantization
formula, and rounding. Reject NaN/Inf scales, negative-zero ambiguity where the
format forbids it, malformed tails, overlap, and aliases.

### Cross-Member Tests

- exact six semantic roles and names;
- manifest SHA-256 and length match;
- source/profile identity match;
- model vocabulary capacity and Tokenizer2 domain relationship;
- stop IDs and special IDs are in model range;
- Template2 branches and Sampling2 defaults are explicit;
- Prompt2 authority profile is present without exposing private prompt text.

### Acceptance

Two independent readers agree on one typed pass. The allowed claim is
`composition-semantically-inspected`; numerical and quality claims remain
false.

## Gate 5: Source And Scalar Numerical Authority

### Hand-Checkable Kernel Tests

- RMSNorm with zero, mixed-sign, and extreme finite inputs;
- RoPE pair indexing and position boundaries;
- Q/K normalization;
- grouped-query mapping from 16 query heads to 8 KV heads;
- packed mixed-Q8 dot products including tail groups;
- causal softmax and all-suppressed failure;
- SwiGLU gate/up/down order;
- residual ordering;
- tied output projection;
- KV append, reset, context overflow, and composition invalidation;
- greedy tie order and finite-logit checks; and
- seeded temperature/top-k/top-p/repetition processing where shipped.

### Source Differential Tests

Use a pinned offline source-framework closure. For identical rendered bytes and
token IDs, compare:

1. embeddings;
2. selected normalized layer inputs;
3. Q/K/V and rotated Q/K;
4. attention and MLP outputs;
5. residual states;
6. final hidden state;
7. logits and top-token order; and
8. greedy token sequence.

Add a reconstructed-float-weight diagnostic arm to separate conversion error
from packed-dequantization error. Thresholds are preregistered by operation and
tensor class before seeing the real candidate. First failure records the
earliest layer, token, head, operation, and chunk.

### Acceptance

The source-to-scalar arrow passes all registered cases and error bounds.
Attractive final text is not an oracle. Scalar implementation disagreement is
fixed, not declared acceptable.

## Gate 6: Optimized Native

### Tests

- feature detection and one explicit kernel-profile identity;
- scalar-versus-optimized kernel vectors;
- layer, logits, top-k, and token-sequence comparisons;
- alignment, tails, overflow, and cancellation;
- no dispatch to unregistered scalar or alternate kernels after failure;
- real win-x64 execution;
- real linux-x64 execution; and
- real linux-arm64 execution for any channel claiming it.

Cross-compilation, header inspection, and emulation are recorded as their own
evidence classes and cannot satisfy real-hardware execution.

### Acceptance

Optimized native passes the registered differential and resource gates with no
fallback. Source and scalar receipts remain immutable prerequisites.

## Gate 7: Tokenizer2, Template2, Sampling2, Prompt2

### Tokenizer2 Tests

- exact 151,669-entry tokenizer inventory and relationship to 151,936 model
  vocabulary capacity;
- duplicate token bytes, IDs, ranks, and added-token rejection;
- byte-level encode/decode vectors;
- invalid UTF-8 and incomplete generated-byte state;
- JavaScript/.NET unpaired UTF-16 surrogate perimeter behavior;
- NUL, CR/LF, tabs, nonbreaking space, combining marks, variation selectors,
  emoji ZWJ, RTL controls, and maximum input;
- literal special-token text from untrusted input remains ordinary data; and
- browser and native vectors match exact bytes and typed errors.

### Template2 And Prompt2 Tests

- role ordering and unsupported-role rejection;
- trusted role markers can only be emitted by the template machine;
- exact whitespace and assistant-prefix behavior;
- current user authority over stale state;
- quoted and retrieved instructions remain labeled untrusted data;
- deterministic whole-message truncation;
- current turn and required policy survive budget pressure;
- oversize single-message failure is explicit; and
- no arbitrary Jinja or ambient prompt default.

### Sampling2 Tests

- explicit greedy and stochastic profiles;
- stable tie order;
- exact RNG and seed replay;
- finite-logit validation;
- temperature/top-k/top-p order;
- repetition penalty sign handling;
- stop/EOS/max-token termination; and
- no hidden generation retry.

### Acceptance

Publisher-reference vectors and all maintained Rust, .NET, JavaScript, and
real-browser vectors agree at the declared boundary.

## Gate 8: Real-Browser WASM

### Capability Probe Tests

Record exact browser build and probe:

- WASM32 memory admission;
- SIMD profile required by the registered module;
- worker support;
- SharedArrayBuffer only when the selected profile requires it;
- cross-origin isolation headers;
- OPFS/File System Access APIs used by the selected storage profile; and
- storage quota and low-memory rejection.

Do not mark Firefox or WebKit supported without the same product-level tests.
Do not make Relaxed SIMD part of the first deterministic profile.

### Loader And Resource Tests

- header-first bounded admission;
- vetted incremental whole-file SHA-256;
- exact member and composition verification before activation;
- bounded chunking and backpressure;
- cancellation during read, hash, prefill, and decode;
- no accidental whole-file JavaScript copy;
- measured model, linear, JS, KV, scratch, and process memory;
- atomic activation and crash recovery;
- poisoned-worker discard and fresh-worker reverify; and
- no implicit `memory.grow` beyond a registered ceiling.

### Numerical Tests

Compare registered kernel, layer, logits, top-token, and deterministic token
outputs to optimized native. Browser JIT or platform variation is evidence to
characterize, not a reason to weaken bounds after seeing failure.

### Acceptance

One real Chromium build passes numerical, memory, cancellation, restart, and
network gates. Node execution is not browser evidence.

## Gate 9: Exactly-Once Multi-Turn Browser Chat

### Protocol And Race Tests

- every command/event binds protocol, composition, conversation, turn,
  generation, message, and sequence identities;
- double submit and Enter-plus-click create at most one generation;
- repeated identical token text renders repeatedly when sequence IDs differ;
- duplicate event IDs do not render twice;
- out-of-order and late old-worker events are rejected;
- cancel during prefill and between token/completion closes one generation;
- model switching invalidates worker and KV state;
- WASM trap, OOM, context overflow, storage drift, worker crash, and stale
  service worker never auto-start a new generation;
- raw private output is unchanged by Markdown/sanitization presentation; and
- introductory cards disappear, center workspace stabilizes, composer remains
  usable, and status is truthful at desktop, narrow, and mobile widths.

### Fresh Profile Tests

Create one owned random profile root under a verified owned parent, launch a
persistent browser context, close the context and process, prove no handles,
delete with bounded retries, and prove absence. Guard parent containment and
reparse/symlink substitution before any recursive deletion. Reload,
`localStorage.clear()`, and incognito do not pass.

### Privacy Tests

Capture requests, WebSockets, beacons, reports, service-worker fetches, and
referrers. Fail prompt/model upload, telemetry, credential URLs, or unexpected
third parties. MemoryEndpoints must not appear.

### Acceptance

One no-retry multi-turn round preserves raw output, renders each assistant
answer once, proves actual cancellation and fresh-worker recovery, closes the
browser, deletes the profile, and records a typed terminal verdict.

## Gate 10: Qualified P2P-Or-Convert Acquisition

### Route Tests

- exact qualified composition and current peer evidence selects direct import;
- absence of that exact peer identity selects explicit local conversion;
- an expired, stale, or mismatched peer does not masquerade as available;
- route and source are visible before bytes move;
- no text, JSON, or script handoff is downloaded;
- no project site proxies model bytes; and
- route failure is typed and never triggers a hidden alternate route.

### Companion And Storage Tests

- origin/session-bound challenge and user-presence approval;
- replay, DNS rebinding, CSRF, origin spoof, and local impostor rejection;
- bounded APIs accept no arbitrary command, path, or URL;
- matching piece-set identity before multi-peer mixing;
- per-piece and whole-member verification;
- durable journal and corruption quarantine;
- disk-full, cancellation, process crash, and locked-file recovery; and
- atomic immutable activation with reference-counted deletion.

### Acceptance

One real qualified artifact is acquired through each implemented branch that
is claimed, activated, and opened in the real browser without instruction-file
downloads or project-hosted model bytes.

## Gate 11: Source Quality And Quantization Noninferiority

### Source-First Stop Gate

Before additional conversion or training compute, preregister sealed scenario
families, paraphrase generators, seeds, limits, rubrics, and stop rules. Reject
the source if it repeatedly violates practical constraints, source authority,
current-turn precedence, untrusted-memory treatment, ordinary helpfulness, or
lawful-adult directness.

### Layered Evaluation Tests

- output completion and structural validity;
- scenario-specific semantic invariants without fixture keywords;
- metamorphic changes to entity, unit, date, order, negation, resources,
  authority, style, distractors, and memory provenance;
- independent judge signals that cannot edit candidate text;
- blinded human review and adjudication;
- contamination checks against prompts, answer concepts, templates,
  benchmarks, and semantic neighbors; and
- paired source/scalar/native/WASM outcomes with family-clustered uncertainty.

### Acceptance

Use preregistered practical noninferiority margins and catastrophic-regression
budgets. Terminal outcomes are `qualified`, `task-specific`, `research-only`,
or `rejected`. Failure never changes a holdout, selects a lucky seed, repairs
an answer, or trains on the failed case.

## Gate 12: Release, Documentation, And Deployment

### Source And Supply-Chain Tests

- clean focused commits and remote equality;
- locked dependency restoration and license inventory;
- bounded SBOM/provenance format selected by an explicit local ADR;
- Rust, WASM, .NET/C ABI/package consumer matrices;
- native asset hashes and archive traversal rejection;
- secret and malware-scan boundaries; and
- no large model, private output, or private evidence in Git.

### Site And Documentation Tests

- release commit equals deployed asset identities;
- hashed asset, HTML, and service-worker coordination;
- COOP, COEP, CORP, CSP, CORS, cache, and SRI policy as applicable;
- architecture, format, user, operator, privacy, accessibility,
  troubleshooting, marketing, release-note, and publication-log drift checks;
- visible publish ID, technical release identity, release date, changes,
  limitations, rollback reference, and HTTPS readback; and
- no claim exceeds its exact evidence class.

### Acceptance

Commit and push each coherent green major change. Deploy an affected site only
after its complete gate passes. Verify DNS/TLS/HTTPS, headers, asset hashes,
service-worker state, critical flow, network allowlist, release-log equality,
and rollback. A successful one-model vertical slice still leaves the
20-model/50-round campaign incomplete.

## Global Stop Rules

Stop and preserve the exact terminal attempt when any one-shot identity is
launched, when evidence is ambiguous, or when a registered bound is exceeded.
Stop a candidate when source-first quality fails. Stop numerical promotion at
the first unexplained divergence. Stop browser promotion on unmeasured memory,
unexpected network traffic, duplicate rendering, ineffective cancellation, or
profile-deletion failure. Stop deployment on dirty or unpushed source, stale
documentation, claim drift, missing credentials, or failed HTTPS readback.

Never convert a stop into a skip, fallback, retry, repaired response, lowered
threshold, legacy path, or campaign credit.

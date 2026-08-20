# First Working-Model Acquisition And Browser-Local Chat Vertical Slice

This milestone continues, and does not narrow or replace, the authoritative
enterprise goal in
`2026-08-10-authoritative-enterprise-vnext-continuation-goal.md`.

## Mission

Build, verify, publish, and independently read back the first complete
working-model acquisition and browser-local chat vertical slice.

A user selecting a supported model must receive a working local model:

1. Acquire an exact verified SLM2 artifact directly from a consenting P2P peer
   when current, identity-bound peer evidence exists.
2. Otherwise, automatically ask the separately installed local companion to
   acquire the pinned upstream source and convert it deterministically to SLM2.
3. Validate and activate the resulting model transactionally in the browser.
4. Run a genuine multi-turn conversation through the Rust/WASM runtime.

Never substitute a `.txt`, JSON, PowerShell, shell script, conversion request,
or explanatory download for the requested working-model action.

## Authoritative Starting State

- Work only in
  `E:\Source\.tinyrustlm-model-acquisition-recovered-20260819`.
- Preserve without modification `E:\Source\Rust\TinyRustLM.com`.
- Preserve all other damaged, former, or user-owned worktrees.
- Use branch `codex/model-acquisition-v2` from remote-exact starting revision
  `24ed84f7de23a2052d378ff16c7fe0fa1833fa57`.
- Revalidate the frozen continuation-goal SHA-256
  `92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0`.
- Keep large model files, conversion workspaces, fuzz output, and evidence on
  `E:` or `C:` and outside source control. Do not use critically full `D:`.

The current SLM2 parser, exact tensor registry, language-neutral vectors,
independent Node oracle, hostile corpus, and deterministic replay are complete
through the starting revision. Do not recreate or weaken them.

## Immediate Sanitizer Correction

Preserve the first Windows AddressSanitizer run as honest evidence:

- `cargo-fuzz 0.13.2`
- `nightly-2026-08-20`
- Rust commit `f7d782a3be46d6bb4b9792fe69a61db389ba1769`
- AddressSanitizer enabled through Visual Studio 2022
- 6,334,599 executions
- zero crash artifacts
- peak RSS 550 MiB
- transcript SHA-256
  `8d6e85cf817414ea024563693f8f94ab454baa6a5ba0e7f70a329848407c2c9d`

Do not count it as the required seeded campaign because `Copy-Item
-LiteralPath` prevented wildcard expansion and libFuzzer loaded zero frozen
seed files.

Rerun the bounded sanitizer campaign using an independently verified external
copy of all 27 frozen corpus entries. Bind the source revision, corpus manifest,
tool versions, command, fixed seed, time limit, input limit, transcript hash,
execution count, peak RSS, and crash-artifact inventory. Preserve every
failure.

## Model-Family Selection

Choose exactly one source family for this milestone using current local
screening and public provenance evidence.

The selected model must have:

- an immutable upstream repository revision;
- exact model and tokenizer file identities;
- a reviewed license and redistribution/conversion determination;
- a frozen tokenizer and chat template;
- architecture semantics representable by the sole SLM2 profile;
- untouched raw-output screening under fixed and unseen paraphrase cases; and
- no unresolved source drift, quality rejection, or architecture mismatch.

Do not select a model because it is popular, small, structurally convertible,
or produced one attractive answer.

## Deterministic Converter

Implement one clean source-family-to-SLM2 converter with:

- exact source tensor-name and shape mapping;
- exact correspondence to the public SLM2 required tensor registry;
- checked arithmetic for every dimension, byte count, offset, and allocation;
- streaming source reads, output writes, and hashing;
- deterministic tensor ordering and canonical metadata;
- frozen source, tokenizer, template, and converter identities;
- fail-closed rejection of missing, surplus, duplicate, reshaped, nonfinite,
  unsupported, or ambiguously mapped tensors;
- same-directory staged writes and fail-atomic final promotion;
- cancellation and restart-safe conversion receipts; and
- final independent Rust validation before an artifact becomes eligible.

Do not add SLM1 readers, compatibility aliases, migration paths, fallback
parsers, model repair, or permissive tensor guessing.

## Runtime Conformance

Implement enough of the scalar Rust and WASM runtime to execute the selected
family correctly. Require comparison evidence for:

- tokenization and chat-template bytes;
- embedding and normalization;
- RoPE and grouped-query attention;
- Q/K normalization and QKV bias when declared;
- activation and gated MLP behavior;
- KV-cache shape and growth;
- layer outputs, final logits, selected tokens, and stop behavior;
- native scalar versus WASM scalar parity; and
- seeded generation reproducibility where determinism is declared.

Treat scalar Rust as the correctness oracle. SIMD, threads, WebGPU,
TurboQuant, TurboVec, KV compression, sparse specialists, adapters, and extreme
quantization remain excluded until separately measured and promoted.

## Companion And Acquisition Protocol

Implement one versioned, origin-bound browser-to-companion protocol. It must:

- prefer an exact verified P2P SLM2 identity when one is genuinely available;
- start reviewed local conversion when no verified peer is available;
- expose typed acquisition, verification, conversion, cancellation,
  completion, and failure states;
- bind source, output, companion, converter, and protocol identities;
- keep model bytes and prompts off every project-hosted public server;
- reject stale messages, wrong origins, identity drift, and replay;
- never silently change router, firewall, or public catalog state; and
- never claim public P2P availability from loopback or fixtures.

## Browser Lifecycle

Deliver the real browser-owned model lifecycle:

- Perform hashing, validation, loading, and generation off the UI thread.
- Preflight model, activation, scratch, tokenizer, and KV-cache memory.
- Preserve the currently active model until replacement activation succeeds.
- Support cancellation, timeout, worker crash, restart, persistence, and
  deletion.
- Render every assistant response exactly once.
- Preserve raw generation without response repair or best-of-N selection.
- Keep the approved visual design intact.
- Work at desktop, narrow-desktop, and mobile widths.
- Never expose secrets, private paths, prompts, or model bytes in telemetry,
  URLs, logs, screenshots, traces, or public receipts.

## Quality Gate

Conversion and runtime success are not model-quality proof. Before calling the
model usable, require:

- untouched source, SLM2 native, and SLM2 WASM outputs;
- fixed and unseen paraphrases;
- genuine multi-turn conversations;
- ambiguity, practical constraints, authority conflict, latest-turn
  precedence, untrusted quoted memory, summary, rewrite, JSON, and code cases;
- explicit latency, memory, and ordinary-helpfulness regression budgets;
- human review of consequential semantic disagreements; and
- no evaluator repair, expected-term injection, hidden retries, or threshold
  reduction.

State the narrowest claim actually supported by the evidence.

## Deployment

Once the complete vertical slice passes, publish all affected surfaces:

- TinyRustLM.com
- TinyRustLM.MiRust.com
- MiniModel.org documentation when its protocol or catalog behavior changes
- MiniModel.MiRust.com documentation when its developer contract changes

Before deployment:

1. Run complete affected Rust, WASM, Node, browser, package, privacy, secret,
   hostile-input, and documentation gates.
2. Commit every coherent healthy major change.
3. Push every affected repository and verify fresh remote equality.
4. Assign intentional versions and release dates.
5. Update visible and machine-readable update histories.
6. Bind exact source revision, deployment closure, tests, scans, and approval.
7. Deploy only the bound clean revision.
8. Perform independent public HTTPS readback.
9. Preserve immutable success or failure receipts.

Do not deploy internal-only changes that alter no site-bound bytes merely to
create activity.

## Acceptance Criteria

This milestone is complete only when objective evidence proves that:

- The corrected frozen-seed sanitizer campaign completed without an unhandled
  finding, or every finding was preserved, fixed generally, and rerun.
- One immutable source revision converts deterministically to one valid SLM2
  artifact.
- Repeated conversions produce byte-identical output.
- Native and WASM execution meet declared numerical and behavioral budgets.
- A clean browser profile acquires, activates, chats with, restarts, restores,
  cancels, and deletes the model correctly.
- P2P preference and local-conversion fallback use truthful typed states.
- No text/script/request download substitutes for model acquisition.
- No prompt or model byte reaches project-hosted servers.
- All affected source and documentation repositories are clean, pushed, and
  fresh-remote exact.
- Every affected production site is versioned, published, independently read
  back, and represented by immutable evidence.

This milestone does not complete or inflate the wider campaign. Unless real
authorized evidence says otherwise, retain the truthful counters:

- Qualified models: `0/20`
- Deletion-backed browser rounds: `0/50`
- Authorized live memory rounds: `0/25`
- Outside-network lane proofs: `0/40`
- Live catalog announcements: `0/20`

Continue the larger enterprise goal after this deployment. Do not mark the
overall objective complete from this first vertical slice.

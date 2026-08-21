# TinyRustLM SLM2 Scalar And Browser WASM Conformance Memory

Date: 2026-08-20

## Purpose

This report is the durable routing record for the first SLM2 scalar inference
and browser-WASM conformance milestone. It records what commit
`80f199d51f49417a699c57743550bf81153fa6e6` proves, what it does not prove,
and the exact next work. The enterprise goal remains active and incomplete.

## Source Control

- Authoritative worktree:
  `E:\Source\.tinyrustlm-model-acquisition-recovered-20260819`
- Branch: `codex/model-acquisition-v2`
- Implementation and documentation commit:
  `80f199d51f49417a699c57743550bf81153fa6e6`
- Remote: `origin/codex/model-acquisition-v2`
- The commit was pushed and local, upstream, and freshly fetched remote heads
  were exact before this handoff was written.
- Protected `E:\Source\Rust\TinyRustLM.com` was not modified.
- No files were written to `D:`.

The frozen enterprise goal remains
`docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md`
at SHA256
`92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0`.

## Implemented Boundary

The new `tinyrustlm-slm2-runtime` crate is the unsafe-free scalar correctness
authority for the current sole SLM2 profile. It validates and indexes SLM2
without retaining an F32 weight shadow and implements embeddings, RMSNorm,
optional Q/K normalization, optional QKV bias, split-half RoPE, causal GQA,
SiLU-gated MLP, residual flow, tied or untied output projection, logits,
deterministic lowest-token-ID greedy selection, bounded generation, and a
transactional KV cache.

Checked memory planning covers model indexing, scratch space, and KV growth.
Failures use a stable bounded `ScalarRuntimeError`. Generation commits the
final token, including a stop token, before returning so session position and
KV state remain aligned with the transcript. Borrowed operator-stage traces
allow exact conformance inspection without allocating inside the trace path.

The independent Node oracle does not invoke Rust, Cargo, a native executable,
the network, or a child process. It independently interprets the canonical
SLM2 artifact and applies explicit IEEE-754 f32 rounding at every scalar
operation. Rust integration tests and the Node oracle consume one
language-neutral runtime-vector document.

The conformance-only WASM crate embeds only the public canonical fixture and
calls the exact scalar runtime crate. It exposes bounded reset, forward,
position, KV, greedy-token, logits, error, and clear operations. It has no WASM
imports. This is intentionally not the production multi-gigabyte model-transfer
ABI.

## Exact Identities

- Runtime vector: `contracts/vnext/slm2-runtime-vectors.v1.json`
  - 48,369 bytes
  - SHA256 `c7a0fdaf1dd578928e6a438be308dad5a9e8cc10e2bbb6da4b2c5e10bebe71f1`
- Canonical SLM2 fixture:
  - 8,448 bytes
  - SHA256 `c010e2818c64713310699e9ad928d3b22cfeb004756ae8e03acaaee5897e613a`
- Independent Node oracle: `tinyrustlm/tools/slm2-runtime-reference.js`
  - 16,511 bytes
  - SHA256 `df0b51548dce1a7174166479504a35fe6f5b256dd3168cae970ac8c1df7257b9`
- Architecture report:
  `docs/architecture/vnext-slm2-scalar-wasm-conformance.md`
  - 5,682 bytes
  - SHA256 `dd0a1fed96dcbb1ad790ffb1a58a71c3e530fcbe74aa8e7d81f565d6a068b6ac`
- Observed development WASM module:
  - 175,382 bytes
  - SHA256 `d41edd922ab1a0582400a43be5ab21acb34216a68603b2c108b59b9d65dc37a9`

The WASM module identity is local build evidence only. It is not a release or
deployed asset identity.

## Verification

The following checks passed against the implementation commit:

- `cargo fmt --all --check`
- Locked, offline Rust tests for SLM2, scalar runtime, and WASM conformance
  crates: 29 substantive tests passed.
- Locked, offline denied-warning Clippy for all targets in all three crates.
- Locked, offline release build for `wasm32-unknown-unknown`.
- Independent Node format, runtime-vector, and WASM conformance union: 13/13.
- Real Playwright Chromium replay of the WASM module with zero browser network
  requests.
- Deterministic runtime-vector generator check.
- `git diff --check` and a focused sensitive-pattern scan.

Three development failures remain useful history rather than passes: missing
crate documentation initially failed denied-warning lint; a generation test
initially reserved only the final observed position rather than the required
worst-case position; and the WASM wrapper initially returned buffer capacity
before missing-session state. Each general cause was corrected without
weakening a test or adding a compatibility path.

## Strict Claim Boundary

This checkpoint proves scalar/native execution and Node plus real-Chromium
WASM conformance only for the public canonical fixture. It does not prove:

- a source-framework implementation or source-framework parity;
- a real Qwen model or any useful model;
- tokenizer or publisher chat-template parity;
- declared seeded sampling beyond deterministic greedy selection;
- a production large-model browser transfer and ownership ABI;
- P2P acquisition or local conversion orchestration;
- product browser activation or a real multi-turn model conversation;
- model quality, deployment, publication, or public HTTPS state;
- MemoryEndpoints connectivity or any live campaign progress.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain 0/20 qualified models, 0/50 clean browser rounds, 0/25 live memory
rounds, 0/40 externally proven lanes, and 0/20 catalog announcements.

## External Human Gates

The exact 280-slot `holdout-custody-v6` plan still requires two genuinely
separate authoring contributions. The 1,024-record pilot curriculum and
teacher lineage do not exist, and two genuinely separate complete record-bound
curriculum review ledgers do not exist. This agent must not impersonate an
author, reviewer, or independent auditor.

## Exact Resume

Do not repeat this valid fixture-conformance checkpoint unless a bound input or
implementation identity changes. Continue the independently unblocked product
work by defining exact tokenizer, publisher chat-template, and seeded-sampling
contracts, then implement the production large-model WASM ownership boundary
and the P2P-or-local-conversion browser lifecycle. Keep acquisition,
conversion, structural runtime, and model-quality claims separate.

When genuine external holdout and curriculum-review contributions arrive,
assemble and seal the evidence, run contamination and blinded semantic audits,
issue the exact CPU training lock, train one candidate, rerun untouched source
screening, convert the accepted model to SLM2, establish real source/native/WASM
parity, and complete the genuine browser-local multi-turn conversation. The
full enterprise goal remains incomplete until every original acceptance gate
has objective evidence.

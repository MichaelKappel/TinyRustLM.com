# TinyRustLM Qwen3 Working-Model Training Controls Memory

Date: 2026-08-20 (America/Los_Angeles)  
Evidence cutoff: 2026-08-21T01:48:18Z  
Implementation commit: `490bdfe03537e4eff310e0fbd22366d36dd5d1f7`  
Branch: `codex/model-acquisition-v2`  
Frozen enterprise goal SHA-256:
`92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0`

## Scope And Claim Boundary

This checkpoint implements the fail-closed curriculum, sealed-exclusion,
contamination-audit, and CPU-pilot authorization controls for a new
Qwen3-0.6B derivative. It does not create or qualify a model.

The unchanged `Qwen/Qwen3-0.6B` source at revision
`c1899de289a04d12100db370d81485cdf75e47ca` remains terminally rejected as a
product model. Its only authorized use is as the exact provenance-clean base
ancestor of a newly trained derivative. Existing Qwen3 adapters remain
rejected. No source-screen verdict, conversion verdict, runtime verdict, WASM
verdict, browser verdict, release verdict, publication verdict, or campaign
counter changes in this checkpoint.

MemoryEndpoints remains unauthorized and disconnected. No account, company,
agent, enrollment URL, token, short-term memory, or long-term memory was read,
created, changed, or validated.

## Exact Source-Control State

Implementation commit `490bdfe03537e4eff310e0fbd22366d36dd5d1f7` was
pushed to `origin/codex/model-acquisition-v2`. A fresh `git ls-remote` read
returned that exact hash. The worktree was clean immediately after the push.

| Tracked artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `tinyrustlm/tools/qwen3-working-model-controls.py` | 99,010 | `19b7c5182653bc9fb9e2888ce1357a0aa327e656bbf4047c7f08994d0a8e1b50` |
| `tinyrustlm/tools/tests/test_qwen3_working_model_controls.py` | 31,233 | `6b2d362de9b2a532e240586142f6950e0feeb49804fa75d1309df0cb2607c63e` |
| `tinyrustlm/training/qwen3-0.6b-working-model-v1/profile.v1.json` | 11,426 | `f5c3d7bfae351bb5ee84631c6fc8e7f00c02f2b705bdaef7de9472854df8ac5f` |
| `tinyrustlm/training/qwen3-0.6b-working-model-v1/README.md` | 7,211 | `7103365d4837035383c0a12f4ba1f7e5432b9c2ad87cab36a5b8de3f68d0219c` |

## Frozen Base Identity

The profile binds all nine source files, not only the weight file or a mutable
repository name. The base revision is
`c1899de289a04d12100db370d81485cdf75e47ca`, Apache-2.0, architecture
`Qwen3ForCausalLM`. The 1,503,300,328-byte `model.safetensors` SHA-256 is
`f47f71177f32bcd101b7573ec9171e6a57f4f4d31148d38e382306f42996874b`.
The 11,422,654-byte `tokenizer.json` SHA-256 is
`aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4`.
The profile also binds `config.json`, `generation_config.json`, `LICENSE`,
`README.md`, `merges.txt`, `tokenizer_config.json`, and `vocab.json` by exact
size and SHA-256.

No training request can substitute a file, omit a sidecar, add an unbound
source artifact, traverse a symlink/reparse point, or identify a mutable
revision. The unchanged source bytes cannot be promoted from this lane.

## Curriculum Contract

The pilot requires exactly 1,024 accepted records; the scale target is exactly
200,000. Category counts are frozen rather than inferred after generation:

| Family | Pilot | Scale |
| --- | ---: | ---: |
| Ordinary conversation | 184 | 36,000 |
| Ambiguity | 82 | 16,000 |
| Practical constraints | 102 | 20,000 |
| Source conflict | 62 | 12,000 |
| Latest-turn precedence | 62 | 12,000 |
| Untrusted quoted memory | 72 | 14,000 |
| Multi-turn state | 82 | 16,000 |
| Lawful adult inquiry | 72 | 14,000 |
| Summaries | 61 | 12,000 |
| Rewriting | 51 | 10,000 |
| JSON | 51 | 10,000 |
| Extraction | 41 | 8,000 |
| Code | 61 | 12,000 |
| Factual answers | 41 | 8,000 |

Positive substantive help must be at least 98.5%. Narrow boundaries may be at
most 1.5%. Each category has four required scenario factors and requires at
least three distinct values per factor in the pilot. The factors cover
authority order, resource state, counterfactual fallback, entities, units,
discourse form, quoted instruction location, current versus stale state,
multi-turn reference form, output schema, and task-specific constraints.

Every record has an exact schema and binds source provenance, license, teacher
revision, sampling profile, seed, untouched raw teacher-output identity,
review rubric, review decision, factual-verification disposition, PII scan,
license review, and malicious-artifact scan. Hidden teacher reasoning is
forbidden. Two review stages and explicit disagreement resolution are required.
Rejected drafts cannot be repaired in place or relabeled as accepted.

## Sealed Holdout And Public Evaluation Contract

The private holdout contract requires exactly 280 cases, 20 per category. It
splits into 140 development and 140 independent-audit cases. Each case requires
at least four prompt variants and three answer-anchor variants. A private
32-byte seed selects variants with HMAC-SHA-256.

The same profile binds the exact current bytes of 11 assistant-quality
evaluation fixtures containing 52 cases. Profile validation parses every
fixture and verifies its declared contiguous case count. Any changed byte,
size, case count, scope, prompt, history, or expected term invalidates the
profile until an intentional new profile is reviewed.

The sealer will create a 332-case hash-only exclusion index outside Git. The
public receipt will contain profile, factor-pack, seed commitment, algorithm,
count, materialization, exclusion-index, and public-evaluation artifact-set
identities. It explicitly states that it contains no raw prompt, expected
anchor, or seed. Raw private material may exist only on `C:` or `E:` outside
the worktree. Existing output roots, other drives, symlinks, reparse points,
duplicate keys, malformed UTF-8, unbounded input, and partial identities reject.

This checkpoint does not include the private factor pack or seed and did not
run the production sealer.

## Contamination Controls

The curriculum audit uses a bounded streaming JSON Lines reader and inverted
hash indexes so the same algorithm remains viable at 200,000 records. It
rejects:

1. Exact normalized prompt overlap after Unicode NFKC, case folding,
   apostrophe folding, punctuation normalization, and whitespace collapse.
2. Character 13-gram containment at or above 0.65.
3. Token 5-gram containment at or above 0.60.
4. Entity-substituted token 4-gram containment at or above 0.55.
5. Declared template-family overlap.
6. Derived entity- and number-normalized template-signature overlap.
7. Exact answer-anchor reuse.
8. Presence of any bound public evaluation expected-answer term.
9. Answer token 3-gram containment at or above 0.70.
10. Duplicate normalized curriculum prompts, category/count drift, weak factor
    diversity, wrong helpfulness proportions, unlicensed lineage, hidden
    reasoning, failed review scans, and active immutable tombstones.

Finding output is content-minimized and bounded to 10,000 detailed finding
records while preserving exact total and per-kind counts. Reports contain
record-ID hashes and holdout commitments, not raw curriculum or holdout text.

A separately executed semantic audit must compare every curriculum record with
every exclusion case. Its receipt binds the curriculum, exclusion index,
encoder repository and immutable revision, encoder artifact set, exact
comparison count, 0.76 review floor, 0.84 rejection threshold, maximum
similarity, independent auditor identity, blinding attestation, findings, and
transcript. A similarity at or above 0.84 rejects. Similarities from 0.76 to
0.84 require explicit review. An opaque model judge cannot rewrite or replace
candidate text.

## CPU Pilot Authorization

The sole preregistered pilot is assistant-only SFT with preservation KL on CPU
using float32 parameters and compute, LoRA rank 16, alpha 32, zero dropout, all
seven Qwen3 projection module types, learning rate `3e-5`, one epoch, sequence
ceiling 1,024, micro-batch one, accumulation eight, effective batch eight,
fixed training and shuffle seeds, and checkpoints every 32 steps.

Only the declared final checkpoint is eligible. Intermediate checkpoints are
diagnostics and cannot support best-of-N selection. The authorization lock
binds source bytes, curriculum, lexical audit, holdout receipt, exclusion
index, semantic receipt, tombstone lineage, environment lock, training
program, exact recipe, stop rules, and a new external output root. It does not
start training.

Terminal stop rules include non-finite loss, eight consecutive loss increases,
72 hours, 64 GiB peak RSS, behavior pass rate below 0.80, preservation pass
rate below 0.95, or ordinary-helpfulness regression above 0.02. Failed adapter
bytes are terminally rejected. Retry requires a new preregistration and a
material method or data change.

No training authorization exists at this cutoff.

## Verification

The focused contract suite passes 17/17. It covers the real checked-in profile,
all 52 public evaluation cases, deterministic private sealing, public receipt
redaction, create-only evidence, wrong seed rejection, exact prompt leakage,
near-copy layers, entity substitution, declared and derived template overlap,
private and public answer leakage, semantic identity drift, immutable
tombstones, source/evaluation drift, duplicate JSON keys, passing lock issuance,
and failed-audit lock refusal.

Ruff 0.12.10 was used from an external tool directory. Its 37,883,392-byte
executable SHA-256 is
`2325ba9af12e5746658ce996e581e15f2d29a07103c62273dff97bd49b1c9bda`.
Both new Python files pass `ruff format --check` and `ruff check`.
`git diff --check`, JSON parsing, profile verification, and a bounded sensitive
pattern scan pass.

The broader Python tools suite excluding
`test_reference_raw_quality.py` passes 142 tests with nine declared skips. Full
discovery ran 164 tests and exposed one environment-only error:
`test_finite_topk_excludes_sampling_warper_sentinels` could not import optional
`torch`. The other discovered tests completed; no assertion was weakened and
the missing dependency was not converted into a skip or pass. This is not a
training-environment receipt.

## Explicit Unknowns And Next Gate

The following facts remain absent and must not be inferred:

- No 280-case private factor pack or secret seed has been produced or sealed.
- No 1,024-record pilot curriculum has been generated, independently reviewed,
  accepted, tombstoned, or frozen.
- No pinned semantic encoder artifact set or complete semantic comparison
  receipt exists.
- No deterministic CPU training environment lock or training authorization
  exists.
- No adapter has trained, merged, or passed an untouched behavioral screen.
- No qualified derivative has been converted to SLM2 or run through scalar
  native, WASM, acquisition, privacy, or browser tests.
- No site release gate has been completed by this change, so no deployment or
  publication is authorized.
- Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

The next action is to produce the private factor pack and immutable seed outside
Git, seal the 332-case exclusion closure, create the exact 1,024-record pilot
through independent generation and review lineage, run the complete lexical and
semantic audits, freeze the source and training environment outside the
protected tree, and request the CPU pilot lock. Training must not begin before
that lock is issued.

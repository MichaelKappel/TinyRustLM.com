# TinyRustLM Qwen3 Curriculum Review Integrity Memory

Date: 2026-08-20  
Branch: `codex/model-acquisition-v2`  
Implementation commit: `4ef8b6f3a8bdc45814727c75ca02d4781991ebf2`  
Frozen enterprise goal SHA-256:
`92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0`

## Scope And Truth Boundary

This milestone closes the curriculum record's former ability to self-assert a
reviewer count and decision hash. It implements a fail-closed, record-bound
review evidence graph for the preregistered Qwen3 0.6B working-model lane.

It does not create a pilot curriculum, review any real candidate, assemble or
seal private holdouts, authorize training, train an adapter, merge a model,
pass an untouched source screen, convert a qualified SLM2 artifact, run native
or WASM inference for a qualified model, or prove browser-local conversation.
Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

MemoryEndpoints remained unauthorized and disconnected. No credential, hosted
memory mutation, deployment, publication, or live campaign action occurred.

## Exact Checked-In Identities

- Control program: 159,048 bytes, SHA-256
  `586d2c1df28ca2bdf63335d954fe02817570853cc663da8164dbacc4308ee208`.
- Control tests: 66,806 bytes, SHA-256
  `4071ed903e774915a6dd4951e435385b8188e86d43a7e5cf5714389c61df79b3`.
- Preregistered profile: 12,091 bytes, SHA-256
  `1c540f44cd0b6b1c69625ad108c2ff1b6165a9361734fb0045eb20b9968c9b79`.
- Review rubric: 1,734 bytes, SHA-256
  `4d467026bd965e31ea5ea94cab1cf705901dbac2b4bc339a1963ccb6ad9b4060`.
- Lane README: 13,040 bytes, SHA-256
  `04c2b1784f582c0f533c497063d7226f137112ba734359c8b1d291a335b9353a`.

The profile still binds the exact Qwen3 ancestor revision and nine source
files, 1,024 pilot records, 200,000 scale records, 14 behavioral categories,
at least 98.5% positive help, at most 1.5% narrow boundaries, 280 private
holdouts, 52 current public evaluation exclusions, the sole CPU rank-16 LoRA
recipe, and fixed terminal stop rules. The unchanged ancestor remains
terminally rejected as a product model.

## Review Evidence Graph

The sole accepted review path now has four versioned schema families:

1. `tinyrustlm.curriculum_review_rubric.v1` defines the ordered checklist,
   valid statuses, valid decisions, always-required checks, no-fail acceptance,
   response-rewrite prohibition, and hidden-reasoning prohibition.
2. `tinyrustlm.curriculum_review_decision.v1` is one primary reviewer's exact
   decision for one immutable candidate.
3. `tinyrustlm.curriculum_review_adjudication.v1` is a third distinct actor's
   resolution of exactly one primary-review disagreement.
4. `tinyrustlm.curriculum_review_manifest.v1` binds the profile, current
   control program, curriculum, rubric, record order, two primary ledgers, and
   optional disagreement-only adjudication ledger.

Each review candidate is canonical JSON containing every curriculum field
except the derived `review` summary. Every decision line binds the review ID,
record ID, candidate SHA-256, exact messages SHA-256, exact response SHA-256,
rubric SHA-256, reviewer identity SHA-256, custody-domain SHA-256, ordered full
checklist, factual disposition, PII scan, license review, malicious-artifact
scan, and comment SHA-256.

Both primary ledgers must be separate files with distinct bytes, identities,
and custody domains. Each must cover every curriculum record exactly once and
in exact order. The manifest also commits to the ordered record-ID sequence.
Missing, extra, duplicated, or reordered rows are terminal audit errors.

Two accepts derive an accepted summary with two reviewers and no disagreement.
One accept plus one reject requires one adjudication row from a third identity
and third custody domain. Only an accepting adjudication derives an accepted
three-reviewer summary. Two rejects, a rejecting adjudication, missing
adjudication, adjudication when the primary reviewers agree, a reused identity
or custody domain, or a forged summary rejects the audit.

The final per-record `decision_sha256` is derived from a canonical closure
containing the review ID, record ID, immutable candidate, rubric, both primary
decision hashes, optional adjudication hash, and final decision. Curriculum
rows cannot select or invent that value.

## Storage And Replay Boundary

Review manifests and ledgers must use absolute non-reparse paths on `C:` or
`E:` outside the Git worktree. Exact-key schemas keep raw curriculum text out
of the manifest and review ledgers. The public-safe curriculum audit reports
only bounded IDs, hashes, counts, statuses, and finding classes.

The review manifest explicitly sets `training_authority: false`. A passing
review is one prerequisite, not authorization. `freeze-training-lock` now
requires the exact manifest as a file identity, requires the prior curriculum
audit to bind it, verifies that the audit was produced by the current control
program, and reopens the manifest and every ledger. Manifest, ledger, record,
or verifier drift after audit therefore prevents authorization.

There is no compatibility reader for the former self-asserted flow, no bulk
approval, no inferred reviewer, no repaired candidate, and no path that treats
missing review artifacts as a skip.

## New External Custody Plan

The profile and control-program changes invalidated the unsealed `v5` holdout
initialization. It remains preserved as rejected history. A create-only `v6`
initialization now exists at:

`E:\TinyRustLM-vnext-private\qwen3-working-model-v1\holdout-custody-v6`

Public plan evidence:

- Plan ID: `qwen3-working-model-holdout-custody-v6`.
- Plan bytes: 51,462.
- Plan SHA-256:
  `2a53f7bdd117f3de4d7507ee76554dd3e03f8d948e9caf7cfc44389ed8f42659`.
- Profile SHA-256:
  `1c540f44cd0b6b1c69625ad108c2ff1b6165a9361734fb0045eb20b9968c9b79`.
- Control-program SHA-256:
  `586d2c1df28ca2bdf63335d954fe02817570853cc663da8164dbacc4308ee208`.
- Slot-set SHA-256:
  `88598e47e0dc1eead6714c0eb43d094071bc442854e71e34ae2fc80c0597eb82`.
- Development template SHA-256:
  `cdae6a4d6e3bff1f674ee53686a1e6b141fc6cd13cdb11a713c4ce1a424f8d0c`.
- Independent-audit template SHA-256:
  `a781661308be52793f6830a80f5841d67926cb4e352431cad4a45bc97ccb1723`.
- Seed commitment:
  `11048f5de567e4393094e8a5d104b4f9bf9df94c1787a8e56cd3d9232bf37829`.
- Exact split: 140 development plus 140 independent-audit slots, ten per
  category per split.

The public plan contains no prompt variants, answer anchors, or seed. Both
templates remain `authoring-required`. No factor pack, custody receipt, seal,
or exclusion index exists. Distinct hashes are structural controls and do not
by themselves prove that two people or organizations are independent.

## Verification

The checked-in milestone passed:

- 41/41 focused Qwen3 working-model control tests;
- 166 maintained non-Torch Python tool tests, with nine declared skips;
- 68/68 `TinyRustLM.Package.Tests`, with zero skips;
- exact profile verification;
- Python compilation through test import and execution;
- Ruff 0.12.10 format and lint;
- `git diff --check`;
- external `v6` plan, template, split, status, byte, and hash readback;
- public-plan scan confirming no `prompt_variants` field.

Hostile review coverage includes missing manifest, foreign control-program
identity, same reviewer, same primary custody, incomplete ledger, candidate
hash drift after ledger rehash, missing adjudication, valid distinct
adjudication, reused adjudicator identity, unnecessary adjudication, forged
derived summary after curriculum and manifest rehash, and post-audit manifest
drift at training-lock issuance.

The optional-Torch test module remains honest environment evidence. Its direct
run executed 24 tests: 23 passed and one errored because `torch` is not
installed. That error was not converted into a skip or pass. The review-control
scope does not import Torch.

## Remaining Work And Blockers

1. Two genuinely separate authorized authors must complete the 140-slot
   development and 140-slot independent-audit `v6` templates. This agent must
   not impersonate either custody.
2. The contributions must be assembled, independently reviewed for real
   custody, and sealed before the private exclusion index exists.
3. The 1,024-record pilot curriculum and raw teacher-output lineage must be
   materialized outside Git.
4. Two complete primary review ledgers must be produced under separate
   identities and custody domains. A third ledger is allowed only for actual
   disagreements.
5. Lexical, structural, template, answer, tombstone, and complete blinded
   semantic contamination audits must pass.
6. Environment, trainer, source, curriculum, review, holdout, semantic, and
   tombstone identities must be frozen before a CPU pilot lock can be issued.
7. Training, merge, untouched derivative screening, deterministic SLM2
   conversion, scalar/WASM conformance, P2P-or-convert acquisition, and genuine
   browser-local multi-turn chat remain subsequent evidence gates.

The next independently actionable engineering work is to implement and test
the pinned CPU pilot trainer and environment lock without issuing an
authorization. The private holdout and human review gates remain externally
blocked until genuinely separate contributions arrive.

# Qwen3 0.6B Working-Model Lane v1

Storage correction, September 12: model sources and training outputs belong only
under `D:/LLMs/TinyRustLM`. The producer and trainer enforce this independently.
The complete source now passes this training profile's nine-file check after its
license and model card were consolidated beside the weights. The composition
converter's separate source lock expects a different license hash; that mismatch
remains unresolved. This is no conversion or model-quality result. Compact proof:
`artifacts/ecosystem-cleanup-20260912/canonical-training-source-review.json`.
Historical environment measurements below do not authorize the changed tools.

This directory preregisters the only authorized training lane for the first
real TinyRustLM working-model vertical slice. It does **not** contain a trained
adapter, merged checkpoint, passing source screen, converted model, or product
qualification. Those claims remain false until their own hash-bound receipts
exist.

The unchanged `Qwen/Qwen3-0.6B` checkpoint at revision
`c1899de289a04d12100db370d81485cdf75e47ca` remains terminally rejected as a
product model. Its only permitted role here is the provenance-clean ancestor of
a new derivative. The exact nine-file source inventory is frozen in
`profile.v1.json`; a file-name match or mutable repository branch is not enough.

## Frozen Curriculum

The CPU pilot contains exactly 1,024 accepted records. A later scale corpus
contains exactly 200,000 accepted records and must preserve the same
distribution:

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

At least 98.5% of records must be positive, substantive help. Narrow concrete
boundaries may occupy no more than 1.5%. Every category declares four scenario
factors and the pilot must realize at least three distinct values for every
factor. Entity, authority, resource, unit, discourse, and turn-state changes
are data dimensions rather than ad hoc paraphrase labels.

Every candidate record binds its source lineage, license, teacher revision,
sampling profile, seed, and raw teacher output. Hidden teacher reasoning is
prohibited. Raw rejected drafts remain external evidence and may not be
silently repaired into accepted records.

## Distinct Curriculum Review

The exact 1,734-byte review rubric is checked in as
`review-rubric.v1.json` at SHA-256
`4d467026bd965e31ea5ea94cab1cf705901dbac2b4bc339a1963ccb6ad9b4060`.
The profile binds that identity and requires all substantive-help,
instruction-following, hidden-reasoning, and malicious-artifact checks on
every candidate, plus task-specific checks for practical constraints, source
authority, current-turn precedence, untrusted data, multi-turn continuity,
lawful adult directness, factual accuracy, summary/rewriting fidelity,
structured output, and code correctness.

Review is performed over the immutable canonical projection of each curriculum
record with only its derived `review` summary removed. Every primary decision
line binds the exact review ID, record ID, candidate hash, message hash,
response hash, rubric hash, reviewer-identity hash, custody-domain hash,
ordered complete checklist, factual disposition, PII/license/malicious scan
results, and comment hash. A ledger must cover every curriculum record exactly
once and in exact order. Two primary ledgers must use different files,
different bytes, different reviewer identities, and different custody domains.

Two accepts derive a two-reviewer acceptance summary. One accept and one reject
require a third ledger whose adjudicator identity and custody domain differ
from both primary reviewers; only an accepting adjudication permits the record
to remain. Two rejects, a rejecting adjudication, missing adjudication,
unnecessary adjudication, bulk or incomplete review, response drift, candidate
drift, checklist drift, and a self-authored summary all reject the audit.

The external review manifest binds the exact profile, current control-program
bytes, curriculum, rubric, record order, both primary ledger files, and the
optional disagreement-only adjudication ledger. It has no training authority
and contains no raw curriculum. All review manifests and ledgers must use
absolute, non-reparse paths outside Git. Use the owned training area under
`D:/LLMs/TinyRustLM/training/qwen3-working-model-v1` for new model-related evidence. The audit
reports only bounded identities and counts, and the training-lock verifier
reopens every artifact instead of trusting the earlier report.

## Distinct Holdout Custody

Private holdouts do not begin as an untracked factor pack. The only accepted
path first creates an immutable slot plan, two incomplete contribution
templates, and a private 32-byte selection seed outside Git:

```powershell
py -3 tinyrustlm/tools/qwen3-working-model-controls.py `
  initialize-holdout-custody `
  tinyrustlm/training/qwen3-0.6b-working-model-v1/profile.v1.json `
  qwen3-working-model-holdout-custody-v6 `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/holdout-custody-v6
```

The development author and independent-audit author must receive separate
copies of their template. They must produce new `status: complete`
contribution files; the initialized templates are evidence and must not be
overwritten. Each completed case must provide a globally unique template
family, at least four normalized-distinct prompt variants, at least three
normalized-distinct answer-anchor variants, the exact required scenario
factors, and explicit entity surfaces. The two contributions must bind
different author-identity hashes and different custody-domain hashes.

Assembly is create-only and refuses missing or reordered slots, profile or
program drift, unfinished templates, duplicate prompts, duplicate template
families, insufficient factor diversity, a shared author identity, or a shared
custody domain.

Distinct hashes are necessary structural evidence, not proof that two people
or organizations are independent. The completed contributions still require
authorized custody review before their receipt can support an independent-audit
claim.

```powershell
py -3 tinyrustlm/tools/qwen3-working-model-controls.py `
  assemble-holdout-contributions `
  tinyrustlm/training/qwen3-0.6b-working-model-v1/profile.v1.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/holdout-custody-v6/holdout-custody-plan.public.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/development-contribution-complete.private.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/independent-audit-contribution-complete.private.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/holdout-assembly-v1
```

The current public-safe `v6` plan is 51,462 bytes at SHA-256
`2a53f7bdd117f3de4d7507ee76554dd3e03f8d948e9caf7cfc44389ed8f42659`.
It binds profile SHA-256
`1c540f44cd0b6b1c69625ad108c2ff1b6165a9361734fb0045eb20b9968c9b79`,
control-program SHA-256
`586d2c1df28ca2bdf63335d954fe02817570853cc663da8164dbacc4308ee208`,
slot-set SHA-256
`88598e47e0dc1eead6714c0eb43d094071bc442854e71e34ae2fc80c0597eb82`,
140 development slots, 140 independent-audit slots, and a seed commitment.
It contains no raw prompt, answer anchor, or seed. Both contribution templates
remain `authoring-required`; therefore no factor pack, holdout seal, audit
result, or training authority exists. Earlier local `v1` through `v5`
initialization directories are preserved as invalidated history and are not
accepted by the current profile and control-program identities.

## Sealed Exclusions

The private holdout set contains exactly 280 cases: 20 per curriculum family,
with 140 development cases and 140 independently audited cases. Each case has
at least four prompt variants and three answer-anchor variants. A private
32-byte seed selects one variant per case with HMAC-SHA-256.

The checked-in profile also binds all 52 cases in the current 11
assistant-quality evaluation fixtures. Changing any fixture byte invalidates
the profile. The sealer combines those public cases with the 280 private cases
to produce a 332-case hash-only exclusion index.

Raw holdout prompts, answer anchors, entities, and the seed live outside Git on
`D:/LLMs/TinyRustLM/training/qwen3-working-model-v1`. The public receipt contains commitments, hashes, counts, and
algorithm identities only. It contains no prompt, expected term, seed, private
path, credential, or model byte.

Run the sealer only into a new external directory:

```powershell
py -3 tinyrustlm/tools/qwen3-working-model-controls.py seal-holdouts `
  tinyrustlm/training/qwen3-0.6b-working-model-v1/profile.v1.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/holdout-assembly-v1/factor-pack.private.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/holdout-custody-v6/holdout-seed.private.bin `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/holdout-assembly-v1/holdout-custody-receipt.public.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/evidence/holdout-seal-v1
```

The command refuses an existing output directory, a symlinked input, an output
inside the worktree, a disallowed storage location, a wrong seed size, category
or split drift, malformed or unpinned evaluation fixtures, a factor pack not
bound by the custody receipt, a seed outside the custody commitment, or a
custody receipt from another control-program identity. There is no direct
factor-pack-to-sealer compatibility path.

## Contamination Gate

The curriculum audit is fail-closed across these independent layers:

1. Unicode NFKC, case folding, apostrophe folding, punctuation normalization,
   and exact normalized prompt identity.
2. Character 13-gram containment.
3. Token 5-gram containment.
4. Entity-substituted token 4-gram containment.
5. Declared template-family identity.
6. A derived entity- and number-normalized template signature.
7. Exact private answer anchors and public evaluation answer terms.
8. Answer token 3-gram containment.
9. A separately executed, pinned semantic-encoder audit over every
   curriculum/exclusion pair.
10. Immutable tombstones that prevent a removed record's exact bytes from
    reappearing.

The semantic receipt must bind the curriculum and exclusion-index bytes,
encoder repository and immutable revision, complete comparison count, review
thresholds, maximum similarity, independent auditor identity, transcript, and
development-team blinding. Similarities from 0.76 through 0.84 require review;
0.84 and above reject. An opaque judge is not authoritative and a judge may
not rewrite candidate text.

```powershell
py -3 tinyrustlm/tools/qwen3-working-model-controls.py audit-curriculum `
  tinyrustlm/training/qwen3-0.6b-working-model-v1/profile.v1.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/pilot-curriculum.jsonl `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/pilot-review-manifest.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/evidence/holdout-seal-v1/exclusion-index.private.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/evidence/semantic-audit-v1/receipt.json `
  D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/evidence/curriculum-audit-v1.json `
  --tombstones D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/tombstones.jsonl
```

## CPU Pilot Lock

Training is unauthorized until `freeze-training-lock` succeeds. The request
must bind the nine exact source files, tokenizer and chat-template-bearing
configuration, curriculum, curriculum review manifest, contamination audit,
holdout receipt, exclusion index, semantic receipt, tombstone lineage,
environment lock, and training program. The lock verifier reopens both review
ledgers and any adjudication ledger and requires the current control program.
Model sources and new training output directories must be inside
`D:/LLMs/TinyRustLM`; both lock issuance and the trainer independently enforce
this boundary. C:, E:, X:, sibling-prefix aliases and linked model paths reject.

The sole pilot recipe is assistant-only SFT with preservation KL, float32 CPU
compute, rank-16 LoRA over all seven Qwen3 projection types, one epoch, an
effective batch of eight, fixed seeds, and a final-checkpoint-only eligibility
rule. Intermediate checkpoints are diagnostics. Best-of-N checkpoint choice,
response repair, retry selection, and promotion of unchanged base bytes are
forbidden.

Terminal stop conditions include non-finite loss, eight consecutive loss
increases, the 72-hour wall-clock bound, the 64-GiB RSS bound, failure to reach
the preregistered behavior and preservation floors, or more than a 2%
ordinary-helpfulness regression. Failed adapter bytes are terminally rejected.
A retry requires a new preregistration and a material method or data change.

## Pinned CPU Environment

`cpu-environment.v1.json` is the sole CPU-pilot environment specification. It
pins CPython 3.12.10 on Windows AMD64, ten root distributions and their exact
PyPI wheel bytes, the complete-runtime constraints, offline environment
variables, CPU float32 execution, deterministic PyTorch algorithms, eight
intra-operation threads, one inter-operation thread, AdamW, assistant-only
SFT plus preservation KL, no sequence packing, no truncation, and an explicit
positive-rate final optimizer update. The checked-in specification is 4,622
bytes at SHA-256
`635d198495ba1e3c4c8954ba27bc2d25dea2159ff96210b67943623d4886aed2`.

The external v2 wheelhouse manifest binds all 39 transitive wheel artifacts.
It is 10,151 bytes at SHA-256
`c69cdc8bc3e1c8dc40ac7bbb85d27307ba24f526ac0ad25575eaa4000fcefd46`;
its artifact-set SHA-256 is
`f5ffe27669384075d514d27fab2f6d06f00badc22c2c8ff113bb6618b56a7ece`.
The wheels occupy 170,527,657 bytes. Source distributions, editable installs,
system site packages, unowned distributions, CUDA builds, and the forbidden
package set are rejected.

The historical external v3 environment lock is 17,964 bytes at SHA-256
`68c36c8492c59c0006e3bfa018b0d84dbc1832379733512c4e979b9a17ac49eb`.
It binds every installed distribution file, distribution-set SHA-256
`ae837c77159fce892b1626d947dc390a86f5d530fd5fe45f7890b905bf8db707`,
the virtual-environment interpreter and `pyvenv.cfg`, the CPU/platform
identity, the wheelhouse manifest, `pip check`, runtime imports, and the exact
134,232-byte trainer at SHA-256
`aded5f91db040008685a506e6a59e09593b68bdb69688095fa0aef8db8e0c50b`.
The lock says `training_authority: false`. The v1 wheelhouse manifest and v1/v2
environment locks remain immutable invalidated history after the scheduler and
trainer changed.

Use freshly bound outputs whenever the specification or trainer changes. The
paths below describe the intended canonical layout; this cleanup has not created
that environment or a training authorization. Historical locks do not authorize
the changed trainer. Retain compact outcome evidence and remove superseded
model/checkpoint copies after verifying their replacement:

```powershell
$python = 'D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/environment/venv/Scripts/python.exe'
$trainer = 'tinyrustlm/tools/qwen3-working-model-trainer.py'
$profile = 'tinyrustlm/training/qwen3-0.6b-working-model-v1/profile.v1.json'
$environment = 'tinyrustlm/training/qwen3-0.6b-working-model-v1/cpu-environment.v1.json'
$tools = 'D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/environment'

& $python $trainer seal-wheelhouse `
  $environment "$tools/wheelhouse" "$tools/wheelhouse-manifest.v4.json"

& $python $trainer capture-environment `
  $environment $profile "$tools/wheelhouse-manifest.v4.json" `
  "$tools/environment-lock.v4.json"

& $python $trainer verify-environment `
  $environment $profile "$tools/environment-lock.v4.json"
```

The separate bootstrap wheelhouse and bootstrap site are installation tools,
not members of the captured training environment and not training evidence.

## Authorized Trainer Operation

`qwen3-working-model-trainer.py` verifies its own exact bytes before any ML
package import. On the training path it applies the frozen environment and
installs a Python audit hook that rejects socket creation, binding, name
resolution, connection, sending, and child-process launch before probing or
loading ML packages. It then rehashes the environment, source checkpoint,
curriculum, and training-lock bindings for those inputs. The model and
tokenizer load from the exact local nine-file source with `local_files_only=True` and
`trust_remote_code=False`.

The trainer uses one seeded curriculum order, assistant-only targets,
Qwen3 non-thinking chat rendering, no truncation, rank-16 LoRA across all
seven projection types, same-base adapter-disabled preservation KL, cumulative
full-run metrics, preregistered stop rules, and final-checkpoint-only candidate
selection. Complete checkpoints bind safe adapter bytes, optimizer state,
RNG state, cumulative metrics, and the prior checkpoint receipt. Interrupted
checkpoint or candidate staging must be moved, without deletion, into the
owned `interrupted/` archive by the explicit quarantine command. A completed
candidate can recover a missing top-level receipt idempotently. A terminal
decision is durable before rejected adapter preservation starts and can never
be resumed.

After the independent custody, curriculum, review, contamination, semantic,
and training-lock gates exist, run the exact authorized inputs:

```powershell
$lock = 'D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/evidence/training-lock-v1.json'
$source = 'D:/LLMs/TinyRustLM/sources/Qwen/Qwen3-0.6B/c1899de289a04d12100db370d81485cdf75e47ca'
$curriculum = 'D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/private/pilot-curriculum.jsonl'
$environmentLock = 'D:/LLMs/TinyRustLM/training/qwen3-working-model-v1/environment/environment-lock.v3.json'

& $python $trainer verify-training-lock `
  $profile $lock $environment $environmentLock $source $curriculum

& $python $trainer train `
  $profile $lock $environment $environmentLock $source $curriculum
```

After an interruption, preserve staging first if the trainer requires it, then
request explicit verified resume:

```powershell
& $python $trainer quarantine-interrupted-output `
  $profile $lock $environment $environmentLock $source $curriculum

& $python $trainer train `
  $profile $lock $environment $environmentLock $source $curriculum --resume
```

Environment capture, environment verification, training-input verification,
checkpoint completion, or candidate production is not a model-quality claim.
The merged derivative must still pass the untouched source screen and every
downstream SLM2/runtime/browser gate.

## Current Status

- Profile, rubric, and review-control implementation: implemented and tested
  locally.
- Private custody plan: initialized with 280 empty authoring slots; distinct
  contributions remain outstanding.
- Private 280-case factor pack: not assembled or sealed.
- Pilot curriculum and two-reviewer ledgers: not yet materialized or reviewed.
- Semantic audit: not run.
- Pinned CPU wheelhouse manifest v2 and environment lock v3: captured and independently
  reverified locally; neither grants training authority.
- Sole CPU trainer and hostile contract tests: implemented; 47 focused trainer
  tests and 88 combined control/trainer tests, Ruff lint, Ruff formatting, and
  the offline ML import probe pass locally.
- CPU pilot authorization: not issued because the custody, curriculum,
  review, exclusion, and semantic artifacts remain incomplete.
- Adapter training and merge: not run.
- Untouched derivative source screen: not run.
- SLM2 conversion and native/WASM inference: not run for a qualified model.
- Browser-local conversation: not run with a qualified model.
- Larger campaign counters: unchanged at zero.

This status is intentionally conservative. Structural tooling is evidence of a
control plane, not evidence of model quality.

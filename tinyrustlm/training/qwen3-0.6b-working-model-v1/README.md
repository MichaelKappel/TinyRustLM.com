# Qwen3 0.6B Working-Model Lane v1

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

Every accepted record binds its source lineage, license, teacher revision,
sampling profile, seed, raw teacher output, review rubric, review decision,
factual disposition, PII scan, license review, and malicious-artifact scan.
Hidden teacher reasoning is prohibited. Raw rejected drafts remain external
evidence and may not be silently repaired into accepted records.

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
`C:` or `E:`. The public receipt contains commitments, hashes, counts, and
algorithm identities only. It contains no prompt, expected term, seed, private
path, credential, or model byte.

Run the sealer only into a new external directory:

```powershell
py -3 tinyrustlm/tools/qwen3-working-model-controls.py seal-holdouts `
  tinyrustlm/training/qwen3-0.6b-working-model-v1/profile.v1.json `
  E:/TinyRustLM-vnext-private/qwen3-working-model-v1/factor-pack.private.json `
  E:/TinyRustLM-vnext-private/qwen3-working-model-v1/holdout-seed.private.bin `
  E:/TinyRustLM-vnext-evidence/qwen3-working-model-v1/holdout-seal-v1
```

The command refuses an existing output directory, a symlinked input, an output
inside the worktree, a non-`C:`/`E:` Windows drive, a wrong seed size, category
or split drift, and malformed or unpinned evaluation fixtures.

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
  E:/TinyRustLM-vnext-private/qwen3-working-model-v1/pilot-curriculum.jsonl `
  E:/TinyRustLM-vnext-evidence/qwen3-working-model-v1/holdout-seal-v1/exclusion-index.private.json `
  E:/TinyRustLM-vnext-evidence/qwen3-working-model-v1/semantic-audit-v1/receipt.json `
  E:/TinyRustLM-vnext-evidence/qwen3-working-model-v1/curriculum-audit-v1.json `
  --tombstones E:/TinyRustLM-vnext-private/qwen3-working-model-v1/tombstones.jsonl
```

## CPU Pilot Lock

Training is unauthorized until `freeze-training-lock` succeeds. The request
must bind the nine exact source files, tokenizer and chat-template-bearing
configuration, curriculum, contamination audit, holdout receipt, exclusion
index, semantic receipt, tombstone lineage, environment lock, and training
program. The output root must be a new external `C:` or `E:` directory.

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

## Current Status

- Profile and control implementation: implemented and tested locally.
- Private 280-case factor pack: not yet sealed.
- Pilot curriculum: not yet materialized or reviewed.
- Semantic audit: not run.
- CPU pilot authorization: not issued.
- Adapter training and merge: not run.
- Untouched derivative source screen: not run.
- SLM2 conversion and native/WASM inference: not run for a qualified model.
- Browser-local conversation: not run with a qualified model.
- Larger campaign counters: unchanged at zero.

This status is intentionally conservative. Structural tooling is evidence of a
control plane, not evidence of model quality.

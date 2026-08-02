# Qwen3 Cognitive Liberty V3 Preference-Provenance Audit

Date: 2026-07-18

Status: `not-authorized-for-preference-training`

## Executive Decision

The frozen 100-record Qwen3 Cognitive Liberty v3 corpus remains valid SFT
input under its existing provenance, but it does not contain authoritative
pairwise preference labels. No DPO, ORPO, or equivalent chosen/rejected
training run is authorized from the retained draft and final-response files.

An approved final response does not, by itself, label the corresponding teacher
draft as a rejected alternative. This is true even when the two texts differ.
The existing decision schema records SFT review dispositions and checklist
results; it has no pairwise comparison, preference strength, tie, or explicit
rejection-of-alternative field.

## Reproducible Evidence

The text-free machine report is:

`artifacts/training/qwen3-cognitive-liberty-v3/preference-provenance-audit-v1.json`

- File SHA-256:
  `a9b9bffb58d245d8f23174446f9b088be0d0190e2f33df4cd102cd2212e694d9`
- Canonical audit-content SHA-256:
  `sha256:c1b18c47e11aa8396eedee8c3f728b8f04f7dfc50fbd446debda3c8f400fac61`
- Control SHA-256:
  `sha256:b4618aa8395b01ca7a7ffa8c345c595e07eed109da22fb72e59bd688d088c075`
- Audit tool SHA-256:
  `sha256:b3cee1d5d20ab6c1e81f732bdd8e53a6a6bf945398fb85caba51ade04b9dab21`
- Frozen dataset-manifest SHA-256:
  `sha256:d91ee7c2eddeb30771c307184d847580f21a8f3344b09ec7cce5c9a1d4bf0b38`

The audit reopens and rehashes the frozen dataset manifest, every selected
response file, three draft manifests, all corresponding draft files, three
decision sets, and three reviewed exports. It rejects hash drift, source-record
mapping drift, unapproved exports, and reviewed-response drift. The report
contains counts, stable source IDs, repository-relative paths, and hashes only;
it contains no prompt text, response text, raw model output, credential, or
private absolute path.

## Observed Facts

- All 100 frozen records map to approved reviewed exports.
- Forty selected records come from the practical Qwen3 bundle; all forty final
  responses differ from their retained teacher drafts.
- Sixty selected records come from the quality-sequence bundle; sixteen final
  responses differ from their drafts and forty-four are byte-identical.
- The combined frozen corpus therefore has 56 edited draft/final differences
  and 44 unchanged draft/final records.
- The two selected reviewer IDs are
  `tinyrustlm-agent-cognitive-liberty-review-v2` for 40 records and
  `tinyrustlm-agent-reviewer` for 60 records.
- There are zero explicit pairwise preference decisions and zero eligible
  preference pairs.
- The earlier quality-sequence bundle has two explicit rejections. Both drafts
  ended with `finish_reason=length`.
- The recovery bundle has approved records with the same two record IDs and
  prompt hashes, but both recovery response contracts differ from the rejected
  contracts. They are not matched same-contract preference pairs.
- Two changed-contract recovery examples are also far too few to justify a
  preference-optimization claim.

## Line-Ending Finding

Ninety-one frozen response files match reviewed response bytes exactly. Nine
multiline response files are CRLF materializations of LF reviewed strings. The
audit accepts only the explicit, lossless CRLF-to-LF equivalence after first
rejecting lone carriage returns; it reports both match classes separately.

The historical frozen files and their receipts remain unchanged. The dataset
writer now writes exact UTF-8 bytes rather than using platform newline
translation, so future prompt, response, history, source-manifest, and receipt
materialization is byte-stable across Windows and Linux. The writer regression
suite asserts that generated artifacts contain no carriage returns. Any future
dataset copied into Git must additionally receive an LF-preserving path rule
before freeze; this change does not rewrite historical hashes.

## Verification

Executed locally with Python 3.12:

```text
py -3.12 -m unittest tinyrustlm.tools.tests.test_audit_distillation_preference_provenance -v
7 tests passed

py -3.12 -m unittest tinyrustlm.tools.tests.test_prepare_distillation_dataset -v
8 tests passed
```

The preference audit tests cover exact and edited targets, explicit CRLF
classification, lone-CR rejection, frozen response drift, decision-to-draft
hash drift, unmapped source rejection, content-hash validation, and atomic
report replacement.

## Required Next Gate

If preference training remains desirable, create a separate hash-bound review
schema that presents a chosen and rejected response together, records an
explicit human pairwise decision or tie, binds the exact prompt and response
contract, and excludes all fixed, seeded, shadow, and sealed evaluation
families. Until that review is complete, the edited drafts are audit material,
not DPO or ORPO training data.

The existing 42 role-history and 668 expanded-corpus handoffs remain separate
SFT review gates. Their agent suggestions do not constitute human approval and
must not be repurposed as preference labels.

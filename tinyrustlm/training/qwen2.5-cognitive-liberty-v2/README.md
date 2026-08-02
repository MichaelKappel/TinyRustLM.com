# Qwen2.5 Cognitive Liberty Expanded Corpus v2

This lane addresses the demonstrated limit of the reviewed 100-record corpus.
It does not admit public responses directly. A pinned Apache-2.0 Hugging Face
dataset supplies balanced prompt seeds; TinyRustLM then regenerates answers with
the pinned local teacher, requires explicit hash-bound review, freezes the
combined dataset against all evaluation exclusions, and trains only from that
frozen result.

`public-prompt-import-control.local.json` selects 20 prompts from each of 20
everyday topics and four prompts from each of 43 elementary-science topics. The
572 records are deterministic by source revision, row index, seed, and content.
Exact duplicates, high-overlap near duplicates, and any prompt sharing a
five-word sequence with excluded evaluations are rejected before selection.

The public prompt bundle is not a dataset and is not training-approved. Local
teacher generation is complete, but record-level human review is not. Existing
TinyRustLM constraint, conflict, latest-intent, untrusted-memory, lawful inquiry,
and boundary examples remain a separately reviewed correction source when the
expanded frozen corpus is assembled.

## Current review checkpoint

Agent inspection covers all 668 generated drafts. Nineteen immutable suggestion
sources propose 428 rewrites and 14 redundant-row rejections; 226 original
answers were inspected and retained as useful pending candidates. This coverage
does not approve any record.

The current assisted workbooks are:

- targeted: `D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/targeted-agent-assisted-review-v5-high-risk`
- public: `D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/public-agent-assisted-review-v15-everyday-quality`

The combined pending-answer audit is
`D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/expanded-pending-answer-audit-v20-everyday-quality`.
Strict and exploratory semantic views are in the corresponding v20 `0.90` and
v21 `0.85` audit directories. Both assisted workbooks still contain only
`pending` decisions, reviewer placeholders, and pending checklist fields.

The next gate is explicit human disposition of all 668 records and both
semantic views. Only an approved-only export may be re-audited and frozen; no
pending workbook, agent proposal, or audit report has training authority.

## Human review handoff

The deterministic review handoff is:

`D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/expanded-human-review-handoff-v1-668`

Its manifest SHA-256 is
`fb4d9da0124e796a08de182a722317d6d83bc47dace9714644b64ff26e0d84df`.
It contains 668 unique records in 27 batches of at most 25 rows and occupies
about 2.7 MiB. All 668 actions and checklist fields remain pending.

### Local review workstation

Use the separate loopback-only workstation for normal review. It does not alter
the locked TinyRustLM public interface and does not make any network request:

```powershell
$python = 'D:/LLMs/TinyRustLM/training-env-py312/Scripts/python.exe'
& $python tinyrustlm/tools/human-review-workstation.py `
  D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/expanded-human-review-handoff-v1-668
```

The command validates the complete handoff, binds a random session URL only to
`127.0.0.1`, and opens that URL in the default browser. Use `--no-open` when the
URL should only be printed. The workstation presents the exact prompt,
requirements, original draft, candidate, agent evidence, automated findings,
semantic references, and source hashes beside one explicit decision form.

There is no bulk approval and no inferred checklist state. A save updates only
the selected decision row, validates it with the same fail-closed merger rules,
checks the decision-file SHA-256 for concurrent edits, flushes a same-directory
temporary file, and atomically replaces the decision file. A stale browser tab
receives a conflict instead of overwriting newer work. Immutable review batches
are never edited, and no credential or browser state is persisted in the
handoff. The optional reviewer ID convenience is held only in that tab's
`sessionStorage`.

Stop the workstation with `Ctrl+C`. Then create a new versioned aggregate
checkpoint with `--audit-human-review` as shown below. The workstation's live
counts are operational feedback, not a durable receipt and not training
authority.

For each batch, `review-batch-NNNN.jsonl` is immutable evidence. It contains the
exact prompt, response requirements, original draft, agent candidate, rationale,
risk findings, semantic-cluster references, and source hashes. Edit only the
matching `decision-batch-NNNN.jsonl` file:

- `approve` preserves the candidate response exactly.
- `rewrite` supplies a distinct, non-empty reviewed response.
- `reject` carries an empty reviewed response and identifies at least one failed
  checklist field.
- `reviewer_id` must be a real stable ASCII slug, and `review_note` must record
  explicit review evidence rather than retain the pending text.
- Every checklist field must be `pass` for `approve` or `rewrite`; no resolved
  action may retain a `pending` field.

At any checkpoint, validate partial work and write a text-free aggregate report:

```powershell
py -3.12 tinyrustlm/tools/triage-distillation-review.py `
  D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/expanded-human-review-handoff-v1-668 `
  --audit-human-review `
  --output-dir D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/expanded-human-review-progress-N
```

Use a new versioned output directory for each checkpoint. The audit reconstructs
the same source, semantic, batch, and candidate bindings used by final merge. It
accepts explicit valid decisions plus untouched pending templates, reports
per-batch and aggregate counts/hashes without record IDs or text, and rejects a
pending row if any editable field changed before an explicit action was chosen.

The merger reopens every assisted workbook and semantic audit, reconstructs the
immutable batches, rejects stale or incomplete decisions, and emits the existing
per-campaign review schema consumed by `export-reviewed`:

```powershell
py -3.12 tinyrustlm/tools/triage-distillation-review.py `
  D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/expanded-human-review-handoff-v1-668 `
  --merge-human-review `
  --output-dir D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/expanded-human-review-completion-v1-668
```

The untouched handoff intentionally fails this command and leaves no partial
output. A successful completion receipt still has no training authority; its
next gate is per-campaign `export-reviewed`, followed by corpus, contamination,
provenance, duplication, and semantic audits before freeze or training.

## Resumable local collection

Use `prepare-distillation-teacher-corpus.py` with a checkpoint directory for
long-running local teacher campaigns:

```powershell
python tinyrustlm/tools/prepare-distillation-teacher-corpus.py collect `
  tinyrustlm/training/qwen2.5-cognitive-liberty-v2/collection-control-targeted-corrections-v1.local.json `
  D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/targeted-corrections-v1-drafts `
  --checkpoint-dir D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/targeted-corrections-v1-checkpoint
```

```powershell
python tinyrustlm/tools/prepare-distillation-teacher-corpus.py collect `
  tinyrustlm/training/qwen2.5-cognitive-liberty-v2/collection-control-public-rehearsal-v1.local.json `
  D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/public-rehearsal-v2-drafts `
  --checkpoint-dir D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/public-rehearsal-v2-checkpoint
```

The checkpoint binds every response to the exact control, request, prompt plan,
teacher weight, tokenizer, system prompt, seed, and response hashes. It stores no
endpoint credentials. Existing records are fully revalidated before another
teacher call, and a complete checkpoint can rebuild an unpublished draft bundle
without querying the teacher. Checkpoints and draft bundles remain explicitly
not training-approved; `export-reviewed` still requires complete, hash-bound
human review decisions before any record can enter the frozen dataset.

Create the pending review workbook only after `validate-drafts` passes:

```powershell
python tinyrustlm/tools/prepare-distillation-teacher-corpus.py prepare-review `
  D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/targeted-corrections-v1-drafts `
  D:/LLMs/TinyRustLM/qwen2.5-cognitive-liberty-v2/targeted-corrections-v1-review-v2
```

The generated `review-context.jsonl` presents each exact prompt, response
contract, seed, finish reason, and draft beside its hashes.
`review-decisions.jsonl` starts every record at `pending` and preloads the draft
solely as editable review material. `export-reviewed` fails closed until every
pending decision, reviewer placeholder, and checklist is explicitly resolved.

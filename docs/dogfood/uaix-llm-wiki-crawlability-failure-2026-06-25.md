# UAIX And LLM Wiki Crawlability Dogfood 2026-06-25

## Trigger

During Runtime.MiRust.com report intake, 23 reports were preserved into raw evidence and synthesized into durable LLM Wiki Markdown. The first pass kept `.uai/long-term-memory.uai` pointer-only and created useful wiki files, but under-populated typed `.uai` files. The human correctly flagged that the report intelligence had not really made it into the active `.uai` memory layer.

## Failure

The system treated "do not store durable report bodies in `.uai/long-term-memory.uai`" as if it also meant "keep `.uai` thin." That is wrong.

Pointer-only does not mean hot-memory-poor. A strong UAIX project needs both:

- durable wiki/docs files for reviewed long-form memory
- typed `.uai` synthesis files that make the durable memory crawlable, triageable, and actionable from startup

## Why The Wiki Felt Weak

The wiki was durable but not sufficiently crawlable from agent startup. A cold agent could see that report files existed, but it still had to open too much Markdown to understand:

- what themes the reports covered
- which reports duplicated each other
- which recommendations were forbidden by the active TinyRustLM prompt
- which ideas should influence architecture now
- which ideas were only future comparison pressure
- which next tests or invariants the reports implied

That makes the wiki feel like storage, not operational memory.

## Guidance To Feed Back To UAIX.org

UAIX and LLM Wiki setup guidance should require a three-layer memory handoff for report batches:

1. Raw evidence preservation with checksums.
2. Durable thematic wiki/docs synthesis.
3. Hot typed `.uai` synthesis that tells agents what to do with the durable memory.

The third layer is the missing piece. It should be required, not optional.

## Proposed UAIX Rule Text

When processing a report batch, `.uai/long-term-memory.uai` must remain pointer-only, but the project must also populate typed hot-memory files with routing summaries, distilled constraints, current implementation relevance, rejected recommendations, next testable invariants, and dogfood findings. A future agent should be able to choose the next three files to open from `.uai` alone.

## Proposed LLM Wiki Crawlability Requirements

- Every durable wiki report cluster needs a hot `.uai` synthesis route.
- The hot synthesis must include source count, duplicate groups, theme clusters, authority boundaries, and immediate next actions.
- Durable wiki pages should include "Use this when..." routing text near the top.
- Report-derived recommendations that conflict with active constraints must be marked as future comparison or quarantined guidance.
- The setup wizard should ask whether the project needs a hot `.uai` synthesis file, not merely a long-term pointer ledger.
- The validator should flag report batches that create wiki files but do not update typed `.uai` summaries.

## Dogfooded Correction In This Repository

The correction added:

- `.uai/report-synthesis.uai`
- enriched `.uai/architecture.uai`
- enriched `.uai/coding-standards.uai`
- corrected `.uai/operations.uai`
- updated `.uai/startup-packet.uai`
- updated `.uai/index.uai`
- updated `.uai/workspace-guidance.uai`

The durable wiki remains useful, but `.uai` now carries enough report-derived operating memory for a cold agent to route intelligently before deep-loading Markdown.

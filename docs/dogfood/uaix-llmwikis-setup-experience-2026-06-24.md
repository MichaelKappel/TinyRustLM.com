# UAIX And LLMWikis Setup Dogfood

Date: 2026-06-24
Project: Runtime.MiRust.com

## What Worked

The combined UAIX File Handoff plus LLM Wiki pattern cleanly separates active intake, hot `.uai` memory, pointer-only long-memory routing, and durable wiki content. The LLMWikis setup guidance is also clear that AIWikis-style public routes need explicit site namespaces.

## Dogfood Improvements

1. The combined setup output should include a checklist item for public discovery when the target is AIWikis: create or update the site-directory/front-page listing, source-memory guide route, and route description before treating a new namespace as discoverable.
2. The wizard should distinguish planned remote routes from local file targets. A remote AIWikis pointer may be `planned_pending_publication`; file targets still need checksums.
3. Code-bearing project scaffolds need a first-pass architecture pointer and coding-standards pointer in the same setup packet, because agents otherwise create memory files without the implementation boundary.
4. The LLM Wiki setup packet should name the local source namespace and public namespace together, for example `wiki/runtime-mirust/` publishes to `/runtime-mirust/`.
5. The File Handoff proof gate should keep saying "source-site removal or keep-active reason" because it prevented creation of a duplicate `Archive` resting place.

## Applied Locally

- Created `.uai/file-handoff.uai` with Content and Improvement buckets only.
- Created `.uai/long-term-memory.uai` as a pointer-only routing ledger.
- Created local LLM Wiki source files under `wiki/runtime-mirust/`.
- Created AIWikis route plan documentation under `docs/aiwikis-routing.md`.


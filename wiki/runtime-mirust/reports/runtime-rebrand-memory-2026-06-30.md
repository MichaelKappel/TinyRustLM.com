---
title: Runtime.MiRust.com Rebrand Memory 2026-06-30
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/runtime-rebrand-memory-2026-06-30/
status: reviewed_current
reviewed_utc: 2026-06-30T01:08:00Z
---

# Runtime.MiRust.com Rebrand Memory

## Summary

The project brand and memory namespace moved to Runtime.MiRust.com. The in-repository source, docs, `.uai` memory, wiki namespace, raw evidence namespace, browser strings, and publish-review bundle now route through Runtime.MiRust.com and `runtime-mirust`.

## Source Change

- `.uai/`, `workspace.uai`, `AGENTS.md`, root docs, TinyRustLM docs, browser UI strings, browser smoke expectations, and harness markers now use Runtime.MiRust.com for project/site identity.
- Local durable memory folders now use `wiki/runtime-mirust/` and `raw/runtime-mirust/`.
- The adjacent publish-review folder moved to `E:\Source\Rust\Runtime.MiRust.com-Publish`, and its assembled review bundle plus README now use Runtime.MiRust.com naming.
- Technical `GGUF` model-format references in research/source text remain intact where they refer to the file format rather than the project brand.

## Verification

- Hidden-file text audit for old site-name forms passed inside the repository, excluding `.git/` and `target/`.
- File-path audit for old route/name forms passed inside the repository, excluding `.git/` and `target/`.
- Publish-review folder audit passed with no old site-name forms.
- The outer repository folder rename to `E:\Source\Rust\Runtime.MiRust.com` was attempted from the parent directory; Windows reported an active process handle on the current workspace root, so the physical folder move is the remaining handoff step after the handle is released.

## Routing

Open this report before changing project branding, AIWikis namespace routing, raw evidence routes, publish-review packaging, or agent startup memory paths.

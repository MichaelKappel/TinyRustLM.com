# AIWikis Routing Plan

Reviewed: 2026-06-24

## Target

Existing TinyRustLM long memory uses the established `runtime-mirust` AIWikis namespace at:

- `https://aiwikis.org/runtime-mirust/`
- `https://aiwikis.org/runtime-mirust/source-memory-guide/`

## Local Sources

- `.uai/`: hot Project Handoff state.
- `wiki/runtime-mirust/`: reviewed LLM Wiki source pages for this project.
- `raw/runtime-mirust/`: raw evidence manifests and checksums.
- `agent-file-handoff/Content` and `agent-file-handoff/Improvement`: active intake buckets.

## Route Rule

Site-specific memory belongs under `/runtime-mirust/`. Organization-wide guidance belongs under `/org/`. Do not create ambiguous AIWikis root indexes such as `/files/`, `/concepts/`, or `/reports/` for this project.

## Publication Status

The local source namespace exists now. Public AIWikis routes are planned until the WordPress source package is built and deployed.

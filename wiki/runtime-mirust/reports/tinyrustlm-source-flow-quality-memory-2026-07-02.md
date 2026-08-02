# TinyRustLM Source Flow Quality Memory - 2026-07-02

## Scope

This report routes the source-flow quality continuation for TinyRustLM after the Hugging Face, local `.slm`, and MiniModel P2P paths were made explicit. The change reduces duplicate Hugging Face result-rendering logic and keeps beginner and advanced source rows aligned without changing the browser-local model-byte boundary.

## Quality Change

- `tinyrustlm/app/app.js` now uses shared Hugging Face source-row helpers for advanced and simple result actions.
- `appendHfSourceFileNotes` centralizes `.slm` and `.safetensors` notes so safe source-file hints appear consistently in both result surfaces.
- `hfEnabledP2pActionMatch`, `appendHfAdvancedActions`, and `appendHfSimpleActions` centralize the `P2P Import`, `Set Peer URL`, `Use MiniModel Metadata`, `Start Conversion`, and conversion-script actions.
- The public/root and `/app/` shells were cache-busted to `app.js?v=20260702-sourceflowquality`.

## Boundary

The app still treats Hugging Face rows as metadata until Rust conversion, local `.slm` validation, or a checksum-bound MiniModel peer import produces a local file. `Start Conversion` still writes a local Rust handoff script and does not fetch Hugging Face `/resolve/` model bytes. `P2P Import` still writes a local `minimodel.peer_import_request.v0` plus Rust reverify script bound to a consenting direct `http://` peer. Project servers still do not run, proxy, or serve user model bytes.

## Documentation

- `tinyrustlm/README.md` now states that simple and advanced Hugging Face rows share action/source-note helpers and that `hf-search-ui` checks primary-action and source-hint parity.
- `tinyrustlm/docs/browser-runtime.md` documents the same source-flow contract for future developers and agents.
- `TinyRustLM.MiRust.com` developer docs, portal page data, and `llms.txt` / `llms-full.txt` summaries were updated to keep the documentation site aligned.

## Verification

- `node --check tinyrustlm\app\app.js` passed.
- `node --check tinyrustlm\tools\browser-smoke.js` passed.
- `node tinyrustlm\tools\static-shell-parity.js tinyrustlm` passed.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:55410/app/ 9233 noop hf-search-ui` passed and proved:
  - Search keeps the source chooser open.
  - Primary actions are `Start Conversion` and `P2P Import` while P2P is on.
  - Disabling P2P changes both rows to `Start Conversion`.
  - `.safetensors` source-file hints appear in both simple and advanced rows.
  - No Hugging Face `/resolve/` model-byte route is requested.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:55410/app/ 9234 noop hf-local-catalog-ui` passed and proved a loaded local `models.v0.json` can make the matching Hugging Face row P2P-ready without default MiniModel catalog or Hugging Face model-byte fetches.
- `php -l data\pages.php` could not run because `php` is not installed on PATH in this shell.

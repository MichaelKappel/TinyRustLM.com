# TinyRustLM Sidebar Model Setup Memory - 2026-07-02

## Scope

This report routes the TinyRustLM beginner-sidebar quality pass driven by the July 2 intake reports and the user review that the left side still looked confusing. The goal was to remove product-style controls that implied unavailable features and make the sidebar route users into real, implemented source workflows.

## Implementation

- `tinyrustlm/app/index.html` and the root `tinyrustlm/index.html` now replace the old `Library`, `Tune`, `Inspect`, `Developer`, `Settings`, `Help`, and `Theme` sidebar controls with a real `Model Setup` section.
- The sidebar setup actions are `Local .slm`, `Hugging Face`, `P2P import`, and `Advanced tools`.
- `Local .slm`, `Hugging Face`, and `P2P import` open the existing source chooser and select the matching implemented source panel.
- `Advanced tools` opens the real advanced verifier/details rail and closes the source chooser.
- Documentation icon links point to the TinyRustLM and MiniModel developer documentation sites.
- `tinyrustlm/app/app.css` adds stable setup-step styling for desktop, collapsed sidebar, compact-height desktop, and mobile layouts.
- `tinyrustlm/app/app.js` keeps sidebar source selection synchronized with the same `setSimpleSourceOption` state used by the main source chooser.
- `tinyrustlm/tools/browser-smoke.js` extends `source-options-ui` so the browser smoke clicks each sidebar setup action and proves the correct real panel or Advanced rail opens.

## Boundary

The sidebar change does not change the model-byte trust boundary. TinyRustLM still runs only after a local `.slm` is selected and Rust/WASM validates it. Hugging Face remains metadata/source discovery. P2P remains MiniModel metadata plus a consenting direct peer and Rust re-verification. Project servers still do not run, proxy, or serve user model bytes.

## Documentation

- `tinyrustlm/README.md` and `tinyrustlm/docs/browser-runtime.md` describe the Model Setup sidebar and smoke coverage.
- `TinyRustLM.com` was synced from the active Rust/WASM app surface.
- `TinyRustLM.MiRust.com` runtime docs, page data, `llms.txt`, and `llms-full.txt` describe the sidebar routing contract for humans and AI agents.

## Verification

- `node --check tinyrustlm\app\app.js` passed.
- `node --check tinyrustlm\tools\browser-smoke.js` passed.
- `node tinyrustlm\tools\static-shell-parity.js tinyrustlm` passed.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18847/app/ 19354 tinylm16q8 source-options-ui` passed and proved:
  - The initial source chooser is closed.
  - Sidebar `Hugging Face` opens the Hugging Face source panel.
  - Sidebar `P2P import` opens the P2P source panel.
  - Sidebar `Local .slm` opens the local source panel.
  - Sidebar `Advanced tools` opens Advanced mode and closes the source chooser.
  - No Hugging Face or MiniModel network access happens before explicit user search/load actions.
- `node tinyrustlm\tools\browser-smoke.js http://127.0.0.1:18847/app/ 19356 tinylm16q8 hf-search-ui` passed and proved the Hugging Face source chooser still stays open during search/refilter and the conversion/P2P handoffs still avoid project-hosted model bytes.

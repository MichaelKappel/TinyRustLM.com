# SLMComposer Local AI Dashboard Memory

## Purpose

This route records the 2026-07-01 high-fidelity SLMComposer dashboard redesign that replaced the confusing flat expert surface with a beginner-friendly local chat workspace plus a visible advanced configuration panel.

## Intake Route

The source reports and reference image are preserved under `docs/report-intake/2026-07-01/` and summarized by `docs/report-intake/2026-07-01/slmcomposer-dashboard-ui-synthesis-2026-07-01.md`.

## Implemented Product Shape

- Full-viewport dark glassmorphic dashboard with three desktop regions: left navigation sidebar, central local chat workspace, and right Advanced Options panel.
- Left sidebar includes SLM Composer branding, New Chat, Recent Chats, Models/Library/Tune/Inspect/Developer navigation, Local Only/System Ready state, and utility icons.
- Center workspace includes `Local browser inference • No prompts sent to a server`, loaded model toolbar, starter actions, example conversation, and a large browser-local composer.
- Right panel includes Generation Presets, live Max Tokens/Temperature/Top-K/Top-P/Seed controls, Model Selection, Runtime Status, Diagnostics, Provenance, Benchmark, Adapter Sidecar, Module Plan, Assembly, Run History, and Reset to Defaults.
- Tablet/mobile uses an explicit Advanced Options button to open the advanced drawer instead of letting the rail cover the beginner chat surface.

## Interaction Memory

- Preset buttons update sampling controls.
- Sliders update their value boxes.
- Starter cards seed the composer with common tasks.
- New Chat clears transcript state while keeping the local model surface ready.
- Edit Model opens the Local/Hugging Face/P2P source popover.
- Local, Hugging Face, and P2P routes remain discovery/import paths; they do not run remote inference or fetch project-served model bytes.

## Browser-Local Boundary

SLMComposer.com remains a static browser-local Rust/WASM app. Project servers may serve the app, schemas, docs, metadata, and public routes, but they do not serve runnable user model bytes and do not run user model bytes. Users import local `.slm` files through the browser file picker, and Rust/WASM owns validation/loading.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8099/app/ 9268 tinylm16q8 ui-audit`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8099/app/ 9269 tinylm16q8 source-options-ui`
- CDP screenshot inspection for desktop and true 390px mobile layout.

Live deploy was not performed in this pass because no repo deploy script, FTPS environment variables, or deploy credential target was available in the shell. Do not claim `https://slmcomposer.com/app/` has this dashboard until an explicit deploy and live proof are run.

## Follow-Up

The next product slice should connect the visual source choices to the local manifest/import receipt flow without changing the no-server-model-bytes rule.

# TinyRustLM Public Live Smoke Memory - 2026-07-03

## Summary

The `public-local-only` browser smoke now distinguishes local public-host simulation from a real live HTTPS verification. Local `http://tinyrustlm.com:PORT/` runs still map the public hostname to loopback so the app can be tested with the public host name. Live `https://tinyrustlm.com/` runs use real DNS and verify the deployed site.

## Why This Matters

The previous launcher always added a Chrome host resolver rule in `public-local-only` mode. That made a live HTTPS command aim Chrome at loopback instead of the deployed site, causing a false `timed out waiting for runtime boot` failure. The fix keeps the local simulation behavior for HTTP loopback tests while allowing true live deploy checks.

## Verified Behavior

- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `node tinyrustlm/tools/browser-smoke.js https://tinyrustlm.com/ 9442 public public-local-only` passed against the live site.
- Live result: `wasmState=loaded`, `runtimeStatus=Runtime ready`, `modelState=choose a local .slm file`, and `errorState=none`.
- Network requests were limited to `/`, `app.css`, `app.js`, `runtime/tinyrustlm.wasm.manifest`, and `runtime/tinyrustlm.wasm`.
- No `/models/`, Hugging Face, or MiniModel catalog request occurred before user action.

## Boundary

This is a test-harness correction, not a relaxation of the product boundary. TinyRustLM.com still serves the static app and WASM runtime only; users import local `.slm` files through the browser file picker, and project servers do not host, proxy, cache, run, or serve model bytes.

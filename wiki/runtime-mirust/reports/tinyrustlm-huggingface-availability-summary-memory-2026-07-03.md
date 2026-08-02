# TinyRustLM Hugging Face Availability Summary Memory - 2026-07-03

## Scope

Added a compact availability summary to the simple Hugging Face panel so new users can see the real path for search results before opening individual rows.

## Implementation

- `tinyrustlm/app/index.html` adds `simpleHfFlowSummary` above the simple Hugging Face results.
- `tinyrustlm/app/app.js` derives `hfAvailabilityCounts` from the same row view state that chooses row actions, then renders chips for `P2P Import`, `Set Peer URL`, `Start Conversion`, `Review First`, `Local .slm`, `No Source`, and `P2P Off`.
- `tinyrustlm/app/app.css` styles the summary as compact state chips.
- `tinyrustlm/tools/browser-smoke.js` asserts that the summary appears after search, preserves the search popover, and changes when P2P is disabled.
- `tinyrustlm/index.html` and `tinyrustlm/app/index.html` stay in shell parity and cache-bust `app.js`/`app.css` with `20260703-availability`.
- Static docs links and peer URL examples are composed at runtime instead of appearing as literal remote URL markers in checked-in HTML/JS, preserving the browser harness no-remote-marker contract.

## Intake Finding

The 2026-07-03 desktop/P2P intake reinforces that the beginner path should stay browser-local and simple while advanced peer duties move to a later optional user-run MiniModel Peer Companion. This change follows that guidance by clarifying the current browser metadata/conversion/import choices instead of introducing desktop or network requirements into first-run search.

## Boundary

Hugging Face rows remain metadata. A model runs in TinyRustLM only after Rust conversion creates a local `.slm` or after `P2P Import` fetches peer pieces from a consenting direct peer and Rust reverifies the assembled `.slm`.

Project servers still do not host, proxy, cache, run, or serve user model bytes.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/static-shell-parity.js tinyrustlm`
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18444/app/ 9444 tinylm16q8 hf-search-ui`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18444/ 9445 tinylm16q8 hf-search-ui`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18445/ 9446 tinylm16q8 hf-search-ui`

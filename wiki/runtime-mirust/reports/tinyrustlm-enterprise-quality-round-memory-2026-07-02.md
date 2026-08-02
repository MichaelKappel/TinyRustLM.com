# TinyRustLM Enterprise Quality Round Memory - 2026-07-02

## Scope

This quality pass focused on the browser-local TinyRustLM source-option surface, especially Hugging Face metadata search and the MiniModel P2P source lane. The goal was to reduce repeated UI code, make source-state decisions easier to audit, strengthen automated regression coverage, and keep public documentation aligned with the deployable source.

## Refactor

`tinyrustlm/app/app.js` now has shared DOM/action helpers for repeated model-result rows:

- `elementWithText`
- `actionButton`
- `externalActionLink`
- `modelResultItem`

The Hugging Face rendering path now computes one row view model through `hfResultView`, then derives simple and advanced text from shared helper functions. This consolidates the previous duplicated compatibility checks across `renderHfResults` and `renderSimpleHfResults`.

The simple Hugging Face lane keeps the user-facing action model:

- P2P enabled by default.
- Peer-proof MiniModel matches show `P2P Import`.
- Non-peer-ready rows show `Start Conversion`.
- Disabling P2P changes all simple primary actions to `Start Conversion`.
- The disabled-P2P warning is list-level only.
- No simple row exposes `Choose converted .slm`, `Save Conversion Request`, or `Save Rust Conversion Script`.

`P2P Import` now saves a real local handoff instead of only selecting metadata:

- `minimodel.peer_import_request.v0` JSON records the matched model id, artifact SHA-256, byte count, model-card/license routes, MiniModel manifest/peer-offer routes, peer-offer checksum, chunk count, Merkle root, and explicit no-project-server-byte/no-project-server-execution boundary flags.
- `.minimodel-peer-import.ps1` records the Rust verifier path: `minimodel verify-manifest`, `minimodel fetch-peer-pieces` from an editable consenting-peer `http://` base URL, `minimodel assemble-peer-pieces`, `minimodel verify-artifact`, and `minimodel write-import-receipt`.
- The peer-import request and script also name the sender-side counterpart: a consenting peer can use `minimodel export-peer-pieces` and `minimodel serve-peer-pieces` from a MiniModel admission manifest and local piece directory.
- The script does not download Hugging Face bytes, does not fetch project-hosted model bytes, and does not make the model runnable until the user imports the locally verified `.slm`.

`Start Conversion` scripts now stay executable for the local conversion stage and print the post-admission MiniModel commands a converter can run to become a consenting peer source: `export-peer-pieces` followed by `serve-peer-pieces`.

The advanced lane still exposes lower-level `Use MiniModel Metadata`, `Save Conversion Request`, and `Save Rust Conversion Script` controls for pro workflows.

## Root Route

`tinyrustlm/index.html` is now the public app shell for TinyRustLM.com `/`, with assets loaded from `./app/app.css` and `./app/app.js`. `/app/` remains a secondary route. `tinyrustlm/.htaccess` no longer redirects root to `/app/`; it keeps the WASM content type rule.

## Test Hardening

`tinyrustlm/tools/browser-smoke.js` now captures primary simple Hugging Face action buttons separately from explanatory text:

- `primaryActionTextsAfterSearch`
- `primaryActionTextsAfterP2pDisable`

The `hf-search-ui` smoke now asserts:

- search and refilter clicks keep the source chooser open
- P2P starts enabled
- the P2P-enabled primary actions are exactly one `Start Conversion` and one `P2P Import`
- exactly one disabled-P2P warning element exists
- disabling P2P produces exactly two `Start Conversion` primary actions
- simple rows do not expose old per-row conversion/import controls
- no Hugging Face `/resolve/` byte route is exposed
- `Start Conversion` saves the local Rust conversion script handoff
- `P2P Import` saves the peer-import request JSON and Rust reverify script handoff
- the peer-import request includes the expected artifact checksum, peer-offer checksum, peer-side `serve-peer-pieces` guidance, `fetch-peer-pieces` plus `assemble-peer-pieces` command contract, and no-project-server model-byte/execution flags
- the peer-import and conversion scripts expose `serve-peer-pieces` without adding project-hosted model-byte downloads

## Documentation

TinyRustLM.MiRust.com documentation was updated so the source-options implementation note names TinyRustLM.com `/` as the deploy target and describes the corrected Hugging Face P2P action model. The browser-runtime documentation now also explains that `P2P Import` saves a `minimodel.peer_import_request.v0` request and `.minimodel-peer-import.ps1` script, with direct known-peer piece serving/fetching, local Rust reassembly, artifact verification, and receipt writing still required before browser import.

## Verification

Local verification for this pass included:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8099/ 9275 tinylm16q8 hf-search-ui`

The focused browser smoke proved root-route app loading, open source chooser behavior, P2P default-on behavior, exact simple primary-action labels, single list-level disabled-P2P warning, no Hugging Face model-byte route, local conversion-script handoff, and local peer-import request/script handoff.

## Boundaries

This pass did not add peer discovery, relays, NAT traversal, server-side model execution, project-server model-byte hosting, or Hugging Face model-byte proxying. TinyRustLM remains browser-local, and every runnable model path still converges on local `.slm` verification. MiniModel now has narrow direct known-peer HTTP serve/fetch commands for peer pieces; broader P2P discovery and cache behavior remain later.

# TinyRustLM Browser-First Local Consent And Memory Choice

Date: 2026-07-15

## Current Product Contract

TinyRustLM chat is a browser application by default. Loading the page must not
probe, launch, pair with, or request permission to contact a desktop program.
The optional desktop companion is contacted only after the user chooses
`Connect desktop companion`, after the page explains the purpose of the local
connection and that the browser or operating system may display an access
prompt.

The privacy badge explains offline readiness from the current setup:

- A verified model that is loaded in the current open tab can continue
  generating while the internet is disconnected and the tab remains loaded.
- A local UAIX Memory Deck is the offline memory-context option.
- Locally queued synchronization changes remain a supported option and are
  delivered after reconnection; a queue is not represented as a readable
  offline copy of hosted long-term memory.
- MemoryEndpoints.com remains optional and is the encouraged choice when the
  user wants memory available worldwide, across browsers, and across devices.
  New hosted reads, writes, and synchronization require internet access.
- Local copied memory and local synchronization remain available when the user
  does not enroll in MemoryEndpoints.com.

This is deliberately contextual. The page does not promise offline chat before
a model is loaded, does not promise hosted memory while disconnected, and does
not make the desktop companion or MemoryEndpoints a requirement for local
browser chat.

## Implementation

The source implementation is in:

- `tinyrustlm/index.html`
- `tinyrustlm/app/index.html`
- `tinyrustlm/app/app.js`
- `tinyrustlm/app/app.css`
- `tinyrustlm/e2e/companion.spec.js`
- `tinyrustlm/e2e/ui.spec.js`
- `tinyrustlm/e2e/conversation.spec.js`

`updateOfflineReadiness()` derives the badge explanation from model-loaded,
local-memory-deck, and MemoryEndpoints state. Companion state starts as idle
and browser-only. No companion detection function is invoked during page
startup; the first health request is bound to the explicit connection action.

## Production Evidence

Atomic deployment receipt:

`artifacts/reports/tinyrustlm-browser-first-local-consent-production-deployment-2026-07-15.json`

Deployment `20260715T042636Z` passed staged FTPS verification, promotion, final
FTPS verification, and cache-busted public HTTPS hash verification for all four
files:

| Public file | SHA-256 |
| --- | --- |
| `index.html` | `2d838c1a246148d624d488de700ca5b9e27a9cb9325b7e888fc16dfe9b53dac1` |
| `app/index.html` | `089a293ff676e3b5623d010f0efe4e93b07e0ee27eee3a3a22a1991c319b9f34` |
| `app/app.js` | `0900733819f0ceec54ed97adcce79b80196228f726d68a2a80e0c97bb8c31ca0` |
| `app/app.css` | `804a428b1b9a764f679a34707a07831633e318c2dc9e73356537c887f22c02f7` |

Fresh live browser receipt:

`artifacts/reports/tinyrustlm-live-browser-local-consent-2026-07-15.json`

A newly created Microsoft Edge `149.0.4022.98` persistent profile loaded
`https://tinyrustlm.com/`, recorded zero startup loopback requests and zero
project-host model-byte requests, showed the browser-only status and explicit
companion action, found the offline-memory explanation and worldwide-memory
recommendation, recorded no page errors, and was then physically deleted.

Source verification passed 80 unit tests plus focused Playwright coverage for
the zero-probe connection boundary, contextual no-model and hosted-memory
copy, and loaded-model offline readiness. The isolated production patch was
also tested through the public hostname before deployment.

Two failed deployment attempts are intentionally preserved as failure
evidence. One made no production change. The other reached promotion, failed
its HTTPS verifier, and successfully restored all four prior files before the
corrected deployment passed.

## Release Boundary

An unexpected local-app access prompt is a release-blocking trust defect.
Users never need to choose `Allow` to use browser chat. Denial or absence of
the optional companion must leave the browser-only path usable and must not
cause background retries.

This evidence proves the fresh-load browser behavior and deployed explanatory
copy. It does not prove that every browser version renders permission UI in the
same way, that hosted memory works without internet, or that a loaded tab can
survive browser or operating-system termination while offline.

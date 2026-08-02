# Active Conversation Mode

## Runtime contract

The approved new-chat screen remains the empty state. The first accepted prompt changes only the center workspace to active conversation mode. The hero and starter grid leave the layout, the conversation timeline becomes the only vertical scroll owner, and the composer becomes a compact auto-growing control anchored below that timeline.

Every turn has one stable turn ID, one completed user message, and one assistant message. The assistant message moves through `waiting`, `generating`, `streaming`, and one terminal state: `completed`, `stopped`, `rejected`, or `failed`. Rendering updates that one message in place. The compatibility `#response` ID belongs to the latest assistant message and never creates a second visible response.

Generation continues to use the established synchronous Rust/WASM quality paths. The browser yields a frame before calling WASM so waiting and generating state is visible. When Rust returns a successful result, the browser progressively reveals that exact result. The browser does not author fallback answers. Stop can cancel before inference starts or while genuine output is being delivered. It resets runtime context when delivery is stopped. It does not claim to interrupt JavaScript while a synchronous WASM call is on the stack.

Copy, Retry, Continue, and Inspect are commands over saved message identity. Retry resubmits the matching user message. Continue sends the previous assistant tail back through the model with an explicit continuation instruction. Inspect opens the existing diagnostics panel. Failure and rejection remain marked inside the assistant message; raw runtime detail remains available in diagnostics.

## Local persistence

`app/active-conversation.js` owns the deterministic persisted schema. It stores at most 20 conversations, 200 messages per conversation, 32,768 characters per message, and 1 MiB for the complete store. Persisted fields are limited to public chat identity, timestamps, title, model key, preset, sampler settings, memory mode, message text, lifecycle status, and bounded error code.

The serializer rejects credential-like text and exact protected session values. It never stores MemoryEndpoints bearer tokens, workspace IDs, retrieval candidates, raw payloads, or Local Connect credentials. If sensitive text enters the active chat, that chat stays usable in memory but is removed from local persistence. Other safe conversations can still be saved.

Startup validates every stored row independently. Corrupt or unsafe rows are discarded. Any `waiting`, `generating`, or `streaming` assistant restored after a restart becomes `stopped` with `interrupted_after_restart`, then the recovered checkpoint is persisted. Recent Chats restores the latest valid conversation and can switch among retained conversations without duplicating turns.

## Verification

Run the deterministic store and security tests:

```powershell
node --test tinyrustlm/tests/active-conversation.test.js
```

Run the complete Playwright browser and companion workflow:

```powershell
npm --prefix tinyrustlm run test:e2e
```

The conversation specification proves empty-to-active transition, duplicate-submit stopping, Retry, repeated real Rust/WASM turns, one authoritative response renderer, long-conversation scrolling, reading-position preservation, Jump to latest, bounded credential-field-free storage, recent-chat navigation, and fresh-document interruption recovery. The companion specification proves one-time loopback pairing, direct Rust peer import, peer-identity disagreement rejection, restart/resume behavior, revocation, and the explicit 969,648,576-byte Qwen import-to-WASM chat path. Network assertions fail if prompts, generated responses, or model bytes reach a public project domain.

Capture independent empty, active, and long desktop/mobile visual evidence:

```powershell
node tinyrustlm/tools/capture-ui-lock.js http://tinyrustlm.com:8080/ artifacts/reports/ui-lock 9781 baseline.json empty
node tinyrustlm/tools/capture-ui-lock.js http://tinyrustlm.com:8080/ artifacts/reports/ui-lock 9782 - active
node tinyrustlm/tools/capture-ui-lock.js http://tinyrustlm.com:8080/ artifacts/reports/ui-lock 9783 - long
```

The empty mode remains compatible with the approved visual baseline. Active and long modes write separate screenshots and reports so they cannot replace or weaken the empty-state lock.

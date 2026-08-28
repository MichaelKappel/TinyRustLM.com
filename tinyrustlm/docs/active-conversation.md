# Active Conversation

## UI State

The approved new-chat screen is the empty state. The first accepted user turn
removes the introductory cards and makes the center column the conversation
workspace. The timeline is the vertical scroll owner and the composer remains
stable below it.

Each user submission creates one stable turn ID, one user message, one
generation ID, and one assistant message. The assistant message is updated in
place through a bounded lifecycle and ends exactly once as `completed`,
`stopped`, `rejected`, or `failed`.

Repeated token text is valid model output. Exactly-once rendering deduplicates
events by identity and sequence, not by comparing text. A late event from an
old or terminated worker never has authority over the current generation.

## Runtime Ownership

The top window does not run inference. It owns UI state and communicates through
`app/model-runtime-client.js` with the dedicated
`app/model-runtime-worker.js`. The worker owns:

- the verified import-free WASM module;
- the active six-member composition;
- tokenizer, template, prompt, and sampling state;
- model tensors and KV cache;
- generation and cancellation state;
- exact raw token IDs and decoded output.

The worker protocol binds protocol, operation, composition, command, event,
request, and sequence identities. Unknown fields, stale identities, duplicate
commands, sequence gaps, payload overrun, ABI failure, or composition drift
terminate closed. There is no alternate JavaScript inference path, synchronous
top-window call, server fallback, response completion, or automatic retry.

## Composition Activation

Conversation controls remain disabled until the user selects all six canonical
composition members and their canonical browser admission. The admission must
bind the exact worker protocol, WASM identity, resource policy, qualification
receipt, and member inventory.

The worker receives each member in bounded contiguous chunks and atomically
activates the complete ACG2 graph. Model switching advances operation authority,
invalidates prior generation and KV state, and reverifies the replacement
composition. A single `model.slm2` file is never enough to enable chat.

## Generation

The top window creates one canonical Prompt2 request from completed prior turns
and the current user turn. It does not rewrite the model output or insert an
expected answer. The worker returns one typed terminal result containing exact
token IDs, decoded raw text, runtime status, committed KV bytes, and termination
reason.

The assistant renderer displays that exact text once. Markdown or presentation
sanitization may prevent active content but must not alter semantic output or
turn a malformed model result into a pass. Typed runtime rejection remains
visible and is preserved in private evidence.

## Cancellation And Recovery

Stop sends a real cancellation command to the active worker operation. A
successful cancellation produces one terminal cancelled result. If the worker
cannot establish a trustworthy terminal state, the client terminates it and
requires a new worker to reload and reverify immutable composition bytes before
another generation.

Cancellation never silently starts a second generation. Partial output is not
completed, replaced, or selected against another attempt.

## Local Persistence

`app/active-conversation.js` owns the bounded local conversation store. It keeps
public chat identity and message state only within its declared count and byte
limits. It rejects credential-like text and protected session values.

MemoryEndpoints tokens, workspace identifiers, enrollment URLs, retrieval
payloads, companion capabilities, model bytes, and raw hosted-memory records are
not persisted in conversation storage. An interrupted nonterminal assistant
message restored after restart becomes a truthful stopped message.

Local conversation persistence is not portable-memory promotion. Durable local
UAIX and MemoryEndpoints records have separate explicit write, provenance,
supersession, and retrieval contracts.

## Verification

Focused state and worker tests:

```powershell
node --test --test-concurrency=1 `
  tinyrustlm/tests/active-conversation.test.js `
  tinyrustlm/tests/model-runtime-client.test.js `
  tinyrustlm/tests/model-runtime-worker.test.js `
  tinyrustlm/tests/browser-model-admission.test.js
```

The release-level browser gate additionally requires a real Chromium build, an
owned fresh persistent profile, process closure, bounded deletion retries,
proof that the profile no longer exists, no duplicate assistant rendering, no
unexpected network request, and raw private output custody.

Current worker and UI unit evidence does not prove a real Qwen conversation,
quality qualification, P2P acquisition, MemoryEndpoints continuity, deployment,
or campaign progress. Those counters remain zero until exact live receipts
exist.

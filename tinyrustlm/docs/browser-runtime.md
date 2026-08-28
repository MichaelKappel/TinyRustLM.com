# TinyRustLM Browser Runtime

Status on 2026-08-28: the browser UI uses the sole worker-owned SLM2 runtime,
and the registered superseded runtime and packer roots are deleted. Focused
Rust, Node, worker, and real Chromium fixture tests have passed. No real Qwen3
composition, numerical parity result, model-quality decision, or campaign
round is claimed by this structural checkpoint.

## Deployment Identity

The deployed runtime pair is:

- `browser-runtime/tinyrustlm-browser-runtime.wasm`
- `browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json`

The manifest binds the WASM byte count, SHA-256, source crate, build profile,
worker protocol, memory ceiling, imports, and exact exports. App startup uses
`app/browser-runtime-loader.js` to fetch both files, validate the manifest,
hash the module, and reject identity drift before a worker is created.

The UI never calls WASM directly. `app/model-runtime-client.js` creates
`app/model-runtime-worker.js`, and the worker alone instantiates the verified
module.

## Composition Admission

One activation consists of the exact fixed member set:

| Role | File | Profile |
| --- | --- | --- |
| model | `model.slm2` | `org.minimodel.slm2/2.0` |
| tokenizer | `tokenizer.tokenizer2` | `org.minimodel.tokenizer2/2.0` |
| template | `template.template2` | `org.minimodel.template2/2.0` |
| sampling | `sampling.sampling2` | `org.minimodel.sampling2/2.0` |
| prompt | `prompt.prompt2` | `org.minimodel.prompt2/2.0` |
| composition | `composition.acg2` | `org.minimodel.acg2/2.0` |

The canonical browser admission record binds all names, lengths, SHA-256
identities, format profiles, ACG2 graph identity, member-table identity,
resolved bytes, runtime artifact, resource policy, source evidence, structural
evidence, numerical evidence, quality receipt, and default sampling profile.
Unknown fields and noncanonical bytes are fatal.

The client streams contiguous chunks no larger than 4 MiB. The worker checks
sequence and byte totals, transfers each member into WASM once, wipes accepted
JavaScript chunks, and activates only after complete graph verification. A
failed activation leaves no partially active composition.

## Worker Protocol

Every command and event binds protocol, operation, composition, and sequence
identity. Generation additionally binds conversation, turn, generation, and
message identity. Stale, duplicate, skipped, or cross-operation events are
fatal to the affected operation.

The worker owns:

- the WASM instance and linear memory;
- all six composition members during activation;
- tokenizer, prompt, sampling, and model state;
- transcript revision and conversation identity;
- KV-cache state; and
- generation and cancellation state.

The page owns:

- user commands;
- accessible status presentation;
- the conversation message ledger; and
- exactly-once rendering of returned raw assistant text.

There is no generic worker invocation, URL fetch, filesystem path, network
authority, or JavaScript inference path.

## Prompt And Generation

`app/prompt2-request.js` emits one bounded Prompt2 request from completed
conversation messages and the current user turn. The current user turn is
last and authoritative. Retrieved memory remains labeled data.

The worker validates Prompt2, renders Template2, tokenizes with Tokenizer2,
runs the canonical runtime, and samples with Sampling2. The page does not
inject expected terms, finish partial output, select a better seed, or retry a
failed answer. One terminal result contains token IDs, exact decoded text,
termination reason, and the resulting runtime state.

## Cancellation And Faults

Cancellation targets one active generation ID. Cooperative cancellation is
preferred; a terminal runtime or protocol fault causes client termination.
Late messages from a terminated worker are never authoritative. A subsequent
generation requires a fresh worker and complete composition revalidation.

Allocation failure, context overflow, malformed artifacts, identity drift,
nonfinite runtime state, WASM trap, sequence drift, and cancellation remain
typed failures. A partial answer cannot become a successful completion.

## Exactly-Once Rendering

The conversation ledger creates one pending assistant message per user turn.
Only the matching generation may complete or fail that message. Raw output is
stored on that message and rendered through the single conversation rendering
path. Repeated token text is content, not a duplicate event; repeated terminal
events are protocol failures.

## Verification

Focused checks:

```powershell
npm --prefix tinyrustlm run test:model-runtime-worker
npm --prefix tinyrustlm run test:model-runtime-worker-browser
node --test tinyrustlm/tests/browser-runtime-web-artifact.test.js
node --test tinyrustlm/tests/production-slm2-clean-cut.test.js
```

The real Chromium worker test creates owned persistent profiles, executes the
actual module, verifies transfer detachment and terminal event ordering,
captures network and console failures, closes Chromium, and proves physical
profile deletion. It remains fixture-scoped.

The sole current campaign projection runner is documented in
`../../docs/architecture/vnext-campaign-runner.md`. Its synthetic capacity
tests are not browser dogfood rounds.

## Remaining Promotion Gates

The browser runtime cannot support a real-model claim until one immutable
composition passes, in order:

1. independent six-member structural inspection;
2. scalar-native numerical comparison with the pinned source framework;
3. optimized-native differential comparison;
4. browser-WASM differential comparison;
5. contamination-controlled conversational qualification;
6. clean-profile multi-turn browser acceptance; and
7. committed release, deployment, and public HTTPS readback.

P2P availability, MemoryEndpoints continuity, and campaign completion require
their own authorized live receipts.

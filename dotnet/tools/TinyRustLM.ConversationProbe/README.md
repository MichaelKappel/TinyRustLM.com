# Real composition execution capture

This tool captures one declared native SDK execution per case. The owning runner,
`tinyrustlm/tools/real-composition-execution.js`, then performs the same declared
cases through the unchanged browser client, dedicated worker and WASM. It does
not grade answers, create a qualification receipt, or enable application/catalog
admission. No source model is eligible merely because this tooling passes tests.

Build the project using the admitted local .NET SDK and a newly owned canonical
`artifacts` output root. Keep the executable's generated `.deps.json` and
`.runtimeconfig.json`, `TinyRustLM.Core.dll` and `TinyRustLM.Abstractions.dll`
together. Do not use a copied source tree or an unpinned package publication.

Before a real run, freeze a canonical JSON request under `artifacts` and commit
the prospective cases and acceptance criteria. The owner supplies:

- Schema `tinyrustlm.real-composition-execution-request/1`, exact source commit,
  nonzero operation identity, composition identity and canonical
  `D:\LLMs\TinyRustLM` composition directory.
- Exact names, byte lengths and SHA-256 identities of the six current members;
  exact `dotnet.exe`, native library, browser executable, five managed files and
  four browser assets. Arrays use the order exported by `MEMBERS`, `MANAGED` and
  `ASSETS`; frozen identities must be computed after final builds.
- The eight production browser policy fields, including reciprocal peak-memory
  and resolved-member budgets. Context must fit the actual model and KV budget.
  The common request limit is 1,054,848 bytes. No runtime limit is relaxed.
- One to 32 uniquely named cases: `id`, `conversation`, `historyFrom`, `messages`,
  `sampling`, decimal-string `seed`, `transcriptRevision`, `resetBefore`,
  `cancelAfterSteps`, and `deadlineMilliseconds` (1,000 to 600,000). Greedy
  sampling requires temperature zero, top-k one and top-p one million. Other
  sampling values and all user/system messages are frozen before execution.
- One or two declared `browserViewports` (`id`, `width`, `height`, `isMobile`),
  one operation-wide `totalDeadlineMilliseconds`, and a new exclusive
  `outputDirectory` under canonical `artifacts`. Existing evidence is never
  overwritten. A mobile viewport is not a physical mobile-device measurement.

The exact JSON encoding is two-space indentation with a final LF. Run once:

```powershell
node tinyrustlm/tools/real-composition-execution.js <absolute-frozen-request.json>
```

Execution first requires clean, remote-exact registered source admission and an
exact HEAD match, then verifies all declared bytes. It never downloads a model.
The browser serves only exact declared resources from a random loopback route;
external browser requests and service workers are blocked. Model payloads are
streamed from their canonical directory, not copied into evidence.

A dependent case specifies a prior case's `historyFrom`, the same conversation,
an increased transcript revision, `resetBefore: false`, and one new user message.
The runner appends the preceding backend's actual raw answer without trimming,
repairing, substituting, or sharing an answer across backends. Each derived wire
and its SHA-256 are retained. A failed preceding case cannot become valid history.

Use `cancelAfterSteps` to exercise real native cancellation and the production
browser client's AbortSignal. A subsequent declared case can reuse that runtime;
`resetBefore: true` disposes it and activates a new one. This does not exercise
the visible app Stop/New Chat buttons, installation, reload, offline restoration,
or interrupted downloads. Those require separate normal-UI acceptance checks.

Each arm stops its remaining cases on failure. There are no case retries. Raw
native stdout/stderr, per-case wires and raw captures, activation observations,
token IDs, terminal status, cancellation timing and available machine metadata
are retained. First-token/turn timing excludes activation and owner-side request
preparation; activation is separate. Decode rate with fewer than two emitted
tokens must remain unmeasured. Browser process peak memory is unmeasured.

`captured-not-graded` is successful evidence collection only. `modelQualified`
always remains false. An independent, evidence-bound decision must assess exact
source quality, numerical agreement, these real native/browser answers and
timings, normal application behavior, and publication before model qualification.

Focused validation uses `ConversationProbeTests` in the existing Core test
project and `node --test tests/real-composition-execution_test.js` from
`tinyrustlm`. Its actual Chromium test transfers deliberately invalid zero-filled
non-model members to the production worker and requires `acg2-header` rejection;
it performs no real model inference. The CLI admission/real-model success path is
unexecuted until an eligible source and frozen exact request are available.

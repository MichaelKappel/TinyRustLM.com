# TinyRustLM Browser Application

TinyRustLM is a browser-local chat application backed by the Rust/WASM runtime.
Model bytes are selected locally or obtained through an independently verified
direct-peer workflow. The application origin is not a model-byte host and is
not an inference service.

This repository is pre-release. There is one current evidence path and no
compatibility path for retired browser assembly or ad hoc smoke modes.

## Current Architecture

The maintained browser path consists of:

- `app/`: the checked-in browser UI and JavaScript orchestration.
- `runtime/`: the Rust runtime and WASM ABI.
- `tools/local_server/`: the loopback static server used for local checks.
- `tools/browser_harness/`: the no-crate Rust static-contract auditor.
- `tools/dogfood-campaign.js`: strict 20-model and 50-round manifest validation.
- `tools/fresh-browser-conversation.js`: physical-profile Playwright execution.
- `tools/browser-round-evidence.js`: immutable browser receipt construction.
- `tools/run-browser-round.js`: the operator entry point for one non-memory
  campaign round.
- `tools/campaign-evidence-store.js`: content-addressed receipt persistence.
- `tools/campaign-evidence-dashboard.js`: status derived from validated
  receipts.

The browser activates one immutable `.slm.acg1` composition graph for each
qualified model. Campaign evidence binds both the graph bundle hash and the
runtime-observed active graph identity. Mutable adapter plans and browser-side
model assembly are not accepted campaign inputs.

## Model Acquisition

The chooser exposes one `Get model` command. It first selects a complete,
identity-matched MiniModel P2P offer with its composition graph. If no such
offer is available, an explicitly paired protocol-v2 companion downloads the
exact reviewed Hugging Face revision, resumes and hashes bounded source files,
runs the packaged Rust converter and validator, creates a receipt-bound
base-only `.acg1`, and streams both the `.slm` and graph into the current
browser session. Rust/WASM validates and activates the pair before chat is
enabled.

Progress remains visible in the chooser. The browser does not generate or
download conversion instructions, scripts, request files, import kits, share
kits, or serving helpers. Browser-only users can still import an existing local
`.slm`; the application never probes a desktop companion before explicit user
consent. Project domains receive no prompts, responses, source tensors, model
bytes, or composition bytes.

Acquisition proves identity and structural execution only. Semantic quality
promotion remains a separate, content-addressed native and browser evidence
gate.

## Local Memory Package

The local memory inspector renders a FileDeck-style summary of the exact
required files, persona dimensions, evidence, exports, manifest overlay,
package model, knowledge graph, and `llms` artifacts that passed browser-side
validation. Missing or mismatched files remain explicit; raw package content is
not silently promoted into model context.

## Trust Boundary

The browser campaign fails closed unless all of these identities agree:

- `.slm` SHA-256 and byte count.
- `.slm` manifest evidence.
- source-review evidence.
- current native quality-evaluation evidence.
- `.slm.acg1` SHA-256 and byte count.
- base model ID.
- composition ID.
- active graph SHA-256.
- route-policy ID.
- KV-format ID.
- position-policy SHA-256.
- composition member count.
- qualification receipt ID.
- browser executable and Playwright versions.
- exact campaign, model, round, viewport, and network configuration.

The campaign manifest uses schema `tinyrustlm.dogfood_campaign.v3`. It rejects
unknown fields, omitted controls, duplicate artifact hashes, credential-bearing
URLs, cross-origin graph routes, weak quality claims, and schedules that do not
provide all required viewport and restart coverage.

## Local Development

From the repository root:

```powershell
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm
cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm --http http://127.0.0.1:8080/app/
```

The JavaScript contract tests use the pinned Playwright dependency:

```powershell
npm --prefix tinyrustlm ci
npm --prefix tinyrustlm run test:unit
npm --prefix tinyrustlm run smoke:web-release-local -- <new-output-directory>
```

`npm ci` is required only when `node_modules` has not already been restored.

## Model Qualification

The qualification runner accepts pinned source inventory entries and produces
immutable phase receipts. Its required arguments are explicit:

```powershell
npm --prefix tinyrustlm run qualify:models -- `
  --inventory <candidate-inventory.json> `
  --source-root <external-model-root> `
  --output-root <qualification-output-root> `
  --evidence-root <evidence-root> `
  --indices <comma-separated-candidate-indices>
```

The current qualification path requires `q8_0`. A candidate is not qualified
merely because conversion or structural validation succeeds. Current native
conversation evidence must bind the same composition identities later observed
in the browser.

Large candidate and product model bytes belong outside source control. Small,
deterministic fixtures may remain tracked only to prove format, parser, runtime,
and failure behavior. A fixture receipt cannot satisfy a real-model campaign
gate.

## Campaign Manifest

Each model entry in the v3 manifest contains exactly:

```text
modelId
artifactPath
manifestPath
sourceEvidencePath
qualityEvidencePath
artifactSha256
artifactByteCount
manifestSha256
sourceEvidenceSha256
qualityEvidenceSha256
qualificationReceiptId
evalCasesSha256
slmPackSha256
evalBinarySha256
chatTemplateKind
chatTemplateSha256
promptFormat
systemPrompt
systemPromptSha256
contextLength
evaluator
evaluationSamplingProfile
modelSamplingProfile
samplingTemperature
samplingTopK
samplingTopP
samplingRepetitionPenalty
compositionGraphPath
compositionGraphUrl
compositionGraphSha256
compositionGraphByteCount
compositionBaseModelId
compositionId
compositionActiveGraphSha256
compositionRoutePolicyId
compositionKvFormatId
compositionPositionPolicySha256
compositionMemberCount
qualityClaim
sourceModelId
sourceRevision
```

Each of the 50 round entries contains exactly:

```text
round
modelId
memoryContinuity
prompts
viewport
reducedMotion
allowedOrigins
sampling
```

The schedule must use 20 distinct model artifact hashes, exercise every model in
at least two clean restarts, designate exactly 25 live-memory rounds, and cover
mobile, narrow-desktop, desktop, and reduced-motion configurations.

Private prompts belong only in the private campaign manifest. Public-safe
receipts contain hashes and bounded counts, not prompt text.

## Run One Browser Round

The non-memory operator command is:

```powershell
npm --prefix tinyrustlm run run:browser-round -- `
  <campaign.json> `
  <round-number> `
  <evidence-root> `
  <owned-profile-parent> `
  <public-result.json>
```

The runner:

1. Reads a bounded, non-symlink campaign file.
2. Validates the complete sealed v3 manifest and all referenced model files.
3. Rejects rounds assigned to live MemoryEndpoints continuity.
4. Creates a campaign-owned persistent Chromium profile.
5. Imports the real `.slm` and campaign-derived admission sidecar through the
   file picker.
6. Verifies runtime activation of the exact composition graph and exact
   prompt/sampling policy.
7. Runs the scheduled two-to-six-turn conversation without output repair.
8. Verifies one authoritative response renderer and completed assistant turns.
9. Applies a deny-by-default origin policy.
10. Scans the profile for UTF-8, UTF-16LE, and base64 secret representations.
11. Closes Chromium, deletes the physical profile, and verifies deletion.
12. Persists an immutable `tinyrustlm.browser-dogfood-round-v4` receipt.
13. Writes a bounded public-safe job result.

Exit code `0` means a passing preserved receipt, `2` means a preserved failed
round, and `1` means setup or execution could not produce the expected job
result.

## Browser Evidence

A passing browser receipt requires:

- a real passing native qualification parent;
- exact model and composition identity agreement;
- one GET for the configured application-origin `.slm.acg1` route;
- no prompt upload to project hosts;
- no project-hosted `.slm` request;
- no unallowlisted loopback or third-party origin;
- a complete secret scan with zero matches;
- the expected user and assistant message counts;
- exactly one authoritative response node;
- a fresh owned profile before launch;
- successful physical profile deletion.

Failed attempts are immutable evidence. A retry writes another receipt and does
not overwrite the failure.

## Verification

Fast browser and campaign checks:

```powershell
npm --prefix tinyrustlm run test:browser-contract
node --test tinyrustlm/tests/dogfood-campaign.test.js tinyrustlm/tests/vnext-campaign-runner.test.js
node --test tinyrustlm/tests/campaign-evidence-dashboard.test.js
```

The vNext runner command is a local verifier conformance gate. It snapshots
every active campaign receipt and public subject twice, invokes the sole
generated Rust campaign-evidence ABI, and preserves immutable operation and
projection history. Its synthetic complete-capacity case is not a live
campaign run and does not increment any campaign counter. See
`docs/architecture/vnext-campaign-runner.md`.

Rust checks:

```powershell
$env:CARGO_INCREMENTAL = "0"
$env:CARGO_PROFILE_TEST_DEBUG = "0"
cargo test -p tinyrustlm-browser-harness
cargo test -p tinyrustlm-runtime
cargo test -p tinyrustlm-slm-pack
```

Use the lean Cargo environment when disk space is constrained.

## Evidence Status

Local tests prove contract behavior only. They do not prove:

- 20 useful qualified model artifacts exist;
- 50 real browser rounds passed;
- 25 authorized live MemoryEndpoints continuity and cleanup rounds passed;
- 40 lanes completed outside-network transfer proof;
- 20 catalog announcements have authoritative readback;
- physical `linux-arm64` execution occurred;
- packages were published or consumed from a public registry;
- public HTTPS release bytes match an authorized release.

The campaign dashboard must report these as incomplete or externally blocked
until corresponding validated receipts exist. No fixture, loopback probe,
cross-compilation result, or self-asserted status can advance a live gate.

## Related Documentation

- `docs/browser-runtime.md`: browser runtime and evidence boundaries.
- `docs/testing.md`: current test layers and claim limits.
- `models/README.md`: fixture and external-model handling.

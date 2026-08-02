# TinyRustLM Campaign Control Plane Design

## 1. Executive control-plane recommendation
Design an automated **control plane** that treats each phase of the TinyRustLM campaign as a state in a reproducible, evidence-driven pipeline.  The control plane should **orchestrate phases** (source discovery, acquisition, review, conversion, evaluation, qualification, browser tests, memory continuity, P2P sharing, proof, catalog publishing, deployment verification, final archiving) and enforce **strict data provenance** at each step.  Each phase emits a receipt binding the exact inputs (content hashes) and tool versions used, so the entire pipeline is **content-addressable** and auditable.  Use established supply-chain security frameworks (e.g. SLSA) as guidance: pin dependencies, generate SBOMs, produce signed provenance attestations, and scan for malware and secrets.  Employ a hybrid model of automated gates and manual review: automated steps must pass built-in tests, while major milestones (external proof, catalog announcement) require human oversight.  A central database of receipts and states enables resuming the campaign after interruption, and a dashboard reports progress (counts of qualified models, browser rounds, etc.) so operators can easily see where progress is blocked.

## 2. Campaign phase/state diagram
Model the campaign as a **directed state machine** with explicit phases and transitions.  Key states include:
- **Discovered** – sources (model files) have been identified.
- **Acquired** – model sources (3 GB each) fetched (with hash receipts).
- **Reviewed** – license/code review complete (approve or reject).
- **Converted** – source built into intermediate format (with receipt).
- **Evaluated** – native evaluation run (score receipts).
- **Qualified** – model meets quality criteria (binary pass/fail).
- **BrowserTests** – clean-browser (50 rounds per model) executing, each round producing a receipt.
- **MemoryContinuity** – live `MemoryEndpoints` runs (25 rounds).
- **P2PPrep** – models staged for P2P share (split into 2 lanes).
- **P2PProof** – external verification of lane integrity (proof receipts).
- **CatalogAnnounced** – models announced in catalog by 3rd party.
- **Deployed** – deployment checked via HTTPS (live readback).
- **Complete** – all targets met.
- **Blocked** or **Rejected** – terminal states for insurmountable issues.

Allowed transitions include retries on intermittent failures (e.g. network glitches) but **do not skip** failed phases.  For example, a model that fails initial qualification can still allow other models to continue.  There should be explicit **terminal rejection** for models or lanes that can never meet requirements (e.g. license failure) and **external blockage** if a dependency (e.g. external observer) is missing.  Partial success is tracked: e.g. if 18/20 models qualify, the pipeline is incomplete but not entirely failed. This state machine enforces that every phase must produce a receipt before moving on, so no phase is implicitly “passed” without evidence.

## 3. Receipt graph and versioned schema
Implement **content-addressed identities** for each phase’s output.  For example, a receipt might be named by the SHA-256 hash of `(input1 + input2 + toolVersion + parameters)`.  Each receipt includes: input content hashes, tool and runtime versions, configuration parameters, and output hashes.  This tightly **binds evidence to inputs**: changing the evaluator binary (its hash) causes all evaluation receipts to become invalid and require rerun, but does *not* force re-acquisition or re-conversion of models already done correctly.  Chain receipts into a directed graph (similar to SLSA provenance), so you can trace final outputs back through each phase.  Use a versioned JSON schema for receipts to allow future extension.  For example, an acquisition receipt schema records source URL and content hash; an evaluation receipt schema records evaluator version and result hash.  Avoid a single boolean “passed” field; instead record status and attach logs.  This design makes it clear which exact inputs and tool versions produced each result, and any change to a tool or input triggers only the necessary reruns.

## 4. Atomic persistence and resume algorithm
Persist all receipts and intermediate state atomically.  **Write updates in the same directory** (using a tempfile + atomic rename) so that partial writes cannot leave half-corrupt files.  For example, write a receipt to `receipt.tmp`, fsync it to disk, then rename to `receipt.json`. On Windows, use a function like `MoveFileW` (via Go’s `os.Rename`) which is atomic on NTFS if source and destination share a volume. Always `fsync()` files after writing to guarantee durability (so that once a write returns, a crash won’t lose it).  Treat logs or JSON outputs as “bounded” (if large, truncate or chunk to avoid unbounded growth). Keep a rotating **history archive** of past receipts. Track ownership of staging directories so a resume can pick up from the last completed state. On disk-full, fail the write and mark the phase error; don’t silently skip. After a crash or restart, a resume routine should verify each existing receipt’s checksum before trusting it, and recalc large-model hashes by streaming (to handle >2 GB files without loading in memory). Clean up temp and incomplete files on startup (or mark them stale).  This ensures every write is atomic (no partial files) and the entire state can be reliably restored.

## 5. Privacy/redaction contract
Receipt contents must **minimize sensitive information**. Permitted fields include public identifiers (model IDs, URIs), cryptographic hashes, counts, version strings, statuses, timestamps, and bounded error codes.  **Never include**: user prompts or conversation content, any raw credentials or tokens, invitation URLs, secret workspace keys, private file paths, or raw model data/payloads.  Essentially follow OWASP logging guidance: mask or omit session tokens, passwords, PII, secret keys, etc.. For example, if a receipt might capture an API endpoint, ensure no query parameters or auth tokens are logged. Run a **secret-scanning step** on all logs/receipts (using regexes for common key patterns or tools like GitHub’s secret scanning) to prevent accidental exposure. Define redaction tests that reject any log/receipt containing strings like `"token="`, `"Authorization:"`, or private file path patterns. In short, treat receipts like security logs: record operational details (hashes, statuses) but scrub any field that isn’t needed for auditing.

## 6. Blocker matrix with parallel work paths
Define a **taxonomy of blockers** and whether pipeline components can continue in their presence:

- **Insufficient model quality**: If a model fails quantization or has low accuracy, it’s blocked at *Qualification*. Other models continue; engineering may iterate on training, but they cannot use that model until fixed.
- **Unsupported architecture**: E.g. model doesn’t run on `linux-arm64`. Skip ARM64 build for that model, but continue other platforms. The binary-header check fails, but do not block unrelated models/platforms.
- **Acquisition drift**: If fetched source changes (hash mismatch), mark acquisition failed. Re-attempt fetch. Other parts (review, conversion of already fetched models) can continue.
- **License ambiguity**: If a model’s license is unclear at *Review*, that model is rejected. Other models unaffected. Coordinate with legal but do not stall pipeline (just log “license fail”).
- **Evaluator defect**: If the evaluator binary crashes or misbehaves, pause **Evaluation** and downstream phases for all models until fixed. Meanwhile, you can still run independent tasks like preparing P2P lanes.
- **Unavailable training compute**: (if required in workflow) – block any new runs that require heavy compute, but unit/browser tests on existing artifacts can continue.
- **Missing live enrollment contract**: If a live service contract (for MemoryEndpoints) is absent, then MemoryContinuity rounds cannot run; skip to other phases (e.g. catalog publishing of already-validated models).
- **Expired coordinator credential**: If a signing or API credential is expired, block publication and P2P sharing; in the meantime, perform offline steps like generating receipts or preparing announcements.
- **Company cleanup failure**: If a company-specific cleanup in MemoryContinuity fails, block final “cleanup/restore” receipt, but still count it as evidence of failure; you may allow subsequent models to test others.
- **Absent external observer**: If an outside party must witness P2P proof and is unreachable, block P2PProof phase; other flows (like writing SBOMs) can proceed.
- **Unreachable P2P lane**: If a peer node is offline, attempt alternate hosts or skip that lane (if possible, but flag as partial).
- **Stale proof**: If an existing external proof is too old, require re-generation. Blocking P2P completion until refreshed; however, you can proceed with announcement if proofs can be updated in parallel.
- **Catalog rejection**: If the central catalog denies an announcement, treat it as failed proof/publication; you must fix the catalog metadata before finishing. Other tasks cannot truly finish since announcement is a goal.
- **No signing credential**: Block publishing (NuGet/site) – you can still prepare packages and tests, but cannot mark models announced or deployed.
- **Deployment mismatch**: If live deployment does not match release artifacts, block “complete” state. Other tasks (like cleanup) might still be doable.

In general, for each blocker we specify which states are frozen. E.g. if evaluation breaks, you can still complete any browser rounds or pack libraries for already-qualified models. This matrix ensures “blocked” conditions do not falsely advance the campaign; they only halt or isolate portions of work.

## 7. Test and release gate matrix by component and RID
Define **quality gates** for every artifact and platform. For each component (Rust library, WASM assets, browser UI, C ABI, C# wrapper, NuGet packages, companion archives, MiniModel metadata, website content), require layered testing:

- **Unit tests** (Rust’s `cargo test`, C# unit tests, browser JS/TS unit tests). All must pass on each platform.
- **Integration tests** (combine components, e.g. loading the Rust library into the C# wrapper, or calling the WASM module from a browser test).
- **Fuzz tests** (where applicable, e.g. fuzz the evaluator or parser code).
- **Package-consumer tests** (install the NuGet package in a sample project to ensure it restores and runs).
- **Browser tests** (automated headless or real-browser tests running the WebAssembly UI with sample conversations).
- **Cross-platform tests**: For each RID (`win-x64`, `linux-x64`, `linux-arm64`), ensure the build compiles (cross-compilation) and at least smoke-runs on appropriate environment. QNX advises that cross-compiled binaries should still be run on their target when possible. For PR builds, an emulator (e.g. QEMU) might suffice for smoke-checking, but **release gates** require at least one clean run on real hardware or a CI runner of that RID.
- **Fuzz or stress tests** specifically for the new models.
- **Authorized live tests**: 50 browser conversations with company-approved test accounts (“clean rounds”), and 25 live MemoryEndpoints runs with actual cloud resources. These must succeed and each produce a signed receipt.

Each gate only closes when evidence (test-pass receipt) is collected for that RID/component. For example, a Windows build is not “passing” until the Windows integration tests and NuGet consumer tests pass. The dashboard only marks models as qualified when **all** required gates (unit, integration, packaging, cross-platform, fuzz) have passed. In summary, apply the test pyramid: fast unit/lint first, then heavier integration and cross-platform execution.

## 8. Supply-chain and publication controls
Enforce **SLSA-style supply-chain hygiene**: pin all dependencies (check in `Cargo.lock`, NuGet lockfiles, `packages.lock.json`, etc), and record repository metadata (commit hashes) for each build. Use SourceLink with Portable PDBs and publish symbol packages (.snupkg) so consumers can debug legally. (NuGet.org only accepts portable PDBs and new symbol package format.)
Generate SBOMs for every package (e.g. SPDX or CycloneDX) and publish signed **provenance** attestations (e.g. via Sigstore/Cosign) so anyone can verify our artifacts were built from known source. Sign all final artifacts (e.g. releases, binaries) with a secure key; require that key not be present on build agents (use offline signing or Keyless Sigstore). Run malware scans on published packages. Maintain an **allowlist** of approved third-party components; block any unknown binary blobs via hash verification. For container/web assets, use Content Security Policy and Subresource Integrity.
Strictly avoid secrets: do not embed API keys or tokens in code or config. Use a secret scanner on all code and commit pipelines. When publishing, traverse archives and verify no private files slip in (for example, ensure `*.snupkg` only contains .pdb, .xml per NuGet policy). Keep artifacts in write-once archives for retention. Implement rollback only by explicit script (no automatic down-grade). Finally, gate any publication step by a human review/authorization process (e.g. signing credential present, PGP signature or Org service audit) to ensure nothing goes out without oversight.

## 9. Progress dashboard specification
Build an operator dashboard summarizing campaign progress. It should display, for example:

- **Qualified models:** X/20 (distinct model hashes qualified)
- **Browser rounds:** Y/50 completed (with receipts)
- **Memory rounds:** Z/25 completed (with live cleanup receipts)
- **P2P lanes proven:** L/40 (two lanes per model, so 20×2 = 40 proofs)
- **Announcements:** A/20 (models successfully announced in catalog)
- **Current step:** Which model and phase is actively running (e.g. “Converting model 5”)
- **Elapsed time:** Total run time since last (resume start)
- **Resumable state:** The last checkpoint (phase name and completed steps)
- **Blockers:** Active block conditions (with brief description, e.g. “Evaluator crash on model 3”).

Use gauges or progress bars for each “out of” count. The dashboard must not show “Done” until **all** tiers of testing are complete (including live MemoryEndpoints and external proof). As one article notes, a 100% unit-test pass rate is *not* sufficient evidence by itself. In particular, do **not** mark a model done just because its unit tests passed; the dashboard only increments a model’s final status when the full pipeline (qualification, browser, memory, proof, announcement) has succeeded. This clear reporting helps spot which metrics are lagging (e.g. models qualified but awaiting announcement) and when external inputs are needed (e.g. “Awaiting External Observer”).

## 10. Failure-to-regression workflow
When a campaign run uncovers a defect (evaluator bug, UI duplication, memory leak, source mismatch, P2P drift, etc.), follow a forensic workflow:

1. **Preserve Failure Evidence:** Immediately archive all failing test logs, transcripts, core dumps, network captures, screenshots, etc. Tag the campaign state as “failed at phase X” without deleting artifacts.
2. **Diagnose & Isolate:** Compare the failure run to the last passing run (same hardware/rules) to isolate the cause. E.g. if UI layout changed, confirm it was a code change.
3. **Add Regression Test:** If a real bug is confirmed, *add a deterministic test* that would catch it in future runs. (Industry practice: whenever you fix a bug, add a regression test for it.) For example, if a new model triggers a memory leak, write a small reproduce case that is runnable in CI.
4. **Scoped Fix:** Apply the patch or config change to fix the issue. Keep the fix localized (do not disable unrelated features).
5. **Rerun Invalidated Phases:** Only rerun phases whose inputs or tools changed. For instance, changing the UI code may only require rerunning browser tests and deployment checks, not model qualification. Reuse saved receipts where possible.
6. **Review & Close:** Once fixed and re-tested, update the failure ticket with details. Amend documentation or model criteria if needed (e.g. “Model must pass new QA check”). Store a note in the project wiki about the issue and fix. Finally, resume the campaign from the failure point using the updated pipeline.

In short, treat the failure as a learning opportunity (often called “bug intelligence”): it is not enough that a test failed; we must turn it into structured evidence (logs + code diff + new test) so it never recurs. This approach ensures future runs are stronger and that bugs get diagnosed quickly instead of ignored.

## 11. Final acceptance checklist with objective evidence
Before declaring the campaign complete, verify each acceptance criterion with evidence:

- **20 qualified model hashes**: Confirm there are 20 *distinct* model hashes each with a successful qualification receipt.
- **50 browser receipts**: Each of the 20 models produced 2.5 rounds on average; verify all 50 clean-browser test receipts exist and passed deletion-restore checks.
- **25 live memory receipts**: Ensure all 25 MemoryEndpoints cleanup-and-restore runs succeeded with receipts.
- **40 external proof receipts**: Two P2P proof receipts per model (20 models × 2 lanes = 40), all current.
- **20 announcements**: Each model has an associated catalog announcement recorded (with any signature or ID from the publisher).
- **Package verifications**: All NuGet symbols and packages have been published and successfully restored by a downstream consumer (proof: an automated install or symbol fetch test).
- **Public HTTPS readback**: Download each published model (or asset) via HTTPS from the catalog/website and verify its hash matches the release artifact (or query MiniModel JSON).
- **No secrets exposed**: Run the final set of logs/receipts through the secret scanner one last time to ensure no credentials leaked.
- **Remaining-risk section**: Document any known risks that were not eliminated (e.g. “Lane proof relies on external observer trust”, “Rolling releases may drift if new tenants join”).

Only once every bullet above has concrete evidence (receipts or logs) should the campaign be declared done. All receipts are timestamped and retained; none are overwritten or discarded. No evidence is faked or skipped: e.g. running a model on an emulator does not count as real ARM64 evidence. This stringent checklist ensures the release is fully traceable and auditable.

## 12. Prioritized implementation plan
A phased rollout of this control plane might be:
1. **Receipt framework**: Define JSON schemas and implement content-hash binding for one or two phases (e.g. acquisition and conversion).
2. **Phase state machine**: Implement orchestration logic for first 3 phases (source discovery, acquisition, review) with resume support.
3. **Atomic persistence utilities**: Build shared library routines for safe file writes, checksumming, fsyncing, and resuming.
4. **Testing harness**: Set up CI workflows for core tests (unit/integration) including cross-compilation, containerization for ARM.
5. **Evidence collection**: Integrate receipt generation into each CI step (hash inputs, log versions).
6. **Dashboard**: Build a minimal web dashboard or console report showing counts (models qualified, tests done).
7. **Run mock campaign**: Use known models to exercise entire pipeline, debug failures, tune timeouts.
8. **Blocker handling**: Implement detection of known block conditions (e.g. missing credentials cause pipeline abort).
9. **External sharing**: Integrate with P2P toolchain for lane proof, and prepare sample catalog announcements for testing.
10. **Full scale test**: Execute the campaign on all 20 models with external observers, finalize gaps, then cut over to actual release process.

Prioritize building the core state machine and receipt logic first (items 1–3), since all else depends on reliable persistence and identity. Then layer in testing automation (items 4–6), and finally fill in blockers, P2P, and publication (7–10). Each increment should be end-to-end testable on a subset of models.

## 13. Unknowns requiring local or authorized access
Certain details cannot be answered from public sources alone and will need in-house knowledge or privileged access. These include:
- **Exact model sources** and any non-public license terms for TinyRustLM models.
- **Internal live credentials** (e.g. signing keys, deployment keys, company-specific API keys).
- **Production `MemoryEndpoints` contract** and test accounts for live cleanup.
- **The full specification of “external proof”**: who the third parties are and how they attest.
- **Network details for P2P lanes** (hostnames/IPs) beyond publicly accessible info.
- **Company cleanup/restore procedures**: any proprietary steps to restore state.
- **Any internal rubric for “model quality”** beyond general criteria.
- **Corporate policies on data retention, fallback procedures, or audit processes**.

These are out of scope for the public design and must be filled in by the authorized release/test teams.

## 14. Annotated primary-source bibliography
- **SLSA (Supply-chain Levels for Software Artifacts)**, *OpenSSF*, 2026. The SLSA specification defines provenance and supply-chain security best practices.
- **OWASP Logging Cheat Sheet** (OWASP Foundation, n.d.). Guidance on redacting sensitive data from logs (tokens, passwords, PII).
- **Secure Pipelines – *Build Integrity and Reproducible Builds*** (SecurePipelines blog, ©2026). Defines CI levels; Level 1 requires pinned deps and lockfiles for reproducibility.
- **Harness Blog – *CI Testing: Types, Best Practices, and Tools***, March 25, 2026. Recommends clear quality gates with layered tests (unit, integration, etc.).
- **Martin Häusler – *Towards Atomic File Modifications***, Dev.to, Sep 23, 2018. Discusses fsync and durability requirements; highlights that `fsync()` must be used after writes for durability.
- **Stack Overflow: “Is there an OS-independent way to atomically overwrite a file?”** (Apr 12, 2017). Explains that renaming a temp file into place is atomic on Linux and on NTFS Windows if on same volume.
- **Ken Muse – *An Introduction to SourceLink***, KenMuse.com, Aug 17, 2023. Recommends using SourceLink with Portable/embedded PDBs and symbol servers (NuGet) for full debug traceability.
- **Microsoft – *Creating symbol packages (.snupkg)***, docs.microsoft.com, last updated May 5, 2026. Details how NuGet uses .snupkg symbol packages and only supports Portable PDBs.
- **Axify Blog – *CI/CD Metrics***, Jan 30, 2025. Notes that 100% build pass may still miss defects and stresses pairing success rates with test coverage.
- **TestZeus Blog – *Bug Intelligence in Software Testing***, May 21, 2026. Emphasizes that a failed test is an alert, not a bug report, and teams must correlate failures to causes for fixes.
- **StackExchange (Software Eng.) – *“How to deal with a bug which seems to have fixed itself?”***, Dec 1, 2015. Advises reproducing bugs in older versions and adding regression tests when closing them.
- **QNX Porting Guide – *Native Compiler vs Cross Compiler*** (QNX Documentation, n.d.). Recommends running tests on the target system even when cross-building.

Each source above is cited where relevant; dates and authors are given when available. This bibliography provides evidence for best practices cited throughout the design.
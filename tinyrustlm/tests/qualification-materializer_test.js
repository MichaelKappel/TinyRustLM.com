"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const owner = require("../tools/qualification-materializer.js");
const capture = require("../tools/real-composition-execution.js");
const graph = require("../tools/acg2-reference.js");
const admission = require("../app/browser-model-admission.js");
const loader = require("../app/catalog-admission-loader.js");
const scratch = require("../tools/canonical-operation-scratch.js");
const ROOT = path.resolve(__dirname, "../..");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const bytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

/** Metadata-only request fixture; none of these nonexistent inputs can qualify a model. */
function request() {
  return { schema: owner.SCHEMA, sourceCommit: "1".repeat(40), issuedAtUtc: "2026-09-29T23:00:00Z",
    compositionRoot: "D:\\LLMs\\TinyRustLM\\never-executed-qualification-fixture",
    outputDirectory: "E:\\Source\\Rust\\TinyRustLM.com\\artifacts\\verification\\never-executed-qualification-fixture",
    defaultSampling: {}, evidence: Object.fromEntries(owner.EVIDENCE.map((name) => [name,
      { path: `artifacts/verification/never-executed-${name}.json`, bytes: 1, sha256: "2".repeat(64) }])) };
}

test("qualification request requires the exact evidence closure and immutable identities", () => {
  assert.equal(owner.validateRequest(request()).schema, owner.SCHEMA);
  for (const mutate of [
    (r) => { r.force = true; }, (r) => { r.schema = "old"; }, (r) => { r.sourceCommit = "HEAD"; },
    (r) => { r.issuedAtUtc = "today"; }, (r) => { delete r.evidence.sourceRaw; },
    (r) => { r.evidence.review.path = "artifacts/../private.json"; },
    (r) => { r.evidence.review.path = "C:/private.json"; },
    (r) => { r.evidence.review.bytes = 0; }, (r) => { r.evidence.review.bytes = 33554433; },
    (r) => { r.evidence.review.sha256 = "invalid"; }
  ]) { const input = request(); mutate(input); assert.throws(() => owner.validateRequest(input), /qualification-/); }
});

test("an explicit verdict alone cannot create a qualification receipt", () => {
  assert.throws(() => owner.validateEvidence(request(), { review: { schema: owner.REVIEW_SCHEMA,
    reviewer: { id: "fixture", role: "test", reviewedAtUtc: "2026-09-29T22:00:00Z" },
    qualityClaim: "task-specific-qualified", qualityScope: "public-release-cases", releaseStatus: "not-released",
    bindings: {} } }, {}), /qualification-review-bindings/);
});

/** Build an in-memory synthetic evidence graph solely to test validation; no model or receipt file is published. */
function fixture() {
  const r = request(), docs = {};
  const identity = (file) => ({ path: file, bytes: 1, sha256: hash(file) });
  docs.sourceCases = null;
  docs.sourceLock = { schema: "tinyrustlm.qwen3_source_lock.v1", modelId: "Fixture/Not-A-Model", revision: "3".repeat(40),
    licenseSpdx: "MIT", licenseDisposition: "redistribution-and-conversion-approved",
    files: { model: { path: "model.safetensors", byteLength: 1, sha256: hash("non-model") },
      config: { path: "config.json", byteLength: 1, sha256: hash("config") },
      license: { path: "LICENSE", byteLength: 1, sha256: hash("license") } } };
  docs.sourceRaw = { schema: "tinyrustlm.reference_raw_quality.v4", source_model_id: docs.sourceLock.modelId,
    source_revision: docs.sourceLock.revision, generation_contract: "one-call-unmodified-v1", generation_retries_allowed: false,
    response_repairs_allowed: false, field_assembly_allowed: false, expected_answer_injection_allowed: false, adapter: null,
    eval_cases_sha256: r.evidence.sourceCases.sha256, checkpoint_artifacts: Object.fromEntries(Object.values(docs.sourceLock.files)
      .filter((item) => item.path !== "LICENSE").map((item) => [item.path, { bytes: item.byteLength, sha256: item.sha256 }])),
    case_count: 1, cases: [{ index: 0, generation_call_count: 1, output_transform: "none", raw_output_text: "synthetic source" }] };
  docs.structural = { schema: "tinyrustlm.qwen3_composition_conversion_receipt.v1", status: "pass", structuralCompositionStatus: "verified",
    source: { modelLockSha256: "", relationshipStatus: "exact" }, artifacts: capture.MEMBERS.map((file, ordinal) => ({
      ordinal, file, byteLength: [64, 64, 64, 65800, 512, 896][ordinal], sha256: hash(file),
      formatProfileSha256: admission.artifactSpecs[ordinal].profileSha256 })) };
  const acg = graph.parseGraph(graph.writeGraph(docs.structural.artifacts.slice(0, 5).map((item, index) => ({ ordinal: index,
    role: admission.artifactSpecs[index].role, format: admission.artifactSpecs[index].format, artifactBytes: item.byteLength,
    artifactSha256: item.sha256, formatProfileSha256: item.formatProfileSha256 }))));
  docs.structural.artifacts[5].sha256 = acg.artifactSha256;
  docs.structural.graph = { graphIdentitySha256: acg.graphIdentitySha256, memberTableSha256: acg.memberTableSha256,
    resolvedMemberBytes: acg.resolvedMemberBytes };
  docs.evalCases = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts/ecosystem-cleanup-20260912/default-release-acceptance-cases-20260929.json")));
  const sampling = { temperatureMillionths: 0, topK: 1, topPMillionths: 1000000, repetitionPenaltyMillionths: 1000000,
    repetitionWindow: 0, maximumNewTokens: 96 };
  r.defaultSampling = { ...sampling };
  const p = docs.executionRequest = { schema: capture.SCHEMA, sourceCommit: r.sourceCommit, operationId: "4".repeat(64),
    compositionId: acg.graphIdentitySha256, compositionRoot: r.compositionRoot, outputDirectory: r.outputDirectory,
    members: docs.structural.artifacts.map((item) => ({ name: item.file, bytes: item.byteLength, sha256: item.sha256 })),
    tools: { dotnet: identity(process.execPath), native: identity(path.join(ROOT, "artifacts/native.dll")), browser: identity(process.execPath),
      managed: capture.MANAGED.map((name) => identity(path.join(ROOT, "artifacts/probe", name))),
      assets: capture.ASSETS.map((name) => identity(path.join(ROOT, "tinyrustlm", name))) },
    policy: { maximumModelBytes: 1024, maximumSequenceTokens: 1024, maximumKvBytes: 1024, maximumScratchBytes: 1024,
      maximumResolvedMemberBytes: 2 * 1024 * 1024, maximumResidentDependencyBytes: 1024 * 1024,
      maximumRequestBytes: 1054848, maximumLinearMemoryBytes: 3 * 1024 * 1024 },
    cases: [], browserViewports: [{ id: "desktop", width: 1440, height: 900, isMobile: false },
      { id: "mobile", width: 375, height: 812, isMobile: true }], totalDeadlineMilliseconds: 3600000 };
  p.tools.assets[3].bytes = 8;
  const review = docs.review = { schema: owner.REVIEW_SCHEMA, reviewer: { id: "test-only-reviewer", role: "fixture",
    reviewedAtUtc: "2026-09-29T22:55:00Z" }, qualityClaim: "task-specific-qualified", qualityScope: "public-release-cases",
    releaseStatus: "not-released", bindings: {}, license: { status: "redistribution-approved", spdx: "MIT",
      rationale: "Synthetic validator fixture, not a license approval.", evidence: [{ ...r.evidence.sourceLock }] },
    sourceCases: [{ index: 0, verdict: "pass", reason: "Synthetic test decision.", rawOutputSha256: hash("synthetic source") }],
    acceptanceTurns: [], backendCases: [] };
  for (const item of docs.evalCases.cases) item.turns.forEach((turn, index) => {
    const id = `${item.id}-${index}`;
    p.cases.push({ id, conversation: item.id, historyFrom: index ? `${item.id}-${index - 1}` : null,
      messages: index ? [{ role: "user", content: turn.user }] : [{ role: "system", content: docs.evalCases.generation.systemPrompt },
        { role: "user", content: turn.user }], sampling: { ...sampling, maximumNewTokens: turn.maximumNewTokens },
      seed: "20260929", transcriptRevision: index, resetBefore: index === 0, cancelAfterSteps: null, deadlineMilliseconds: 180000 });
    review.acceptanceTurns.push({ caseId: item.id, turnIndex: index, executionCaseId: id });
  });
  for (const [id, cancelAfterSteps, resetBefore] of [["stop", 1, true], ["next", null, false], ["reset", null, true]]) {
    p.cases.push({ id, conversation: "interaction", historyFrom: null, messages: [{ role: "user", content: id }], sampling,
      seed: "20260929", transcriptRevision: p.cases.length, resetBefore, cancelAfterSteps, deadlineMilliseconds: 180000 });
  }
  /** Fixture records imitate the wire contract only; their text is deliberately not graded as useful. */
  function backend(id, viewport) {
    const records = [];
    for (const item of p.cases) {
      const text = `synthetic ${item.id}`;
      records.push({ ...capture.caseRequest(item, records), capture: { id: item.id, status: "captured", errorCode: null,
        elapsedMilliseconds: 50, firstEmittedTokenMilliseconds: 10, cancellationRequested: item.cancelAfterSteps !== null,
        cancellationLatencyMilliseconds: item.cancelAfterSteps === null ? null : 5,
        steps: [{ elapsedMilliseconds: 10, step: { emittedTokenId: 7 } }, { elapsedMilliseconds: 20, step: { emittedTokenId: 8 } }],
        output: { text, tokenIds: [7, 8], status: { kind: item.cancelAfterSteps === null ? "stop-token" : "cancelled" },
          operationId: p.operationId, composition: { artifactBytes: 896, artifactSha256: acg.artifactSha256,
            graphIdentitySha256: acg.graphIdentitySha256, memberTableSha256: acg.memberTableSha256 } } } });
      review.backendCases.push({ backend: id, caseId: item.id, verdict: "pass", reason: "Synthetic test decision, not model quality.", rawOutputSha256: hash(text) });
    }
    const common = { status: "captured", modelQualified: false, records,
      activations: p.cases.filter((item, index) => index === 0 || item.resetBefore).map(() => ({ elapsedMilliseconds: 10 })) };
    return viewport ? { ...common, schema: "tinyrustlm.browser-conversation-capture/1", viewport, browserVersion: "test-only", errors: [] } :
      { ...common, schema: "tinyrustlm.native-conversation-capture/1", cases: records.map((item) => item.capture), exit: { code: 0, signal: null } };
  }
  docs.execution = { schema: "tinyrustlm.real-composition-execution/1", status: "captured-not-graded", modelQualified: false,
    failures: [], startedAtUtc: "2026-09-29T22:30:00Z", finishedAtUtc: "2026-09-29T22:45:00Z", native: backend("native"),
    hardware: { platform: "win32", architecture: "x64", cpuModel: "Synthetic fixture", logicalProcessors: 1,
      totalMemoryBytes: 1024, nodeVersion: "test-only" },
    browser: p.browserViewports.map((viewport) => backend(`browser:${viewport.id}`, viewport)) };
  docs.numericalProfile = { candidate: { modelId: docs.sourceLock.modelId, revision: docs.sourceLock.revision,
    sourceLock: {}, modelSlm2: { byteLength: 64, sha256: docs.structural.artifacts[0].sha256 },
    compositionResult: { path: "artifacts/verification/never-executed-conversion-result.json", byteLength: 1, sha256: hash("separate-result") } } };
  docs.numericalRegistration = { ownerContract: { operationId: "numerical-test", requests: { verification: { differentialProfile: {} } } } };
  docs.numericalRequest = { operationId: "numerical-test", registrationSha256: hash("registration") };
  docs.numericalVerifier = { schema: "tinyrustlm.qwen3_numerical_trace_verification_receipt.v1", operationId: "numerical-test",
    status: "pass", registrationSha256: hash("registration"), comparison: { firstDivergence: null,
      arrowResults: [{ id: "source-to-reconstructed", status: "pass" }, { id: "reconstructed-to-scalar", status: "pass" }] }, writesPerformed: false };
  docs.numericalOwner = { schema: "tinyrustlm.qwen3_numerical_execution_terminal.v1", operationId: "numerical-test", status: "terminal-pass",
    launchedStages: ["source", "reconstructed", "scalar", "verifier"], launchCounts: { source: 1, reconstructed: 1, scalar: 1, verifier: 1 },
    registration: { sha256: hash("registration") }, immutableClosure: { retryAllowed: false, overwriteAllowed: false,
      repairAllowed: false, partialOutputCleanupAllowed: false, thresholdChangeAllowed: false, failedOutputAdoptionAllowed: false } };
  /** Bind bytes in dependency order; no copied status can stand in for a required evidence digest. */
  function bind(name) { const b = bytes(docs[name]); r.evidence[name] = { ...r.evidence[name], bytes: b.length, sha256: hash(b) }; }
  bind("sourceLock"); bind("sourceRaw"); bind("evalCases"); bind("executionRequest");
  docs.structural.source.modelLockSha256 = r.evidence.sourceLock.sha256; bind("structural");
  docs.execution.requestSha256 = r.evidence.executionRequest.sha256; bind("execution");
  docs.numericalProfile.candidate.sourceLock = { byteLength: r.evidence.sourceLock.bytes, sha256: r.evidence.sourceLock.sha256 };
  bind("numericalProfile");
  docs.numericalRegistration.ownerContract.requests.verification.differentialProfile.sha256 = r.evidence.numericalProfile.sha256;
  bind("numericalRegistration");
  docs.numericalRequest.registrationSha256 = r.evidence.numericalRegistration.sha256;
  docs.numericalVerifier.registrationSha256 = r.evidence.numericalRegistration.sha256;
  docs.numericalOwner.registration = { byteLength: r.evidence.numericalRegistration.bytes, sha256: r.evidence.numericalRegistration.sha256 };
  bind("numericalRequest");
  docs.numericalVerifier.request = { byteLength: r.evidence.numericalRequest.bytes, sha256: r.evidence.numericalRequest.sha256 };
  docs.numericalVerifier.differentialProfile = { byteLength: r.evidence.numericalProfile.bytes, sha256: r.evidence.numericalProfile.sha256 };
  bind("numericalVerifier"); docs.numericalOwner.verifierReceipt = structuredClone(docs.numericalVerifier); bind("numericalOwner");
  review.bindings = Object.fromEntries(owner.EVIDENCE.filter((name) => name !== "review").map((name) => [name, r.evidence[name].sha256]));
  bind("review");
  return { r, docs, rechecked: structuredClone(docs.numericalVerifier) };
}

test("complete metadata-only evidence produces the unchanged admission shape and limited claim", () => {
  const f = fixture(), result = owner.validateEvidence(f.r, f.docs, f.rechecked);
  const parsed = admission.parseAdmissionText(result.admissionText);
  assert.equal(result.releaseReady, false);
  assert.equal(parsed.modelId, "Fixture/Not-A-Model");
  assert.equal(parsed.runtime.wasmSha256, f.docs.executionRequest.tools.assets[3].sha256);
  assert.equal(parsed.qualification.qualityClaim, "task-specific-qualified");
  assert.equal(JSON.parse(result.receiptText).compositionId, `sha256:${f.docs.executionRequest.compositionId}`);
});

test("emitted admission and receipt pass the unchanged public loader using only closed in-memory routes", async () => {
  const f = fixture(), result = owner.validateEvidence(f.r, f.docs, f.rechecked);
  const a = JSON.parse(result.admissionText), receipt = JSON.parse(result.receiptText);
  const view = { entryId: "fixture/not-a-model", displayName: "Validator fixture", description: "Not a real qualification",
    source: { repository: a.modelId, revision: f.docs.sourceLock.revision, sourceLockSha256: `sha256:${f.r.evidence.sourceLock.sha256}` },
    license: {}, profiles: {}, availability: "unavailable", availabilityLabel: "Not published", peerCount: 0, peers: [],
    composition: { compositionId: receipt.compositionId, memberCount: 6, members: a.artifacts.map((item) => ({
      name: item.fileName, bytes: item.byteCount, sha256: `sha256:${item.sha256}`, schema: item.format })) },
    browserAdmission: { schema: a.schema, route: "/catalog/admission.json", bytes: Buffer.byteLength(result.admissionText),
      sha256: `sha256:${hash(result.admissionText)}` }, qualification: { status: "qualified", receiptId: receipt.receiptId,
      receiptRoute: "/catalog/qualification.json", receiptBytes: Buffer.byteLength(result.receiptText),
      receiptSha256: `sha256:${hash(result.receiptText)}`, numericalStatus: "passed", browserStatus: "passed", qualityStatus: "qualified" },
    catalogAuthority: { catalogId: "fixture/not-published", revision: 1, generatedAtUtc: f.r.issuedAtUtc, validUntilUtc: "2026-09-30T00:00:00Z" } };
  const routes = new Map([["https://minimodel.org/catalog/admission.json", result.admissionText],
    ["https://minimodel.org/catalog/qualification.json", result.receiptText]]), calls = [];
  const loaded = await loader.load({ catalogView: view, catalogBaseUrl: "https://minimodel.org/catalog/compositions.v1.json",
    admissionParser: admission, crypto: crypto.webcrypto, fetch: async (url) => {
      assert.ok(routes.has(url)); calls.push(url); const body = routes.get(url);
      return new Response(body, { headers: { "Content-Length": String(Buffer.byteLength(body)) } }); } });
  assert.equal(calls.length, 2); assert.equal(loaded.admission.modelId, a.modelId);
  assert.equal(loaded.qualificationReceipt.qualityScope, "public-release-cases");
});

test("source, structural, numerical and explicit review guards reject mixed or failed evidence", () => {
  for (const [mutate, error] of [
    [(f) => { f.docs.review.reviewer.id = ""; }, /qualification-review/],
    [(f) => { f.docs.review.bindings.sourceRaw = "0".repeat(64); }, /review-binding/],
    [(f) => { f.docs.sourceLock.licenseDisposition = "unknown"; }, /source-lock/],
    [(f) => { f.docs.sourceLock.modelId = "Qwen\/Qwen3-0.6B"; f.docs.sourceLock.revision = "c1899de289a04d12100db370d81485cdf75e47ca"; }, /source-excluded/],
    [(f) => { f.docs.sourceRaw.response_repairs_allowed = true; }, /source-raw/],
    [(f) => { f.docs.sourceRaw.checkpoint_artifacts["config.json"].sha256 = hash("other"); }, /source-file-binding/],
    [(f) => { f.docs.review.license.status = "unreviewed"; }, /license-review/],
    [(f) => { f.docs.review.sourceCases = []; }, /source-review-coverage/],
    [(f) => { f.docs.review.sourceCases[0].rawOutputSha256 = hash("other"); }, /source-review/],
    [(f) => { f.docs.structural.source.modelLockSha256 = hash("other"); }, /conversion-source/],
    [(f) => { f.docs.structural.artifacts[0].formatProfileSha256 = hash("other"); }, /structural/],
    [(f) => { f.docs.structural.graph.graphIdentitySha256 = hash("other"); }, /graph-binding/],
    [(f) => { f.docs.numericalOwner.status = "terminal-failure"; }, /numerical-terminal/],
    [(f) => { f.docs.numericalOwner.verifierReceipt.status = "fail"; }, /numerical-terminal/],
    [(f) => { f.docs.numericalOwner.registration.byteLength++; }, /numerical-registration/],
    [(f) => { f.rechecked.status = "fail"; }, /numerical-recheck/],
    [(f) => { f.docs.numericalProfile.candidate.modelSlm2.sha256 = hash("other"); }, /numerical-candidate/],
    [(f) => { f.docs.numericalProfile.candidate.compositionResult.path = "../private.json"; }, /reference/]
  ]) { const f = fixture(); mutate(f); assert.throws(() => owner.validateEvidence(f.r, f.docs, f.rechecked), error); }
});

test("all real backends, exact turns, actual history, cancellation and measured limits are mandatory", () => {
  for (const [mutate, error] of [
    [(f) => { f.docs.execution.status = "failed"; }, /execution/],
    [(f) => { f.docs.execution.hardware = {}; }, /execution-hardware/],
    [(f) => { f.docs.executionRequest.compositionId = hash("other"); }, /execution-composition/],
    [(f) => { f.r.defaultSampling.maximumNewTokens = 90; }, /untested-default-sampling/],
    [(f) => { f.docs.evalCases.boundary.holdoutClaim = true; }, /acceptance-contract/],
    [(f) => { f.docs.review.acceptanceTurns.pop(); }, /acceptance-coverage/],
    [(f) => { f.docs.executionRequest.cases[0].messages[1].content = "changed"; }, /acceptance-input/],
    [(f) => { f.docs.executionRequest.cases.find((c) => c.id === "stop").cancelAfterSteps = 0; }, /interaction-plan/],
    [(f) => { f.docs.execution.browser[0].errors.push({ kind: "pageerror" }); }, /browser-coverage/],
    [(f) => { f.docs.execution.native.exit.code = 1; }, /backend-coverage/],
    [(f) => { f.docs.execution.native.records.pop(); }, /backend-status/],
    [(f) => { f.docs.execution.native.records[0].requestSha256 = hash("other"); }, /wire-binding/],
    [(f) => { f.docs.execution.native.records[0].capture.output.operationId = hash("other"); }, /output-identity/],
    [(f) => { f.docs.review.backendCases.pop(); }, /backend-coverage/],
    [(f) => { f.docs.review.backendCases[0].verdict = "fail"; }, /semantic-review/],
    [(f) => { f.docs.execution.native.records[0].capture.elapsedMilliseconds = 180001; }, /turn-latency/],
    [(f) => { f.docs.execution.native.records[0].capture.firstEmittedTokenMilliseconds = 30001; }, /first-token/],
    [(f) => { f.docs.execution.native.records[0].capture.steps[0].elapsedMilliseconds = -1; }, /step-timing/],
    [(f) => { const c = f.docs.execution.native.records[0].capture; c.elapsedMilliseconds = 2500; c.steps[1].elapsedMilliseconds = 2010; }, /decode-rate/],
    [(f) => { f.docs.execution.native.records.find((c) => c.id === "stop").capture.cancellationLatencyMilliseconds = 2001; }, /cancellation/],
    [(f) => { f.docs.execution.native.records[0].capture.output.status.kind = "cancelled"; }, /unexpected-cancellation/],
    [(f) => { f.docs.review.reviewer.reviewedAtUtc = "2026-09-29T22:40:00Z"; }, /review-completeness/]
  ]) { const f = fixture(); mutate(f); assert.throws(() => owner.validateEvidence(f.r, f.docs, f.rechecked), error); }
});

/** Original scratch ownership is retained; only this test's own metadata files are retired. */
function owned(action) {
  const value = scratch.createOwnedTemporaryDirectory({ temporaryParent: path.join(ROOT, "artifacts/tests/qualification-materializer") });
  try { return action(value.rootPath); } finally { scratch.removeOwnedTemporaryDirectory(value); }
}

test("canonical metadata reader binds raw bytes and rejects traversal, drift and invalid JSON", () => owned((root) => {
  const file = path.join(root, "metadata.json"), value = bytes({ evidence: "test only" }); fs.writeFileSync(file, value);
  const ref = { path: path.relative(ROOT, file).replaceAll("\\", "/"), bytes: value.length, sha256: hash(value) };
  assert.deepEqual(owner.readReference(ref).value, { evidence: "test only" });
  assert.deepEqual(owner.readReference(ref, false).bytes, value);
  assert.throws(() => owner.readReference({ ...ref, path: "artifacts/../private" }), /qualification-reference/);
  assert.throws(() => owner.readReference({ ...ref, sha256: hash("other") }), /execution-file-changed/);
  fs.writeFileSync(file, "invalid");
  assert.throws(() => owner.readReference({ ...ref, bytes: 7, sha256: hash("invalid") }), SyntaxError);
}));

test("retained native protocol and each exact request/capture must agree with the summary", () => owned((root) => {
  const f = fixture(), p = f.docs.executionRequest, report = f.docs.execution; p.outputDirectory = root;
  fs.writeFileSync(path.join(root, "request.json"), bytes(p));
  const { records, exit, ...terminal } = report.native;
  const events = [{ kind: "ready" }, ...records.flatMap((record) => [{ kind: "case-started", id: record.id },
    { kind: "case", value: record.capture }]), { kind: "terminal", value: terminal }];
  fs.writeFileSync(path.join(root, "native.stdout.bin"), events.map((item) => `${JSON.stringify(item)}\n`).join(""));
  fs.writeFileSync(path.join(root, "native.stderr.bin"), "");
  for (const backend of [{ id: "native", records }, ...report.browser.map((b) => ({ id: `browser-${b.viewport.id}`, records: b.records }))]) {
    for (const record of backend.records) { const { capture: ignored, ...wire } = record;
      fs.writeFileSync(path.join(root, `${backend.id}-${record.id}.request.json`), bytes(wire));
      fs.writeFileSync(path.join(root, `${backend.id}-${record.id}.capture.json`), bytes(record)); }
  }
  assert.equal(owner.verifyRawCapture(p, report).length, 3 + 6 * p.cases.length);
  fs.appendFileSync(path.join(root, "native.stderr.bin"), "warning");
  assert.throws(() => owner.verifyRawCapture(p, report), /native-stderr/);
  fs.writeFileSync(path.join(root, "native.stderr.bin"), "");
  fs.appendFileSync(path.join(root, `native-${p.cases[0].id}.capture.json`), " ");
  assert.throws(() => owner.verifyRawCapture(p, report), /raw-copy/);
}));

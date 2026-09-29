"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const admission = require("../app/browser-model-admission.js");
const catalog = require("../app/minimodel-catalog-v1.js");
const capture = require("./real-composition-execution.js");
const numerical = require("./qwen3-numerical-trace-verifier.js");
const exclusions = require("./source-candidate-exclusions.js");
const storage = require("./huggingface-candidate-storage.js");
const scratch = require("./canonical-operation-scratch.js");

const ROOT = path.resolve(__dirname, "../..");
const SCHEMA = "tinyrustlm.default-model-qualification-materialization/1";
const REVIEW_SCHEMA = "tinyrustlm.default-model-qualification-review/1";
const EVIDENCE = Object.freeze(["sourceLock", "sourceRaw", "structural", "numericalOwner",
  "numericalVerifier", "numericalRequest", "numericalProfile", "executionRequest", "execution", "evalCases", "review"]);
const HASH = /^[a-f0-9]{64}$/;

/** Refuse incomplete evidence using stable errors without printing source text or private paths. */
function requireValue(condition, code) { if (!condition) throw new Error(`qualification-${code}`); }
/** Bind an exact retained byte stream, never a filename or verbal claim alone. */
function hash(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
/** JSON comparison preserves array order and ignores only object insertion order. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
/** Compare structured evidence without changing the original stored bytes. */
function equal(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
/** Require a complete record rather than accepting a default for omitted evidence. */
function exact(value, fields, code) {
  requireValue(value && Object.getPrototypeOf(value) === Object.prototype &&
    equal(Object.keys(value).sort(), [...fields].sort()), code);
}
/** Reviewer identities and explanations must be explicit, bounded, nonempty text. */
function text(value, maximum = 2000) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value);
}
/** Reject malformed dates; publication timestamp remains a later independent decision. */
function time(value) {
  requireValue(typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)), "time");
  return Date.parse(value);
}

/** Validate an immutable request; it contains evidence references, never a force/pass flag. */
function validateRequest(value) {
  exact(value, ["schema", "sourceCommit", "issuedAtUtc", "compositionRoot", "outputDirectory", "defaultSampling", "evidence"], "request");
  requireValue(value.schema === SCHEMA && /^[a-f0-9]{40}$/.test(value.sourceCommit) &&
    typeof value.compositionRoot === "string" && typeof value.outputDirectory === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value.issuedAtUtc), "request");
  time(value.issuedAtUtc);
  exact(value.evidence, EVIDENCE, "evidence-closure");
  for (const item of Object.values(value.evidence)) {
    exact(item, ["path", "bytes", "sha256"], "reference");
    requireValue(typeof item.path === "string" && /^(?:artifacts|contracts)\/[A-Za-z0-9._/-]+$/.test(item.path) &&
      !item.path.split("/").some((part) => part === "" || part === "." || part === "..") &&
      Number.isSafeInteger(item.bytes) && item.bytes > 0 && item.bytes <= 32 * 1024 * 1024 && HASH.test(item.sha256), "reference");
  }
  return value;
}

/** Match actual source-framework identity, immutable weights, source decisions and approved redistribution. */
function validateSource(request, docs) {
  const lock = docs.sourceLock, raw = docs.sourceRaw, review = docs.review;
  requireValue(lock.schema === "tinyrustlm.qwen3_source_lock.v1" && text(lock.modelId, 160) &&
    /^[a-f0-9]{40}$/.test(lock.revision) && lock.files?.model &&
    lock.licenseDisposition === "redistribution-and-conversion-approved", "source-lock");
  const weights = Object.values(lock.files).filter((item) => item.path.endsWith(".safetensors"));
  requireValue(weights.length > 0 && !exclusions.sourceCandidateRejection(lock.modelId, lock.revision, weights), "source-excluded");
  requireValue(raw.schema === "tinyrustlm.reference_raw_quality.v4" && raw.source_model_id === lock.modelId &&
    raw.source_revision === lock.revision && raw.generation_contract === "one-call-unmodified-v1" &&
    raw.generation_retries_allowed === false && raw.response_repairs_allowed === false &&
    raw.field_assembly_allowed === false && raw.expected_answer_injection_allowed === false &&
    raw.adapter === null && Array.isArray(raw.cases) && raw.case_count === raw.cases.length && raw.cases.length > 0, "source-raw");
  for (const item of Object.values(lock.files)) {
    if (["LICENSE", "README.md"].includes(item.path)) continue;
    const observed = raw.checkpoint_artifacts?.[item.path];
    requireValue(observed?.bytes === item.byteLength && observed.sha256 === item.sha256, "source-file-binding");
  }
  requireValue(review.license?.status === "redistribution-approved" && review.license.spdx === lock.licenseSpdx &&
    text(review.license.rationale) && Array.isArray(review.license.evidence) && review.license.evidence.length > 0,
  "license-review");
  requireValue(Array.isArray(review.sourceCases) && review.sourceCases.length === raw.cases.length, "source-review-coverage");
  raw.cases.forEach((item, index) => {
    const decision = review.sourceCases[index];
    requireValue(item.index === index && item.generation_call_count === 1 && item.output_transform === "none" &&
      typeof item.raw_output_text === "string" && decision.index === index && decision.verdict === "pass" &&
      text(decision.reason) && decision.rawOutputSha256 === hash(Buffer.from(item.raw_output_text)), "source-review");
  });
  requireValue(docs.structural.source?.modelLockSha256 === request.evidence.sourceLock.sha256 &&
    docs.structural.source.relationshipStatus === "exact", "conversion-source");
}

/** Bind numerical terminal/read-only recheck to this source and converted model, never diagnostic ancestry. */
function validateNumerical(request, docs, rechecked) {
  const owner = docs.numericalOwner, result = docs.numericalVerifier, input = docs.numericalRequest;
  const profile = docs.numericalProfile;
  requireValue(owner.schema === "tinyrustlm.qwen3_numerical_execution_terminal.v1" && owner.status === "terminal-pass" &&
    equal(owner.launchedStages, ["source", "reconstructed", "scalar", "verifier"]) &&
    equal(owner.launchCounts, { source: 1, reconstructed: 1, scalar: 1, verifier: 1 }), "numerical-terminal");
  requireValue(result.schema === "tinyrustlm.qwen3_numerical_trace_verification_receipt.v1" && result.status === "pass" &&
    result.operationId === owner.operationId && result.operationId === input.operationId &&
    result.registrationSha256 === input.registrationSha256 && result.comparison?.firstDivergence === null &&
    result.request?.sha256 === request.evidence.numericalRequest.sha256 &&
    result.request.byteLength === request.evidence.numericalRequest.bytes &&
    result.differentialProfile?.sha256 === request.evidence.numericalProfile.sha256 &&
    result.differentialProfile.byteLength === request.evidence.numericalProfile.bytes && equal(result, rechecked), "numerical-recheck");
  const candidate = profile.candidate, model = docs.structural.artifacts[0];
  requireValue(candidate?.modelId === docs.sourceLock.modelId && candidate.revision === docs.sourceLock.revision &&
    candidate.sourceLock.sha256 === request.evidence.sourceLock.sha256 &&
    candidate.sourceLock.byteLength === request.evidence.sourceLock.bytes &&
    candidate.modelSlm2.sha256 === model.sha256 && candidate.modelSlm2.byteLength === model.byteLength &&
    candidate.compositionResult.sha256 === request.evidence.structural.sha256 &&
    candidate.compositionResult.byteLength === request.evidence.structural.bytes, "numerical-candidate");
}

/** Require exact prospective public-case messages and every declared turn, including actual-history dependencies. */
function validateAcceptance(plan, cases, review) {
  requireValue(cases.schema === "tinyrustlm.default_release_acceptance_cases.v1" &&
    cases.status === "prospective-not-executed" && cases.boundary?.publicCases === true &&
    cases.boundary.holdoutClaim === false && cases.generation?.callsPerDeclaredTurn === 1 &&
    cases.generation.automaticRetries === 0 && cases.generation.responseRepair === false &&
    cases.generation.answerInjection === false && cases.generation.actualHistoryForMultiturn === true,
  "acceptance-contract");
  const turns = cases.cases.flatMap((item) => item.turns.map((turn, turnIndex) => ({ item, turn, turnIndex })));
  requireValue(Array.isArray(review.acceptanceTurns) && review.acceptanceTurns.length === turns.length, "acceptance-coverage");
  const used = new Set();
  turns.forEach(({ item, turn, turnIndex }, index) => {
    const mapping = review.acceptanceTurns[index], entry = plan.cases.find((value) => value.id === mapping.executionCaseId);
    requireValue(mapping.caseId === item.id && mapping.turnIndex === turnIndex && entry && !used.has(entry.id), "acceptance-mapping");
    used.add(entry.id);
    const expected = turnIndex === 0 ? [{ role: "system", content: cases.generation.systemPrompt }, { role: "user", content: turn.user }] :
      [{ role: "user", content: turn.user }];
    requireValue(equal(entry.messages, expected) && entry.sampling.maximumNewTokens === turn.maximumNewTokens &&
      entry.seed === String(cases.generation.seed) && entry.cancelAfterSteps === null &&
      (turnIndex === 0 ? entry.historyFrom === null : entry.historyFrom === review.acceptanceTurns[index - 1].executionCaseId),
    "acceptance-input");
  });
  const additional = plan.cases.filter((item) => !used.has(item.id));
  requireValue(additional.some((item) => item.cancelAfterSteps !== null) &&
    additional.some((item, index) => index > 0 && additional[index - 1].cancelAfterSteps !== null && !item.resetBefore) &&
    additional.some((item) => item.resetBefore && item.cancelAfterSteps === null), "interaction-plan");
  return used;
}

/** Independently measure finite recorded timing, tokens and actual terminal/cancellation evidence. */
function validateCapture(record, item, limits, semantic, required) {
  const value = record.capture, output = value?.output;
  requireValue(value?.id === item.id && value.status === "captured" && value.errorCode === null && output &&
    typeof output.text === "string" && Array.isArray(output.tokenIds) &&
    output.tokenIds.every((token) => Number.isInteger(token) && token >= 0) &&
    ["stop-token", "maximum-new-tokens", "context-limit", "cancelled"].includes(output.status?.kind), "capture");
  requireValue(semantic?.caseId === item.id && semantic.verdict === "pass" && text(semantic.reason) &&
    semantic.rawOutputSha256 === hash(Buffer.from(output.text)), "semantic-review");
  requireValue(Number.isFinite(value.elapsedMilliseconds) && value.elapsedMilliseconds >= 0 &&
    value.elapsedMilliseconds <= Math.min(item.deadlineMilliseconds, limits.maximumTurnMilliseconds), "turn-latency");
  if (output.tokenIds.length > 0) requireValue(Number.isFinite(value.firstEmittedTokenMilliseconds) &&
    value.firstEmittedTokenMilliseconds >= 0 && value.firstEmittedTokenMilliseconds <= limits.maximumFirstTokenMilliseconds, "first-token");
  const emitted = value.steps.filter((step) => step.step.emittedTokenId !== null);
  requireValue(value.steps.every((step, index) => Number.isFinite(step.elapsedMilliseconds) && step.elapsedMilliseconds >= 0 &&
    (index === 0 || step.elapsedMilliseconds >= value.steps[index - 1].elapsedMilliseconds)), "step-timing");
  if (emitted.length >= 2) {
    const span = emitted.at(-1).elapsedMilliseconds - emitted[0].elapsedMilliseconds;
    requireValue(span > 0 && (emitted.length - 1) * 1000 / span >= limits.minimumSustainedDecodeTokensPerSecond, "decode-rate");
  }
  if (item.cancelAfterSteps !== null) requireValue(value.cancellationRequested === true && output.status.kind === "cancelled" &&
    Number.isFinite(value.cancellationLatencyMilliseconds) && value.cancellationLatencyMilliseconds >= 0 &&
    value.cancellationLatencyMilliseconds <= limits.maximumStopLatencyMilliseconds, "cancellation");
  else requireValue(output.status.kind !== "cancelled", "unexpected-cancellation");
  if (required) requireValue(output.text.length > 0 && output.tokenIds.length > 0, "empty-answer");
}

/** Validate exact recorded backend coverage and derive each wire again from preceding raw output. */
function validateExecution(request, docs) {
  const plan = capture.validateRequest(docs.executionRequest), report = docs.execution, review = docs.review;
  requireValue(report.schema === "tinyrustlm.real-composition-execution/1" && report.status === "captured-not-graded" &&
    report.modelQualified === false && equal(report.failures, []) && report.requestSha256 === request.evidence.executionRequest.sha256 &&
    time(report.finishedAtUtc) >= time(report.startedAtUtc) && plan.compositionRoot === request.compositionRoot &&
    plan.browserViewports.length === 2 && plan.browserViewports.some((v) => v.isMobile) &&
    plan.browserViewports.some((v) => !v.isMobile), "execution");
  requireValue(plan.compositionId === docs.structural.graph.graphIdentitySha256 &&
    equal(plan.members, docs.structural.artifacts.map((item) => ({ name: item.file, bytes: item.byteLength, sha256: item.sha256 }))), "execution-composition");
  requireValue(plan.cases.some((item) => equal(item.sampling, request.defaultSampling)), "untested-default-sampling");
  const required = validateAcceptance(plan, docs.evalCases, review);
  const backends = [{ id: "native", data: report.native }, ...plan.browserViewports.map((viewport, index) => {
    const data = report.browser[index];
    requireValue(data?.schema === "tinyrustlm.browser-conversation-capture/1" && equal(data.viewport, viewport) &&
      text(data.browserVersion, 100) && equal(data.errors, []), "browser-coverage");
    return { id: `browser:${viewport.id}`, data };
  })];
  requireValue(report.browser.length === plan.browserViewports.length &&
    report.native?.schema === "tinyrustlm.native-conversation-capture/1" && report.native.exit?.code === 0 &&
    report.native.exit.signal === null && Array.isArray(review.backendCases) &&
    review.backendCases.length === plan.cases.length * backends.length, "backend-coverage");
  const decisionKeys = new Set();
  for (const backend of backends) {
    requireValue(backend.data.status === "captured" && backend.data.modelQualified === false &&
      backend.data.records.length === plan.cases.length, "backend-status");
    const preceding = [];
    backend.data.records.forEach((record, index) => {
      const item = plan.cases[index], wire = capture.caseRequest(item, preceding);
      requireValue(equal(wire, { id: record.id, messages: record.messages, requestBytes: record.requestBytes,
        requestSha256: record.requestSha256, requestBase64: record.requestBase64 }), "wire-binding");
      const decisions = review.backendCases.filter((entry) => entry.backend === backend.id && entry.caseId === item.id);
      requireValue(decisions.length === 1, "backend-review"); decisionKeys.add(`${backend.id}/${item.id}`);
      validateCapture(record, item, docs.evalCases.performance.prospectiveExecutionLimits, decisions[0], required.has(item.id));
      preceding.push(record);
    });
  }
  requireValue(decisionKeys.size === review.backendCases.length && time(review.reviewer.reviewedAtUtc) >= time(report.finishedAtUtc), "review-completeness");
  return plan;
}

/** Pure evidence validation for focused tests; real publication always uses materialize's file and numerical checks. */
function validateEvidence(request, docs, numericalRecheck) {
  validateRequest(request);
  const review = docs.review;
  requireValue(review.schema === REVIEW_SCHEMA && text(review.reviewer?.id, 160) && text(review.reviewer.role, 160) &&
    time(review.reviewer.reviewedAtUtc) <= time(request.issuedAtUtc) &&
    review.qualityClaim === "task-specific-qualified" && /^[a-z0-9][a-z0-9._/-]{2,159}$/.test(review.qualityScope) &&
    review.releaseStatus === "not-released", "review");
  exact(review.bindings, EVIDENCE.filter((name) => name !== "review"), "review-bindings");
  for (const name of Object.keys(review.bindings)) requireValue(review.bindings[name] === request.evidence[name].sha256, "review-binding");
  const structural = docs.structural;
  requireValue(structural.schema === "tinyrustlm.qwen3_composition_conversion_receipt.v1" && structural.status === "pass" &&
    structural.structuralCompositionStatus === "verified" && structural.artifacts?.length === 6 &&
    structural.artifacts.every((item, index) => item.ordinal === index && item.file === capture.MEMBERS[index] &&
      item.formatProfileSha256 === admission.artifactSpecs[index].profileSha256), "structural");
  validateSource(request, docs); validateNumerical(request, docs, numericalRecheck);
  const plan = validateExecution(request, docs);
  const qualification = { receiptId: `sha256:${request.evidence.review.sha256}`,
    sourceEvidenceSha256: request.evidence.sourceRaw.sha256, structuralEvidenceSha256: request.evidence.structural.sha256,
    numericalEvidenceSha256: request.evidence.numericalVerifier.sha256, qualityEvidenceSha256: request.evidence.review.sha256,
    evalCasesSha256: request.evidence.evalCases.sha256, qualityClaim: review.qualityClaim, qualityScope: review.qualityScope };
  const document = { schema: admission.schema, modelId: docs.sourceLock.modelId, operationId: plan.operationId,
    artifacts: structural.artifacts.map((item, index) => ({ role: admission.artifactSpecs[index].role,
      format: admission.artifactSpecs[index].format, fileName: item.file, byteCount: item.byteLength,
      sha256: item.sha256, formatProfileSha256: item.formatProfileSha256 })), composition: structural.graph, qualification,
    runtime: { workerProtocol: admission.workerProtocol, wasmByteCount: plan.tools.assets[3].bytes,
      wasmSha256: plan.tools.assets[3].sha256, policy: plan.policy, defaultSampling: request.defaultSampling } };
  const admissionText = admission.serializeAdmission(document);
  const receipt = { schema: catalog.QUALIFICATION_RECEIPT_SCHEMA, receiptId: qualification.receiptId,
    modelId: document.modelId, operationId: document.operationId, compositionId: `sha256:${plan.compositionId}`,
    ...Object.fromEntries(Object.entries(qualification).filter(([key]) => key !== "receiptId")),
    numericalStatus: "passed", browserStatus: "passed", qualityStatus: "qualified", issuedAtUtc: request.issuedAtUtc };
  const receiptText = `${JSON.stringify(receipt)}\n`;
  catalog.parseCanonicalJsonText(receiptText, 128 * 1024);
  return { admissionText, receiptText, qualification, releaseReady: false };
}

/** Read only exact ordinary bounded canonical files, rejecting ancestry redirection and changed identities. */
function readReference(item) {
  const file = path.join(ROOT, ...item.path.split("/"));
  for (let parent = path.dirname(file); ; parent = path.dirname(parent)) {
    const stat = fs.lstatSync(parent);
    requireValue(stat.isDirectory() && !stat.isSymbolicLink(), "reference-ancestry");
    if (path.dirname(parent) === parent) break;
  }
  capture.verifyFile({ ...item, path: file });
  const bytes = storage.readBoundedFile(file, item.bytes);
  requireValue(bytes.length === item.bytes && hash(bytes) === item.sha256, "reference-drift");
  return { file, bytes, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
}

/** Execute only read-only Git commands with no shell and bounded output. */
function git(args) {
  return childProcess.execFileSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024 }).trim();
}

/** Materialize one evidence-backed receipt; no inference, transport, qualification override or cleanup is performed. */
function materialize(requestValue) {
  const request = validateRequest(JSON.parse(JSON.stringify(requestValue)));
  storage.requireModelOutputRoot(request.compositionRoot);
  scratch.requireCanonicalArtifactPath(request.outputDirectory);
  const gate = childProcess.spawnSync(process.execPath, [path.join(__dirname, "verify-single-source-authority.js"),
    "--require-clean", "--require-remote-exact"], { cwd: ROOT, windowsHide: true, timeout: 120000, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  requireValue(gate.status === 0 && !gate.error && git(["rev-parse", "HEAD"]) === request.sourceCommit, "source-authority");
  requireValue(time(request.issuedAtUtc) <= Date.now() + 300000, "future-issue");
  const inputs = Object.fromEntries(EVIDENCE.map((name) => [name, readReference(request.evidence[name])]));
  const docs = Object.fromEntries(Object.entries(inputs).map(([name, value]) => [name, value.value]));
  const plan = capture.validateRequest(docs.executionRequest);
  git(["merge-base", "--is-ancestor", plan.sourceCommit, request.sourceCommit]);
  for (const item of [...Object.values(plan.tools).filter((item) => !Array.isArray(item)), ...plan.tools.managed, ...plan.tools.assets]) capture.verifyFile(item);
  for (const item of plan.members) capture.verifyFile({ path: path.join(request.compositionRoot, item.name), bytes: item.bytes, sha256: item.sha256 });
  for (const item of docs.review.license.evidence) readReference(item);
  const rechecked = numerical.verify([inputs.numericalRequest.file]);
  const output = validateEvidence(request, docs, rechecked);
  // Rehash metadata after asynchronous-owner evidence reads; exact byte drift is fatal before any output.
  EVIDENCE.forEach((name) => readReference(request.evidence[name]));
  fs.mkdirSync(request.outputDirectory);
  fs.writeFileSync(path.join(request.outputDirectory, "admission.json"), output.admissionText, { flag: "wx" });
  fs.writeFileSync(path.join(request.outputDirectory, "qualification.json"), output.receiptText, { flag: "wx" });
  fs.writeFileSync(path.join(request.outputDirectory, "materialization.json"), `${JSON.stringify({ schema: SCHEMA,
    status: "materialized-not-released", sourceCommit: request.sourceCommit, evidence: request.evidence,
    admission: { bytes: Buffer.byteLength(output.admissionText), sha256: hash(output.admissionText) },
    receipt: { bytes: Buffer.byteLength(output.receiptText), sha256: hash(output.receiptText) }, releaseReady: false }, null, 2)}\n`, { flag: "wx" });
  return output;
}

module.exports = Object.freeze({ SCHEMA, REVIEW_SCHEMA, EVIDENCE, validateRequest, validateEvidence, readReference, materialize });
if (require.main === module) {
  try {
    requireValue(process.argv.length === 3, "arguments");
    const file = path.resolve(process.argv[2]); scratch.requireCanonicalArtifactPath(path.dirname(file));
    const bytes = storage.readBoundedFile(file, 1024 * 1024);
    const request = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    requireValue(bytes.equals(Buffer.from(`${JSON.stringify(request, null, 2)}\n`)), "request-canonical");
    materialize(request); process.stdout.write("qualification materialized; release not claimed\n");
  } catch (error) {
    process.stderr.write(`${/^qualification-[a-z-]+$/.test(error.message) ? error.message : "qualification-failed"}\n`);
    process.exitCode = 1;
  }
}

"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  finalizeVnextReceipt
} = require("../tools/vnext-receipt-identity.js");
const {
  classifyVnextPhaseReceipts,
  phaseInvalidationProfile,
  phaseInvalidationProfileSha256
} = require("../tools/vnext-phase-invalidation.js");
const {
  baseReceiptDraft,
  campaignId,
  hash
} = require("./helpers/vnext-authority-fixtures.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "phase-invalidation-profile.v1.json");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function phaseReceipt({
  attemptId,
  operationId,
  subjectId,
  receiptType,
  phase = receiptType,
  inputReceiptIds = [],
  supersedesReceiptIds = [],
  status = "pass",
  toolVersion = "1.0.0",
  toolSha256 = hash(`tool:${toolVersion}`),
  configurationSha256 = hash(`configuration:${operationId}`),
  sourceRevision = `git-sha1:${"a".repeat(40)}`,
  completedAtUtc = "2026-08-09T01:00:00Z"
}) {
  const draft = baseReceiptDraft({
    receiptType,
    attemptId,
    phase,
    startedAtUtc: completedAtUtc,
    completedAtUtc,
    inputReceiptIds
  });
  draft.status = status;
  draft.sourceRevision = sourceRevision;
  draft.supersedesReceiptIds = [...supersedesReceiptIds].sort();
  draft.tools = [{
    name: "phase-tool",
    version: toolVersion,
    binarySha256: toolSha256
  }];
  draft.configurationSha256 = configurationSha256;
  draft.publicParameters = [
    { name: "operation_id", value: operationId, unit: null },
    { name: "subject_id", value: subjectId, unit: null }
  ];
  if (status === "fail" || status === "rejected") {
    draft.error = {
      code: "synthetic-phase-failure",
      failureStep: "phase-execution",
      retryStatus: status === "fail" ? "retryable" : "terminal",
      rollbackStatus: "not-required"
    };
  }
  if (status === "blocked") draft.blockerCode = "synthetic-phase-blocker";
  return finalizeVnextReceipt(draft);
}

function classify(receipts) {
  return classifyVnextPhaseReceipts({
    campaignId,
    receiptBytes: receipts.map((entry) => entry.bytes)
  });
}

function record(result, receipt) {
  return result.result.records.find((entry) =>
    entry.receiptId === receipt.receipt.receiptId);
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

function evaluatorLineage() {
  const acquisition = phaseReceipt({
    receiptType: "acquisition",
    attemptId: "acquisition-alpha-001",
    operationId: "acquire-alpha",
    subjectId: "model-alpha"
  });
  const conversion = phaseReceipt({
    receiptType: "conversion",
    attemptId: "conversion-alpha-001",
    operationId: "convert-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [acquisition.receipt.receiptId]
  });
  const evaluation = phaseReceipt({
    receiptType: "conversation-evaluation",
    attemptId: "evaluation-alpha-001",
    operationId: "evaluate-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [conversion.receipt.receiptId],
    toolVersion: "1.0.0"
  });
  const qualification = phaseReceipt({
    receiptType: "qualification",
    attemptId: "qualification-alpha-001",
    operationId: "qualify-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [evaluation.receipt.receiptId]
  });
  return { acquisition, conversion, evaluation, qualification };
}

test("freezes a bounded semantic-currentness profile without network or compatibility code", () => {
  const bytes = fs.readFileSync(profilePath);
  const source = fs.readFileSync(path.join(repositoryRoot, "tinyrustlm", "tools",
    "vnext-phase-invalidation.js"), "utf8");

  assert.equal(bytes.length, 2708);
  assert.equal(sha256(bytes),
    "d13eaf173a76229bbca401482459c07b6f591703a55523d3b216f984ba5370a3");
  assert.equal(phaseInvalidationProfileSha256, sha256(bytes));
  assert.equal(phaseInvalidationProfile.profileId,
    "tinyrustlm.vnext.phase-invalidation.v1");
  assert.equal(phaseInvalidationProfile.status, "frozen");
  assert.equal(phaseInvalidationProfile.networkAccess, "forbidden");
  assert.equal(phaseInvalidationProfile.historyPolicy,
    "immutable-retained-never-quarantined-for-semantic-staleness");
  assert.deepEqual(phaseInvalidationProfile.requiredPhaseParameters,
    ["operation_id", "subject_id"]);
  assert.ok(phaseInvalidationProfile.supportedPhaseReceiptTypes.includes(
    "conversation-evaluation"));
  assert.ok(phaseInvalidationProfile.supportedPhaseReceiptTypes.includes(
    "qualification"));
  assert.equal(phaseInvalidationProfile.supportedPhaseReceiptTypes.includes(
    "final-attestation"), false);
  assert.equal(phaseInvalidationProfile.supportedPhaseReceiptTypes.includes(
    "redaction-scan"), false);
  assert.doesNotMatch(source,
    /JSON\.parse|node:(?:http|https|net|tls|dns)|\bfetch\s*\(/u);
  assert.doesNotMatch(source,
    /\b(?:legacy|migration|fallback|deprecated|alias|shim)\b/iu);
});

test("invalidates only an evaluator receipt and its descendants", () => {
  const lineage = evaluatorLineage();
  const replacement = phaseReceipt({
    receiptType: "conversation-evaluation",
    attemptId: "evaluation-alpha-002",
    operationId: "evaluate-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [lineage.conversion.receipt.receiptId],
    supersedesReceiptIds: [lineage.evaluation.receipt.receiptId],
    toolVersion: "2.0.0",
    completedAtUtc: "2026-08-09T01:10:00Z"
  });
  const result = classify([
    lineage.qualification,
    replacement,
    lineage.acquisition,
    lineage.evaluation,
    lineage.conversion
  ]);

  assert.equal(result.result.health, "healthy");
  assert.equal(record(result, lineage.acquisition).state, "current-pass");
  assert.equal(record(result, lineage.conversion).state, "current-pass");
  assert.equal(record(result, lineage.evaluation).state, "superseded");
  assert.equal(record(result, lineage.evaluation).reasonCode,
    "explicit-supersession");
  assert.equal(record(result, lineage.qualification).state, "stale");
  assert.equal(record(result, lineage.qualification).reasonCode,
    "noncurrent-ancestor");
  assert.equal(record(result, replacement).state, "current-pass");
  assert.notEqual(record(result, lineage.evaluation).materialIdentity,
    record(result, replacement).materialIdentity);
  assert.ok(result.result.currentPhaseReceiptIds.includes(
    lineage.acquisition.receipt.receiptId));
  assert.ok(result.result.currentPhaseReceiptIds.includes(
    lineage.conversion.receipt.receiptId));
  assert.equal(result.result.currentPhaseReceiptIds.includes(
    lineage.qualification.receipt.receiptId), false);
});

test("a failing replacement withdraws an earlier pass without erasing history", () => {
  const lineage = evaluatorLineage();
  const failed = phaseReceipt({
    receiptType: "conversation-evaluation",
    attemptId: "evaluation-alpha-failed-002",
    operationId: "evaluate-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [lineage.conversion.receipt.receiptId],
    supersedesReceiptIds: [lineage.evaluation.receipt.receiptId],
    status: "fail",
    toolVersion: "2.0.0",
    completedAtUtc: "2026-08-09T01:10:00Z"
  });
  const result = classify(Object.values(lineage).concat(failed));

  assert.equal(record(result, failed).state, "current-nonpass");
  assert.equal(result.result.eligiblePassPhaseReceiptIds.includes(
    failed.receipt.receiptId), false);
  assert.equal(record(result, lineage.evaluation).state, "superseded");
  assert.equal(record(result, lineage.qualification).state, "stale");
  assert.ok(result.result.retainedHistoricalReceiptIds.includes(
    lineage.evaluation.receipt.receiptId));
  assert.ok(result.result.retainedHistoricalReceiptIds.includes(
    lineage.qualification.receipt.receiptId));
  assert.equal(result.result.receiptCount, 5);
});

test("a descendant of the current failed attempt is stale and never pass-eligible", () => {
  const lineage = evaluatorLineage();
  const failed = phaseReceipt({
    receiptType: "conversation-evaluation",
    attemptId: "evaluation-alpha-failed-child-002",
    operationId: "evaluate-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [lineage.conversion.receipt.receiptId],
    supersedesReceiptIds: [lineage.evaluation.receipt.receiptId],
    status: "fail",
    toolVersion: "2.0.0"
  });
  const invalidQualification = phaseReceipt({
    receiptType: "qualification",
    attemptId: "qualification-alpha-invalid-002",
    operationId: "qualify-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [failed.receipt.receiptId]
  });
  const result = classify([
    lineage.acquisition,
    lineage.conversion,
    lineage.evaluation,
    failed,
    invalidQualification
  ]);

  assert.equal(record(result, failed).state, "current-nonpass");
  assert.equal(record(result, invalidQualification).state, "stale");
  assert.equal(record(result, invalidQualification).reasonCode,
    "nonpass-ancestor");
  assert.equal(result.result.eligiblePassPhaseReceiptIds.includes(
    invalidQualification.receipt.receiptId), false);
});

test("a new descendant can resume from the replacement without repeating ancestors", () => {
  const lineage = evaluatorLineage();
  const replacement = phaseReceipt({
    receiptType: "conversation-evaluation",
    attemptId: "evaluation-alpha-002",
    operationId: "evaluate-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [lineage.conversion.receipt.receiptId],
    supersedesReceiptIds: [lineage.evaluation.receipt.receiptId],
    toolVersion: "2.0.0",
    completedAtUtc: "2026-08-09T01:10:00Z"
  });
  const qualification = phaseReceipt({
    receiptType: "qualification",
    attemptId: "qualification-alpha-002",
    operationId: "qualify-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [replacement.receipt.receiptId],
    supersedesReceiptIds: [lineage.qualification.receipt.receiptId],
    completedAtUtc: "2026-08-09T01:20:00Z"
  });
  const before = classify(Object.values(lineage));
  const after = classify(Object.values(lineage).concat(replacement, qualification));

  assert.equal(record(after, lineage.acquisition).materialIdentity,
    record(before, lineage.acquisition).materialIdentity);
  assert.equal(record(after, lineage.conversion).materialIdentity,
    record(before, lineage.conversion).materialIdentity);
  assert.equal(record(after, qualification).state, "current-pass");
  assert.ok(after.result.eligiblePassPhaseReceiptIds.includes(
    qualification.receipt.receiptId));
});

test("reports unresolved duplicate attempts instead of choosing by time or hash", () => {
  const first = phaseReceipt({
    receiptType: "acquisition",
    attemptId: "acquisition-conflict-001",
    operationId: "acquire-conflict",
    subjectId: "model-conflict",
    completedAtUtc: "2026-08-09T01:00:00Z"
  });
  const second = phaseReceipt({
    receiptType: "acquisition",
    attemptId: "acquisition-conflict-002",
    operationId: "acquire-conflict",
    subjectId: "model-conflict",
    toolVersion: "2.0.0",
    completedAtUtc: "2026-08-09T02:00:00Z"
  });
  const result = classify([second, first]);

  assert.equal(result.result.health, "invalid");
  assert.equal(record(result, first).state, "conflict");
  assert.equal(record(result, second).state, "conflict");
  assert.deepEqual(result.result.currentPhaseReceiptIds, []);
  assert.deepEqual(result.result.eligiblePassPhaseReceiptIds, []);
  assert.equal(result.result.conflictingOperationIdentities.length, 1);
});

test("one explicit convergence receipt resolves multiple retained attempt heads", () => {
  const first = phaseReceipt({
    receiptType: "screening",
    attemptId: "screening-converge-001",
    operationId: "screen-converge",
    subjectId: "model-converge"
  });
  const second = phaseReceipt({
    receiptType: "screening",
    attemptId: "screening-converge-002",
    operationId: "screen-converge",
    subjectId: "model-converge",
    toolVersion: "2.0.0"
  });
  const convergence = phaseReceipt({
    receiptType: "screening",
    attemptId: "screening-converge-003",
    operationId: "screen-converge",
    subjectId: "model-converge",
    supersedesReceiptIds: [
      first.receipt.receiptId,
      second.receipt.receiptId
    ],
    toolVersion: "3.0.0"
  });
  const result = classify([second, convergence, first]);

  assert.equal(result.result.health, "healthy");
  assert.equal(record(result, first).state, "superseded");
  assert.equal(record(result, second).state, "superseded");
  assert.equal(record(result, convergence).state, "current-pass");
  assert.deepEqual(result.result.currentPhaseReceiptIds,
    [convergence.receipt.receiptId]);
});

test("rejects cross-operation supersession and dependency/supersession overlap", () => {
  const first = phaseReceipt({
    receiptType: "review",
    attemptId: "review-alpha-001",
    operationId: "review-alpha",
    subjectId: "model-alpha"
  });
  const wrongOperation = phaseReceipt({
    receiptType: "review",
    attemptId: "review-beta-001",
    operationId: "review-beta",
    subjectId: "model-beta",
    supersedesReceiptIds: [first.receipt.receiptId]
  });
  throwsCode(() => classify([first, wrongOperation]),
    "phase_supersession_operation_mismatch");

  const overlap = phaseReceipt({
    receiptType: "review",
    attemptId: "review-alpha-002",
    operationId: "review-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [first.receipt.receiptId],
    supersedesReceiptIds: [first.receipt.receiptId]
  });
  throwsCode(() => classify([first, overlap]),
    "phase_supersession_dependency_overlap");
});

test("is deterministic under transport order and returns defensive immutable bytes", () => {
  const lineage = evaluatorLineage();
  const receipts = Object.values(lineage);
  const first = classify(receipts);
  const second = classify([...receipts].reverse());

  assert.deepEqual(first.resultBytes, second.resultBytes);
  assert.equal(first.resultSha256, second.resultSha256);
  assert.equal(first.result.receiptSetSha256, second.result.receiptSetSha256);
  assert.match(first.result.receiptSetSha256, /^[a-f0-9]{64}$/u);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.result), true);
  assert.equal(Object.isFrozen(first.result.records), true);
  assert.notEqual(first.resultBytes, first.resultBytes);
  const changed = first.resultBytes;
  changed[0] ^= 0xff;
  assert.deepEqual(first.resultBytes, second.resultBytes);
});

test("rejects missing parents, duplicate bytes, missing phase identity, and hostile inputs", () => {
  const missingParent = `sha256:${"e".repeat(64)}`;
  const broken = phaseReceipt({
    receiptType: "conversion",
    attemptId: "conversion-broken-001",
    operationId: "convert-broken",
    subjectId: "model-broken",
    inputReceiptIds: [missingParent]
  });
  throwsCode(() => classify([broken]), "phase_receipt_graph_invalid");

  const value = phaseReceipt({
    receiptType: "acquisition",
    attemptId: "acquisition-duplicate-001",
    operationId: "acquire-duplicate",
    subjectId: "model-duplicate"
  });
  throwsCode(() => classify([value, value]), "phase_receipt_duplicate");

  const missingParametersDraft = baseReceiptDraft({
    receiptType: "acquisition",
    attemptId: "acquisition-no-operation-001"
  });
  const missingParameters = finalizeVnextReceipt(missingParametersDraft);
  throwsCode(() => classify([missingParameters]),
    "phase_receipt_parameters_invalid");

  let trapInvoked = false;
  const hostile = new Proxy({}, {
    get() {
      trapInvoked = true;
      throw new Error("must not execute");
    },
    getPrototypeOf() {
      trapInvoked = true;
      throw new Error("must not execute");
    }
  });
  throwsCode(() => classifyVnextPhaseReceipts({
    campaignId,
    receiptBytes: [hostile]
  }), "phase_receipt_bytes_required");
  assert.equal(trapInvoked, false);

  let getterInvoked = false;
  const accessorArray = [];
  Object.defineProperty(accessorArray, "0", {
    enumerable: true,
    get() {
      getterInvoked = true;
      return value.bytes;
    }
  });
  accessorArray.length = 1;
  throwsCode(() => classifyVnextPhaseReceipts({
    campaignId,
    receiptBytes: accessorArray
  }), "phase_receipt_array_invalid");
  assert.equal(getterInvoked, false);

  let shadowedGetterInvoked = false;
  const shadowedBytes = Uint8Array.from(value.bytes);
  Object.defineProperty(shadowedBytes, "buffer", {
    get() {
      shadowedGetterInvoked = true;
      throw new Error("must not execute");
    }
  });
  const shadowedResult = classifyVnextPhaseReceipts({
    campaignId,
    receiptBytes: [shadowedBytes]
  });
  assert.equal(shadowedResult.result.receiptCount, 1);
  assert.equal(shadowedGetterInvoked, false);

  if (typeof SharedArrayBuffer === "function") {
    const receiptBytes = value.bytes;
    const shared = new SharedArrayBuffer(receiptBytes.length);
    new Uint8Array(shared).set(receiptBytes);
    throwsCode(() => classifyVnextPhaseReceipts({
      campaignId,
      receiptBytes: [new Uint8Array(shared)]
    }), "phase_receipt_bytes_required");
  }
});

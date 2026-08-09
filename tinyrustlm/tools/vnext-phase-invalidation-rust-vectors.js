"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  finalizeVnextReceipt
} = require("./vnext-receipt-identity.js");
const {
  classifyVnextPhaseReceipts,
  phaseInvalidationProfile,
  phaseInvalidationProfileSha256
} = require("./vnext-phase-invalidation.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const vectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/phase-invalidation-rust-vectors.v1.json"
);
const campaignId = "campaign-vnext-001";

function invariant(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = "phase_invalidation_vector_generation_failed";
    throw error;
  }
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function baseReceiptDraft({
  receiptType,
  attemptId,
  phase = receiptType,
  startedAtUtc = "2026-08-09T01:00:00Z",
  completedAtUtc = startedAtUtc,
  inputReceiptIds = []
}) {
  return {
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType,
    campaignId,
    attemptId,
    phase,
    status: "pass",
    startedAtUtc,
    completedAtUtc,
    sourceRevision: `git-sha1:${"a".repeat(40)}`,
    inputReceiptIds: [...inputReceiptIds].sort(),
    inputHashes: [],
    outputHashes: [],
    tools: [{
      name: "phase-vector-tool",
      version: "1.0.0",
      binarySha256: hash("phase-vector-tool")
    }],
    configurationSha256: hash(`configuration:${attemptId}`),
    runtime: {
      runtimeIdentifier: "node-phase-vector-generator",
      operatingSystem: "windows",
      architecture: "x86_64",
      executionClass: "local"
    },
    publicParameters: [],
    error: null,
    blockerCode: null,
    externalEvidenceReferences: [],
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    },
    attestationReference: null,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: []
  };
}

function phaseReceipt({
  receiptType,
  attemptId,
  operationId,
  subjectId,
  phase = receiptType,
  inputReceiptIds = [],
  supersedesReceiptIds = [],
  status = "pass",
  toolVersion = "1.0.0",
  configurationSha256 = hash(`configuration:${operationId}`),
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
  draft.supersedesReceiptIds = [...supersedesReceiptIds].sort();
  draft.tools = [{
    name: "phase-vector-tool",
    version: toolVersion,
    binarySha256: hash(`phase-vector-tool:${toolVersion}`)
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
    inputReceiptIds: [conversion.receipt.receiptId]
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

function encodeReceipts(receipts) {
  return receipts.map((entry) => Buffer.from(entry.bytes ?? entry).toString("base64"));
}

function acceptCase(name, receipts) {
  const classified = classifyVnextPhaseReceipts({
    campaignId,
    receiptBytes: receipts.map((entry) => entry.bytes)
  });
  return {
    name,
    receiptBytesBase64: encodeReceipts(receipts),
    resultBytesBase64: classified.resultBytes.toString("base64"),
    resultSha256: classified.resultSha256
  };
}

function rejectionCase(name, inputCampaignId, receipts) {
  let errorCode = null;
  try {
    classifyVnextPhaseReceipts({
      campaignId: inputCampaignId,
      receiptBytes: receipts.map((entry) => entry.bytes ?? entry)
    });
  } catch (error) {
    errorCode = error?.code ?? null;
  }
  invariant(typeof errorCode === "string", `${name} did not reject`);
  return {
    campaignId: inputCampaignId,
    expectedErrorCode: errorCode,
    name,
    receiptBytesBase64: encodeReceipts(receipts)
  };
}

function buildAcceptCases() {
  const baseline = evaluatorLineage();

  const replacementLineage = evaluatorLineage();
  const replacement = phaseReceipt({
    receiptType: "conversation-evaluation",
    attemptId: "evaluation-alpha-002",
    operationId: "evaluate-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [replacementLineage.conversion.receipt.receiptId],
    supersedesReceiptIds: [replacementLineage.evaluation.receipt.receiptId],
    toolVersion: "2.0.0",
    completedAtUtc: "2026-08-09T01:10:00.125Z"
  });
  const resumedQualification = phaseReceipt({
    receiptType: "qualification",
    attemptId: "qualification-alpha-002",
    operationId: "qualify-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [replacement.receipt.receiptId],
    supersedesReceiptIds: [replacementLineage.qualification.receipt.receiptId],
    completedAtUtc: "2026-08-09T01:20:00Z"
  });

  const failedLineage = evaluatorLineage();
  const failedReplacement = phaseReceipt({
    receiptType: "conversation-evaluation",
    attemptId: "evaluation-alpha-failed-002",
    operationId: "evaluate-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [failedLineage.conversion.receipt.receiptId],
    supersedesReceiptIds: [failedLineage.evaluation.receipt.receiptId],
    status: "fail",
    toolVersion: "2.0.0",
    completedAtUtc: "2026-08-09T01:10:00Z"
  });

  const conflictFirst = phaseReceipt({
    receiptType: "screening",
    attemptId: "screening-conflict-001",
    operationId: "screen-conflict",
    subjectId: "model-conflict"
  });
  const conflictSecond = phaseReceipt({
    receiptType: "screening",
    attemptId: "screening-conflict-002",
    operationId: "screen-conflict",
    subjectId: "model-conflict",
    toolVersion: "2.0.0"
  });

  return [
    acceptCase("baseline-lineage", Object.values(baseline).reverse()),
    acceptCase("replacement-and-resume", [
      resumedQualification,
      replacementLineage.qualification,
      replacement,
      replacementLineage.acquisition,
      replacementLineage.evaluation,
      replacementLineage.conversion
    ]),
    acceptCase("failed-replacement", [
      failedLineage.qualification,
      failedReplacement,
      failedLineage.acquisition,
      failedLineage.evaluation,
      failedLineage.conversion
    ]),
    acceptCase("unresolved-operation-heads", [conflictSecond, conflictFirst])
  ];
}

function authorityRegistryReceipt() {
  const draft = baseReceiptDraft({
    receiptType: "authority-registry",
    attemptId: "registry-unsupported-phase-001",
    startedAtUtc: "2026-08-01T00:00:00Z",
    completedAtUtc: "2026-08-01T00:00:00Z"
  });
  draft.authorityRegistry = {
    environment: "production",
    previousRegistryReceiptId: null,
    effectiveAtUtc: "2026-08-01T00:00:00Z",
    expiresAtUtc: "2027-07-31T00:00:00Z",
    allowedClockSkewSeconds: 300,
    keys: [{
      keyId: "unsupported-phase-key-001",
      signerId: "unsupported-phase-signer-001",
      role: "local-recorder",
      publicKey: Buffer.alloc(32, 1).toString("base64"),
      status: "active",
      validFromUtc: "2026-08-01T00:00:00Z",
      validUntilUtc: "2027-07-30T00:00:00Z"
    }]
  };
  return finalizeVnextReceipt(draft);
}

function buildRejectionCases() {
  const duplicate = phaseReceipt({
    receiptType: "acquisition",
    attemptId: "acquisition-duplicate-001",
    operationId: "acquire-duplicate",
    subjectId: "model-duplicate"
  });
  const missingParent = phaseReceipt({
    receiptType: "conversion",
    attemptId: "conversion-missing-parent-001",
    operationId: "convert-missing-parent",
    subjectId: "model-missing-parent",
    inputReceiptIds: [`sha256:${"e".repeat(64)}`]
  });
  const supersessionTarget = phaseReceipt({
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
    supersedesReceiptIds: [supersessionTarget.receipt.receiptId]
  });
  const overlap = phaseReceipt({
    receiptType: "review",
    attemptId: "review-alpha-002",
    operationId: "review-alpha",
    subjectId: "model-alpha",
    inputReceiptIds: [supersessionTarget.receipt.receiptId],
    supersedesReceiptIds: [supersessionTarget.receipt.receiptId]
  });
  const missingParametersDraft = baseReceiptDraft({
    receiptType: "acquisition",
    attemptId: "acquisition-missing-parameters-001"
  });
  const missingParameters = finalizeVnextReceipt(missingParametersDraft);
  const decorated = Buffer.concat([duplicate.bytes, Buffer.from("\n", "utf8")]);

  return [
    rejectionCase("empty-receipt-set", campaignId, []),
    rejectionCase("duplicate-receipt", campaignId, [duplicate, duplicate]),
    rejectionCase("missing-parent", campaignId, [missingParent]),
    rejectionCase("cross-operation-supersession", campaignId,
      [supersessionTarget, wrongOperation]),
    rejectionCase("dependency-supersession-overlap", campaignId,
      [supersessionTarget, overlap]),
    rejectionCase("missing-phase-parameters", campaignId, [missingParameters]),
    rejectionCase("unsupported-receipt-type", campaignId, [authorityRegistryReceipt()]),
    rejectionCase("noncanonical-receipt-wire", campaignId, [decorated]),
    rejectionCase("campaign-mismatch", "campaign-vnext-other-001", [duplicate])
  ];
}

function renderVectorCorpus() {
  const corpus = {
    schema: "tinyrustlm.vnext.phase_invalidation_rust_vectors.v1",
    profileId: phaseInvalidationProfile.profileId,
    profileSha256: phaseInvalidationProfileSha256,
    campaignId,
    cases: buildAcceptCases(),
    rejectionCases: buildRejectionCases()
  };
  return Buffer.from(`${JSON.stringify(corpus, null, 2)}\n`, "utf8");
}

function writeVectorCorpus() {
  const bytes = renderVectorCorpus();
  fs.writeFileSync(vectorPath, bytes);
  return Object.freeze({ bytes: Buffer.from(bytes), vectorPath });
}

function main(argumentsList) {
  invariant(
    argumentsList.length === 1 && argumentsList[0] === "--write",
    "usage: node vnext-phase-invalidation-rust-vectors.js --write"
  );
  writeVectorCorpus();
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Phase invalidation vector generation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  renderVectorCorpus,
  vectorPath,
  writeVectorCorpus
});

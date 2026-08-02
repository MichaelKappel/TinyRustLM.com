"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  approvalRequestSchema,
  captureHostBootEvidence,
  checkpointSchema,
  createHostRestartApprovalRequest,
  prepareHostRestartCheckpoint,
  readHostRestartApprovalRequest,
  readHostRestartCheckpoint,
  readHostRestartVerification,
  verificationSchema,
  verifyHostRestartCheckpoint
} = require("../tools/campaign-host-restart-fault-scenarios.js");

const campaignId = "host-restart-fault-test-20260715";
const sourceRevision = "d".repeat(40);
const planId = "tinyrustlm-dogfood-faults-v1";
const planSha256 = "e".repeat(64);
const faultDefinitionSha256 = "f".repeat(64);
const toolIdentitySha256 = "1".repeat(64);
const preBootIdentitySha256 = "2".repeat(64);
const postBootIdentitySha256 = "3".repeat(64);
const hostIdentitySha256 = "4".repeat(64);
const probeBinarySha256 = "5".repeat(64);
const receiptA = `sha256:${"6".repeat(64)}`;
const receiptB = `sha256:${"7".repeat(64)}`;
const preparationReceiptId = `sha256:${"8".repeat(64)}`;
const retainedSentinelMarker = () => true;

function digest(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function setup(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-host-restart-test-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    requestPath: path.join(root, "host-restart-request.json"),
    checkpointPath: path.join(root, "host-restart-checkpoint.json")
  };
}

function fixtureProbe(bootIdentitySha256 = preBootIdentitySha256,
  bootStartedAtUtc = "2026-07-15T20:00:00.000Z") {
  return Object.freeze({
    evidenceClass: "fixture",
    probeSource: "injected-fixture",
    operatingSystem: "win32",
    architecture: "x64",
    hostIdentitySha256,
    bootIdentitySha256,
    bootStartedAtUtc,
    physicalMachineIdentityObserved: true,
    virtualizationLayerPresent: true,
    probeBinarySha256
  });
}

function requestOptions(requestPath) {
  return {
    campaignId,
    faultDefinitionSha256,
    outputPath: requestPath,
    planId,
    planSha256,
    sourceRevision,
    toolIdentitySha256
  };
}

test("writes one immutable public-safe host restart approval request", (context) => {
  const { requestPath } = setup(context);
  let clockReads = 0;
  const dependencies = {
    captureHostBootEvidence: () => fixtureProbe(),
    now: () => {
      clockReads += 1;
      return new Date(clockReads === 1
        ? "2026-07-15T21:00:00.000Z"
        : "2026-07-15T22:00:00.000Z");
    }
  };
  const first = createHostRestartApprovalRequest(requestOptions(requestPath), dependencies);
  assert.equal(first.schema, approvalRequestSchema);
  assert.match(first.approvalRequestId, /^[a-f0-9]{64}$/u);
  assert.equal(first.hostEvidenceClass, "fixture");
  assert.equal(first.restartCommand.command, "shutdown.exe");
  assert.equal(first.restartCommand.arguments.includes("/r"), true);
  assert.deepEqual(readHostRestartApprovalRequest(requestPath), first);
  const bytes = fs.readFileSync(requestPath);

  const repeated = createHostRestartApprovalRequest(requestOptions(requestPath), dependencies);
  assert.deepEqual(repeated, first);
  assert.equal(fs.readFileSync(requestPath).equals(bytes), true);
  assert.equal(fs.readFileSync(requestPath, "utf8").includes("private"), false);
});

test("arms a checkpoint only for the exact unexpired approval request", (context) => {
  const { requestPath, checkpointPath } = setup(context);
  const request = createHostRestartApprovalRequest(requestOptions(requestPath), {
    captureHostBootEvidence: () => fixtureProbe(),
    now: () => new Date("2026-07-15T21:00:00.000Z")
  });
  let sentinelStarts = 0;
  const dependencies = {
    captureHostBootEvidence: () => fixtureProbe(),
    now: () => new Date("2026-07-15T21:05:00.000Z"),
    startRestartSentinel: () => {
      sentinelStarts += 1;
      return Object.freeze({
        processId: 4321,
        processStartedAtUtc: "2026-07-15T21:05:00.000Z",
        markerSha256: digest("sentinel-marker"),
        commandSha256: digest("sentinel-command"),
        maximumLifetimeSeconds: 1800
      });
    },
    inspectRestartSentinel: () => true,
    restartSentinelMarkerRetained: retainedSentinelMarker
  };
  const options = {
    approvalRequestId: request.approvalRequestId,
    campaignId,
    checkpointPath,
    expectedTransition: {
      fromState: "BrowserTesting",
      toState: "Blocked",
      resumeFromState: "Qualified"
    },
    planId,
    planSha256,
    preRestartReceiptIds: [receiptB, receiptA],
    requestPath,
    sourceRevision,
    toolIdentitySha256
  };

  assert.throws(() => prepareHostRestartCheckpoint({
    ...options,
    approvalRequestId: digest("wrong-approval")
  }, dependencies), /approval request identity/i);

  const checkpoint = prepareHostRestartCheckpoint(options, dependencies);
  assert.equal(checkpoint.schema, checkpointSchema);
  assert.equal(checkpoint.approvalRequestId, request.approvalRequestId);
  assert.deepEqual(checkpoint.preRestartReceiptIds, [receiptA, receiptB]);
  assert.equal(checkpoint.preRestartReceiptCount, 2);
  assert.equal(checkpoint.preRestartReceiptSetSha256,
    digest(JSON.stringify([receiptA, receiptB])));
  assert.equal(checkpoint.operatorApprovalReferenceSha256,
    digest(`operator-approved:${request.approvalRequestId}`));
  assert.deepEqual(readHostRestartCheckpoint(checkpointPath), checkpoint);
  assert.equal(sentinelStarts, 1);

  const repeated = prepareHostRestartCheckpoint(options, dependencies);
  assert.deepEqual(repeated, checkpoint);
  assert.equal(sentinelStarts, 1);

  assert.throws(() => prepareHostRestartCheckpoint(options, {
    ...dependencies,
    now: () => new Date("2026-07-17T21:05:00.000Z")
  }), /approval request is expired/i);
});

test("rejects same-boot, host-drift, live-sentinel, and missing-receipt verification", (context) => {
  const { requestPath, checkpointPath } = setup(context);
  const request = createHostRestartApprovalRequest(requestOptions(requestPath), {
    captureHostBootEvidence: () => fixtureProbe(),
    now: () => new Date("2026-07-15T21:00:00.000Z")
  });
  const checkpoint = prepareHostRestartCheckpoint({
    approvalRequestId: request.approvalRequestId,
    campaignId,
    checkpointPath,
    expectedTransition: {
      fromState: "BrowserTesting",
      toState: "Blocked",
      resumeFromState: "Qualified"
    },
    planId,
    planSha256,
    preRestartReceiptIds: [receiptA, receiptB],
    requestPath,
    sourceRevision,
    toolIdentitySha256
  }, {
    captureHostBootEvidence: () => fixtureProbe(),
    now: () => new Date("2026-07-15T21:05:00.000Z"),
    startRestartSentinel: () => Object.freeze({
      processId: 4321,
      processStartedAtUtc: "2026-07-15T21:05:00.000Z",
      markerSha256: digest("sentinel-marker"),
      commandSha256: digest("sentinel-command"),
      maximumLifetimeSeconds: 1800
    })
  });
  const base = {
    checkpointPath,
    postRestartReceiptIds: [receiptA, receiptB, preparationReceiptId],
    preparationReceiptId,
    preparationReceiptRetained: true
  };

  assert.throws(() => verifyHostRestartCheckpoint(base, {
    captureHostBootEvidence: () => fixtureProbe(),
    inspectRestartSentinel: () => false,
    restartSentinelMarkerRetained: retainedSentinelMarker,
    now: () => new Date("2026-07-15T21:10:00.000Z")
  }), /boot identity did not change/i);

  assert.throws(() => verifyHostRestartCheckpoint(base, {
    captureHostBootEvidence: () => fixtureProbe(postBootIdentitySha256,
      "2026-07-15T21:06:00.000Z"),
    inspectRestartSentinel: () => false,
    restartSentinelMarkerRetained: () => false,
    now: () => new Date("2026-07-15T21:10:00.000Z")
  }), /sentinel marker was not retained unchanged/i);

  assert.throws(() => verifyHostRestartCheckpoint(base, {
    captureHostBootEvidence: () => Object.freeze({
      ...fixtureProbe(postBootIdentitySha256, "2026-07-15T21:06:00.000Z"),
      hostIdentitySha256: digest("different-host")
    }),
    inspectRestartSentinel: () => false,
    restartSentinelMarkerRetained: retainedSentinelMarker,
    now: () => new Date("2026-07-15T21:10:00.000Z")
  }), /host identity changed/i);

  assert.throws(() => verifyHostRestartCheckpoint(base, {
    captureHostBootEvidence: () => fixtureProbe(postBootIdentitySha256,
      "2026-07-15T21:06:00.000Z"),
    inspectRestartSentinel: () => true,
    restartSentinelMarkerRetained: retainedSentinelMarker,
    now: () => new Date("2026-07-15T21:10:00.000Z")
  }), /sentinel.*still running/i);

  assert.throws(() => verifyHostRestartCheckpoint({
    ...base,
    postRestartReceiptIds: [receiptA]
  }, {
    captureHostBootEvidence: () => fixtureProbe(postBootIdentitySha256,
      "2026-07-15T21:06:00.000Z"),
    inspectRestartSentinel: () => false,
    restartSentinelMarkerRetained: retainedSentinelMarker,
    now: () => new Date("2026-07-15T21:10:00.000Z")
  }), /pre-restart receipt set was not retained/i);

  assert.throws(() => verifyHostRestartCheckpoint(base, {
    captureHostBootEvidence: () => fixtureProbe(postBootIdentitySha256,
      "2026-07-16T21:00:01.000Z"),
    inspectRestartSentinel: () => false,
    restartSentinelMarkerRetained: retainedSentinelMarker,
    now: () => new Date("2026-07-16T21:05:00.000Z")
  }), /restart occurred after approval expiry/i);

  assert.equal(checkpoint.bootIdentitySha256, preBootIdentitySha256);
});

test("evaluates a changed boot without promoting injected fixture evidence", (context) => {
  const { requestPath, checkpointPath } = setup(context);
  const request = createHostRestartApprovalRequest(requestOptions(requestPath), {
    captureHostBootEvidence: () => fixtureProbe(),
    now: () => new Date("2026-07-15T21:00:00.000Z")
  });
  prepareHostRestartCheckpoint({
    approvalRequestId: request.approvalRequestId,
    campaignId,
    checkpointPath,
    expectedTransition: {
      fromState: "BrowserTesting",
      toState: "Blocked",
      resumeFromState: "Qualified"
    },
    planId,
    planSha256,
    preRestartReceiptIds: [receiptA, receiptB],
    requestPath,
    sourceRevision,
    toolIdentitySha256
  }, {
    captureHostBootEvidence: () => fixtureProbe(),
    now: () => new Date("2026-07-15T21:05:00.000Z"),
    startRestartSentinel: () => Object.freeze({
      processId: 4321,
      processStartedAtUtc: "2026-07-15T21:05:00.000Z",
      markerSha256: digest("sentinel-marker"),
      commandSha256: digest("sentinel-command"),
      maximumLifetimeSeconds: 1800
    })
  });

  const result = verifyHostRestartCheckpoint({
    checkpointPath,
    postRestartReceiptIds: [receiptB, preparationReceiptId, receiptA],
    preparationReceiptId,
    preparationReceiptRetained: true
  }, {
    captureHostBootEvidence: () => fixtureProbe(postBootIdentitySha256,
      "2026-07-15T21:06:00.000Z"),
    inspectRestartSentinel: () => false,
    restartSentinelMarkerRetained: retainedSentinelMarker,
    now: () => new Date("2026-07-15T21:10:00.000Z")
  });
  assert.deepEqual(result.observationCodes, [
    "boot-identity-changed",
    "receipt-dag-rebuilt",
    "orphan-process-scan-pass"
  ]);
  assert.equal(result.hardwareEvidence.actualPhysicalHostRestart, false);
  assert.equal(result.hardwareEvidence.injectedFixtureEvidence, true);
  assert.equal(result.hardwareEvidence.stableHostIdentityMatched, true);
  assert.equal(result.hardwareEvidence.preRestartAttemptRetained, true);
  assert.equal(result.outputHashes.bootIdentityBefore, preBootIdentitySha256);
  assert.equal(result.outputHashes.bootIdentityAfter, postBootIdentitySha256);
  assert.equal(result.verification.schema, verificationSchema);
  assert.deepEqual(readHostRestartVerification(result.verificationPath), result.verification);
  assert.match(result.outputHashes.postRestartVerification, /^[a-f0-9]{64}$/u);

  const repeated = verifyHostRestartCheckpoint({
    checkpointPath,
    postRestartReceiptIds: [receiptA, receiptB, preparationReceiptId],
    preparationReceiptId,
    preparationReceiptRetained: true
  }, {
    captureHostBootEvidence: () => fixtureProbe(postBootIdentitySha256,
      "2026-07-15T21:06:00.000Z"),
    inspectRestartSentinel: () => false,
    now: () => new Date("2026-07-15T21:11:00.000Z")
  });
  assert.equal(repeated.verification.verificationId, result.verification.verificationId);
  assert.deepEqual(repeated.outputHashes, result.outputHashes);
});

test("captures only hashed operating-system boot and machine identity", () => {
  const probe = captureHostBootEvidence();
  assert.equal(probe.evidenceClass, "target-platform");
  assert.equal(probe.probeSource, "operating-system");
  assert.match(probe.hostIdentitySha256, /^[a-f0-9]{64}$/u);
  assert.match(probe.bootIdentitySha256, /^[a-f0-9]{64}$/u);
  assert.match(probe.probeBinarySha256, /^[a-f0-9]{64}$/u);
  assert.match(probe.bootStartedAtUtc, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(Object.hasOwn(probe, "machineId"), false);
  assert.equal(Object.hasOwn(probe, "hostName"), false);
});

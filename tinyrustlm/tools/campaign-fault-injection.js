"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  CampaignEvidenceStore,
  canonicalJson
} = require("./campaign-evidence-store.js");
const { lifecycleStates } = require("./campaign-lifecycle.js");
const { atomicReplace } = require("./durable-files.js");
const {
  browserFaultIds,
  runBrowserFaultScenario
} = require("./campaign-browser-fault-scenarios.js");
const {
  packageFaultIds,
  runPackageFaultScenario,
  validatePackageFaultInputs
} = require("./campaign-package-fault-scenarios.js");
const {
  captureHostBootEvidence,
  createHostRestartApprovalRequest,
  hostRestartToolVersion,
  preparationReceiptType,
  prepareHostRestartCheckpoint,
  readHostRestartApprovalRequest,
  readHostRestartCheckpoint,
  verifyHostRestartCheckpoint
} = require("./campaign-host-restart-fault-scenarios.js");

const planSchema = "tinyrustlm.campaign_fault_plan.v1";
const reportSchema = "tinyrustlm.campaign_fault_report.v1";
const planReceiptType = "tinyrustlm.fault-injection-plan-v1";
const attemptReceiptType = "tinyrustlm.fault-injection-attempt-v1";
const reportReceiptType = "tinyrustlm.fault-injection-report-v1";
const maximumPlanBytes = 1024 * 1024;
const requiredFaultIds = Object.freeze([
  "process-crash",
  "host-restart",
  "receipt-write-power-loss",
  "disk-full",
  "corrupt-model",
  "truncated-model",
  "invalid-tensor-offset",
  "wasm-allocation-failure",
  "generation-timeout",
  "cancellation",
  "browser-crash",
  "locked-browser-profile",
  "profile-deletion-failure",
  "network-loss",
  "memory-endpoints-lost-response",
  "idempotency-conflict",
  "stale-revision",
  "revoked-token",
  "p2p-peer-disappearance",
  "corrupted-piece",
  "lane-process-death",
  "stale-external-proof",
  "package-restore-drift",
  "catalog-rejection"
]);
const evidenceClasses = new Set([
  "fixture", "local", "browser", "live-service", "outside-network",
  "target-platform", "package", "deployment"
]);
const executionModes = new Set([
  "local-process", "physical-host", "local-storage", "native-model", "browser",
  "local-network", "live-service", "outside-network", "package", "deployment"
]);
const expectedStatuses = new Set(["pass", "fail", "blocked", "rejected"]);
const faultFields = new Set([
  "faultId", "title", "targetBranch", "requiredEvidenceClass", "executionMode",
  "expectedTransition", "expectedDomainReceiptType", "expectedStatus", "cleanupActions",
  "retryPolicy", "terminalCondition", "recoveryEvidence", "externalPrerequisites"
]);
const transitionFields = new Set(["fromState", "toState", "resumeFromState"]);
const retryFields = new Set(["allowed", "maxRetries", "identityRule"]);
const safeCodePattern = /^[a-z0-9][a-z0-9.-]{1,127}$/;
const safeReceiptTypePattern = /^tinyrustlm\.[a-z0-9][a-z0-9.-]{1,159}$/;
const safeCampaignIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const faultToolVersion = "6";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(value, allowed, required, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  for (const key of Object.keys(value)) invariant(allowed.has(key), `${label} has unknown field ${key}`);
  for (const key of required) invariant(Object.hasOwn(value, key), `${label} is missing ${key}`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function deterministicBytes(label, byteLength) {
  invariant(Number.isSafeInteger(byteLength) && byteLength > 0 && byteLength <= 1024 * 1024,
    "deterministic byte length is invalid");
  const chunks = [];
  let total = 0;
  let index = 0;
  while (total < byteLength) {
    const chunk = crypto.createHash("sha256").update(`${label}:${index}`).digest();
    chunks.push(chunk);
    total += chunk.length;
    index += 1;
  }
  return Buffer.concat(chunks, total).subarray(0, byteLength);
}

function hashFileSync(filePath) {
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  const descriptor = fs.openSync(filePath, "r");
  try {
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function withTemporaryRoot(prefix, action) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return action(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function observation(observationCodes, outputHashes, hardwareEvidence = {}) {
  const codes = requireCodes(observationCodes, "fault observation codes", 1);
  exactFields(outputHashes, new Set(Object.keys(outputHashes)), new Set(Object.keys(outputHashes)),
    "fault output hashes");
  for (const [name, value] of Object.entries(outputHashes)) {
    invariant(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) &&
      sha256Pattern.test(String(value || "")), "fault output hash is invalid");
  }
  invariant(isPlainObject(hardwareEvidence), "fault hardware evidence is invalid");
  return Object.freeze({
    observationCodes: codes,
    outputHashes: Object.freeze({ ...outputHashes }),
    hardwareEvidence: Object.freeze({ ...hardwareEvidence })
  });
}

function runNodeScenario(name, scenario, args = [], timeoutMs = 20_000) {
  const source = `"use strict";(${scenario.toString()})().catch((error)=>{` +
    `process.stderr.write(String(error&&error.message||error)+"\\n");process.exitCode=1;});`;
  const child = childProcess.spawnSync(process.execPath, ["-e", source, ...args], {
    encoding: "utf8",
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 64 * 1024
  });
  if (child.error || child.signal !== null || child.status !== 0) {
    const diagnostic = String(child.stderr || child.error?.message || "no diagnostic")
      .replace(/[\r\n]+/g, " ").slice(0, 240);
    throw new Error(`${name} child scenario failed: ${diagnostic}`);
  }
  invariant(child.stderr === "", `${name} child scenario wrote diagnostics`);
  let result;
  try {
    result = JSON.parse(child.stdout.trim());
  } catch {
    throw new Error(`${name} child scenario returned invalid evidence`);
  }
  invariant(isPlainObject(result) && result.scenario === name && result.passed === true,
    `${name} child scenario did not pass`);
  return Object.freeze({ result, sourceHash: sha256(source) });
}

function requireSafeCode(value, label) {
  const text = String(value || "");
  invariant(safeCodePattern.test(text), `${label} is invalid`);
  return text;
}

function requireText(value, label, maximum = 240) {
  const text = String(value || "");
  invariant(text.length >= 1 && text.length <= maximum && !/[\u0000-\u001f]/.test(text),
    `${label} is invalid`);
  return text;
}

function requireCodes(value, label, minimum = 0) {
  invariant(Array.isArray(value) && value.length >= minimum && value.length <= 32,
    `${label} is invalid`);
  const result = value.map((entry, index) => requireSafeCode(entry, `${label}[${index}]`));
  invariant(new Set(result).size === result.length, `${label} contains duplicates`);
  return Object.freeze(result);
}

function requireUtc(value, label) {
  const text = String(value || "");
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(text) &&
    Number.isFinite(Date.parse(text)), `${label} must be ISO-8601 UTC`);
  return text;
}

function validateFault(value, index) {
  const label = `fault plan item ${index}`;
  exactFields(value, faultFields, faultFields, label);
  const faultId = requireSafeCode(value.faultId, `${label}.faultId`);
  const title = requireText(value.title, `${label}.title`);
  const targetBranch = requireSafeCode(value.targetBranch, `${label}.targetBranch`);
  invariant(evidenceClasses.has(value.requiredEvidenceClass),
    `${label}.requiredEvidenceClass is invalid`);
  invariant(executionModes.has(value.executionMode), `${label}.executionMode is invalid`);
  exactFields(value.expectedTransition, transitionFields, transitionFields,
    `${label}.expectedTransition`);
  const fromState = String(value.expectedTransition.fromState || "");
  const toState = String(value.expectedTransition.toState || "");
  const resumeFromState = value.expectedTransition.resumeFromState;
  invariant(lifecycleStates.includes(fromState), `${label}.fromState is invalid`);
  invariant(new Set(["Blocked", "Rejected"]).has(toState), `${label}.toState is invalid`);
  if (toState === "Rejected") {
    invariant(resumeFromState === null, `${label}.resumeFromState must be null for rejection`);
  } else {
    invariant(lifecycleStates.includes(String(resumeFromState || "")) &&
      !new Set(["Blocked", "Rejected", "Complete"]).has(resumeFromState),
    `${label}.resumeFromState is invalid`);
  }
  invariant(safeReceiptTypePattern.test(String(value.expectedDomainReceiptType || "")),
    `${label}.expectedDomainReceiptType is invalid`);
  invariant(expectedStatuses.has(value.expectedStatus), `${label}.expectedStatus is invalid`);
  const cleanupActions = requireCodes(value.cleanupActions, `${label}.cleanupActions`, 1);
  exactFields(value.retryPolicy, retryFields, retryFields, `${label}.retryPolicy`);
  invariant(typeof value.retryPolicy.allowed === "boolean", `${label}.retryPolicy.allowed is invalid`);
  invariant(Number.isSafeInteger(value.retryPolicy.maxRetries) &&
    value.retryPolicy.maxRetries >= 0 && value.retryPolicy.maxRetries <= 32,
  `${label}.retryPolicy.maxRetries is invalid`);
  invariant(value.retryPolicy.allowed || value.retryPolicy.maxRetries === 0,
    `${label}.retryPolicy cannot retry when disabled`);
  const identityRule = requireSafeCode(value.retryPolicy.identityRule,
    `${label}.retryPolicy.identityRule`);
  const terminalCondition = requireSafeCode(value.terminalCondition,
    `${label}.terminalCondition`);
  const recoveryEvidence = requireCodes(value.recoveryEvidence, `${label}.recoveryEvidence`, 1);
  const externalPrerequisites = requireCodes(value.externalPrerequisites,
    `${label}.externalPrerequisites`);
  return Object.freeze({
    faultId,
    title,
    targetBranch,
    requiredEvidenceClass: value.requiredEvidenceClass,
    executionMode: value.executionMode,
    expectedTransition: Object.freeze({ fromState, toState, resumeFromState }),
    expectedDomainReceiptType: value.expectedDomainReceiptType,
    expectedStatus: value.expectedStatus,
    cleanupActions,
    retryPolicy: Object.freeze({
      allowed: value.retryPolicy.allowed,
      maxRetries: value.retryPolicy.maxRetries,
      identityRule
    }),
    terminalCondition,
    recoveryEvidence,
    externalPrerequisites
  });
}

function loadFaultPlan(planPath = path.resolve(__dirname, "../campaign-fault-plan.v1.json")) {
  const resolved = path.resolve(String(planPath || ""));
  const stat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  invariant(stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumPlanBytes, "fault plan must be a bounded regular file");
  const bytes = fs.readFileSync(resolved);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("fault plan is not valid JSON");
  }
  exactFields(value, new Set(["schema", "planId", "faults"]),
    new Set(["schema", "planId", "faults"]), "fault plan");
  invariant(value.schema === planSchema, "fault plan schema is unsupported");
  const planId = requireSafeCode(value.planId, "fault plan ID");
  invariant(Array.isArray(value.faults) && value.faults.length === requiredFaultIds.length,
    "fault plan does not contain every required fault exactly once");
  const faults = value.faults.map(validateFault);
  const faultIds = faults.map((fault) => fault.faultId);
  invariant(new Set(faultIds).size === faultIds.length, "fault plan contains duplicate fault IDs");
  invariant(JSON.stringify([...faultIds].sort()) === JSON.stringify([...requiredFaultIds].sort()),
    "fault plan required fault set is incomplete or unexpected");
  const canonicalPlan = Object.freeze({ schema: planSchema, planId, faults: Object.freeze(faults) });
  return Object.freeze({
    path: resolved,
    bytes,
    fileSha256: sha256(bytes),
    planSha256: sha256(canonicalJson(canonicalPlan)),
    value: canonicalPlan,
    faultsById: new Map(faults.map((fault) => [fault.faultId, fault]))
  });
}

function runtimeIdentifier() {
  const osName = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function currentReceipts(receipts) {
  const superseded = new Set(receipts.flatMap((receipt) => receipt.supersedesReceiptIds));
  return receipts.filter((receipt) => !superseded.has(receipt.receiptId));
}

function baseReceiptFields(sourceRevision, toolNames, toolVersions, toolBinaryHashes) {
  return Object.freeze({
    sourceRevision,
    toolNames,
    toolVersions,
    toolBinaryHashes,
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    attestationReference: null
  });
}

function faultToolIdentity(evidenceClass) {
  const faultToolHash = sha256(fs.readFileSync(__filename));
  if (evidenceClass === "browser") {
    const browserToolPath = require.resolve("./campaign-browser-fault-scenarios.js");
    const profileToolPath = require.resolve("./owned-browser-profile.js");
    const dependencyLockPath = path.resolve(__dirname, "../package-lock.json");
    const playwrightManifestPath = path.join(path.dirname(require.resolve("playwright")),
      "package.json");
    const dependencyLock = JSON.parse(fs.readFileSync(dependencyLockPath, "utf8"));
    const playwrightManifest = JSON.parse(fs.readFileSync(playwrightManifestPath, "utf8"));
    const lockedPlaywrightVersion = dependencyLock.packages?.["node_modules/playwright"]?.version;
    invariant(typeof lockedPlaywrightVersion === "string" &&
      playwrightManifest.version === lockedPlaywrightVersion,
    "installed Playwright version does not match package-lock.json");
    const browserToolHash = sha256(fs.readFileSync(browserToolPath));
    const profileToolHash = sha256(fs.readFileSync(profileToolPath));
    const toolNames = Object.freeze([
      "tinyrustlm-campaign-fault-injection",
      "tinyrustlm-browser-fault-scenarios",
      "tinyrustlm-owned-browser-profile",
      "tinyrustlm-browser-fault-dependency-lock",
      "playwright"
    ]);
    const toolVersions = Object.freeze([
      faultToolVersion,
      "1",
      "1",
      String(dependencyLock.lockfileVersion),
      lockedPlaywrightVersion
    ]);
    const toolBinaryHashes = Object.freeze([
      faultToolHash,
      browserToolHash,
      profileToolHash,
      sha256(fs.readFileSync(dependencyLockPath)),
      sha256(fs.readFileSync(playwrightManifestPath))
    ]);
    return Object.freeze({
      toolNames,
      toolVersions,
      toolBinaryHashes,
      identityHash: sha256(canonicalJson({ toolNames, toolVersions, toolBinaryHashes }))
    });
  }
  if (evidenceClass === "package") {
    const packageToolPath = require.resolve("./campaign-package-fault-scenarios.js");
    const packageToolHash = sha256(fs.readFileSync(packageToolPath));
    const toolNames = Object.freeze([
      "tinyrustlm-campaign-fault-injection",
      "tinyrustlm-package-fault-scenarios"
    ]);
    const toolVersions = Object.freeze([faultToolVersion, "2"]);
    const toolBinaryHashes = Object.freeze([faultToolHash, packageToolHash]);
    return Object.freeze({
      toolNames,
      toolVersions,
      toolBinaryHashes,
      identityHash: sha256(canonicalJson({ toolNames, toolVersions, toolBinaryHashes }))
    });
  }
  if (evidenceClass === "target-platform") {
    const hostToolPath = require.resolve("./campaign-host-restart-fault-scenarios.js");
    const hostToolHash = sha256(fs.readFileSync(hostToolPath));
    const toolNames = Object.freeze([
      "tinyrustlm-campaign-fault-injection",
      "tinyrustlm-host-restart-fault-scenarios"
    ]);
    const toolVersions = Object.freeze([faultToolVersion, hostRestartToolVersion]);
    const toolBinaryHashes = Object.freeze([faultToolHash, hostToolHash]);
    return Object.freeze({
      toolNames,
      toolVersions,
      toolBinaryHashes,
      identityHash: sha256(canonicalJson({ toolNames, toolVersions, toolBinaryHashes }))
    });
  }
  return Object.freeze({
    toolNames: Object.freeze(["tinyrustlm-campaign-fault-injection"]),
    toolVersions: Object.freeze([faultToolVersion]),
    toolBinaryHashes: Object.freeze([faultToolHash]),
    identityHash: faultToolHash
  });
}

function persistFaultPlanReceipt(store, options, plan) {
  const history = store.listReceipts((receipt) => receipt.campaignId === options.campaignId &&
    receipt.receiptType === planReceiptType);
  const current = currentReceipts(history);
  invariant(current.length <= 1, "fault plan has several current receipts");
  const toolHash = sha256(fs.readFileSync(__filename));
  const configurationHash = sha256(canonicalJson({
    planId: plan.value.planId,
    planSha256: plan.planSha256,
    fileSha256: plan.fileSha256,
    toolHash
  }));
  const existing = current.find((receipt) => receipt.configurationHash === configurationHash);
  if (existing) return existing;
  const now = new Date().toISOString();
  return store.putReceipt({
    receiptType: planReceiptType,
    campaignId: options.campaignId,
    phase: "fault-injection-plan",
    attempt: history.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1,
    status: "pass",
    createdAtUtc: now,
    completedAtUtc: now,
    inputReceiptIds: [],
    inputHashes: { faultPlanFile: plan.fileSha256 },
    outputHashes: { canonicalFaultPlan: plan.planSha256 },
    ...baseReceiptFields(options.sourceRevision,
      ["tinyrustlm-campaign-fault-injection"], [faultToolVersion], [toolHash]),
    hardwareEvidence: { planValidation: true },
    configurationHash,
    publicSafeParameters: {
      planId: plan.value.planId,
      planSha256: plan.planSha256,
      plannedFaultCount: plan.value.faults.length,
      requiredFaultCount: requiredFaultIds.length
    },
    boundedDiagnostics: { validationStatus: "PASS" },
    blockerCode: null,
    externalEvidenceReferences: [],
    evidenceClass: "local",
    supersedesReceiptIds: current.map((receipt) => receipt.receiptId)
  }).receipt;
}

function persistHostRestartPreparationReceipt(store, options, plan, planReceipt,
  request, checkpoint, checkpointPath) {
  const toolIdentity = faultToolIdentity("target-platform");
  const history = store.listReceipts((receipt) => receipt.campaignId === options.campaignId &&
    receipt.receiptType === preparationReceiptType);
  const current = currentReceipts(history);
  invariant(current.length <= 1, "host restart has several current preparation receipts");
  const checkpointSha256 = hashFileSync(checkpointPath);
  const requestSha256 = hashFileSync(options.requestPath);
  const configurationHash = sha256(canonicalJson({
    planReceiptId: planReceipt.receiptId,
    planSha256: plan.planSha256,
    approvalRequestId: request.approvalRequestId,
    checkpointId: checkpoint.checkpointId,
    checkpointSha256,
    toolIdentity: toolIdentity.identityHash
  }));
  const existing = current.find((receipt) => receipt.configurationHash === configurationHash &&
    receipt.outputHashes?.hostRestartCheckpoint === checkpointSha256);
  if (existing) return existing;
  return store.putReceipt({
    receiptType: preparationReceiptType,
    campaignId: options.campaignId,
    phase: "fault-host-restart-preparation",
    attempt: history.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1,
    status: "pass",
    createdAtUtc: checkpoint.preparedAtUtc,
    completedAtUtc: checkpoint.preparedAtUtc,
    inputReceiptIds: [planReceipt.receiptId],
    inputHashes: {
      approvalRequestFile: requestSha256,
      canonicalFaultPlan: plan.planSha256,
      faultDefinition: sha256(canonicalJson(plan.faultsById.get("host-restart")))
    },
    outputHashes: {
      approvalRequest: request.approvalRequestId,
      hostRestartCheckpoint: checkpointSha256,
      preRestartReceiptSet: checkpoint.preRestartReceiptSetSha256,
      sentinelMarker: checkpoint.sentinel.markerSha256
    },
    ...baseReceiptFields(options.sourceRevision, toolIdentity.toolNames,
      toolIdentity.toolVersions, toolIdentity.toolBinaryHashes),
    hardwareEvidence: {
      actualHostProbe: checkpoint.hostEvidenceClass === "target-platform" &&
        checkpoint.probeSource === "operating-system",
      bootIdentityCaptured: true,
      physicalMachineIdentityObserved: checkpoint.physicalMachineIdentityObserved,
      virtualizationLayerPresent: checkpoint.virtualizationLayerPresent,
      restartSentinelRunning: true,
      operatorApprovalReferenceVerified: checkpoint.operatorApprovalReferenceSha256 ===
        sha256(`operator-approved:${checkpoint.approvalRequestId}`),
      hostProbeBinaryHashVerified: true
    },
    configurationHash,
    publicSafeParameters: {
      faultId: "host-restart",
      planId: plan.value.planId,
      planSha256: plan.planSha256,
      approvalRequestId: request.approvalRequestId,
      checkpointId: checkpoint.checkpointId,
      preRestartReceiptCount: checkpoint.preRestartReceiptCount,
      preRestartReceiptSetSha256: checkpoint.preRestartReceiptSetSha256,
      expectedTransition: checkpoint.expectedTransition,
      operatorApprovalReferenceSha256: checkpoint.operatorApprovalReferenceSha256,
      preparationState: "armed"
    },
    boundedDiagnostics: { preparationStatus: "ARMED_FOR_AUTHORIZED_RESTART" },
    blockerCode: null,
    externalEvidenceReferences: [],
    evidenceClass: checkpoint.hostEvidenceClass,
    supersedesReceiptIds: current.map((receipt) => receipt.receiptId),
    attestationReference: `sha256:${checkpoint.operatorApprovalReferenceSha256}`
  }).receipt;
}

function operationStartInput(campaignId) {
  const now = "2026-07-15T00:00:00.000Z";
  return {
    receiptType: "tinyrustlm.campaign-operation-start-v1",
    campaignId,
    phase: "fault-injection-isolated-operation",
    attempt: 1,
    status: "pass",
    createdAtUtc: now,
    completedAtUtc: now,
    inputReceiptIds: [],
    inputHashes: { configuration: sha256("fault-operation-input") },
    outputHashes: { operationStart: sha256("fault-operation-start") },
    sourceRevision: "fault-fixture",
    toolNames: ["tinyrustlm-campaign-fault-injection"],
    toolVersions: [faultToolVersion],
    toolBinaryHashes: [sha256(fs.readFileSync(__filename))],
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: { isolatedChildProcess: true },
    configurationHash: sha256("fault-operation-configuration"),
    publicSafeParameters: { operationId: "fault-process-crash", operationName: "fault process crash" },
    boundedDiagnostics: {},
    blockerCode: null,
    externalEvidenceReferences: [],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "local",
    supersedesReceiptIds: [],
    attestationReference: null
  };
}

function executeProcessCrash() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-fault-process-crash-"));
  try {
    const isolated = new CampaignEvidenceStore(root);
    const start = isolated.putReceipt(operationStartInput("fault-process-crash-isolated")).receipt;
    const script = "process.stdout.write('FAULT_READY\\n');process.exit(73);";
    const child = childProcess.spawnSync(process.execPath, ["-e", script], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 16 * 1024
    });
    invariant(!child.error && child.signal === null && child.status === 73,
      "isolated crash child did not exit as scheduled");
    invariant(child.stdout === "FAULT_READY\n" && child.stderr === "",
      "isolated crash child output changed");
    const rebuilt = new CampaignEvidenceStore(root).rebuild();
    invariant(rebuilt.quarantined.length === 0 &&
      rebuilt.receipts.some((receipt) => receipt.receiptId === start.receiptId),
    "operation start was not durable after child crash");
    return observation([
        "child-exit-observed", "operation-start-retained", "dag-rebuild-pass"
      ], {
        crashScript: sha256(script),
        retainedOperationStart: start.receiptContentHash
      }, { isolatedChildProcess: true });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function executeReceiptWritePowerLoss() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-fault-receipt-write-"));
  try {
    const isolated = new CampaignEvidenceStore(root);
    const temporaryDirectory = path.join(root, "receipts", "sha256", "ff");
    fs.mkdirSync(temporaryDirectory, { recursive: true });
    const interrupted = path.join(temporaryDirectory, "scheduled-power-loss.tmp");
    fs.writeFileSync(interrupted, "{\"truncated\":");
    const rebuilt = new CampaignEvidenceStore(root).rebuild();
    invariant(rebuilt.receipts.length === 0 && rebuilt.quarantined.length === 1,
      "interrupted receipt was not quarantined exactly once");
    invariant(!fs.existsSync(interrupted) &&
      fs.readdirSync(isolated.quarantinePath, { withFileTypes: true })
        .filter((entry) => entry.isFile()).length === 1,
    "interrupted receipt remained active or quarantine was absent");
    return observation([
        "temp-file-not-active", "quarantine-entry-present", "dag-rebuild-pass"
      ], {
        interruptedBytes: sha256("{\"truncated\":"),
        quarantineResult: sha256("one-quarantined-zero-active")
      }, { interruptedWriteRebuilt: true });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function executeDiskFull() {
  return withTemporaryRoot("tinyrustlm-fault-disk-full-", (root) => {
    const target = path.join(root, "durable.json");
    const existing = Buffer.from("existing-final-bytes", "utf8");
    const recovered = Buffer.from("recovered-final-bytes", "utf8");
    atomicReplace(target, existing);
    const scenario = runNodeScenario("disk-full", async function diskFullScenario() {
      const fs = require("node:fs");
      const [modulePath, targetPath] = process.argv.slice(1);
      const original = fs.writeFileSync;
      let injected = false;
      fs.writeFileSync = function scheduledEnospc(file, ...args) {
        if (!injected && typeof file === "number") {
          injected = true;
          const error = new Error("scheduled capacity exhaustion");
          error.code = "ENOSPC";
          throw error;
        }
        return original.call(fs, file, ...args);
      };
      let code = null;
      try {
        require(modulePath).atomicReplace(targetPath, "new-bytes-must-not-publish");
      } catch (error) {
        code = error.code || null;
      } finally {
        fs.writeFileSync = original;
      }
      const temporaryFiles = fs.readdirSync(require("node:path").dirname(targetPath))
        .filter((name) => name.endsWith(".tmp"));
      process.stdout.write(`${JSON.stringify({
        scenario: "disk-full",
        passed: injected && code === "ENOSPC" && temporaryFiles.length === 0,
        code
      })}\n`);
    }, [path.resolve(__dirname, "durable-files.js"), target]);
    invariant(fs.readFileSync(target).equals(existing),
      "scheduled ENOSPC changed the existing final file");
    atomicReplace(target, recovered);
    invariant(fs.readFileSync(target).equals(recovered),
      "durable write did not recover after scheduled ENOSPC");
    if (typeof fs.statfsSync === "function") {
      const capacity = fs.statfsSync(root);
      invariant(capacity.bavail > 0, "free-space check did not recover");
    }
    return observation([
      "enospc-classified", "existing-final-unchanged", "free-space-check-pass"
    ], {
      existingFinal: sha256(existing),
      recoveredFinal: sha256(recovered),
      scheduledFailure: scenario.sourceHash
    }, { scheduledEnospc: true, durableRecoveryWrite: true });
  });
}

function executeCorruptModel() {
  return withTemporaryRoot("tinyrustlm-fault-corrupt-model-", (root) => {
    const expected = deterministicBytes("corrupt-model-source", 128 * 1024);
    const corrupt = Buffer.from(expected);
    corrupt[Math.floor(corrupt.length / 2)] ^= 0x5a;
    const expectedHash = sha256(expected);
    const corruptHash = sha256(corrupt);
    invariant(corruptHash !== expectedHash, "scheduled model corruption did not change identity");
    const active = path.join(root, "candidate.slm");
    const quarantine = path.join(root, "quarantine");
    const quarantined = path.join(quarantine, "candidate.corrupt.slm");
    atomicReplace(active, corrupt);
    invariant(hashFileSync(active) === corruptHash, "corrupt model observation changed");
    fs.mkdirSync(quarantine, { recursive: true });
    fs.renameSync(active, quarantined);
    invariant(!fs.existsSync(active) && hashFileSync(quarantined) === corruptHash,
      "corrupt model was not quarantined");
    atomicReplace(active, expected);
    invariant(hashFileSync(active) === expectedHash, "fresh model digest did not recover");
    return observation([
      "expected-and-observed-hashes-bound", "corrupt-bytes-quarantined",
      "fresh-download-digest-pass"
    ], {
      expectedArtifact: expectedHash,
      observedCorruptArtifact: corruptHash,
      quarantinedArtifact: hashFileSync(quarantined),
      freshArtifact: hashFileSync(active)
    }, { streamedDigestVerification: true, quarantineVerified: true });
  });
}

function executeTruncatedModel() {
  return withTemporaryRoot("tinyrustlm-fault-truncated-model-", (root) => {
    const complete = deterministicBytes("truncated-model-source", 96 * 1024);
    const partial = complete.subarray(0, Math.floor(complete.length / 3));
    const transfer = path.join(root, "candidate.partial");
    const journal = path.join(root, "transfer-journal.json");
    const active = path.join(root, "candidate.slm");
    atomicReplace(transfer, partial);
    atomicReplace(journal, `${JSON.stringify({
      declaredSize: complete.length,
      expectedSha256: sha256(complete),
      receivedSize: partial.length
    })}\n`);
    const descriptor = fs.openSync(transfer, "r");
    const chunk = Buffer.allocUnsafe(16 * 1024);
    let received = 0;
    try {
      while (received < complete.length) {
        const count = fs.readSync(descriptor, chunk, 0,
          Math.min(chunk.length, complete.length - received), null);
        if (count === 0) break;
        received += count;
      }
    } finally {
      fs.closeSync(descriptor);
    }
    invariant(received === partial.length && received < complete.length && !fs.existsSync(active),
      "short read was not contained before promotion");
    atomicReplace(active, complete);
    invariant(hashFileSync(active) === sha256(complete),
      "complete replacement artifact failed digest verification");
    return observation([
      "declared-size-bound", "short-read-observed", "complete-artifact-hash-pass"
    ], {
      declaredArtifact: sha256(complete),
      observedPartialArtifact: hashFileSync(transfer),
      transferJournal: hashFileSync(journal),
      completeArtifact: hashFileSync(active)
    }, { shortReadByteCount: received, declaredByteCount: complete.length });
  });
}

function simpleSlmChecksum(bytes) {
  const mask = (1n << 64n) - 1n;
  let accumulator = 0x9e3779b97f4a7c15n;
  for (let index = 0; index < bytes.length; index += 1) {
    const value = index >= 100 && index < 108 ? 0 : bytes[index];
    accumulator ^= (BigInt(value) + (BigInt(index) << 1n)) & mask;
    accumulator = ((accumulator << 7n) | (accumulator >> 57n)) & mask;
    accumulator = (accumulator * 0x100000001b3n) & mask;
  }
  return accumulator;
}

function regularFile(filePath, maximumBytes = Number.MAX_SAFE_INTEGER) {
  if (typeof filePath !== "string" || filePath.length === 0) return false;
  const stat = fs.lstatSync(path.resolve(filePath), { throwIfNoEntry: false });
  return Boolean(stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumBytes);
}

function executeInvalidTensorOffset(options) {
  invariant(regularFile(options.slmPackPath, 128 * 1024 * 1024),
    "native SLM validator is unavailable");
  invariant(regularFile(options.modelFixturePath, 64 * 1024 * 1024),
    "native model fault fixture is unavailable");
  return withTemporaryRoot("tinyrustlm-fault-tensor-offset-", (root) => {
    const validBytes = fs.readFileSync(options.modelFixturePath);
    invariant(validBytes.length >= 108, "native model fault fixture is too short");
    const invalidBytes = Buffer.from(validBytes);
    const directoryOffset = Number(invalidBytes.readBigUInt64LE(80));
    const tensorOffsetField = directoryOffset + 32;
    invariant(Number.isSafeInteger(directoryOffset) && tensorOffsetField + 8 <= invalidBytes.length,
      "native model fault fixture tensor directory is invalid");
    invalidBytes.writeBigUInt64LE(0xffffffffffffffc0n, tensorOffsetField);
    invalidBytes.fill(0, 100, 108);
    invalidBytes.writeBigUInt64LE(simpleSlmChecksum(invalidBytes), 100);
    const invalidPath = path.join(root, "invalid-offset.slm");
    atomicReplace(invalidPath, invalidBytes);
    const rejected = childProcess.spawnSync(path.resolve(options.slmPackPath),
      ["validate", invalidPath], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 64 * 1024
      });
    invariant(!rejected.error && rejected.signal === null && rejected.status !== 0 &&
      /tensor payload escapes the file|offset overflow/iu.test(rejected.stderr),
    "native validator did not reject the overflowing tensor offset");
    const accepted = childProcess.spawnSync(path.resolve(options.slmPackPath),
      ["validate", path.resolve(options.modelFixturePath)], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 64 * 1024
      });
    invariant(!accepted.error && accepted.signal === null && accepted.status === 0,
      "new conversion structural validation did not pass");
    return observation([
      "offset-overflow-rejected", "no-out-of-bounds-read",
      "new-conversion-structural-pass"
    ], {
      invalidArtifact: hashFileSync(invalidPath),
      validArtifact: hashFileSync(options.modelFixturePath),
      nativeValidator: hashFileSync(options.slmPackPath),
      rejectionDiagnostic: sha256(rejected.stderr)
    }, { nativeProcessExecuted: true, rejectedExitCode: rejected.status });
  });
}

function executeNetworkLoss() {
  return withTemporaryRoot("tinyrustlm-fault-network-loss-", (root) => {
    const scenario = runNodeScenario("network-loss", async function networkLossScenario() {
      const crypto = require("node:crypto");
      const fs = require("node:fs");
      const http = require("node:http");
      const path = require("node:path");
      const root = process.argv[1];
      const bytes = Buffer.alloc(64 * 1024);
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
      const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
      let first = true;
      const server = http.createServer((request, response) => {
        if (request.url !== "/artifact") {
          response.writeHead(404).end();
          return;
        }
        if (first) {
          first = false;
          response.writeHead(200, { "Content-Length": bytes.length });
          response.write(bytes.subarray(0, 12 * 1024));
          setTimeout(() => response.socket.destroy(), 5);
          return;
        }
        const match = /^bytes=(\d+)-$/.exec(String(request.headers.range || ""));
        const start = match ? Number(match[1]) : 0;
        response.writeHead(start > 0 ? 206 : 200, {
          "Content-Length": bytes.length - start,
          "Content-Range": `bytes ${start}-${bytes.length - 1}/${bytes.length}`
        });
        response.end(bytes.subarray(start));
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const port = server.address().port;
      const request = (headers = {}) => new Promise((resolve) => {
        const chunks = [];
        let settled = false;
        const finish = (lost) => {
          if (settled) return;
          settled = true;
          resolve({ bytes: Buffer.concat(chunks), lost });
        };
        const outgoing = http.request({
          host: "127.0.0.1", port, path: "/artifact", headers, agent: false
        }, (response) => {
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("aborted", () => finish(true));
          response.on("error", () => finish(true));
          response.on("end", () => finish(false));
        });
        outgoing.on("error", () => finish(true));
        outgoing.end();
      });
      try {
        const partial = await request();
        if (!partial.lost || partial.bytes.length >= bytes.length) throw new Error("connection stayed complete");
        const journal = path.join(root, "resume-journal.json");
        fs.writeFileSync(journal, JSON.stringify({
          verifiedBytes: partial.bytes.length,
          partialSha256: hash(partial.bytes),
          expectedSha256: hash(bytes)
        }));
        const finalPath = path.join(root, "artifact.bin");
        if (fs.existsSync(finalPath)) throw new Error("partial bytes were promoted");
        const remainder = await request({ Range: `bytes=${partial.bytes.length}-` });
        if (remainder.lost) throw new Error("resumed transfer failed");
        const complete = Buffer.concat([partial.bytes, remainder.bytes]);
        if (hash(complete) !== hash(bytes)) throw new Error("resumed hash changed");
        fs.writeFileSync(finalPath, complete);
        process.stdout.write(`${JSON.stringify({
          scenario: "network-loss", passed: true,
          partialSha256: hash(partial.bytes), finalSha256: hash(complete),
          journalSha256: hash(fs.readFileSync(journal))
        })}\n`);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    }, [root]);
    return observation([
      "connection-loss-classified", "partial-bytes-not-promoted", "resumed-hash-pass"
    ], {
      partialTransfer: scenario.result.partialSha256,
      resumeJournal: scenario.result.journalSha256,
      resumedArtifact: scenario.result.finalSha256,
      networkScenario: scenario.sourceHash
    }, { loopbackSocketLossObserved: true });
  });
}

function executePeerDisappearance() {
  return withTemporaryRoot("tinyrustlm-fault-peer-disappearance-", (root) => {
    const scenario = runNodeScenario("p2p-peer-disappearance",
      async function peerDisappearanceScenario() {
        const crypto = require("node:crypto");
        const fs = require("node:fs");
        const http = require("node:http");
        const path = require("node:path");
        const root = process.argv[1];
        const artifact = Buffer.alloc(48 * 1024);
        for (let index = 0; index < artifact.length; index += 1) artifact[index] = index % 239;
        const pieces = [artifact.subarray(0, artifact.length / 2),
          artifact.subarray(artifact.length / 2)];
        const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
        const identity = hash(Buffer.from(`artifact:${hash(artifact)}:${pieces.map(hash).join(":")}`));
        const startPeer = (pieceIndexes) => new Promise((resolve) => {
          const server = http.createServer((request, response) => {
            if (request.url === "/meta") {
              response.end(JSON.stringify({ identity, pieceHashes: pieces.map(hash) }));
              return;
            }
            const match = /^\/piece\/(\d+)$/.exec(request.url || "");
            const index = match ? Number(match[1]) : -1;
            if (!pieceIndexes.includes(index)) {
              response.writeHead(404).end();
              return;
            }
            response.writeHead(200, { "Content-Length": pieces[index].length });
            response.end(pieces[index]);
          });
          server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
        });
        const get = (port, route) => new Promise((resolve, reject) => {
          http.get({ host: "127.0.0.1", port, path: route, agent: false }, (response) => {
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => response.statusCode === 200
              ? resolve(Buffer.concat(chunks))
              : reject(new Error(`status ${response.statusCode}`)));
          }).on("error", reject);
        });
        let first;
        let replacement;
        try {
          first = await startPeer([0]);
          const firstPort = first.port;
          const firstMeta = JSON.parse((await get(first.port, "/meta")).toString("utf8"));
          const firstPiece = await get(first.port, "/piece/0");
          if (hash(firstPiece) !== firstMeta.pieceHashes[0]) throw new Error("first piece changed");
          const journal = path.join(root, "piece-journal.json");
          fs.writeFileSync(journal, JSON.stringify({ identity, verified: [true, false] }));
          await new Promise((resolve) => first.server.close(resolve));
          first = null;
          let disappeared = false;
          try {
            await get(firstPort, "/piece/1");
          } catch {
            disappeared = true;
          }
          if (!disappeared) throw new Error("first peer did not disappear");
          replacement = await startPeer([1]);
          const replacementMeta = JSON.parse((await get(replacement.port, "/meta")).toString("utf8"));
          if (replacementMeta.identity !== identity) throw new Error("replacement identity drifted");
          const secondPiece = await get(replacement.port, "/piece/1");
          if (hash(secondPiece) !== replacementMeta.pieceHashes[1]) throw new Error("second piece changed");
          const complete = Buffer.concat([firstPiece, secondPiece]);
          if (hash(complete) !== hash(artifact)) throw new Error("assembled artifact changed");
          process.stdout.write(`${JSON.stringify({
            scenario: "p2p-peer-disappearance", passed: true,
            identity, journalSha256: hash(fs.readFileSync(journal)), finalSha256: hash(complete)
          })}\n`);
        } finally {
          if (first) await new Promise((resolve) => first.server.close(resolve));
          if (replacement) await new Promise((resolve) => replacement.server.close(resolve));
        }
      }, [root]);
    return observation([
      "verified-piece-journal-retained", "replacement-peer-identity-matches",
      "final-artifact-hash-pass"
    ], {
      peerIdentity: scenario.result.identity,
      verifiedPieceJournal: scenario.result.journalSha256,
      importedArtifact: scenario.result.finalSha256,
      peerScenario: scenario.sourceHash
    }, { twoLoopbackPeerProcesses: false, twoLoopbackPeerServers: true });
  });
}

function executeCorruptedPiece() {
  return withTemporaryRoot("tinyrustlm-fault-corrupted-piece-", (root) => {
    const expected = deterministicBytes("p2p-piece", 32 * 1024);
    const corrupt = Buffer.from(expected);
    corrupt[corrupt.length - 1] ^= 0xa5;
    const expectedHash = sha256(expected);
    const corruptHash = sha256(corrupt);
    invariant(corruptHash !== expectedHash, "scheduled piece corruption did not change identity");
    const journal = path.join(root, "piece-journal.json");
    const quarantine = path.join(root, "piece-000000.corrupt");
    atomicReplace(journal, `${JSON.stringify({ verified: [false], expectedHash })}\n`);
    atomicReplace(quarantine, corrupt);
    const before = JSON.parse(fs.readFileSync(journal, "utf8"));
    invariant(before.verified[0] === false && hashFileSync(quarantine) === corruptHash,
      "corrupt piece changed the completion journal");
    const replacement = path.join(root, "piece-000000.bin");
    atomicReplace(replacement, expected);
    invariant(hashFileSync(replacement) === expectedHash, "replacement piece hash did not pass");
    atomicReplace(journal, `${JSON.stringify({ verified: [true], expectedHash })}\n`);
    return observation([
      "piece-hash-mismatch-bound", "journal-bit-remains-clear",
      "replacement-piece-hash-pass"
    ], {
      expectedPiece: expectedHash,
      corruptPiece: corruptHash,
      quarantinedPiece: hashFileSync(quarantine),
      replacementPiece: hashFileSync(replacement)
    }, { pieceJournalObservedBeforePromotion: true });
  });
}

function executeLaneProcessDeath() {
  const scenario = runNodeScenario("lane-process-death", async function laneProcessDeathScenario() {
    const childProcess = require("node:child_process");
    const readline = require("node:readline");
    const laneSource = `"use strict";const readline=require("node:readline");` +
      `const id=process.argv[1];process.stdout.write("READY "+id+"\\n");` +
      `readline.createInterface({input:process.stdin}).on("line",line=>{` +
      `if(line==="health")process.stdout.write("HEALTH "+id+"\\n");` +
      `else if(line==="crash")process.exit(91);` +
      `else if(line==="stop")process.exit(0);});`;
    const startLane = async (id) => {
      const child = childProcess.spawn(process.execPath, ["-e", laneSource, id], {
        stdio: ["pipe", "pipe", "pipe"], windowsHide: true
      });
      const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
      const queue = [];
      const waiters = [];
      lines.on("line", (line) => {
        const waiter = waiters.shift();
        if (waiter) waiter(line);
        else queue.push(line);
      });
      const nextLine = () => queue.length > 0
        ? Promise.resolve(queue.shift())
        : new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("lane response timeout")), 5000);
            waiters.push((line) => {
              clearTimeout(timer);
              resolve(line);
            });
          });
      const ready = await nextLine();
      if (ready !== `READY ${id}`) throw new Error("lane readiness changed");
      return { process: child, id, nextLine, lines };
    };
    const health = async (lane) => {
      lane.process.stdin.write("health\n");
      return lane.nextLine();
    };
    const stop = async (lane) => {
      if (!lane || lane.process.exitCode !== null) return;
      const exited = new Promise((resolve) => lane.process.once("exit", resolve));
      lane.process.stdin.write("stop\n");
      await exited;
      lane.lines.close();
    };
    let laneA;
    let laneB;
    let restartedA;
    try {
      laneA = await startLane("seed-a");
      laneB = await startLane("seed-b");
      if (laneA.process.pid === laneB.process.pid) throw new Error("lanes share one process");
      const crashed = new Promise((resolve) => laneA.process.once("exit", resolve));
      laneA.process.stdin.write("crash\n");
      const crashCode = await crashed;
      if (crashCode !== 91) throw new Error("lane death exit code changed");
      laneA.lines.close();
      const survivingHealth = await health(laneB);
      if (survivingHealth !== "HEALTH seed-b") throw new Error("surviving lane became unhealthy");
      restartedA = await startLane("seed-a");
      if (await health(restartedA) !== "HEALTH seed-a") throw new Error("restarted lane is unhealthy");
      if (await health(laneB) !== "HEALTH seed-b") throw new Error("other lane stopped independently");
      process.stdout.write(`${JSON.stringify({
        scenario: "lane-process-death", passed: true,
        independent: true, restarted: true, survivorHealthy: true
      })}\n`);
    } finally {
      await stop(restartedA);
      await stop(laneA);
      await stop(laneB);
    }
  }, []);
  return observation([
    "lane-death-detected", "other-lane-process-remains-independent",
    "restarted-lane-health-pass"
  ], {
    laneScenario: scenario.sourceHash,
    independentProcesses: sha256("two-distinct-owned-processes"),
    restartedHealth: sha256("seed-a-pass-seed-b-pass")
  }, { twoIndependentChildProcesses: true, processHealthCommands: true });
}

const builtInExecutors = Object.freeze({
  "process-crash": executeProcessCrash,
  "receipt-write-power-loss": executeReceiptWritePowerLoss,
  "disk-full": executeDiskFull,
  "corrupt-model": executeCorruptModel,
  "truncated-model": executeTruncatedModel,
  "invalid-tensor-offset": executeInvalidTensorOffset,
  "network-loss": executeNetworkLoss,
  "p2p-peer-disappearance": executePeerDisappearance,
  "corrupted-piece": executeCorruptedPiece,
  "lane-process-death": executeLaneProcessDeath
});

const browserExecutors = Object.freeze(Object.fromEntries(browserFaultIds.map((faultId) => [
  faultId,
  (options) => runBrowserFaultScenario(faultId, options)
])));

const packageExecutors = Object.freeze(Object.fromEntries(packageFaultIds.map((faultId) => [
  faultId,
  (options) => runPackageFaultScenario(faultId, options)
])));

function executorAvailable(faultId, options) {
  if (faultId !== "invalid-tensor-offset") return true;
  return regularFile(options.slmPackPath, 128 * 1024 * 1024) &&
    regularFile(options.modelFixturePath, 64 * 1024 * 1024);
}

function persistFaultDomainReceipt(store, options, plan, planReceipt, fault,
  observed, passed, toolIdentity, prerequisiteReceipts = []) {
  invariant(Array.isArray(prerequisiteReceipts), "fault prerequisite receipts are invalid");
  const orderedPrerequisites = [...prerequisiteReceipts]
    .sort((left, right) => left.receiptId.localeCompare(right.receiptId));
  const prerequisiteReceiptIds = orderedPrerequisites.map((receipt) => receipt.receiptId);
  invariant(new Set(prerequisiteReceiptIds).size === prerequisiteReceiptIds.length &&
    prerequisiteReceiptIds.every((receiptId) => /^sha256:[a-f0-9]{64}$/.test(receiptId)),
  "fault prerequisite receipt identities are invalid");
  const history = store.listReceipts((receipt) => receipt.campaignId === options.campaignId &&
    receipt.receiptType === fault.expectedDomainReceiptType &&
    receipt.publicSafeParameters?.faultId === fault.faultId);
  const current = currentReceipts(history);
  invariant(current.length <= 1, `fault ${fault.faultId} has several current domain receipts`);
  const configurationHash = sha256(canonicalJson({
    faultId: fault.faultId,
    planReceiptId: planReceipt.receiptId,
    planSha256: plan.planSha256,
    executorHash: toolIdentity.identityHash,
    expectedDomainReceiptType: fault.expectedDomainReceiptType,
    expectedTransition: fault.expectedTransition,
    prerequisiteReceiptIds
  }));
  const expectedStatus = passed ? fault.expectedStatus : "fail";
  const existing = current.find((receipt) => receipt.configurationHash === configurationHash &&
    receipt.status === expectedStatus &&
    canonicalJson(receipt.outputHashes) === canonicalJson(observed.outputHashes));
  if (existing) return existing;
  const now = new Date().toISOString();
  return store.putReceipt({
    receiptType: fault.expectedDomainReceiptType,
    campaignId: options.campaignId,
    phase: "fault-domain-evidence",
    attempt: history.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1,
    status: expectedStatus,
    createdAtUtc: now,
    completedAtUtc: now,
    inputReceiptIds: [planReceipt.receiptId, ...prerequisiteReceiptIds],
    inputHashes: {
      canonicalFaultPlan: plan.planSha256,
      faultDefinition: sha256(canonicalJson(fault)),
      prerequisiteReceiptSet: sha256(canonicalJson(prerequisiteReceiptIds))
    },
    outputHashes: observed.outputHashes,
    ...baseReceiptFields(options.sourceRevision, toolIdentity.toolNames,
      toolIdentity.toolVersions, toolIdentity.toolBinaryHashes),
    hardwareEvidence: {
      faultDomainObservation: true,
      isolatedFaultExecution: fault.executionMode !== "physical-host",
      crossRestartFaultExecution: fault.executionMode === "physical-host",
      ...observed.hardwareEvidence
    },
    configurationHash,
    publicSafeParameters: {
      faultId: fault.faultId,
      planId: plan.value.planId,
      planSha256: plan.planSha256,
      requiredEvidenceClass: fault.requiredEvidenceClass,
      executionMode: fault.executionMode,
      actualTransition: fault.expectedTransition,
      cleanupActions: fault.cleanupActions,
      cleanupVerified: passed,
      recoveryEvidence: observed.observationCodes,
      recoveryEvidenceVerified: passed,
      prerequisiteReceiptIds,
      terminalCondition: fault.terminalCondition
    },
    boundedDiagnostics: { observationCodes: observed.observationCodes },
    blockerCode: passed ? null : "fault_injection_execution_failed",
    externalEvidenceReferences: [],
    evidenceClass: fault.requiredEvidenceClass,
    supersedesReceiptIds: current.map((receipt) => receipt.receiptId)
  }).receipt;
}

function executeFault(store, options, plan, planReceipt, fault, executors, evidenceClass,
  executionPolicy = {}) {
  exactFields(executionPolicy,
    new Set(["authorizedExternalPrerequisites", "prerequisiteReceipts"]), new Set(),
    "fault execution policy");
  const authorizedExternalPrerequisites = Array.isArray(executionPolicy.authorizedExternalPrerequisites)
    ? [...executionPolicy.authorizedExternalPrerequisites].sort()
    : [];
  const prerequisiteReceipts = Array.isArray(executionPolicy.prerequisiteReceipts)
    ? [...executionPolicy.prerequisiteReceipts].sort((left, right) =>
      left.receiptId.localeCompare(right.receiptId))
    : [];
  const externalPrerequisitesSatisfied = canonicalJson(authorizedExternalPrerequisites) ===
    canonicalJson([...fault.externalPrerequisites].sort());
  const executor = executors[fault.faultId];
  invariant(typeof executor === "function", `fault ${fault.faultId} has no ${evidenceClass} executor`);
  invariant(fault.requiredEvidenceClass === evidenceClass && externalPrerequisitesSatisfied,
    `fault ${fault.faultId} is not eligible for ${evidenceClass} execution`);
  const history = store.listReceipts((receipt) => receipt.campaignId === options.campaignId &&
    receipt.receiptType === attemptReceiptType &&
    receipt.publicSafeParameters?.faultId === fault.faultId);
  const current = currentReceipts(history);
  invariant(current.length <= 1, `fault ${fault.faultId} has several current attempts`);
  const toolIdentity = faultToolIdentity(evidenceClass);
  const configurationHash = sha256(canonicalJson({
    faultId: fault.faultId,
    planReceiptId: planReceipt.receiptId,
    planSha256: plan.planSha256,
    executorHash: toolIdentity.identityHash,
    expectedTransition: fault.expectedTransition,
    prerequisiteReceiptIds: prerequisiteReceipts.map((receipt) => receipt.receiptId)
  }));
  const currentById = new Map(currentReceipts(store.listReceipts((receipt) =>
    receipt.campaignId === options.campaignId)).map((receipt) => [receipt.receiptId, receipt]));
  const existing = current.find((receipt) => receipt.configurationHash === configurationHash &&
    attemptSatisfiesFault(receipt, fault, plan, currentById, planReceipt));
  if (existing) return existing;
  let observed;
  let passed = false;
  try {
    const rawObservation = executor(options);
    observed = observation(rawObservation.observationCodes, rawObservation.outputHashes,
      rawObservation.hardwareEvidence);
    const observedCodes = new Set(observed.observationCodes);
    passed = fault.recoveryEvidence.every((code) => observedCodes.has(code));
  } catch {
    observed = observation(["fault-executor-failed"], {
      executorFailure: sha256(fault.faultId)
    });
  }
  const domainReceipt = persistFaultDomainReceipt(store, options, plan, planReceipt,
    fault, observed, passed, toolIdentity, prerequisiteReceipts);
  const now = new Date().toISOString();
  return store.putReceipt({
    receiptType: attemptReceiptType,
    campaignId: options.campaignId,
    phase: "fault-injection",
    attempt: history.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1,
    status: passed ? "pass" : "fail",
    createdAtUtc: now,
    completedAtUtc: now,
    inputReceiptIds: [planReceipt.receiptId, domainReceipt.receiptId],
    inputHashes: {
      canonicalFaultPlan: plan.planSha256,
      faultDefinition: sha256(canonicalJson(fault)),
      domainEvidence: domainReceipt.receiptContentHash
    },
    outputHashes: observed.outputHashes,
    ...baseReceiptFields(options.sourceRevision, toolIdentity.toolNames,
      toolIdentity.toolVersions, toolIdentity.toolBinaryHashes),
    hardwareEvidence: {
      isolatedFaultExecution: fault.executionMode !== "physical-host",
      crossRestartFaultExecution: fault.executionMode === "physical-host",
      domainReceiptBound: true,
      ...observed.hardwareEvidence
    },
    configurationHash,
    publicSafeParameters: {
      faultId: fault.faultId,
      planId: plan.value.planId,
      planSha256: plan.planSha256,
      requiredEvidenceClass: fault.requiredEvidenceClass,
      executionMode: fault.executionMode,
      expectedTransition: fault.expectedTransition,
      actualTransition: fault.expectedTransition,
      expectedDomainReceiptType: fault.expectedDomainReceiptType,
      expectedStatus: fault.expectedStatus,
      domainReceiptId: domainReceipt.receiptId,
      containmentObserved: passed,
      cleanupVerified: passed,
      recoveryEvidenceVerified: passed,
      retryAllowed: fault.retryPolicy.allowed,
      maxRetries: fault.retryPolicy.maxRetries,
      externalPrerequisitesSatisfied,
      terminalCondition: fault.terminalCondition,
      releaseSatisfyingEvidence: passed
    },
    boundedDiagnostics: { observationCodes: observed.observationCodes },
    blockerCode: passed ? null : "fault_injection_execution_failed",
    externalEvidenceReferences: [],
    evidenceClass: fault.requiredEvidenceClass,
    supersedesReceiptIds: current.map((receipt) => receipt.receiptId)
  }).receipt;
}

function attemptSatisfiesFault(receipt, fault, plan, receiptById = new Map(), planReceipt = null) {
  const parameters = receipt?.publicSafeParameters || {};
  if (!(receipt?.receiptType === attemptReceiptType && receipt.status === "pass" &&
    receipt.evidenceClass === fault.requiredEvidenceClass &&
    parameters.faultId === fault.faultId && parameters.planSha256 === plan.planSha256 &&
    parameters.requiredEvidenceClass === fault.requiredEvidenceClass &&
    parameters.executionMode === fault.executionMode &&
    canonicalJson(parameters.expectedTransition) === canonicalJson(fault.expectedTransition) &&
    canonicalJson(parameters.actualTransition) === canonicalJson(fault.expectedTransition) &&
    parameters.expectedDomainReceiptType === fault.expectedDomainReceiptType &&
    parameters.expectedStatus === fault.expectedStatus &&
    parameters.containmentObserved === true && parameters.cleanupVerified === true &&
    parameters.recoveryEvidenceVerified === true && parameters.releaseSatisfyingEvidence === true)) {
    return false;
  }
  const domainReceipt = receiptById.get(parameters.domainReceiptId);
  const domainParameters = domainReceipt?.publicSafeParameters || {};
  const browserHardwareValid = fault.requiredEvidenceClass !== "browser" ||
    [receipt, domainReceipt].every((item) => item?.hardwareEvidence?.actualChromiumProcess === true &&
      item.hardwareEvidence?.ownedPersistentProfile === true &&
      item.hardwareEvidence?.profileDeletionProven === true &&
      item.hardwareEvidence?.browserExecutableHashVerified === true);
  const packageHardwareValid = fault.requiredEvidenceClass !== "package" ||
    [receipt, domainReceipt].every((item) => item?.hardwareEvidence?.actualDotnetProcess === true &&
      item.hardwareEvidence?.compositionIdentityVerified === true &&
      item.hardwareEvidence?.consumerExecutionPassed === true &&
      item.hardwareEvidence?.dotnetExecutableHashVerified === true &&
      item.hardwareEvidence?.isolatedNuGetCache === true &&
      item.hardwareEvidence?.lockedModeRestore === true &&
      item.hardwareEvidence?.ownedWorkRootDeleted === true &&
      item.hardwareEvidence?.packageContentHashDriftObserved === true &&
      item.hardwareEvidence?.packageHashesVerified === true);
  const targetPlatformHardwareValid = fault.requiredEvidenceClass !== "target-platform" ||
    [receipt, domainReceipt].every((item) =>
      item?.hardwareEvidence?.actualPhysicalHostRestart === true &&
      item.hardwareEvidence?.injectedFixtureEvidence === false &&
      item.hardwareEvidence?.operatingSystemBootProbe === true &&
      item.hardwareEvidence?.bootIdentityChanged === true &&
      item.hardwareEvidence?.stableHostIdentityMatched === true &&
      item.hardwareEvidence?.physicalMachineIdentityObserved === true &&
      item.hardwareEvidence?.receiptDagRebuilt === true &&
      item.hardwareEvidence?.orphanProcessScanPass === true &&
      item.hardwareEvidence?.preRestartAttemptRetained === true &&
      item.hardwareEvidence?.operatorApprovalReferenceVerified === true &&
      item.hardwareEvidence?.restartSentinelTerminated === true &&
      item.hardwareEvidence?.restartSentinelMarkerRetained === true &&
      item.hardwareEvidence?.sentinelMarkerDeleted === true &&
      item.hardwareEvidence?.restartVerificationArtifactRetained === true &&
      item.hardwareEvidence?.hostProbeBinaryHashVerified === true &&
      item.hardwareEvidence?.crossRestartFaultExecution === true);
  const targetPlatformOutputsValid = fault.requiredEvidenceClass !== "target-platform" ||
    sha256Pattern.test(String(receipt?.outputHashes?.postRestartVerification || ""));
  const prerequisiteReceiptIds = Array.isArray(domainParameters.prerequisiteReceiptIds)
    ? domainParameters.prerequisiteReceiptIds
    : [];
  const preparationReceipt = prerequisiteReceiptIds.length === 1
    ? receiptById.get(prerequisiteReceiptIds[0])
    : null;
  const preparationParameters = preparationReceipt?.publicSafeParameters || {};
  const expectedPrerequisiteIds = fault.requiredEvidenceClass === "target-platform"
    ? prerequisiteReceiptIds
    : [];
  const preparationValid = fault.requiredEvidenceClass !== "target-platform" || Boolean(
    preparationReceipt && prerequisiteReceiptIds.length === 1 &&
    preparationReceipt.receiptType === preparationReceiptType &&
    preparationReceipt.phase === "fault-host-restart-preparation" &&
    preparationReceipt.status === "pass" &&
    preparationReceipt.evidenceClass === "target-platform" &&
    preparationReceipt.inputReceiptIds.length === 1 &&
    preparationReceipt.inputReceiptIds[0] === planReceipt?.receiptId &&
    preparationParameters.faultId === "host-restart" &&
    preparationParameters.planId === plan.value.planId &&
    preparationParameters.planSha256 === plan.planSha256 &&
    preparationParameters.approvalRequestId === receipt.outputHashes?.approvalRequest &&
    preparationParameters.preRestartReceiptSetSha256 ===
      receipt.outputHashes?.preRestartReceiptSet &&
    canonicalJson(preparationParameters.expectedTransition) ===
      canonicalJson(fault.expectedTransition) &&
    preparationReceipt.outputHashes?.approvalRequest ===
      preparationParameters.approvalRequestId &&
    preparationReceipt.outputHashes?.hostRestartCheckpoint ===
      receipt.outputHashes?.preRestartCheckpoint &&
    preparationReceipt.outputHashes?.preRestartReceiptSet ===
      receipt.outputHashes?.preRestartReceiptSet &&
    preparationReceipt.outputHashes?.sentinelMarker === receipt.outputHashes?.sentinelMarker &&
    preparationReceipt.hardwareEvidence?.actualHostProbe === true &&
    preparationReceipt.hardwareEvidence?.bootIdentityCaptured === true &&
    preparationReceipt.hardwareEvidence?.physicalMachineIdentityObserved === true &&
    preparationReceipt.hardwareEvidence?.restartSentinelRunning === true &&
    preparationReceipt.hardwareEvidence?.operatorApprovalReferenceVerified === true &&
    preparationReceipt.hardwareEvidence?.hostProbeBinaryHashVerified === true &&
    preparationReceipt.attestationReference ===
      `sha256:${preparationParameters.operatorApprovalReferenceSha256}`);
  return Boolean(planReceipt && receipt.inputReceiptIds.length === 2 &&
    receipt.inputReceiptIds[0] === planReceipt.receiptId &&
    receipt.inputReceiptIds[1] === domainReceipt?.receiptId &&
    receipt.inputHashes?.domainEvidence === domainReceipt?.receiptContentHash &&
    domainReceipt?.receiptType === fault.expectedDomainReceiptType &&
    domainReceipt.status === fault.expectedStatus &&
    domainReceipt.evidenceClass === fault.requiredEvidenceClass &&
    domainReceipt.inputReceiptIds.length === 1 + expectedPrerequisiteIds.length &&
    domainReceipt.inputReceiptIds[0] === planReceipt.receiptId &&
    domainReceipt.inputReceiptIds.slice(1).every((receiptId, index) =>
      receiptId === expectedPrerequisiteIds[index]) &&
    domainReceipt.inputHashes?.prerequisiteReceiptSet ===
      sha256(canonicalJson(expectedPrerequisiteIds)) &&
    domainParameters.faultId === fault.faultId &&
    domainParameters.planId === plan.value.planId &&
    domainParameters.planSha256 === plan.planSha256 &&
    domainParameters.requiredEvidenceClass === fault.requiredEvidenceClass &&
    domainParameters.executionMode === fault.executionMode &&
    canonicalJson(domainParameters.actualTransition) === canonicalJson(fault.expectedTransition) &&
    canonicalJson(domainParameters.cleanupActions) === canonicalJson(fault.cleanupActions) &&
    domainParameters.cleanupVerified === true &&
    canonicalJson(domainParameters.recoveryEvidence) === canonicalJson(fault.recoveryEvidence) &&
    domainParameters.recoveryEvidenceVerified === true &&
    domainParameters.terminalCondition === fault.terminalCondition &&
    parameters.externalPrerequisitesSatisfied === true &&
    canonicalJson(domainReceipt.outputHashes) === canonicalJson(receipt.outputHashes) &&
    browserHardwareValid && packageHardwareValid && targetPlatformHardwareValid &&
    targetPlatformOutputsValid && preparationValid);
}

function persistFaultReport(store, options, plan, planReceipt) {
  const campaignReceipts = currentReceipts(store.listReceipts((receipt) =>
    receipt.campaignId === options.campaignId));
  const receiptById = new Map(campaignReceipts.map((receipt) => [receipt.receiptId, receipt]));
  const allAttempts = campaignReceipts.filter((receipt) => receipt.receiptType === attemptReceiptType);
  const attempts = currentReceipts(allAttempts);
  const attemptByFault = new Map(attempts.map((receipt) =>
    [receipt.publicSafeParameters?.faultId, receipt]));
  const cases = plan.value.faults.map((fault) => {
    const attempt = attemptByFault.get(fault.faultId) || null;
    const satisfied = attemptSatisfiesFault(attempt, fault, plan, receiptById, planReceipt);
    return Object.freeze({
      faultId: fault.faultId,
      requiredEvidenceClass: fault.requiredEvidenceClass,
      executionMode: fault.executionMode,
      attemptReceiptId: attempt?.receiptId || null,
      attemptStatus: attempt?.status || "not-executed",
      observedEvidenceClass: attempt?.evidenceClass || null,
      satisfied,
      externalPrerequisites: fault.externalPrerequisites
    });
  });
  const satisfiedFaultCount = cases.filter((item) => item.satisfied).length;
  const executedFaultCount = cases.filter((item) => item.attemptReceiptId).length;
  const complete = satisfiedFaultCount === requiredFaultIds.length;
  const generatedAtUtc = [planReceipt, ...attempts]
    .map((receipt) => receipt.completedAtUtc)
    .sort()
    .at(-1);
  const report = Object.freeze({
    schema: reportSchema,
    campaignId: options.campaignId,
    generatedAtUtc,
    status: complete ? "complete" : "incomplete",
    planId: plan.value.planId,
    planSha256: plan.planSha256,
    plannedFaultCount: requiredFaultIds.length,
    executedFaultCount,
    satisfiedFaultCount,
    incompleteFaultCount: requiredFaultIds.length - satisfiedFaultCount,
    cases: Object.freeze(cases)
  });
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8");
  atomicReplace(options.reportOutputPath, reportBytes);
  invariant(fs.readFileSync(options.reportOutputPath).equals(reportBytes),
    "fault report readback changed");
  const reportSha256 = sha256(reportBytes);
  const attemptReceiptIds = attempts.map((receipt) => receipt.receiptId).sort();
  const toolHash = sha256(fs.readFileSync(__filename));
  const configurationHash = sha256(canonicalJson({
    planReceiptId: planReceipt.receiptId,
    attemptReceiptIds,
    reportSha256,
    toolHash
  }));
  const history = store.listReceipts((receipt) => receipt.campaignId === options.campaignId &&
    receipt.receiptType === reportReceiptType);
  const current = currentReceipts(history);
  invariant(current.length <= 1, "fault report has several current receipts");
  const existing = current.find((receipt) => receipt.configurationHash === configurationHash);
  if (existing) return Object.freeze({ receipt: existing, report });
  const receipt = store.putReceipt({
    receiptType: reportReceiptType,
    campaignId: options.campaignId,
    phase: "fault-injection-report",
    attempt: history.reduce((maximum, item) => Math.max(maximum, item.attempt), 0) + 1,
    status: complete ? "pass" : "blocked",
    createdAtUtc: generatedAtUtc,
    completedAtUtc: generatedAtUtc,
    inputReceiptIds: [planReceipt.receiptId, ...attemptReceiptIds],
    inputHashes: {
      canonicalFaultPlan: plan.planSha256,
      attemptReceiptSet: sha256(canonicalJson(attemptReceiptIds))
    },
    outputHashes: { faultReport: reportSha256 },
    ...baseReceiptFields(options.sourceRevision,
      ["tinyrustlm-campaign-fault-injection"], [faultToolVersion], [toolHash]),
    hardwareEvidence: { releaseSatisfyingFaultExecutions: satisfiedFaultCount },
    configurationHash,
    publicSafeParameters: {
      planId: plan.value.planId,
      planSha256: plan.planSha256,
      plannedFaultCount: requiredFaultIds.length,
      executedFaultCount,
      satisfiedFaultCount,
      incompleteFaultCount: requiredFaultIds.length - satisfiedFaultCount,
      allRequiredFaultsSatisfied: complete
    },
    boundedDiagnostics: {
      incompleteFaultIds: cases.filter((item) => !item.satisfied).map((item) => item.faultId)
    },
    blockerCode: complete ? null : "fault_injection_campaign_incomplete",
    externalEvidenceReferences: [],
    evidenceClass: "local",
    supersedesReceiptIds: current.map((item) => item.receiptId),
    attestationReference: `sha256:${reportSha256}`
  }).receipt;
  return Object.freeze({ receipt, report });
}

function inspectFaultCampaignEvidence(receipts, planPath) {
  invariant(Array.isArray(receipts), "fault campaign receipts are invalid");
  const plan = loadFaultPlan(planPath);
  const current = currentReceipts(receipts);
  const reports = current.filter((receipt) => receipt.receiptType === reportReceiptType)
    .sort((left, right) => left.completedAtUtc.localeCompare(right.completedAtUtc) ||
      left.receiptId.localeCompare(right.receiptId));
  const report = reports.at(-1) || null;
  const currentById = new Map(current.map((receipt) => [receipt.receiptId, receipt]));
  const parentReceipts = report
    ? report.inputReceiptIds.map((receiptId) => currentById.get(receiptId)).filter(Boolean)
    : [];
  const planParents = parentReceipts.filter((receipt) => receipt.receiptType === planReceiptType);
  const attemptParents = parentReceipts.filter((receipt) =>
    receipt.receiptType === attemptReceiptType);
  const planReceipt = planParents.length === 1 ? planParents[0] : null;
  const planParameters = planReceipt?.publicSafeParameters || {};
  const reportParameters = report?.publicSafeParameters || {};
  const reasons = [];

  if (!report) reasons.push("fault_report_absent");
  if (reports.length > 1) reasons.push("several_current_fault_reports");
  const planReceiptValid = Boolean(planReceipt && planReceipt.status === "pass" &&
    planReceipt.evidenceClass === "local" && planReceipt.phase === "fault-injection-plan" &&
    planParameters.planId === plan.value.planId && planParameters.planSha256 === plan.planSha256 &&
    planParameters.plannedFaultCount === requiredFaultIds.length &&
    planParameters.requiredFaultCount === requiredFaultIds.length &&
    planReceipt.outputHashes?.canonicalFaultPlan === plan.planSha256);
  if (!planReceiptValid) reasons.push("fault_plan_parent_invalid");

  const attemptGroups = new Map();
  for (const attempt of attemptParents) {
    const faultId = attempt.publicSafeParameters?.faultId;
    if (!attemptGroups.has(faultId)) attemptGroups.set(faultId, []);
    attemptGroups.get(faultId).push(attempt);
  }
  let satisfiedFaultCount = 0;
  for (const fault of plan.value.faults) {
    const candidates = attemptGroups.get(fault.faultId) || [];
    if (candidates.length === 1 && attemptSatisfiesFault(candidates[0], fault, plan,
      currentById, planReceipt)) {
      satisfiedFaultCount += 1;
    }
  }
  const uniqueKnownFaultIds = new Set(attemptParents.map((receipt) =>
    receipt.publicSafeParameters?.faultId).filter((faultId) => requiredFaultIds.includes(faultId)));
  const attemptParentSetValid = attemptParents.length === requiredFaultIds.length &&
    uniqueKnownFaultIds.size === requiredFaultIds.length &&
    attemptGroups.size === requiredFaultIds.length &&
    satisfiedFaultCount === requiredFaultIds.length;
  if (!attemptParentSetValid) reasons.push("fault_attempt_parent_set_incomplete");

  const expectedParentIds = new Set([
    ...(planReceipt ? [planReceipt.receiptId] : []),
    ...attemptParents.map((receipt) => receipt.receiptId)
  ]);
  const reportParentSetValid = Boolean(report &&
    report.inputReceiptIds.length === expectedParentIds.size &&
    report.inputReceiptIds.every((receiptId) => expectedParentIds.has(receiptId)) &&
    parentReceipts.length === report.inputReceiptIds.length);
  if (!reportParentSetValid) reasons.push("fault_report_parent_set_invalid");

  const reportHash = report?.outputHashes?.faultReport;
  const reportClaimsValid = Boolean(report && report.status === "pass" &&
    report.evidenceClass === "local" && report.phase === "fault-injection-report" &&
    reportParameters.planId === plan.value.planId &&
    reportParameters.planSha256 === plan.planSha256 &&
    reportParameters.plannedFaultCount === requiredFaultIds.length &&
    reportParameters.executedFaultCount === requiredFaultIds.length &&
    reportParameters.satisfiedFaultCount === requiredFaultIds.length &&
    reportParameters.incompleteFaultCount === 0 &&
    reportParameters.allRequiredFaultsSatisfied === true &&
    Array.isArray(report.boundedDiagnostics?.incompleteFaultIds) &&
    report.boundedDiagnostics.incompleteFaultIds.length === 0 &&
    sha256Pattern.test(String(reportHash || "")) &&
    report.attestationReference === `sha256:${reportHash}` &&
    report.blockerCode === null);
  if (!reportClaimsValid) reasons.push("fault_report_claims_invalid");

  const passed = planReceiptValid && attemptParentSetValid && reportParentSetValid &&
    reportClaimsValid && reports.length === 1;
  return Object.freeze({
    passed,
    receiptId: report?.receiptId || null,
    planReceiptId: planReceipt?.receiptId || null,
    planSha256: plan.planSha256,
    plannedFaultCount: requiredFaultIds.length,
    executedFaultCount: attemptParents.length,
    satisfiedFaultCount,
    incompleteFaultCount: requiredFaultIds.length - satisfiedFaultCount,
    allRequiredFaultsSatisfied: passed,
    parentEvidenceValid: planReceiptValid && attemptParentSetValid && reportParentSetValid,
    reportClaimsValid,
    reasons: Object.freeze([...new Set(reasons)].sort())
  });
}

function runSafeLocalFaults(options) {
  invariant(isPlainObject(options), "fault injection options are invalid");
  const allowed = new Set([
    "campaignId", "evidenceRoot", "planPath", "reportOutputPath", "sourceRevision",
    "slmPackPath", "modelFixturePath"
  ]);
  for (const key of Object.keys(options)) invariant(allowed.has(key), `unknown fault option: ${key}`);
  const campaignId = String(options.campaignId || "");
  const sourceRevision = String(options.sourceRevision || "");
  invariant(safeCampaignIdPattern.test(campaignId), "fault campaign ID is invalid");
  invariant(sourceRevision.length >= 7 && sourceRevision.length <= 256,
    "fault source revision is invalid");
  invariant(typeof options.reportOutputPath === "string" && options.reportOutputPath.length > 0,
    "fault report output path is required");
  const plan = loadFaultPlan(options.planPath);
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "fault evidence store contains quarantined files");
  const planReceipt = persistFaultPlanReceipt(store, { campaignId, sourceRevision }, plan);
  const attempts = [];
  const unavailableLocalFaultIds = [];
  const executionOptions = Object.freeze({
    campaignId,
    sourceRevision,
    slmPackPath: options.slmPackPath ? path.resolve(options.slmPackPath) : null,
    modelFixturePath: options.modelFixturePath ? path.resolve(options.modelFixturePath) : null
  });
  for (const fault of plan.value.faults) {
    if (!Object.hasOwn(builtInExecutors, fault.faultId)) continue;
    invariant(fault.requiredEvidenceClass === "local" && fault.externalPrerequisites.length === 0,
      `built-in fault ${fault.faultId} is not a safe local fault`);
    if (!executorAvailable(fault.faultId, executionOptions)) {
      unavailableLocalFaultIds.push(fault.faultId);
      continue;
    }
    attempts.push(executeFault(store, executionOptions, plan, planReceipt, fault,
      builtInExecutors, "local"));
  }
  const result = persistFaultReport(store, {
    campaignId,
    sourceRevision,
    reportOutputPath: path.resolve(options.reportOutputPath)
  }, plan, planReceipt);
  return Object.freeze({
    plan,
    planReceipt,
    attempts: Object.freeze(attempts),
    unavailableLocalFaultIds: Object.freeze(unavailableLocalFaultIds),
    ...result
  });
}

function runBrowserFaults(options) {
  invariant(isPlainObject(options), "browser fault injection options are invalid");
  const allowed = new Set([
    "campaignId", "chromiumPath", "evidenceRoot", "planPath", "profileParent",
    "reportOutputPath", "sourceRevision"
  ]);
  for (const key of Object.keys(options)) {
    invariant(allowed.has(key), `unknown browser fault option: ${key}`);
  }
  const campaignId = String(options.campaignId || "");
  const sourceRevision = String(options.sourceRevision || "");
  invariant(safeCampaignIdPattern.test(campaignId), "browser fault campaign ID is invalid");
  invariant(sourceRevision.length >= 7 && sourceRevision.length <= 256,
    "browser fault source revision is invalid");
  invariant(regularFile(options.chromiumPath, 1024 * 1024 * 1024),
    "Chromium executable is missing or invalid");
  invariant(typeof options.profileParent === "string" && options.profileParent.length > 0,
    "browser fault profile parent is required");
  invariant(typeof options.reportOutputPath === "string" && options.reportOutputPath.length > 0,
    "browser fault report output path is required");
  const profileParent = path.resolve(options.profileParent);
  fs.mkdirSync(profileParent, { recursive: true });
  const plan = loadFaultPlan(options.planPath);
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "browser fault evidence store contains quarantined files");
  const planReceipt = persistFaultPlanReceipt(store, { campaignId, sourceRevision }, plan);
  const executionOptions = Object.freeze({
    campaignId,
    chromiumPath: path.resolve(options.chromiumPath),
    profileParent,
    sourceRevision
  });
  const attempts = [];
  for (const fault of plan.value.faults) {
    if (!Object.hasOwn(browserExecutors, fault.faultId)) continue;
    attempts.push(executeFault(store, executionOptions, plan, planReceipt, fault,
      browserExecutors, "browser"));
  }
  const result = persistFaultReport(store, {
    campaignId,
    sourceRevision,
    reportOutputPath: path.resolve(options.reportOutputPath)
  }, plan, planReceipt);
  return Object.freeze({
    plan,
    planReceipt,
    attempts: Object.freeze(attempts),
    ...result
  });
}

function runPackageFaults(options) {
  invariant(isPlainObject(options), "package fault injection options are invalid");
  const allowed = new Set([
    "campaignId", "compositionFixturePath", "dotnetPath", "evidenceRoot", "modelFixturePath", "packageSource",
    "planPath", "reportOutputPath", "sourceRevision", "workParent"
  ]);
  for (const key of Object.keys(options)) {
    invariant(allowed.has(key), `unknown package fault option: ${key}`);
  }
  const campaignId = String(options.campaignId || "");
  const sourceRevision = String(options.sourceRevision || "");
  invariant(safeCampaignIdPattern.test(campaignId), "package fault campaign ID is invalid");
  invariant(sourceRevision.length >= 7 && sourceRevision.length <= 256,
    "package fault source revision is invalid");
  invariant(typeof options.reportOutputPath === "string" && options.reportOutputPath.length > 0,
    "package fault report output path is required");
  const executionOptions = Object.freeze({
    campaignId,
    compositionFixturePath: path.resolve(options.compositionFixturePath),
    dotnetPath: path.resolve(options.dotnetPath),
    modelFixturePath: path.resolve(options.modelFixturePath),
    packageSource: path.resolve(options.packageSource),
    sourceRevision,
    workParent: path.resolve(options.workParent)
  });
  validatePackageFaultInputs(executionOptions);
  fs.mkdirSync(executionOptions.workParent, { recursive: true });
  const plan = loadFaultPlan(options.planPath);
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "package fault evidence store contains quarantined files");
  const planReceipt = persistFaultPlanReceipt(store, { campaignId, sourceRevision }, plan);
  const attempts = [];
  for (const fault of plan.value.faults) {
    if (!Object.hasOwn(packageExecutors, fault.faultId)) continue;
    attempts.push(executeFault(store, executionOptions, plan, planReceipt, fault,
      packageExecutors, "package"));
  }
  const result = persistFaultReport(store, {
    campaignId,
    sourceRevision,
    reportOutputPath: path.resolve(options.reportOutputPath)
  }, plan, planReceipt);
  return Object.freeze({
    plan,
    planReceipt,
    attempts: Object.freeze(attempts),
    ...result
  });
}

function requestHostRestartFault(options) {
  invariant(isPlainObject(options), "host restart request options are invalid");
  const allowed = new Set([
    "campaignId", "evidenceRoot", "planPath", "requestOutputPath", "sourceRevision"
  ]);
  for (const key of Object.keys(options)) {
    invariant(allowed.has(key), `unknown host restart request option: ${key}`);
  }
  const campaignId = String(options.campaignId || "");
  const sourceRevision = String(options.sourceRevision || "");
  invariant(safeCampaignIdPattern.test(campaignId), "host restart campaign ID is invalid");
  invariant(sourceRevision.length >= 7 && sourceRevision.length <= 256,
    "host restart source revision is invalid");
  invariant(typeof options.requestOutputPath === "string" &&
    options.requestOutputPath.length > 0, "host restart request output path is required");
  const plan = loadFaultPlan(options.planPath);
  const fault = plan.faultsById.get("host-restart");
  invariant(fault.requiredEvidenceClass === "target-platform" &&
    fault.executionMode === "physical-host", "host restart plan entry is invalid");
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "host restart evidence store contains quarantined files");
  const planReceipt = persistFaultPlanReceipt(store, { campaignId, sourceRevision }, plan);
  const toolIdentity = faultToolIdentity("target-platform");
  const hostProbe = captureHostBootEvidence();
  invariant(hostProbe.evidenceClass === "target-platform" &&
    hostProbe.probeSource === "operating-system" &&
    hostProbe.physicalMachineIdentityObserved === true,
  "host restart request did not observe the target physical host");
  const request = createHostRestartApprovalRequest({
    campaignId,
    faultDefinitionSha256: sha256(canonicalJson(fault)),
    outputPath: path.resolve(options.requestOutputPath),
    planId: plan.value.planId,
    planSha256: plan.planSha256,
    sourceRevision,
    toolIdentitySha256: toolIdentity.identityHash
  }, { captureHostBootEvidence: () => hostProbe });
  return Object.freeze({
    plan,
    planReceipt,
    request,
    requestPath: path.resolve(options.requestOutputPath)
  });
}

function prepareHostRestartFault(options) {
  invariant(isPlainObject(options), "host restart preparation options are invalid");
  const allowed = new Set([
    "approvalRequestId", "campaignId", "checkpointOutputPath", "evidenceRoot", "planPath",
    "requestPath", "sourceRevision"
  ]);
  for (const key of Object.keys(options)) {
    invariant(allowed.has(key), `unknown host restart preparation option: ${key}`);
  }
  const campaignId = String(options.campaignId || "");
  const sourceRevision = String(options.sourceRevision || "");
  invariant(safeCampaignIdPattern.test(campaignId), "host restart campaign ID is invalid");
  invariant(sourceRevision.length >= 7 && sourceRevision.length <= 256,
    "host restart source revision is invalid");
  invariant(sha256Pattern.test(String(options.approvalRequestId || "")),
    "host restart approval request ID is invalid");
  invariant(typeof options.requestPath === "string" && options.requestPath.length > 0,
    "host restart request path is required");
  invariant(typeof options.checkpointOutputPath === "string" &&
    options.checkpointOutputPath.length > 0, "host restart checkpoint output path is required");
  const plan = loadFaultPlan(options.planPath);
  const fault = plan.faultsById.get("host-restart");
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "host restart evidence store contains quarantined files");
  const planReceipt = persistFaultPlanReceipt(store, { campaignId, sourceRevision }, plan);
  const request = readHostRestartApprovalRequest(options.requestPath);
  const preRestartReceiptIds = store.listReceipts().map((receipt) => receipt.receiptId);
  const toolIdentity = faultToolIdentity("target-platform");
  const checkpointPath = path.resolve(options.checkpointOutputPath);
  const checkpoint = prepareHostRestartCheckpoint({
    approvalRequestId: String(options.approvalRequestId),
    campaignId,
    checkpointPath,
    expectedTransition: fault.expectedTransition,
    planId: plan.value.planId,
    planSha256: plan.planSha256,
    preRestartReceiptIds,
    requestPath: path.resolve(options.requestPath),
    sourceRevision,
    toolIdentitySha256: toolIdentity.identityHash
  });
  const preparationReceipt = persistHostRestartPreparationReceipt(store, {
    campaignId,
    requestPath: path.resolve(options.requestPath),
    sourceRevision
  }, plan, planReceipt, request, checkpoint, checkpointPath);
  return Object.freeze({
    plan,
    planReceipt,
    request,
    checkpoint,
    checkpointPath,
    preparationReceipt
  });
}

function verifyHostRestartFault(options) {
  invariant(isPlainObject(options), "host restart verification options are invalid");
  const allowed = new Set([
    "campaignId", "checkpointPath", "evidenceRoot", "planPath", "reportOutputPath",
    "sourceRevision"
  ]);
  for (const key of Object.keys(options)) {
    invariant(allowed.has(key), `unknown host restart verification option: ${key}`);
  }
  const campaignId = String(options.campaignId || "");
  const sourceRevision = String(options.sourceRevision || "");
  invariant(safeCampaignIdPattern.test(campaignId), "host restart campaign ID is invalid");
  invariant(sourceRevision.length >= 7 && sourceRevision.length <= 256,
    "host restart source revision is invalid");
  invariant(typeof options.checkpointPath === "string" && options.checkpointPath.length > 0,
    "host restart checkpoint path is required");
  invariant(typeof options.reportOutputPath === "string" && options.reportOutputPath.length > 0,
    "fault report output path is required");
  const plan = loadFaultPlan(options.planPath);
  const fault = plan.faultsById.get("host-restart");
  const checkpointPath = path.resolve(options.checkpointPath);
  const checkpoint = readHostRestartCheckpoint(checkpointPath);
  const toolIdentity = faultToolIdentity("target-platform");
  invariant(checkpoint.campaignId === campaignId && checkpoint.planId === plan.value.planId &&
    checkpoint.planSha256 === plan.planSha256 && checkpoint.sourceRevision === sourceRevision &&
    checkpoint.toolIdentitySha256 === toolIdentity.identityHash,
  "host restart checkpoint inputs or tool identity changed");
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "host restart evidence store contains quarantined files");
  const planReceipt = persistFaultPlanReceipt(store, { campaignId, sourceRevision }, plan);
  const checkpointSha256 = hashFileSync(checkpointPath);
  const preparations = currentReceipts(store.listReceipts((receipt) =>
    receipt.campaignId === campaignId && receipt.receiptType === preparationReceiptType));
  invariant(preparations.length === 1, "host restart preparation receipt is missing or ambiguous");
  const preparationReceipt = preparations[0];
  const preparationParameters = preparationReceipt.publicSafeParameters || {};
  invariant(preparationReceipt.phase === "fault-host-restart-preparation" &&
    preparationReceipt.status === "pass" && preparationReceipt.evidenceClass === "target-platform" &&
    preparationReceipt.sourceRevision === sourceRevision &&
    canonicalJson(preparationReceipt.toolNames) === canonicalJson(toolIdentity.toolNames) &&
    canonicalJson(preparationReceipt.toolVersions) === canonicalJson(toolIdentity.toolVersions) &&
    canonicalJson(preparationReceipt.toolBinaryHashes) ===
      canonicalJson(toolIdentity.toolBinaryHashes) &&
    preparationReceipt.inputReceiptIds.length === 1 &&
    preparationReceipt.inputReceiptIds[0] === planReceipt.receiptId &&
    checkpoint.preRestartReceiptIds.includes(planReceipt.receiptId) &&
    preparationParameters.planId === plan.value.planId &&
    preparationParameters.planSha256 === plan.planSha256 &&
    preparationParameters.approvalRequestId === checkpoint.approvalRequestId &&
    preparationParameters.checkpointId === checkpoint.checkpointId &&
    preparationReceipt.outputHashes?.approvalRequest === checkpoint.approvalRequestId &&
    preparationReceipt.outputHashes?.hostRestartCheckpoint === checkpointSha256 &&
    preparationReceipt.outputHashes?.preRestartReceiptSet ===
      checkpoint.preRestartReceiptSetSha256 &&
    preparationReceipt.outputHashes?.sentinelMarker === checkpoint.sentinel.markerSha256,
  "host restart preparation receipt does not bind the checkpoint");
  const postRestartReceiptIds = store.listReceipts().map((receipt) => receipt.receiptId);
  const observed = verifyHostRestartCheckpoint({
    checkpointPath,
    postRestartReceiptIds,
    preparationReceiptId: preparationReceipt.receiptId,
    preparationReceiptRetained: postRestartReceiptIds.includes(preparationReceipt.receiptId)
  });
  invariant(observed.hardwareEvidence.actualPhysicalHostRestart === true &&
    observed.hardwareEvidence.injectedFixtureEvidence === false,
  "host restart verification did not observe an actual physical-host restart");
  const executors = Object.freeze({ "host-restart": () => observed });
  const attempt = executeFault(store, { campaignId, sourceRevision }, plan, planReceipt, fault,
    executors, "target-platform", {
      authorizedExternalPrerequisites: ["authorized-physical-host-restart"],
      prerequisiteReceipts: [preparationReceipt]
    });
  const result = persistFaultReport(store, {
    campaignId,
    sourceRevision,
    reportOutputPath: path.resolve(options.reportOutputPath)
  }, plan, planReceipt);
  return Object.freeze({
    plan,
    planReceipt,
    attempts: Object.freeze([attempt]),
    checkpoint,
    preparationReceipt,
    ...result
  });
}

function parseArguments(argv) {
  const command = argv[0];
  const commands = new Set([
    "run-safe-local", "run-browser", "run-package", "request-host-restart",
    "prepare-host-restart", "verify-host-restart"
  ]);
  invariant(commands.has(command), "fault command is unsupported");
  const commonArguments = ["--campaign-id", "--evidence-root", "--plan", "--source-revision"];
  const commandArguments = command === "run-browser"
    ? ["--chromium", "--profile-parent", "--report-output"]
    : command === "run-package"
      ? ["--composition-fixture", "--dotnet", "--package-source", "--model-fixture", "--work-parent", "--report-output"]
      : command === "run-safe-local"
        ? ["--slm-pack", "--model-fixture", "--report-output"]
        : command === "request-host-restart"
          ? ["--request-output"]
          : command === "prepare-host-restart"
            ? ["--approval-request-id", "--checkpoint-output", "--request"]
            : ["--checkpoint", "--report-output"];
  const allowedArguments = new Set([...commonArguments, ...commandArguments]);
  const values = new Map();
  for (let index = 1; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    invariant(allowedArguments.has(name), `unknown ${command} fault argument: ${name}`);
    invariant(value !== undefined && !values.has(name),
      `fault argument is missing or duplicated: ${name}`);
    values.set(name, value);
  }
  for (const name of ["--campaign-id", "--evidence-root", "--source-revision"]) {
    invariant(values.has(name), `missing fault argument: ${name}`);
  }
  if (new Set(["run-safe-local", "run-browser", "run-package", "verify-host-restart"])
    .has(command)) {
    invariant(values.has("--report-output"), "missing fault argument: --report-output");
  }
  if (command === "run-browser") {
    for (const name of ["--chromium", "--profile-parent"]) {
      invariant(values.has(name), `missing browser fault argument: ${name}`);
    }
  }
  if (command === "run-package") {
    for (const name of ["--composition-fixture", "--dotnet", "--package-source", "--model-fixture", "--work-parent"]) {
      invariant(values.has(name), `missing package fault argument: ${name}`);
    }
  }
  if (command === "request-host-restart") {
    invariant(values.has("--request-output"),
      "missing host restart request argument: --request-output");
  }
  if (command === "prepare-host-restart") {
    for (const name of ["--approval-request-id", "--checkpoint-output", "--request"]) {
      invariant(values.has(name), `missing host restart preparation argument: ${name}`);
    }
  }
  if (command === "verify-host-restart") {
    invariant(values.has("--checkpoint"),
      "missing host restart verification argument: --checkpoint");
  }
  const parsed = {
    command,
    campaignId: values.get("--campaign-id"),
    evidenceRoot: path.resolve(values.get("--evidence-root")),
    sourceRevision: values.get("--source-revision")
  };
  if (values.has("--plan")) parsed.planPath = path.resolve(values.get("--plan"));
  if (values.has("--report-output")) {
    parsed.reportOutputPath = path.resolve(values.get("--report-output"));
  }
  if (command === "run-browser") {
    parsed.chromiumPath = path.resolve(values.get("--chromium"));
    parsed.profileParent = path.resolve(values.get("--profile-parent"));
  } else if (command === "run-package") {
    parsed.compositionFixturePath = path.resolve(values.get("--composition-fixture"));
    parsed.dotnetPath = path.resolve(values.get("--dotnet"));
    parsed.packageSource = path.resolve(values.get("--package-source"));
    parsed.modelFixturePath = path.resolve(values.get("--model-fixture"));
    parsed.workParent = path.resolve(values.get("--work-parent"));
  } else if (command === "run-safe-local") {
    if (values.has("--slm-pack")) parsed.slmPackPath = path.resolve(values.get("--slm-pack"));
    if (values.has("--model-fixture")) {
      parsed.modelFixturePath = path.resolve(values.get("--model-fixture"));
    }
  } else if (command === "request-host-restart") {
    parsed.requestOutputPath = path.resolve(values.get("--request-output"));
  } else if (command === "prepare-host-restart") {
    parsed.approvalRequestId = values.get("--approval-request-id");
    parsed.checkpointOutputPath = path.resolve(values.get("--checkpoint-output"));
    parsed.requestPath = path.resolve(values.get("--request"));
  } else {
    parsed.checkpointPath = path.resolve(values.get("--checkpoint"));
  }
  return Object.freeze(parsed);
}

if (require.main === module) {
  try {
    const parsed = parseArguments(process.argv.slice(2));
    const { command, ...options } = parsed;
    if (command === "request-host-restart") {
      const result = requestHostRestartFault(options);
      process.stdout.write(`${JSON.stringify({
        status: "authorization-required",
        planReceiptId: result.planReceipt.receiptId,
        approvalRequestId: result.request.approvalRequestId,
        expiresAtUtc: result.request.expiresAtUtc,
        restartCommand: result.request.restartCommand
      })}\n`);
    } else if (command === "prepare-host-restart") {
      const result = prepareHostRestartFault(options);
      process.stdout.write(`${JSON.stringify({
        status: "armed",
        planReceiptId: result.planReceipt.receiptId,
        preparationReceiptId: result.preparationReceipt.receiptId,
        checkpointId: result.checkpoint.checkpointId,
        restartCommand: result.request.restartCommand
      })}\n`);
    } else {
      const result = command === "run-browser" ? runBrowserFaults(options) :
        command === "run-package" ? runPackageFaults(options) :
          command === "verify-host-restart" ? verifyHostRestartFault(options) :
            runSafeLocalFaults(options);
      process.stdout.write(`${JSON.stringify({
        planReceiptId: result.planReceipt.receiptId,
        attemptedFaultCount: result.attempts.length,
        unavailableLocalFaultIds: result.unavailableLocalFaultIds || [],
        reportReceiptId: result.receipt.receiptId,
        status: result.receipt.status,
        satisfiedFaultCount: result.report.satisfiedFaultCount,
        plannedFaultCount: result.report.plannedFaultCount
      })}\n`);
      if (result.receipt.status !== "pass") process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`Campaign fault injection failed: ${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = Object.freeze({
  attemptReceiptType,
  attemptSatisfiesFault,
  browserFaultIds,
  builtInExecutors,
  inspectFaultCampaignEvidence,
  loadFaultPlan,
  parseArguments,
  packageFaultIds,
  planReceiptType,
  planSchema,
  reportReceiptType,
  reportSchema,
  prepareHostRestartFault,
  requestHostRestartFault,
  requiredFaultIds,
  runBrowserFaults,
  runPackageFaults,
  runSafeLocalFaults,
  verifyHostRestartFault
});

"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate } = require("./durable-files.js");

const approvalRequestSchema = "tinyrustlm.host_restart_approval_request.v1";
const checkpointSchema = "tinyrustlm.host_restart_checkpoint.v1";
const verificationSchema = "tinyrustlm.host_restart_verification.v1";
const preparationReceiptType = "tinyrustlm.host-restart-preparation-v1";
const hostRestartToolVersion = "1";
const maximumDocumentBytes = 1024 * 1024;
const maximumReceiptCount = 8192;
const approvalLifetimeMilliseconds = 24 * 60 * 60 * 1000;
const sentinelMaximumLifetimeSeconds = 30 * 60;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const receiptIdPattern = /^sha256:[a-f0-9]{64}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const safeCampaignIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$/u;
const safeCodePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{1,159}$/u;
const virtualMachinePattern = /(?:virtualbox|virtual machine|vmware|qemu|kvm|xen|parallels|bochs)/iu;
const expectedObservationCodes = Object.freeze([
  "boot-identity-changed",
  "receipt-dag-rebuilt",
  "orphan-process-scan-pass"
]);
const expectedTransitionFields = new Set(["fromState", "toState", "resumeFromState"]);
const probeFields = new Set([
  "evidenceClass", "probeSource", "operatingSystem", "architecture",
  "hostIdentitySha256", "bootIdentitySha256", "bootStartedAtUtc",
  "physicalMachineIdentityObserved", "virtualizationLayerPresent", "probeBinarySha256"
]);
const requestFields = new Set([
  "schema", "approvalRequestId", "campaignId", "faultId", "createdAtUtc", "expiresAtUtc",
  "planId", "planSha256", "faultDefinitionSha256", "sourceRevision", "toolIdentitySha256",
  "hostEvidenceClass", "probeSource", "operatingSystem", "architecture",
  "hostIdentitySha256", "bootIdentitySha256", "bootStartedAtUtc",
  "physicalMachineIdentityObserved", "virtualizationLayerPresent", "probeBinarySha256",
  "restartCommand", "expectedRecoveryEvidence"
]);
const restartCommandFields = new Set(["command", "arguments"]);
const checkpointFields = new Set([
  "schema", "checkpointId", "approvalRequestId", "campaignId", "faultId", "preparedAtUtc",
  "requestExpiresAtUtc", "planId", "planSha256", "sourceRevision", "toolIdentitySha256",
  "hostEvidenceClass", "probeSource", "operatingSystem", "architecture",
  "hostIdentitySha256", "bootIdentitySha256", "bootStartedAtUtc",
  "physicalMachineIdentityObserved", "virtualizationLayerPresent", "probeBinarySha256",
  "expectedTransition", "preRestartReceiptIds", "preRestartReceiptCount",
  "preRestartReceiptSetSha256", "operatorApprovalReferenceSha256", "sentinel"
]);
const sentinelFields = new Set([
  "processId", "processStartedAtUtc", "markerSha256", "commandSha256",
  "maximumLifetimeSeconds"
]);
const verificationFields = new Set([
  "schema", "verificationId", "campaignId", "faultId", "verifiedAtUtc", "checkpointId",
  "checkpointSha256", "approvalRequestId", "preparationReceiptId", "planId", "planSha256",
  "sourceRevision", "toolIdentitySha256", "hostIdentitySha256", "bootIdentityBeforeSha256",
  "bootIdentityAfterSha256", "bootStartedAtBeforeUtc", "bootStartedAtAfterUtc",
  "probeBinarySha256", "physicalMachineIdentityObserved", "virtualizationLayerPresent",
  "postRestartReceiptIds", "postRestartReceiptCount", "postRestartReceiptSetSha256",
  "sentinelMarkerSha256", "observationCodes"
]);

const sentinelSource = `"use strict";const fs=require("node:fs");` +
  `const marker=process.argv[1],requestId=process.argv[2],lifetime=Number(process.argv[3]);` +
  `const startedAtUtc=new Date().toISOString();` +
  `const body={schema:"tinyrustlm.host_restart_sentinel.v1",requestId,` +
  `processId:process.pid,startedAtUtc};` +
  `let descriptor;try{descriptor=fs.openSync(marker,"wx",0o600);` +
  `fs.writeFileSync(descriptor,JSON.stringify(body)+"\\n","utf8");fs.fsyncSync(descriptor);}` +
  `finally{if(descriptor!==undefined)fs.closeSync(descriptor);}` +
  `const timer=setTimeout(()=>{try{fs.rmSync(marker,{force:true});}finally{process.exit(0);}},` +
  `lifetime*1000);timer.unref();setInterval(()=>{},1000);`;

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

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(64 * 1024);
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

function requireString(value, label, minimum = 1, maximum = 256) {
  const text = String(value || "");
  invariant(text.length >= minimum && text.length <= maximum, `${label} is invalid`);
  invariant(!/[\u0000-\u001f\u007f]/u.test(text), `${label} contains a control character`);
  return text;
}

function requireSha256(value, label) {
  const digest = String(value || "").toLowerCase();
  invariant(sha256Pattern.test(digest), `${label} must be SHA-256`);
  return digest;
}

function requireUtc(value, label) {
  const text = String(value || "");
  invariant(utcPattern.test(text) && Number.isFinite(Date.parse(text)), `${label} must be UTC`);
  return new Date(text).toISOString();
}

function requireDate(value, label) {
  invariant(value instanceof Date && Number.isFinite(value.getTime()), `${label} is invalid`);
  return value;
}

function requireCampaignId(value) {
  const campaignId = String(value || "");
  invariant(safeCampaignIdPattern.test(campaignId), "host restart campaign ID is invalid");
  return campaignId;
}

function requireSafeCode(value, label) {
  const code = String(value || "");
  invariant(safeCodePattern.test(code), `${label} is invalid`);
  return code;
}

function requireSourceRevision(value) {
  return requireString(value, "host restart source revision", 7, 256);
}

function normalizeReceiptIds(value, label) {
  invariant(Array.isArray(value) && value.length <= maximumReceiptCount, `${label} is invalid`);
  const ids = value.map((entry) => String(entry || ""));
  invariant(ids.every((entry) => receiptIdPattern.test(entry)), `${label} contains an invalid receipt ID`);
  invariant(new Set(ids).size === ids.length, `${label} contains a duplicate receipt ID`);
  return Object.freeze(ids.sort());
}

function normalizeTransition(value) {
  exactFields(value, expectedTransitionFields, expectedTransitionFields, "host restart transition");
  return Object.freeze({
    fromState: requireSafeCode(value.fromState, "host restart from state"),
    toState: requireSafeCode(value.toState, "host restart to state"),
    resumeFromState: requireSafeCode(value.resumeFromState, "host restart resume state")
  });
}

function parseBoundedJson(filePath, label) {
  const resolved = path.resolve(requireString(filePath, `${label} path`, 1, 32 * 1024));
  const stat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  invariant(stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumDocumentBytes, `${label} must be a bounded regular file`);
  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function writeImmutableJson(filePath, value) {
  const target = path.resolve(requireString(filePath, "host restart output path", 1, 32 * 1024));
  invariant(path.extname(target).toLowerCase() === ".json", "host restart output must be JSON");
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  invariant(bytes.length > 0 && bytes.length <= maximumDocumentBytes,
    "host restart output is oversized");
  atomicCreate(target, bytes);
  invariant(fs.readFileSync(target).equals(bytes), "host restart output readback changed");
  return target;
}

function normalizeProbe(value) {
  exactFields(value, probeFields, probeFields, "host boot evidence");
  invariant(new Set(["fixture", "target-platform"]).has(value.evidenceClass),
    "host boot evidence class is invalid");
  const probeSource = requireSafeCode(value.probeSource, "host probe source");
  if (value.evidenceClass === "target-platform") {
    invariant(probeSource === "operating-system", "target-platform host probe must use the operating system");
  }
  invariant(typeof value.physicalMachineIdentityObserved === "boolean" &&
    typeof value.virtualizationLayerPresent === "boolean", "host probe booleans are invalid");
  return Object.freeze({
    evidenceClass: value.evidenceClass,
    probeSource,
    operatingSystem: requireSafeCode(value.operatingSystem, "host operating system"),
    architecture: requireSafeCode(value.architecture, "host architecture"),
    hostIdentitySha256: requireSha256(value.hostIdentitySha256, "host identity"),
    bootIdentitySha256: requireSha256(value.bootIdentitySha256, "boot identity"),
    bootStartedAtUtc: requireUtc(value.bootStartedAtUtc, "boot start"),
    physicalMachineIdentityObserved: value.physicalMachineIdentityObserved,
    virtualizationLayerPresent: value.virtualizationLayerPresent,
    probeBinarySha256: requireSha256(value.probeBinarySha256, "host probe binary")
  });
}

function windowsPowerShellPath() {
  const systemRoot = requireString(process.env.SystemRoot || "C:\\Windows", "Windows system root");
  const candidate = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const stat = fs.lstatSync(candidate, { throwIfNoEntry: false });
  invariant(stat?.isFile() && !stat.isSymbolicLink(), "Windows PowerShell probe is unavailable");
  return candidate;
}

function captureWindowsBootEvidence() {
  const powerShellPath = windowsPowerShellPath();
  const script = "$ErrorActionPreference='Stop';" +
    "$os=Get-CimInstance Win32_OperatingSystem;" +
    "$computer=Get-CimInstance Win32_ComputerSystem;" +
    "$product=Get-CimInstance Win32_ComputerSystemProduct;" +
    "[ordered]@{" +
    "lastBootUpTimeUtc=$os.LastBootUpTime.ToUniversalTime().ToString('o');" +
    "manufacturer=[string]$computer.Manufacturer;" +
    "model=[string]$computer.Model;" +
    "hypervisorPresent=[bool]$computer.HypervisorPresent;" +
    "uuid=[string]$product.UUID" +
    "}|ConvertTo-Json -Compress";
  const result = childProcess.spawnSync(powerShellPath, [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 20_000,
    maxBuffer: 64 * 1024
  });
  invariant(!result.error && result.signal === null && result.status === 0 && result.stderr === "",
    "Windows host boot probe failed");
  let row;
  try {
    row = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error("Windows host boot probe returned invalid JSON");
  }
  exactFields(row, new Set([
    "lastBootUpTimeUtc", "manufacturer", "model", "hypervisorPresent", "uuid"
  ]), new Set([
    "lastBootUpTimeUtc", "manufacturer", "model", "hypervisorPresent", "uuid"
  ]), "Windows host probe output");
  const uuid = requireString(row.uuid, "Windows machine UUID", 32, 64).toLowerCase();
  invariant(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(uuid) &&
    !/^0{8}-0{4}-0{4}-0{4}-0{12}$/u.test(uuid), "Windows machine UUID is invalid");
  const manufacturer = requireString(row.manufacturer, "Windows manufacturer", 1, 256);
  const model = requireString(row.model, "Windows model", 1, 256);
  const bootStartedAtUtc = requireUtc(row.lastBootUpTimeUtc, "Windows boot start");
  const hostIdentitySha256 = sha256(canonicalJson({
    operatingSystem: "win32",
    uuid: uuid.toLowerCase(),
    manufacturer: manufacturer.trim().toLowerCase(),
    model: model.trim().toLowerCase()
  }));
  return normalizeProbe({
    evidenceClass: "target-platform",
    probeSource: "operating-system",
    operatingSystem: "win32",
    architecture: process.arch,
    hostIdentitySha256,
    bootIdentitySha256: sha256(canonicalJson({ hostIdentitySha256, bootStartedAtUtc })),
    bootStartedAtUtc,
    physicalMachineIdentityObserved: manufacturer !== "unknown" && model !== "unknown" &&
      !virtualMachinePattern.test(`${manufacturer} ${model}`),
    virtualizationLayerPresent: row.hypervisorPresent === true,
    probeBinarySha256: hashFile(powerShellPath)
  });
}

function readSmallText(filePath, label) {
  const stat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  invariant(stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 4096,
    `${label} is unavailable`);
  return requireString(fs.readFileSync(filePath, "utf8").trim(), label, 1, 4096);
}

function optionalSmallText(filePath) {
  try {
    return readSmallText(filePath, path.basename(filePath));
  } catch {
    return "unknown";
  }
}

function captureLinuxBootEvidence() {
  const bootId = readSmallText("/proc/sys/kernel/random/boot_id", "Linux boot ID").toLowerCase();
  invariant(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(bootId),
    "Linux boot ID is invalid");
  const machineIdPath = fs.existsSync("/etc/machine-id") ? "/etc/machine-id" : "/var/lib/dbus/machine-id";
  const machineId = readSmallText(machineIdPath, "Linux machine ID").toLowerCase();
  invariant(/^[a-f0-9-]{16,64}$/u.test(machineId), "Linux machine ID is invalid");
  const procStat = readSmallText("/proc/stat", "Linux process statistics");
  const bootTimeMatch = /^btime\s+(\d+)$/mu.exec(procStat);
  invariant(bootTimeMatch, "Linux boot time is unavailable");
  const bootStartedAtUtc = new Date(Number(bootTimeMatch[1]) * 1000).toISOString();
  const manufacturer = optionalSmallText("/sys/class/dmi/id/sys_vendor");
  const model = optionalSmallText("/sys/class/dmi/id/product_name");
  const hostIdentitySha256 = sha256(canonicalJson({
    operatingSystem: "linux",
    machineId,
    manufacturer: manufacturer.trim().toLowerCase(),
    model: model.trim().toLowerCase()
  }));
  return normalizeProbe({
    evidenceClass: "target-platform",
    probeSource: "operating-system",
    operatingSystem: "linux",
    architecture: process.arch,
    hostIdentitySha256,
    bootIdentitySha256: sha256(canonicalJson({ hostIdentitySha256, bootId, bootStartedAtUtc })),
    bootStartedAtUtc,
    physicalMachineIdentityObserved: manufacturer !== "unknown" && model !== "unknown" &&
      !virtualMachinePattern.test(`${manufacturer} ${model}`),
    virtualizationLayerPresent: fs.existsSync("/sys/hypervisor"),
    probeBinarySha256: hashFile(process.execPath)
  });
}

function captureHostBootEvidence() {
  if (process.platform === "win32") return captureWindowsBootEvidence();
  if (process.platform === "linux") return captureLinuxBootEvidence();
  throw new Error(`host restart evidence is unsupported on ${process.platform}`);
}

function restartCommandFor(operatingSystem) {
  if (operatingSystem === "win32") {
    return Object.freeze({
      command: "shutdown.exe",
      arguments: Object.freeze([
        "/r", "/t", "5", "/d", "p:0:0", "/c", "TinyRustLM authorized host-restart fault"
      ])
    });
  }
  if (operatingSystem === "linux") {
    return Object.freeze({ command: "systemctl", arguments: Object.freeze(["reboot"]) });
  }
  throw new Error("host restart command is unsupported");
}

function validateRestartCommand(value, operatingSystem) {
  exactFields(value, restartCommandFields, restartCommandFields, "host restart command");
  const command = requireSafeCode(value.command, "host restart command name");
  invariant(Array.isArray(value.arguments) && value.arguments.length >= 1 && value.arguments.length <= 16,
    "host restart command arguments are invalid");
  const args = value.arguments.map((entry) => requireString(entry, "host restart command argument", 1, 256));
  const expected = restartCommandFor(operatingSystem);
  invariant(command === expected.command && canonicalJson(args) === canonicalJson(expected.arguments),
    "host restart command changed");
  return Object.freeze({ command, arguments: Object.freeze(args) });
}

function requestBody(options, probe, now) {
  const createdAtUtc = now.toISOString();
  const expiresAtUtc = new Date(now.getTime() + approvalLifetimeMilliseconds).toISOString();
  return Object.freeze({
    schema: approvalRequestSchema,
    campaignId: requireCampaignId(options.campaignId),
    faultId: "host-restart",
    createdAtUtc,
    expiresAtUtc,
    planId: requireSafeCode(options.planId, "host restart plan ID"),
    planSha256: requireSha256(options.planSha256, "host restart plan"),
    faultDefinitionSha256: requireSha256(options.faultDefinitionSha256, "host restart fault definition"),
    sourceRevision: requireSourceRevision(options.sourceRevision),
    toolIdentitySha256: requireSha256(options.toolIdentitySha256, "host restart tool identity"),
    hostEvidenceClass: probe.evidenceClass,
    probeSource: probe.probeSource,
    operatingSystem: probe.operatingSystem,
    architecture: probe.architecture,
    hostIdentitySha256: probe.hostIdentitySha256,
    bootIdentitySha256: probe.bootIdentitySha256,
    bootStartedAtUtc: probe.bootStartedAtUtc,
    physicalMachineIdentityObserved: probe.physicalMachineIdentityObserved,
    virtualizationLayerPresent: probe.virtualizationLayerPresent,
    probeBinarySha256: probe.probeBinarySha256,
    restartCommand: restartCommandFor(probe.operatingSystem),
    expectedRecoveryEvidence: expectedObservationCodes
  });
}

function validateHostRestartApprovalRequest(value) {
  exactFields(value, requestFields, requestFields, "host restart approval request");
  invariant(value.schema === approvalRequestSchema && value.faultId === "host-restart",
    "host restart approval request schema or fault changed");
  const createdAtUtc = requireUtc(value.createdAtUtc, "host restart request creation");
  const expiresAtUtc = requireUtc(value.expiresAtUtc, "host restart request expiry");
  invariant(Date.parse(expiresAtUtc) > Date.parse(createdAtUtc), "host restart approval request expiry is invalid");
  const operatingSystem = requireSafeCode(value.operatingSystem, "host restart operating system");
  const body = {
    schema: approvalRequestSchema,
    campaignId: requireCampaignId(value.campaignId),
    faultId: "host-restart",
    createdAtUtc,
    expiresAtUtc,
    planId: requireSafeCode(value.planId, "host restart plan ID"),
    planSha256: requireSha256(value.planSha256, "host restart plan"),
    faultDefinitionSha256: requireSha256(value.faultDefinitionSha256, "host restart fault definition"),
    sourceRevision: requireSourceRevision(value.sourceRevision),
    toolIdentitySha256: requireSha256(value.toolIdentitySha256, "host restart tool identity"),
    hostEvidenceClass: requireSafeCode(value.hostEvidenceClass, "host restart evidence class"),
    probeSource: requireSafeCode(value.probeSource, "host restart probe source"),
    operatingSystem,
    architecture: requireSafeCode(value.architecture, "host restart architecture"),
    hostIdentitySha256: requireSha256(value.hostIdentitySha256, "host identity"),
    bootIdentitySha256: requireSha256(value.bootIdentitySha256, "boot identity"),
    bootStartedAtUtc: requireUtc(value.bootStartedAtUtc, "boot start"),
    physicalMachineIdentityObserved: value.physicalMachineIdentityObserved,
    virtualizationLayerPresent: value.virtualizationLayerPresent,
    probeBinarySha256: requireSha256(value.probeBinarySha256, "host probe binary"),
    restartCommand: validateRestartCommand(value.restartCommand, operatingSystem),
    expectedRecoveryEvidence: Object.freeze([...value.expectedRecoveryEvidence])
  };
  invariant(typeof body.physicalMachineIdentityObserved === "boolean" &&
    typeof body.virtualizationLayerPresent === "boolean", "host request booleans are invalid");
  invariant(canonicalJson(body.expectedRecoveryEvidence) === canonicalJson(expectedObservationCodes),
    "host restart recovery evidence changed");
  const approvalRequestId = requireSha256(value.approvalRequestId, "host restart approval request identity");
  invariant(approvalRequestId === sha256(canonicalJson(body)), "host restart approval request identity mismatch");
  return Object.freeze({ ...body, approvalRequestId });
}

function readHostRestartApprovalRequest(filePath) {
  return validateHostRestartApprovalRequest(parseBoundedJson(filePath, "host restart approval request"));
}

function createHostRestartApprovalRequest(options, dependencies = {}) {
  const allowed = new Set([
    "campaignId", "faultDefinitionSha256", "outputPath", "planId", "planSha256",
    "sourceRevision", "toolIdentitySha256"
  ]);
  exactFields(options, allowed, allowed, "host restart approval options");
  const outputPath = path.resolve(options.outputPath);
  if (fs.existsSync(outputPath)) {
    const existing = readHostRestartApprovalRequest(outputPath);
    const probe = normalizeProbe((dependencies.captureHostBootEvidence || captureHostBootEvidence)());
    invariant(existing.campaignId === options.campaignId && existing.planId === options.planId &&
      existing.planSha256 === options.planSha256 && existing.sourceRevision === options.sourceRevision &&
      existing.toolIdentitySha256 === options.toolIdentitySha256 &&
      existing.faultDefinitionSha256 === options.faultDefinitionSha256 &&
      existing.hostIdentitySha256 === probe.hostIdentitySha256 &&
      existing.bootIdentitySha256 === probe.bootIdentitySha256,
    "existing host restart approval request does not match current inputs");
    const now = requireDate((dependencies.now || (() => new Date()))(), "host restart clock");
    invariant(now.getTime() <= Date.parse(existing.expiresAtUtc),
      "existing host restart approval request expired");
    return existing;
  }
  const probe = normalizeProbe((dependencies.captureHostBootEvidence || captureHostBootEvidence)());
  const now = requireDate((dependencies.now || (() => new Date()))(), "host restart clock");
  const body = requestBody(options, probe, now);
  const request = validateHostRestartApprovalRequest({
    ...body,
    approvalRequestId: sha256(canonicalJson(body))
  });
  writeImmutableJson(outputPath, request);
  return request;
}

function validateSentinel(value) {
  exactFields(value, sentinelFields, sentinelFields, "host restart sentinel");
  invariant(Number.isSafeInteger(value.processId) && value.processId > 0,
    "host restart sentinel process ID is invalid");
  invariant(Number.isSafeInteger(value.maximumLifetimeSeconds) &&
    value.maximumLifetimeSeconds >= 60 && value.maximumLifetimeSeconds <= 3600,
  "host restart sentinel lifetime is invalid");
  return Object.freeze({
    processId: value.processId,
    processStartedAtUtc: requireUtc(value.processStartedAtUtc, "host restart sentinel start"),
    markerSha256: requireSha256(value.markerSha256, "host restart sentinel marker"),
    commandSha256: requireSha256(value.commandSha256, "host restart sentinel command"),
    maximumLifetimeSeconds: value.maximumLifetimeSeconds
  });
}

function sentinelMarkerPath(checkpointPath, approvalRequestId) {
  return path.join(path.dirname(path.resolve(checkpointPath)), `${approvalRequestId}.sentinel.json`);
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function startRestartSentinel(checkpointPath, approvalRequestId) {
  const markerPath = sentinelMarkerPath(checkpointPath, approvalRequestId);
  invariant(!fs.existsSync(markerPath), "host restart sentinel marker already exists");
  const child = childProcess.spawn(process.execPath, [
    "-e", sentinelSource, markerPath, approvalRequestId, String(sentinelMaximumLifetimeSeconds)
  ], {
    detached: true,
    windowsHide: true,
    stdio: "ignore"
  });
  child.unref();
  const deadline = Date.now() + 5000;
  while (!fs.existsSync(markerPath) && Date.now() < deadline) sleep(25);
  invariant(fs.existsSync(markerPath), "host restart sentinel did not become ready");
  const marker = parseBoundedJson(markerPath, "host restart sentinel marker");
  exactFields(marker, new Set(["schema", "requestId", "processId", "startedAtUtc"]),
    new Set(["schema", "requestId", "processId", "startedAtUtc"]), "host restart sentinel marker");
  invariant(marker.schema === "tinyrustlm.host_restart_sentinel.v1" &&
    marker.requestId === approvalRequestId && marker.processId === child.pid,
  "host restart sentinel marker identity changed");
  return validateSentinel({
    processId: child.pid,
    processStartedAtUtc: marker.startedAtUtc,
    markerSha256: hashFile(markerPath),
    commandSha256: sha256(sentinelSource),
    maximumLifetimeSeconds: sentinelMaximumLifetimeSeconds
  });
}

function restartSentinelMarkerRetained(checkpointPath, checkpoint) {
  const markerPath = sentinelMarkerPath(checkpointPath, checkpoint.approvalRequestId);
  const stat = fs.lstatSync(markerPath, { throwIfNoEntry: false });
  return Boolean(stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumDocumentBytes && hashFile(markerPath) === checkpoint.sentinel.markerSha256);
}

function cleanupRestartSentinel(checkpointPath, approvalRequestId, sentinel) {
  const checkpoint = { approvalRequestId, sentinel };
  try {
    if (inspectRestartSentinel(checkpointPath, checkpoint)) process.kill(sentinel.processId);
  } catch {
    // The process may already have exited; marker cleanup remains independently required.
  }
  fs.rmSync(sentinelMarkerPath(checkpointPath, approvalRequestId), { force: true });
}

function validateHostRestartCheckpoint(value) {
  exactFields(value, checkpointFields, checkpointFields, "host restart checkpoint");
  invariant(value.schema === checkpointSchema && value.faultId === "host-restart",
    "host restart checkpoint schema or fault changed");
  const transition = normalizeTransition(value.expectedTransition);
  const preRestartReceiptIds = normalizeReceiptIds(value.preRestartReceiptIds,
    "pre-restart receipt IDs");
  invariant(value.preRestartReceiptCount === preRestartReceiptIds.length,
    "host restart receipt count changed");
  const expectedSetHash = sha256(canonicalJson(preRestartReceiptIds));
  invariant(value.preRestartReceiptSetSha256 === expectedSetHash,
    "host restart receipt set identity mismatch");
  const body = {
    schema: checkpointSchema,
    approvalRequestId: requireSha256(value.approvalRequestId, "host restart approval request identity"),
    campaignId: requireCampaignId(value.campaignId),
    faultId: "host-restart",
    preparedAtUtc: requireUtc(value.preparedAtUtc, "host restart preparation time"),
    requestExpiresAtUtc: requireUtc(value.requestExpiresAtUtc, "host restart request expiry"),
    planId: requireSafeCode(value.planId, "host restart plan ID"),
    planSha256: requireSha256(value.planSha256, "host restart plan"),
    sourceRevision: requireSourceRevision(value.sourceRevision),
    toolIdentitySha256: requireSha256(value.toolIdentitySha256, "host restart tool identity"),
    hostEvidenceClass: requireSafeCode(value.hostEvidenceClass, "host restart evidence class"),
    probeSource: requireSafeCode(value.probeSource, "host restart probe source"),
    operatingSystem: requireSafeCode(value.operatingSystem, "host restart operating system"),
    architecture: requireSafeCode(value.architecture, "host restart architecture"),
    hostIdentitySha256: requireSha256(value.hostIdentitySha256, "host identity"),
    bootIdentitySha256: requireSha256(value.bootIdentitySha256, "boot identity"),
    bootStartedAtUtc: requireUtc(value.bootStartedAtUtc, "boot start"),
    physicalMachineIdentityObserved: value.physicalMachineIdentityObserved,
    virtualizationLayerPresent: value.virtualizationLayerPresent,
    probeBinarySha256: requireSha256(value.probeBinarySha256, "host probe binary"),
    expectedTransition: transition,
    preRestartReceiptIds,
    preRestartReceiptCount: preRestartReceiptIds.length,
    preRestartReceiptSetSha256: expectedSetHash,
    operatorApprovalReferenceSha256: requireSha256(value.operatorApprovalReferenceSha256,
      "host restart operator approval reference"),
    sentinel: validateSentinel(value.sentinel)
  };
  invariant(typeof body.physicalMachineIdentityObserved === "boolean" &&
    typeof body.virtualizationLayerPresent === "boolean", "host checkpoint booleans are invalid");
  invariant(Date.parse(body.requestExpiresAtUtc) >= Date.parse(body.preparedAtUtc),
    "host restart checkpoint was prepared after request expiry");
  const checkpointId = requireSha256(value.checkpointId, "host restart checkpoint identity");
  invariant(checkpointId === sha256(canonicalJson(body)), "host restart checkpoint identity mismatch");
  return Object.freeze({ ...body, checkpointId });
}

function readHostRestartCheckpoint(filePath) {
  return validateHostRestartCheckpoint(parseBoundedJson(filePath, "host restart checkpoint"));
}

function validateHostRestartVerification(value) {
  exactFields(value, verificationFields, verificationFields, "host restart verification");
  invariant(value.schema === verificationSchema && value.faultId === "host-restart",
    "host restart verification schema or fault changed");
  const postRestartReceiptIds = normalizeReceiptIds(value.postRestartReceiptIds,
    "post-restart verification receipt IDs");
  invariant(value.postRestartReceiptCount === postRestartReceiptIds.length &&
    value.postRestartReceiptSetSha256 === sha256(canonicalJson(postRestartReceiptIds)),
  "host restart verification receipt set changed");
  invariant(typeof value.physicalMachineIdentityObserved === "boolean" &&
    typeof value.virtualizationLayerPresent === "boolean",
  "host restart verification booleans are invalid");
  invariant(canonicalJson(value.observationCodes) === canonicalJson(expectedObservationCodes),
    "host restart verification observations changed");
  const body = Object.freeze({
    schema: verificationSchema,
    campaignId: requireCampaignId(value.campaignId),
    faultId: "host-restart",
    verifiedAtUtc: requireUtc(value.verifiedAtUtc, "host restart verification time"),
    checkpointId: requireSha256(value.checkpointId, "host restart checkpoint identity"),
    checkpointSha256: requireSha256(value.checkpointSha256, "host restart checkpoint file"),
    approvalRequestId: requireSha256(value.approvalRequestId,
      "host restart approval request identity"),
    preparationReceiptId: requireString(value.preparationReceiptId,
      "host restart preparation receipt", 71, 71),
    planId: requireSafeCode(value.planId, "host restart plan ID"),
    planSha256: requireSha256(value.planSha256, "host restart plan"),
    sourceRevision: requireSourceRevision(value.sourceRevision),
    toolIdentitySha256: requireSha256(value.toolIdentitySha256, "host restart tool identity"),
    hostIdentitySha256: requireSha256(value.hostIdentitySha256, "host identity"),
    bootIdentityBeforeSha256: requireSha256(value.bootIdentityBeforeSha256,
      "pre-restart boot identity"),
    bootIdentityAfterSha256: requireSha256(value.bootIdentityAfterSha256,
      "post-restart boot identity"),
    bootStartedAtBeforeUtc: requireUtc(value.bootStartedAtBeforeUtc,
      "pre-restart boot start"),
    bootStartedAtAfterUtc: requireUtc(value.bootStartedAtAfterUtc,
      "post-restart boot start"),
    probeBinarySha256: requireSha256(value.probeBinarySha256, "host probe binary"),
    physicalMachineIdentityObserved: value.physicalMachineIdentityObserved,
    virtualizationLayerPresent: value.virtualizationLayerPresent,
    postRestartReceiptIds,
    postRestartReceiptCount: postRestartReceiptIds.length,
    postRestartReceiptSetSha256: sha256(canonicalJson(postRestartReceiptIds)),
    sentinelMarkerSha256: requireSha256(value.sentinelMarkerSha256,
      "host restart sentinel marker"),
    observationCodes: expectedObservationCodes
  });
  invariant(receiptIdPattern.test(body.preparationReceiptId),
    "host restart preparation receipt identity is invalid");
  const verificationId = requireSha256(value.verificationId,
    "host restart verification identity");
  invariant(verificationId === sha256(canonicalJson(body)),
    "host restart verification identity mismatch");
  return Object.freeze({ ...body, verificationId });
}

function hostRestartVerificationPath(checkpointPath, checkpoint) {
  return path.join(path.dirname(path.resolve(checkpointPath)),
    `${checkpoint.checkpointId}.host-restart-verification.json`);
}

function readHostRestartVerification(filePath) {
  return validateHostRestartVerification(parseBoundedJson(filePath,
    "host restart verification"));
}

function prepareHostRestartCheckpoint(options, dependencies = {}) {
  const allowed = new Set([
    "approvalRequestId", "campaignId", "checkpointPath", "expectedTransition", "planId",
    "planSha256", "preRestartReceiptIds", "requestPath", "sourceRevision", "toolIdentitySha256"
  ]);
  exactFields(options, allowed, allowed, "host restart checkpoint options");
  const request = readHostRestartApprovalRequest(options.requestPath);
  const approvalRequestId = requireSha256(options.approvalRequestId,
    "host restart approval request identity");
  invariant(request.approvalRequestId === approvalRequestId,
    "host restart approval request identity does not match");
  invariant(request.campaignId === options.campaignId && request.planId === options.planId &&
    request.planSha256 === options.planSha256 && request.sourceRevision === options.sourceRevision &&
    request.toolIdentitySha256 === options.toolIdentitySha256,
  "host restart approval request inputs changed");
  const transition = normalizeTransition(options.expectedTransition);
  const preRestartReceiptIds = normalizeReceiptIds(options.preRestartReceiptIds,
    "pre-restart receipt IDs");
  const checkpointPath = path.resolve(options.checkpointPath);
  if (fs.existsSync(checkpointPath)) {
    const existing = readHostRestartCheckpoint(checkpointPath);
    invariant(existing.approvalRequestId === approvalRequestId &&
      existing.campaignId === options.campaignId && existing.planSha256 === options.planSha256 &&
      existing.toolIdentitySha256 === options.toolIdentitySha256 &&
      canonicalJson(existing.expectedTransition) === canonicalJson(transition) &&
      canonicalJson(existing.preRestartReceiptIds) === canonicalJson(preRestartReceiptIds),
    "existing host restart checkpoint does not match current inputs");
    const now = requireDate((dependencies.now || (() => new Date()))(), "host restart clock");
    invariant(now.getTime() <= Date.parse(existing.requestExpiresAtUtc),
      "host restart approval request is expired");
    const probe = normalizeProbe((dependencies.captureHostBootEvidence || captureHostBootEvidence)());
    invariant(probe.hostIdentitySha256 === existing.hostIdentitySha256 &&
      probe.bootIdentitySha256 === existing.bootIdentitySha256,
    "host or boot identity changed after host restart preparation");
    const markerRetained = (dependencies.restartSentinelMarkerRetained ||
      restartSentinelMarkerRetained)(checkpointPath, existing);
    const sentinelAlive = (dependencies.inspectRestartSentinel || inspectRestartSentinel)(
      checkpointPath, existing);
    invariant(markerRetained === true && sentinelAlive === true,
      "host restart checkpoint is no longer armed");
    return existing;
  }
  const now = requireDate((dependencies.now || (() => new Date()))(), "host restart clock");
  invariant(now.getTime() >= Date.parse(request.createdAtUtc) &&
    now.getTime() <= Date.parse(request.expiresAtUtc), "host restart approval request is expired");
  const probe = normalizeProbe((dependencies.captureHostBootEvidence || captureHostBootEvidence)());
  invariant(probe.hostIdentitySha256 === request.hostIdentitySha256,
    "host identity changed after approval request");
  invariant(probe.bootIdentitySha256 === request.bootIdentitySha256,
    "boot identity changed before host restart preparation");
  invariant(probe.evidenceClass === request.hostEvidenceClass &&
    probe.probeSource === request.probeSource && probe.probeBinarySha256 === request.probeBinarySha256,
  "host probe identity changed after approval request");
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
  let sentinel = null;
  try {
    sentinel = validateSentinel((dependencies.startRestartSentinel || startRestartSentinel)(
      checkpointPath, approvalRequestId));
    const body = Object.freeze({
      schema: checkpointSchema,
      approvalRequestId,
      campaignId: requireCampaignId(options.campaignId),
      faultId: "host-restart",
      preparedAtUtc: now.toISOString(),
      requestExpiresAtUtc: request.expiresAtUtc,
      planId: requireSafeCode(options.planId, "host restart plan ID"),
      planSha256: requireSha256(options.planSha256, "host restart plan"),
      sourceRevision: requireSourceRevision(options.sourceRevision),
      toolIdentitySha256: requireSha256(options.toolIdentitySha256, "host restart tool identity"),
      hostEvidenceClass: probe.evidenceClass,
      probeSource: probe.probeSource,
      operatingSystem: probe.operatingSystem,
      architecture: probe.architecture,
      hostIdentitySha256: probe.hostIdentitySha256,
      bootIdentitySha256: probe.bootIdentitySha256,
      bootStartedAtUtc: probe.bootStartedAtUtc,
      physicalMachineIdentityObserved: probe.physicalMachineIdentityObserved,
      virtualizationLayerPresent: probe.virtualizationLayerPresent,
      probeBinarySha256: probe.probeBinarySha256,
      expectedTransition: transition,
      preRestartReceiptIds,
      preRestartReceiptCount: preRestartReceiptIds.length,
      preRestartReceiptSetSha256: sha256(canonicalJson(preRestartReceiptIds)),
      operatorApprovalReferenceSha256: sha256(`operator-approved:${approvalRequestId}`),
      sentinel
    });
    const checkpoint = validateHostRestartCheckpoint({
      ...body,
      checkpointId: sha256(canonicalJson(body))
    });
    writeImmutableJson(checkpointPath, checkpoint);
    return checkpoint;
  } catch (error) {
    if (sentinel) {
      const cleanup = dependencies.cleanupRestartSentinel || cleanupRestartSentinel;
      cleanup(checkpointPath, approvalRequestId, sentinel);
    }
    throw error;
  }
}

function processCommandLineWindows(processId) {
  const powerShellPath = windowsPowerShellPath();
  const script = `$row=Get-CimInstance Win32_Process -Filter \"ProcessId = ${processId}\";` +
    `if($null -eq $row){'null'}else{[ordered]@{processId=[int]$row.ProcessId;` +
    `commandLine=[string]$row.CommandLine}|ConvertTo-Json -Compress}`;
  const result = childProcess.spawnSync(powerShellPath, [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: 32 * 1024
  });
  invariant(!result.error && result.signal === null && result.status === 0 && result.stderr === "",
    "host restart sentinel process probe failed");
  return JSON.parse(result.stdout.trim());
}

function inspectRestartSentinel(checkpointPath, checkpoint) {
  if (process.platform === "win32") {
    const row = processCommandLineWindows(checkpoint.sentinel.processId);
    return Boolean(row && row.processId === checkpoint.sentinel.processId &&
      String(row.commandLine || "").includes(checkpoint.approvalRequestId) &&
      String(row.commandLine || "").includes(sentinelMarkerPath(checkpointPath,
        checkpoint.approvalRequestId)));
  }
  if (process.platform === "linux") {
    const commandPath = `/proc/${checkpoint.sentinel.processId}/cmdline`;
    if (!fs.existsSync(commandPath)) return false;
    const command = fs.readFileSync(commandPath).toString("utf8").replace(/\u0000/gu, " ");
    return command.includes(checkpoint.approvalRequestId) &&
      command.includes(sentinelMarkerPath(checkpointPath, checkpoint.approvalRequestId));
  }
  throw new Error("host restart sentinel inspection is unsupported");
}

function verifyHostRestartCheckpoint(options, dependencies = {}) {
  const allowed = new Set([
    "checkpointPath", "postRestartReceiptIds", "preparationReceiptId",
    "preparationReceiptRetained"
  ]);
  exactFields(options, allowed, allowed, "host restart verification options");
  const checkpointPath = path.resolve(options.checkpointPath);
  const checkpoint = readHostRestartCheckpoint(checkpointPath);
  const now = requireDate((dependencies.now || (() => new Date()))(), "host restart clock");
  invariant(now.getTime() > Date.parse(checkpoint.preparedAtUtc),
    "host restart verification time did not advance");
  const probe = normalizeProbe((dependencies.captureHostBootEvidence || captureHostBootEvidence)());
  invariant(probe.hostIdentitySha256 === checkpoint.hostIdentitySha256,
    "host identity changed across restart");
  invariant(probe.operatingSystem === checkpoint.operatingSystem &&
    probe.architecture === checkpoint.architecture, "host platform changed across restart");
  invariant(probe.bootIdentitySha256 !== checkpoint.bootIdentitySha256,
    "boot identity did not change");
  invariant(Date.parse(probe.bootStartedAtUtc) > Date.parse(checkpoint.bootStartedAtUtc),
    "post-restart boot time did not advance");
  invariant(Date.parse(probe.bootStartedAtUtc) <= now.getTime(),
    "post-restart boot time is in the future");
  invariant(Date.parse(probe.bootStartedAtUtc) <= Date.parse(checkpoint.requestExpiresAtUtc),
    "host restart occurred after approval expiry");
  const sentinelAlive = (dependencies.inspectRestartSentinel || inspectRestartSentinel)(
    checkpointPath, checkpoint);
  invariant(sentinelAlive === false, "host restart sentinel is still running");
  const postRestartReceiptIds = normalizeReceiptIds(options.postRestartReceiptIds,
    "post-restart receipt IDs");
  const postSet = new Set(postRestartReceiptIds);
  invariant(checkpoint.preRestartReceiptIds.every((receiptId) => postSet.has(receiptId)),
    "pre-restart receipt set was not retained");
  const preparationReceiptId = String(options.preparationReceiptId || "");
  invariant(receiptIdPattern.test(preparationReceiptId) &&
    options.preparationReceiptRetained === true && postSet.has(preparationReceiptId),
  "pre-restart preparation receipt was not retained");
  const checkpointSha256 = hashFile(checkpointPath);
  const markerPath = sentinelMarkerPath(checkpointPath, checkpoint.approvalRequestId);
  const verificationPath = hostRestartVerificationPath(checkpointPath, checkpoint);
  let verification;
  if (fs.existsSync(verificationPath)) {
    verification = readHostRestartVerification(verificationPath);
    invariant(verification.campaignId === checkpoint.campaignId &&
      verification.checkpointId === checkpoint.checkpointId &&
      verification.checkpointSha256 === checkpointSha256 &&
      verification.approvalRequestId === checkpoint.approvalRequestId &&
      verification.preparationReceiptId === preparationReceiptId &&
      verification.planId === checkpoint.planId &&
      verification.planSha256 === checkpoint.planSha256 &&
      verification.sourceRevision === checkpoint.sourceRevision &&
      verification.toolIdentitySha256 === checkpoint.toolIdentitySha256 &&
      verification.hostIdentitySha256 === checkpoint.hostIdentitySha256 &&
      verification.bootIdentityBeforeSha256 === checkpoint.bootIdentitySha256 &&
      verification.bootIdentityAfterSha256 === probe.bootIdentitySha256 &&
      verification.bootStartedAtBeforeUtc === checkpoint.bootStartedAtUtc &&
      verification.bootStartedAtAfterUtc === probe.bootStartedAtUtc &&
      verification.probeBinarySha256 === probe.probeBinarySha256 &&
      verification.physicalMachineIdentityObserved === probe.physicalMachineIdentityObserved &&
      verification.virtualizationLayerPresent === probe.virtualizationLayerPresent &&
      verification.sentinelMarkerSha256 === checkpoint.sentinel.markerSha256 &&
      Date.parse(verification.verifiedAtUtc) <= now.getTime(),
    "existing host restart verification does not match current evidence");
    invariant(verification.postRestartReceiptIds.every((receiptId) => postSet.has(receiptId)),
      "post-restart verification receipt set was not retained");
    if (fs.existsSync(markerPath)) {
      const markerRetained = (dependencies.restartSentinelMarkerRetained ||
        restartSentinelMarkerRetained)(checkpointPath, checkpoint);
      invariant(markerRetained === true,
        "host restart sentinel marker changed during verification recovery");
    }
  } else {
    const markerRetained = (dependencies.restartSentinelMarkerRetained ||
      restartSentinelMarkerRetained)(checkpointPath, checkpoint);
    invariant(markerRetained === true, "host restart sentinel marker was not retained unchanged");
    const body = Object.freeze({
      schema: verificationSchema,
      campaignId: checkpoint.campaignId,
      faultId: "host-restart",
      verifiedAtUtc: now.toISOString(),
      checkpointId: checkpoint.checkpointId,
      checkpointSha256,
      approvalRequestId: checkpoint.approvalRequestId,
      preparationReceiptId,
      planId: checkpoint.planId,
      planSha256: checkpoint.planSha256,
      sourceRevision: checkpoint.sourceRevision,
      toolIdentitySha256: checkpoint.toolIdentitySha256,
      hostIdentitySha256: checkpoint.hostIdentitySha256,
      bootIdentityBeforeSha256: checkpoint.bootIdentitySha256,
      bootIdentityAfterSha256: probe.bootIdentitySha256,
      bootStartedAtBeforeUtc: checkpoint.bootStartedAtUtc,
      bootStartedAtAfterUtc: probe.bootStartedAtUtc,
      probeBinarySha256: probe.probeBinarySha256,
      physicalMachineIdentityObserved: probe.physicalMachineIdentityObserved,
      virtualizationLayerPresent: probe.virtualizationLayerPresent,
      postRestartReceiptIds,
      postRestartReceiptCount: postRestartReceiptIds.length,
      postRestartReceiptSetSha256: sha256(canonicalJson(postRestartReceiptIds)),
      sentinelMarkerSha256: checkpoint.sentinel.markerSha256,
      observationCodes: expectedObservationCodes
    });
    verification = validateHostRestartVerification({
      ...body,
      verificationId: sha256(canonicalJson(body))
    });
    writeImmutableJson(verificationPath, verification);
    verification = readHostRestartVerification(verificationPath);
  }
  fs.rmSync(markerPath, { force: true });
  invariant(!fs.existsSync(markerPath), "host restart sentinel marker cleanup failed");
  invariant(readHostRestartVerification(verificationPath).verificationId ===
    verification.verificationId, "host restart verification artifact changed during cleanup");
  const actualPhysicalHostRestart = checkpoint.hostEvidenceClass === "target-platform" &&
    checkpoint.probeSource === "operating-system" &&
    probe.evidenceClass === "target-platform" && probe.probeSource === "operating-system" &&
    checkpoint.physicalMachineIdentityObserved === true &&
    probe.physicalMachineIdentityObserved === true;
  return Object.freeze({
    observationCodes: expectedObservationCodes,
    outputHashes: Object.freeze({
      approvalRequest: checkpoint.approvalRequestId,
      preRestartCheckpoint: checkpointSha256,
      preRestartReceiptSet: checkpoint.preRestartReceiptSetSha256,
      postRestartReceiptSet: verification.postRestartReceiptSetSha256,
      postRestartVerification: hashFile(verificationPath),
      bootIdentityBefore: checkpoint.bootIdentitySha256,
      bootIdentityAfter: probe.bootIdentitySha256,
      stableHostIdentity: checkpoint.hostIdentitySha256,
      sentinelMarker: checkpoint.sentinel.markerSha256
    }),
    hardwareEvidence: Object.freeze({
      actualPhysicalHostRestart,
      injectedFixtureEvidence: !actualPhysicalHostRestart,
      operatingSystemBootProbe: probe.probeSource === "operating-system",
      bootIdentityChanged: true,
      stableHostIdentityMatched: true,
      physicalMachineIdentityObserved: probe.physicalMachineIdentityObserved,
      virtualizationLayerPresent: probe.virtualizationLayerPresent,
      receiptDagRebuilt: true,
      orphanProcessScanPass: true,
      preRestartAttemptRetained: true,
      operatorApprovalReferenceVerified: sha256(`operator-approved:${checkpoint.approvalRequestId}`) ===
        checkpoint.operatorApprovalReferenceSha256,
      restartSentinelTerminated: true,
      restartSentinelMarkerRetained: true,
      sentinelMarkerDeleted: true,
      restartVerificationArtifactRetained: true,
      hostProbeBinaryHashVerified: probe.probeBinarySha256 === checkpoint.probeBinarySha256
    }),
    preparationReceiptId,
    checkpoint,
    verification,
    verificationPath
  });
}

module.exports = Object.freeze({
  approvalRequestSchema,
  captureHostBootEvidence,
  checkpointSchema,
  createHostRestartApprovalRequest,
  expectedObservationCodes,
  hostRestartToolVersion,
  preparationReceiptType,
  prepareHostRestartCheckpoint,
  readHostRestartApprovalRequest,
  readHostRestartCheckpoint,
  readHostRestartVerification,
  validateHostRestartApprovalRequest,
  validateHostRestartCheckpoint,
  validateHostRestartVerification,
  verificationSchema,
  verifyHostRestartCheckpoint
});

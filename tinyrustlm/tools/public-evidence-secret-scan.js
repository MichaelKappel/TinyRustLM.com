"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  archiveAdmissionProfileId,
  archiveAdmissionProfileSha256,
  archiveFormatForPath,
  archiveScanProcessProfileId,
  archiveScanProcessProfileSha256,
  createArchiveScanClient
} = require("./archive-scan-client.js");
const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");
const { atomicReplace } = require("./durable-files.js");

const reportSchema = "tinyrustlm.public_artifact_secret_scan.v3";
const receiptType = "tinyrustlm.secret-scan-v3";
const maximumArtifactCount = 4096;
const maximumArchiveBytes = 512 * 1024 * 1024;
const maximumScannedContentBytes = 4 * 1024 * 1024 * 1024;
const archiveExtensions = [".nupkg", ".snupkg", ".tar.gz", ".tgz", ".zip"];
const scannerSourceFiles = Object.freeze([
  "archive-scan-client.js",
  "public-evidence-secret-scan.js",
  "strict-json.js"
]);
const scannerRules = Object.freeze([
  Object.freeze({
    code: "private_key_material",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i
  }),
  Object.freeze({
    code: "bearer_credential",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}\b/i
  }),
  Object.freeze({
    code: "openai_api_key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/i
  }),
  Object.freeze({
    code: "github_token",
    pattern: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{24,}\b/i
  }),
  Object.freeze({
    code: "aws_access_key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/
  }),
  Object.freeze({
    code: "credential_url_userinfo",
    pattern: /https?:\/\/[^\s/:?#]{1,128}:[^\s/@]{1,256}@/i
  }),
  Object.freeze({
    code: "credential_url_query",
    pattern: /[?&](?:access_token|api[_-]?key|authorization|bearer|credential|invite|invitation|password|secret|token)=[A-Za-z0-9._~+/%-]{12,}/i
  }),
  Object.freeze({
    code: "assigned_secret_value",
    pattern: /\b(?:api[_-]?key|bearer[_-]?token|enrollment[_-]?secret|password|private[_-]?key|workspace[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{20,}/i
  })
]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requireUtc(value, label) {
  const text = String(value || "");
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(text) &&
    Number.isFinite(Date.parse(text)), `${label} must be UTC`);
  return text;
}

function isArchive(filePath) {
  return archiveFormatForPath(filePath) !== null;
}

function findingCodes(text, knownSecrets) {
  const codes = new Set();
  for (const rule of scannerRules) {
    if (rule.pattern.test(text)) codes.add(rule.code);
  }
  for (const secret of knownSecrets) {
    if (!secret) continue;
    if (text.includes(secret)) codes.add("known_secret_material");
    const encoded = Buffer.from(secret, "utf8").toString("base64");
    if (encoded.length >= 12 && text.includes(encoded)) codes.add("base64_known_secret_material");
  }
  return codes;
}

function scanChunk(state, chunk, knownSecrets) {
  const buffer = Buffer.concat([state.carry, Buffer.from(chunk)]);
  const views = [
    buffer.toString("utf8"),
    buffer.toString("latin1"),
    buffer.subarray(0, buffer.length - (buffer.length % 2)).toString("utf16le")
  ];
  if (buffer.length > 1) {
    const shifted = buffer.subarray(1);
    views.push(shifted.subarray(0, shifted.length - (shifted.length % 2)).toString("utf16le"));
  }
  for (const view of views) {
    for (const code of findingCodes(view, knownSecrets)) state.findings.add(code);
  }
  state.contentByteCount += chunk.length;
  invariant(state.contentByteCount <= state.maximumContentBytes,
    "scanned content exceeds its global byte limit");
  state.carry = buffer.subarray(Math.max(0, buffer.length - 4096));
}

function createScanState(maximumContentBytes) {
  invariant(Number.isSafeInteger(maximumContentBytes) && maximumContentBytes >= 0 &&
    maximumContentBytes <= maximumScannedContentBytes,
  "remaining scanned-content budget is invalid");
  return {
    carry: Buffer.alloc(0),
    contentByteCount: 0,
    findings: new Set(),
    maximumContentBytes
  };
}

function completedScan(state) {
  return Object.freeze({
    contentByteCount: state.contentByteCount,
    findings: Object.freeze(Array.from(state.findings).sort())
  });
}

function scanReadable(readable, knownSecrets, maximumContentBytes) {
  return new Promise((resolve, reject) => {
    const state = createScanState(maximumContentBytes);
    readable.on("data", (chunk) => {
      try {
        scanChunk(state, chunk, knownSecrets);
      } catch (error) {
        readable.destroy(error);
      }
    });
    readable.on("error", reject);
    readable.on("end", () => resolve(completedScan(state)));
  });
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  let byteCount = 0;
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => {
      hash.update(chunk);
      byteCount += chunk.length;
    });
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return Object.freeze({ byteCount, sha256: hash.digest("hex") });
}

async function scanArchiveContent(
  archiveClient,
  filePath,
  format,
  knownSecrets,
  maximumContentBytes
) {
  const state = createScanState(maximumContentBytes);
  const admission = await archiveClient.scan({
    archivePath: filePath,
    format,
    onMemberStart() {
      state.carry = Buffer.alloc(0);
    },
    onContent(chunk) {
      scanChunk(state, chunk, knownSecrets);
    },
    onMemberEnd() {
      state.carry = Buffer.alloc(0);
    }
  });
  return Object.freeze({ admission, scan: completedScan(state) });
}

async function scanArtifact(artifact, knownSecrets, archiveClient, maximumContentBytes) {
  invariant(isPlainObject(artifact), "secret-scan artifact must be an object");
  const label = String(artifact.label || "");
  invariant(/^[A-Za-z0-9][A-Za-z0-9._/+:-]{0,255}$/.test(label),
    "secret-scan artifact label is invalid");
  const filePath = path.resolve(String(artifact.path || ""));
  const stat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  invariant(stat?.isFile() && !stat.isSymbolicLink(), `secret-scan artifact ${label} is not a file`);
  const format = archiveFormatForPath(filePath);
  invariant(stat.size <= (format === null ? maximumScannedContentBytes : maximumArchiveBytes),
    `secret-scan artifact ${label} exceeds its byte limit`);
  const identity = await hashFile(filePath);
  let admission = null;
  let scan;
  if (format !== null) {
    invariant(archiveClient !== null, "archive scanner executable is required");
    const archiveResult = await scanArchiveContent(
      archiveClient,
      filePath,
      format,
      knownSecrets,
      maximumContentBytes
    );
    admission = archiveResult.admission;
    scan = archiveResult.scan;
  } else {
    invariant(identity.byteCount <= maximumContentBytes,
      "scanned content exceeds its global byte limit");
    scan = await scanReadable(
      fs.createReadStream(filePath),
      knownSecrets,
      maximumContentBytes
    );
  }
  const readback = await hashFile(filePath);
  invariant(readback.byteCount === identity.byteCount && readback.sha256 === identity.sha256,
    "artifact identity changed during secret scanning");
  if (admission !== null) {
    invariant(admission.archiveSha256 === identity.sha256,
      "archive identity changed during secret scanning");
  }
  return Object.freeze({
    archiveAdmissionProfileSha256: admission?.admissionProfileSha256 || null,
    archiveContentManifestSha256: admission?.contentManifestSha256 || null,
    archiveFormat: admission?.format || null,
    archiveMemberCount: admission?.memberCount || 0,
    archiveScanProcessProfileSha256: admission?.processProfileSha256 || null,
    byteCount: identity.byteCount,
    findings: scan.findings,
    label,
    scannedContentByteCount: scan.contentByteCount,
    sha256: identity.sha256
  });
}

function scannerSourceClosureSha256() {
  const members = scannerSourceFiles.map((file) => {
    const bytes = fs.readFileSync(path.join(__dirname, file));
    return Object.freeze({ byteCount: bytes.length, file, sha256: sha256(bytes) });
  });
  return sha256(canonicalJson(members));
}

function atomicWriteJson(filePath, value) {
  const target = path.resolve(String(filePath || ""));
  invariant(target.length > 0, "secret-scan report output is required");
  atomicReplace(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

function runtimeIdentifier() {
  const osName = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

async function scanPublicArtifacts(options) {
  invariant(isPlainObject(options), "public artifact secret-scan options are invalid");
  invariant(Array.isArray(options.artifacts) && options.artifacts.length > 0 &&
    options.artifacts.length <= maximumArtifactCount, "secret-scan artifact scope is invalid");
  const labels = options.artifacts.map((artifact) => String(artifact?.label || ""));
  invariant(new Set(labels).size === labels.length, "secret-scan artifact labels are duplicated");
  const knownSecrets = Array.isArray(options.knownSecrets)
    ? options.knownSecrets.map((value) => String(value)).filter(Boolean)
    : [];
  const scopeKind = String(options.scopeKind || "");
  invariant(/^[a-z0-9][a-z0-9._-]{2,127}$/.test(scopeKind),
    "secret-scan scope kind is invalid");
  invariant(typeof options.scopeComplete === "boolean",
    "secret-scan scope completeness is required");
  const startedAtUtc = requireUtc(options.startedAtUtc || new Date().toISOString(),
    "secret-scan start time");
  const archiveArtifactCount = options.artifacts.reduce((count, artifact) =>
    count + (isArchive(String(artifact?.path || "")) ? 1 : 0), 0);
  const archiveClient = archiveArtifactCount === 0
    ? null
    : createArchiveScanClient(options.archiveScannerExecutablePath);
  const results = [];
  let remainingContentBytes = maximumScannedContentBytes;
  for (const artifact of options.artifacts) {
    const result = await scanArtifact(
      artifact,
      knownSecrets,
      archiveClient,
      remainingContentBytes
    );
    results.push(result);
    remainingContentBytes -= result.scannedContentByteCount;
  }
  results.sort((left, right) => left.label < right.label ? -1 : left.label > right.label ? 1 : 0);
  const completedAtUtc = requireUtc(options.completedAtUtc || new Date().toISOString(),
    "secret-scan completion time");
  invariant(Date.parse(completedAtUtc) >= Date.parse(startedAtUtc),
    "secret-scan completion precedes its start");
  const secretFindingCount = results.reduce((total, result) => total + result.findings.length, 0);
  const scopeManifest = results.map((result) => Object.freeze({
    byteCount: result.byteCount,
    label: result.label,
    sha256: result.sha256
  }));
  const scopeManifestSha256 = sha256(canonicalJson(scopeManifest));
  const sourceClosureSha256 = scannerSourceClosureSha256();
  const report = Object.freeze({
    schema: reportSchema,
    startedAtUtc,
    completedAtUtc,
    status: secretFindingCount === 0 ? "pass" : "fail",
    scopeKind,
    scopeComplete: options.scopeComplete,
    scannerRuleVersion: "tinyrustlm-public-artifact-secret-rules-v1",
    scannerSourceClosureSha256: sourceClosureSha256,
    scannedArtifactCount: results.length,
    scannedInputByteCount: results.reduce((total, result) => total + result.byteCount, 0),
    scannedContentByteCount: results.reduce((total, result) => total + result.scannedContentByteCount, 0),
    archiveArtifactCount,
    archiveMemberCount: results.reduce((total, result) => total + result.archiveMemberCount, 0),
    archiveAdmissionProfileId: archiveArtifactCount === 0 ? null : archiveAdmissionProfileId,
    archiveAdmissionProfileSha256: archiveArtifactCount === 0
      ? null
      : archiveAdmissionProfileSha256,
    archiveScanProcessProfileId: archiveArtifactCount === 0
      ? null
      : archiveScanProcessProfileId,
    archiveScanProcessProfileSha256: archiveArtifactCount === 0
      ? null
      : archiveScanProcessProfileSha256,
    archiveScannerExecutableByteCount: archiveClient?.executableIdentity.byteCount || 0,
    archiveScannerExecutableSha256: archiveClient?.executableIdentity.sha256 || null,
    secretFindingCount,
    scopeManifestSha256,
    artifacts: results
  });
  const reportPath = atomicWriteJson(options.reportOutputPath, report);
  const reportBytes = fs.readFileSync(reportPath);
  const reportSha256 = sha256(reportBytes);
  const store = new CampaignEvidenceStore(options.evidenceRoot, { knownSecrets });
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "secret-scan evidence store contains quarantined files");
  const prior = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId);
  const existing = prior.find((receipt) => receipt.inputHashes.scopeManifest === scopeManifestSha256 &&
    receipt.outputHashes.scanReport === reportSha256);
  if (existing) return Object.freeze({ receipt: existing, report, reportPath });
  const superseded = new Set(prior.flatMap((receipt) => receipt.supersedesReceiptIds));
  const current = prior.filter((receipt) => !superseded.has(receipt.receiptId));
  invariant(current.length <= 1, "secret scan has several current receipts");
  const attempt = prior.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1;
  const passed = secretFindingCount === 0;
  const toolNames = ["tinyrustlm-public-artifact-secret-scan"];
  const toolVersions = ["3"];
  const toolBinaryHashes = [sourceClosureSha256];
  if (archiveClient !== null) {
    toolNames.push("tinyrustlm-archive-scan");
    toolVersions.push(archiveScanProcessProfileId);
    toolBinaryHashes.push(archiveClient.executableIdentity.sha256);
  }
  const receipt = store.putReceipt({
    receiptType,
    campaignId: options.campaignId,
    phase: "secret-scan",
    attempt,
    status: passed ? "pass" : "fail",
    createdAtUtc: startedAtUtc,
    completedAtUtc,
    inputReceiptIds: [],
    inputHashes: { scopeManifest: scopeManifestSha256 },
    outputHashes: {
      scanReport: reportSha256,
      scopeManifest: scopeManifestSha256,
      scannerSourceClosure: sourceClosureSha256,
      ...(archiveClient === null
        ? {}
        : { archiveScannerExecutable: archiveClient.executableIdentity.sha256 })
    },
    sourceRevision: options.sourceRevision,
    toolNames,
    toolVersions,
    toolBinaryHashes,
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      archiveAdmissionPerformed: archiveArtifactCount > 0,
      archiveContentDecodedAndScanned: archiveArtifactCount > 0,
      localFileReadback: true
    },
    configurationHash: sha256(canonicalJson({
      archiveAdmissionProfileSha256,
      archiveExtensions,
      archiveScanProcessProfileSha256,
      scannerRuleCodes: scannerRules.map((rule) => rule.code),
      scopeComplete: options.scopeComplete,
      scopeKind,
      utf16Scanning: true
    })),
    publicSafeParameters: {
      archiveArtifactCount: report.archiveArtifactCount,
      archiveMemberCount: report.archiveMemberCount,
      scannedArtifactCount: report.scannedArtifactCount,
      scannedContentByteCount: report.scannedContentByteCount,
      secretFindingCount: report.secretFindingCount,
      scopeComplete: report.scopeComplete,
      scopeKind: report.scopeKind
    },
    boundedDiagnostics: {
      archiveAdmissionProfileId: report.archiveAdmissionProfileId,
      archiveScanProcessProfileId: report.archiveScanProcessProfileId,
      findingCodes: Array.from(new Set(results.flatMap((result) => result.findings))).sort(),
      scannerRuleVersion: report.scannerRuleVersion
    },
    blockerCode: passed ? null : "secret_scan_findings",
    externalEvidenceReferences: [],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "package",
    supersedesReceiptIds: current.map((receipt) => receipt.receiptId),
    attestationReference: null
  }, { knownSecrets }).receipt;
  return Object.freeze({ receipt, report, reportPath });
}

module.exports = Object.freeze({
  receiptType,
  reportSchema,
  scanPublicArtifacts
});

"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");
const { atomicReplace } = require("./durable-files.js");

const reportSchema = "tinyrustlm.public_artifact_secret_scan.v2";
const receiptType = "tinyrustlm.secret-scan-v2";
const maximumArtifactCount = 4096;
const maximumArchiveEntryCount = 100_000;
const maximumScannedContentBytes = 4 * 1024 * 1024 * 1024;
const archiveExtensions = [".nupkg", ".snupkg", ".tar.gz", ".tgz", ".zip"];
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
  const lower = filePath.toLowerCase();
  return archiveExtensions.some((extension) => lower.endsWith(extension));
}

function validateArchiveEntryName(value) {
  const name = String(value || "");
  invariant(name.length > 0 && name.length <= 4096 && !name.includes("\0"),
    "archive entry name is invalid");
  invariant(!name.startsWith("/") && !name.startsWith("\\") &&
    !/^[A-Za-z]:[\\/]/.test(name), "archive entry uses an absolute path");
  const segments = name.replace(/\\/g, "/").split("/");
  invariant(!segments.some((segment) => segment === ".."),
    "archive entry attempts parent traversal");
  return name;
}

function listArchiveEntries(filePath) {
  const result = childProcess.spawnSync("tar", ["-tf", filePath], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true
  });
  invariant(!result.error && result.status === 0,
    `archive listing failed with exit ${result.status ?? "unavailable"}`);
  const entries = result.stdout.split(/\r?\n/).filter(Boolean);
  invariant(entries.length > 0 && entries.length <= maximumArchiveEntryCount,
    "archive entry count is invalid");
  for (const entry of entries) validateArchiveEntryName(entry);
  return Object.freeze(entries);
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
  invariant(state.contentByteCount <= maximumScannedContentBytes,
    "scanned content exceeds its global byte limit");
  state.carry = buffer.subarray(Math.max(0, buffer.length - 4096));
}

function scanReadable(readable, knownSecrets) {
  return new Promise((resolve, reject) => {
    const state = { carry: Buffer.alloc(0), contentByteCount: 0, findings: new Set() };
    readable.on("data", (chunk) => {
      try {
        scanChunk(state, chunk, knownSecrets);
      } catch (error) {
        readable.destroy(error);
      }
    });
    readable.on("error", reject);
    readable.on("end", () => resolve(Object.freeze({
      contentByteCount: state.contentByteCount,
      findings: Object.freeze(Array.from(state.findings).sort())
    })));
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

function scanArchiveContent(filePath, knownSecrets) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn("tar", ["-xOf", filePath], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 8192) stderr += chunk;
    });
    const scan = scanReadable(child.stdout, knownSecrets);
    child.on("error", reject);
    child.on("close", async (code) => {
      try {
        const result = await scan;
        invariant(code === 0, `archive extraction failed with exit ${code}: ${stderr.slice(0, 256)}`);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function scanArtifact(artifact, knownSecrets) {
  invariant(isPlainObject(artifact), "secret-scan artifact must be an object");
  const label = String(artifact.label || "");
  invariant(/^[A-Za-z0-9][A-Za-z0-9._/+:-]{0,255}$/.test(label),
    "secret-scan artifact label is invalid");
  const filePath = path.resolve(String(artifact.path || ""));
  const stat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  invariant(stat?.isFile() && !stat.isSymbolicLink(), `secret-scan artifact ${label} is not a file`);
  const identity = await hashFile(filePath);
  let entries = Object.freeze([]);
  let scan;
  if (isArchive(filePath)) {
    entries = listArchiveEntries(filePath);
    scan = await scanArchiveContent(filePath, knownSecrets);
  } else {
    scan = await scanReadable(fs.createReadStream(filePath), knownSecrets);
  }
  return Object.freeze({
    archiveEntryCount: entries.length,
    byteCount: identity.byteCount,
    findings: scan.findings,
    label,
    scannedContentByteCount: scan.contentByteCount,
    sha256: identity.sha256
  });
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
  const results = [];
  for (const artifact of options.artifacts) {
    results.push(await scanArtifact(artifact, knownSecrets));
  }
  results.sort((left, right) => left.label.localeCompare(right.label));
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
  const report = Object.freeze({
    schema: reportSchema,
    startedAtUtc,
    completedAtUtc,
    status: secretFindingCount === 0 ? "pass" : "fail",
    scopeKind,
    scopeComplete: options.scopeComplete,
    scannerRuleVersion: "tinyrustlm-public-artifact-secret-rules-v1",
    scannedArtifactCount: results.length,
    scannedInputByteCount: results.reduce((total, result) => total + result.byteCount, 0),
    scannedContentByteCount: results.reduce((total, result) => total + result.scannedContentByteCount, 0),
    archiveEntryCount: results.reduce((total, result) => total + result.archiveEntryCount, 0),
    archiveTraversalFindingCount: 0,
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
  const toolHash = sha256(fs.readFileSync(__filename));
  const passed = secretFindingCount === 0;
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
    outputHashes: { scanReport: reportSha256, scopeManifest: scopeManifestSha256 },
    sourceRevision: options.sourceRevision,
    toolNames: ["tinyrustlm-public-artifact-secret-scan", "libarchive-tar"],
    toolVersions: ["2", "system"],
    toolBinaryHashes: [toolHash, sha256("system-libarchive-tar")],
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: { archiveContentExtractedAndScanned: true, localFileReadback: true },
    configurationHash: sha256(canonicalJson({
      archiveExtensions,
      scannerRuleCodes: scannerRules.map((rule) => rule.code),
      scopeComplete: options.scopeComplete,
      scopeKind,
      utf16Scanning: true
    })),
    publicSafeParameters: {
      archiveEntryCount: report.archiveEntryCount,
      archiveTraversalFindingCount: report.archiveTraversalFindingCount,
      scannedArtifactCount: report.scannedArtifactCount,
      scannedContentByteCount: report.scannedContentByteCount,
      secretFindingCount: report.secretFindingCount,
      scopeComplete: report.scopeComplete,
      scopeKind: report.scopeKind
    },
    boundedDiagnostics: {
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
  scanPublicArtifacts,
  validateArchiveEntryName
});

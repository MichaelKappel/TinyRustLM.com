"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { atomicCreate, syncDirectory } = require("./durable-files.js");

const receiptSchemaVersion = 1;
const receiptIdPrefix = "sha256:";
const maximumReceiptBytes = 256 * 1024;
const redactedValue = "[REDACTED]";
const privatePathValue = "<private-path>";
const credentialUrlValue = "[REDACTED-URL]";

const inputFields = new Set([
  "receiptType",
  "campaignId",
  "phase",
  "attempt",
  "status",
  "createdAtUtc",
  "completedAtUtc",
  "inputReceiptIds",
  "inputHashes",
  "outputHashes",
  "sourceRevision",
  "toolNames",
  "toolVersions",
  "toolBinaryHashes",
  "runtimeIdentifier",
  "operatingSystem",
  "architecture",
  "hardwareEvidence",
  "configurationHash",
  "publicSafeParameters",
  "boundedDiagnostics",
  "blockerCode",
  "externalEvidenceReferences",
  "redactionVersion",
  "evidenceClass",
  "supersedesReceiptIds",
  "attestationReference"
]);
const persistedFields = new Set([
  "schemaVersion",
  "receiptId",
  "receiptContentHash",
  ...inputFields
]);
const receiptStatuses = new Set([
  "pass",
  "fail",
  "blocked",
  "rejected",
  "stale",
  "superseded"
]);
const evidenceClasses = new Set([
  "fixture",
  "local",
  "browser",
  "live-service",
  "outside-network",
  "target-platform",
  "package",
  "deployment"
]);
const sensitiveFieldPattern = /^(?:authorization|authorizationHeader|bearer|bearerToken|token|agentToken|apiKey|privateKey|password|secret|enrollmentUrl|invitationUrl|workspaceKey|credential|credentials|rawPrompt|promptText|rawOutput|modelBytes)$/i;
const publicIdentifierFieldPattern = /^(?:modelId|sourceModelId)$/i;
const sensitiveQueryPattern = /^(?:access_token|api_key|apikey|authorization|bearer|code|credential|invite|invitation|key|password|secret|token)$/i;
const receiptIdPattern = /^sha256:[a-f0-9]{64}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const safeNamePattern = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,255}$/;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

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

function canonicalJson(value, active = new Set()) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    invariant(Number.isFinite(value), "canonical JSON numbers must be finite");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    invariant(!active.has(value), "canonical JSON cannot contain a cycle");
    active.add(value);
    try {
      for (let index = 0; index < value.length; index += 1) {
        invariant(Object.hasOwn(value, index), "canonical JSON arrays cannot contain holes");
      }
      return `[${value.map((entry) => canonicalJson(entry, active)).join(",")}]`;
    } finally {
      active.delete(value);
    }
  }
  invariant(isPlainObject(value), "canonical JSON values must be plain JSON objects");
  invariant(!active.has(value), "canonical JSON cannot contain a cycle");
  active.add(value);
  try {
    return `{${Object.keys(value).sort().map((key) => {
      invariant(value[key] !== undefined, "canonical JSON cannot contain undefined");
      return `${JSON.stringify(key)}:${canonicalJson(value[key], active)}`;
    }).join(",")}}`;
  } finally {
    active.delete(value);
  }
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function shannonEntropy(value) {
  const counts = new Map();
  for (const character of value) {
    counts.set(character, (counts.get(character) || 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function looksLikePrivatePath(value) {
  return /^[A-Za-z]:[\\/]/.test(value) ||
    /^\\\\[^\\]+\\[^\\]+/.test(value) ||
    /^\/(?:home|Users|root|tmp|private|var\/tmp|workspace|workspaces|opt|srv|data)\//.test(value) ||
    /^\/mnt\/[A-Za-z]\//.test(value);
}

function hasCredentialUrl(value) {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      return true;
    }
    for (const key of parsed.searchParams.keys()) {
      if (sensitiveQueryPattern.test(key)) {
        return true;
      }
    }
    return false;
  } catch (_error) {
    return true;
  }
}

function looksLikeHighEntropySecret(value) {
  if (value.length < 32 || value.length > 4096) {
    return false;
  }
  if (/^(?:sha256:)?[a-f0-9]{40,128}$/i.test(value) ||
      /^[A-Za-z0-9._:/-]+\.v\d+$/i.test(value)) {
    return false;
  }
  if (!/^[A-Za-z0-9+/_=-]+$/.test(value)) {
    return false;
  }
  return shannonEntropy(value) >= 4.35;
}

function redactString(value, knownSecrets) {
  let result = value;
  for (const secret of knownSecrets) {
    if (secret && result.includes(secret)) {
      result = result.split(secret).join(redactedValue);
    }
  }
  if (/\bBearer\s+[A-Za-z0-9._~+/-]{8,}/i.test(result) ||
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(result)) {
    return redactedValue;
  }
  if (hasCredentialUrl(result)) {
    return credentialUrlValue;
  }
  if (looksLikePrivatePath(result)) {
    return privatePathValue;
  }
  if (looksLikeHighEntropySecret(result)) {
    return redactedValue;
  }
  return result;
}

// Model identities are public provenance, so silently replacing one with a
// shared redaction marker would destroy receipt identity. Validate them as
// identifiers and reject known-secret contamination instead.
function publicIdentifier(value, knownSecrets, fieldName) {
  if (value === redactedValue) return value; // Read legacy v1 receipts.
  invariant(safeNamePattern.test(value), `${fieldName} is not a safe public identifier`);
  invariant(!value.includes("//") && value.split("/").every((part) => part !== "." && part !== ".."),
    `${fieldName} contains an invalid segment`);
  invariant(!looksLikePrivatePath(value), `${fieldName} contains a private path`);
  for (const secret of knownSecrets) {
    invariant(!secret || !value.includes(secret), `${fieldName} contains a known secret`);
  }
  return value;
}

function redactPublicValue(value, options = {}, fieldName = "") {
  const knownSecrets = Array.isArray(options.knownSecrets)
    ? options.knownSecrets.map((entry) => String(entry)).filter(Boolean)
    : [];
  if (sensitiveFieldPattern.test(fieldName)) {
    return redactedValue;
  }
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    invariant(Number.isFinite(value), "public receipt values must be finite");
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "string") {
    if (publicIdentifierFieldPattern.test(fieldName)) {
      return publicIdentifier(value, knownSecrets, fieldName);
    }
    return redactString(value, knownSecrets);
  }
  if (Array.isArray(value)) {
    invariant(value.length <= 1024, "public receipt arrays exceed their limit");
    return value.map((entry) => redactPublicValue(entry, options, fieldName));
  }
  invariant(isPlainObject(value), "public receipt values must be plain JSON values");
  const keys = Object.keys(value);
  invariant(keys.length <= 1024, "public receipt objects exceed their field limit");
  const result = {};
  for (const key of keys) {
    invariant(key.length > 0 && key.length <= 128, "public receipt field name is invalid");
    result[key] = redactPublicValue(value[key], options, key);
  }
  return result;
}

function boundedString(value, label, minimum = 1, maximum = 256) {
  const result = String(value ?? "");
  invariant(result.length >= minimum && result.length <= maximum, `${label} is invalid`);
  invariant(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(result), `${label} contains controls`);
  return result;
}

function normalizedUtc(value, label) {
  const result = boundedString(value, label, 20, 40);
  invariant(utcPattern.test(result) && Number.isFinite(Date.parse(result)), `${label} must be ISO-8601 UTC`);
  return result;
}

function normalizedStringArray(value, label, pattern, maximum = 256, requireUnique = true) {
  invariant(Array.isArray(value) && value.length <= maximum, `${label} must be a bounded array`);
  const result = value.map((entry) => boundedString(entry, label, 1, 1024));
  if (pattern) {
    for (const entry of result) {
      invariant(pattern.test(entry), `${label} contains an invalid value`);
    }
  }
  if (requireUnique) {
    invariant(new Set(result).size === result.length, `${label} contains duplicates`);
  }
  return result;
}

function normalizedHashes(value, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const result = {};
  const keys = Object.keys(value).sort();
  invariant(keys.length <= 256, `${label} exceeds its field limit`);
  for (const key of keys) {
    invariant(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(key), `${label} has an invalid key`);
    const hash = String(value[key] || "").toLowerCase();
    invariant(sha256Pattern.test(hash), `${label}.${key} must be SHA-256`);
    result[key] = hash;
  }
  return result;
}

function receiptBody(input, options = {}) {
  invariant(isPlainObject(input), "receipt input must be a plain object");
  for (const key of Object.keys(input)) {
    invariant(inputFields.has(key), `unknown receipt field: ${key}`);
  }
  for (const key of inputFields) {
    invariant(Object.hasOwn(input, key), `receipt is missing field: ${key}`);
  }

  const receiptType = boundedString(input.receiptType, "receiptType", 3, 128);
  const campaignId = boundedString(input.campaignId, "campaignId", 3, 160);
  const phase = boundedString(input.phase, "phase", 3, 128);
  invariant(safeNamePattern.test(receiptType), "receiptType is invalid");
  invariant(safeNamePattern.test(campaignId), "campaignId is invalid");
  invariant(safeNamePattern.test(phase), "phase is invalid");
  invariant(Number.isSafeInteger(input.attempt) && input.attempt >= 1 && input.attempt <= 1_000_000,
    "attempt is invalid");
  invariant(receiptStatuses.has(input.status), "status is invalid");
  const createdAtUtc = normalizedUtc(input.createdAtUtc, "createdAtUtc");
  const completedAtUtc = normalizedUtc(input.completedAtUtc, "completedAtUtc");
  invariant(Date.parse(completedAtUtc) >= Date.parse(createdAtUtc), "receipt completion precedes creation");
  const inputReceiptIds = normalizedStringArray(input.inputReceiptIds, "inputReceiptIds", receiptIdPattern);
  const supersedesReceiptIds = normalizedStringArray(
    input.supersedesReceiptIds,
    "supersedesReceiptIds",
    receiptIdPattern
  );
  const toolNames = normalizedStringArray(input.toolNames, "toolNames", safeNamePattern, 64);
  const toolVersions = normalizedStringArray(input.toolVersions, "toolVersions", null, 64, false);
  const toolBinaryHashes = normalizedStringArray(
    input.toolBinaryHashes, "toolBinaryHashes", sha256Pattern, 64, false);
  invariant(toolNames.length === toolVersions.length && toolNames.length === toolBinaryHashes.length,
    "tool identity arrays must have equal lengths");
  const configurationHash = String(input.configurationHash || "").toLowerCase();
  invariant(sha256Pattern.test(configurationHash), "configurationHash must be SHA-256");
  invariant(evidenceClasses.has(input.evidenceClass), "evidenceClass is invalid");
  const blockerCode = input.blockerCode === null
    ? null
    : boundedString(input.blockerCode, "blockerCode", 3, 160);
  if (blockerCode !== null) {
    invariant(/^[a-z0-9][a-z0-9._:-]{2,159}$/.test(blockerCode), "blockerCode is invalid");
  }
  const externalEvidenceReferences = normalizedStringArray(
    redactPublicValue(input.externalEvidenceReferences, options),
    "externalEvidenceReferences",
    null,
    256
  );
  const attestationReference = input.attestationReference === null
    ? null
    : redactString(boundedString(input.attestationReference, "attestationReference", 3, 1024), options.knownSecrets || []);

  return {
    schemaVersion: receiptSchemaVersion,
    receiptType,
    campaignId,
    phase,
    attempt: input.attempt,
    status: input.status,
    createdAtUtc,
    completedAtUtc,
    inputReceiptIds,
    inputHashes: normalizedHashes(input.inputHashes, "inputHashes"),
    outputHashes: normalizedHashes(input.outputHashes, "outputHashes"),
    sourceRevision: boundedString(input.sourceRevision, "sourceRevision", 1, 256),
    toolNames,
    toolVersions,
    toolBinaryHashes: toolBinaryHashes.map((entry) => entry.toLowerCase()),
    runtimeIdentifier: boundedString(input.runtimeIdentifier, "runtimeIdentifier", 1, 128),
    operatingSystem: boundedString(input.operatingSystem, "operatingSystem", 1, 128),
    architecture: boundedString(input.architecture, "architecture", 1, 128),
    hardwareEvidence: redactPublicValue(input.hardwareEvidence, options),
    configurationHash,
    publicSafeParameters: redactPublicValue(input.publicSafeParameters, options),
    boundedDiagnostics: redactPublicValue(input.boundedDiagnostics, options),
    blockerCode,
    externalEvidenceReferences,
    redactionVersion: boundedString(input.redactionVersion, "redactionVersion", 3, 128),
    evidenceClass: input.evidenceClass,
    supersedesReceiptIds,
    attestationReference
  };
}

function finalizedReceipt(input, options = {}) {
  const body = receiptBody(input, options);
  const receiptContentHash = sha256Text(canonicalJson(body));
  return Object.freeze({
    ...body,
    receiptId: `${receiptIdPrefix}${receiptContentHash}`,
    receiptContentHash
  });
}

function validateReceipt(value, options = {}) {
  invariant(isPlainObject(value), "receipt must be a plain object");
  for (const key of Object.keys(value)) {
    invariant(persistedFields.has(key), `unknown receipt field: ${key}`);
  }
  for (const key of persistedFields) {
    invariant(Object.hasOwn(value, key), `receipt is missing field: ${key}`);
  }
  invariant(value.schemaVersion === receiptSchemaVersion, "receipt schema version is unsupported");
  invariant(receiptIdPattern.test(String(value.receiptId || "")), "receiptId is invalid");
  invariant(sha256Pattern.test(String(value.receiptContentHash || "")), "receiptContentHash is invalid");
  const input = {};
  for (const key of inputFields) {
    input[key] = value[key];
  }
  const normalized = finalizedReceipt(input, options);
  invariant(canonicalJson(normalized) === canonicalJson(value), "receipt is not canonical or requires redaction");
  invariant(normalized.receiptId === value.receiptId, "receipt identity hash mismatch");
  invariant(normalized.receiptContentHash === value.receiptContentHash, "receipt content hash mismatch");
  return normalized;
}

function validateAcyclicGraph(nodes) {
  invariant(nodes instanceof Map, "receipt graph must be a Map");
  const visiting = new Set();
  const visited = new Set();
  const visit = (receiptId) => {
    if (visited.has(receiptId)) {
      return;
    }
    invariant(!visiting.has(receiptId), `receipt parent cycle detected at ${receiptId}`);
    const receipt = nodes.get(receiptId);
    invariant(receipt, `parent receipt is missing: ${receiptId}`);
    visiting.add(receiptId);
    for (const parentId of receipt.inputReceiptIds || []) {
      invariant(nodes.has(parentId), `parent receipt is missing: ${parentId}`);
      visit(parentId);
    }
    visiting.delete(receiptId);
    visited.add(receiptId);
  };
  for (const receiptId of nodes.keys()) {
    visit(receiptId);
  }
  return true;
}

function walkFiles(root) {
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    return [];
  }
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(target);
      } else {
        files.push(target);
      }
    }
  }
  return files.sort();
}

class CampaignEvidenceStore {
  constructor(rootPath, options = {}) {
    invariant(String(rootPath || "").trim().length > 0, "evidence store root is required");
    this.rootPath = path.resolve(rootPath);
    this.receiptsPath = path.join(this.rootPath, "receipts", "sha256");
    this.quarantinePath = path.join(this.rootPath, "quarantine");
    this.options = Object.freeze({
      knownSecrets: Array.isArray(options.knownSecrets)
        ? options.knownSecrets.map((entry) => String(entry)).filter(Boolean)
        : []
    });
    this.receipts = new Map();
    this.loaded = false;
  }

  receiptPath(receiptId) {
    invariant(receiptIdPattern.test(String(receiptId || "")), "receiptId is invalid");
    const hash = receiptId.slice(receiptIdPrefix.length);
    return path.join(this.receiptsPath, hash.slice(0, 2), `${hash}.json`);
  }

  quarantine(filePath, reason, quarantined) {
    fs.mkdirSync(this.quarantinePath, { recursive: true });
    const safeReason = String(reason || "invalid-receipt")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .slice(0, 80) || "invalid-receipt";
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${safeReason}-${path.basename(filePath)}`;
    const target = path.join(this.quarantinePath, name);
    fs.renameSync(filePath, target);
    syncDirectory(this.quarantinePath);
    quarantined.push(Object.freeze({ source: filePath, target, reason: safeReason }));
  }

  rebuild() {
    fs.mkdirSync(this.receiptsPath, { recursive: true });
    fs.mkdirSync(this.quarantinePath, { recursive: true });
    const quarantined = [];
    const candidates = new Map();
    const candidatePaths = new Map();
    for (const filePath of walkFiles(this.receiptsPath)) {
      if (filePath.endsWith(".tmp")) {
        this.quarantine(filePath, "incomplete-temporary", quarantined);
        continue;
      }
      if (!filePath.endsWith(".json")) {
        this.quarantine(filePath, "unexpected-file", quarantined);
        continue;
      }
      try {
        const stat = fs.statSync(filePath);
        invariant(stat.size > 0 && stat.size <= maximumReceiptBytes, "receipt size is invalid");
        const receipt = validateReceipt(JSON.parse(fs.readFileSync(filePath, "utf8")), this.options);
        invariant(path.resolve(filePath) === path.resolve(this.receiptPath(receipt.receiptId)),
          "receipt path does not match its identity");
        invariant(!candidates.has(receipt.receiptId), "duplicate receipt identity");
        candidates.set(receipt.receiptId, receipt);
        candidatePaths.set(receipt.receiptId, filePath);
      } catch (error) {
        this.quarantine(filePath, error && error.message, quarantined);
      }
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const [receiptId, receipt] of Array.from(candidates.entries())) {
        const missingParent = receipt.inputReceiptIds.find((parentId) => !candidates.has(parentId));
        if (missingParent) {
          this.quarantine(candidatePaths.get(receiptId), "missing-parent", quarantined);
          candidates.delete(receiptId);
          candidatePaths.delete(receiptId);
          changed = true;
        }
      }
    }

    try {
      validateAcyclicGraph(candidates);
    } catch (error) {
      for (const [receiptId, filePath] of candidatePaths.entries()) {
        this.quarantine(filePath, "parent-cycle", quarantined);
        candidates.delete(receiptId);
      }
    }
    this.receipts = candidates;
    this.loaded = true;
    return Object.freeze({
      receipts: Object.freeze(Array.from(candidates.values()).sort((left, right) =>
        left.receiptId.localeCompare(right.receiptId))),
      quarantined: Object.freeze(quarantined)
    });
  }

  ensureLoaded() {
    if (!this.loaded) {
      this.rebuild();
    }
  }

  putReceipt(input) {
    this.ensureLoaded();
    const receipt = finalizedReceipt(input, this.options);
    for (const parentId of receipt.inputReceiptIds) {
      invariant(this.receipts.has(parentId), `parent receipt is missing: ${parentId}`);
    }
    for (const supersededId of receipt.supersedesReceiptIds) {
      invariant(this.receipts.has(supersededId), `superseded receipt is missing: ${supersededId}`);
    }
    const filePath = this.receiptPath(receipt.receiptId);
    const payload = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    invariant(payload.length <= maximumReceiptBytes, "receipt exceeds its size limit");
    const existed = fs.existsSync(filePath);
    atomicCreate(filePath, payload);
    const reopened = validateReceipt(JSON.parse(fs.readFileSync(filePath, "utf8")), this.options);
    invariant(reopened.receiptId === receipt.receiptId, "reopened receipt identity changed");
    this.receipts.set(receipt.receiptId, reopened);
    validateAcyclicGraph(this.receipts);
    return Object.freeze({ receipt: reopened, path: filePath, reused: existed });
  }

  readReceipt(receiptId) {
    this.ensureLoaded();
    const receipt = this.receipts.get(receiptId);
    return receipt ? Object.freeze({ ...receipt }) : null;
  }

  listReceipts(predicate = null) {
    this.ensureLoaded();
    const receipts = Array.from(this.receipts.values()).sort((left, right) =>
      left.receiptId.localeCompare(right.receiptId));
    return Object.freeze(predicate ? receipts.filter(predicate) : receipts);
  }
}

module.exports = Object.freeze({
  CampaignEvidenceStore,
  canonicalJson,
  evidenceClasses: Object.freeze(Array.from(evidenceClasses)),
  finalizedReceipt,
  receiptSchemaVersion,
  redactPublicValue,
  validateAcyclicGraph,
  validateReceipt
});

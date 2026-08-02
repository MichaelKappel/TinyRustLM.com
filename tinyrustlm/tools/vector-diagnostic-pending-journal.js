"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate, syncDirectory } = require("./durable-files.js");

const pendingSchema = "tinyrustlm.vector_diagnostic_pending_attempt.v1";
const maximumPendingBytes = 64 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const identityPattern = /^[a-z0-9][a-z0-9-]{2,95}$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(
    actual.length === expected.length &&
      actual.every((key, index) => key === expected[index]),
    `${label} fields are invalid`
  );
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalPrettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function publicSafe(value) {
  invariant(
    !forbiddenTextPattern.test(JSON.stringify(value)),
    "pending attempt contains private or secret text"
  );
}

function pendingIdentity(value) {
  const body = { ...value };
  delete body.pendingAttemptId;
  delete body.pendingAttemptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `${value.diagnosticId}-pending-${hash.slice(0, 16)}`,
    hash
  });
}

function finalizePendingAttempt(body) {
  const identity = pendingIdentity(body);
  return Object.freeze({
    ...body,
    pendingAttemptId: identity.id,
    pendingAttemptContentHash: identity.hash
  });
}

function validatePendingAttempt(value) {
  exactKeys(value, [
    "schema", "diagnosticId", "attemptOrdinal", "sourceRevision",
    "preregistrationSha256", "startedAtUtc", "maximumProcessInvocationCount",
    "processInvocationCountAtJournalWrite", "setupStartedAtJournalWrite",
    "pendingAttemptId", "pendingAttemptContentHash"
  ], "pending attempt");
  invariant(value.schema === pendingSchema, "pending attempt schema is invalid");
  invariant(identityPattern.test(value.diagnosticId), "pending diagnosticId is invalid");
  invariant(value.attemptOrdinal === 1, "pending attempt ordinal is invalid");
  invariant(
    revisionPattern.test(value.sourceRevision) &&
      sha256Pattern.test(value.preregistrationSha256) &&
      utcPattern.test(value.startedAtUtc) &&
      Number.isFinite(Date.parse(value.startedAtUtc)),
    "pending attempt identity is invalid"
  );
  invariant(
    value.maximumProcessInvocationCount === 1 &&
      value.processInvocationCountAtJournalWrite === 0 &&
      value.setupStartedAtJournalWrite === false,
    "pending attempt ordering boundary is invalid"
  );
  const identity = pendingIdentity(value);
  invariant(
    value.pendingAttemptId === identity.id &&
      value.pendingAttemptContentHash === identity.hash,
    "pending attempt content identity is invalid"
  );
  publicSafe(value);
  return value;
}

function boundedPendingFile(filePath) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maximumPendingBytes,
    "pending attempt file is invalid"
  );
  return stat;
}

function loadPendingAttempt(filePath) {
  boundedPendingFile(filePath);
  const bytes = fs.readFileSync(filePath);
  const pending = validatePendingAttempt(JSON.parse(bytes.toString("utf8")));
  invariant(
    bytes.equals(canonicalPrettyBytes(pending)),
    "pending attempt bytes are not canonical"
  );
  return Object.freeze({
    pending,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
}

function createPendingAttempt(filePath, body) {
  invariant(path.isAbsolute(filePath), "pending attempt path must be absolute");
  invariant(!fs.existsSync(filePath), "pending attempt already exists");
  const parent = path.dirname(filePath);
  const parentStat = fs.lstatSync(parent);
  invariant(
    parentStat.isDirectory() && !parentStat.isSymbolicLink(),
    "pending attempt parent is invalid"
  );
  const pending = finalizePendingAttempt(body);
  validatePendingAttempt(pending);
  atomicCreate(filePath, canonicalPrettyBytes(pending));
  const reopened = loadPendingAttempt(filePath);
  invariant(
    reopened.pending.pendingAttemptContentHash ===
      pending.pendingAttemptContentHash,
    "written pending attempt identity changed"
  );
  return reopened;
}

function removePendingAttempt(filePath, expectedPending) {
  const reopened = loadPendingAttempt(filePath);
  invariant(
    reopened.pending.pendingAttemptContentHash ===
      expectedPending.pendingAttemptContentHash,
    "pending attempt removal identity changed"
  );
  fs.rmSync(filePath, { force: false });
  syncDirectory(path.dirname(filePath));
  invariant(!fs.existsSync(filePath), "pending attempt deletion failed");
}

async function runAfterPendingAttempt(filePath, body, operation) {
  invariant(typeof operation === "function", "pending operation is invalid");
  const reopened = createPendingAttempt(filePath, body);
  return operation(reopened.pending);
}

module.exports = Object.freeze({
  createPendingAttempt,
  finalizePendingAttempt,
  loadPendingAttempt,
  pendingIdentity,
  pendingSchema,
  removePendingAttempt,
  runAfterPendingAttempt,
  validatePendingAttempt
});

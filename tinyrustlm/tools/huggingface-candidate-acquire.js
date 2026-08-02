"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const inventorySchema = "tinyrustlm.huggingface_supported_candidate_inventory.v2";
const receiptSchema = "tinyrustlm.huggingface_source_acquisition.v2";
const defaultBaseUrl = "https://huggingface.co";
const maximumSmallFileBytes = 32 * 1024 * 1024;
const maximumReceiptBytes = 128 * 1024;
const defaultDownloadTimeoutMs = 4 * 60 * 60 * 1000;
const maximumShortReadRetries = 3;

// Raises a stable error when source acquisition evidence violates its contract.
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

// Returns true only for ordinary JSON objects.
function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Accepts a credential-free HTTPS origin or loopback HTTP used in tests.
function normalizeBaseUrl(value) {
  const url = new URL(String(value || defaultBaseUrl));
  const loopback = url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  invariant(url.protocol === "https:" || loopback, "source base URL must use HTTPS");
  invariant(!url.username && !url.password && !url.search && !url.hash,
    "source base URL must not contain credentials");
  return url.origin;
}

// Accepts a credential-free HTTPS or loopback evidence URL.
function normalizeEvidenceUrl(value) {
  const url = new URL(String(value || ""));
  const loopback = url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  invariant(url.protocol === "https:" || loopback, "evidence URL must use HTTPS");
  invariant(!url.username && !url.password && !url.hash, "evidence URL must not contain credentials");
  return url.toString();
}

// Validates one source filename that must remain in the candidate root.
function requireFilename(value) {
  const filename = String(value || "").trim();
  invariant(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(filename), "source filename is invalid");
  invariant(filename !== "." && filename !== "..", "source filename is invalid");
  return filename;
}

// Validates a digest-bearing source candidate from the discovery inventory.
function requireCandidate(value) {
  invariant(isPlainObject(value), "candidate is invalid");
  const modelId = String(value.modelId || "").trim();
  invariant(/^[A-Za-z0-9._-]{1,96}\/[A-Za-z0-9._-]{1,160}$/.test(modelId), "candidate modelId is invalid");
  const revision = String(value.revision || "").toLowerCase();
  invariant(/^[a-f0-9]{40,64}$/.test(revision), "candidate revision is not immutable");
  const sourceTemplate = String(value.sourceTemplate || "");
  invariant(/^[a-z0-9][a-z0-9.-]{2,95}$/.test(sourceTemplate), "candidate sourceTemplate is invalid");
  invariant(value.licenseId === "apache-2.0", "candidate license is not supported");
  invariant(value.licenseEvidenceKind === "revision-metadata-plus-apache-authority-text",
    "candidate license evidence is invalid");
  const licenseSourceUrl = normalizeEvidenceUrl(value.licenseSourceUrl);
  const licenseSha256 = String(value.licenseSha256 || "").toLowerCase();
  const configSha256 = String(value.configSha256 || "").toLowerCase();
  const weightIdentity = String(value.weightIdentity || "").toLowerCase();
  for (const [label, digest] of [
    ["licenseSha256", licenseSha256],
    ["configSha256", configSha256],
    ["weightIdentity", weightIdentity]
  ]) {
    invariant(/^[a-f0-9]{64}$/.test(digest), `candidate ${label} is invalid`);
  }
  invariant(isPlainObject(value.tokenizer), "candidate tokenizer is invalid");
  const tokenizer = requireSourceFile(value.tokenizer, "tokenizer");
  invariant(isPlainObject(value.tokenizerConfig), "candidate tokenizerConfig is invalid");
  const tokenizerConfig = requireSourceFile(value.tokenizerConfig, "tokenizerConfig");
  invariant(value.chatTemplateKind === "revision-chatml-template-v1",
    "candidate chat template kind is invalid");
  const chatTemplateSha256 = String(value.chatTemplateSha256 || "").toLowerCase();
  invariant(/^[a-f0-9]{64}$/.test(chatTemplateSha256),
    "candidate chatTemplateSha256 is invalid");
  invariant(Array.isArray(value.weightFiles) && value.weightFiles.length >= 1 && value.weightFiles.length <= 64,
    "candidate weightFiles are invalid");
  const weightFiles = value.weightFiles.map((file) => requireSourceFile(file, "weight"));
  invariant(weightFiles.every((file) => file.sha256), "every weight requires SHA-256");
  const sourceWeightByteCount = Number(value.sourceWeightByteCount);
  invariant(Number.isSafeInteger(sourceWeightByteCount) && sourceWeightByteCount > 0 &&
    weightFiles.reduce((sum, file) => sum + file.byteCount, 0) === sourceWeightByteCount,
  "candidate sourceWeightByteCount is invalid");
  return Object.freeze({
    sourceTemplate,
    modelId,
    revision,
    licenseId: value.licenseId,
    licenseEvidenceKind: value.licenseEvidenceKind,
    licenseSourceUrl,
    licenseSha256,
    configSha256,
    tokenizer,
    tokenizerConfig,
    chatTemplateKind: value.chatTemplateKind,
    chatTemplateSha256,
    sourceWeightByteCount,
    weightIdentity,
    weightFiles: Object.freeze(weightFiles)
  });
}

// Validates one expected repository file identity.
function requireSourceFile(value, label) {
  invariant(isPlainObject(value), `candidate ${label} file is invalid`);
  const filename = requireFilename(value.filename);
  const byteCount = Number(value.byteCount);
  invariant(Number.isSafeInteger(byteCount) && byteCount > 0 && byteCount <= 8 * 1024 * 1024 * 1024,
    `candidate ${label} byteCount is invalid`);
  const sha256 = value.sha256 === null || value.sha256 === undefined
    ? null
    : String(value.sha256).toLowerCase();
  const gitBlobId = value.gitBlobId === null || value.gitBlobId === undefined
    ? null
    : String(value.gitBlobId).toLowerCase();
  invariant((sha256 && /^[a-f0-9]{64}$/.test(sha256)) || (gitBlobId && /^[a-f0-9]{40}$/.test(gitBlobId)),
    `candidate ${label} content identity is invalid`);
  return Object.freeze({ filename, byteCount, sha256, gitBlobId });
}

// Maps one immutable candidate to an owned, path-safe source directory.
function candidateDirectory(outputRoot, candidateValue) {
  const candidate = requireCandidate(candidateValue);
  const root = path.resolve(String(outputRoot || ""));
  invariant(String(outputRoot || "").trim().length > 0, "output root is required");
  const slug = `${candidate.modelId.replace("/", "--")}--${candidate.revision}`;
  const target = path.resolve(root, slug);
  invariant(target.startsWith(`${root}${path.sep}`), "candidate directory escaped the output root");
  return target;
}

// Builds a revision-pinned Hugging Face file URL.
function pinnedFileUrl(baseUrl, candidate, filename) {
  const modelPath = candidate.modelId.split("/").map(encodeURIComponent).join("/");
  return `${normalizeBaseUrl(baseUrl)}/${modelPath}/resolve/${candidate.revision}/${encodeURIComponent(requireFilename(filename))}`;
}

// Streams a file into SHA-256 without loading model bytes into memory.
async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

// Computes the Git blob identity used when a small repository file is not LFS-backed.
async function gitBlobIdFile(filePath, byteCount) {
  const hash = crypto.createHash("sha1");
  hash.update(`blob ${byteCount}\0`);
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

// Verifies exact size and every advertised identity for one local source file.
async function verifyExpectedFile(filePath, expected) {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  invariant(stat && stat.isFile(), `${expected.filename} is missing`);
  invariant(stat.size === expected.byteCount, `${expected.filename} byte count mismatch`);
  const sha256 = await sha256File(filePath);
  if (expected.sha256) {
    invariant(sha256 === expected.sha256, `${expected.filename} SHA-256 mismatch`);
  }
  if (expected.gitBlobId) {
    invariant(await gitBlobIdFile(filePath, stat.size) === expected.gitBlobId,
      `${expected.filename} Git blob identity mismatch`);
  }
  return Object.freeze({ filename: expected.filename, byteCount: stat.size, sha256 });
}

// Revalidates the revision-owned ChatML template against the inventory fingerprint.
function verifyChatTemplate(directory, candidate) {
  const filePath = path.join(directory, candidate.tokenizerConfig.filename);
  const bytes = fs.readFileSync(filePath);
  invariant(bytes.length > 0 && bytes.length <= maximumSmallFileBytes,
    "tokenizer_config.json is oversized");
  let config;
  try {
    config = JSON.parse(bytes.toString("utf8"));
  } catch (_error) {
    throw new Error("tokenizer_config.json is invalid JSON");
  }
  const template = config && config.chat_template;
  invariant(typeof template === "string" && template.length >= 32 && template.length <= 256 * 1024,
    "tokenizer_config.json chat template is invalid");
  invariant(template.includes("<|im_start|>") && template.includes("<|im_end|>") &&
    (template.includes("message.role") || template.includes("message['role']") ||
      template.includes('message["role"]')),
  "tokenizer_config.json chat template is not ChatML compatible");
  invariant(crypto.createHash("sha256").update(template).digest("hex") === candidate.chatTemplateSha256,
    "tokenizer_config.json chat template fingerprint mismatch");
}

// Flushes a completed part file before its final verification and promotion.
function syncFile(filePath) {
  const descriptor = fs.openSync(filePath, "r+");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

// Downloads one large pinned file with strict Range-resume semantics.
async function downloadExpectedFile(url, directory, expected, settings, allowRestart = true,
  shortReadRetriesRemaining = maximumShortReadRetries) {
  const target = path.join(directory, expected.filename);
  if (fs.existsSync(target)) {
    return verifyExpectedFile(target, expected);
  }
  const part = `${target}.part`;
  const partStat = fs.statSync(part, { throwIfNoEntry: false });
  invariant(!partStat || partStat.isFile(), `${expected.filename} part path is invalid`);
  const start = partStat ? partStat.size : 0;
  invariant(start <= expected.byteCount, `${expected.filename} partial byte count exceeds expected size`);
  if (start === expected.byteCount) {
    let verified;
    try {
      verified = await verifyExpectedFile(part, expected);
    } catch (error) {
      fs.rmSync(part, { force: true });
      throw error;
    }
    fs.renameSync(part, target);
    return verified;
  }
  const headers = start > 0 ? { Range: `bytes=${start}-` } : {};
  const response = await settings.fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    headers,
    signal: AbortSignal.timeout(settings.timeoutMs)
  });
  invariant(response && response.ok, `${expected.filename} returned HTTP ${response ? response.status : "unknown"}`);
  if (start > 0 && response.status === 200) {
    invariant(allowRestart, `${expected.filename} server ignored Range twice`);
    if (response.body && typeof response.body.cancel === "function") await response.body.cancel();
    fs.rmSync(part, { force: true });
    return downloadExpectedFile(
      url, directory, expected, settings, false, shortReadRetriesRemaining);
  }
  invariant(start === 0 ? response.status === 200 : response.status === 206,
    `${expected.filename} returned invalid resume status`);
  if (start > 0) {
    const contentRange = String(response.headers.get("content-range") || "");
    invariant(contentRange.startsWith(`bytes ${start}-`), `${expected.filename} Content-Range mismatch`);
  }
  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  const contentEncoding = String(response.headers.get("content-encoding") || "identity").toLowerCase();
  if (Number.isSafeInteger(contentLength) && (contentEncoding === "" || contentEncoding === "identity")) {
    invariant(contentLength === expected.byteCount - start, `${expected.filename} Content-Length mismatch`);
  }
  invariant(response.body, `${expected.filename} response body is missing`);
  await pipeline(
    Readable.fromWeb(response.body),
    fs.createWriteStream(part, { flags: start > 0 ? "a" : "w", mode: 0o600 })
  );
  syncFile(part);
  const completedSize = fs.statSync(part).size;
  if (completedSize < expected.byteCount) {
    if (shortReadRetriesRemaining > 0) {
      return downloadExpectedFile(
        url,
        directory,
        expected,
        settings,
        allowRestart,
        shortReadRetriesRemaining - 1
      );
    }
    throw new Error(
      `${expected.filename} download ended early at ${completedSize} of ${expected.byteCount} bytes`);
  }
  if (completedSize > expected.byteCount) {
    fs.rmSync(part, { force: true });
    throw new Error(`${expected.filename} download exceeded its expected byte count`);
  }
  let verified;
  try {
    verified = await verifyExpectedFile(part, expected);
  } catch (error) {
    fs.rmSync(part, { force: true });
    throw error;
  }
  fs.renameSync(part, target);
  return verified;
}

// Fetches, bounds, hashes, and atomically writes one small evidence file.
async function downloadSmallFile(url, target, expectedSha256, settings) {
  if (fs.existsSync(target)) {
    const stat = fs.statSync(target);
    invariant(stat.isFile() && stat.size > 0 && stat.size <= maximumSmallFileBytes,
      `${path.basename(target)} is outside its size limit`);
    invariant(await sha256File(target) === expectedSha256, `${path.basename(target)} SHA-256 mismatch`);
    return Object.freeze({ filename: path.basename(target), byteCount: stat.size, sha256: expectedSha256 });
  }
  const response = await settings.fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(settings.timeoutMs)
  });
  invariant(response && response.ok, `${path.basename(target)} returned HTTP ${response ? response.status : "unknown"}`);
  const contentLength = Number(response.headers.get("content-length"));
  invariant(!Number.isSafeInteger(contentLength) || contentLength <= maximumSmallFileBytes,
    `${path.basename(target)} is oversized`);
  const bytes = Buffer.from(await response.arrayBuffer());
  invariant(bytes.length > 0 && bytes.length <= maximumSmallFileBytes, `${path.basename(target)} is oversized`);
  invariant(crypto.createHash("sha256").update(bytes).digest("hex") === expectedSha256,
    `${path.basename(target)} SHA-256 mismatch`);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 });
  syncFile(temporary);
  fs.renameSync(temporary, target);
  return Object.freeze({ filename: path.basename(target), byteCount: bytes.length, sha256: expectedSha256 });
}

// Writes a JSON receipt through synced same-directory atomic replacement.
function atomicWriteJson(filePath, value) {
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    syncFile(temporary);
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

// Loads a bounded acquisition receipt when it still binds the requested candidate.
async function existingReceipt(directory, candidate) {
  const receiptPath = path.join(directory, "source-acquisition.json");
  const stat = fs.statSync(receiptPath, { throwIfNoEntry: false });
  if (!stat) return null;
  invariant(stat.isFile() && stat.size > 0 && stat.size <= maximumReceiptBytes,
    "source acquisition receipt is outside its size limit");
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  invariant(receipt.schema === receiptSchema && receipt.status === "verified",
    "source acquisition receipt is invalid");
  invariant(receipt.modelId === candidate.modelId && receipt.revision === candidate.revision &&
    receipt.sourceTemplate === candidate.sourceTemplate && receipt.weightIdentity === candidate.weightIdentity &&
    receipt.chatTemplateKind === candidate.chatTemplateKind &&
    receipt.chatTemplateSha256 === candidate.chatTemplateSha256,
  "source acquisition receipt identity changed");
  invariant(Array.isArray(receipt.files), "source acquisition receipt files are invalid");
  for (const file of receipt.files) {
    invariant(isPlainObject(file) && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(file.filename),
      "source acquisition receipt file is invalid");
    const localPath = path.join(directory, file.filename);
    const localStat = fs.statSync(localPath, { throwIfNoEntry: false });
    invariant(localStat && localStat.isFile() && localStat.size === file.byteCount,
      `source acquisition receipt file changed: ${file.filename}`);
    invariant(await sha256File(localPath) === file.sha256,
      `source acquisition receipt digest changed: ${file.filename}`);
  }
  verifyChatTemplate(directory, candidate);
  return Object.freeze(receipt);
}

// Acquires and verifies all files for one immutable source candidate.
async function acquireCandidate(candidateValue, outputRoot, options = {}) {
  const candidate = requireCandidate(candidateValue);
  const directory = candidateDirectory(outputRoot, candidate);
  fs.mkdirSync(directory, { recursive: true });
  const resumed = await existingReceipt(directory, candidate);
  if (resumed) return resumed;
  const settings = {
    baseUrl: normalizeBaseUrl(options.baseUrl || defaultBaseUrl),
    fetchImpl: options.fetchImpl || globalThis.fetch,
    timeoutMs: Number(options.timeoutMs || defaultDownloadTimeoutMs)
  };
  invariant(typeof settings.fetchImpl === "function", "fetch implementation is required");
  invariant(Number.isSafeInteger(settings.timeoutMs) && settings.timeoutMs >= 1000,
    "download timeout is invalid");
  const files = [];
  files.push(await downloadSmallFile(
    pinnedFileUrl(settings.baseUrl, candidate, "config.json"),
    path.join(directory, "config.json"),
    candidate.configSha256,
    settings
  ));
  files.push(await downloadExpectedFile(
    pinnedFileUrl(settings.baseUrl, candidate, candidate.tokenizer.filename),
    directory,
    candidate.tokenizer,
    settings
  ));
  files.push(await downloadExpectedFile(
    pinnedFileUrl(settings.baseUrl, candidate, candidate.tokenizerConfig.filename),
    directory,
    candidate.tokenizerConfig,
    settings
  ));
  verifyChatTemplate(directory, candidate);
  files.push(await downloadSmallFile(
    candidate.licenseSourceUrl,
    path.join(directory, "LICENSE"),
    candidate.licenseSha256,
    settings
  ));
  for (const weight of candidate.weightFiles) {
    files.push(await downloadExpectedFile(
      pinnedFileUrl(settings.baseUrl, candidate, weight.filename),
      directory,
      weight,
      settings
    ));
  }
  const receipt = Object.freeze({
    schema: receiptSchema,
    status: "verified",
    verifiedUtc: new Date().toISOString(),
    sourceTemplate: candidate.sourceTemplate,
    modelId: candidate.modelId,
    revision: candidate.revision,
    weightIdentity: candidate.weightIdentity,
    sourceWeightByteCount: candidate.sourceWeightByteCount,
    chatTemplateKind: candidate.chatTemplateKind,
    chatTemplateSha256: candidate.chatTemplateSha256,
    licenseId: candidate.licenseId,
    licenseEvidenceKind: candidate.licenseEvidenceKind,
    files: Object.freeze(files)
  });
  atomicWriteJson(path.join(directory, "source-acquisition.json"), receipt);
  return receipt;
}

// Acquires a bounded contiguous selection from one validated discovery inventory.
async function acquireInventory(inventory, outputRoot, options = {}) {
  invariant(isPlainObject(inventory) && inventory.schema === inventorySchema,
    "candidate inventory schema is invalid");
  invariant(Array.isArray(inventory.candidates), "candidate inventory list is invalid");
  const start = Number(options.start || 0);
  const count = Number(options.count || inventory.candidates.length);
  invariant(Number.isSafeInteger(start) && start >= 0, "candidate start is invalid");
  invariant(Number.isSafeInteger(count) && count >= 1 && count <= 100, "candidate count is invalid");
  const selected = inventory.candidates.slice(start, start + count);
  invariant(selected.length > 0, "candidate selection is empty");
  const receipts = [];
  for (const candidate of selected) {
    const receipt = await acquireCandidate(candidate, outputRoot, options);
    receipts.push(receipt);
    process.stdout.write(`Verified source ${receipt.modelId}@${receipt.revision}\n`);
  }
  return Object.freeze(receipts);
}

// Runs the source acquisition CLI over one inventory selection.
async function main(argv) {
  const [inventoryPath, outputRoot, startText, countText] = argv;
  invariant(inventoryPath && outputRoot,
    "usage: node tools/huggingface-candidate-acquire.js <inventory.json> <output-root> [start] [count]");
  const bytes = fs.readFileSync(path.resolve(inventoryPath));
  invariant(bytes.length > 0 && bytes.length <= 16 * 1024 * 1024, "candidate inventory is oversized");
  const inventory = JSON.parse(bytes.toString("utf8"));
  await acquireInventory(inventory, outputRoot, {
    start: startText ? Number(startText) : 0,
    count: countText ? Number(countText) : inventory.candidates.length
  });
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Source acquisition failed: ${String(error && error.message || error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  acquireCandidate,
  acquireInventory,
  candidateDirectory,
  receiptSchema,
  sha256File
});

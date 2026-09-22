"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { sourceCandidateRejection } = require("./source-candidate-exclusions.js");
const { validateWeightLayout, validateWeightIndex, maximumWeightIndexBytes } = require("./huggingface-weight-layout.js");
const { requireFilename, requireModelOutputRoot, readBoundedFile,
  withCandidateDirectory } = require("./huggingface-candidate-storage.js");

const inventorySchema = "tinyrustlm.huggingface_supported_candidate_inventory.v3";
const receiptSchema = "tinyrustlm.huggingface_source_acquisition.v3";
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

// Validates a digest-bearing source candidate from the discovery inventory.
function requireCandidate(value) {
  invariant(isPlainObject(value), "candidate is invalid");
  const modelId = String(value.modelId || "").trim();
  invariant(/^[A-Za-z0-9._-]{1,96}\/[A-Za-z0-9._-]{1,160}$/.test(modelId), "candidate modelId is invalid");
  const revision = String(value.revision || "").toLowerCase();
  invariant(/^[a-f0-9]{40,64}$/.test(revision), "candidate revision is not immutable");
  const priorRejection = sourceCandidateRejection(modelId, revision);
  invariant(!priorRejection, priorRejection);
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
  invariant(tokenizer.filename === "tokenizer.json" && tokenizerConfig.filename === "tokenizer_config.json",
    "candidate tokenizer filenames are invalid");
  invariant(tokenizer.byteCount <= maximumSmallFileBytes && tokenizerConfig.byteCount <= maximumSmallFileBytes,
    "candidate tokenizer files exceed their size limit");
  invariant(value.chatTemplateKind === "revision-chatml-template-v1",
    "candidate chat template kind is invalid");
  const chatTemplateSha256 = String(value.chatTemplateSha256 || "").toLowerCase();
  invariant(/^[a-f0-9]{64}$/.test(chatTemplateSha256),
    "candidate chatTemplateSha256 is invalid");
  invariant(Array.isArray(value.weightFiles) && value.weightFiles.length >= 1 && value.weightFiles.length <= 64,
    "candidate weightFiles are invalid");
  const weightFiles = value.weightFiles.map((file) => requireSourceFile(file, "weight"));
  invariant(weightFiles.every((file) => /^model(?:-\d{5}-of-\d{5})?\.safetensors$/.test(file.filename)) &&
    new Set(weightFiles.map((file) => file.filename)).size === weightFiles.length,
  "candidate weight filenames are invalid or duplicated");
  invariant(weightFiles.every((file) => file.sha256), "every weight requires SHA-256");
  const weightRejection = sourceCandidateRejection(modelId, revision, weightFiles);
  invariant(!weightRejection, weightRejection);
  const layout = validateWeightLayout(weightFiles);
  let weightIndex = null;
  if (layout === "single") {
    invariant(value.weightIndex === null, "direct weights require an explicit null weight index");
  } else {
    weightIndex = requireSourceFile(value.weightIndex, "weight index");
    invariant(weightIndex.filename === "model.safetensors.index.json" &&
      weightIndex.byteCount <= maximumWeightIndexBytes, "candidate weight index filename or size is invalid");
  }
  const sourceWeightByteCount = Number(value.sourceWeightByteCount);
  invariant(Number.isSafeInteger(sourceWeightByteCount) && sourceWeightByteCount > 0 &&
    weightFiles.reduce((sum, file) => sum + file.byteCount, 0) === sourceWeightByteCount,
  "candidate sourceWeightByteCount is invalid");
  const canonicalWeights = [...weightFiles].sort((left, right) => left.filename.localeCompare(right.filename))
    .map((file) => `${file.filename}:${file.byteCount}:${file.sha256}`).join("\n");
  invariant(crypto.createHash("sha256").update(canonicalWeights).digest("hex") === weightIdentity,
    "candidate weightIdentity does not match its files");
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
    weightIndex,
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
  const root = requireModelOutputRoot(outputRoot);
  const slug = `source-${crypto.createHash("sha256").update(`${candidate.modelId.toLowerCase()}\n${candidate.revision}`).digest("hex")}`;
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
async function verifyExpectedFile(filePath, expected, guard) {
  guard(filePath);
  const stat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  invariant(stat && stat.isFile(), `${expected.filename} is missing`);
  invariant(stat.size === expected.byteCount, `${expected.filename} byte count mismatch`);
  const sha256 = await sha256File(filePath);
  guard(filePath);
  if (expected.sha256) {
    invariant(sha256 === expected.sha256, `${expected.filename} SHA-256 mismatch`);
  }
  if (expected.gitBlobId) {
    invariant(await gitBlobIdFile(filePath, stat.size) === expected.gitBlobId,
      `${expected.filename} Git blob identity mismatch`);
  }
  guard(filePath);
  const after = fs.lstatSync(filePath);
  invariant(after.dev === stat.dev && after.ino === stat.ino && after.size === stat.size && after.mtimeMs === stat.mtimeMs,
    `${expected.filename} changed during verification`);
  return Object.freeze({ filename: expected.filename, byteCount: stat.size, sha256 });
}

// Revalidates the revision-owned ChatML template against the inventory fingerprint.
function verifyChatTemplate(directory, candidate, guard) {
  const filePath = path.join(directory, candidate.tokenizerConfig.filename);
  const bytes = readBoundedFile(filePath, maximumSmallFileBytes, guard);
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

// A verified index must resolve exactly the admitted shard set before transfer or cache reuse.
function verifyShardIndex(directory, candidate, guard) {
  if (!candidate.weightIndex) return;
  validateWeightIndex(readBoundedFile(path.join(directory, candidate.weightIndex.filename),
    maximumWeightIndexBytes, guard), candidate.weightFiles);
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

// Rejects excess decoded bytes before forwarding a chunk to the file writer.
function byteLimit(maximumBytes, filename) {
  let received = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      if (chunk.length > maximumBytes - received) {
        callback(new Error(`${filename} download exceeded its expected byte count`));
        return;
      }
      received += chunk.length;
      callback(null, chunk);
    }
  });
}

// Parses an optional byte count without admitting malformed or rounded header values.
function contentLength(response) {
  const value = response.headers.get("content-length");
  if (value === null) return null;
  invariant(/^\d+$/.test(value) && Number.isSafeInteger(Number(value)), "invalid Content-Length");
  return Number(value);
}

// Downloads one large pinned file with strict Range-resume semantics.
async function downloadExpectedFile(url, directory, expected, settings, allowRestart = true,
  shortReadRetriesRemaining = maximumShortReadRetries) {
  const target = path.join(directory, expected.filename);
  settings.guard(target);
  if (fs.existsSync(target)) {
    return verifyExpectedFile(target, expected, settings.guard);
  }
  const part = `${target}.part`;
  settings.guard(part);
  const partStat = fs.statSync(part, { throwIfNoEntry: false });
  invariant(!partStat || partStat.isFile(), `${expected.filename} part path is invalid`);
  const start = partStat ? partStat.size : 0;
  invariant(start <= expected.byteCount, `${expected.filename} partial byte count exceeds expected size`);
  if (start === expected.byteCount) {
    let verified;
    try {
      verified = await verifyExpectedFile(part, expected, settings.guard);
    } catch (error) {
      settings.guard(part);
      fs.rmSync(part, { force: true });
      throw error;
    }
    settings.guard(target);
    fs.renameSync(part, target);
    return verified;
  }
  const headers = start > 0 ? { Range: `bytes=${start}-` } : {};
  const signal = AbortSignal.timeout(settings.timeoutMs);
  const response = await settings.fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    headers,
    signal
  });
  try {
    settings.guard(part);
    settings.guard(target);
    invariant(response && response.ok, `${expected.filename} returned HTTP ${response ? response.status : "unknown"}`);
    if (start > 0 && response.status === 200) {
      invariant(allowRestart, `${expected.filename} server ignored Range twice`);
      if (response.body) Promise.resolve(response.body.cancel()).catch(() => {});
      settings.guard(part);
      fs.rmSync(part, { force: true });
      return downloadExpectedFile(
        url, directory, expected, settings, false, shortReadRetriesRemaining);
    }
    invariant(start === 0 ? response.status === 200 : response.status === 206,
      `${expected.filename} returned invalid resume status`);
    let responseBytes = expected.byteCount - start;
    if (start > 0) {
      const contentRange = String(response.headers.get("content-range") || "");
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
      invariant(match && match.slice(1).every((value) => Number.isSafeInteger(Number(value))) &&
        Number(match[1]) === start && Number(match[2]) >= start && Number(match[2]) < expected.byteCount &&
        Number(match[3]) === expected.byteCount, `${expected.filename} Content-Range mismatch`);
      responseBytes = Number(match[2]) - start + 1;
    }
    const length = contentLength(response);
    const contentEncoding = String(response.headers.get("content-encoding") || "identity").toLowerCase();
    invariant(start === 0 || contentEncoding === "identity" || contentEncoding === "",
      `${expected.filename} encoded range is unsupported`);
    if (length !== null && (contentEncoding === "" || contentEncoding === "identity")) {
      invariant(length === responseBytes, `${expected.filename} Content-Length mismatch`);
    }
    invariant(response.body, `${expected.filename} response body is missing`);
    const source = Readable.fromWeb(response.body);
    const before = settings.guard(part);
    invariant(before ? before.size === BigInt(start) : start === 0, "candidate part changed before write");
    const descriptor = fs.openSync(part, before ? "r+" : "wx", 0o600);
    let opened;
    try {
      opened = fs.fstatSync(descriptor, { bigint: true });
      const current = settings.guard(part);
      invariant(current && current.dev === opened.dev && current.ino === opened.ino &&
        (!before || (before.dev === opened.dev && before.ino === opened.ino)),
      "candidate part identity changed before write");
    } catch (error) {
      fs.closeSync(descriptor);
      source.destroy();
      throw error;
    }
    await pipeline(
      source,
      byteLimit(responseBytes, expected.filename),
      fs.createWriteStream(part, { fd: descriptor, start, autoClose: true }),
      { signal }
    );
    const completed = settings.guard(part);
    invariant(completed && completed.dev === opened.dev && completed.ino === opened.ino,
      "candidate part identity changed during write");
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
    let verified;
    try {
      verified = await verifyExpectedFile(part, expected, settings.guard);
    } catch (error) {
      settings.guard(part);
      fs.rmSync(part, { force: true });
      throw error;
    }
    settings.guard(target);
    fs.renameSync(part, target);
    return verified;
  } finally {
    if (response?.body && !response.bodyUsed) Promise.resolve(response.body.cancel()).catch(() => {});
  }
}

// Fetches, bounds, hashes, and atomically writes one small evidence file.
async function downloadSmallFile(url, target, expectedSha256, settings) {
  settings.guard(target);
  if (fs.existsSync(target)) {
    const bytes = readBoundedFile(target, maximumSmallFileBytes, settings.guard);
    invariant(crypto.createHash("sha256").update(bytes).digest("hex") === expectedSha256,
      `${path.basename(target)} SHA-256 mismatch`);
    return Object.freeze({ filename: path.basename(target), byteCount: bytes.length, sha256: expectedSha256 });
  }
  const signal = AbortSignal.timeout(settings.timeoutMs);
  const response = await settings.fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    signal
  });
  try {
    settings.guard(target);
    invariant(response && response.ok, `${path.basename(target)} returned HTTP ${response ? response.status : "unknown"}`);
    const length = contentLength(response);
    invariant(length === null || length <= maximumSmallFileBytes,
      `${path.basename(target)} is oversized`);
    invariant(response.body, `${path.basename(target)} response body is missing`);
    let buffer = Buffer.alloc(Math.min(length ?? 65536, maximumSmallFileBytes));
    let received = 0;
    for await (const chunk of Readable.fromWeb(response.body, { signal })) {
      invariant(chunk.length <= maximumSmallFileBytes - received, `${path.basename(target)} is oversized`);
      const needed = received + chunk.length;
      if (needed > buffer.length) {
        const expanded = Buffer.alloc(Math.min(maximumSmallFileBytes, Math.max(needed, buffer.length * 2)));
        buffer.copy(expanded, 0, 0, received);
        buffer = expanded;
      }
      chunk.copy(buffer, received);
      received = needed;
    }
    const bytes = buffer.subarray(0, received);
    settings.guard(target);
    invariant(bytes.length > 0 && bytes.length <= maximumSmallFileBytes, `${path.basename(target)} is oversized`);
    invariant(crypto.createHash("sha256").update(bytes).digest("hex") === expectedSha256,
      `${path.basename(target)} SHA-256 mismatch`);
    atomicWriteBytes(target, bytes, settings.guard);
    return Object.freeze({ filename: path.basename(target), byteCount: bytes.length, sha256: expectedSha256 });
  } finally {
    if (response?.body && !response.bodyUsed) Promise.resolve(response.body.cancel()).catch(() => {});
  }
}

// Publishes bounded bytes through a synced exclusive file and retires only that owned temporary.
function atomicWriteBytes(filePath, bytes, guard) {
  guard(filePath);
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  let descriptor;
  let identity;
  let promoted = false;
  try {
    guard(temporary);
    descriptor = fs.openSync(temporary, "wx", 0o600);
    identity = fs.fstatSync(descriptor, { bigint: true });
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    const current = guard(temporary);
    invariant(current && current.dev === identity.dev && current.ino === identity.ino,
      "candidate temporary identity changed");
    guard(filePath);
    fs.renameSync(temporary, filePath);
    promoted = true;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (identity && !promoted) {
      const current = guard(temporary);
      invariant(current && current.dev === identity.dev && current.ino === identity.ino,
        "candidate temporary identity changed before cleanup");
      fs.unlinkSync(temporary);
    }
  }
}

// Loads a bounded acquisition receipt when it still binds the requested candidate.
async function existingReceipt(directory, candidate, guard) {
  const receiptPath = path.join(directory, "source-acquisition.json");
  guard(receiptPath);
  const stat = fs.statSync(receiptPath, { throwIfNoEntry: false });
  if (!stat) return null;
  const receipt = JSON.parse(readBoundedFile(receiptPath, maximumReceiptBytes, guard).toString("utf8"));
  invariant(receipt.schema === receiptSchema && receipt.status === "verified",
    "source acquisition receipt is invalid");
  const keys = ["schema", "status", "verifiedUtc", "sourceTemplate", "modelId", "revision", "weightIdentity",
    "sourceWeightByteCount", "chatTemplateKind", "chatTemplateSha256", "licenseId", "licenseEvidenceKind", "files"];
  invariant(Object.keys(receipt).length === keys.length && keys.every((key) => Object.hasOwn(receipt, key)) &&
    typeof receipt.verifiedUtc === "string" && Number.isFinite(Date.parse(receipt.verifiedUtc)),
  "source acquisition receipt shape is invalid");
  invariant(receipt.modelId === candidate.modelId && receipt.revision === candidate.revision &&
    receipt.sourceTemplate === candidate.sourceTemplate && receipt.weightIdentity === candidate.weightIdentity &&
    receipt.sourceWeightByteCount === candidate.sourceWeightByteCount && receipt.licenseId === candidate.licenseId &&
    receipt.licenseEvidenceKind === candidate.licenseEvidenceKind &&
    receipt.chatTemplateKind === candidate.chatTemplateKind &&
    receipt.chatTemplateSha256 === candidate.chatTemplateSha256,
  "source acquisition receipt identity changed");
  const expectedFiles = [
    { filename: "config.json", sha256: candidate.configSha256 }, candidate.tokenizer, candidate.tokenizerConfig,
    { filename: "LICENSE", sha256: candidate.licenseSha256 },
    ...(candidate.weightIndex ? [candidate.weightIndex] : []), ...candidate.weightFiles
  ];
  invariant(Array.isArray(receipt.files) && receipt.files.length === expectedFiles.length &&
    receipt.files.every((file) => isPlainObject(file)) &&
    new Set(receipt.files.map((file) => file.filename)).size === expectedFiles.length,
  "source acquisition receipt file closure is invalid");
  for (const expected of expectedFiles) {
    const file = receipt.files.find((item) => item.filename === expected.filename);
    invariant(file && Number.isSafeInteger(file.byteCount) && file.byteCount > 0 &&
      Object.keys(file).length === 3 &&
      /^[a-f0-9]{64}$/.test(file.sha256) && (!expected.sha256 || file.sha256 === expected.sha256) &&
      (expected.byteCount === undefined ? file.byteCount <= maximumSmallFileBytes : file.byteCount === expected.byteCount),
    "source acquisition receipt file identity is invalid");
    const localPath = path.join(directory, file.filename);
    await verifyExpectedFile(localPath, { ...expected, byteCount: file.byteCount, sha256: file.sha256 }, guard);
    if (candidate.weightIndex && file.filename === candidate.weightIndex.filename) verifyShardIndex(directory, candidate, guard);
  }
  verifyChatTemplate(directory, candidate, guard);
  return Object.freeze(receipt);
}

// Acquires and verifies all files for one immutable source candidate.
async function acquireCandidate(candidateValue, outputRoot, options = {}) {
  const candidate = requireCandidate(candidateValue);
  const directory = candidateDirectory(outputRoot, candidate);
  const settings = {
    baseUrl: normalizeBaseUrl(options.baseUrl || defaultBaseUrl),
    fetchImpl: options.fetchImpl || globalThis.fetch,
    timeoutMs: Number(options.timeoutMs ?? defaultDownloadTimeoutMs)
  };
  invariant(typeof settings.fetchImpl === "function", "fetch implementation is required");
  invariant(Number.isSafeInteger(settings.timeoutMs) && settings.timeoutMs >= 1000 &&
    settings.timeoutMs <= defaultDownloadTimeoutMs,
    "download timeout is invalid");
  return withCandidateDirectory(directory, async (guard) => {
    settings.guard = guard;
    const resumed = await existingReceipt(directory, candidate, guard);
    if (resumed) return resumed;
    const files = [];
    if (candidate.weightIndex) {
      files.push(await downloadExpectedFile(
        pinnedFileUrl(settings.baseUrl, candidate, candidate.weightIndex.filename),
        directory, candidate.weightIndex, settings));
      verifyShardIndex(directory, candidate, guard);
    }
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
    verifyChatTemplate(directory, candidate, guard);
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
    atomicWriteBytes(path.join(directory, "source-acquisition.json"),
      Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`), guard);
    return receipt;
  });
}

// Acquire at most count entries from start; only omitted limits use defaults.
// Validate the entire selected slice before any download or candidate-directory mutation.
async function acquireInventory(inventory, outputRoot, options = {}) {
  invariant(isPlainObject(inventory) && inventory.schema === inventorySchema,
    "candidate inventory schema is invalid");
  invariant(Array.isArray(inventory.candidates), "candidate inventory list is invalid");
  const start = options.start === undefined ? 0 : options.start;
  const count = options.count === undefined ? inventory.candidates.length : options.count;
  invariant(Number.isSafeInteger(start) && start >= 0, "candidate start is invalid");
  invariant(Number.isSafeInteger(count) && count >= 1 && count <= 100, "candidate count is invalid");
  const selected = Array.from(inventory.candidates.slice(start, start + count), requireCandidate);
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
  requireModelOutputRoot(outputRoot);
  const bytes = readBoundedFile(path.resolve(inventoryPath), 16 * 1024 * 1024);
  const inventory = JSON.parse(bytes.toString("utf8"));
  await acquireInventory(inventory, outputRoot, {
    start: startText === undefined ? undefined : (startText.trim() ? Number(startText) : NaN),
    count: countText === undefined ? undefined : (countText.trim() ? Number(countText) : NaN)
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
  receiptSchema
});

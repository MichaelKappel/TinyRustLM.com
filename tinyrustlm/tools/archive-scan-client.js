"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");

const repositoryRoot = resolveRepositoryRoot();
const archiveAdmissionProfilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "archive-admission-profile.v1.json"
);
const archiveScanProcessProfilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "archive-scan-process-profile.v1.json"
);
const archiveAdmissionProfileSha256 =
  "05158f80e01817e31a2968bc4e2f9d1bb05fe53064384563f6546a5468046031";
const archiveScanProcessProfileSha256 =
  "a5ab1ba16af4db2cf4660bee8c9efd9a32b018cc30211d2144f4c852912d05ad";
const archiveAdmissionProfileId = "tinyrustlm.vnext.archive-admission.v1";
const archiveScanProcessProfileId = "tinyrustlm.vnext.archive-scan-process.v1";
const archiveScanRequestSchema = "tinyrustlm.vnext.archive_scan_request.v1";
const archiveScanFailureSchema = "tinyrustlm.vnext.archive_scan_failure.v1";
const wireMagic = Buffer.from("5452415356310000", "hex");
const maximumRequestBytes = 16_384;
const maximumExecutableBytes = 134_217_728;
const maximumArchiveBytes = 536_870_912;
const maximumMemberCount = 16_384;
const maximumMemberPathBytes = 1_024;
const maximumMemberBytes = 67_108_864;
const maximumTotalMemberBytes = 2_147_483_648;
const maximumStderrBytes = 4_096;
const processTimeoutMilliseconds = 30 * 60 * 1_000;
const maximumWireBytes = maximumTotalMemberBytes +
  maximumMemberCount * (1 + 2 + 8 + 64 + maximumMemberPathBytes) +
  wireMagic.length + 1 + 4 + 8 + 1 + 4 * 64;
let safeProcessErrorCodes;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function fail(code, causeCode = null) {
  const error = new Error("Archive scan process boundary failed");
  error.code = code;
  error.causeCode = causeCode;
  throw error;
}

function resolveRepositoryRoot() {
  const configured = Object.getOwnPropertyDescriptor(
    process.env,
    "TINYRUSTLM_REPOSITORY_ROOT"
  );
  const candidates = configured && "value" in configured && configured.value
    ? [configured.value]
    : [process.cwd(), path.resolve(process.cwd(), ".."), path.resolve(__dirname, "../..")];
  const matches = [];
  const identities = new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !path.isAbsolute(candidate) ||
        candidate.includes("\0")) {
      continue;
    }
    const normalized = path.normalize(candidate);
    const identity = process.platform === "win32" ? normalized.toLowerCase() : normalized;
    if (identities.has(identity)) continue;
    identities.add(identity);
    const packagePath = path.join(normalized, "tinyrustlm", "package.json");
    const admissionPath = path.join(normalized, "contracts", "vnext",
      "archive-admission-profile.v1.json");
    const processPath = path.join(normalized, "contracts", "vnext",
      "archive-scan-process-profile.v1.json");
    try {
      if (fs.lstatSync(packagePath).isFile() && fs.lstatSync(admissionPath).isFile() &&
          fs.lstatSync(processPath).isFile()) {
        matches.push(normalized);
      }
    } catch (_error) {
      // Only a complete candidate root is authoritative.
    }
  }
  if (matches.length !== 1) fail("archive_scan_repository_root_invalid");
  return matches[0];
}

function verifyFrozenProfiles() {
  let admissionBytes;
  let processBytes;
  try {
    admissionBytes = fs.readFileSync(archiveAdmissionProfilePath);
    processBytes = fs.readFileSync(archiveScanProcessProfilePath);
  } catch (_error) {
    fail("archive_scan_profile_read_failed");
  }
  if (sha256(admissionBytes) !== archiveAdmissionProfileSha256 ||
      sha256(processBytes) !== archiveScanProcessProfileSha256) {
    fail("archive_scan_profile_identity_mismatch");
  }
  let admissionProfile;
  let processProfile;
  try {
    admissionProfile = parseStrictJson(admissionBytes);
    processProfile = parseStrictJson(processBytes);
  } catch (_error) {
    fail("archive_scan_profile_invalid");
  }
  if (admissionProfile.profileId !== archiveAdmissionProfileId ||
      processProfile.profileId !== archiveScanProcessProfileId ||
      processProfile.admissionProfileId !== archiveAdmissionProfileId ||
      processProfile.admissionProfileSha256 !== archiveAdmissionProfileSha256 ||
      processProfile.request?.schema !== archiveScanRequestSchema ||
      processProfile.failure?.schema !== archiveScanFailureSchema ||
      !Array.isArray(admissionProfile.errorCodes) ||
      !Array.isArray(processProfile.processErrorCodes) ||
      admissionProfile.errorCodes.length === 0 ||
      processProfile.processErrorCodes.length === 0 ||
      [...admissionProfile.errorCodes, ...processProfile.processErrorCodes].some((code) =>
        typeof code !== "string" || !/^[a-z][a-z0-9_]{2,79}$/u.test(code))) {
    fail("archive_scan_profile_invalid");
  }
  safeProcessErrorCodes = new Set([
    ...admissionProfile.errorCodes,
    ...processProfile.processErrorCodes
  ]);
}

verifyFrozenProfiles();

function archiveFormatForPath(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar-gzip";
  if (lower.endsWith(".zip") || lower.endsWith(".nupkg") ||
      lower.endsWith(".snupkg")) return "zip";
  return null;
}

function assertNoLinkComponents(filePath) {
  const parsed = path.parse(filePath);
  const parts = filePath.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (_error) {
      fail("archive_scan_observed_path_invalid");
    }
    if (stat.isSymbolicLink()) fail("archive_scan_observed_path_link");
  }
}

function normalizeObservedFile(filePath, maximumBytes, code) {
  if (typeof filePath !== "string" || filePath.length === 0 ||
      filePath.includes("\0") || !path.isAbsolute(filePath) ||
      path.normalize(filePath) !== path.resolve(filePath)) {
    fail(code);
  }
  let requestedStat;
  let observedPath;
  try {
    requestedStat = fs.lstatSync(filePath);
    if (!requestedStat.isFile() || requestedStat.isSymbolicLink()) fail(code);
    observedPath = fs.realpathSync.native(filePath);
  } catch (error) {
    if (error?.code === code) throw error;
    fail(code);
  }
  if (!path.isAbsolute(observedPath) || Buffer.byteLength(observedPath, "utf8") > 16_384 ||
      path.parse(observedPath).root === observedPath) {
    fail(code);
  }
  assertNoLinkComponents(observedPath);
  let observedStat;
  try {
    observedStat = fs.lstatSync(observedPath);
  } catch (_error) {
    fail(code);
  }
  if (!observedStat.isFile() || observedStat.isSymbolicLink() ||
      observedStat.size <= 0 || observedStat.size > maximumBytes ||
      (requestedStat.dev && observedStat.dev && requestedStat.dev !== observedStat.dev) ||
      (requestedStat.ino && observedStat.ino && requestedStat.ino !== observedStat.ino)) {
    fail(code);
  }
  return observedPath;
}

function hashRegularFile(filePath, maximumBytes, code) {
  let descriptor;
  try {
    const linkStat = fs.lstatSync(filePath);
    if (!linkStat.isFile() || linkStat.isSymbolicLink() || linkStat.size <= 0 ||
        linkStat.size > maximumBytes) {
      fail(code);
    }
    descriptor = fs.openSync(filePath,
      Number(fs.constants.O_RDONLY) | Number(fs.constants.O_NOFOLLOW || 0));
    const before = fs.fstatSync(descriptor);
    if (!before.isFile() || before.size !== linkStat.size ||
        (linkStat.dev && before.dev && linkStat.dev !== before.dev) ||
        (linkStat.ino && before.ino && linkStat.ino !== before.ino)) {
      fail(code);
    }
    const hash = crypto.createHash("sha256");
    const buffer = Buffer.allocUnsafe(65_536);
    let byteCount = 0;
    while (byteCount < before.size) {
      const count = fs.readSync(descriptor, buffer, 0,
        Math.min(buffer.length, before.size - byteCount), byteCount);
      if (count <= 0) fail(code);
      hash.update(buffer.subarray(0, count));
      byteCount += count;
    }
    const after = fs.fstatSync(descriptor);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs ||
        (before.dev && after.dev && before.dev !== after.dev) ||
        (before.ino && after.ino && before.ino !== after.ino)) {
      fail(code);
    }
    return Object.freeze({ byteCount, sha256: hash.digest("hex") });
  } catch (error) {
    if (error?.code === code) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // The bounded identity was already obtained or the operation failed.
      }
    }
  }
}

function decodeSha256(bytes) {
  if (bytes.length !== 64 || !bytes.every((byte) =>
    (byte >= 0x30 && byte <= 0x39) || (byte >= 0x61 && byte <= 0x66))) {
    fail("archive_scan_wire_invalid");
  }
  return bytes.toString("ascii");
}

function validateWirePath(bytes, collisionKeys) {
  if (bytes.length === 0 || bytes.length > maximumMemberPathBytes ||
      !bytes.every((byte) => byte >= 0x20 && byte <= 0x7e)) {
    fail("archive_scan_wire_invalid");
  }
  const value = bytes.toString("ascii");
  if (value.startsWith("/") || value.endsWith("/") || value.includes("\\")) {
    fail("archive_scan_wire_invalid");
  }
  const components = value.split("/");
  if (components.length > 64 || components.some((component) =>
    component.length === 0 || component.length > 255 || component === "." ||
    component === ".." || component.endsWith(".") || component.endsWith(" ") ||
    component.includes(":") || isWindowsReservedName(component))) {
    fail("archive_scan_wire_invalid");
  }
  const collisionKey = value.toLowerCase();
  if (collisionKeys.has(collisionKey)) fail("archive_scan_wire_invalid");
  collisionKeys.add(collisionKey);
  return value;
}

function isWindowsReservedName(component) {
  const stem = component.toLowerCase().split(".")[0];
  return ["con", "prn", "aux", "nul", "conin$", "conout$"].includes(stem) ||
    /^com[1-9]$/u.test(stem) || /^lpt[1-9]$/u.test(stem);
}

function contentManifestSha256(members) {
  const sorted = [...members].sort((left, right) =>
    Buffer.from(left.path, "ascii").compare(Buffer.from(right.path, "ascii")));
  const hasher = crypto.createHash("sha256");
  hasher.update(Buffer.from("tinyrustlm.archive-content-manifest.v1\0", "ascii"));
  const count = Buffer.alloc(8);
  count.writeBigUInt64BE(BigInt(sorted.length));
  hasher.update(count);
  for (const member of sorted) {
    const pathHasher = crypto.createHash("sha256");
    pathHasher.update(Buffer.from("tinyrustlm.archive-member-path.v1\0", "ascii"));
    pathHasher.update(Buffer.from(member.path, "ascii"));
    hasher.update(pathHasher.digest());
    hasher.update(Buffer.from(member.contentSha256, "hex"));
    const size = Buffer.alloc(8);
    size.writeBigUInt64BE(BigInt(member.contentLength));
    hasher.update(size);
  }
  return hasher.digest("hex");
}

function createArchiveWireParser(options) {
  if (!options || typeof options !== "object" ||
      !["zip", "tar-gzip"].includes(options.format) ||
      (options.onMemberStart !== undefined && typeof options.onMemberStart !== "function") ||
      (options.onContent !== undefined && typeof options.onContent !== "function") ||
      (options.onMemberEnd !== undefined && typeof options.onMemberEnd !== "function")) {
    fail("archive_scan_wire_options_invalid");
  }
  const onMemberStart = options.onMemberStart || (() => {});
  const onContent = options.onContent || (() => {});
  const onMemberEnd = options.onMemberEnd || (() => {});
  const expectedFormatCode = options.format === "zip" ? 1 : 2;
  const members = [];
  const collisionKeys = new Set();
  let pending = Buffer.alloc(0);
  let phase = "magic";
  let member = null;
  let memberCount = 0;
  let totalContentBytes = 0;
  let result = null;
  let inputByteCount = 0;

  function take(length) {
    if (pending.length < length) return null;
    const value = pending.subarray(0, length);
    pending = pending.subarray(length);
    return value;
  }

  function completeMember() {
    const actualSha256 = member.hasher.digest("hex");
    if (actualSha256 !== member.contentSha256) fail("archive_scan_wire_content_mismatch");
    members.push(member.evidence);
    memberCount += 1;
    totalContentBytes += member.contentLength;
    onMemberEnd(member.evidence);
    member = null;
    phase = "type";
  }

  function processPending() {
    while (true) {
      if (phase === "magic") {
        const value = take(wireMagic.length);
        if (value === null) return;
        if (!value.equals(wireMagic)) fail("archive_scan_wire_invalid");
        phase = "type";
      } else if (phase === "type") {
        const value = take(1);
        if (value === null) return;
        if (value[0] === 1) {
          if (memberCount >= maximumMemberCount) fail("archive_scan_wire_invalid");
          phase = "member-header";
        } else if (value[0] === 2) {
          phase = "terminal";
        } else {
          fail("archive_scan_wire_invalid");
        }
      } else if (phase === "member-header") {
        const value = take(74);
        if (value === null) return;
        const pathLength = value.readUInt16BE(0);
        const contentLengthBig = value.readBigUInt64BE(2);
        if (pathLength === 0 || pathLength > maximumMemberPathBytes ||
            contentLengthBig > BigInt(maximumMemberBytes)) {
          fail("archive_scan_wire_invalid");
        }
        const contentLength = Number(contentLengthBig);
        if (totalContentBytes + contentLength > maximumTotalMemberBytes) {
          fail("archive_scan_wire_invalid");
        }
        member = {
          contentLength,
          contentSha256: decodeSha256(value.subarray(10, 74)),
          evidence: null,
          hasher: crypto.createHash("sha256"),
          path: null,
          pathLength,
          remaining: contentLength
        };
        phase = "member-path";
      } else if (phase === "member-path") {
        const value = take(member.pathLength);
        if (value === null) return;
        member.path = validateWirePath(value, collisionKeys);
        member.evidence = Object.freeze({
          contentLength: member.contentLength,
          contentSha256: member.contentSha256,
          path: member.path
        });
        onMemberStart(member.evidence);
        phase = "member-content";
        if (member.remaining === 0) completeMember();
      } else if (phase === "member-content") {
        if (pending.length === 0) return;
        const length = Math.min(member.remaining, pending.length);
        const value = pending.subarray(0, length);
        pending = pending.subarray(length);
        member.hasher.update(value);
        onContent(value);
        member.remaining -= length;
        if (member.remaining === 0) completeMember();
      } else if (phase === "terminal") {
        const value = take(269);
        if (value === null) return;
        const terminalMemberCount = value.readUInt32BE(0);
        const terminalTotalBig = value.readBigUInt64BE(4);
        if (memberCount === 0 || terminalTotalBig > BigInt(maximumTotalMemberBytes) ||
            terminalMemberCount !== memberCount ||
            Number(terminalTotalBig) !== totalContentBytes ||
            value[12] !== expectedFormatCode) {
          fail("archive_scan_wire_invalid");
        }
        const archiveSha256 = decodeSha256(value.subarray(13, 77));
        const manifestSha256 = decodeSha256(value.subarray(77, 141));
        const admissionSha256 = decodeSha256(value.subarray(141, 205));
        const processSha256 = decodeSha256(value.subarray(205, 269));
        if (admissionSha256 !== archiveAdmissionProfileSha256 ||
            processSha256 !== archiveScanProcessProfileSha256 ||
            manifestSha256 !== contentManifestSha256(members)) {
          fail("archive_scan_wire_identity_mismatch");
        }
        result = Object.freeze({
          admissionProfileId: archiveAdmissionProfileId,
          admissionProfileSha256: admissionSha256,
          archiveSha256,
          contentManifestSha256: manifestSha256,
          format: options.format,
          memberCount,
          processProfileId: archiveScanProcessProfileId,
          processProfileSha256: processSha256,
          totalContentBytes
        });
        phase = "done";
        if (pending.length !== 0) fail("archive_scan_wire_trailing_bytes");
        return;
      } else {
        if (pending.length !== 0) fail("archive_scan_wire_trailing_bytes");
        return;
      }
    }
  }

  function write(chunk) {
    if (!Buffer.isBuffer(chunk) || chunk.length === 0 || phase === "done") {
      fail("archive_scan_wire_invalid");
    }
    inputByteCount += chunk.length;
    if (inputByteCount > maximumWireBytes) fail("archive_scan_wire_byte_limit");
    pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);
    processPending();
  }

  function finish() {
    processPending();
    if (phase !== "done" || pending.length !== 0 || result === null) {
      fail("archive_scan_wire_incomplete");
    }
    return result;
  }

  return Object.freeze({ finish, write });
}

function validateFailure(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > maximumStderrBytes) {
    fail("archive_scan_failure_invalid");
  }
  let value;
  try {
    value = parseStrictJson(bytes);
  } catch (_error) {
    fail("archive_scan_failure_invalid");
  }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).join(",") !== "errorCode,schema,status" ||
      JSON.stringify(value) !== bytes.toString("utf8") ||
      value.schema !== archiveScanFailureSchema || value.status !== "failed" ||
      !safeProcessErrorCodes.has(value.errorCode)) {
    fail("archive_scan_failure_invalid");
  }
  return value.errorCode;
}

function invokeScanner(executablePath, archivePath, format, callbacks) {
  const request = Buffer.from(JSON.stringify({
    archivePath,
    format,
    schema: archiveScanRequestSchema
  }), "utf8");
  if (request.length === 0 || request.length > maximumRequestBytes) {
    fail("archive_scan_request_invalid");
  }
  const parser = createArchiveWireParser({ format, ...callbacks });
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = childProcess.spawn(executablePath, [], {
        cwd: path.dirname(executablePath),
        env: {},
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      });
    } catch (_error) {
      reject(Object.assign(new Error("Archive scan process boundary failed"), {
        causeCode: null,
        code: "archive_scan_process_spawn_failed"
      }));
      return;
    }
    let processError = null;
    let stderr = Buffer.alloc(0);
    let stdoutByteCount = 0;
    const timer = setTimeout(() => {
      processError = processError || Object.assign(
        new Error("Archive scan process boundary failed"),
        { causeCode: null, code: "archive_scan_process_timeout" }
      );
      child.kill("SIGKILL");
    }, processTimeoutMilliseconds);

    function stopWith(error) {
      processError = processError || error;
      child.kill("SIGKILL");
    }

    child.stdout.on("data", (chunk) => {
      if (processError !== null) return;
      try {
        stdoutByteCount += chunk.length;
        if (stdoutByteCount > maximumWireBytes) fail("archive_scan_wire_byte_limit");
        parser.write(chunk);
      } catch (error) {
        stopWith(error);
      }
    });
    child.stdout.on("error", () => {
      if (processError === null) {
        stopWith(Object.assign(new Error("Archive scan process boundary failed"), {
          causeCode: null,
          code: "archive_scan_process_output_failed"
        }));
      }
    });
    child.stderr.on("data", (chunk) => {
      if (processError !== null) return;
      if (stderr.length + chunk.length > maximumStderrBytes) {
        try {
          fail("archive_scan_process_stderr_limit");
        } catch (error) {
          stopWith(error);
        }
        return;
      }
      stderr = Buffer.concat([stderr, chunk]);
    });
    child.stderr.on("error", () => {
      if (processError === null) {
        stopWith(Object.assign(new Error("Archive scan process boundary failed"), {
          causeCode: null,
          code: "archive_scan_process_output_failed"
        }));
      }
    });
    child.stdin.on("error", () => {
      if (processError === null) {
        stopWith(Object.assign(new Error("Archive scan process boundary failed"), {
          causeCode: null,
          code: "archive_scan_process_input_failed"
        }));
      }
    });
    child.on("error", () => {
      processError = processError || Object.assign(
        new Error("Archive scan process boundary failed"),
        { causeCode: null, code: "archive_scan_process_spawn_failed" }
      );
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      try {
        if (processError !== null) throw processError;
        if (signal !== null) fail("archive_scan_process_failed");
        if (status === 2) {
          if (stdoutByteCount !== 0) fail("archive_scan_failure_output_invalid");
          fail("archive_scan_helper_failed", validateFailure(stderr));
        }
        if (status === 3) {
          fail("archive_scan_output_failed", validateFailure(stderr));
        }
        if (status !== 0 || stderr.length !== 0) fail("archive_scan_process_failed");
        resolve(parser.finish());
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(request);
  });
}

function createArchiveScanClient(executablePathInput) {
  const executablePath = normalizeObservedFile(
    executablePathInput,
    maximumExecutableBytes,
    "archive_scan_executable_invalid"
  );
  const initialIdentity = hashRegularFile(
    executablePath,
    maximumExecutableBytes,
    "archive_scan_executable_read_failed"
  );

  async function scan(options) {
    if (!options || typeof options !== "object" ||
        !["zip", "tar-gzip"].includes(options.format)) {
      fail("archive_scan_options_invalid");
    }
    const archivePath = normalizeObservedFile(
      options.archivePath,
      maximumArchiveBytes,
      "archive_scan_archive_invalid"
    );
    const before = hashRegularFile(
      executablePath,
      maximumExecutableBytes,
      "archive_scan_executable_read_failed"
    );
    if (before.byteCount !== initialIdentity.byteCount ||
        before.sha256 !== initialIdentity.sha256) {
      fail("archive_scan_executable_changed");
    }
    const result = await invokeScanner(executablePath, archivePath, options.format, {
      onContent: options.onContent,
      onMemberEnd: options.onMemberEnd,
      onMemberStart: options.onMemberStart
    });
    const after = hashRegularFile(
      executablePath,
      maximumExecutableBytes,
      "archive_scan_executable_read_failed"
    );
    if (after.byteCount !== initialIdentity.byteCount ||
        after.sha256 !== initialIdentity.sha256) {
      fail("archive_scan_executable_changed");
    }
    return Object.freeze({
      ...result,
      executableByteCount: after.byteCount,
      executableSha256: after.sha256
    });
  }

  return Object.freeze({
    executableIdentity: initialIdentity,
    scan
  });
}

module.exports = Object.freeze({
  archiveAdmissionProfileId,
  archiveAdmissionProfileSha256,
  archiveFormatForPath,
  archiveScanProcessProfileId,
  archiveScanProcessProfileSha256,
  createArchiveScanClient,
  createArchiveWireParser
});

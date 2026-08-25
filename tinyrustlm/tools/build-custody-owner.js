"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const windowsMsvcEnvironment = require("./windows-x64-msvc-environment.js");

const profileId = "tinyrustlm.source-controlled-build-custody/4";
const profileByteLength = 10274;
const profileSha256 =
  "26b75c36911c14d744a764c19d8a40ec0c28762add5e6616501080120aad9b45";
const requestSchema = "tinyrustlm.build-custody-request.v4";
const bindingSchema = "tinyrustlm.build-custody-binding.v4";
const startSchema = "tinyrustlm.build-custody-start.v4";
const processTerminalSchema = "tinyrustlm.build-custody-process-terminal.v4";
const scratchInspectionProcessTerminalSchema =
  "tinyrustlm.build-custody-scratch-inspection-process-terminal.v4";
const terminalSchema = "tinyrustlm.build-custody-terminal.v4";
const summarySchema = "tinyrustlm.build-custody-summary.v4";
const maximumRequestBytes = 262144;
const maximumBindingBytes = 1048576;
const maximumTerminalBytes = 4194304;
const maximumEnvironmentRequestBytes = 262144;
const maximumEnvironmentPrivateBindingBytes = 4194304;
const maximumEnvironmentPublicLockBytes = 16777216;
const maximumEnvironmentTerminalBytes = 1048576;
const maximumEnvironmentValidationMilliseconds = 600000;
const maximumEnvironmentValidationOutputBytes = 1048576;
const maximumScratchInspectionRequestBytes = 262144;
const maximumScratchInspectionObservationBytes = 1048576;
const maximumScratchInspectionProcessTerminalBytes = 1048576;
const maximumScratchInspectionDurationMilliseconds = 600000;
const maximumScratchInspectionPathBytes = 16384;
const maximumArguments = 128;
const maximumArgumentBytes = 32768;
const maximumEnvironmentEntries = 128;
const maximumSupplementalEnvironmentEntries = 64;
const maximumEnvironmentValueBytes = 32768;
const maximumDurationMilliseconds = 7200000;
const maximumStdoutBytes = 16777216;
const maximumStderrBytes = 16777216;
const maximumTargetEntries = 131072;
const maximumTargetBytes = 17179869184;
const maximumEnvironmentScratchEntries = 131072;
const maximumEnvironmentScratchBytes = 1073741824;
const maximumEnvironmentScratchJunctions = 64;
const maximumRequiredOutputs = 16;
const hashBufferBytes = 1048576;
const maximumTerminationOutputBytes = 65536;
const maximumObserverGraceMilliseconds = 120000;
const commitPattern = /^[a-f0-9]{40}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/u;
const environmentNamePattern = /^[A-Za-z_][A-Za-z0-9_()]{0,63}$/u;
const safeErrorPattern = /^[a-z0-9][a-z0-9-]{2,127}$/u;
const scratchInspectionErrorPattern = /^scratch_inspection_[a-z0-9_]{2,120}$/u;
const requiredWindowsSupplementNames = Object.freeze(["APPDATA", "HOMEDRIVE",
  "HOMEPATH", "LOCALAPPDATA", "LOGONSERVER", "SYSTEMDRIVE", "SystemRoot", "TEMP",
  "TMP", "USERDOMAIN", "USERNAME", "USERPROFILE", "WINDIR"]);
const requiredEnvironmentDirectories = Object.freeze(["home", "home/AppData",
  "home/AppData/Local", "home/AppData/Roaming", "temp"]);
const windowsWorkerEnvironmentNames = Object.freeze(["HOMEDRIVE", "HOMEPATH",
  "LOGONSERVER", "PATH", "SYSTEMDRIVE", "SystemRoot", "TEMP", "USERDOMAIN",
  "USERNAME", "USERPROFILE", "WINDIR"]);
const environmentOwnerByteLength = 54052;
const environmentOwnerSha256 =
  "48b550da9fa0a81735467d2af6dc733fa5ba2df4e9f815e505c37b57bfdb4ebf";
const environmentProfileId = "tinyrustlm.windows-x64-msvc-environment/1";
const environmentProfileByteLength = 6510;
const environmentProfileSha256 =
  "76de6c5985c000dadedefa457286111af80ebd2deb6e6e3d8de246f6a0eed607";
const environmentPrivateBindingSchema =
  "tinyrustlm.windows_x64_msvc_environment_private_binding.v1";
const environmentPublicLockSchema =
  "tinyrustlm.windows_x64_msvc_environment_public_lock.v1";
const environmentTerminalSchema =
  "tinyrustlm.windows_x64_msvc_environment_terminal.v1";
const scratchInspectionProfileId = "tinyrustlm.build-scratch-inspection/1";
const scratchInspectionProfileByteLength = 3170;
const scratchInspectionProfileSha256 =
  "08a2c5cb57cff8b260972129efcdfbcd2e598b51a5d6660f3c11c83a0be05aef";
const scratchInspectionRequestSchema =
  "tinyrustlm.build-scratch-inspection-request.v1";
const scratchInspectionObservationSchema =
  "tinyrustlm.build-scratch-inspection-observation.v1";
const scratchInspectionJunctionSchema =
  "tinyrustlm.build-scratch-inspection-junction.v1";
const scratchInspectionFailureSchema =
  "tinyrustlm.build-scratch-inspection-failure.v1";

function invariant(condition, code) {
  if (!condition) throw new Error(code);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactKeys(value, expected, code) {
  invariant(isPlainObject(value), code);
  const actual = Object.keys(value);
  invariant(actual.length === expected.length, code);
  invariant(actual.every((key, index) => key === expected[index]), code);
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function safeErrorCode(error, fallback = "build-custody-error") {
  const candidate = error instanceof Error ? error.message : fallback;
  return safeErrorPattern.test(candidate) ? candidate : fallback;
}

function requireSafeInteger(value, minimum, maximum, code) {
  invariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum, code);
  return value;
}

function requireSha256(value, code) {
  invariant(typeof value === "string" && sha256Pattern.test(value), code);
  return value;
}

function requireCommit(value, code) {
  invariant(typeof value === "string" && commitPattern.test(value), code);
  return value;
}

function requireCanonicalAbsolutePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 && path.isAbsolute(value), code);
  invariant(path.resolve(value) === value, code);
  return value;
}

function inspectPathComponents(targetPath, code) {
  const normalized = requireCanonicalAbsolutePath(targetPath, code);
  const parsed = path.parse(normalized);
  let current = parsed.root;
  const remainder = normalized.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const component of remainder) {
    current = path.join(current, component);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      throw new Error(code);
    }
    invariant(!stat.isSymbolicLink(), code);
  }
  return normalized;
}

function inspectDirectDirectory(directoryPath, code) {
  const normalized = inspectPathComponents(directoryPath, code);
  const stat = fs.lstatSync(normalized);
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), code);
  return normalized;
}

function inspectRegularFile(filePath, maximumBytes, allowEmpty, code) {
  const normalized = inspectPathComponents(filePath, code);
  const stat = fs.lstatSync(normalized);
  invariant(stat.isFile() && !stat.isSymbolicLink(), code);
  invariant(Number.isSafeInteger(stat.size), code);
  invariant((allowEmpty ? stat.size >= 0 : stat.size > 0) && stat.size <= maximumBytes, code);
  return Object.freeze({ path: normalized, byteLength: stat.size });
}

function sha256File(filePath, maximumBytes = maximumTargetBytes, allowEmpty = false,
  code = "build-custody-file-invalid") {
  const file = inspectRegularFile(filePath, maximumBytes, allowEmpty,
    code);
  const digest = crypto.createHash("sha256");
  const descriptor = fs.openSync(file.path, "r");
  const buffer = Buffer.allocUnsafe(hashBufferBytes);
  try {
    let offset = 0;
    while (offset < file.byteLength) {
      const read = fs.readSync(descriptor, buffer, 0,
        Math.min(buffer.length, file.byteLength - offset), offset);
      invariant(read > 0, "build-custody-file-short-read");
      digest.update(buffer.subarray(0, read));
      offset += read;
    }
    invariant(fs.fstatSync(descriptor).size === file.byteLength,
      "build-custody-file-drift");
  } finally {
    fs.closeSync(descriptor);
  }
  return Object.freeze({ byteLength: file.byteLength, sha256: digest.digest("hex") });
}

function readCanonicalJson(filePath, maximumBytes, code) {
  const artifact = sha256File(filePath, maximumBytes, false, code);
  const bytes = fs.readFileSync(filePath);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(code);
  }
  invariant(isPlainObject(value), code);
  invariant(bytes.equals(Buffer.from(canonicalJson(value), "utf8")), code);
  return Object.freeze({ artifact, bytes, value });
}

function writeNewDurable(filePath, bytes, maximumBytes, allowEmpty = false) {
  invariant(Buffer.isBuffer(bytes) && (allowEmpty || bytes.length > 0) &&
    bytes.length <= maximumBytes,
    "build-custody-evidence-size");
  const descriptor = fs.openSync(filePath, "wx");
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      invariant(written > 0, "build-custody-evidence-short-write");
      offset += written;
    }
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  return Object.freeze({ byteLength: bytes.length, sha256: sha256(bytes) });
}

function writeCanonicalNew(filePath, value, maximumBytes) {
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  writeNewDurable(filePath, bytes, maximumBytes);
  return Object.freeze({ byteLength: bytes.length, sha256: sha256(bytes) });
}

function safeChild(root, fileName, code) {
  invariant(typeof fileName === "string" && path.basename(fileName) === fileName, code);
  const target = path.resolve(root, fileName);
  invariant(path.dirname(target) === root, code);
  return target;
}

function requireSafeRelativePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 && value.length <= 512, code);
  invariant(!path.isAbsolute(value) && !value.includes("\\") && !value.includes(":"), code);
  const components = value.split("/");
  invariant(components.length > 0 && components.every((entry) => entry.length > 0 &&
    entry !== "." && entry !== ".."), code);
  return value;
}

function resolveRelative(root, relativePath, code) {
  const safe = requireSafeRelativePath(relativePath, code);
  const target = path.resolve(root, ...safe.split("/"));
  const relative = path.relative(root, target);
  invariant(relative.length > 0 && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`), code);
  return target;
}

function isAncestorOrSame(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function requireSeparated(paths, code) {
  for (let left = 0; left < paths.length; left += 1) {
    for (let right = left + 1; right < paths.length; right += 1) {
      invariant(!isAncestorOrSame(paths[left], paths[right]) &&
        !isAncestorOrSame(paths[right], paths[left]), code);
    }
  }
}

function systemRootFromTerminationPath(terminationPath) {
  return path.dirname(path.dirname(terminationPath));
}

function isolatedToolEnvironment(terminationPath) {
  return Object.freeze({
    GIT_CONFIG_GLOBAL: "NUL",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
    SystemRoot: systemRootFromTerminationPath(terminationPath)
  });
}

function detachedWorkerEnvironment(terminationPath) {
  return Object.freeze({
    SystemRoot: systemRootFromTerminationPath(terminationPath)
  });
}

function workerEnvironmentConstrained(terminationPath) {
  const names = Object.keys(process.env).sort();
  const constrained = names.length === windowsWorkerEnvironmentNames.length &&
    names.every((name, index) => name === windowsWorkerEnvironmentNames[index]) &&
    process.env.SystemRoot === systemRootFromTerminationPath(terminationPath);
  return Object.freeze({ names: Object.freeze(names), constrained });
}

function git(repositoryRoot, gitPath, terminationPath, argumentsList) {
  const environment = isolatedToolEnvironment(terminationPath);
  return childProcess.execFileSync(gitPath, argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: environment,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  }).trim();
}

function repositoryRelative(repositoryRoot, filePath, code) {
  const relative = path.relative(repositoryRoot, filePath);
  invariant(relative.length > 0 && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), code);
  return relative.split(path.sep).join("/");
}

function validateCommittedFile(repositoryRoot, gitPath, terminationPath, commit, filePath,
  artifact, code) {
  const relative = repositoryRelative(repositoryRoot, filePath, code);
  const liveBlob = git(repositoryRoot, gitPath, terminationPath,
    ["hash-object", "--", filePath]);
  const committedBlob = git(repositoryRoot, gitPath, terminationPath,
    ["rev-parse", `${commit}:${relative}`]);
  invariant(liveBlob === committedBlob, code);
  const live = sha256File(filePath, artifact.byteLength, false, code);
  invariant(live.byteLength === artifact.byteLength && live.sha256 === artifact.sha256, code);
  return relative;
}

function inspectPeMachine(executablePath) {
  const descriptor = fs.openSync(executablePath, "r");
  try {
    const dos = Buffer.alloc(64);
    invariant(fs.readSync(descriptor, dos, 0, dos.length, 0) === dos.length,
      "build-custody-output-pe");
    invariant(dos.readUInt16LE(0) === 0x5a4d, "build-custody-output-pe");
    const peOffset = dos.readUInt32LE(0x3c);
    invariant(peOffset >= 64 && peOffset <= 16 * 1024 * 1024,
      "build-custody-output-pe");
    const header = Buffer.alloc(6);
    invariant(fs.readSync(descriptor, header, 0, header.length, peOffset) === header.length,
      "build-custody-output-pe");
    invariant(header.readUInt32LE(0) === 0x00004550, "build-custody-output-pe");
    return `0x${header.readUInt16LE(4).toString(16).padStart(4, "0")}`;
  } finally {
    fs.closeSync(descriptor);
  }
}

function validateArtifactReference(value, maximumBytes, code, expected = null) {
  requireExactKeys(value, ["path", "byteLength", "sha256"], code);
  requireCanonicalAbsolutePath(value.path, code);
  requireSafeInteger(value.byteLength, 1, maximumBytes, code);
  requireSha256(value.sha256, code);
  if (expected !== null) {
    invariant(value.byteLength === expected.byteLength &&
      value.sha256 === expected.sha256, code);
  }
}

function validateEnvironmentEntries(entries, maximumEntries, code) {
  invariant(Array.isArray(entries) && entries.length > 0 &&
    entries.length <= maximumEntries, code);
  let previousEnvironmentName = null;
  const names = new Set();
  for (const entry of entries) {
    requireExactKeys(entry, ["name", "value"], `${code}-entry`);
    invariant(environmentNamePattern.test(entry.name), `${code}-name`);
    invariant(typeof entry.value === "string" && !entry.value.includes("\u0000") &&
      Buffer.byteLength(entry.value, "utf8") <= maximumEnvironmentValueBytes,
    `${code}-value`);
    const canonicalName = entry.name.toUpperCase();
    invariant(!names.has(canonicalName) &&
      (previousEnvironmentName === null || previousEnvironmentName < canonicalName),
    `${code}-order`);
    names.add(canonicalName);
    previousEnvironmentName = canonicalName;
  }
  return names;
}

function validateRequestShape(request) {
  requireExactKeys(request, ["schema", "operationId", "profile", "source", "runtime",
    "environmentAuthority", "scratchInspection", "command", "roots", "capture",
    "termination", "outputs"],
  "build-custody-request-fields");
  invariant(request.schema === requestSchema, "build-custody-request-schema");
  invariant(typeof request.operationId === "string" && safeIdPattern.test(request.operationId),
    "build-custody-operation-id");

  requireExactKeys(request.profile, ["path", "byteLength", "sha256", "profileId"],
    "build-custody-profile-fields");
  requireCanonicalAbsolutePath(request.profile.path, "build-custody-profile-path");
  invariant(request.profile.byteLength === profileByteLength,
    "build-custody-profile-length");
  invariant(request.profile.sha256 === profileSha256, "build-custody-profile-hash");
  invariant(request.profile.profileId === profileId, "build-custody-profile-id");

  requireExactKeys(request.source, ["repositoryRoot", "commit", "tree", "branch",
    "gitPath", "gitByteLength", "gitSha256", "ownerPath", "ownerByteLength",
    "ownerSha256"], "build-custody-source-fields");
  requireCanonicalAbsolutePath(request.source.repositoryRoot, "build-custody-source-root");
  requireCommit(request.source.commit, "build-custody-source-commit");
  requireCommit(request.source.tree, "build-custody-source-tree");
  invariant(typeof request.source.branch === "string" &&
    safeIdPattern.test(request.source.branch), "build-custody-source-branch");
  requireCanonicalAbsolutePath(request.source.gitPath, "build-custody-git-path");
  requireSafeInteger(request.source.gitByteLength, 1, maximumTargetBytes,
    "build-custody-git-length");
  requireSha256(request.source.gitSha256, "build-custody-git-hash");
  requireCanonicalAbsolutePath(request.source.ownerPath, "build-custody-owner-path");
  requireSafeInteger(request.source.ownerByteLength, 1, maximumBindingBytes,
    "build-custody-owner-length");
  requireSha256(request.source.ownerSha256, "build-custody-owner-hash");

  requireExactKeys(request.runtime, ["nodePath", "nodeByteLength", "nodeSha256",
    "nodeVersion", "platform", "architecture"], "build-custody-runtime-fields");
  requireCanonicalAbsolutePath(request.runtime.nodePath, "build-custody-runtime-path");
  requireSafeInteger(request.runtime.nodeByteLength, 1, maximumTargetBytes,
    "build-custody-runtime-length");
  requireSha256(request.runtime.nodeSha256, "build-custody-runtime-hash");
  invariant(typeof request.runtime.nodeVersion === "string" &&
    request.runtime.nodeVersion.length <= 64, "build-custody-runtime-version");
  invariant(request.runtime.platform === "win32", "build-custody-runtime-platform");
  invariant(request.runtime.architecture === "x64", "build-custody-runtime-architecture");

  requireExactKeys(request.environmentAuthority,
    ["owner", "profile", "request", "privateBinding", "publicLock", "terminal"],
    "build-custody-environment-authority-fields");
  validateArtifactReference(request.environmentAuthority.owner, maximumBindingBytes,
    "build-custody-environment-owner", {
      byteLength: environmentOwnerByteLength,
      sha256: environmentOwnerSha256
    });
  requireExactKeys(request.environmentAuthority.profile,
    ["path", "byteLength", "sha256", "profileId"],
    "build-custody-environment-profile");
  requireCanonicalAbsolutePath(request.environmentAuthority.profile.path,
    "build-custody-environment-profile");
  invariant(request.environmentAuthority.profile.byteLength === environmentProfileByteLength &&
    request.environmentAuthority.profile.sha256 === environmentProfileSha256 &&
    request.environmentAuthority.profile.profileId === environmentProfileId,
  "build-custody-environment-profile");
  validateArtifactReference(request.environmentAuthority.request,
    maximumEnvironmentRequestBytes, "build-custody-environment-request");
  validateArtifactReference(request.environmentAuthority.privateBinding,
    maximumEnvironmentPrivateBindingBytes, "build-custody-environment-private-binding");
  validateArtifactReference(request.environmentAuthority.publicLock,
    maximumEnvironmentPublicLockBytes, "build-custody-environment-public-lock");
  validateArtifactReference(request.environmentAuthority.terminal,
    maximumEnvironmentTerminalBytes, "build-custody-environment-terminal");
  const environmentPaths = Object.values(request.environmentAuthority)
    .map((entry) => entry.path.toLowerCase());
  invariant(new Set(environmentPaths).size === environmentPaths.length,
    "build-custody-environment-path-distinct");

  requireExactKeys(request.scratchInspection,
    ["profile", "executableRelativePath", "operationId", "maximumDurationMilliseconds",
      "maximumStdoutBytes"], "build-custody-scratch-inspection-fields");
  requireExactKeys(request.scratchInspection.profile,
    ["path", "byteLength", "sha256", "profileId"],
    "build-custody-scratch-inspection-profile-fields");
  requireCanonicalAbsolutePath(request.scratchInspection.profile.path,
    "build-custody-scratch-inspection-profile-path");
  invariant(request.scratchInspection.profile.byteLength ===
    scratchInspectionProfileByteLength,
  "build-custody-scratch-inspection-profile-length");
  invariant(request.scratchInspection.profile.sha256 === scratchInspectionProfileSha256,
    "build-custody-scratch-inspection-profile-hash");
  invariant(request.scratchInspection.profile.profileId === scratchInspectionProfileId,
    "build-custody-scratch-inspection-profile-id");
  invariant(!environmentPaths.includes(request.scratchInspection.profile.path.toLowerCase()) &&
    request.scratchInspection.profile.path.toLowerCase() !== request.profile.path.toLowerCase(),
  "build-custody-scratch-inspection-profile-distinct");
  requireSafeRelativePath(request.scratchInspection.executableRelativePath,
    "build-custody-scratch-inspection-executable-path");
  invariant(typeof request.scratchInspection.operationId === "string" &&
    safeIdPattern.test(request.scratchInspection.operationId) &&
    request.scratchInspection.operationId !== request.operationId,
  "build-custody-scratch-inspection-operation-id");
  requireSafeInteger(request.scratchInspection.maximumDurationMilliseconds, 1,
    maximumScratchInspectionDurationMilliseconds,
    "build-custody-scratch-inspection-duration");
  invariant(request.scratchInspection.maximumStdoutBytes ===
    maximumScratchInspectionObservationBytes,
  "build-custody-scratch-inspection-stdout-bound");

  requireExactKeys(request.command, ["executablePath", "executableByteLength",
    "executableSha256", "arguments", "workingDirectory", "supplementalEnvironment"],
  "build-custody-command-fields");
  requireCanonicalAbsolutePath(request.command.executablePath,
    "build-custody-command-path");
  requireSafeInteger(request.command.executableByteLength, 1, maximumTargetBytes,
    "build-custody-command-length");
  requireSha256(request.command.executableSha256, "build-custody-command-hash");
  invariant(Array.isArray(request.command.arguments) &&
    request.command.arguments.length <= maximumArguments, "build-custody-arguments");
  for (const argument of request.command.arguments) {
    invariant(typeof argument === "string" && !argument.includes("\u0000") &&
      Buffer.byteLength(argument, "utf8") <= maximumArgumentBytes,
    "build-custody-argument");
  }
  requireCanonicalAbsolutePath(request.command.workingDirectory,
    "build-custody-working-directory");
  validateEnvironmentEntries(request.command.supplementalEnvironment,
    maximumSupplementalEnvironmentEntries, "build-custody-supplemental-environment");
  const supplementalNames = new Set(request.command.supplementalEnvironment
    .map((entry) => entry.name));
  invariant(requiredWindowsSupplementNames.every((name) => supplementalNames.has(name)),
    "build-custody-windows-baseline-supplement");

  requireExactKeys(request.roots, ["controlRoot", "targetRoot", "environmentRoot"],
    "build-custody-root-fields");
  requireCanonicalAbsolutePath(request.roots.controlRoot, "build-custody-control-root");
  requireCanonicalAbsolutePath(request.roots.targetRoot, "build-custody-target-root");
  requireCanonicalAbsolutePath(request.roots.environmentRoot,
    "build-custody-environment-root");

  requireExactKeys(request.capture, ["maximumDurationMilliseconds", "maximumStdoutBytes",
    "maximumStderrBytes"], "build-custody-capture-fields");
  requireSafeInteger(request.capture.maximumDurationMilliseconds, 1,
    maximumDurationMilliseconds, "build-custody-duration-bound");
  requireSafeInteger(request.capture.maximumStdoutBytes, 0, maximumStdoutBytes,
    "build-custody-stdout-bound");
  requireSafeInteger(request.capture.maximumStderrBytes, 0, maximumStderrBytes,
    "build-custody-stderr-bound");

  requireExactKeys(request.termination, ["strategy", "executablePath",
    "executableByteLength", "executableSha256"], "build-custody-termination-fields");
  invariant(request.termination.strategy === "windows-taskkill-tree-v1",
    "build-custody-termination-strategy");
  requireCanonicalAbsolutePath(request.termination.executablePath,
    "build-custody-termination-path");
  requireSafeInteger(request.termination.executableByteLength, 1, maximumTargetBytes,
    "build-custody-termination-length");
  requireSha256(request.termination.executableSha256, "build-custody-termination-hash");

  requireExactKeys(request.outputs, ["maximumEntryCount", "maximumAggregateBytes",
    "maximumEnvironmentEntryCount", "maximumEnvironmentAggregateBytes",
    "maximumEnvironmentJunctionCount", "required"],
  "build-custody-output-fields");
  requireSafeInteger(request.outputs.maximumEntryCount, 1, maximumTargetEntries,
    "build-custody-output-count");
  requireSafeInteger(request.outputs.maximumAggregateBytes, 1, maximumTargetBytes,
    "build-custody-output-bytes");
  requireSafeInteger(request.outputs.maximumEnvironmentEntryCount,
    requiredEnvironmentDirectories.length,
    maximumEnvironmentScratchEntries, "build-custody-environment-output-count");
  requireSafeInteger(request.outputs.maximumEnvironmentAggregateBytes, 1,
    maximumEnvironmentScratchBytes, "build-custody-environment-output-bytes");
  requireSafeInteger(request.outputs.maximumEnvironmentJunctionCount, 0,
    maximumEnvironmentScratchJunctions, "build-custody-environment-junction-count");
  invariant(Array.isArray(request.outputs.required) && request.outputs.required.length > 0 &&
    request.outputs.required.length <= maximumRequiredOutputs,
  "build-custody-required-outputs");
  let previousOutput = null;
  for (const entry of request.outputs.required) {
    requireExactKeys(entry, ["relativePath", "maximumByteLength", "kind"],
      "build-custody-required-output-fields");
    requireSafeRelativePath(entry.relativePath, "build-custody-required-output-path");
    requireSafeInteger(entry.maximumByteLength, 1, maximumTargetBytes,
      "build-custody-required-output-length");
    invariant(["regular-file", "pe-x64"].includes(entry.kind),
      "build-custody-required-output-kind");
    invariant(previousOutput === null || previousOutput < entry.relativePath,
      "build-custody-required-output-order");
    previousOutput = entry.relativePath;
  }
  const scratchOutputs = request.outputs.required.filter((entry) =>
    entry.relativePath === request.scratchInspection.executableRelativePath);
  invariant(scratchOutputs.length === 1 && scratchOutputs[0].kind === "pe-x64",
    "build-custody-scratch-inspection-required-output");
}

function validateProfile(profileDocument) {
  invariant(profileDocument.artifact.byteLength === profileByteLength &&
    profileDocument.artifact.sha256 === profileSha256, "build-custody-profile-identity");
  invariant(profileDocument.value.schema === "tinyrustlm.build-custody-profile.v4" &&
    profileDocument.value.profileId === profileId &&
    profileDocument.value.status === "current-prelaunch-only" &&
    profileDocument.value.platform === "win32" &&
    profileDocument.value.architecture === "x64" &&
    profileDocument.value.environmentAuthority.profileSha256 ===
      environmentProfileSha256 &&
    profileDocument.value.environmentAuthority.ownerSha256 === environmentOwnerSha256 &&
    profileDocument.value.scratchInspectionAuthority.profileSha256 ===
      scratchInspectionProfileSha256 &&
    profileDocument.value.scratchInspectionAuthority.profileByteLength ===
      scratchInspectionProfileByteLength &&
    profileDocument.value.scratchInspectionAuthority.profileId ===
      scratchInspectionProfileId &&
    canonicalJson(profileDocument.value.rootPolicy
      .environmentRootDirectoriesBeforeChild) ===
      canonicalJson(requiredEnvironmentDirectories) &&
    canonicalJson(profileDocument.value.environmentPolicy.windowsBaselineSupplements) ===
      canonicalJson(requiredWindowsSupplementNames) &&
    profileDocument.value.environmentPolicy.applicationDataBindings.APPDATA ===
      "exact-environment-root-home-appdata-roaming-child" &&
    profileDocument.value.environmentPolicy.applicationDataBindings.LOCALAPPDATA ===
      "exact-environment-root-home-appdata-local-child" &&
    profileDocument.value.environmentPolicy.tempAndTmp ===
      "same-exact-environment-root-temp-child",
  "build-custody-profile-contract");
}

function validateScratchInspectionProfile(profileDocument) {
  invariant(profileDocument.artifact.byteLength === scratchInspectionProfileByteLength &&
    profileDocument.artifact.sha256 === scratchInspectionProfileSha256,
  "build-custody-scratch-inspection-profile-identity");
  const profile = profileDocument.value;
  invariant(profile.schema === "tinyrustlm.build-scratch-inspector-profile.v1" &&
    profile.profileId === scratchInspectionProfileId &&
    profile.status === "current-prelaunch-only" && profile.platform === "win32" &&
    profile.architecture === "x64" &&
    profile.schemas.request === scratchInspectionRequestSchema &&
    profile.schemas.observation === scratchInspectionObservationSchema &&
    profile.schemas.junction === scratchInspectionJunctionSchema &&
    profile.schemas.failure === scratchInspectionFailureSchema &&
    profile.limits.maximumRequestBytes === maximumScratchInspectionRequestBytes &&
    profile.limits.maximumObservationBytes === maximumScratchInspectionObservationBytes &&
    profile.limits.maximumEntries === maximumEnvironmentScratchEntries &&
    profile.limits.maximumAggregateBytes === maximumEnvironmentScratchBytes &&
    profile.limits.maximumJunctions === maximumEnvironmentScratchJunctions &&
    profile.junctionPolicy.acceptedTag === "0xa0000003" &&
    profile.processPolicy.stderr === "empty" && profile.processPolicy.network === false &&
    profile.processPolicy.childProcesses === false &&
    profile.processPolicy.filesystemMutation === false &&
    profile.authority.legacySupport === false && profile.authority.retry === false &&
    profile.authority.fallback === false,
  "build-custody-scratch-inspection-profile-contract");
}

function validateArtifact(pathValue, expectedLength, expectedSha256, code) {
  const artifact = sha256File(pathValue, expectedLength, false, code);
  invariant(artifact.byteLength === expectedLength && artifact.sha256 === expectedSha256, code);
  return artifact;
}

function expectedTaskkillPath() {
  invariant(process.platform === "win32" && process.arch === "x64",
    "build-custody-host-platform");
  invariant(typeof process.env.SystemRoot === "string" && process.env.SystemRoot.length > 0,
    "build-custody-system-root");
  return path.resolve(process.env.SystemRoot, "System32", "taskkill.exe");
}

function requireArtifactIdentity(document, reference, code) {
  invariant(document.artifact.byteLength === reference.byteLength &&
    document.artifact.sha256 === reference.sha256, code);
}

function environmentEntriesIdentity(entries) {
  const bytes = Buffer.from(canonicalJson(entries), "utf8");
  return Object.freeze({ byteLength: bytes.length, sha256: sha256(bytes) });
}

function combineBuildEnvironment(authorityEntries, supplementalEntries, systemRoot,
  environmentRoot) {
  const authorityNames = validateEnvironmentEntries(authorityEntries,
    maximumEnvironmentEntries, "build-custody-authority-environment");
  validateEnvironmentEntries(supplementalEntries, maximumSupplementalEnvironmentEntries,
    "build-custody-supplemental-environment");
  for (const entry of supplementalEntries) {
    invariant(!authorityNames.has(entry.name.toUpperCase()),
      "build-custody-environment-authority-overlap");
  }
  const supplemental = new Map(supplementalEntries.map((entry) => [entry.name, entry.value]));
  invariant(supplemental.get("SystemRoot") === systemRoot &&
    supplemental.get("WINDIR") === systemRoot,
  "build-custody-system-root-binding");
  const systemDrive = path.parse(systemRoot).root.slice(0, 2);
  invariant(supplemental.get("SYSTEMDRIVE") === systemDrive,
    "build-custody-system-drive-binding");
  const userProfile = requireCanonicalAbsolutePath(supplemental.get("USERPROFILE"),
    "build-custody-user-profile-binding");
  const appData = requireCanonicalAbsolutePath(supplemental.get("APPDATA"),
    "build-custody-appdata-binding");
  const localAppData = requireCanonicalAbsolutePath(supplemental.get("LOCALAPPDATA"),
    "build-custody-local-appdata-binding");
  const temp = requireCanonicalAbsolutePath(supplemental.get("TEMP"),
    "build-custody-temp-binding");
  const tmp = requireCanonicalAbsolutePath(supplemental.get("TMP"),
    "build-custody-temp-binding");
  invariant(userProfile === path.resolve(environmentRoot, "home"),
    "build-custody-user-profile-binding");
  invariant(appData === path.resolve(userProfile, "AppData", "Roaming"),
    "build-custody-appdata-binding");
  invariant(localAppData === path.resolve(userProfile, "AppData", "Local"),
    "build-custody-local-appdata-binding");
  invariant(temp === path.resolve(environmentRoot, "temp") && tmp === temp,
    "build-custody-temp-binding");
  invariant(supplemental.get("HOMEDRIVE") === path.parse(userProfile).root.slice(0, 2),
    "build-custody-home-drive-binding");
  invariant(`${supplemental.get("HOMEDRIVE")}${supplemental.get("HOMEPATH")}`
    .toLowerCase() === userProfile.toLowerCase(), "build-custody-home-binding");
  invariant(["LOGONSERVER", "USERDOMAIN", "USERNAME"].every((name) =>
    typeof supplemental.get(name) === "string" && supplemental.get(name).length > 0),
  "build-custody-user-identity-binding");
  const entries = [...authorityEntries, ...supplementalEntries]
    .map((entry) => Object.freeze({ name: entry.name, value: entry.value }))
    .sort((left, right) => {
      const leftName = left.name.toUpperCase();
      const rightName = right.name.toUpperCase();
      return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
    });
  validateEnvironmentEntries(entries, maximumEnvironmentEntries,
    "build-custody-combined-environment");
  const environment = Object.create(null);
  for (const entry of entries) environment[entry.name] = entry.value;
  return Object.freeze({
    entries: Object.freeze(entries),
    artifact: environmentEntriesIdentity(entries),
    environment: Object.freeze(environment)
  });
}

function validateSummaryArtifact(value, expected, code) {
  requireExactKeys(value, ["byteLength", "sha256"], code);
  invariant(value.byteLength === expected.byteLength && value.sha256 === expected.sha256,
    code);
}

function validateEnvironmentSummary(summary, request, code) {
  requireExactKeys(summary, ["schema", "operationId", "status", "code", "targetTriple",
    "selected", "privateBinding", "publicLock", "terminal", "rustBuildAssessed",
    "modelQualified", "memoryEndpointsAuthorized", "campaignCreditAuthorized"], code);
  invariant(summary.schema === windowsMsvcEnvironment.summarySchema &&
    summary.operationId.length > 0 && summary.status === "pass" &&
    summary.code === "msvc-environment-validation-pass" &&
    summary.targetTriple === "x86_64-pc-windows-msvc" &&
    summary.rustBuildAssessed === false && summary.modelQualified === false &&
    summary.memoryEndpointsAuthorized === false &&
    summary.campaignCreditAuthorized === false, code);
  requireExactKeys(summary.selected, ["visualStudioProductLineVersion",
    "visualStudioInstallationVersion", "msvcToolsetVersion", "windowsSdkVersion"], code);
  validateSummaryArtifact(summary.privateBinding, request.environmentAuthority.privateBinding,
    code);
  validateSummaryArtifact(summary.publicLock, request.environmentAuthority.publicLock, code);
  validateSummaryArtifact(summary.terminal, request.environmentAuthority.terminal, code);
  return summary;
}

function parseCanonicalProcessJson(bytes, code) {
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0 &&
    bytes.length <= maximumEnvironmentValidationOutputBytes, code);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(code);
  }
  invariant(isPlainObject(value) &&
    bytes.equals(Buffer.from(canonicalJson(value), "utf8")), code);
  return value;
}

function validateEnvironmentInFreshProcess(request) {
  validateArtifact(request.runtime.nodePath, request.runtime.nodeByteLength,
    request.runtime.nodeSha256, "build-custody-environment-validator-runtime");
  const environment = detachedWorkerEnvironment(request.termination.executablePath);
  const result = childProcess.spawnSync(request.runtime.nodePath,
    [request.environmentAuthority.owner.path, "validate",
      request.environmentAuthority.request.path], {
      cwd: environment.SystemRoot,
      env: environment,
      encoding: "buffer",
      windowsHide: true,
      shell: false,
      timeout: maximumEnvironmentValidationMilliseconds,
      maxBuffer: maximumEnvironmentValidationOutputBytes,
      stdio: ["ignore", "pipe", "pipe"]
    });
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0);
  if (result.error || result.status !== 0 || result.signal !== null) {
    if (stdout.length === 0 && stderr.length > 0 &&
        stderr.length <= maximumEnvironmentValidationOutputBytes) {
      try {
        const failure = parseCanonicalProcessJson(stderr,
          "build-custody-environment-validator-error");
        if (failure.schema === "tinyrustlm.windows_x64_msvc_environment_error.v1" &&
            failure.status === "error" && safeErrorPattern.test(failure.code)) {
          throw new Error(failure.code);
        }
      } catch (error) {
        if (safeErrorPattern.test(error.message)) throw error;
      }
    }
    throw new Error("build-custody-environment-validator-process");
  }
  invariant(stderr.length === 0, "build-custody-environment-validator-stderr");
  return validateEnvironmentSummary(parseCanonicalProcessJson(stdout,
    "build-custody-environment-validator-output"), request,
  "build-custody-environment-validator-summary");
}

function openEnvironmentAuthority(request, options = {}) {
  const authority = request.environmentAuthority;
  const expectedOwnerPath = path.resolve(__dirname, "windows-x64-msvc-environment.js");
  invariant(path.resolve(authority.owner.path) === expectedOwnerPath,
    "build-custody-environment-owner-self");
  invariant(windowsMsvcEnvironment.profileId === environmentProfileId &&
    windowsMsvcEnvironment.profileByteLength === environmentProfileByteLength &&
    windowsMsvcEnvironment.profileSha256 === environmentProfileSha256,
  "build-custody-environment-module-profile");

  const ownerArtifact = validateArtifact(authority.owner.path, authority.owner.byteLength,
    authority.owner.sha256, "build-custody-environment-owner-identity");
  const profileArtifact = validateArtifact(authority.profile.path,
    authority.profile.byteLength, authority.profile.sha256,
    "build-custody-environment-profile-identity");
  const requestDocument = readCanonicalJson(authority.request.path,
    maximumEnvironmentRequestBytes, "build-custody-environment-request-json");
  requireArtifactIdentity(requestDocument, authority.request,
    "build-custody-environment-request-identity");
  invariant(requestDocument.value.schema === windowsMsvcEnvironment.requestSchema &&
    requestDocument.value.profile.path === authority.profile.path &&
    requestDocument.value.profile.byteLength === authority.profile.byteLength &&
    requestDocument.value.profile.sha256 === authority.profile.sha256 &&
    requestDocument.value.profile.profileId === authority.profile.profileId,
  "build-custody-environment-request-binding");
  invariant(requestDocument.value.outputs.privateBindingPath ===
    authority.privateBinding.path &&
    requestDocument.value.outputs.publicLockPath === authority.publicLock.path &&
    requestDocument.value.outputs.terminalPath === authority.terminal.path,
  "build-custody-environment-output-binding");

  const testOnlyInProcess = options.testOnlyInProcess === true;
  const validation = testOnlyInProcess
    ? windowsMsvcEnvironment.validateMaterialization(authority.request.path)
    : validateEnvironmentInFreshProcess(request);
  invariant(validation.status === "pass" &&
    validation.code === "msvc-environment-validation-pass" &&
    validation.targetTriple === "x86_64-pc-windows-msvc" &&
    validation.operationId === requestDocument.value.operationId,
  "build-custody-environment-validation");

  const privateBindingDocument = readCanonicalJson(authority.privateBinding.path,
    maximumEnvironmentPrivateBindingBytes,
    "build-custody-environment-private-binding-json");
  const publicLockDocument = readCanonicalJson(authority.publicLock.path,
    maximumEnvironmentPublicLockBytes, "build-custody-environment-public-lock-json");
  const terminalDocument = readCanonicalJson(authority.terminal.path,
    maximumEnvironmentTerminalBytes, "build-custody-environment-terminal-json");
  requireArtifactIdentity(privateBindingDocument, authority.privateBinding,
    "build-custody-environment-private-binding-identity");
  requireArtifactIdentity(publicLockDocument, authority.publicLock,
    "build-custody-environment-public-lock-identity");
  requireArtifactIdentity(terminalDocument, authority.terminal,
    "build-custody-environment-terminal-identity");

  const privateBinding = privateBindingDocument.value;
  const publicLock = publicLockDocument.value;
  const terminal = terminalDocument.value;
  invariant(privateBinding.schema === environmentPrivateBindingSchema &&
    publicLock.schema === environmentPublicLockSchema &&
    terminal.schema === environmentTerminalSchema &&
    privateBinding.operationId === requestDocument.value.operationId &&
    publicLock.operationId === requestDocument.value.operationId &&
    terminal.operationId === requestDocument.value.operationId,
  "build-custody-environment-document-binding");
  invariant(terminal.status === "pass" &&
    terminal.code === "msvc-environment-materialized" &&
    terminal.request.byteLength === authority.request.byteLength &&
    terminal.request.sha256 === authority.request.sha256 &&
    terminal.privateBinding.byteLength === authority.privateBinding.byteLength &&
    terminal.privateBinding.sha256 === authority.privateBinding.sha256 &&
    terminal.publicLock.byteLength === authority.publicLock.byteLength &&
    terminal.publicLock.sha256 === authority.publicLock.sha256,
  "build-custody-environment-terminal-binding");
  invariant(publicLock.privateBinding.byteLength === authority.privateBinding.byteLength &&
    publicLock.privateBinding.sha256 === authority.privateBinding.sha256 &&
    validation.privateBinding.byteLength === authority.privateBinding.byteLength &&
    validation.privateBinding.sha256 === authority.privateBinding.sha256 &&
    validation.publicLock.byteLength === authority.publicLock.byteLength &&
    validation.publicLock.sha256 === authority.publicLock.sha256 &&
    validation.terminal.byteLength === authority.terminal.byteLength &&
    validation.terminal.sha256 === authority.terminal.sha256,
  "build-custody-environment-validation-binding");
  invariant(privateBinding.profile.path === authority.profile.path &&
    privateBinding.profile.byteLength === authority.profile.byteLength &&
    privateBinding.profile.sha256 === authority.profile.sha256 &&
    privateBinding.request.path === authority.request.path &&
    privateBinding.request.byteLength === authority.request.byteLength &&
    privateBinding.request.sha256 === authority.request.sha256,
  "build-custody-environment-private-binding");
  invariant(systemRootFromTerminationPath(request.termination.executablePath) ===
    privateBinding.discovery.systemRoot.path,
  "build-custody-environment-system-root-cross-binding");

  const combined = combineBuildEnvironment(privateBinding.environment.entries,
    request.command.supplementalEnvironment, privateBinding.discovery.systemRoot.path,
    request.roots.environmentRoot);
  invariant(privateBinding.environment.linkerPath ===
    privateBinding.environment.entries.find((entry) =>
      entry.name === "CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER")?.value,
  "build-custody-environment-linker-binding");
  return Object.freeze({
    operationId: terminal.operationId,
    selected: Object.freeze({ ...terminal.selected }),
    ownerArtifact,
    profileArtifact,
    requestArtifact: requestDocument.artifact,
    privateBindingArtifact: privateBindingDocument.artifact,
    publicLockArtifact: publicLockDocument.artifact,
    terminalArtifact: terminalDocument.artifact,
    authorityEnvironmentArtifact: environmentEntriesIdentity(
      privateBinding.environment.entries),
    combinedEnvironmentArtifact: combined.artifact,
    environment: combined.environment,
    entries: combined.entries,
    linkerSha256: sha256(Buffer.from(privateBinding.environment.linkerPath, "utf8")),
    validationCode: validation.code,
    validationProcess: testOnlyInProcess ? "in-process-test-only" : "fresh-exact-node"
  });
}

function environmentEvidence(environmentAuthority) {
  return Object.freeze({
    operationId: environmentAuthority.operationId,
    selected: environmentAuthority.selected,
    owner: environmentAuthority.ownerArtifact,
    profile: environmentAuthority.profileArtifact,
    request: environmentAuthority.requestArtifact,
    privateBinding: environmentAuthority.privateBindingArtifact,
    publicLock: environmentAuthority.publicLockArtifact,
    terminal: environmentAuthority.terminalArtifact,
    authorityEnvironment: environmentAuthority.authorityEnvironmentArtifact,
    combinedEnvironment: environmentAuthority.combinedEnvironmentArtifact,
    linkerValueSha256: environmentAuthority.linkerSha256,
    validationCode: environmentAuthority.validationCode,
    validationProcess: environmentAuthority.validationProcess
  });
}

function revalidateEnvironmentAuthority(prepared) {
  const reopened = openEnvironmentAuthority(prepared.request, {
    testOnlyInProcess: prepared.testOnlyInProcess
  });
  const initial = prepared.environmentAuthority;
  invariant(reopened.ownerArtifact.sha256 === initial.ownerArtifact.sha256 &&
    reopened.profileArtifact.sha256 === initial.profileArtifact.sha256 &&
    reopened.requestArtifact.sha256 === initial.requestArtifact.sha256 &&
    reopened.privateBindingArtifact.sha256 === initial.privateBindingArtifact.sha256 &&
    reopened.publicLockArtifact.sha256 === initial.publicLockArtifact.sha256 &&
    reopened.terminalArtifact.sha256 === initial.terminalArtifact.sha256 &&
    reopened.authorityEnvironmentArtifact.sha256 ===
      initial.authorityEnvironmentArtifact.sha256 &&
    reopened.combinedEnvironmentArtifact.sha256 ===
      initial.combinedEnvironmentArtifact.sha256 &&
    reopened.linkerSha256 === initial.linkerSha256 &&
    reopened.validationProcess === initial.validationProcess,
  "build-custody-environment-drift");
  return environmentEvidence(reopened);
}

function prepareRequest(requestPath, options = {}) {
  const testOnlyInProcess = options.testOnlyInProcess === true;
  const requestDocument = readCanonicalJson(
    requireCanonicalAbsolutePath(requestPath, "build-custody-request-path"),
    maximumRequestBytes,
    "build-custody-request-json"
  );
  const request = requestDocument.value;
  validateRequestShape(request);

  const profileDocument = readCanonicalJson(request.profile.path, profileByteLength,
    "build-custody-profile-json");
  validateProfile(profileDocument);
  const scratchInspectionProfileDocument = readCanonicalJson(
    request.scratchInspection.profile.path, scratchInspectionProfileByteLength,
    "build-custody-scratch-inspection-profile-json");
  validateScratchInspectionProfile(scratchInspectionProfileDocument);

  const repositoryRoot = inspectDirectDirectory(request.source.repositoryRoot,
    "build-custody-source-root");
  const gitPath = inspectRegularFile(request.source.gitPath, maximumTargetBytes, false,
    "build-custody-git-file").path;
  const gitArtifact = validateArtifact(gitPath, request.source.gitByteLength,
    request.source.gitSha256, "build-custody-git-identity");
  const ownerPath = inspectRegularFile(request.source.ownerPath, maximumBindingBytes, false,
    "build-custody-owner-file").path;
  invariant(path.resolve(__filename) === ownerPath, "build-custody-owner-self");
  const ownerArtifact = validateArtifact(ownerPath, request.source.ownerByteLength,
    request.source.ownerSha256, "build-custody-owner-identity");
  const profileArtifact = validateArtifact(request.profile.path, request.profile.byteLength,
    request.profile.sha256, "build-custody-profile-identity");
  const scratchInspectionProfileArtifact = validateArtifact(
    request.scratchInspection.profile.path, request.scratchInspection.profile.byteLength,
    request.scratchInspection.profile.sha256,
    "build-custody-scratch-inspection-profile-identity");
  const terminationArtifact = validateArtifact(request.termination.executablePath,
    request.termination.executableByteLength, request.termination.executableSha256,
    "build-custody-termination-identity");
  invariant(request.termination.executablePath.toLowerCase() ===
    expectedTaskkillPath().toLowerCase(), "build-custody-termination-system-path");
  invariant(git(repositoryRoot, gitPath, request.termination.executablePath,
    ["rev-parse", "HEAD"]) === request.source.commit,
    "build-custody-source-head");
  invariant(git(repositoryRoot, gitPath, request.termination.executablePath,
    ["rev-parse", "HEAD^{tree}"]) === request.source.tree,
    "build-custody-source-tree");
  invariant(git(repositoryRoot, gitPath, request.termination.executablePath,
    ["branch", "--show-current"]) === request.source.branch,
    "build-custody-source-branch");
  invariant(git(repositoryRoot, gitPath, request.termination.executablePath,
    ["status", "--porcelain=v1", "--untracked-files=all"]) === "",
    "build-custody-source-dirty");
  const ownerRelativePath = validateCommittedFile(repositoryRoot, gitPath,
    request.termination.executablePath, request.source.commit, ownerPath, ownerArtifact,
    "build-custody-owner-uncommitted");
  const profileRelativePath = validateCommittedFile(repositoryRoot, gitPath,
    request.termination.executablePath, request.source.commit, request.profile.path,
    profileArtifact, "build-custody-profile-uncommitted");
  const scratchInspectionProfileRelativePath = validateCommittedFile(repositoryRoot, gitPath,
    request.termination.executablePath, request.source.commit,
    request.scratchInspection.profile.path, scratchInspectionProfileArtifact,
    "build-custody-scratch-inspection-profile-uncommitted");
  const environmentOwnerPath = inspectRegularFile(request.environmentAuthority.owner.path,
    maximumBindingBytes, false, "build-custody-environment-owner-file").path;
  invariant(environmentOwnerPath ===
    path.resolve(__dirname, "windows-x64-msvc-environment.js"),
  "build-custody-environment-owner-self");
  const environmentOwnerArtifact = validateArtifact(environmentOwnerPath,
    request.environmentAuthority.owner.byteLength,
    request.environmentAuthority.owner.sha256,
    "build-custody-environment-owner-identity");
  const environmentProfileArtifact = validateArtifact(
    request.environmentAuthority.profile.path,
    request.environmentAuthority.profile.byteLength,
    request.environmentAuthority.profile.sha256,
    "build-custody-environment-profile-identity");
  const environmentOwnerRelativePath = validateCommittedFile(repositoryRoot, gitPath,
    request.termination.executablePath, request.source.commit, environmentOwnerPath,
    environmentOwnerArtifact, "build-custody-environment-owner-uncommitted");
  const environmentProfileRelativePath = validateCommittedFile(repositoryRoot, gitPath,
    request.termination.executablePath, request.source.commit,
    request.environmentAuthority.profile.path, environmentProfileArtifact,
    "build-custody-environment-profile-uncommitted");

  invariant(path.resolve(process.execPath) === request.runtime.nodePath,
    "build-custody-runtime-self");
  invariant(process.version === request.runtime.nodeVersion &&
    process.platform === request.runtime.platform && process.arch === request.runtime.architecture,
  "build-custody-runtime-properties");
  const runtimeArtifact = validateArtifact(request.runtime.nodePath,
    request.runtime.nodeByteLength, request.runtime.nodeSha256,
    "build-custody-runtime-identity");
  const commandArtifact = validateArtifact(request.command.executablePath,
    request.command.executableByteLength, request.command.executableSha256,
    "build-custody-command-identity");
  const workingDirectory = inspectDirectDirectory(request.command.workingDirectory,
    "build-custody-working-directory");

  const controlParent = inspectDirectDirectory(path.dirname(request.roots.controlRoot),
    "build-custody-control-parent");
  const targetParent = inspectDirectDirectory(path.dirname(request.roots.targetRoot),
    "build-custody-target-parent");
  const environmentParent = inspectDirectDirectory(path.dirname(
    request.roots.environmentRoot), "build-custody-environment-parent");
  invariant(controlParent === targetParent && controlParent === environmentParent,
    "build-custody-root-siblings");
  requireSeparated([repositoryRoot, request.roots.controlRoot, request.roots.targetRoot,
    request.roots.environmentRoot], "build-custody-root-overlap");
  const privateInputs = [requestPath, request.environmentAuthority.request.path,
    request.environmentAuthority.privateBinding.path,
    request.environmentAuthority.publicLock.path,
    request.environmentAuthority.terminal.path];
  invariant(new Set(privateInputs.map((entry) => path.resolve(entry).toLowerCase())).size ===
    privateInputs.length, "build-custody-private-input-distinct");
  for (const privateInput of privateInputs) {
    invariant(!isAncestorOrSame(repositoryRoot, privateInput) &&
      !isAncestorOrSame(request.roots.controlRoot, privateInput) &&
      !isAncestorOrSame(request.roots.targetRoot, privateInput) &&
      !isAncestorOrSame(request.roots.environmentRoot, privateInput) &&
      !isAncestorOrSame(privateInput, request.roots.controlRoot) &&
      !isAncestorOrSame(privateInput, request.roots.targetRoot) &&
      !isAncestorOrSame(privateInput, request.roots.environmentRoot),
    "build-custody-private-input-overlap");
  }
  invariant(!fs.existsSync(request.roots.controlRoot), "build-custody-control-root-exists");
  invariant(!fs.existsSync(request.roots.targetRoot), "build-custody-target-root-exists");
  invariant(!fs.existsSync(request.roots.environmentRoot),
    "build-custody-environment-root-exists");
  for (const output of request.outputs.required) {
    resolveRelative(request.roots.targetRoot, output.relativePath,
      "build-custody-required-output-path");
  }
  const environmentAuthority = openEnvironmentAuthority(request, { testOnlyInProcess });

  return Object.freeze({
    request,
    requestDocument,
    profileDocument,
    scratchInspectionProfileDocument,
    source: Object.freeze({
      repositoryRoot,
      gitPath,
      gitArtifact,
      ownerPath,
      ownerRelativePath,
      ownerArtifact,
      profileRelativePath,
      profileArtifact,
      scratchInspectionProfileRelativePath,
      scratchInspectionProfileArtifact,
      environmentOwnerPath,
      environmentOwnerRelativePath,
      environmentOwnerArtifact,
      environmentProfileRelativePath,
      environmentProfileArtifact
    }),
    runtimeArtifact,
    commandArtifact,
    terminationArtifact,
    workingDirectory,
    testOnlyInProcess,
    environmentAuthority,
    environment: environmentAuthority.environment
  });
}

function createBoundedCapture(filePath, maximumBytes) {
  const descriptor = fs.openSync(filePath, "wx");
  let byteLength = 0;
  let overflow = false;
  let closed = false;
  return Object.freeze({
    append(chunk) {
      invariant(!closed, "build-custody-capture-closed");
      if (overflow) return true;
      const remaining = maximumBytes + 1 - byteLength;
      const accepted = chunk.subarray(0, Math.max(0, remaining));
      let offset = 0;
      while (offset < accepted.length) {
        const written = fs.writeSync(descriptor, accepted, offset,
          accepted.length - offset, null);
        invariant(written > 0, "build-custody-capture-short-write");
        offset += written;
      }
      byteLength += accepted.length;
      if (byteLength > maximumBytes || accepted.length < chunk.length) overflow = true;
      return overflow;
    },
    close() {
      invariant(!closed, "build-custody-capture-double-close");
      closed = true;
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      const artifact = sha256File(filePath, maximumBytes + 1, true);
      return Object.freeze({ ...artifact, overflow });
    }
  });
}

function terminateProcessTree(child, prepared, dependencies) {
  const spawnSync = dependencies.spawnSync || childProcess.spawnSync;
  const result = {
    attempted: true,
    strategy: prepared.request.termination.strategy,
    helperStatus: null,
    helperSignal: null,
    helperErrorCode: null,
    directKillAttempted: false,
    directKillAccepted: false
  };
  try {
    const environment = detachedWorkerEnvironment(
      prepared.request.termination.executablePath);
    const helper = spawnSync(prepared.request.termination.executablePath,
      ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        encoding: "buffer",
        env: environment,
        timeout: 30000,
        maxBuffer: maximumTerminationOutputBytes,
        stdio: ["ignore", "pipe", "pipe"]
      });
    result.helperStatus = helper.status;
    result.helperSignal = helper.signal;
    result.helperErrorCode = helper.error ? "build-custody-taskkill-error" : null;
  } catch {
    result.helperErrorCode = "build-custody-taskkill-error";
  }
  result.directKillAttempted = true;
  try {
    result.directKillAccepted = child.kill("SIGKILL");
  } catch {
    result.directKillAccepted = false;
  }
  return Object.freeze(result);
}

function runCapturedChild(prepared, controlRoot, dependencies = {}) {
  return new Promise((resolve) => {
    const request = prepared.request;
    const stdoutPath = safeChild(controlRoot, "build.stdout.bin",
      "build-custody-stdout-path");
    const stderrPath = safeChild(controlRoot, "build.stderr.bin",
      "build-custody-stderr-path");
    const processTerminalPath = safeChild(controlRoot, "build.process-terminal.json",
      "build-custody-process-terminal-path");
    const stdout = createBoundedCapture(stdoutPath, request.capture.maximumStdoutBytes);
    let stderr;
    try {
      stderr = createBoundedCapture(stderrPath, request.capture.maximumStderrBytes);
    } catch (error) {
      const stdoutArtifact = stdout.close();
      throw Object.assign(error, { stdoutArtifact });
    }

    const startedAtUtc = new Date().toISOString();
    let child = null;
    let processStarted = false;
    let spawnErrorCode = null;
    let streamErrorCode = null;
    let timedOut = false;
    let stdoutOverflow = false;
    let stderrOverflow = false;
    let termination = null;
    let processTerminal = null;
    let processTerminalArtifact = null;
    let processTerminalWriteCode = null;
    let environmentValidationCode = null;
    let preLaunchEnvironment = null;
    let settled = false;
    let timer = null;

    const persistProcessTerminal = (exitCode, signal, event) => {
      if (processTerminal !== null || processTerminalWriteCode !== null) return;
      processTerminal = {
        schema: processTerminalSchema,
        operationId: request.operationId,
        requestSha256: prepared.requestDocument.artifact.sha256,
        event,
        processStarted,
        processIdObserved: Boolean(child && Number.isSafeInteger(child.pid)),
        startedAtUtc,
        exitedAtUtc: new Date().toISOString(),
        exitCode: Number.isSafeInteger(exitCode) ? exitCode : null,
        signal: typeof signal === "string" ? signal : null,
        timedOut,
        stdoutOverflow,
        stderrOverflow,
        spawnErrorCode,
        streamErrorCode,
        environmentValidationCode,
        preLaunchEnvironment,
        termination,
        exitTimeMetadataQueried: false,
        retryAllowed: false
      };
      try {
        processTerminalArtifact = writeCanonicalNew(processTerminalPath, processTerminal,
          maximumTerminalBytes);
      } catch (error) {
        processTerminalWriteCode = safeErrorCode(error,
          "build-custody-process-terminal-write");
      }
    };

    const terminateOnce = () => {
      if (!child || termination !== null) return;
      termination = terminateProcessTree(child, prepared, dependencies);
    };

    const finish = (exitCode, signal) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      persistProcessTerminal(exitCode, signal,
        processStarted ? "child-exit-or-close" : "spawn-failure");
      let stdoutArtifact = null;
      let stderrArtifact = null;
      let captureCloseCode = null;
      try {
        stdoutArtifact = stdout.close();
      } catch (error) {
        captureCloseCode = safeErrorCode(error, "build-custody-stdout-close");
      }
      try {
        stderrArtifact = stderr.close();
      } catch (error) {
        captureCloseCode = captureCloseCode ||
          safeErrorCode(error, "build-custody-stderr-close");
      }
      const closeOutcome = Object.freeze({
        observed: true,
        exitCode: Number.isSafeInteger(exitCode) ? exitCode : null,
        signal: typeof signal === "string" ? signal : null
      });
      const finalCapture = Object.freeze({
        timedOut,
        stdoutOverflow: Boolean(stdoutOverflow || (stdoutArtifact && stdoutArtifact.overflow)),
        stderrOverflow: Boolean(stderrOverflow || (stderrArtifact && stderrArtifact.overflow)),
        streamErrorCode,
        termination
      });
      resolve(Object.freeze({
        processTerminal,
        processTerminalArtifact,
        processTerminalWriteCode,
        stdout: stdoutArtifact,
        stderr: stderrArtifact,
        captureCloseCode,
        closeOutcome,
        finalCapture,
        preLaunchEnvironment
      }));
    };

    try {
      if (typeof dependencies.beforeEnvironmentPreLaunchValidation === "function") {
        dependencies.beforeEnvironmentPreLaunchValidation();
      }
      preLaunchEnvironment = revalidateEnvironmentAuthority(prepared);
    } catch (error) {
      environmentValidationCode = safeErrorCode(error,
        "build-custody-environment-prelaunch");
      persistProcessTerminal(null, null, "environment-validation-failure");
      finish(null, null);
      return;
    }

    const spawn = dependencies.spawn || childProcess.spawn;
    try {
      child = spawn(request.command.executablePath, request.command.arguments, {
        cwd: prepared.workingDirectory,
        detached: false,
        env: prepared.environment,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
    } catch {
      spawnErrorCode = "build-custody-spawn-failure";
      persistProcessTerminal(null, null, "spawn-throw");
      finish(null, null);
      return;
    }

    child.once("spawn", () => {
      processStarted = true;
    });
    child.once("error", () => {
      spawnErrorCode = "build-custody-spawn-or-process-error";
      if (!processStarted && !Number.isSafeInteger(child.pid)) {
        persistProcessTerminal(null, null, "spawn-error");
      }
    });
    child.stdout.on("data", (chunk) => {
      try {
        if (stdout.append(chunk)) {
          stdoutOverflow = true;
          terminateOnce();
        }
      } catch {
        streamErrorCode = "build-custody-stdout-write";
        terminateOnce();
      }
    });
    child.stderr.on("data", (chunk) => {
      try {
        if (stderr.append(chunk)) {
          stderrOverflow = true;
          terminateOnce();
        }
      } catch {
        streamErrorCode = "build-custody-stderr-write";
        terminateOnce();
      }
    });
    child.stdout.once("error", () => {
      streamErrorCode = "build-custody-stdout-stream";
      terminateOnce();
    });
    child.stderr.once("error", () => {
      streamErrorCode = "build-custody-stderr-stream";
      terminateOnce();
    });
    child.once("exit", (exitCode, signal) => {
      persistProcessTerminal(exitCode, signal, "exit");
    });
    child.once("close", (exitCode, signal) => finish(exitCode, signal));
    timer = setTimeout(() => {
      timedOut = true;
      terminateOnce();
    }, request.capture.maximumDurationMilliseconds);
  });
}

function inspectBoundedTree(rootPath, maximumEntries, maximumBytes, codePrefix) {
  const root = inspectDirectDirectory(rootPath, `${codePrefix}-root-invalid`);
  let entryCount = 0;
  let fileCount = 0;
  let directoryCount = 0;
  let aggregateBytes = 0;
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      entryCount += 1;
      invariant(entryCount <= maximumEntries, `${codePrefix}-entry-limit`);
      invariant(!entry.isSymbolicLink(), `${codePrefix}-reparse`);
      if (entry.isDirectory()) {
        directoryCount += 1;
        pending.push(entryPath);
      } else {
        invariant(entry.isFile(), `${codePrefix}-entry`);
        const stat = fs.lstatSync(entryPath);
        invariant(stat.isFile() && !stat.isSymbolicLink() && Number.isSafeInteger(stat.size),
          `${codePrefix}-entry`);
        fileCount += 1;
        aggregateBytes += stat.size;
        invariant(Number.isSafeInteger(aggregateBytes) &&
          aggregateBytes <= maximumBytes, `${codePrefix}-byte-limit`);
      }
    }
  }
  return Object.freeze({ entryCount, fileCount, directoryCount, aggregateBytes });
}

function inspectTarget(prepared) {
  const request = prepared.request;
  const targetRoot = request.roots.targetRoot;
  const inventory = inspectBoundedTree(targetRoot, request.outputs.maximumEntryCount,
    request.outputs.maximumAggregateBytes, "build-custody-target");
  const required = request.outputs.required.map((expected) => {
    const outputPath = resolveRelative(targetRoot, expected.relativePath,
      "build-custody-required-output-path");
    const artifact = sha256File(outputPath, expected.maximumByteLength, false);
    return Object.freeze({
      relativePath: expected.relativePath,
      kind: expected.kind,
      ...artifact,
      peMachine: expected.kind === "pe-x64" ? inspectPeMachine(outputPath) : null
    });
  });
  for (const output of required) {
    if (output.kind === "pe-x64") {
      invariant(output.peMachine === "0x8664", "build-custody-required-output-machine");
    }
  }
  return Object.freeze({ ...inventory, required: Object.freeze(required) });
}

function requireScratchRelativePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 && value.length <=
    maximumScratchInspectionPathBytes && Buffer.byteLength(value, "utf8") === value.length &&
    !path.isAbsolute(value) && !value.includes("\\") && !value.includes(":"), code);
  const components = value.split("/");
  invariant(components.length > 0 && components.length <= 128, code);
  for (const component of components) {
    invariant(component.length > 0 && component.length <= 255 && component !== "." &&
      component !== ".." && component === component.trimEnd() && !component.endsWith(".") &&
      !/[<>:"/\\|?*\u0000-\u001f]/u.test(component), code);
  }
  return value;
}

function scratchPathKey(value) {
  return value.toLowerCase();
}

function scratchPathContains(parent, child) {
  const parentKey = scratchPathKey(parent);
  const childKey = scratchPathKey(child);
  return childKey === parentKey || childKey.startsWith(`${parentKey}/`);
}

function parseCanonicalCompactJson(bytes, maximumBytes, code) {
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumBytes, code);
  const text = bytes.toString("utf8");
  invariant(Buffer.from(text, "utf8").equals(bytes), code);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(code);
  }
  invariant(isPlainObject(value) && Buffer.from(JSON.stringify(value), "utf8").equals(bytes),
    code);
  return value;
}

function validateScratchInspectionFailure(bytes) {
  const failure = parseCanonicalCompactJson(bytes, maximumScratchInspectionObservationBytes,
    "build-custody-scratch-inspection-failure-json");
  requireExactKeys(failure, ["errorCode", "schema", "status"],
    "build-custody-scratch-inspection-failure-fields");
  invariant(typeof failure.errorCode === "string" &&
    scratchInspectionErrorPattern.test(failure.errorCode) &&
    failure.schema === scratchInspectionFailureSchema && failure.status === "failed",
  "build-custody-scratch-inspection-failure-contract");
  return Object.freeze({ ...failure });
}

function validateScratchInspectionObservation(bytes, request) {
  const observation = parseCanonicalCompactJson(bytes,
    request.scratchInspection.maximumStdoutBytes,
    "build-custody-scratch-inspection-observation-json");
  requireExactKeys(observation, ["aggregateBytes", "directoryCount", "entryCount",
    "fileCount", "inventorySha256", "junctionCount", "junctions", "operationId",
    "profileId", "profileSha256", "rootIdentitySha256", "schema", "status"],
  "build-custody-scratch-inspection-observation-fields");
  requireSafeInteger(observation.aggregateBytes, 0,
    request.outputs.maximumEnvironmentAggregateBytes,
    "build-custody-scratch-inspection-aggregate-bytes");
  requireSafeInteger(observation.directoryCount, 0,
    request.outputs.maximumEnvironmentEntryCount,
    "build-custody-scratch-inspection-directory-count");
  requireSafeInteger(observation.entryCount, 2,
    request.outputs.maximumEnvironmentEntryCount,
    "build-custody-scratch-inspection-entry-count");
  requireSafeInteger(observation.fileCount, 0,
    request.outputs.maximumEnvironmentEntryCount,
    "build-custody-scratch-inspection-file-count");
  requireSafeInteger(observation.junctionCount, 0,
    request.outputs.maximumEnvironmentJunctionCount,
    "build-custody-scratch-inspection-junction-count");
  invariant(observation.directoryCount + observation.fileCount + observation.junctionCount ===
    observation.entryCount, "build-custody-scratch-inspection-count-consistency");
  requireSha256(observation.inventorySha256,
    "build-custody-scratch-inspection-inventory-hash");
  requireSha256(observation.rootIdentitySha256,
    "build-custody-scratch-inspection-root-hash");
  invariant(observation.operationId === request.scratchInspection.operationId &&
    observation.profileId === scratchInspectionProfileId &&
    observation.profileSha256 === scratchInspectionProfileSha256 &&
    observation.schema === scratchInspectionObservationSchema && observation.status === "pass",
  "build-custody-scratch-inspection-observation-contract");
  invariant(Array.isArray(observation.junctions) &&
    observation.junctions.length === observation.junctionCount,
  "build-custody-scratch-inspection-junctions");

  let previousPath = null;
  const targetPaths = new Set();
  const targetIdentities = new Set();
  for (const junction of observation.junctions) {
    requireExactKeys(junction, ["linkIdentitySha256", "relativePath",
      "reparseDataSha256", "reparseTag", "schema", "targetIdentitySha256",
      "targetRelativePath"], "build-custody-scratch-inspection-junction-fields");
    requireSha256(junction.linkIdentitySha256,
      "build-custody-scratch-inspection-junction-link-identity");
    requireSha256(junction.reparseDataSha256,
      "build-custody-scratch-inspection-junction-data-hash");
    requireSha256(junction.targetIdentitySha256,
      "build-custody-scratch-inspection-junction-target-identity");
    requireScratchRelativePath(junction.relativePath,
      "build-custody-scratch-inspection-junction-path");
    requireScratchRelativePath(junction.targetRelativePath,
      "build-custody-scratch-inspection-junction-target-path");
    invariant(junction.reparseTag === "0xa0000003" &&
      junction.schema === scratchInspectionJunctionSchema &&
      junction.linkIdentitySha256 !== junction.targetIdentitySha256 &&
      !scratchPathContains(junction.relativePath, junction.targetRelativePath) &&
      !scratchPathContains(junction.targetRelativePath, junction.relativePath),
    "build-custody-scratch-inspection-junction-contract");
    const pathKey = scratchPathKey(junction.relativePath);
    const targetKey = scratchPathKey(junction.targetRelativePath);
    invariant(previousPath === null || previousPath < pathKey,
      "build-custody-scratch-inspection-junction-order");
    invariant(!targetPaths.has(targetKey) &&
      !targetIdentities.has(junction.targetIdentitySha256),
    "build-custody-scratch-inspection-junction-duplicate-target");
    previousPath = pathKey;
    targetPaths.add(targetKey);
    targetIdentities.add(junction.targetIdentitySha256);
  }
  return Object.freeze(observation);
}

function scratchInspectionRequest(prepared) {
  const request = prepared.request;
  const value = {
    maximumAggregateBytes: request.outputs.maximumEnvironmentAggregateBytes,
    maximumEntryCount: request.outputs.maximumEnvironmentEntryCount,
    maximumJunctionCount: request.outputs.maximumEnvironmentJunctionCount,
    maximumPathBytes: maximumScratchInspectionPathBytes,
    operationId: request.scratchInspection.operationId,
    ownedRoot: request.roots.environmentRoot,
    profileId: scratchInspectionProfileId,
    profileSha256: scratchInspectionProfileSha256,
    requiredRootEntries: [
      { kind: "directory", name: "home" },
      { kind: "directory", name: "temp" }
    ],
    schema: scratchInspectionRequestSchema
  };
  const bytes = Buffer.from(JSON.stringify(value), "utf8");
  invariant(bytes.length > 0 && bytes.length <= maximumScratchInspectionRequestBytes,
    "build-custody-scratch-inspection-request-size");
  return Object.freeze({ bytes, value: Object.freeze(value) });
}

function boundedProcessBytes(value) {
  if (value === null || value === undefined) return Buffer.alloc(0);
  invariant(Buffer.isBuffer(value), "build-custody-scratch-inspection-process-stream");
  return value.length <= maximumScratchInspectionObservationBytes + 1
    ? value
    : value.subarray(0, maximumScratchInspectionObservationBytes + 1);
}

function runScratchInspection(prepared, target, controlRoot, dependencies = {}) {
  const request = prepared.request;
  const required = target.required.find((entry) => entry.relativePath ===
    request.scratchInspection.executableRelativePath);
  invariant(required && required.kind === "pe-x64" && required.peMachine === "0x8664",
    "build-custody-scratch-inspection-executable-output");
  const executablePath = resolveRelative(request.roots.targetRoot, required.relativePath,
    "build-custody-scratch-inspection-executable-path");
  const executableBefore = validateArtifact(executablePath, required.byteLength,
    required.sha256, "build-custody-scratch-inspection-executable-before");
  invariant(inspectPeMachine(executablePath) === "0x8664",
    "build-custody-scratch-inspection-executable-machine");

  const inspectorRequest = scratchInspectionRequest(prepared);
  const requestArtifact = writeNewDurable(safeChild(controlRoot,
    "build.scratch-inspection.request.json",
    "build-custody-scratch-inspection-request-path"), inspectorRequest.bytes,
  maximumScratchInspectionRequestBytes);
  const startedAtUtc = new Date().toISOString();
  const spawnSync = dependencies.spawnScratchInspectorSync || childProcess.spawnSync;
  let result;
  try {
    result = spawnSync(executablePath, [], {
      cwd: request.roots.targetRoot,
      encoding: "buffer",
      env: detachedWorkerEnvironment(request.termination.executablePath),
      input: inspectorRequest.bytes,
      maxBuffer: request.scratchInspection.maximumStdoutBytes,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: request.scratchInspection.maximumDurationMilliseconds,
      windowsHide: true
    });
  } catch {
    result = { error: { code: "SPAWN_THROW" }, signal: null, status: null,
      stderr: Buffer.alloc(0), stdout: Buffer.alloc(0) };
  }
  const exitedAtUtc = new Date().toISOString();
  const stdoutBytes = boundedProcessBytes(result.stdout);
  const stderrBytes = boundedProcessBytes(result.stderr);
  const stdoutArtifact = writeNewDurable(safeChild(controlRoot,
    "build.scratch-inspection.stdout.bin", "build-custody-scratch-inspection-stdout-path"),
  stdoutBytes, maximumScratchInspectionObservationBytes + 1, true);
  const stderrArtifact = writeNewDurable(safeChild(controlRoot,
    "build.scratch-inspection.stderr.bin", "build-custody-scratch-inspection-stderr-path"),
  stderrBytes, maximumScratchInspectionObservationBytes + 1, true);
  const processErrorCode = result.error
    ? (result.error.code === "ETIMEDOUT"
        ? "build-custody-scratch-inspection-timeout"
        : result.error.code === "ENOBUFS"
          ? "build-custody-scratch-inspection-overflow"
          : "build-custody-scratch-inspection-spawn")
    : null;
  const processTerminal = {
    schema: scratchInspectionProcessTerminalSchema,
    operationId: request.operationId,
    scratchOperationId: request.scratchInspection.operationId,
    invocationOrdinal: 1,
    invocationCountLimit: 1,
    startedAtUtc,
    exitedAtUtc,
    exitCode: Number.isSafeInteger(result.status) ? result.status : null,
    signal: typeof result.signal === "string" ? result.signal : null,
    processErrorCode,
    request: requestArtifact,
    stdout: stdoutArtifact,
    stderr: stderrArtifact,
    retryAllowed: false
  };
  const processTerminalArtifact = writeCanonicalNew(safeChild(controlRoot,
    "build.scratch-inspection.process-terminal.json",
    "build-custody-scratch-inspection-process-terminal-path"), processTerminal,
  maximumScratchInspectionProcessTerminalBytes);

  let observation = null;
  let helperFailure = null;
  let status = "failed";
  let code = processErrorCode;
  if (!code && processTerminal.signal !== null) {
    code = "build-custody-scratch-inspection-signal";
  } else if (!code && stdoutBytes.length > request.scratchInspection.maximumStdoutBytes) {
    code = "build-custody-scratch-inspection-overflow";
  } else if (!code && stderrBytes.length !== 0) {
    code = "build-custody-scratch-inspection-stderr";
  } else if (!code && processTerminal.exitCode === 2) {
    try {
      helperFailure = validateScratchInspectionFailure(stdoutBytes);
    } catch {
      code = "build-custody-scratch-inspection-failure-invalid";
    }
    code = code || "build-custody-scratch-inspection-rejected";
  } else if (!code && processTerminal.exitCode !== 0) {
    code = "build-custody-scratch-inspection-nonzero";
  } else if (!code) {
    try {
      observation = validateScratchInspectionObservation(stdoutBytes, request);
      status = "pass";
      code = "build-custody-scratch-inspection-pass";
    } catch {
      code = "build-custody-scratch-inspection-observation-invalid";
    }
  }

  let executableAfter = null;
  try {
    executableAfter = validateArtifact(executablePath, required.byteLength, required.sha256,
      "build-custody-scratch-inspection-executable-after");
    invariant(executableAfter.byteLength === executableBefore.byteLength &&
      executableAfter.sha256 === executableBefore.sha256 &&
      inspectPeMachine(executablePath) === "0x8664",
    "build-custody-scratch-inspection-executable-drift");
  } catch {
    status = "failed";
    code = "build-custody-scratch-inspection-executable-drift";
    executableAfter = null;
  }

  return Object.freeze({
    status,
    code,
    invocationCount: 1,
    executable: Object.freeze({ relativePath: required.relativePath,
      before: executableBefore, after: executableAfter }),
    request: requestArtifact,
    processTerminal: Object.freeze({ artifact: processTerminalArtifact,
      outcome: Object.freeze(processTerminal) }),
    stdout: stdoutArtifact,
    stderr: stderrArtifact,
    observation,
    helperFailure,
    retryAllowed: false
  });
}

function unchangedIdentities(prepared) {
  const request = prepared.request;
  const sourceControl = validateArtifact(request.source.gitPath,
    request.source.gitByteLength, request.source.gitSha256,
    "build-custody-git-post-identity");
  const owner = validateArtifact(request.source.ownerPath, request.source.ownerByteLength,
    request.source.ownerSha256, "build-custody-owner-post-identity");
  const profile = validateArtifact(request.profile.path, request.profile.byteLength,
    request.profile.sha256, "build-custody-profile-post-identity");
  const scratchInspectionProfile = validateArtifact(request.scratchInspection.profile.path,
    request.scratchInspection.profile.byteLength,
    request.scratchInspection.profile.sha256,
    "build-custody-scratch-inspection-profile-post-identity");
  const environmentOwner = validateArtifact(request.environmentAuthority.owner.path,
    request.environmentAuthority.owner.byteLength,
    request.environmentAuthority.owner.sha256,
    "build-custody-environment-owner-post-identity");
  const environmentProfile = validateArtifact(request.environmentAuthority.profile.path,
    request.environmentAuthority.profile.byteLength,
    request.environmentAuthority.profile.sha256,
    "build-custody-environment-profile-post-identity");
  const runtime = validateArtifact(request.runtime.nodePath, request.runtime.nodeByteLength,
    request.runtime.nodeSha256, "build-custody-runtime-post-identity");
  const command = validateArtifact(request.command.executablePath,
    request.command.executableByteLength, request.command.executableSha256,
    "build-custody-command-post-identity");
  const termination = validateArtifact(request.termination.executablePath,
    request.termination.executableByteLength, request.termination.executableSha256,
    "build-custody-termination-post-identity");
  invariant(git(request.source.repositoryRoot, request.source.gitPath,
    request.termination.executablePath, ["rev-parse", "HEAD"]) ===
    request.source.commit && git(request.source.repositoryRoot, request.source.gitPath,
      request.termination.executablePath, ["rev-parse", "HEAD^{tree}"]) ===
    request.source.tree && git(request.source.repositoryRoot, request.source.gitPath,
      request.termination.executablePath, ["branch", "--show-current"]) ===
    request.source.branch && git(request.source.repositoryRoot, request.source.gitPath,
      request.termination.executablePath, ["status", "--porcelain=v1",
        "--untracked-files=all"]) === "", "build-custody-source-post-identity");
  return Object.freeze({ sourceControl, owner, profile, scratchInspectionProfile,
    environmentOwner,
    environmentProfile, runtime, command, termination, sourceExact: true });
}

function classifyProcess(processResult) {
  if (!processResult.processTerminalArtifact || processResult.processTerminalWriteCode ||
      processResult.captureCloseCode || !processResult.stdout || !processResult.stderr ||
      !processResult.closeOutcome || !processResult.finalCapture) {
    return Object.freeze({ status: "terminal-custody-failure",
      code: processResult.processTerminalWriteCode || processResult.captureCloseCode ||
        "build-custody-process-evidence-incomplete" });
  }
  const terminal = processResult.processTerminal;
  if (terminal.environmentValidationCode) {
    return Object.freeze({ status: "terminal-custody-failure",
      code: terminal.environmentValidationCode });
  }
  if (!terminal.processStarted || terminal.spawnErrorCode) {
    return Object.freeze({ status: "terminal-build-failure",
      code: "build-custody-spawn-failure" });
  }
  if (!processResult.closeOutcome.observed || terminal.event !== "exit" ||
      terminal.exitCode !== processResult.closeOutcome.exitCode ||
      terminal.signal !== processResult.closeOutcome.signal) {
    return Object.freeze({ status: "terminal-custody-failure",
      code: "build-custody-exit-close-mismatch" });
  }
  const capture = processResult.finalCapture;
  if (capture.timedOut) return Object.freeze({ status: "terminal-build-failure",
    code: "build-custody-timeout" });
  if (capture.stdoutOverflow) return Object.freeze({ status: "terminal-build-failure",
    code: "build-custody-stdout-overflow" });
  if (capture.stderrOverflow) return Object.freeze({ status: "terminal-build-failure",
    code: "build-custody-stderr-overflow" });
  if (capture.streamErrorCode) return Object.freeze({ status: "terminal-custody-failure",
    code: capture.streamErrorCode });
  if (terminal.signal !== null) return Object.freeze({ status: "terminal-build-failure",
    code: "build-custody-child-signal" });
  if (terminal.exitCode !== 0) return Object.freeze({ status: "terminal-build-failure",
    code: "build-custody-child-nonzero" });
  return Object.freeze({ status: "pass", code: "build-custody-pass" });
}

async function runWorkerIsolated(requestPath, expectedRequestSha256, dependencies = {}) {
  const prepared = prepareRequest(path.resolve(requestPath), {
    testOnlyInProcess: dependencies.testOnlyInProcess === true
  });
  invariant(prepared.requestDocument.artifact.sha256 === expectedRequestSha256,
    "build-custody-worker-request-identity");
  const request = prepared.request;
  const controlRoot = request.roots.controlRoot;
  fs.mkdirSync(controlRoot, { recursive: false });
  inspectDirectDirectory(controlRoot, "build-custody-control-root-created");

  let bindingArtifact = null;
  let startArtifact = null;
  let processResult = null;
  let target = null;
  let scratchInspection = null;
  let identities = null;
  let optionalDiagnostics = null;
  let environmentPostValidation = null;
  let environmentPostScratchValidation = null;
  let status = "terminal-custody-failure";
  let code = "build-custody-worker-failure";

  try {
    const workerEnvironment = workerEnvironmentConstrained(
      request.termination.executablePath);
    const testOnlyInProcess = dependencies.testOnlyInProcess === true;
    invariant(workerEnvironment.constrained || testOnlyInProcess,
      "build-custody-worker-environment");
    const workerEnvironmentNamesBytes = Buffer.from(canonicalJson(workerEnvironment.names),
      "utf8");
    const binding = {
      schema: bindingSchema,
      operationId: request.operationId,
      requestSha256: prepared.requestDocument.artifact.sha256,
      profileSha256: prepared.profileDocument.artifact.sha256,
      sourceCommit: request.source.commit,
      sourceTree: request.source.tree,
      sourceControlSha256: request.source.gitSha256,
      ownerSha256: request.source.ownerSha256,
      scratchInspectionProfileSha256: request.scratchInspection.profile.sha256,
      scratchInspectionOperationId: request.scratchInspection.operationId,
      scratchInspectionExecutableRelativePath:
        request.scratchInspection.executableRelativePath,
      runtimeSha256: request.runtime.nodeSha256,
      commandSha256: request.command.executableSha256,
      terminationSha256: request.termination.executableSha256,
      environmentAuthority: environmentEvidence(prepared.environmentAuthority),
      combinedEnvironmentEntryCount: prepared.environmentAuthority.entries.length,
      workerEnvironmentNames: workerEnvironment.constrained ? workerEnvironment.names : [],
      workerEnvironmentEntryCount: workerEnvironment.names.length,
      workerEnvironmentNamesSha256: sha256(workerEnvironmentNamesBytes),
      workerEnvironmentConstrained: workerEnvironment.constrained,
      testOnlyInProcess,
      controlRootOwned: true,
      targetRootObservedAbsent: !fs.existsSync(request.roots.targetRoot),
      environmentRootObservedAbsent: !fs.existsSync(request.roots.environmentRoot),
      launchCountLimit: 1,
      scratchInspectionInvocationCountLimit: 1,
      retryAllowed: false,
      request
    };
    invariant(binding.targetRootObservedAbsent && binding.environmentRootObservedAbsent,
      "build-custody-output-root-race");
    bindingArtifact = writeCanonicalNew(safeChild(controlRoot, "build.binding.json",
      "build-custody-binding-path"), binding, maximumBindingBytes);
    fs.mkdirSync(request.roots.targetRoot, { recursive: false });
    inspectDirectDirectory(request.roots.targetRoot, "build-custody-target-root-created");
    fs.mkdirSync(request.roots.environmentRoot, { recursive: false });
    inspectDirectDirectory(request.roots.environmentRoot,
      "build-custody-environment-root-created");
    for (const relativePath of requiredEnvironmentDirectories) {
      const directoryPath = path.resolve(request.roots.environmentRoot,
        ...relativePath.split("/"));
      fs.mkdirSync(directoryPath, { recursive: false });
      inspectDirectDirectory(directoryPath,
        "build-custody-environment-directory-created");
    }
    const start = {
      schema: startSchema,
      operationId: request.operationId,
      requestSha256: prepared.requestDocument.artifact.sha256,
      bindingSha256: bindingArtifact.sha256,
      environmentPublicLockSha256:
        prepared.environmentAuthority.publicLockArtifact.sha256,
      combinedEnvironmentSha256:
        prepared.environmentAuthority.combinedEnvironmentArtifact.sha256,
      authorizedAtUtc: new Date().toISOString(),
      launchOrdinal: 1,
      launchCountLimit: 1,
      scratchInspectionInvocationCountLimit: 1,
      retryAllowed: false,
      exitStatusMustPrecedeOptionalDiagnostics: true
    };
    startArtifact = writeCanonicalNew(safeChild(controlRoot, "build.start.json",
      "build-custody-start-path"), start, maximumTerminalBytes);
    processResult = await runCapturedChild(prepared, controlRoot, dependencies);
    const processClassification = classifyProcess(processResult);
    status = processClassification.status;
    code = processClassification.code;

    try {
      if (typeof dependencies.beforeEnvironmentPostChildValidation === "function") {
        dependencies.beforeEnvironmentPostChildValidation(processResult);
      }
      environmentPostValidation = revalidateEnvironmentAuthority(prepared);
    } catch (error) {
      environmentPostValidation = null;
      status = "terminal-custody-failure";
      code = safeErrorCode(error, "build-custody-environment-post-child");
    }

    if (status === "pass") {
      try {
        const collector = dependencies.collectOptionalDiagnostics || (() => ({
          exitTimeMetadataQueried: false,
          closeEventObserved: true
        }));
        optionalDiagnostics = Object.freeze({ collected: true, value: collector() });
      } catch (error) {
        optionalDiagnostics = Object.freeze({ collected: false,
          code: safeErrorCode(error, "build-custody-optional-diagnostics") });
        status = "terminal-custody-failure";
        code = optionalDiagnostics.code;
      }
    }
    if (status === "pass") {
      try {
        target = inspectTarget(prepared);
        scratchInspection = runScratchInspection(prepared, target, controlRoot, dependencies);
        if (scratchInspection.status !== "pass") {
          status = "terminal-custody-failure";
          code = scratchInspection.code;
        }
      } catch (error) {
        status = "terminal-custody-failure";
        code = safeErrorCode(error, "build-custody-post-exit-verification");
      }
    }
    if (scratchInspection !== null) {
      try {
        environmentPostScratchValidation = revalidateEnvironmentAuthority(prepared);
      } catch (error) {
        environmentPostScratchValidation = null;
        status = "terminal-custody-failure";
        code = safeErrorCode(error, "build-custody-environment-post-scratch-inspection");
      }
    }
    if (status === "pass") {
      try {
        identities = unchangedIdentities(prepared);
      } catch (error) {
        status = "terminal-custody-failure";
        code = safeErrorCode(error, "build-custody-final-identities");
      }
    }
  } catch (error) {
    status = "terminal-custody-failure";
    code = safeErrorCode(error, "build-custody-worker-failure");
  }

  const processTerminal = processResult && processResult.processTerminalArtifact
    ? Object.freeze({
        artifact: processResult.processTerminalArtifact,
        outcome: processResult.processTerminal
      })
    : null;
  const terminal = {
    schema: terminalSchema,
    operationId: request.operationId,
    requestSha256: prepared.requestDocument.artifact.sha256,
    status,
    code,
    binding: bindingArtifact,
    start: startArtifact,
    processTerminal,
    processTerminalWriteCode: processResult ? processResult.processTerminalWriteCode : null,
    stdout: processResult ? processResult.stdout : null,
    stderr: processResult ? processResult.stderr : null,
    captureCloseCode: processResult ? processResult.captureCloseCode : null,
    closeOutcome: processResult ? processResult.closeOutcome : null,
    finalCapture: processResult ? processResult.finalCapture : null,
    optionalDiagnostics,
    environmentAuthority: {
      initial: environmentEvidence(prepared.environmentAuthority),
      preLaunch: processResult ? processResult.preLaunchEnvironment : null,
      postChild: environmentPostValidation,
      postScratchInspection: environmentPostScratchValidation,
      postChildValidationRequiredForEveryProcessOutcome: true,
      postScratchInspectionValidationRequiredBeforePass: true
    },
    identities,
    target,
    scratchInspection,
    retryAllowed: false,
    resumeAllowed: false,
    cleanupAllowed: false,
    outputAdoptionAllowed: false,
    testOnlyInProcess: dependencies.testOnlyInProcess === true,
    campaignCreditAuthorized: false
  };
  if (typeof dependencies.beforeFinal === "function") dependencies.beforeFinal(terminal);
  const terminalArtifact = writeCanonicalNew(safeChild(controlRoot, "build.terminal.json",
    "build-custody-terminal-path"), terminal, maximumTerminalBytes);
  return Object.freeze({ terminal, terminalArtifact });
}

async function runWorker(requestPath, expectedRequestSha256) {
  invariant(arguments.length === 2, "build-custody-worker-api-arguments");
  const resolvedRequestPath = path.resolve(requestPath);
  const requestDocument = readCanonicalJson(resolvedRequestPath, maximumRequestBytes,
    "build-custody-request-json");
  validateRequestShape(requestDocument.value);
  invariant(requestDocument.artifact.sha256 === expectedRequestSha256,
    "build-custody-worker-request-identity");
  invariant(workerEnvironmentConstrained(
    requestDocument.value.termination.executablePath).constrained,
  "build-custody-worker-environment");
  return runWorkerIsolated(resolvedRequestPath, expectedRequestSha256);
}

async function runWorkerForTest(requestPath, expectedRequestSha256, dependencies = {}) {
  const resolvedRequestPath = path.resolve(requestPath);
  const requestDocument = readCanonicalJson(resolvedRequestPath, maximumRequestBytes,
    "build-custody-request-json");
  validateRequestShape(requestDocument.value);
  invariant(requestDocument.artifact.sha256 === expectedRequestSha256,
    "build-custody-worker-request-identity");
  return runWorkerIsolated(resolvedRequestPath, expectedRequestSha256,
    Object.freeze({ ...dependencies, testOnlyInProcess: true }));
}

function readTerminalForRequest(requestPath) {
  const requestDocument = readCanonicalJson(path.resolve(requestPath), maximumRequestBytes,
    "build-custody-request-json");
  validateRequestShape(requestDocument.value);
  const terminalPath = safeChild(requestDocument.value.roots.controlRoot,
    "build.terminal.json", "build-custody-terminal-path");
  const terminalDocument = readCanonicalJson(terminalPath, maximumTerminalBytes,
    "build-custody-terminal-json");
  invariant(terminalDocument.value.schema === terminalSchema &&
    terminalDocument.value.operationId === requestDocument.value.operationId &&
    terminalDocument.value.requestSha256 === requestDocument.artifact.sha256,
  "build-custody-terminal-binding");
  return Object.freeze({ requestDocument, terminalDocument });
}

function publicSummary(terminal) {
  const environmentAuthority = terminal.environmentAuthority || {};
  const environmentValidated = Boolean(environmentAuthority.initial &&
    environmentAuthority.preLaunch && environmentAuthority.postChild &&
    environmentAuthority.postScratchInspection);
  const scratchInspection = terminal.scratchInspection || null;
  const scratchObservation = scratchInspection ? scratchInspection.observation : null;
  return {
    schema: summarySchema,
    operationId: terminal.operationId,
    status: terminal.status,
    code: terminal.code,
    processStarted: Boolean(terminal.processTerminal &&
      terminal.processTerminal.outcome.processStarted),
    exitCode: terminal.processTerminal ? terminal.processTerminal.outcome.exitCode : null,
    stdoutBytes: terminal.stdout ? terminal.stdout.byteLength : null,
    stderrBytes: terminal.stderr ? terminal.stderr.byteLength : null,
    requiredOutputCount: terminal.target ? terminal.target.required.length : 0,
    environmentScratchEntryCount: scratchObservation
      ? scratchObservation.entryCount
      : null,
    environmentScratchBytes: scratchObservation
      ? scratchObservation.aggregateBytes
      : null,
    environmentScratchJunctionCount: scratchObservation
      ? scratchObservation.junctionCount
      : null,
    environmentScratchInventorySha256: scratchObservation
      ? scratchObservation.inventorySha256
      : null,
    scratchInspectionInvoked: Boolean(scratchInspection &&
      scratchInspection.invocationCount === 1),
    scratchInspectionStatus: scratchInspection ? scratchInspection.status : null,
    environmentValidated,
    environmentPublicLockSha256: environmentAuthority.initial
      ? environmentAuthority.initial.publicLock.sha256
      : null,
    testOnlyInProcess: terminal.testOnlyInProcess === true,
    retryAllowed: false,
    campaignCreditAuthorized: false
  };
}

function waitForWorker(worker, maximumMilliseconds) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(Object.freeze({ observerTimedOut: true, exitCode: null, signal: null }));
    }, maximumMilliseconds);
    worker.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Object.freeze({ observerTimedOut: false, exitCode: null, signal: null,
        spawnError: true }));
    });
    worker.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Object.freeze({ observerTimedOut: false, exitCode, signal,
        spawnError: false }));
    });
  });
}

async function executeFromCli(requestPath) {
  const prepared = prepareRequest(path.resolve(requestPath));
  const environment = detachedWorkerEnvironment(
    prepared.request.termination.executablePath);
  const worker = childProcess.spawn(process.execPath, [path.resolve(__filename), "worker",
    path.resolve(requestPath), prepared.requestDocument.artifact.sha256], {
      detached: true,
      env: environment,
      shell: false,
      stdio: "ignore",
      windowsHide: true
    });
  worker.unref();
  const observed = await waitForWorker(worker,
    prepared.request.capture.maximumDurationMilliseconds + maximumObserverGraceMilliseconds);
  invariant(!observed.spawnError, "build-custody-worker-spawn");
  invariant(!observed.observerTimedOut, "build-custody-observer-timeout");
  const terminal = readTerminalForRequest(requestPath).terminalDocument.value;
  process.stdout.write(canonicalJson(publicSummary(terminal)));
  process.exitCode = terminal.status === "pass" ? 0 : 1;
}

async function main(argv) {
  invariant(argv.length >= 2, "build-custody-arguments");
  const [command, requestPath, expectedRequestSha256] = argv;
  if (command === "preflight") {
    invariant(argv.length === 2, "build-custody-arguments");
    const prepared = prepareRequest(path.resolve(requestPath));
    process.stdout.write(canonicalJson({
      schema: summarySchema,
      operationId: prepared.request.operationId,
      status: "ready",
      code: "build-custody-preflight-pass",
      requestSha256: prepared.requestDocument.artifact.sha256,
      environmentValidated: true,
      environmentPublicLockSha256:
        prepared.environmentAuthority.publicLockArtifact.sha256,
      combinedEnvironmentSha256:
        prepared.environmentAuthority.combinedEnvironmentArtifact.sha256,
      controlRootAbsent: true,
      targetRootAbsent: true,
      environmentRootAbsent: true,
      retryAllowed: false,
      campaignCreditAuthorized: false
    }));
    return;
  }
  if (command === "execute") {
    invariant(argv.length === 2, "build-custody-arguments");
    await executeFromCli(path.resolve(requestPath));
    return;
  }
  if (command === "observe") {
    invariant(argv.length === 2, "build-custody-arguments");
    const terminal = readTerminalForRequest(path.resolve(requestPath)).terminalDocument.value;
    process.stdout.write(canonicalJson(publicSummary(terminal)));
    process.exitCode = terminal.status === "pass" ? 0 : 1;
    return;
  }
  invariant(command === "worker" && argv.length === 3 &&
    sha256Pattern.test(expectedRequestSha256), "build-custody-worker-arguments");
  const result = await runWorker(path.resolve(requestPath), expectedRequestSha256);
  process.exitCode = result.terminal.status === "pass" ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(canonicalJson({
      schema: "tinyrustlm.build-custody-error.v3",
      status: "error",
      code: safeErrorCode(error)
    }));
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  bindingSchema,
  canonicalJson,
  inspectPeMachine,
  openEnvironmentAuthority,
  prepareRequest,
  processTerminalSchema,
  profileByteLength,
  profileId,
  profileSha256,
  publicSummary,
  readTerminalForRequest,
  requestSchema,
  revalidateEnvironmentAuthority,
  runCapturedChild,
  runScratchInspection,
  runWorker,
  runWorkerForTest,
  sha256File,
  startSchema,
  summarySchema,
  terminalSchema,
  validateRequestShape,
  writeNewDurable
});

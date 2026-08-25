"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const profileId = "tinyrustlm.source-controlled-build-custody/1";
const profileByteLength = 3407;
const profileSha256 =
  "589883f42c1e047dfa6e132c8c4937c05d23b936ae1a6f62fe41c91b672a82fa";
const requestSchema = "tinyrustlm.build-custody-request.v1";
const bindingSchema = "tinyrustlm.build-custody-binding.v1";
const startSchema = "tinyrustlm.build-custody-start.v1";
const processTerminalSchema = "tinyrustlm.build-custody-process-terminal.v1";
const terminalSchema = "tinyrustlm.build-custody-terminal.v1";
const summarySchema = "tinyrustlm.build-custody-summary.v1";
const maximumRequestBytes = 262144;
const maximumBindingBytes = 524288;
const maximumTerminalBytes = 524288;
const maximumArguments = 128;
const maximumArgumentBytes = 32768;
const maximumEnvironmentEntries = 128;
const maximumEnvironmentValueBytes = 32768;
const maximumDurationMilliseconds = 7200000;
const maximumStdoutBytes = 16777216;
const maximumStderrBytes = 16777216;
const maximumTargetEntries = 131072;
const maximumTargetBytes = 17179869184;
const maximumRequiredOutputs = 16;
const hashBufferBytes = 1048576;
const maximumTerminationOutputBytes = 65536;
const maximumObserverGraceMilliseconds = 120000;
const commitPattern = /^[a-f0-9]{40}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/u;
const environmentNamePattern = /^[A-Za-z_][A-Za-z0-9_()]{0,63}$/u;
const safeErrorPattern = /^[a-z0-9][a-z0-9-]{2,127}$/u;

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

function sha256File(filePath, maximumBytes = maximumTargetBytes, allowEmpty = false) {
  const file = inspectRegularFile(filePath, maximumBytes, allowEmpty,
    "build-custody-file-invalid");
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
  const artifact = sha256File(filePath, maximumBytes, false);
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

function writeNewDurable(filePath, bytes, maximumBytes) {
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumBytes,
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

function withExactAmbientEnvironment(environment, callback) {
  const original = Object.entries(process.env);
  try {
    for (const name of Object.keys(process.env)) delete process.env[name];
    for (const [name, value] of Object.entries(environment)) process.env[name] = value;
    return callback();
  } finally {
    for (const name of Object.keys(process.env)) delete process.env[name];
    for (const [name, value] of original) process.env[name] = value;
  }
}

async function withExactAmbientEnvironmentAsync(environment, callback) {
  const original = Object.entries(process.env);
  try {
    for (const name of Object.keys(process.env)) delete process.env[name];
    for (const [name, value] of Object.entries(environment)) process.env[name] = value;
    return await callback();
  } finally {
    for (const name of Object.keys(process.env)) delete process.env[name];
    for (const [name, value] of original) process.env[name] = value;
  }
}

function git(repositoryRoot, gitPath, terminationPath, argumentsList) {
  const environment = isolatedToolEnvironment(terminationPath);
  return withExactAmbientEnvironment(environment, () =>
    childProcess.execFileSync(gitPath, argumentsList, {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: environment,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true
    })).trim();
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
  const live = sha256File(filePath, artifact.byteLength, false);
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

function validateRequestShape(request) {
  requireExactKeys(request, ["schema", "operationId", "profile", "source", "runtime",
    "command", "roots", "capture", "termination", "outputs"],
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

  requireExactKeys(request.command, ["executablePath", "executableByteLength",
    "executableSha256", "arguments", "workingDirectory", "environment"],
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
  invariant(Array.isArray(request.command.environment) &&
    request.command.environment.length > 0 &&
    request.command.environment.length <= maximumEnvironmentEntries,
  "build-custody-environment");
  let previousEnvironmentName = null;
  for (const entry of request.command.environment) {
    requireExactKeys(entry, ["name", "value"], "build-custody-environment-entry");
    invariant(environmentNamePattern.test(entry.name), "build-custody-environment-name");
    invariant(typeof entry.value === "string" && !entry.value.includes("\u0000") &&
      Buffer.byteLength(entry.value, "utf8") <= maximumEnvironmentValueBytes,
    "build-custody-environment-value");
    const canonicalName = entry.name.toUpperCase();
    invariant(previousEnvironmentName === null || previousEnvironmentName < canonicalName,
      "build-custody-environment-order");
    previousEnvironmentName = canonicalName;
  }

  requireExactKeys(request.roots, ["controlRoot", "targetRoot"],
    "build-custody-root-fields");
  requireCanonicalAbsolutePath(request.roots.controlRoot, "build-custody-control-root");
  requireCanonicalAbsolutePath(request.roots.targetRoot, "build-custody-target-root");

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

  requireExactKeys(request.outputs, ["maximumEntryCount", "maximumAggregateBytes", "required"],
    "build-custody-output-fields");
  requireSafeInteger(request.outputs.maximumEntryCount, 1, maximumTargetEntries,
    "build-custody-output-count");
  requireSafeInteger(request.outputs.maximumAggregateBytes, 1, maximumTargetBytes,
    "build-custody-output-bytes");
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
}

function validateProfile(profileDocument) {
  invariant(profileDocument.artifact.byteLength === profileByteLength &&
    profileDocument.artifact.sha256 === profileSha256, "build-custody-profile-identity");
  invariant(profileDocument.value.schema === "tinyrustlm.build-custody-profile.v1" &&
    profileDocument.value.profileId === profileId &&
    profileDocument.value.status === "current-prelaunch-only" &&
    profileDocument.value.platform === "win32" &&
    profileDocument.value.architecture === "x64", "build-custody-profile-contract");
}

function validateArtifact(pathValue, expectedLength, expectedSha256, code) {
  const artifact = sha256File(pathValue, expectedLength, false);
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

function prepareRequest(requestPath, options = {}) {
  const rootPolicy = options.rootPolicy || "absent";
  invariant(["absent", "existing-control"].includes(rootPolicy),
    "build-custody-root-policy");
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
  invariant(controlParent === targetParent, "build-custody-root-siblings");
  invariant(request.roots.controlRoot !== request.roots.targetRoot,
    "build-custody-root-distinct");
  requireSeparated([repositoryRoot, request.roots.controlRoot, request.roots.targetRoot],
    "build-custody-root-overlap");
  if (rootPolicy === "absent") {
    invariant(!fs.existsSync(request.roots.controlRoot), "build-custody-control-root-exists");
    invariant(!fs.existsSync(request.roots.targetRoot), "build-custody-target-root-exists");
  } else {
    inspectDirectDirectory(request.roots.controlRoot, "build-custody-control-root");
  }
  for (const output of request.outputs.required) {
    resolveRelative(request.roots.targetRoot, output.relativePath,
      "build-custody-required-output-path");
  }

  const environment = Object.create(null);
  for (const entry of request.command.environment) environment[entry.name] = entry.value;

  return Object.freeze({
    request,
    requestDocument,
    profileDocument,
    source: Object.freeze({
      repositoryRoot,
      gitPath,
      gitArtifact,
      ownerPath,
      ownerRelativePath,
      ownerArtifact,
      profileRelativePath,
      profileArtifact
    }),
    runtimeArtifact,
    commandArtifact,
    terminationArtifact,
    workingDirectory,
    environment: Object.freeze(environment)
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
    const helper = withExactAmbientEnvironment(environment, () =>
      spawnSync(prepared.request.termination.executablePath,
        ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          encoding: "buffer",
          env: environment,
          timeout: 30000,
          maxBuffer: maximumTerminationOutputBytes,
          stdio: ["ignore", "pipe", "pipe"]
        }));
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
        finalCapture
      }));
    };

    const spawn = dependencies.spawn || childProcess.spawn;
    try {
      child = withExactAmbientEnvironment(prepared.environment, () =>
        spawn(request.command.executablePath, request.command.arguments, {
          cwd: prepared.workingDirectory,
          detached: false,
          env: prepared.environment,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        }));
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

function inspectTarget(prepared) {
  const request = prepared.request;
  const targetRoot = inspectDirectDirectory(request.roots.targetRoot,
    "build-custody-target-root-invalid");
  let entryCount = 0;
  let fileCount = 0;
  let directoryCount = 0;
  let aggregateBytes = 0;
  const pending = [targetRoot];
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      entryCount += 1;
      invariant(entryCount <= request.outputs.maximumEntryCount,
        "build-custody-target-entry-limit");
      invariant(!entry.isSymbolicLink(), "build-custody-target-reparse");
      if (entry.isDirectory()) {
        directoryCount += 1;
        pending.push(entryPath);
      } else {
        invariant(entry.isFile(), "build-custody-target-entry");
        const stat = fs.lstatSync(entryPath);
        invariant(stat.isFile() && !stat.isSymbolicLink() && Number.isSafeInteger(stat.size),
          "build-custody-target-entry");
        fileCount += 1;
        aggregateBytes += stat.size;
        invariant(Number.isSafeInteger(aggregateBytes) &&
          aggregateBytes <= request.outputs.maximumAggregateBytes,
        "build-custody-target-byte-limit");
      }
    }
  }
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
  return Object.freeze({ entryCount, fileCount, directoryCount, aggregateBytes,
    required: Object.freeze(required) });
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
  return Object.freeze({ sourceControl, owner, profile, runtime, command, termination,
    sourceExact: true });
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
  const prepared = prepareRequest(path.resolve(requestPath), { rootPolicy: "absent" });
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
  let identities = null;
  let optionalDiagnostics = null;
  let status = "terminal-custody-failure";
  let code = "build-custody-worker-failure";

  try {
    const workerEnvironmentNames = Object.keys(process.env).sort();
    invariant(workerEnvironmentNames.length === 1 &&
      workerEnvironmentNames[0] === "SystemRoot",
    "build-custody-worker-environment");
    const binding = {
      schema: bindingSchema,
      operationId: request.operationId,
      requestSha256: prepared.requestDocument.artifact.sha256,
      profileSha256: prepared.profileDocument.artifact.sha256,
      sourceCommit: request.source.commit,
      sourceTree: request.source.tree,
      sourceControlSha256: request.source.gitSha256,
      ownerSha256: request.source.ownerSha256,
      runtimeSha256: request.runtime.nodeSha256,
      commandSha256: request.command.executableSha256,
      terminationSha256: request.termination.executableSha256,
      workerEnvironmentNames,
      controlRootOwned: true,
      targetRootObservedAbsent: !fs.existsSync(request.roots.targetRoot),
      launchCountLimit: 1,
      retryAllowed: false,
      request
    };
    invariant(binding.targetRootObservedAbsent, "build-custody-target-root-race");
    bindingArtifact = writeCanonicalNew(safeChild(controlRoot, "build.binding.json",
      "build-custody-binding-path"), binding, maximumBindingBytes);
    fs.mkdirSync(request.roots.targetRoot, { recursive: false });
    inspectDirectDirectory(request.roots.targetRoot, "build-custody-target-root-created");
    const start = {
      schema: startSchema,
      operationId: request.operationId,
      requestSha256: prepared.requestDocument.artifact.sha256,
      bindingSha256: bindingArtifact.sha256,
      authorizedAtUtc: new Date().toISOString(),
      launchOrdinal: 1,
      launchCountLimit: 1,
      retryAllowed: false,
      exitStatusMustPrecedeOptionalDiagnostics: true
    };
    startArtifact = writeCanonicalNew(safeChild(controlRoot, "build.start.json",
      "build-custody-start-path"), start, maximumTerminalBytes);
    processResult = await runCapturedChild(prepared, controlRoot, dependencies);
    const processClassification = classifyProcess(processResult);
    status = processClassification.status;
    code = processClassification.code;

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
        identities = unchangedIdentities(prepared);
        target = inspectTarget(prepared);
      } catch (error) {
        status = "terminal-custody-failure";
        code = safeErrorCode(error, "build-custody-post-exit-verification");
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
    identities,
    target,
    retryAllowed: false,
    resumeAllowed: false,
    cleanupAllowed: false,
    outputAdoptionAllowed: false,
    campaignCreditAuthorized: false
  };
  if (typeof dependencies.beforeFinal === "function") dependencies.beforeFinal(terminal);
  const terminalArtifact = writeCanonicalNew(safeChild(controlRoot, "build.terminal.json",
    "build-custody-terminal-path"), terminal, maximumTerminalBytes);
  return Object.freeze({ terminal, terminalArtifact });
}

async function runWorker(requestPath, expectedRequestSha256, dependencies = {}) {
  const resolvedRequestPath = path.resolve(requestPath);
  const requestDocument = readCanonicalJson(resolvedRequestPath, maximumRequestBytes,
    "build-custody-request-json");
  validateRequestShape(requestDocument.value);
  invariant(requestDocument.artifact.sha256 === expectedRequestSha256,
    "build-custody-worker-request-identity");
  const environment = detachedWorkerEnvironment(
    requestDocument.value.termination.executablePath);
  return withExactAmbientEnvironmentAsync(environment, () =>
    runWorkerIsolated(resolvedRequestPath, expectedRequestSha256, dependencies));
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
  const prepared = prepareRequest(path.resolve(requestPath), { rootPolicy: "absent" });
  const environment = detachedWorkerEnvironment(
    prepared.request.termination.executablePath);
  const worker = withExactAmbientEnvironment(environment, () =>
    childProcess.spawn(process.execPath, [path.resolve(__filename), "worker",
      path.resolve(requestPath), prepared.requestDocument.artifact.sha256], {
        detached: true,
        env: environment,
        shell: false,
        stdio: "ignore",
        windowsHide: true
      }));
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
    const prepared = prepareRequest(path.resolve(requestPath), { rootPolicy: "absent" });
    process.stdout.write(canonicalJson({
      schema: summarySchema,
      operationId: prepared.request.operationId,
      status: "ready",
      code: "build-custody-preflight-pass",
      requestSha256: prepared.requestDocument.artifact.sha256,
      controlRootAbsent: true,
      targetRootAbsent: true,
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
      schema: "tinyrustlm.build-custody-error.v1",
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
  prepareRequest,
  processTerminalSchema,
  profileByteLength,
  profileId,
  profileSha256,
  publicSummary,
  readTerminalForRequest,
  requestSchema,
  runCapturedChild,
  runWorker,
  sha256File,
  startSchema,
  summarySchema,
  terminalSchema,
  validateRequestShape,
  writeNewDurable
});

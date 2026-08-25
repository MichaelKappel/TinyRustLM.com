"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const requestSchema = "tinyrustlm.qwen3-composition-execution-request.v1";
const bindingSchema = "tinyrustlm.qwen3-composition-execution-binding.v1";
const startSchema = "tinyrustlm.qwen3-composition-execution-start.v1";
const terminalSchema = "tinyrustlm.qwen3-composition-execution-terminal.v1";
const maximumRequestBytes = 64 * 1024;
const maximumBindingBytes = 64 * 1024;
const maximumTerminalBytes = 256 * 1024;
const maximumSourceLockBytes = 1024 * 1024;
const maximumSourceFileBytes = 8 * 1024 * 1024 * 1024;
const maximumOutputFiles = 12;
const hashBufferBytes = 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const commitPattern = /^[a-f0-9]{40}$/u;
const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/u;

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

function requireCanonicalAbsolutePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 && path.isAbsolute(value), code);
  invariant(path.resolve(value) === value, code);
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

function inspectDirectDirectory(directoryPath, code) {
  const normalized = requireCanonicalAbsolutePath(directoryPath, code);
  let stat;
  try {
    stat = fs.lstatSync(normalized);
  } catch {
    throw new Error(code);
  }
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), code);
  return normalized;
}

function inspectRegularFile(filePath, maximumBytes, allowEmpty, code) {
  const normalized = requireCanonicalAbsolutePath(filePath, code);
  let stat;
  try {
    stat = fs.lstatSync(normalized);
  } catch {
    throw new Error(code);
  }
  invariant(stat.isFile() && !stat.isSymbolicLink(), code);
  invariant(Number.isSafeInteger(stat.size), code);
  invariant((allowEmpty ? stat.size >= 0 : stat.size > 0) && stat.size <= maximumBytes, code);
  return Object.freeze({ path: normalized, byteLength: stat.size });
}

function sha256File(filePath, maximumBytes = maximumSourceFileBytes, allowEmpty = false) {
  const file = inspectRegularFile(filePath, maximumBytes, allowEmpty, "execution-file-invalid");
  const digest = crypto.createHash("sha256");
  const descriptor = fs.openSync(file.path, "r");
  const buffer = Buffer.allocUnsafe(hashBufferBytes);
  try {
    let offset = 0;
    while (offset < file.byteLength) {
      const read = fs.readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, file.byteLength - offset),
        offset
      );
      invariant(read > 0, "execution-file-short-read");
      digest.update(buffer.subarray(0, read));
      offset += read;
    }
    invariant(fs.fstatSync(descriptor).size === file.byteLength, "execution-file-drift");
  } finally {
    fs.closeSync(descriptor);
  }
  return Object.freeze({
    byteLength: file.byteLength,
    sha256: digest.digest("hex")
  });
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
  return Object.freeze({ artifact, value });
}

function safeChild(root, fileName, code) {
  invariant(typeof fileName === "string" && path.basename(fileName) === fileName, code);
  const target = path.resolve(root, fileName);
  invariant(path.dirname(target) === root, code);
  return target;
}

function inspectLockedSource(lockPath, expectedSha256, sourceDirectory, expectedSchema) {
  const lock = readCanonicalJson(lockPath, maximumSourceLockBytes, "execution-source-lock-json");
  invariant(lock.artifact.sha256 === expectedSha256, "execution-source-lock-identity");
  invariant(lock.value.schema === expectedSchema, "execution-source-lock-schema");
  invariant(isPlainObject(lock.value.files), "execution-source-lock-files");
  const root = inspectDirectDirectory(sourceDirectory, "execution-source-root");
  const declarations = Object.values(lock.value.files);
  invariant(declarations.length > 0 && declarations.length <= 224, "execution-source-count");
  const expectedNames = declarations.map((entry) => {
    requireExactKeys(entry, ["path", "byteLength", "sha256"], "execution-source-record");
    invariant(typeof entry.path === "string" && path.basename(entry.path) === entry.path,
      "execution-source-name");
    invariant(Number.isSafeInteger(entry.byteLength) && entry.byteLength > 0 &&
      entry.byteLength <= maximumSourceFileBytes, "execution-source-size");
    requireSha256(entry.sha256, "execution-source-hash");
    return entry.path;
  }).sort();
  invariant(new Set(expectedNames).size === expectedNames.length, "execution-source-duplicate");
  const observedNames = fs.readdirSync(root, { withFileTypes: true }).map((entry) => {
    invariant(entry.isFile() && !entry.isSymbolicLink(), "execution-source-tree");
    return entry.name;
  }).sort();
  invariant(canonicalJson(observedNames) === canonicalJson(expectedNames),
    "execution-source-inventory");
  const byName = new Map(declarations.map((entry) => [entry.path, entry]));
  const inventory = observedNames.map((fileName) => {
    const expected = byName.get(fileName);
    const artifact = sha256File(safeChild(root, fileName, "execution-source-path"));
    invariant(artifact.byteLength === expected.byteLength, "execution-source-size-drift");
    invariant(artifact.sha256 === expected.sha256, "execution-source-hash-drift");
    return Object.freeze({ file: fileName, ...artifact });
  });
  return Object.freeze({ lock: lock.value, inventory: Object.freeze(inventory) });
}

function git(repositoryRoot, args) {
  return childProcess.execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  }).trim();
}

function inspectPeMachine(executablePath) {
  const descriptor = fs.openSync(executablePath, "r");
  try {
    const dos = Buffer.alloc(64);
    invariant(fs.readSync(descriptor, dos, 0, dos.length, 0) === dos.length,
      "execution-executable-pe");
    invariant(dos.readUInt16LE(0) === 0x5a4d, "execution-executable-pe");
    const peOffset = dos.readUInt32LE(0x3c);
    invariant(peOffset >= 64 && peOffset <= 16 * 1024 * 1024, "execution-executable-pe");
    const header = Buffer.alloc(6);
    invariant(fs.readSync(descriptor, header, 0, header.length, peOffset) === header.length,
      "execution-executable-pe");
    invariant(header.readUInt32LE(0) === 0x00004550, "execution-executable-pe");
    return `0x${header.readUInt16LE(4).toString(16).padStart(4, "0")}`;
  } finally {
    fs.closeSync(descriptor);
  }
}

function isAncestorOrSame(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function validateTreeSeparation(paths) {
  const roots = [paths.modelSourceDirectory, paths.tokenizerSourceDirectory,
    paths.outputRoot, paths.evidenceRoot];
  for (let left = 0; left < roots.length; left += 1) {
    for (let right = left + 1; right < roots.length; right += 1) {
      invariant(!isAncestorOrSame(roots[left], roots[right]) &&
        !isAncestorOrSame(roots[right], roots[left]), "execution-tree-overlap");
    }
  }
}

function requireExpectedArtifact(filePath, expectedLength, expectedSha256, allowEmpty, code) {
  const artifact = sha256File(filePath, Math.max(expectedLength, 1), allowEmpty);
  invariant(artifact.byteLength === expectedLength && artifact.sha256 === expectedSha256, code);
  return artifact;
}

function validateRequestShape(request) {
  requireExactKeys(request, ["schema", "executionId", "registration", "build", "inputs",
    "invocation"], "execution-request-fields");
  invariant(request.schema === requestSchema, "execution-request-schema");
  invariant(typeof request.executionId === "string" && safeIdPattern.test(request.executionId),
    "execution-id");
  requireExactKeys(request.registration, ["repositoryRoot", "profilePath", "profileByteLength",
    "profileSha256", "profileId", "commit", "tree", "branch", "controllerPath",
    "controllerByteLength", "controllerSha256"], "execution-registration-fields");
  requireExactKeys(request.build, ["sourceCommit", "sourceTree", "stdoutPath",
    "stdoutByteLength", "stdoutSha256", "stderrPath", "stderrByteLength", "stderrSha256",
    "executablePath", "executableByteLength", "executableSha256", "peMachine", "command",
    "environment", "toolchain"], "execution-build-fields");
  requireExactKeys(request.inputs, ["modelSourceLockPath", "modelSourceLockSha256",
    "modelSourceDirectory", "tokenizerSourceLockPath", "tokenizerSourceLockSha256",
    "tokenizerSourceDirectory", "compositionProfilePath", "compositionProfileSha256"],
  "execution-input-fields");
  requireExactKeys(request.invocation, ["evidenceRoot", "outputRoot", "workingDirectory",
    "arguments", "maximumDurationMilliseconds", "maximumStdoutBytes", "maximumStderrBytes"],
  "execution-invocation-fields");
}

function prepareExecution(requestPath) {
  const requestDocument = readCanonicalJson(
    requireCanonicalAbsolutePath(requestPath, "execution-request-path"),
    maximumRequestBytes,
    "execution-request-json"
  );
  const request = requestDocument.value;
  validateRequestShape(request);

  const repositoryRoot = inspectDirectDirectory(
    request.registration.repositoryRoot, "execution-repository-root");
  const profilePath = requireCanonicalAbsolutePath(
    request.registration.profilePath, "execution-profile-path");
  const controllerPath = requireCanonicalAbsolutePath(
    request.registration.controllerPath, "execution-controller-path");
  invariant(profilePath.startsWith(`${repositoryRoot}${path.sep}`), "execution-profile-location");
  invariant(controllerPath === path.resolve(__filename), "execution-controller-location");
  invariant(Number.isSafeInteger(request.registration.profileByteLength) &&
    request.registration.profileByteLength > 0, "execution-profile-size");
  invariant(Number.isSafeInteger(request.registration.controllerByteLength) &&
    request.registration.controllerByteLength > 0, "execution-controller-size");
  requireSha256(request.registration.profileSha256, "execution-profile-hash");
  requireSha256(request.registration.controllerSha256, "execution-controller-hash");
  requireCommit(request.registration.commit, "execution-registration-commit");
  requireCommit(request.registration.tree, "execution-registration-tree");
  invariant(typeof request.registration.profileId === "string" &&
    safeIdPattern.test(request.registration.profileId), "execution-profile-id");
  invariant(request.registration.branch === "codex/model-acquisition-v2", "execution-branch");

  const profileArtifact = requireExpectedArtifact(profilePath,
    request.registration.profileByteLength, request.registration.profileSha256, false,
    "execution-profile-identity");
  const profile = readCanonicalJson(profilePath, maximumSourceLockBytes,
    "execution-profile-json").value;
  invariant(profile.profileId === request.registration.profileId &&
    profile.executionIdentity.executionId === request.executionId,
  "execution-profile-binding");
  requireExpectedArtifact(controllerPath, request.registration.controllerByteLength,
    request.registration.controllerSha256, false, "execution-controller-identity");

  const head = git(repositoryRoot, ["rev-parse", "HEAD"]);
  const tree = git(repositoryRoot, ["rev-parse", "HEAD^{tree}"]);
  const branch = git(repositoryRoot, ["branch", "--show-current"]);
  const tracking = git(repositoryRoot, ["rev-parse", `origin/${request.registration.branch}`]);
  const fetchHead = git(repositoryRoot, ["rev-parse", "FETCH_HEAD"]);
  const worktree = git(repositoryRoot, ["status", "--porcelain=v1"]);
  invariant(head === request.registration.commit && tree === request.registration.tree,
    "execution-registration-local-drift");
  invariant(branch === request.registration.branch && tracking === head && fetchHead === head &&
    worktree === "", "execution-registration-remote-drift");
  invariant(request.build.sourceCommit === head && request.build.sourceTree === tree,
    "execution-build-source");

  invariant(Array.isArray(request.build.command) && request.build.command.length === 8 &&
    canonicalJson(request.build.command) === canonicalJson([
      "cargo", "build", "--locked", "--release", "-p", "tinyrustlm-convert", "--target",
      "x86_64-pc-windows-msvc"
    ]), "execution-build-command");
  invariant(isPlainObject(request.build.environment), "execution-build-environment");
  invariant(isPlainObject(request.build.toolchain), "execution-build-toolchain");
  for (const field of ["stdoutByteLength", "stderrByteLength", "executableByteLength"]) {
    invariant(Number.isSafeInteger(request.build[field]) && request.build[field] >= 0,
      "execution-build-size");
  }
  const buildStdout = requireExpectedArtifact(request.build.stdoutPath,
    request.build.stdoutByteLength, requireSha256(request.build.stdoutSha256,
      "execution-build-stdout-hash"), true, "execution-build-stdout");
  const buildStderr = requireExpectedArtifact(request.build.stderrPath,
    request.build.stderrByteLength, requireSha256(request.build.stderrSha256,
      "execution-build-stderr-hash"), true, "execution-build-stderr");
  const executable = requireExpectedArtifact(request.build.executablePath,
    request.build.executableByteLength, requireSha256(request.build.executableSha256,
      "execution-executable-hash"), false, "execution-executable");
  invariant(inspectPeMachine(request.build.executablePath) === request.build.peMachine &&
    request.build.peMachine === "0x8664", "execution-executable-machine");

  const model = inspectLockedSource(request.inputs.modelSourceLockPath,
    requireSha256(request.inputs.modelSourceLockSha256, "execution-model-lock-hash"),
    request.inputs.modelSourceDirectory, "tinyrustlm.qwen3_source_lock.v1");
  const tokenizer = inspectLockedSource(request.inputs.tokenizerSourceLockPath,
    requireSha256(request.inputs.tokenizerSourceLockSha256, "execution-tokenizer-lock-hash"),
    request.inputs.tokenizerSourceDirectory, "tinyrustlm.qwen_tokenizer2_source_lock.v1");
  invariant(model.lock.modelId === tokenizer.lock.modelId &&
    model.lock.revision === tokenizer.lock.revision, "execution-source-relationship");
  const modelFiles = new Map(Object.values(model.lock.files).map((entry) => [entry.path, entry]));
  for (const entry of Object.values(tokenizer.lock.files)) {
    invariant(canonicalJson(modelFiles.get(entry.path)) === canonicalJson(entry),
      "execution-source-shared-record");
  }
  const compositionProfile = requireExpectedArtifact(request.inputs.compositionProfilePath,
    fs.lstatSync(request.inputs.compositionProfilePath).size,
    requireSha256(request.inputs.compositionProfileSha256, "execution-composition-profile-hash"),
    false, "execution-composition-profile");

  const evidenceRoot = requireCanonicalAbsolutePath(
    request.invocation.evidenceRoot, "execution-evidence-root");
  const outputRoot = requireCanonicalAbsolutePath(
    request.invocation.outputRoot, "execution-output-root");
  const workingDirectory = requireCanonicalAbsolutePath(
    request.invocation.workingDirectory, "execution-working-directory");
  invariant(workingDirectory === repositoryRoot, "execution-working-directory");
  inspectDirectDirectory(path.dirname(evidenceRoot), "execution-evidence-parent");
  inspectDirectDirectory(path.dirname(outputRoot), "execution-output-parent");
  invariant(!fs.existsSync(evidenceRoot), "execution-evidence-root-exists");
  invariant(!fs.existsSync(outputRoot), "execution-output-root-exists");
  validateTreeSeparation({
    modelSourceDirectory: request.inputs.modelSourceDirectory,
    tokenizerSourceDirectory: request.inputs.tokenizerSourceDirectory,
    outputRoot,
    evidenceRoot
  });
  invariant(Number.isSafeInteger(request.invocation.maximumDurationMilliseconds) &&
    request.invocation.maximumDurationMilliseconds >= 1 &&
    request.invocation.maximumDurationMilliseconds <= 604800000,
  "execution-duration-bound");
  invariant(Number.isSafeInteger(request.invocation.maximumStdoutBytes) &&
    request.invocation.maximumStdoutBytes >= 1 &&
    request.invocation.maximumStdoutBytes <= 1048576, "execution-stdout-bound");
  invariant(Number.isSafeInteger(request.invocation.maximumStderrBytes) &&
    request.invocation.maximumStderrBytes >= 1 &&
    request.invocation.maximumStderrBytes <= 65536, "execution-stderr-bound");
  const expectedArguments = [
    "qwen3-composition",
    request.inputs.modelSourceLockPath,
    request.inputs.modelSourceDirectory,
    request.inputs.tokenizerSourceLockPath,
    request.inputs.tokenizerSourceDirectory,
    outputRoot
  ];
  invariant(Array.isArray(request.invocation.arguments) &&
    canonicalJson(request.invocation.arguments) === canonicalJson(expectedArguments),
  "execution-arguments");

  const observedAtUtc = new Date().toISOString();
  const binding = {
    schema: bindingSchema,
    executionId: request.executionId,
    request: {
      byteLength: requestDocument.artifact.byteLength,
      sha256: requestDocument.artifact.sha256
    },
    registration: {
      profilePath,
      profileByteLength: profileArtifact.byteLength,
      profileSha256: profileArtifact.sha256,
      profileId: request.registration.profileId,
      commit: head,
      tree,
      branch,
      trackingCommit: tracking,
      fetchHead,
      controllerPath,
      controllerByteLength: request.registration.controllerByteLength,
      controllerSha256: request.registration.controllerSha256
    },
    build: {
      sourceCommit: request.build.sourceCommit,
      sourceTree: request.build.sourceTree,
      stdoutPath: request.build.stdoutPath,
      stdout: buildStdout,
      stderrPath: request.build.stderrPath,
      stderr: buildStderr,
      executablePath: request.build.executablePath,
      executable,
      peMachine: request.build.peMachine,
      command: request.build.command,
      environment: request.build.environment,
      toolchain: request.build.toolchain
    },
    inputs: {
      modelSourceLockPath: request.inputs.modelSourceLockPath,
      modelSourceLockSha256: request.inputs.modelSourceLockSha256,
      modelSourceDirectory: request.inputs.modelSourceDirectory,
      modelSourceInventory: model.inventory,
      tokenizerSourceLockPath: request.inputs.tokenizerSourceLockPath,
      tokenizerSourceLockSha256: request.inputs.tokenizerSourceLockSha256,
      tokenizerSourceDirectory: request.inputs.tokenizerSourceDirectory,
      tokenizerSourceInventory: tokenizer.inventory,
      compositionProfilePath: request.inputs.compositionProfilePath,
      compositionProfile: compositionProfile
    },
    invocation: {
      executablePath: request.build.executablePath,
      arguments: request.invocation.arguments,
      workingDirectory,
      evidenceRoot,
      outputRoot,
      stdoutPath: safeChild(evidenceRoot, "converter.stdout.bin", "execution-log-path"),
      stderrPath: safeChild(evidenceRoot, "converter.stderr.bin", "execution-log-path"),
      maximumDurationMilliseconds: request.invocation.maximumDurationMilliseconds,
      maximumStdoutBytes: request.invocation.maximumStdoutBytes,
      maximumStderrBytes: request.invocation.maximumStderrBytes,
      launchCount: 1,
      retryAllowed: false,
      terminalRule: "existing-evidence-or-output-root-is-terminal-and-never-resumed"
    },
    preflight: {
      observedAtUtc,
      sourceFilesExact: true,
      sourceRootsDirectNonReparse: true,
      sourceRootsDistinct: true,
      outputRootAbsent: true,
      outputParentDirectNonReparse: true,
      sourceOutputNonoverlap: true,
      evidenceRootAbsent: true,
      executableExact: true,
      registrationRemoteExact: true
    }
  };
  const bindingBytes = Buffer.from(canonicalJson(binding), "utf8");
  invariant(bindingBytes.length <= maximumBindingBytes, "execution-binding-size");
  return Object.freeze({ request, requestDocument, binding, bindingBytes });
}

function writeNewDurable(filePath, bytes, maximumBytes) {
  invariant(Buffer.isBuffer(bytes) && bytes.length <= maximumBytes, "execution-evidence-size");
  const descriptor = fs.openSync(filePath, "wx");
  try {
    let offset = 0;
    while (offset < bytes.length) {
      offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
    }
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function createBoundedCapture(filePath, maximumBytes) {
  const descriptor = fs.openSync(filePath, "wx");
  let byteLength = 0;
  let overflow = false;
  return Object.freeze({
    append(chunk) {
      if (overflow) return;
      const remaining = maximumBytes + 1 - byteLength;
      const accepted = chunk.subarray(0, Math.max(0, remaining));
      if (accepted.length > 0) {
        fs.writeSync(descriptor, accepted);
        byteLength += accepted.length;
      }
      if (byteLength > maximumBytes || accepted.length < chunk.length) overflow = true;
    },
    close() {
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      return Object.freeze({ byteLength, overflow });
    }
  });
}

function runCapturedProcess(executablePath, argumentsList, options) {
  return new Promise((resolve) => {
    const stdout = createBoundedCapture(options.stdoutPath, options.maximumStdoutBytes);
    const stderr = createBoundedCapture(options.stderrPath, options.maximumStderrBytes);
    let timedOut = false;
    let killedForOverflow = false;
    let spawnCode = null;
    let child;
    const startedAt = Date.now();
    try {
      child = childProcess.spawn(executablePath, argumentsList, {
        cwd: options.workingDirectory,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch {
      spawnCode = "execution-process-spawn";
    }
    if (!child) {
      const stdoutResult = stdout.close();
      const stderrResult = stderr.close();
      resolve({
        startedAtUtc: new Date(startedAt).toISOString(),
        finishedAtUtc: new Date().toISOString(),
        durationMilliseconds: Date.now() - startedAt,
        processStarted: false,
        processIdObserved: false,
        exitCode: null,
        signal: null,
        timedOut,
        killedForOverflow,
        spawnCode,
        stdout: stdoutResult,
        stderr: stderrResult
      });
      return;
    }
    let settled = false;
    const stopForOverflow = () => {
      if (!killedForOverflow) {
        killedForOverflow = true;
        child.kill();
      }
    };
    child.stdout.on("data", (chunk) => {
      stdout.append(chunk);
      if (chunk.length > 0 && fs.lstatSync(options.stdoutPath).size > options.maximumStdoutBytes) {
        stopForOverflow();
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr.append(chunk);
      if (chunk.length > 0 && fs.lstatSync(options.stderrPath).size > options.maximumStderrBytes) {
        stopForOverflow();
      }
    });
    child.once("error", () => {
      spawnCode = "execution-process-error";
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.maximumDurationMilliseconds);
    child.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdoutResult = stdout.close();
      const stderrResult = stderr.close();
      resolve({
        startedAtUtc: new Date(startedAt).toISOString(),
        finishedAtUtc: new Date().toISOString(),
        durationMilliseconds: Date.now() - startedAt,
        processStarted: child.pid !== undefined,
        processIdObserved: child.pid !== undefined,
        exitCode,
        signal,
        timedOut,
        killedForOverflow,
        spawnCode,
        stdout: stdoutResult,
        stderr: stderrResult
      });
    });
  });
}

function inspectOutputInventory(outputRoot) {
  if (!fs.existsSync(outputRoot)) return Object.freeze([]);
  inspectDirectDirectory(outputRoot, "execution-output-tree");
  const entries = fs.readdirSync(outputRoot, { withFileTypes: true });
  invariant(entries.length <= maximumOutputFiles, "execution-output-count");
  const names = entries.map((entry) => {
    invariant(entry.isFile() && !entry.isSymbolicLink(), "execution-output-entry");
    return entry.name;
  }).sort();
  return Object.freeze(names.map((fileName) => Object.freeze({
    file: fileName,
    ...sha256File(safeChild(outputRoot, fileName, "execution-output-path"),
      maximumSourceFileBytes, true)
  })));
}

function safeErrorCode(error) {
  const candidate = error instanceof Error ? error.message : "execution-controller-error";
  return /^[a-z0-9][a-z0-9-]{2,127}$/u.test(candidate)
    ? candidate
    : "execution-controller-error";
}

async function execute(requestPath) {
  const prepared = prepareExecution(requestPath);
  const { request, bindingBytes } = prepared;
  const evidenceRoot = request.invocation.evidenceRoot;
  fs.mkdirSync(evidenceRoot, { recursive: false });
  inspectDirectDirectory(evidenceRoot, "execution-evidence-root-created");
  const bindingPath = safeChild(evidenceRoot, "execution.binding.json",
    "execution-binding-path");
  writeNewDurable(bindingPath, bindingBytes, maximumBindingBytes);
  const bindingArtifact = sha256File(bindingPath, maximumBindingBytes, false);
  const start = {
    schema: startSchema,
    executionId: request.executionId,
    bindingSha256: bindingArtifact.sha256,
    authorizedAtUtc: new Date().toISOString(),
    launchOrdinal: 1,
    launchCountLimit: 1,
    retryAllowed: false,
    executableSha256: request.build.executableSha256,
    outputRootObservedAbsent: !fs.existsSync(request.invocation.outputRoot)
  };
  invariant(start.outputRootObservedAbsent, "execution-output-root-race");
  writeNewDurable(safeChild(evidenceRoot, "execution.start.json", "execution-start-path"),
    Buffer.from(canonicalJson(start), "utf8"), maximumBindingBytes);
  const beforeLaunch = sha256File(request.build.executablePath, maximumSourceFileBytes, false);
  invariant(beforeLaunch.byteLength === request.build.executableByteLength &&
    beforeLaunch.sha256 === request.build.executableSha256, "execution-executable-prelaunch-drift");

  const processResult = await runCapturedProcess(
    request.build.executablePath,
    request.invocation.arguments,
    {
      workingDirectory: request.invocation.workingDirectory,
      stdoutPath: safeChild(evidenceRoot, "converter.stdout.bin", "execution-stdout-path"),
      stderrPath: safeChild(evidenceRoot, "converter.stderr.bin", "execution-stderr-path"),
      maximumDurationMilliseconds: request.invocation.maximumDurationMilliseconds,
      maximumStdoutBytes: request.invocation.maximumStdoutBytes,
      maximumStderrBytes: request.invocation.maximumStderrBytes
    }
  );
  const stdout = sha256File(safeChild(evidenceRoot, "converter.stdout.bin",
    "execution-stdout-path"), request.invocation.maximumStdoutBytes + 1, true);
  const stderr = sha256File(safeChild(evidenceRoot, "converter.stderr.bin",
    "execution-stderr-path"), request.invocation.maximumStderrBytes + 1, true);
  const afterLaunch = sha256File(request.build.executablePath, maximumSourceFileBytes, false);
  const executableUnchanged = canonicalJson(beforeLaunch) === canonicalJson(afterLaunch);
  const outputInventory = inspectOutputInventory(request.invocation.outputRoot);
  let summaryStatus = null;
  if (stdout.byteLength > 0 && stdout.byteLength <= request.invocation.maximumStdoutBytes) {
    try {
      const summary = JSON.parse(fs.readFileSync(
        safeChild(evidenceRoot, "converter.stdout.bin", "execution-stdout-path"), "utf8"));
      if (isPlainObject(summary) && typeof summary.status === "string") {
        summaryStatus = summary.status;
      }
    } catch {
      summaryStatus = null;
    }
  }
  const candidatePass = processResult.processStarted && processResult.exitCode === 0 &&
    processResult.signal === null && !processResult.timedOut && !processResult.killedForOverflow &&
    processResult.spawnCode === null && !processResult.stdout.overflow &&
    !processResult.stderr.overflow && stderr.byteLength === 0 && executableUnchanged &&
    summaryStatus === "pass" && outputInventory.length === 10;
  const terminal = {
    schema: terminalSchema,
    executionId: request.executionId,
    bindingSha256: bindingArtifact.sha256,
    status: candidatePass
      ? "candidate-pass-awaiting-managed-durable-inspection"
      : "terminal-process-failure",
    process: processResult,
    stdout,
    stderr,
    executableBefore: beforeLaunch,
    executableAfter: afterLaunch,
    executableUnchanged,
    summaryStatus,
    outputInventory,
    managedDurableInspectionCompleted: false,
    finalStructuralDecision: "not-yet-authorized",
    retryAllowed: false,
    evidenceOverwriteAllowed: false,
    outputCleanupAllowed: false
  };
  const terminalBytes = Buffer.from(canonicalJson(terminal), "utf8");
  writeNewDurable(safeChild(evidenceRoot, "execution.terminal.json",
    "execution-terminal-path"), terminalBytes, maximumTerminalBytes);
  const publicSummary = {
    schema: "tinyrustlm.qwen3-composition-execution-controller-summary.v1",
    executionId: request.executionId,
    status: terminal.status,
    processStarted: processResult.processStarted,
    exitCode: processResult.exitCode,
    stdoutBytes: stdout.byteLength,
    stderrBytes: stderr.byteLength,
    outputFileCount: outputInventory.length,
    managedDurableInspectionCompleted: false
  };
  process.stdout.write(canonicalJson(publicSummary));
  return Object.freeze({ prepared, terminal, publicSummary });
}

async function main(argv) {
  invariant(argv.length === 2, "execution-controller-arguments");
  const [command, requestPath] = argv;
  if (command === "preflight") {
    const prepared = prepareExecution(path.resolve(requestPath));
    process.stdout.write(canonicalJson({
      schema: "tinyrustlm.qwen3-composition-execution-preflight-summary.v1",
      executionId: prepared.request.executionId,
      status: "ready",
      requestSha256: prepared.requestDocument.artifact.sha256,
      evidenceRootAbsent: true,
      outputRootAbsent: true
    }));
    return;
  }
  invariant(command === "execute", "execution-controller-command");
  await execute(path.resolve(requestPath));
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${canonicalJson({
      schema: "tinyrustlm.qwen3-composition-execution-controller-error.v1",
      status: "error",
      code: safeErrorCode(error)
    })}`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  bindingSchema,
  canonicalJson,
  execute,
  inspectPeMachine,
  prepareExecution,
  requestSchema,
  runCapturedProcess,
  sha256File,
  startSchema,
  terminalSchema,
  validateRequestShape,
  writeNewDurable
});

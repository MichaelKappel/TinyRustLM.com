"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const requestSchema = "tinyrustlm.qwen3-composition-verification-request.v1";
const bindingSchema = "tinyrustlm.qwen3-composition-verification-binding.v1";
const startSchema = "tinyrustlm.qwen3-composition-verification-start.v1";
const processTerminalSchema =
  "tinyrustlm.qwen3-composition-verification-process-terminal.v1";
const finalVerificationSchema =
  "tinyrustlm.qwen3-composition-execution-verification.v6";
const managedIntentSchema = "tinyrustlm.qwen3-composition-conversion-intent.v1";
const managedResultSchema = "tinyrustlm.qwen3-composition-managed-inspection.v1";
const managedErrorSchema = "tinyrustlm.qwen3-composition-managed-inspection-error.v1";
const converterSummarySchema =
  "tinyrustlm.qwen3_composition_conversion_cli_summary.v1";
const custodySummarySchema = "tinyrustlm.build-custody-summary.v4";

const maximumRequestBytes = 256 * 1024;
const maximumProfileBytes = 4 * 1024 * 1024;
const maximumBindingBytes = 4 * 1024 * 1024;
const maximumStartBytes = 64 * 1024;
const maximumProcessTerminalBytes = 1024 * 1024;
const maximumVerificationBytes = 4 * 1024 * 1024;
const maximumCustodySummaryBytes = 64 * 1024;
const maximumSourceLockBytes = 1024 * 1024;
const maximumSourceFileBytes = 8 * 1024 * 1024 * 1024;
const maximumManagedFileBytes = 64 * 1024 * 1024;
const maximumOutputFileBytes = 8 * 1024 * 1024 * 1024;
const hashBufferBytes = 1024 * 1024;
const maximumTerminationOutputBytes = 64 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const commitPattern = /^[a-f0-9]{40}$/u;
const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/u;
const safeErrorPattern = /^[a-z0-9][a-z0-9-]{2,127}$/u;
const exactOutputNames = Object.freeze([
  "composition.acg2",
  "composition.attempt.json",
  "composition.conversion-receipt.json",
  "model.slm2",
  "model.slm2.conversion-receipt.json",
  "prompt.prompt2",
  "sampling.sampling2",
  "template.template2",
  "tokenizer.tokenizer2",
  "tokenizer.tokenizer2.conversion-receipt.json"
]);
const exactManagedOutputNames = Object.freeze([
  "TinyRustLM.CompositionInspector.deps.json",
  "TinyRustLM.CompositionInspector.dll",
  "TinyRustLM.CompositionInspector.runtimeconfig.json",
  "TinyRustLM.Conversion.dll",
  "tinyrustlm-build-scratch-inspect.exe"
]);
const evidenceNames = Object.freeze({
  binding: "operation.binding.json",
  start: "operation.start.json",
  converterStdout: "converter.stdout.bin",
  converterStderr: "converter.stderr.bin",
  converterTerminal: "converter.process-terminal.json",
  managedIntent: "managed-inspection.intent.json",
  managedStdout: "managed-inspection.stdout.bin",
  managedStderr: "managed-inspection.stderr.bin",
  managedTerminal: "managed-inspection.process-terminal.json",
  verification: "execution.verification.json"
});

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

function requireSafeId(value, code) {
  invariant(typeof value === "string" && safeIdPattern.test(value), code);
  return value;
}

function safeErrorCode(error, fallback = "verification-owner-error") {
  const candidate = error instanceof Error ? error.message : fallback;
  return safeErrorPattern.test(candidate) ? candidate : fallback;
}

function requireCanonicalAbsolutePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 && path.isAbsolute(value), code);
  invariant(path.resolve(value) === value, code);
  return value;
}

function canonicalWindowsPath(value) {
  invariant(typeof value === "string" && /^[A-Za-z]:[\\/]/u.test(value),
    "verification-child-path");
  invariant(!value.startsWith("\\\\"), "verification-child-path");
  const normalized = path.win32.normalize(value);
  invariant(path.win32.isAbsolute(normalized) && /^[A-Za-z]:\\/u.test(normalized),
    "verification-child-path");
  return `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}

function inspectPathComponents(targetPath, code) {
  const normalized = requireCanonicalAbsolutePath(targetPath, code);
  const parsed = path.parse(normalized);
  let current = parsed.root;
  const components = normalized.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const component of components) {
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
  invariant(stat.isFile() && !stat.isSymbolicLink() && Number.isSafeInteger(stat.size), code);
  invariant((allowEmpty ? stat.size >= 0 : stat.size > 0) && stat.size <= maximumBytes, code);
  return Object.freeze({ path: normalized, byteLength: stat.size });
}

function sha256File(filePath, maximumBytes = maximumSourceFileBytes, allowEmpty = false) {
  const file = inspectRegularFile(filePath, maximumBytes, allowEmpty,
    "verification-file-invalid");
  const digest = crypto.createHash("sha256");
  const descriptor = fs.openSync(file.path, "r");
  const buffer = Buffer.allocUnsafe(hashBufferBytes);
  try {
    let offset = 0;
    while (offset < file.byteLength) {
      const read = fs.readSync(descriptor, buffer, 0,
        Math.min(buffer.length, file.byteLength - offset), offset);
      invariant(read > 0, "verification-file-short-read");
      digest.update(buffer.subarray(0, read));
      offset += read;
    }
    invariant(fs.fstatSync(descriptor).size === file.byteLength,
      "verification-file-drift");
  } finally {
    fs.closeSync(descriptor);
  }
  return Object.freeze({
    byteLength: file.byteLength,
    sha256: digest.digest("hex")
  });
}

function inspectCanonicalJsonBytes(bytes, maximumBytes, code) {
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumBytes, code);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(code);
  }
  invariant(isPlainObject(value), code);
  invariant(bytes.equals(Buffer.from(canonicalJson(value), "utf8")), code);
  return value;
}

function readCanonicalJson(filePath, maximumBytes, code) {
  const artifact = sha256File(filePath, maximumBytes, false);
  const bytes = fs.readFileSync(filePath);
  const value = inspectCanonicalJsonBytes(bytes, maximumBytes, code);
  return Object.freeze({ artifact, value });
}

function safeChild(root, fileName, code) {
  invariant(typeof fileName === "string" && path.basename(fileName) === fileName, code);
  const target = path.resolve(root, fileName);
  invariant(path.dirname(target) === root, code);
  return target;
}

function isAncestorOrSame(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function validateTreeSeparation(roots) {
  for (let left = 0; left < roots.length; left += 1) {
    for (let right = left + 1; right < roots.length; right += 1) {
      invariant(!isAncestorOrSame(roots[left], roots[right]) &&
        !isAncestorOrSame(roots[right], roots[left]), "verification-tree-overlap");
    }
  }
}

function requireExpectedArtifact(filePath, byteLength, sha256, allowEmpty, code,
  maximumBytes = maximumSourceFileBytes) {
  requireSafeInteger(byteLength, allowEmpty ? 0 : 1, maximumBytes, code);
  requireSha256(sha256, code);
  const observed = sha256File(filePath, maximumBytes, allowEmpty);
  invariant(observed.byteLength === byteLength && observed.sha256 === sha256, code);
  return observed;
}

function inspectPeMachine(executablePath) {
  const descriptor = fs.openSync(executablePath, "r");
  try {
    const dos = Buffer.alloc(64);
    invariant(fs.readSync(descriptor, dos, 0, dos.length, 0) === dos.length,
      "verification-executable-pe");
    invariant(dos.readUInt16LE(0) === 0x5a4d, "verification-executable-pe");
    const peOffset = dos.readUInt32LE(0x3c);
    invariant(peOffset >= 64 && peOffset <= 16 * 1024 * 1024,
      "verification-executable-pe");
    const header = Buffer.alloc(6);
    invariant(fs.readSync(descriptor, header, 0, header.length, peOffset) === header.length,
      "verification-executable-pe");
    invariant(header.readUInt32LE(0) === 0x00004550, "verification-executable-pe");
    return `0x${header.readUInt16LE(4).toString(16).padStart(4, "0")}`;
  } finally {
    fs.closeSync(descriptor);
  }
}

function git(repositoryRoot, argumentsList) {
  return childProcess.execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  }).trim();
}

function validateArtifactRecord(record, code) {
  requireExactKeys(record, ["path", "byteLength", "sha256"], code);
  invariant(typeof record.path === "string" && record.path.length > 0, code);
  requireSafeInteger(record.byteLength, 1, maximumManagedFileBytes, code);
  requireSha256(record.sha256, code);
}

function validateRequestShape(request) {
  requireExactKeys(request,
    ["schema", "executionId", "registration", "custody", "inputs", "invocation"],
    "verification-request-fields");
  invariant(request.schema === requestSchema, "verification-request-schema");
  requireSafeId(request.executionId, "verification-execution-id");
  requireExactKeys(request.registration, [
    "repositoryRoot", "profilePath", "profileByteLength", "profileSha256", "profileId",
    "commit", "tree", "branch", "ownerProfilePath", "ownerProfileByteLength",
    "ownerProfileSha256", "ownerProfileId", "ownerPath", "ownerByteLength", "ownerSha256",
    "ownerRuntimePath", "ownerRuntimeByteLength", "ownerRuntimeSha256",
    "ownerRuntimeVersion", "ownerRuntimePlatform", "ownerRuntimeArchitecture",
    "terminationToolPath", "terminationToolByteLength", "terminationToolSha256"
  ], "verification-registration-fields");
  requireExactKeys(request.custody, ["rust", "managed"],
    "verification-custody-fields");
  requireExactKeys(request.custody.rust, [
    "summaryPath", "summaryByteLength", "summarySha256", "summarySchema", "operationId",
    "sourceCommit", "sourceTree", "executablePath", "executableByteLength",
    "executableSha256", "executablePeMachine"
  ], "verification-rust-custody-fields");
  requireExactKeys(request.custody.managed, [
    "summaryPath", "summaryByteLength", "summarySha256", "summarySchema", "operationId",
    "sourceCommit", "sourceTree", "runtimePath", "runtimeByteLength", "runtimeSha256",
    "runtimeVersion", "inspectorAssemblyPath", "inspectorAssemblyByteLength",
    "inspectorAssemblySha256", "outputInventory"
  ], "verification-managed-custody-fields");
  requireExactKeys(request.inputs, [
    "modelSourceLockPath", "modelSourceLockSha256", "modelSourceDirectory",
    "tokenizerSourceLockPath", "tokenizerSourceLockSha256", "tokenizerSourceDirectory",
    "compositionProfilePath", "compositionProfileSha256"
  ], "verification-input-fields");
  requireExactKeys(request.invocation, [
    "evidenceRoot", "outputRoot", "workingDirectory", "converterArguments",
    "managedArgumentsPrefix", "converterMaximumDurationMilliseconds",
    "converterMaximumStdoutBytes", "converterMaximumStderrBytes",
    "managedMaximumDurationMilliseconds", "managedMaximumStdoutBytes",
    "managedMaximumStderrBytes", "maximumOutputFiles", "maximumOutputAggregateBytes",
    "compositionTerminalRule", "operationTerminalRule"
  ], "verification-invocation-fields");

  for (const field of ["profileByteLength", "ownerProfileByteLength", "ownerByteLength",
    "ownerRuntimeByteLength", "terminationToolByteLength"]) {
    requireSafeInteger(request.registration[field], 1, maximumSourceFileBytes,
      "verification-registration-size");
  }
  for (const field of ["profileSha256", "ownerProfileSha256", "ownerSha256",
    "ownerRuntimeSha256", "terminationToolSha256"]) {
    requireSha256(request.registration[field], "verification-registration-hash");
  }
  requireSafeId(request.registration.profileId, "verification-profile-id");
  invariant(request.registration.ownerProfileId ===
    "tinyrustlm.qwen3-composition-verification-owner/1",
  "verification-owner-profile-id");
  requireCommit(request.registration.commit, "verification-registration-commit");
  requireCommit(request.registration.tree, "verification-registration-tree");
  invariant(request.registration.branch === "codex/model-acquisition-v2",
    "verification-registration-branch");
  invariant(request.registration.ownerRuntimePlatform === "win32" &&
    request.registration.ownerRuntimeArchitecture === "x64",
  "verification-registration-platform");
  invariant(typeof request.registration.ownerRuntimeVersion === "string" &&
    /^v[0-9]+\.[0-9]+\.[0-9]+$/u.test(request.registration.ownerRuntimeVersion),
  "verification-owner-runtime-version");

  const rust = request.custody.rust;
  const managed = request.custody.managed;
  for (const custody of [rust, managed]) {
    requireSafeInteger(custody.summaryByteLength, 1, maximumCustodySummaryBytes,
      "verification-custody-summary-size");
    requireSha256(custody.summarySha256, "verification-custody-summary-hash");
    invariant(custody.summarySchema === custodySummarySchema,
      "verification-custody-summary-schema");
    requireSafeId(custody.operationId, "verification-custody-operation-id");
    requireCommit(custody.sourceCommit, "verification-custody-source-commit");
    requireCommit(custody.sourceTree, "verification-custody-source-tree");
  }
  requireSafeInteger(rust.executableByteLength, 1, maximumManagedFileBytes,
    "verification-converter-size");
  requireSha256(rust.executableSha256, "verification-converter-hash");
  invariant(rust.executablePeMachine === "0x8664", "verification-converter-machine");
  requireSafeInteger(managed.runtimeByteLength, 1, maximumManagedFileBytes,
    "verification-managed-runtime-size");
  requireSha256(managed.runtimeSha256, "verification-managed-runtime-hash");
  invariant(typeof managed.runtimeVersion === "string" && managed.runtimeVersion.length > 0,
    "verification-managed-runtime-version");
  requireSafeInteger(managed.inspectorAssemblyByteLength, 1, maximumManagedFileBytes,
    "verification-managed-inspector-size");
  requireSha256(managed.inspectorAssemblySha256, "verification-managed-inspector-hash");
  invariant(Array.isArray(managed.outputInventory) &&
    managed.outputInventory.length >= exactManagedOutputNames.length &&
    managed.outputInventory.length <= 64,
  "verification-managed-inventory-names");
  managed.outputInventory.forEach((record) =>
    validateArtifactRecord(record, "verification-managed-inventory-record"));
  const managedNames = managed.outputInventory.map((record) =>
    path.win32.basename(record.path));
  invariant(canonicalJson(managedNames) === canonicalJson([...managedNames].sort()) &&
    new Set(managedNames.map((name) => name.toLowerCase())).size === managedNames.length &&
    exactManagedOutputNames.every((name) => managedNames.includes(name)),
  "verification-managed-inventory-names");
  const inspector = managed.outputInventory.find((record) =>
    path.win32.basename(record.path) === "TinyRustLM.CompositionInspector.dll");
  invariant(inspector && inspector.path === managed.inspectorAssemblyPath &&
    inspector.byteLength === managed.inspectorAssemblyByteLength &&
    inspector.sha256 === managed.inspectorAssemblySha256,
  "verification-managed-inspector-binding");

  for (const field of ["modelSourceLockSha256", "tokenizerSourceLockSha256",
    "compositionProfileSha256"]) {
    requireSha256(request.inputs[field], "verification-input-hash");
  }
  invariant(Array.isArray(request.invocation.converterArguments) &&
    request.invocation.converterArguments.length === 6,
  "verification-converter-arguments");
  invariant(Array.isArray(request.invocation.managedArgumentsPrefix) &&
    request.invocation.managedArgumentsPrefix.length === 2 &&
    request.invocation.managedArgumentsPrefix[0] === managed.inspectorAssemblyPath &&
    request.invocation.managedArgumentsPrefix[1] === "inspect",
  "verification-managed-arguments");
  for (const field of ["converterMaximumDurationMilliseconds",
    "managedMaximumDurationMilliseconds"]) {
    requireSafeInteger(request.invocation[field], 1, 604_800_000,
      "verification-duration-bound");
  }
  for (const field of ["converterMaximumStdoutBytes", "managedMaximumStdoutBytes"]) {
    requireSafeInteger(request.invocation[field], 1, 1_048_576,
      "verification-stdout-bound");
  }
  for (const field of ["converterMaximumStderrBytes", "managedMaximumStderrBytes"]) {
    requireSafeInteger(request.invocation[field], 1, 65_536,
      "verification-stderr-bound");
  }
  invariant(request.invocation.maximumOutputFiles === exactOutputNames.length,
    "verification-output-count-bound");
  requireSafeInteger(request.invocation.maximumOutputAggregateBytes, 1,
    16 * 1024 * 1024 * 1024, "verification-output-aggregate-bound");
  invariant(request.invocation.compositionTerminalRule ===
    "existing-output-root-is-never-resumed",
  "verification-composition-terminal-rule");
  invariant(request.invocation.operationTerminalRule ===
    "existing-evidence-or-output-root-is-terminal-and-never-resumed",
  "verification-operation-terminal-rule");
}

function writeNewDurable(filePath, bytes, maximumBytes) {
  invariant(Buffer.isBuffer(bytes) && bytes.length <= maximumBytes,
    "verification-evidence-size");
  const descriptor = fs.openSync(filePath, "wx");
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      invariant(written > 0, "verification-evidence-short-write");
      offset += written;
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
  let closed = false;
  return Object.freeze({
    append(chunk) {
      invariant(!closed && Buffer.isBuffer(chunk), "verification-capture-state");
      if (overflow) return;
      const remaining = maximumBytes + 1 - byteLength;
      const accepted = chunk.subarray(0, Math.max(0, remaining));
      if (accepted.length > 0) {
        const written = fs.writeSync(descriptor, accepted);
        invariant(written === accepted.length, "verification-capture-short-write");
        byteLength += written;
      }
      if (byteLength > maximumBytes || accepted.length < chunk.length) overflow = true;
    },
    close() {
      invariant(!closed, "verification-capture-state");
      closed = true;
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      return Object.freeze({ byteLength, overflow });
    }
  });
}

function summarizeBytes(bytes) {
  return Object.freeze({
    byteLength: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  });
}

function terminateOwnedProcess(child, options) {
  if (!child || child.pid === undefined) {
    return Object.freeze({ requested: false, method: null, toolExitCode: null,
      stdout: null, stderr: null });
  }
  if (process.platform === "win32" && options.terminationToolPath) {
    const result = childProcess.spawnSync(options.terminationToolPath,
      ["/PID", String(child.pid), "/T", "/F"], {
        cwd: options.workingDirectory,
        encoding: "buffer",
        maxBuffer: maximumTerminationOutputBytes,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0);
    return Object.freeze({
      requested: true,
      method: "exact-taskkill-process-tree",
      toolExitCode: result.status,
      spawnError: result.error ? "verification-termination-tool-error" : null,
      stdout: summarizeBytes(stdout),
      stderr: summarizeBytes(stderr)
    });
  }
  const signaled = child.kill();
  return Object.freeze({
    requested: true,
    method: "direct-child-termination",
    toolExitCode: null,
    spawnError: null,
    signalAccepted: signaled,
    stdout: null,
    stderr: null
  });
}

function runCapturedProcess(executablePath, argumentsList, options) {
  return new Promise((resolve) => {
    const stdoutCapture = createBoundedCapture(options.stdoutPath,
      options.maximumStdoutBytes);
    let stderrCapture;
    try {
      stderrCapture = createBoundedCapture(options.stderrPath,
        options.maximumStderrBytes);
    } catch (error) {
      stdoutCapture.close();
      throw error;
    }
    let timedOut = false;
    let killedForOverflow = false;
    let spawnCode = null;
    let termination = Object.freeze({ requested: false, method: null,
      toolExitCode: null, stdout: null, stderr: null });
    let child;
    const startedAt = Date.now();
    const finishWithoutChild = () => {
      const stdoutState = stdoutCapture.close();
      const stderrState = stderrCapture.close();
      resolve(Object.freeze({
        stage: options.stage,
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
        termination,
        stdout: Object.freeze({ ...stdoutState,
          ...sha256File(options.stdoutPath, options.maximumStdoutBytes + 1, true) }),
        stderr: Object.freeze({ ...stderrState,
          ...sha256File(options.stderrPath, options.maximumStderrBytes + 1, true) })
      }));
    };
    try {
      child = childProcess.spawn(executablePath, argumentsList, {
        cwd: options.workingDirectory,
        windowsHide: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch {
      spawnCode = "verification-process-spawn";
      finishWithoutChild();
      return;
    }
    let settled = false;
    const requestTermination = (reason) => {
      if (termination.requested) return;
      if (reason === "overflow") killedForOverflow = true;
      if (reason === "timeout") timedOut = true;
      termination = terminateOwnedProcess(child, options);
    };
    child.stdout.on("data", (chunk) => {
      stdoutCapture.append(chunk);
      if (fs.lstatSync(options.stdoutPath).size > options.maximumStdoutBytes) {
        requestTermination("overflow");
      }
    });
    child.stderr.on("data", (chunk) => {
      stderrCapture.append(chunk);
      if (fs.lstatSync(options.stderrPath).size > options.maximumStderrBytes) {
        requestTermination("overflow");
      }
    });
    child.once("error", () => {
      spawnCode = "verification-process-error";
    });
    const timer = setTimeout(() => requestTermination("timeout"),
      options.maximumDurationMilliseconds);
    child.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdoutState = stdoutCapture.close();
      const stderrState = stderrCapture.close();
      resolve(Object.freeze({
        stage: options.stage,
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
        termination,
        stdout: Object.freeze({ ...stdoutState,
          ...sha256File(options.stdoutPath, options.maximumStdoutBytes + 1, true) }),
        stderr: Object.freeze({ ...stderrState,
          ...sha256File(options.stderrPath, options.maximumStderrBytes + 1, true) })
      }));
    });
  });
}

function createManagedInspectionIntent(request) {
  return {
    schema: managedIntentSchema,
    modelSourceLockPath: canonicalWindowsPath(request.inputs.modelSourceLockPath),
    modelSourceLockSha256: request.inputs.modelSourceLockSha256,
    modelSourceDirectory: canonicalWindowsPath(request.inputs.modelSourceDirectory),
    tokenizerSourceLockPath: canonicalWindowsPath(request.inputs.tokenizerSourceLockPath),
    tokenizerSourceLockSha256: request.inputs.tokenizerSourceLockSha256,
    tokenizerSourceDirectory: canonicalWindowsPath(request.inputs.tokenizerSourceDirectory),
    compositionProfileSha256: request.inputs.compositionProfileSha256,
    outputRoot: canonicalWindowsPath(request.invocation.outputRoot),
    converterExecutablePath: canonicalWindowsPath(request.custody.rust.executablePath),
    converterExecutableSha256: request.custody.rust.executableSha256,
    maximumDurationMilliseconds:
      request.invocation.converterMaximumDurationMilliseconds,
    maximumSummaryBytes: request.invocation.converterMaximumStdoutBytes,
    maximumErrorBytes: request.invocation.converterMaximumStderrBytes,
    terminalRule: request.invocation.compositionTerminalRule
  };
}

function verifyEvidenceInventory(root, expected) {
  inspectDirectDirectory(root, "verification-evidence-root");
  invariant(Array.isArray(expected) && expected.length > 0,
    "verification-evidence-inventory");
  return expected.map((entry) => {
    requireExactKeys(entry, ["file", "byteLength", "sha256"],
      "verification-evidence-record");
    requireSafeInteger(entry.byteLength, 0, maximumVerificationBytes,
      "verification-evidence-record");
    requireSha256(entry.sha256, "verification-evidence-record");
    const filePath = safeChild(root, entry.file, "verification-evidence-file");
    let stat;
    try {
      stat = fs.lstatSync(filePath);
    } catch {
      throw new Error("verification-evidence-file");
    }
    invariant(stat.isFile() && !stat.isSymbolicLink(), "verification-evidence-file");
    invariant(stat.size === entry.byteLength, "verification-evidence-identity");
    let observed;
    try {
      observed = sha256File(filePath, Math.max(entry.byteLength, 1), true);
    } catch {
      throw new Error("verification-evidence-identity");
    }
    invariant(observed.sha256 === entry.sha256, "verification-evidence-identity");
    return Object.freeze({ ...entry });
  });
}

function inspectLockedSource(lockPath, expectedSha256, sourceDirectory, expectedSchema) {
  const lock = readCanonicalJson(lockPath, maximumSourceLockBytes,
    "verification-source-lock-json");
  invariant(lock.artifact.sha256 === expectedSha256,
    "verification-source-lock-identity");
  invariant(lock.value.schema === expectedSchema, "verification-source-lock-schema");
  invariant(isPlainObject(lock.value.files), "verification-source-lock-files");
  const root = inspectDirectDirectory(sourceDirectory, "verification-source-root");
  const declarations = Object.values(lock.value.files);
  invariant(declarations.length > 0 && declarations.length <= 224,
    "verification-source-count");
  const expectedNames = declarations.map((entry) => {
    requireExactKeys(entry, ["path", "byteLength", "sha256"],
      "verification-source-record");
    invariant(typeof entry.path === "string" && path.basename(entry.path) === entry.path,
      "verification-source-name");
    requireSafeInteger(entry.byteLength, 1, maximumSourceFileBytes,
      "verification-source-size");
    requireSha256(entry.sha256, "verification-source-hash");
    return entry.path;
  }).sort();
  invariant(new Set(expectedNames).size === expectedNames.length,
    "verification-source-duplicate");
  const observedNames = fs.readdirSync(root, { withFileTypes: true }).map((entry) => {
    invariant(entry.isFile() && !entry.isSymbolicLink(), "verification-source-tree");
    return entry.name;
  }).sort();
  invariant(canonicalJson(observedNames) === canonicalJson(expectedNames),
    "verification-source-inventory");
  const byName = new Map(declarations.map((entry) => [entry.path, entry]));
  const inventory = observedNames.map((fileName) => {
    const expected = byName.get(fileName);
    const observed = sha256File(safeChild(root, fileName, "verification-source-path"),
      maximumSourceFileBytes, false);
    invariant(observed.byteLength === expected.byteLength,
      "verification-source-size-drift");
    invariant(observed.sha256 === expected.sha256, "verification-source-hash-drift");
    return Object.freeze({ file: fileName, ...observed });
  });
  return Object.freeze({ lock: lock.value, inventory: Object.freeze(inventory) });
}

function inspectCustodySummary(custody) {
  const document = readCanonicalJson(custody.summaryPath, maximumCustodySummaryBytes,
    "verification-custody-summary-json");
  invariant(document.artifact.byteLength === custody.summaryByteLength &&
    document.artifact.sha256 === custody.summarySha256,
  "verification-custody-summary-identity");
  const summary = document.value;
  invariant(summary.schema === custody.summarySchema &&
    summary.schema === custodySummarySchema &&
    summary.operationId === custody.operationId,
  "verification-custody-summary-binding");
  invariant(summary.status === "pass" && summary.code === "build-custody-pass" &&
    summary.processStarted === true && summary.exitCode === 0 &&
    summary.scratchInspectionInvoked === true &&
    summary.scratchInspectionStatus === "pass" &&
    summary.environmentValidated === true &&
    summary.testOnlyInProcess === false && summary.retryAllowed === false &&
    summary.campaignCreditAuthorized === false,
  "verification-custody-summary-pass");
  return Object.freeze({ artifact: document.artifact, summary });
}

function inspectManagedInventory(managed) {
  const roots = new Set(managed.outputInventory.map((entry) => path.dirname(entry.path)));
  invariant(roots.size === 1, "verification-managed-inventory-root");
  const root = inspectDirectDirectory([...roots][0], "verification-managed-inventory-root");
  const observedNames = fs.readdirSync(root, { withFileTypes: true }).map((entry) => {
    invariant(entry.isFile() && !entry.isSymbolicLink(),
      "verification-managed-inventory-entry");
    return entry.name;
  }).sort();
  const expectedNames = managed.outputInventory.map((entry) => path.basename(entry.path));
  invariant(canonicalJson(observedNames) === canonicalJson(expectedNames),
    "verification-managed-inventory-exact");
  const inventory = managed.outputInventory.map((expected) => {
    const observed = requireExpectedArtifact(expected.path, expected.byteLength,
      expected.sha256, false, "verification-managed-inventory-identity",
      maximumManagedFileBytes);
    return Object.freeze({ file: path.basename(expected.path), ...observed });
  });
  return Object.freeze({ root, inventory: Object.freeze(inventory) });
}

function inspectOutputInventory(outputRoot, invocation) {
  const root = inspectDirectDirectory(outputRoot, "verification-output-root");
  const entries = fs.readdirSync(root, { withFileTypes: true });
  invariant(entries.length === invocation.maximumOutputFiles,
    "verification-output-count");
  const names = entries.map((entry) => {
    invariant(entry.isFile() && !entry.isSymbolicLink(), "verification-output-entry");
    return entry.name;
  }).sort();
  invariant(canonicalJson(names) === canonicalJson(exactOutputNames),
    "verification-output-names");
  let aggregateByteLength = 0;
  const inventory = names.map((fileName) => {
    const observed = sha256File(safeChild(root, fileName, "verification-output-path"),
      maximumOutputFileBytes, false);
    aggregateByteLength += observed.byteLength;
    invariant(Number.isSafeInteger(aggregateByteLength) &&
      aggregateByteLength <= invocation.maximumOutputAggregateBytes,
    "verification-output-aggregate");
    return Object.freeze({ file: fileName, ...observed });
  });
  return Object.freeze({ aggregateByteLength, inventory: Object.freeze(inventory) });
}

function inspectOwnerProfile(ownerProfilePath, request, ownerArtifact) {
  const document = readCanonicalJson(ownerProfilePath, maximumProfileBytes,
    "verification-owner-profile-json");
  invariant(document.artifact.byteLength === request.registration.ownerProfileByteLength &&
    document.artifact.sha256 === request.registration.ownerProfileSha256,
  "verification-owner-profile-identity");
  const profile = document.value;
  requireExactKeys(profile, ["schema", "profileId", "status", "authority", "owner",
    "schemas", "commands", "evidence", "limits", "invariants", "claimBoundary"],
  "verification-owner-profile-fields");
  invariant(profile.schema ===
    "tinyrustlm.qwen3-composition-verification-owner-profile.v1" &&
    profile.profileId === request.registration.ownerProfileId &&
    profile.status === "sole-maintained-owner",
  "verification-owner-profile-binding");
  requireExactKeys(profile.owner, ["path", "byteLength", "sha256"],
    "verification-owner-profile-owner");
  invariant(profile.owner.path === path.relative(request.registration.repositoryRoot,
    request.registration.ownerPath).replaceAll("\\", "/") &&
    profile.owner.byteLength === ownerArtifact.byteLength &&
    profile.owner.sha256 === ownerArtifact.sha256,
  "verification-owner-profile-owner");
  invariant(canonicalJson(profile.schemas) === canonicalJson({
    request: requestSchema,
    binding: bindingSchema,
    start: startSchema,
    processTerminal: processTerminalSchema,
    finalVerification: finalVerificationSchema
  }), "verification-owner-profile-schemas");
  invariant(canonicalJson(profile.commands) === canonicalJson([
    "preflight", "execute", "verify"
  ]), "verification-owner-profile-commands");
  invariant(canonicalJson(profile.evidence) === canonicalJson(Object.values(evidenceNames)),
    "verification-owner-profile-evidence");
  invariant(profile.invariants.oneConverterLaunch === true &&
    profile.invariants.oneManagedInspectionLaunch === true &&
    profile.invariants.nativeWindowsChildPaths === true &&
    profile.invariants.rawStreamsOpenedCreateOnlyBeforeChildLaunch === true &&
    profile.invariants.processTerminalsCreateOnly === true &&
    profile.invariants.finalVerificationCreateOnly === true &&
    profile.invariants.readOnlyVerificationRehashesEveryEvidenceEdge === true &&
    Object.values(profile.claimBoundary).every((value) => value === false),
  "verification-owner-profile-invariants");
  return Object.freeze({ artifact: document.artifact, profile });
}

function inspectRegisteredProfile(profilePath, request, ownerProfile) {
  const document = readCanonicalJson(profilePath, maximumProfileBytes,
    "verification-profile-json");
  invariant(document.artifact.byteLength === request.registration.profileByteLength &&
    document.artifact.sha256 === request.registration.profileSha256,
  "verification-profile-identity");
  const profile = document.value;
  invariant(profile.profileId === request.registration.profileId &&
    profile.executionIdentity.executionId === request.executionId,
  "verification-profile-binding");
  requireExactKeys(profile.soleOwner, ["profile", "path", "byteLength", "sha256"],
    "verification-profile-owner");
  requireExactKeys(profile.soleOwner.profile,
    ["path", "byteLength", "sha256", "profileId"], "verification-profile-owner");
  invariant(canonicalJson(profile.soleOwner.profile) === canonicalJson({
    path: path.relative(request.registration.repositoryRoot,
      request.registration.ownerProfilePath).replaceAll("\\", "/"),
    byteLength: ownerProfile.artifact.byteLength,
    sha256: ownerProfile.artifact.sha256,
    profileId: request.registration.ownerProfileId
  }) && profile.soleOwner.path === path.relative(
    request.registration.repositoryRoot, request.registration.ownerPath).replaceAll("\\", "/") &&
    profile.soleOwner.byteLength === request.registration.ownerByteLength &&
    profile.soleOwner.sha256 === request.registration.ownerSha256,
  "verification-profile-owner");
  return Object.freeze({ artifact: document.artifact, profile });
}

function prepareExecution(requestPath, options = {}) {
  const requestDocument = readCanonicalJson(
    requireCanonicalAbsolutePath(requestPath, "verification-request-path"),
    maximumRequestBytes,
    "verification-request-json"
  );
  const request = requestDocument.value;
  validateRequestShape(request);
  invariant(process.platform === "win32" && process.arch === "x64",
    "verification-owner-host");
  const repositoryRoot = inspectDirectDirectory(request.registration.repositoryRoot,
    "verification-repository-root");
  const profilePath = requireCanonicalAbsolutePath(request.registration.profilePath,
    "verification-profile-path");
  const ownerProfilePath = requireCanonicalAbsolutePath(
    request.registration.ownerProfilePath, "verification-owner-profile-path");
  const ownerPath = requireCanonicalAbsolutePath(request.registration.ownerPath,
    "verification-owner-path");
  const ownerRuntimePath = requireCanonicalAbsolutePath(
    request.registration.ownerRuntimePath, "verification-owner-runtime-path");
  const terminationToolPath = requireCanonicalAbsolutePath(
    request.registration.terminationToolPath, "verification-termination-tool-path");
  invariant(isAncestorOrSame(repositoryRoot, profilePath) &&
    isAncestorOrSame(repositoryRoot, ownerProfilePath) &&
    isAncestorOrSame(repositoryRoot, ownerPath), "verification-registration-location");
  invariant(ownerPath === path.resolve(__filename), "verification-owner-location");
  invariant(ownerRuntimePath === path.resolve(process.execPath),
    "verification-owner-runtime-location");
  const owner = requireExpectedArtifact(ownerPath, request.registration.ownerByteLength,
    request.registration.ownerSha256, false, "verification-owner-identity");
  const ownerProfile = inspectOwnerProfile(ownerProfilePath, request, owner);
  const profile = inspectRegisteredProfile(profilePath, request, ownerProfile);
  const ownerRuntime = requireExpectedArtifact(ownerRuntimePath,
    request.registration.ownerRuntimeByteLength,
    request.registration.ownerRuntimeSha256, false,
    "verification-owner-runtime-identity");
  invariant(request.registration.ownerRuntimeVersion === process.version &&
    request.registration.ownerRuntimePlatform === process.platform &&
    request.registration.ownerRuntimeArchitecture === process.arch,
  "verification-owner-runtime-environment");
  const terminationTool = requireExpectedArtifact(terminationToolPath,
    request.registration.terminationToolByteLength,
    request.registration.terminationToolSha256, false,
    "verification-termination-tool-identity", maximumManagedFileBytes);
  invariant(inspectPeMachine(terminationToolPath) === "0x8664",
    "verification-termination-tool-machine");

  const head = git(repositoryRoot, ["rev-parse", "HEAD"]);
  const tree = git(repositoryRoot, ["rev-parse", "HEAD^{tree}"]);
  const branch = git(repositoryRoot, ["branch", "--show-current"]);
  const tracking = git(repositoryRoot,
    ["rev-parse", `origin/${request.registration.branch}`]);
  const fetchHead = git(repositoryRoot, ["rev-parse", "FETCH_HEAD"]);
  const worktree = git(repositoryRoot, ["status", "--porcelain=v1"]);
  invariant(head === request.registration.commit && tree === request.registration.tree,
    "verification-registration-local-drift");
  invariant(branch === request.registration.branch && tracking === head &&
    fetchHead === head && worktree === "", "verification-registration-remote-drift");

  const rust = request.custody.rust;
  const managed = request.custody.managed;
  invariant(rust.sourceCommit === head && managed.sourceCommit === head &&
    rust.sourceTree === tree && managed.sourceTree === tree,
  "verification-custody-source");
  const rustSummary = inspectCustodySummary(rust);
  const managedSummary = inspectCustodySummary(managed);
  const converter = requireExpectedArtifact(rust.executablePath,
    rust.executableByteLength, rust.executableSha256, false,
    "verification-converter-identity", maximumManagedFileBytes);
  invariant(inspectPeMachine(rust.executablePath) === rust.executablePeMachine,
    "verification-converter-machine");
  const managedRuntime = requireExpectedArtifact(managed.runtimePath,
    managed.runtimeByteLength, managed.runtimeSha256, false,
    "verification-managed-runtime-identity", maximumManagedFileBytes);
  invariant(inspectPeMachine(managed.runtimePath) === "0x8664",
    "verification-managed-runtime-machine");
  const managedInventory = inspectManagedInventory(managed);

  const model = inspectLockedSource(request.inputs.modelSourceLockPath,
    request.inputs.modelSourceLockSha256, request.inputs.modelSourceDirectory,
    "tinyrustlm.qwen3_source_lock.v1");
  const tokenizer = inspectLockedSource(request.inputs.tokenizerSourceLockPath,
    request.inputs.tokenizerSourceLockSha256, request.inputs.tokenizerSourceDirectory,
    "tinyrustlm.qwen_tokenizer2_source_lock.v1");
  invariant(model.lock.modelId === tokenizer.lock.modelId &&
    model.lock.revision === tokenizer.lock.revision,
  "verification-source-relationship");
  const modelFiles = new Map(Object.values(model.lock.files).map((entry) =>
    [entry.path, entry]));
  for (const entry of Object.values(tokenizer.lock.files)) {
    invariant(canonicalJson(modelFiles.get(entry.path)) === canonicalJson(entry),
      "verification-source-shared-record");
  }
  const compositionProfile = sha256File(request.inputs.compositionProfilePath,
    maximumProfileBytes, false);
  invariant(compositionProfile.sha256 === request.inputs.compositionProfileSha256,
    "verification-composition-profile");

  const evidenceRoot = requireCanonicalAbsolutePath(request.invocation.evidenceRoot,
    "verification-evidence-root-path");
  const outputRoot = requireCanonicalAbsolutePath(request.invocation.outputRoot,
    "verification-output-root-path");
  const workingDirectory = requireCanonicalAbsolutePath(
    request.invocation.workingDirectory, "verification-working-directory");
  invariant(workingDirectory === repositoryRoot, "verification-working-directory");
  const privateParent = inspectDirectDirectory(path.dirname(evidenceRoot),
    "verification-private-parent");
  invariant(path.dirname(outputRoot) === privateParent,
    "verification-private-root-parent");
  const privateDrive = path.parse(privateParent).root.toUpperCase();
  invariant(privateDrive === "C:\\" || privateDrive === "E:\\",
    "verification-private-drive");
  validateTreeSeparation([
    repositoryRoot,
    request.inputs.modelSourceDirectory,
    request.inputs.tokenizerSourceDirectory,
    path.dirname(rust.executablePath),
    managedInventory.root,
    evidenceRoot,
    outputRoot
  ]);
  const rootsMustBeAbsent = options.rootsMustBeAbsent !== false;
  if (rootsMustBeAbsent) {
    invariant(!fs.existsSync(evidenceRoot), "verification-evidence-root-exists");
    invariant(!fs.existsSync(outputRoot), "verification-output-root-exists");
  } else {
    inspectDirectDirectory(evidenceRoot, "verification-evidence-root");
  }
  const expectedConverterArguments = [
    "qwen3-composition",
    request.inputs.modelSourceLockPath,
    request.inputs.modelSourceDirectory,
    request.inputs.tokenizerSourceLockPath,
    request.inputs.tokenizerSourceDirectory,
    outputRoot
  ];
  invariant(canonicalJson(request.invocation.converterArguments) ===
    canonicalJson(expectedConverterArguments), "verification-converter-arguments");
  invariant(canonicalJson(request.invocation.managedArgumentsPrefix) === canonicalJson([
    managed.inspectorAssemblyPath,
    "inspect"
  ]), "verification-managed-arguments");

  const binding = {
    schema: bindingSchema,
    executionId: request.executionId,
    request: requestDocument.artifact,
    registration: {
      profile: profile.artifact,
      profileId: request.registration.profileId,
      ownerProfile: ownerProfile.artifact,
      ownerProfileId: request.registration.ownerProfileId,
      commit: head,
      tree,
      branch,
      trackingCommit: tracking,
      fetchHead,
      owner,
      ownerRuntime,
      ownerRuntimeVersion: process.version,
      ownerRuntimePlatform: process.platform,
      ownerRuntimeArchitecture: process.arch,
      terminationTool
    },
    custody: {
      rustSummary: rustSummary.artifact,
      managedSummary: managedSummary.artifact,
      converter,
      managedRuntime,
      managedRuntimeVersion: managed.runtimeVersion,
      managedInventory: managedInventory.inventory
    },
    inputs: {
      modelSourceLockSha256: request.inputs.modelSourceLockSha256,
      modelSourceInventory: model.inventory,
      tokenizerSourceLockSha256: request.inputs.tokenizerSourceLockSha256,
      tokenizerSourceInventory: tokenizer.inventory,
      compositionProfile
    },
    invocation: {
      converterArguments: request.invocation.converterArguments,
      managedArgumentsPrefix: request.invocation.managedArgumentsPrefix,
      limits: {
        converterMaximumDurationMilliseconds:
          request.invocation.converterMaximumDurationMilliseconds,
        converterMaximumStdoutBytes: request.invocation.converterMaximumStdoutBytes,
        converterMaximumStderrBytes: request.invocation.converterMaximumStderrBytes,
        managedMaximumDurationMilliseconds:
          request.invocation.managedMaximumDurationMilliseconds,
        managedMaximumStdoutBytes: request.invocation.managedMaximumStdoutBytes,
        managedMaximumStderrBytes: request.invocation.managedMaximumStderrBytes,
        maximumOutputFiles: request.invocation.maximumOutputFiles,
        maximumOutputAggregateBytes: request.invocation.maximumOutputAggregateBytes
      },
      launchCounts: { converter: 1, managedInspector: 1 },
      retryAllowed: false,
      overwriteAllowed: false,
      repairAllowed: false,
      fallbackAllowed: false,
      compositionTerminalRule: request.invocation.compositionTerminalRule,
      operationTerminalRule: request.invocation.operationTerminalRule
    },
    preflight: {
      observedAtUtc: new Date().toISOString(),
      registrationRemoteExact: true,
      sourceInventoriesExact: true,
      custodySummariesPass: true,
      converterExact: true,
      managedRuntimeAndInventoryExact: true,
      rootsAbsent: rootsMustBeAbsent
    }
  };
  const bindingBytes = Buffer.from(canonicalJson(binding), "utf8");
  invariant(bindingBytes.length <= maximumBindingBytes, "verification-binding-size");
  return Object.freeze({ request, requestDocument, binding, bindingBytes });
}

function writeCanonicalJsonNew(filePath, value, maximumBytes) {
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  invariant(bytes.length <= maximumBytes, "verification-evidence-size");
  writeNewDurable(filePath, bytes, maximumBytes);
  return sha256File(filePath, maximumBytes, false);
}

function readEvidenceJson(root, fileName, maximumBytes, code) {
  return readCanonicalJson(safeChild(root, fileName, code), maximumBytes, code);
}

function processOutcomePass(outcome) {
  return outcome.processStarted === true && outcome.processIdObserved === true &&
    outcome.exitCode === 0 && outcome.signal === null && outcome.timedOut === false &&
    outcome.killedForOverflow === false && outcome.spawnCode === null &&
    outcome.stdout.overflow === false && outcome.stderr.overflow === false;
}

function argumentsSha256(argumentsList) {
  return crypto.createHash("sha256")
    .update(Buffer.from(canonicalJson(argumentsList), "utf8")).digest("hex");
}

function sameArtifact(left, right) {
  return left && right && left.byteLength === right.byteLength &&
    left.sha256 === right.sha256;
}

function validateRawStream(root, fileName, expected, maximumBytes) {
  const observed = sha256File(safeChild(root, fileName, "verification-raw-stream-path"),
    maximumBytes + 1, true);
  invariant(sameArtifact(observed, expected), "verification-raw-stream-identity");
  return observed;
}

function validateConverterSummary(summary, output) {
  invariant(summary.schema === converterSummarySchema && summary.status === "pass",
    "verification-converter-summary-status");
  requireSafeId(summary.operationId, "verification-converter-operation-id");
  invariant(typeof summary.outputDirectory === "string" &&
    path.basename(output.root) === summary.outputDirectory,
  "verification-converter-output-directory");
  invariant(summary.receiptFile === "composition.conversion-receipt.json" &&
    summary.requiredNextGate ===
      "source-native-browser-numerical-parity-untouched-quality-and-product-chat",
  "verification-converter-summary-contract");
  invariant(Array.isArray(summary.artifacts) && summary.artifacts.length === 6,
    "verification-converter-summary-artifacts");
  const inventory = new Map(output.inventory.map((entry) => [entry.file, entry]));
  const expectedFiles = ["model.slm2", "tokenizer.tokenizer2", "template.template2",
    "sampling.sampling2", "prompt.prompt2", "composition.acg2"];
  const observedFiles = summary.artifacts.map((entry) => entry.file);
  invariant(canonicalJson(observedFiles) === canonicalJson(expectedFiles),
    "verification-converter-summary-artifacts");
  for (const entry of summary.artifacts) {
    requireExactKeys(entry, ["byteLength", "file", "kind", "sha256"],
      "verification-converter-summary-artifact");
    const observed = inventory.get(entry.file);
    invariant(observed && observed.byteLength === entry.byteLength &&
      observed.sha256 === entry.sha256, "verification-converter-summary-identity");
    requireSha256(entry.sha256, "verification-converter-summary-identity");
    invariant(typeof entry.kind === "string" && entry.kind.length > 0,
      "verification-converter-summary-kind");
  }
  requireSha256(summary.graphIdentitySha256,
    "verification-converter-graph-identity");
  return Object.freeze({
    operationId: summary.operationId,
    graphIdentitySha256: summary.graphIdentitySha256,
    receiptFile: summary.receiptFile
  });
}

function validateCompositionArtifact(record, expectedFile, outputByName) {
  requireExactKeys(record, ["kind", "fileName", "path", "byteLength", "sha256"],
    "verification-managed-composition-artifact");
  invariant(record.fileName === expectedFile && typeof record.kind === "string" &&
    record.kind.length > 0, "verification-managed-composition-artifact");
  const output = outputByName.get(expectedFile);
  invariant(output && record.byteLength === output.byteLength &&
    record.sha256 === output.sha256 &&
    canonicalWindowsPath(record.path) === record.path,
  "verification-managed-composition-artifact-identity");
  requireSha256(record.sha256, "verification-managed-composition-artifact-identity");
  return Object.freeze({ file: expectedFile, byteLength: record.byteLength,
    sha256: record.sha256 });
}

function validateManagedPass(result, request, output, converterSummary) {
  requireExactKeys(result, ["schema", "status", "composition", "errorCode", "operation"],
    "verification-managed-result-fields");
  invariant(result.schema === managedResultSchema && result.status === "pass" &&
    result.errorCode === null && result.operation === "read-only-no-converter-launch" &&
    isPlainObject(result.composition), "verification-managed-result-pass");
  const composition = result.composition;
  requireExactKeys(composition, [
    "schema", "operationId", "outputRoot", "receiptPath", "receiptSha256", "artifacts",
    "graphIdentitySha256", "modelSourceLockSha256", "tokenizerSourceLockSha256",
    "converterVersion", "converterExecutableSha256", "requiredNextGate"
  ], "verification-managed-composition-fields");
  invariant(composition.schema === "tinyrustlm.verified-composition.v1" &&
    composition.operationId === converterSummary.operationId &&
    composition.outputRoot === canonicalWindowsPath(request.invocation.outputRoot) &&
    composition.graphIdentitySha256 === converterSummary.graphIdentitySha256 &&
    composition.modelSourceLockSha256 === request.inputs.modelSourceLockSha256 &&
    composition.tokenizerSourceLockSha256 === request.inputs.tokenizerSourceLockSha256 &&
    composition.converterExecutableSha256 === request.custody.rust.executableSha256 &&
    composition.requiredNextGate ===
      "source-native-browser-numerical-parity-untouched-quality-and-product-chat",
  "verification-managed-composition-binding");
  requireSha256(composition.receiptSha256, "verification-managed-receipt-identity");
  requireSha256(composition.graphIdentitySha256, "verification-managed-graph-identity");
  invariant(typeof composition.converterVersion === "string" &&
    composition.converterVersion.length > 0,
  "verification-managed-converter-version");
  const outputByName = new Map(output.inventory.map((entry) => [entry.file, entry]));
  const receipt = outputByName.get("composition.conversion-receipt.json");
  invariant(receipt && composition.receiptSha256 === receipt.sha256 &&
    composition.receiptPath === canonicalWindowsPath(path.join(
      request.invocation.outputRoot, "composition.conversion-receipt.json")),
  "verification-managed-receipt-identity");
  requireExactKeys(composition.artifacts,
    ["model", "tokenizer", "template", "sampling", "prompt", "composition"],
    "verification-managed-artifact-set");
  const expected = [
    ["model", "model.slm2"],
    ["tokenizer", "tokenizer.tokenizer2"],
    ["template", "template.template2"],
    ["sampling", "sampling.sampling2"],
    ["prompt", "prompt.prompt2"],
    ["composition", "composition.acg2"]
  ];
  const artifacts = expected.map(([field, file]) =>
    validateCompositionArtifact(composition.artifacts[field], file, outputByName));
  return Object.freeze({
    operationId: composition.operationId,
    graphIdentitySha256: composition.graphIdentitySha256,
    receiptSha256: composition.receiptSha256,
    converterVersion: composition.converterVersion,
    artifacts: Object.freeze(artifacts)
  });
}

function readProcessTerminal(root, fileName, stage, executionId) {
  const document = readEvidenceJson(root, fileName, maximumProcessTerminalBytes,
    "verification-process-terminal-json");
  const terminal = document.value;
  requireExactKeys(terminal, [
    "schema", "executionId", "stage", "executableBefore", "executableAfter",
    "executableUnchanged", "argumentsSha256", "outcome", "launchOrdinal",
    "launchCountLimit", "retryAllowed", "evidenceOverwriteAllowed", "repairAllowed"
  ], "verification-process-terminal-fields");
  invariant(terminal.schema === processTerminalSchema &&
    terminal.executionId === executionId && terminal.stage === stage &&
    terminal.launchOrdinal === 1 && terminal.launchCountLimit === 1 &&
    terminal.retryAllowed === false && terminal.evidenceOverwriteAllowed === false &&
    terminal.repairAllowed === false,
  "verification-process-terminal-binding");
  requireSha256(terminal.argumentsSha256, "verification-process-arguments-hash");
  return Object.freeze({ artifact: document.artifact, terminal });
}

function assessConverter(prepared) {
  const { request } = prepared;
  const root = request.invocation.evidenceRoot;
  const processDocument = readProcessTerminal(root, evidenceNames.converterTerminal,
    "converter", request.executionId);
  const terminal = processDocument.terminal;
  validateRawStream(root, evidenceNames.converterStdout, terminal.outcome.stdout,
    request.invocation.converterMaximumStdoutBytes);
  validateRawStream(root, evidenceNames.converterStderr, terminal.outcome.stderr,
    request.invocation.converterMaximumStderrBytes);
  invariant(sameArtifact(terminal.executableBefore, terminal.executableAfter) ===
    terminal.executableUnchanged, "verification-converter-executable-terminal");
  invariant(sameArtifact(terminal.executableBefore, {
    byteLength: request.custody.rust.executableByteLength,
    sha256: request.custody.rust.executableSha256
  }), "verification-converter-executable-terminal");
  invariant(terminal.argumentsSha256 === argumentsSha256(
    request.invocation.converterArguments), "verification-converter-arguments-terminal");
  if (!processOutcomePass(terminal.outcome)) {
    return Object.freeze({ pass: false, reasonCode: "converter-process-not-pass",
      processTerminal: processDocument.artifact, output: null, summary: null });
  }
  if (!terminal.executableUnchanged) {
    return Object.freeze({ pass: false, reasonCode: "converter-executable-drift",
      processTerminal: processDocument.artifact, output: null, summary: null });
  }
  if (terminal.outcome.stderr.byteLength !== 0) {
    return Object.freeze({ pass: false, reasonCode: "converter-stderr-not-empty",
      processTerminal: processDocument.artifact, output: null, summary: null });
  }
  let output;
  let summary;
  try {
    output = inspectOutputInventory(request.invocation.outputRoot, request.invocation);
    const stdoutBytes = fs.readFileSync(safeChild(root, evidenceNames.converterStdout,
      "verification-converter-stdout-path"));
    const summaryValue = inspectCanonicalJsonBytes(stdoutBytes,
      request.invocation.converterMaximumStdoutBytes,
      "verification-converter-summary-json");
    summary = validateConverterSummary(summaryValue, {
      root: request.invocation.outputRoot,
      inventory: output.inventory
    });
  } catch (error) {
    return Object.freeze({ pass: false, reasonCode: safeErrorCode(error,
      "converter-candidate-invalid"), processTerminal: processDocument.artifact,
    output: null, summary: null });
  }
  return Object.freeze({ pass: true, reasonCode: "converter-candidate-pass",
    processTerminal: processDocument.artifact, output, summary });
}

function assessManaged(prepared, converter) {
  const { request } = prepared;
  const root = request.invocation.evidenceRoot;
  const intent = readEvidenceJson(root, evidenceNames.managedIntent,
    maximumRequestBytes, "verification-managed-intent-json");
  const expectedIntent = createManagedInspectionIntent(request);
  invariant(canonicalJson(intent.value) === canonicalJson(expectedIntent),
    "verification-managed-intent-binding");
  const processDocument = readProcessTerminal(root, evidenceNames.managedTerminal,
    "managed-inspection", request.executionId);
  const terminal = processDocument.terminal;
  validateRawStream(root, evidenceNames.managedStdout, terminal.outcome.stdout,
    request.invocation.managedMaximumStdoutBytes);
  validateRawStream(root, evidenceNames.managedStderr, terminal.outcome.stderr,
    request.invocation.managedMaximumStderrBytes);
  invariant(sameArtifact(terminal.executableBefore, terminal.executableAfter) ===
    terminal.executableUnchanged, "verification-managed-executable-terminal");
  const expectedExecutable = {
    byteLength: request.custody.managed.runtimeByteLength +
      request.custody.managed.inspectorAssemblyByteLength,
    sha256: crypto.createHash("sha256")
      .update(request.custody.managed.runtimeSha256)
      .update(request.custody.managed.inspectorAssemblySha256).digest("hex")
  };
  const expectedArguments = [
    canonicalWindowsPath(request.custody.managed.inspectorAssemblyPath),
    "inspect",
    canonicalWindowsPath(safeChild(root, evidenceNames.managedIntent,
      "verification-managed-intent-path"))
  ];
  invariant(sameArtifact(terminal.executableBefore, expectedExecutable),
    "verification-managed-executable-terminal");
  invariant(terminal.argumentsSha256 === argumentsSha256(expectedArguments),
    "verification-managed-arguments-terminal");
  if (!processOutcomePass(terminal.outcome)) {
    let rejected = null;
    if (terminal.outcome.exitCode === 2 && terminal.outcome.stderr.byteLength === 0 &&
        terminal.outcome.stdout.byteLength > 0 && !terminal.outcome.stdout.overflow) {
      try {
        const value = inspectCanonicalJsonBytes(fs.readFileSync(safeChild(root,
          evidenceNames.managedStdout, "verification-managed-stdout-path")),
        request.invocation.managedMaximumStdoutBytes, "verification-managed-result-json");
        if (value.schema === managedResultSchema && value.status === "rejected" &&
            value.composition === null && typeof value.errorCode === "string" &&
            safeErrorPattern.test(value.errorCode) &&
            value.operation === "read-only-no-converter-launch") {
          rejected = value.errorCode;
        }
      } catch {
        rejected = null;
      }
    }
    return Object.freeze({ pass: false, rejected: rejected !== null,
      reasonCode: rejected || "managed-inspection-process-not-pass",
      intent: intent.artifact, processTerminal: processDocument.artifact, result: null });
  }
  if (!terminal.executableUnchanged) {
    return Object.freeze({ pass: false, rejected: false,
      reasonCode: "managed-inspection-executable-drift", intent: intent.artifact,
      processTerminal: processDocument.artifact, result: null });
  }
  if (terminal.outcome.stderr.byteLength !== 0) {
    return Object.freeze({ pass: false, rejected: false,
      reasonCode: "managed-inspection-stderr-not-empty", intent: intent.artifact,
      processTerminal: processDocument.artifact, result: null });
  }
  try {
    const value = inspectCanonicalJsonBytes(fs.readFileSync(safeChild(root,
      evidenceNames.managedStdout, "verification-managed-stdout-path")),
    request.invocation.managedMaximumStdoutBytes, "verification-managed-result-json");
    const result = validateManagedPass(value, request, converter.output,
      converter.summary);
    return Object.freeze({ pass: true, rejected: false,
      reasonCode: "managed-structural-inspection-pass", intent: intent.artifact,
      processTerminal: processDocument.artifact, result });
  } catch (error) {
    return Object.freeze({ pass: false, rejected: false,
      reasonCode: safeErrorCode(error, "managed-inspection-result-invalid"),
    intent: intent.artifact, processTerminal: processDocument.artifact, result: null });
  }
}

function deriveDecision(prepared) {
  let converter;
  try {
    converter = assessConverter(prepared);
  } catch (error) {
    return Object.freeze({ status: "terminal-ambiguous",
      reasonCode: safeErrorCode(error, "converter-evidence-incomplete"),
    structuralCompositionVerified: false, converter: null, managedInspection: null,
    outputInventory: Object.freeze([]) });
  }
  if (!converter.pass) {
    return Object.freeze({ status: "terminal-failure", reasonCode: converter.reasonCode,
      structuralCompositionVerified: false, converter, managedInspection: null,
      outputInventory: converter.output ? converter.output.inventory : Object.freeze([]) });
  }
  let managed;
  try {
    managed = assessManaged(prepared, converter);
  } catch (error) {
    return Object.freeze({ status: "terminal-ambiguous",
      reasonCode: safeErrorCode(error, "managed-evidence-incomplete"),
    structuralCompositionVerified: false, converter, managedInspection: null,
    outputInventory: converter.output.inventory });
  }
  if (!managed.pass) {
    return Object.freeze({ status: managed.rejected ? "terminal-rejected" :
      "terminal-failure", reasonCode: managed.reasonCode,
    structuralCompositionVerified: false, converter, managedInspection: managed,
    outputInventory: converter.output.inventory });
  }
  return Object.freeze({ status: "pass",
    reasonCode: "structural-composition-verified",
    structuralCompositionVerified: true, converter, managedInspection: managed,
    outputInventory: converter.output.inventory });
}

function maximumForEvidence(fileName, request) {
  if (fileName === evidenceNames.converterStdout) {
    return request.invocation.converterMaximumStdoutBytes + 1;
  }
  if (fileName === evidenceNames.converterStderr) {
    return request.invocation.converterMaximumStderrBytes + 1;
  }
  if (fileName === evidenceNames.managedStdout) {
    return request.invocation.managedMaximumStdoutBytes + 1;
  }
  if (fileName === evidenceNames.managedStderr) {
    return request.invocation.managedMaximumStderrBytes + 1;
  }
  if (fileName === evidenceNames.binding) return maximumBindingBytes;
  if (fileName === evidenceNames.start) return maximumStartBytes;
  if (fileName.endsWith("process-terminal.json")) return maximumProcessTerminalBytes;
  if (fileName === evidenceNames.managedIntent) return maximumRequestBytes;
  return maximumVerificationBytes;
}

function inventoryPresentEvidence(root, request) {
  const allowed = new Set(Object.values(evidenceNames));
  const names = fs.readdirSync(root, { withFileTypes: true }).map((entry) => {
    invariant(entry.isFile() && !entry.isSymbolicLink(), "verification-evidence-entry");
    invariant(allowed.has(entry.name), "verification-evidence-name");
    return entry.name;
  }).filter((name) => name !== evidenceNames.verification).sort();
  return Object.freeze(names.map((file) => Object.freeze({
    file,
    ...sha256File(safeChild(root, file, "verification-evidence-path"),
      maximumForEvidence(file, request), true)
  })));
}

function publicDecision(decision) {
  return {
    status: decision.status,
    reasonCode: decision.reasonCode,
    structuralCompositionVerified: decision.structuralCompositionVerified,
    candidateBytesMayAdvanceToNumericalParity:
      decision.structuralCompositionVerified,
    retryAllowed: false,
    evidenceOverwriteAllowed: false,
    outputCleanupAllowed: false,
    outputRepairAllowed: false,
    outputAdoptionWithoutThisVerificationAllowed: false
  };
}

function claimBoundary(decision, evidence) {
  return {
    realConverterInvoked: evidence.some((entry) =>
      entry.file === evidenceNames.converterTerminal),
    compositionCandidateCreated: Array.isArray(decision.outputInventory) &&
      decision.outputInventory.length === exactOutputNames.length,
    structuralCompositionVerified: decision.structuralCompositionVerified,
    sourceFrameworkParityVerified: false,
    nativeRuntimeVerified: false,
    browserWasmVerified: false,
    browserChatVerified: false,
    modelQualityVerified: false,
    p2pAvailabilityVerified: false,
    catalogAnnouncementVerified: false,
    packagePublicationVerified: false
  };
}

function zeroCampaignCounters() {
  return {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  };
}

function writeFinalVerification(prepared, forcedFailure = null) {
  const { request, requestDocument } = prepared;
  const root = request.invocation.evidenceRoot;
  const decision = forcedFailure || deriveDecision(prepared);
  const evidence = inventoryPresentEvidence(root, request);
  const record = {
    schema: finalVerificationSchema,
    executionId: request.executionId,
    request: requestDocument.artifact,
    registration: {
      profileId: request.registration.profileId,
      profileSha256: request.registration.profileSha256,
      commit: request.registration.commit,
      tree: request.registration.tree,
      ownerSha256: request.registration.ownerSha256
    },
    evidence,
    outputInventory: decision.outputInventory || [],
    converter: decision.converter,
    managedInspection: decision.managedInspection,
    decision: publicDecision(decision),
    claimBoundary: claimBoundary(decision, evidence),
    campaignCounters: zeroCampaignCounters()
  };
  const verificationPath = safeChild(root, evidenceNames.verification,
    "verification-final-path");
  const artifact = writeCanonicalJsonNew(verificationPath, record,
    maximumVerificationBytes);
  return Object.freeze({ artifact, record });
}

function createProcessTerminal(request, stage, executableBefore, executableAfter,
  argumentsList, outcome) {
  return {
    schema: processTerminalSchema,
    executionId: request.executionId,
    stage,
    executableBefore,
    executableAfter,
    executableUnchanged: sameArtifact(executableBefore, executableAfter),
    argumentsSha256: argumentsSha256(argumentsList),
    outcome,
    launchOrdinal: 1,
    launchCountLimit: 1,
    retryAllowed: false,
    evidenceOverwriteAllowed: false,
    repairAllowed: false
  };
}

async function executePrepared(prepared, dependencies = {}) {
  const { request, bindingBytes } = prepared;
  const runProcess = dependencies.runCapturedProcess || runCapturedProcess;
  const root = request.invocation.evidenceRoot;
  fs.mkdirSync(root, { recursive: false });
  inspectDirectDirectory(root, "verification-evidence-root-created");
  writeNewDurable(safeChild(root, evidenceNames.binding,
    "verification-binding-path"), bindingBytes, maximumBindingBytes);
  const bindingArtifact = sha256File(safeChild(root, evidenceNames.binding,
    "verification-binding-path"), maximumBindingBytes, false);
  const start = {
    schema: startSchema,
    executionId: request.executionId,
    bindingSha256: bindingArtifact.sha256,
    authorizedAtUtc: new Date().toISOString(),
    converterLaunchOrdinal: 1,
    converterLaunchCountLimit: 1,
    managedInspectionLaunchOrdinal: 1,
    managedInspectionLaunchCountLimit: 1,
    evidenceRootObservedAbsentBeforeCreation: true,
    outputRootObservedAbsent: !fs.existsSync(request.invocation.outputRoot),
    retryAllowed: false,
    overwriteAllowed: false,
    repairAllowed: false
  };
  invariant(start.outputRootObservedAbsent, "verification-output-root-race");
  writeCanonicalJsonNew(safeChild(root, evidenceNames.start,
    "verification-start-path"), start, maximumStartBytes);

  try {
    const converterBefore = sha256File(request.custody.rust.executablePath,
      maximumManagedFileBytes, false);
    invariant(sameArtifact(converterBefore, {
      byteLength: request.custody.rust.executableByteLength,
      sha256: request.custody.rust.executableSha256
    }), "verification-converter-prelaunch-drift");
    const converterOutcome = await runProcess(request.custody.rust.executablePath,
      request.invocation.converterArguments, {
        stage: "converter",
        workingDirectory: request.invocation.workingDirectory,
        stdoutPath: safeChild(root, evidenceNames.converterStdout,
          "verification-converter-stdout-path"),
        stderrPath: safeChild(root, evidenceNames.converterStderr,
          "verification-converter-stderr-path"),
        maximumDurationMilliseconds:
          request.invocation.converterMaximumDurationMilliseconds,
        maximumStdoutBytes: request.invocation.converterMaximumStdoutBytes,
        maximumStderrBytes: request.invocation.converterMaximumStderrBytes,
        terminationToolPath: request.registration.terminationToolPath
      });
    const converterAfter = sha256File(request.custody.rust.executablePath,
      maximumManagedFileBytes, false);
    writeCanonicalJsonNew(safeChild(root, evidenceNames.converterTerminal,
      "verification-converter-terminal-path"), createProcessTerminal(request,
      "converter", converterBefore, converterAfter,
      request.invocation.converterArguments, converterOutcome),
    maximumProcessTerminalBytes);

    const converter = assessConverter(prepared);
    if (converter.pass) {
      const intent = createManagedInspectionIntent(request);
      writeCanonicalJsonNew(safeChild(root, evidenceNames.managedIntent,
        "verification-managed-intent-path"), intent, maximumRequestBytes);
      const runtimeBefore = sha256File(request.custody.managed.runtimePath,
        maximumManagedFileBytes, false);
      const inspectorBefore = sha256File(request.custody.managed.inspectorAssemblyPath,
        maximumManagedFileBytes, false);
      invariant(sameArtifact(runtimeBefore, {
        byteLength: request.custody.managed.runtimeByteLength,
        sha256: request.custody.managed.runtimeSha256
      }) && sameArtifact(inspectorBefore, {
        byteLength: request.custody.managed.inspectorAssemblyByteLength,
        sha256: request.custody.managed.inspectorAssemblySha256
      }), "verification-managed-prelaunch-drift");
      const managedArguments = [
        canonicalWindowsPath(request.custody.managed.inspectorAssemblyPath),
        "inspect",
        canonicalWindowsPath(safeChild(root, evidenceNames.managedIntent,
          "verification-managed-intent-path"))
      ];
      const managedOutcome = await runProcess(request.custody.managed.runtimePath,
        managedArguments, {
          stage: "managed-inspection",
          workingDirectory: request.invocation.workingDirectory,
          stdoutPath: safeChild(root, evidenceNames.managedStdout,
            "verification-managed-stdout-path"),
          stderrPath: safeChild(root, evidenceNames.managedStderr,
            "verification-managed-stderr-path"),
          maximumDurationMilliseconds:
            request.invocation.managedMaximumDurationMilliseconds,
          maximumStdoutBytes: request.invocation.managedMaximumStdoutBytes,
          maximumStderrBytes: request.invocation.managedMaximumStderrBytes,
          terminationToolPath: request.registration.terminationToolPath
        });
      const runtimeAfter = sha256File(request.custody.managed.runtimePath,
        maximumManagedFileBytes, false);
      const inspectorAfter = sha256File(request.custody.managed.inspectorAssemblyPath,
        maximumManagedFileBytes, false);
      const combinedBefore = {
        byteLength: runtimeBefore.byteLength + inspectorBefore.byteLength,
        sha256: crypto.createHash("sha256")
          .update(runtimeBefore.sha256).update(inspectorBefore.sha256).digest("hex")
      };
      const combinedAfter = {
        byteLength: runtimeAfter.byteLength + inspectorAfter.byteLength,
        sha256: crypto.createHash("sha256")
          .update(runtimeAfter.sha256).update(inspectorAfter.sha256).digest("hex")
      };
      writeCanonicalJsonNew(safeChild(root, evidenceNames.managedTerminal,
        "verification-managed-terminal-path"), createProcessTerminal(request,
      "managed-inspection", combinedBefore, combinedAfter, managedArguments,
      managedOutcome), maximumProcessTerminalBytes);
    }
    return writeFinalVerification(prepared);
  } catch (error) {
    if (fs.existsSync(safeChild(root, evidenceNames.verification,
      "verification-final-path"))) throw error;
    try {
      return writeFinalVerification(prepared);
    } catch {
      // Preserve the original operation failure if incomplete evidence prevents derivation.
    }
    const forced = Object.freeze({
      status: "terminal-ambiguous",
      reasonCode: safeErrorCode(error),
      structuralCompositionVerified: false,
      converter: null,
      managedInspection: null,
      outputInventory: Object.freeze([])
    });
    return writeFinalVerification(prepared, forced);
  }
}

async function execute(requestPath, dependencies = {}) {
  const prepared = prepareExecution(requestPath, { rootsMustBeAbsent: true });
  return executePrepared(prepared, dependencies);
}

function verifyExecution(requestPath) {
  const prepared = prepareExecution(requestPath, { rootsMustBeAbsent: false });
  const { request, requestDocument } = prepared;
  const root = request.invocation.evidenceRoot;
  const finalDocument = readEvidenceJson(root, evidenceNames.verification,
    maximumVerificationBytes, "verification-final-json");
  const final = finalDocument.value;
  invariant(final.schema === finalVerificationSchema &&
    final.executionId === request.executionId &&
    sameArtifact(final.request, requestDocument.artifact),
  "verification-final-binding");
  invariant(canonicalJson(final.registration) === canonicalJson({
    profileId: request.registration.profileId,
    profileSha256: request.registration.profileSha256,
    commit: request.registration.commit,
    tree: request.registration.tree,
    ownerSha256: request.registration.ownerSha256
  }), "verification-final-registration");
  verifyEvidenceInventory(root, final.evidence);
  const actualNames = fs.readdirSync(root, { withFileTypes: true }).map((entry) => {
    invariant(entry.isFile() && !entry.isSymbolicLink(), "verification-evidence-entry");
    return entry.name;
  }).sort();
  const expectedNames = [...final.evidence.map((entry) => entry.file),
    evidenceNames.verification].sort();
  invariant(canonicalJson(actualNames) === canonicalJson(expectedNames),
    "verification-evidence-inventory-exact");
  const derived = deriveDecision(prepared);
  invariant(canonicalJson(final.decision) === canonicalJson(publicDecision(derived)) &&
    canonicalJson(final.outputInventory) === canonicalJson(derived.outputInventory) &&
    canonicalJson(final.converter) === canonicalJson(derived.converter) &&
    canonicalJson(final.managedInspection) === canonicalJson(derived.managedInspection) &&
    canonicalJson(final.claimBoundary) === canonicalJson(claimBoundary(derived,
      final.evidence)) &&
    canonicalJson(final.campaignCounters) === canonicalJson(zeroCampaignCounters()),
  "verification-final-decision");
  return Object.freeze({
    schema: "tinyrustlm.qwen3-composition-verification-observation.v1",
    executionId: request.executionId,
    status: derived.status,
    reasonCode: derived.reasonCode,
    structuralCompositionVerified: derived.structuralCompositionVerified,
    finalVerification: finalDocument.artifact,
    evidenceFileCount: final.evidence.length,
    outputFileCount: derived.outputInventory.length,
    readOnly: true,
    retryAllowed: false
  });
}

async function main(argv) {
  invariant(argv.length === 2, "verification-owner-arguments");
  const [command, suppliedRequestPath] = argv;
  const requestPath = path.resolve(suppliedRequestPath);
  if (command === "preflight") {
    const prepared = prepareExecution(requestPath, { rootsMustBeAbsent: true });
    process.stdout.write(canonicalJson({
      schema: "tinyrustlm.qwen3-composition-verification-preflight.v1",
      executionId: prepared.request.executionId,
      status: "ready",
      requestSha256: prepared.requestDocument.artifact.sha256,
      evidenceRootAbsent: true,
      outputRootAbsent: true,
      retryAllowed: false
    }));
    return;
  }
  if (command === "execute") {
    const result = await execute(requestPath);
    process.stdout.write(canonicalJson({
      schema: "tinyrustlm.qwen3-composition-verification-summary.v1",
      executionId: result.record.executionId,
      status: result.record.decision.status,
      reasonCode: result.record.decision.reasonCode,
      structuralCompositionVerified:
        result.record.decision.structuralCompositionVerified,
      finalVerification: result.artifact,
      retryAllowed: false
    }));
    process.exitCode = result.record.decision.status === "pass" ? 0 : 1;
    return;
  }
  invariant(command === "verify", "verification-owner-command");
  const observation = verifyExecution(requestPath);
  process.stdout.write(canonicalJson(observation));
  process.exitCode = observation.status === "pass" ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(canonicalJson({
      schema: "tinyrustlm.qwen3-composition-verification-error.v1",
      status: "error",
      code: safeErrorCode(error)
    }));
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  bindingSchema,
  canonicalJson,
  canonicalWindowsPath,
  createManagedInspectionIntent,
  deriveDecision,
  execute,
  executePrepared,
  finalVerificationSchema,
  inspectCanonicalJsonBytes,
  inspectPeMachine,
  prepareExecution,
  processTerminalSchema,
  requestSchema,
  runCapturedProcess,
  sha256File,
  startSchema,
  validateRequestShape,
  verifyEvidenceInventory,
  verifyExecution,
  writeNewDurable
});

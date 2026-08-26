"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REQUEST_SCHEMA = "tinyrustlm.qwen3_numerical_execution_request.v1";
const REGISTRATION_SCHEMA =
  "tinyrustlm.qwen3_numerical_differential_execution_preregistration.v1";
const OWNER_CONTRACT_SCHEMA =
  "tinyrustlm.qwen3_numerical_execution_owner_contract.v1";
const PROCESS_TERMINAL_SCHEMA =
  "tinyrustlm.qwen3_numerical_execution_process_terminal.v1";
const OWNER_TERMINAL_SCHEMA =
  "tinyrustlm.qwen3_numerical_execution_terminal.v1";
const VERIFIER_RECEIPT_SCHEMA =
  "tinyrustlm.qwen3_numerical_trace_verification_receipt.v1";
const REGISTRATION_RELATIVE_PATH =
  "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v1.json";
const MAXIMUM_REQUEST_BYTES = 1024 * 1024;
const MAXIMUM_REGISTRATION_BYTES = 4 * 1024 * 1024;
const MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_EXECUTABLE_BYTES = 512 * 1024 * 1024;
const MAXIMUM_EVIDENCE_JSON_BYTES = 4 * 1024 * 1024;
const MAXIMUM_STREAM_BYTES = 16 * 1024 * 1024;
const HASH_BUFFER_BYTES = 1024 * 1024;
const MAXIMUM_TERMINATION_OUTPUT_BYTES = 64 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;
const PROFILE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/u;
const ERROR_PATTERN = /^[a-z0-9][a-z0-9-]{2,127}$/u;
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;
const STAGES = Object.freeze(["source", "reconstructed", "scalar", "verifier"]);

class NumericalExecutionOwnerError extends Error {
  constructor(code) {
    super(code);
    this.name = "NumericalExecutionOwnerError";
    this.code = code;
  }
}

function fail(code) {
  throw new NumericalExecutionOwnerError(code);
}

function invariant(condition, code) {
  if (!condition) fail(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected, code) {
  invariant(isPlainObject(value), code);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(JSON.stringify(actual) === JSON.stringify(wanted), code);
  return value;
}

function recursivelySorted(value) {
  if (Array.isArray(value)) return value.map(recursivelySorted);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, recursivelySorted(value[key])]));
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(recursivelySorted(value), null, 2)}\n`, "utf8");
}

function validSha256(value) {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function validIdentifier(value) {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function validProfileId(value) {
  return typeof value === "string" && PROFILE_ID_PATTERN.test(value)
    && !value.includes("//") && !value.endsWith("/");
}

function safeErrorCode(error, fallback = "numerical-execution-owner-internal") {
  const candidate = error instanceof NumericalExecutionOwnerError ? error.code : fallback;
  return ERROR_PATTERN.test(candidate) ? candidate : fallback;
}

function requireSafeInteger(value, minimum, maximum, code) {
  invariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum, code);
  return value;
}

function requireFileName(value, code) {
  invariant(typeof value === "string" && FILE_NAME_PATTERN.test(value)
    && path.basename(value) === value, code);
  return value;
}

function requireRelativePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 && value.length <= 512
    && !path.isAbsolute(value) && !value.includes("\\") && !value.startsWith("/")
    && value.split("/").every((component) => component !== "" && component !== "."
      && component !== ".."), code);
  return value;
}

function requireAbsolutePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 && value.length <= 4096
    && /^[\x20-\x7e]+$/u.test(value) && path.isAbsolute(value)
    && path.resolve(value) === value, code);
  if (process.platform === "win32") {
    invariant(/^[A-Z]:\\/u.test(value) && !value.startsWith("\\\\"), code);
  }
  return value;
}

function inspectPathComponents(targetPath, code) {
  const normalized = requireAbsolutePath(targetPath, code);
  const parsed = path.parse(normalized);
  let current = parsed.root;
  for (const component of normalized.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      fail(code);
    }
    invariant(!stat.isSymbolicLink(), code);
  }
  return normalized;
}

function directDirectory(directoryPath, code) {
  const normalized = inspectPathComponents(directoryPath, code);
  const stat = fs.lstatSync(normalized);
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), code);
  return normalized;
}

function directRegularFile(filePath, maximumBytes, allowEmpty, code) {
  const normalized = inspectPathComponents(filePath, code);
  const stat = fs.lstatSync(normalized);
  invariant(stat.isFile() && !stat.isSymbolicLink() && Number.isSafeInteger(stat.size)
    && stat.size <= maximumBytes && (allowEmpty || stat.size > 0), code);
  return Object.freeze({ path: normalized, byteLength: stat.size });
}

function sha256File(filePath, maximumBytes = MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES,
  allowEmpty = false) {
  const file = directRegularFile(filePath, maximumBytes, allowEmpty,
    "numerical-execution-file-invalid");
  const digest = crypto.createHash("sha256");
  const descriptor = fs.openSync(file.path, "r");
  const buffer = Buffer.allocUnsafe(HASH_BUFFER_BYTES);
  try {
    let offset = 0;
    while (offset < file.byteLength) {
      const read = fs.readSync(descriptor, buffer, 0,
        Math.min(buffer.length, file.byteLength - offset), offset);
      invariant(read > 0, "numerical-execution-file-short-read");
      digest.update(buffer.subarray(0, read));
      offset += read;
    }
    invariant(fs.fstatSync(descriptor).size === file.byteLength,
      "numerical-execution-file-drift");
  } finally {
    fs.closeSync(descriptor);
  }
  return Object.freeze({ byteLength: file.byteLength, sha256: digest.digest("hex") });
}

function contentIdentity(filePath, maximumBytes, allowEmpty, code) {
  const observed = sha256File(filePath, maximumBytes, allowEmpty);
  invariant(Number.isSafeInteger(observed.byteLength) && validSha256(observed.sha256), code);
  return observed;
}

function readCanonicalJson(filePath, maximumBytes, code) {
  const artifact = contentIdentity(filePath, maximumBytes, false, code);
  const bytes = fs.readFileSync(filePath);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(code);
  }
  invariant(isPlainObject(value) && bytes.equals(canonicalJsonBytes(value)), code);
  return Object.freeze({ artifact, value });
}

function safeChild(root, fileName, code) {
  requireFileName(fileName, code);
  const child = path.resolve(root, fileName);
  invariant(path.dirname(child).toLowerCase() === root.toLowerCase(), code);
  return child;
}

function pathAbsent(targetPath, code) {
  try {
    fs.lstatSync(targetPath);
    fail(code);
  } catch (error) {
    if (error instanceof NumericalExecutionOwnerError) throw error;
    invariant(error && error.code === "ENOENT", code);
  }
}

function writeNewDurable(filePath, bytes, maximumBytes) {
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumBytes,
    "numerical-execution-evidence-size");
  const descriptor = fs.openSync(filePath, "wx");
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      invariant(written > 0, "numerical-execution-evidence-short-write");
      offset += written;
    }
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function writeCanonicalNew(filePath, value, maximumBytes = MAXIMUM_EVIDENCE_JSON_BYTES) {
  const bytes = canonicalJsonBytes(value);
  writeNewDurable(filePath, bytes, maximumBytes);
  return Object.freeze({ byteLength: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
}

function artifactReference(value, code) {
  exactKeys(value, ["relativePath", "byteLength", "sha256"], code);
  requireRelativePath(value.relativePath, code);
  requireSafeInteger(value.byteLength, 1, MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES, code);
  invariant(validSha256(value.sha256), code);
  return value;
}

function executableReference(value, code) {
  exactKeys(value, ["basename", "byteLength", "sha256"], code);
  requireFileName(value.basename, code);
  requireSafeInteger(value.byteLength, 1, MAXIMUM_EXECUTABLE_BYTES, code);
  invariant(validSha256(value.sha256), code);
  return value;
}

function git(executablePath, repositoryRoot, argumentsList, maximumBytes = 4 * 1024 * 1024) {
  try {
    return childProcess.execFileSync(executablePath, argumentsList, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: maximumBytes,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    fail("numerical-execution-git-command");
  }
}

function gitBytes(executablePath, repositoryRoot, commit, relativePath) {
  try {
    return childProcess.execFileSync(executablePath, ["show", `${commit}:${relativePath}`], {
      cwd: repositoryRoot,
      encoding: "buffer",
      maxBuffer: MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch {
    fail("numerical-execution-git-artifact");
  }
}

function validateProcessPolicy(policy) {
  exactKeys(policy, ["maximumDurationMilliseconds", "maximumStdoutBytes",
    "maximumStderrBytes", "launchLimitPerStage", "retryAllowed", "overwriteAllowed",
    "repairAllowed", "continueAfterFailedStage"], "numerical-execution-process-policy");
  exactKeys(policy.maximumDurationMilliseconds, STAGES,
    "numerical-execution-process-duration");
  for (const stage of STAGES) {
    requireSafeInteger(policy.maximumDurationMilliseconds[stage], 1, 24 * 60 * 60 * 1000,
      "numerical-execution-process-duration");
  }
  requireSafeInteger(policy.maximumStdoutBytes, 1, MAXIMUM_STREAM_BYTES,
    "numerical-execution-process-policy");
  requireSafeInteger(policy.maximumStderrBytes, 1, MAXIMUM_STREAM_BYTES,
    "numerical-execution-process-policy");
  invariant(policy.launchLimitPerStage === 1 && policy.retryAllowed === false
    && policy.overwriteAllowed === false && policy.repairAllowed === false
    && policy.continueAfterFailedStage === false, "numerical-execution-process-policy");
}

function validateOwnerContract(contract) {
  exactKeys(contract, ["schema", "operationId", "traceProfileId",
    "implementationArtifacts", "executables", "cases", "requests", "processPolicy",
    "privateNames", "evidenceFiles", "terminalPolicy"],
  "numerical-execution-owner-contract");
  invariant(contract.schema === OWNER_CONTRACT_SCHEMA && validIdentifier(contract.operationId)
    && validProfileId(contract.traceProfileId), "numerical-execution-owner-contract");
  invariant(Array.isArray(contract.implementationArtifacts)
    && contract.implementationArtifacts.length === 11,
  "numerical-execution-implementation-artifacts");
  const roles = new Set();
  for (const artifact of contract.implementationArtifacts) {
    exactKeys(artifact, ["role", "relativePath", "byteLength", "sha256"],
      "numerical-execution-implementation-artifact");
    invariant(validIdentifier(artifact.role) && !roles.has(artifact.role),
      "numerical-execution-implementation-artifact");
    roles.add(artifact.role);
    artifactReference({ relativePath: artifact.relativePath,
      byteLength: artifact.byteLength, sha256: artifact.sha256 },
    "numerical-execution-implementation-artifact");
  }
  const requiredRoles = ["execution-owner", "differential-profile", "environment-authority",
    "environment-lock", "source-owner", "reconstructed-owner", "scalar-source",
    "scalar-profile", "verifier", "source-lock", "composition-result"];
  invariant(requiredRoles.every((role) => roles.has(role)),
    "numerical-execution-implementation-roles");
  exactKeys(contract.executables, ["git", "python", "node", "scalar", "termination"],
    "numerical-execution-executables");
  for (const role of Object.keys(contract.executables)) {
    executableReference(contract.executables[role], "numerical-execution-executable");
  }
  invariant(Array.isArray(contract.cases) && contract.cases.length >= 1
    && contract.cases.length <= 32, "numerical-execution-cases");
  const caseIds = new Set();
  for (const item of contract.cases) {
    exactKeys(item, ["id", "tokenIds", "tokenIdsLeU32Sha256"],
      "numerical-execution-case");
    invariant(validIdentifier(item.id) && !caseIds.has(item.id)
      && Array.isArray(item.tokenIds) && item.tokenIds.length >= 1
      && item.tokenIds.length <= 256
      && item.tokenIds.every((token) => Number.isSafeInteger(token)
        && token >= 0 && token < 151936) && validSha256(item.tokenIdsLeU32Sha256),
    "numerical-execution-case");
    const bytes = Buffer.alloc(item.tokenIds.length * 4);
    item.tokenIds.forEach((token, index) => bytes.writeUInt32LE(token, index * 4));
    invariant(crypto.createHash("sha256").update(bytes).digest("hex")
      === item.tokenIdsLeU32Sha256, "numerical-execution-case-digest");
    caseIds.add(item.id);
  }
  exactKeys(contract.requests, ["source", "reconstructed", "scalar", "verification"],
    "numerical-execution-request-templates");
  exactKeys(contract.requests.source, ["schema", "sourceLock", "framework", "policy"],
    "numerical-execution-source-template");
  exactKeys(contract.requests.reconstructed,
    ["schema", "compositionResultSha256", "model", "implementation", "modelSpec", "policy"],
    "numerical-execution-reconstructed-template");
  exactKeys(contract.requests.scalar,
    ["schema", "compositionResultSha256", "model", "policy"],
    "numerical-execution-scalar-template");
  exactKeys(contract.requests.verification,
    ["schema", "differentialProfile", "comparison", "policy"],
    "numerical-execution-verification-template");
  validateProcessPolicy(contract.processPolicy);
  exactKeys(contract.privateNames, ["ownerRequestFileBasename", "ownerEvidenceRootBasename",
    "sourceScratchRootBasename", "sourceOutputRootBasename",
    "reconstructedOutputRootBasename", "scalarOutputRootBasename"],
  "numerical-execution-private-names");
  const privateNames = Object.values(contract.privateNames);
  privateNames.forEach((name) => requireFileName(name, "numerical-execution-private-name"));
  invariant(new Set(privateNames.map((name) => name.toLowerCase())).size === privateNames.length,
    "numerical-execution-private-name-duplicate");
  invariant(contract.privateNames.ownerRequestFileBasename
      === `${contract.operationId}-owner-request.json`
    && contract.privateNames.ownerEvidenceRootBasename
      === `${contract.operationId}-owner-evidence`
    && contract.privateNames.sourceScratchRootBasename
      === `${contract.operationId}-source-scratch`
    && contract.privateNames.sourceOutputRootBasename === `${contract.operationId}-source`
    && contract.privateNames.reconstructedOutputRootBasename
      === `${contract.operationId}-reconstructed`
    && contract.privateNames.scalarOutputRootBasename === `${contract.operationId}-scalar`,
  "numerical-execution-private-name-derivation");
  exactKeys(contract.evidenceFiles, ["binding", "start", "sourceRequest", "sourceStdout",
    "sourceStderr", "sourceTerminal", "reconstructedRequest", "reconstructedStdout",
    "reconstructedStderr", "reconstructedTerminal", "scalarRequest", "scalarStdout",
    "scalarStderr", "scalarTerminal", "verificationRequest", "verifierStdout",
    "verifierStderr", "verifierTerminal", "ownerTerminal"],
  "numerical-execution-evidence-files");
  const evidenceNames = Object.values(contract.evidenceFiles);
  evidenceNames.forEach((name) => requireFileName(name, "numerical-execution-evidence-file"));
  invariant(new Set(evidenceNames.map((name) => name.toLowerCase())).size
    === evidenceNames.length, "numerical-execution-evidence-file-duplicate");
  exactKeys(contract.terminalPolicy, ["successStatus", "rejectionStatus", "failureStatus",
    "ambiguousStatus", "secondInvocationAllowed", "partialOutputCleanupAllowed",
    "evidenceOverwriteAllowed", "thresholdChangeAfterLaunchAllowed"],
  "numerical-execution-terminal-policy");
  invariant(contract.terminalPolicy.successStatus === "terminal-pass"
    && contract.terminalPolicy.rejectionStatus === "terminal-rejected"
    && contract.terminalPolicy.failureStatus === "terminal-failure"
    && contract.terminalPolicy.ambiguousStatus === "terminal-ambiguous"
    && contract.terminalPolicy.secondInvocationAllowed === false
    && contract.terminalPolicy.partialOutputCleanupAllowed === false
    && contract.terminalPolicy.evidenceOverwriteAllowed === false
    && contract.terminalPolicy.thresholdChangeAfterLaunchAllowed === false,
  "numerical-execution-terminal-policy");
  return contract;
}

function validateRegistration(value) {
  exactKeys(value, ["schema", "profileId", "status", "registeredAtUtc",
    "registrationParentCommit", "registrationParentTree", "authority", "sourceAnchor",
    "reportLineage", "implementationCheckpoint", "candidate", "ownerContract",
    "outputBoundary", "claimBoundary", "campaignCounters"],
  "numerical-execution-registration-shape");
  invariant(value.schema === REGISTRATION_SCHEMA
    && value.profileId === "tinyrustlm.qwen3-numerical-differential-execution/1"
    && value.status === "registered-before-private-request-roots-and-real-traces"
    && COMMIT_PATTERN.test(value.registrationParentCommit)
    && COMMIT_PATTERN.test(value.registrationParentTree),
  "numerical-execution-registration-identity");
  exactKeys(value.sourceAnchor, ["branch", "parentCommit", "parentTree",
    "allowedRegistrationCommitPaths", "cleanAtRegistration",
    "trackingFetchHeadAndRemoteExactAtRegistration"],
  "numerical-execution-source-anchor");
  invariant(value.sourceAnchor.branch === "codex/model-acquisition-v2"
    && value.sourceAnchor.parentCommit === value.registrationParentCommit
    && value.sourceAnchor.parentTree === value.registrationParentTree
    && Array.isArray(value.sourceAnchor.allowedRegistrationCommitPaths)
    && value.sourceAnchor.allowedRegistrationCommitPaths.length >= 1
    && value.sourceAnchor.allowedRegistrationCommitPaths.length <= 16
    && value.sourceAnchor.allowedRegistrationCommitPaths.every((relativePath) => {
      try {
        requireRelativePath(relativePath, "numerical-execution-source-anchor");
        return true;
      } catch {
        return false;
      }
    })
    && new Set(value.sourceAnchor.allowedRegistrationCommitPaths).size
      === value.sourceAnchor.allowedRegistrationCommitPaths.length
    && value.sourceAnchor.cleanAtRegistration === true
    && value.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration === true,
  "numerical-execution-source-anchor");
  validateOwnerContract(value.ownerContract);
  return value;
}

function validateRequest(requestPath) {
  const requestDocument = readCanonicalJson(requestPath, MAXIMUM_REQUEST_BYTES,
    "numerical-execution-request-json");
  const request = requestDocument.value;
  exactKeys(request, ["schema", "operationId", "registration", "registrationSource",
    "repositoryRoot", "gitPath", "evidenceParent", "sourceDirectory", "compositionRoot",
    "executables"], "numerical-execution-request-shape");
  invariant(request.schema === REQUEST_SCHEMA && validIdentifier(request.operationId),
    "numerical-execution-request-identity");
  exactKeys(request.registration, ["relativePath", "byteLength", "sha256"],
    "numerical-execution-registration-reference");
  invariant(request.registration.relativePath === REGISTRATION_RELATIVE_PATH,
    "numerical-execution-registration-reference");
  artifactReference(request.registration, "numerical-execution-registration-reference");
  exactKeys(request.registrationSource, ["commit", "tree", "branch", "trackingRef",
    "remoteRef", "fetchHeadExpected"], "numerical-execution-registration-source");
  invariant(COMMIT_PATTERN.test(request.registrationSource.commit)
    && COMMIT_PATTERN.test(request.registrationSource.tree)
    && request.registrationSource.branch === "codex/model-acquisition-v2"
    && request.registrationSource.trackingRef === "origin/codex/model-acquisition-v2"
    && request.registrationSource.remoteRef === "refs/remotes/origin/codex/model-acquisition-v2"
    && request.registrationSource.fetchHeadExpected === true,
  "numerical-execution-registration-source");
  const repositoryRoot = directDirectory(requireAbsolutePath(request.repositoryRoot,
    "numerical-execution-repository-root"), "numerical-execution-repository-root");
  const gitFile = directRegularFile(requireAbsolutePath(request.gitPath,
    "numerical-execution-git-path"), MAXIMUM_EXECUTABLE_BYTES, false,
  "numerical-execution-git-path");
  const evidenceParent = directDirectory(requireAbsolutePath(request.evidenceParent,
    "numerical-execution-evidence-parent"), "numerical-execution-evidence-parent");
  const sourceDirectory = directDirectory(requireAbsolutePath(request.sourceDirectory,
    "numerical-execution-source-directory"), "numerical-execution-source-directory");
  const compositionRoot = directDirectory(requireAbsolutePath(request.compositionRoot,
    "numerical-execution-composition-root"), "numerical-execution-composition-root");
  invariant(new Set([repositoryRoot, evidenceParent, sourceDirectory, compositionRoot]
    .map((value) => value.toLowerCase())).size === 4, "numerical-execution-root-overlap");
  exactKeys(request.executables, ["pythonPath", "nodePath", "scalarPath", "terminationPath"],
    "numerical-execution-executable-paths");
  const executablePaths = Object.fromEntries(Object.entries(request.executables)
    .map(([role, filePath]) => [role, directRegularFile(requireAbsolutePath(filePath,
      "numerical-execution-executable-path"), MAXIMUM_EXECUTABLE_BYTES, false,
    "numerical-execution-executable-path").path]));
  invariant(executablePaths.nodePath.toLowerCase() === process.execPath.toLowerCase(),
    "numerical-execution-node-runtime");
  const registrationPath = path.resolve(repositoryRoot,
    ...request.registration.relativePath.split("/"));
  invariant(registrationPath.startsWith(`${repositoryRoot}${path.sep}`),
    "numerical-execution-registration-path");
  const registrationDocument = readCanonicalJson(registrationPath, MAXIMUM_REGISTRATION_BYTES,
    "numerical-execution-registration-json");
  invariant(registrationDocument.artifact.byteLength === request.registration.byteLength
    && registrationDocument.artifact.sha256 === request.registration.sha256,
  "numerical-execution-registration-drift");
  const registration = validateRegistration(registrationDocument.value);
  invariant(registration.ownerContract.operationId === request.operationId,
    "numerical-execution-operation-binding");
  return Object.freeze({ requestPath, requestIdentity: requestDocument.artifact, request,
    registrationPath, registrationIdentity: registrationDocument.artifact, registration,
    repositoryRoot, gitPath: gitFile.path, evidenceParent, sourceDirectory, compositionRoot,
    executablePaths });
}

function verifySourceState(state) {
  const { request, registration, repositoryRoot, gitPath } = state;
  const source = request.registrationSource;
  invariant(git(gitPath, repositoryRoot, ["rev-parse", "HEAD"]) === source.commit
    && git(gitPath, repositoryRoot, ["rev-parse", "HEAD^{tree}"]) === source.tree
    && git(gitPath, repositoryRoot, ["branch", "--show-current"]) === source.branch
    && git(gitPath, repositoryRoot, ["rev-parse", source.trackingRef]) === source.commit
    && git(gitPath, repositoryRoot, ["rev-parse", source.remoteRef]) === source.commit
    && git(gitPath, repositoryRoot, ["rev-parse", "FETCH_HEAD"]) === source.commit,
  "numerical-execution-source-not-remote-exact");
  invariant(git(gitPath, repositoryRoot,
    ["status", "--porcelain=v1", "--untracked-files=all"]) === "",
  "numerical-execution-source-dirty");
  invariant(git(gitPath, repositoryRoot,
    ["rev-parse", `${registration.registrationParentCommit}^{tree}`])
    === registration.registrationParentTree, "numerical-execution-parent-tree");
  git(gitPath, repositoryRoot,
    ["merge-base", "--is-ancestor", registration.registrationParentCommit, source.commit]);
  const changed = git(gitPath, repositoryRoot, ["diff", "--name-only",
    registration.registrationParentCommit, source.commit]).split(/\r?\n/u).filter(Boolean).sort();
  invariant(JSON.stringify(changed) === JSON.stringify(
    [...registration.sourceAnchor.allowedRegistrationCommitPaths].sort()),
  "numerical-execution-registration-diff");
  const registrationAtCommit = gitBytes(gitPath, repositoryRoot, source.commit,
    request.registration.relativePath);
  invariant(registrationAtCommit.length === state.registrationIdentity.byteLength
    && crypto.createHash("sha256").update(registrationAtCommit).digest("hex")
      === state.registrationIdentity.sha256, "numerical-execution-registration-commit-drift");

  const artifacts = new Map();
  for (const artifact of registration.ownerContract.implementationArtifacts) {
    const bytes = gitBytes(gitPath, repositoryRoot, registration.registrationParentCommit,
      artifact.relativePath);
    invariant(bytes.length === artifact.byteLength
      && crypto.createHash("sha256").update(bytes).digest("hex") === artifact.sha256,
    "numerical-execution-parent-artifact-drift");
    const currentPath = path.resolve(repositoryRoot, ...artifact.relativePath.split("/"));
    const observed = sha256File(currentPath, MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES, false);
    invariant(observed.byteLength === artifact.byteLength && observed.sha256 === artifact.sha256,
      "numerical-execution-current-artifact-drift");
    artifacts.set(artifact.role, Object.freeze({ ...artifact, path: currentPath }));
  }
  return artifacts;
}

function verifyExecutables(state) {
  const expected = state.registration.ownerContract.executables;
  const mapping = { git: null, python: "pythonPath", node: "nodePath", scalar: "scalarPath",
    termination: "terminationPath" };
  const observed = {};
  for (const [role, pathField] of Object.entries(mapping)) {
    const executablePath = role === "git" ? state.gitPath : state.executablePaths[pathField];
    invariant(path.basename(executablePath).toLowerCase() === expected[role].basename.toLowerCase(),
      "numerical-execution-executable-basename");
    const identity = sha256File(executablePath, MAXIMUM_EXECUTABLE_BYTES, false);
    invariant(identity.byteLength === expected[role].byteLength
      && identity.sha256 === expected[role].sha256, "numerical-execution-executable-drift");
    observed[role] = Object.freeze({ path: executablePath, ...identity });
  }
  return Object.freeze(observed);
}

function derivePaths(state) {
  const names = state.registration.ownerContract.privateNames;
  invariant(path.basename(state.requestPath).toLowerCase()
    === names.ownerRequestFileBasename.toLowerCase()
    && path.dirname(state.requestPath).toLowerCase() === state.evidenceParent.toLowerCase(),
  "numerical-execution-owner-request-path");
  const paths = {
    ownerEvidenceRoot: safeChild(state.evidenceParent, names.ownerEvidenceRootBasename,
      "numerical-execution-private-root"),
    sourceScratchRoot: safeChild(state.evidenceParent, names.sourceScratchRootBasename,
      "numerical-execution-private-root"),
    sourceOutputRoot: safeChild(state.evidenceParent, names.sourceOutputRootBasename,
      "numerical-execution-private-root"),
    reconstructedOutputRoot: safeChild(state.evidenceParent,
      names.reconstructedOutputRootBasename, "numerical-execution-private-root"),
    scalarOutputRoot: safeChild(state.evidenceParent, names.scalarOutputRootBasename,
      "numerical-execution-private-root")
  };
  const values = Object.values(paths);
  invariant(new Set(values.map((value) => value.toLowerCase())).size === values.length,
    "numerical-execution-private-root-duplicate");
  values.forEach((value) => pathAbsent(value, "numerical-execution-private-root-not-absent"));
  return Object.freeze(paths);
}

function childRequests(state, paths) {
  const contract = state.registration.ownerContract;
  const registrationSha256 = state.registrationIdentity.sha256;
  const cases = contract.cases.map(({ id, tokenIds }) => ({ id, tokenIds }));
  const source = {
    schema: contract.requests.source.schema,
    operationId: contract.operationId,
    differentialProfileSha256: contract.requests.verification.differentialProfile.sha256,
    registrationSha256,
    sourceLock: contract.requests.source.sourceLock,
    sourceDirectory: state.sourceDirectory,
    scratchRoot: paths.sourceScratchRoot,
    evidenceParent: state.evidenceParent,
    outputRoot: paths.sourceOutputRoot,
    traceProfileId: contract.traceProfileId,
    framework: contract.requests.source.framework,
    policy: contract.requests.source.policy,
    cases
  };
  const reconstructed = {
    schema: contract.requests.reconstructed.schema,
    operationId: contract.operationId,
    differentialProfileSha256: contract.requests.verification.differentialProfile.sha256,
    registrationSha256,
    compositionResultSha256: contract.requests.reconstructed.compositionResultSha256,
    compositionRoot: state.compositionRoot,
    model: contract.requests.reconstructed.model,
    evidenceParent: state.evidenceParent,
    outputRoot: paths.reconstructedOutputRoot,
    traceProfileId: contract.traceProfileId,
    implementation: contract.requests.reconstructed.implementation,
    modelSpec: contract.requests.reconstructed.modelSpec,
    policy: contract.requests.reconstructed.policy,
    cases
  };
  const scalar = {
    schema: contract.requests.scalar.schema,
    operationId: contract.operationId,
    compositionResultSha256: contract.requests.scalar.compositionResultSha256,
    compositionRoot: state.compositionRoot,
    model: contract.requests.scalar.model,
    evidenceParent: state.evidenceParent,
    outputRoot: paths.scalarOutputRoot,
    traceProfileId: contract.traceProfileId,
    policy: contract.requests.scalar.policy,
    cases
  };
  const names = contract.evidenceFiles;
  const binding = (root) => ({ rootBasename: path.basename(root), manifest: {
    fileName: "probe.json", byteLength: 1, sha256: "0".repeat(64) } });
  const verification = {
    schema: contract.requests.verification.schema,
    operationId: contract.operationId,
    differentialProfile: contract.requests.verification.differentialProfile,
    registrationSha256,
    traceProfileId: contract.traceProfileId,
    bundles: {
      source: binding(paths.sourceOutputRoot),
      reconstructed: binding(paths.reconstructedOutputRoot),
      scalar: binding(paths.scalarOutputRoot)
    },
    comparison: contract.requests.verification.comparison,
    policy: contract.requests.verification.policy
  };
  return Object.freeze({ source, reconstructed, scalar, verification,
    evidenceFileNames: names });
}

function finalizeVerificationRequest(requests, paths) {
  const verification = structuredClone(requests.verification);
  for (const [role, root] of [["source", paths.sourceOutputRoot],
    ["reconstructed", paths.reconstructedOutputRoot], ["scalar", paths.scalarOutputRoot]]) {
    const manifestPath = safeChild(root, "probe.json", "numerical-execution-manifest-path");
    const identity = sha256File(manifestPath, MAXIMUM_EVIDENCE_JSON_BYTES, false);
    verification.bundles[role].manifest = { fileName: "probe.json", ...identity };
  }
  return verification;
}

function createBoundedCapture(filePath, maximumBytes) {
  const descriptor = fs.openSync(filePath, "wx");
  let byteLength = 0;
  let overflow = false;
  let closed = false;
  return {
    append(chunk) {
      invariant(!closed && Buffer.isBuffer(chunk), "numerical-execution-capture-state");
      if (overflow) return;
      const remaining = maximumBytes + 1 - byteLength;
      const accepted = chunk.subarray(0, Math.max(0, remaining));
      if (accepted.length > 0) {
        let offset = 0;
        while (offset < accepted.length) {
          const written = fs.writeSync(descriptor, accepted, offset,
            accepted.length - offset, null);
          invariant(written > 0, "numerical-execution-capture-short-write");
          offset += written;
        }
        byteLength += accepted.length;
      }
      if (byteLength > maximumBytes || accepted.length < chunk.length) overflow = true;
    },
    close() {
      invariant(!closed, "numerical-execution-capture-state");
      closed = true;
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      return Object.freeze({ byteLength, overflow });
    }
  };
}

function summarizeBuffer(bytes) {
  return Object.freeze({ byteLength: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
}

function terminateOwnedProcess(child, options) {
  if (!child || child.pid === undefined) return Object.freeze({ requested: false, method: null });
  if (process.platform === "win32") {
    const result = childProcess.spawnSync(options.terminationPath,
      ["/PID", String(child.pid), "/T", "/F"], {
        cwd: options.workingDirectory,
        encoding: "buffer",
        maxBuffer: MAXIMUM_TERMINATION_OUTPUT_BYTES,
        timeout: 30000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0);
    let directKillAccepted = false;
    try {
      directKillAccepted = child.kill("SIGKILL");
    } catch {
      directKillAccepted = false;
    }
    return Object.freeze({ requested: true, method: "exact-taskkill-process-tree",
      toolExitCode: result.status, spawnError: result.error ? "termination-tool-error" : null,
      stdout: summarizeBuffer(stdout), stderr: summarizeBuffer(stderr),
      directKillAttempted: true, directKillAccepted });
  }
  return Object.freeze({ requested: true, method: "direct-child-termination",
    signalAccepted: child.kill("SIGKILL"), toolExitCode: null, spawnError: null });
}

function runCapturedProcess(executablePath, argumentsList, options) {
  return new Promise((resolve) => {
    const stdoutCapture = createBoundedCapture(options.stdoutPath, options.maximumStdoutBytes);
    let stderrCapture;
    try {
      stderrCapture = createBoundedCapture(options.stderrPath, options.maximumStderrBytes);
    } catch (error) {
      stdoutCapture.close();
      throw error;
    }
    let child;
    let timedOut = false;
    let killedForOverflow = false;
    let spawnCode = null;
    let streamCode = null;
    let termination = Object.freeze({ requested: false, method: null });
    const startedAt = Date.now();
    const completeWithoutChild = () => {
      const stdout = stdoutCapture.close();
      const stderr = stderrCapture.close();
      resolve(Object.freeze({ stage: options.stage, startedAtUtc: new Date(startedAt).toISOString(),
        finishedAtUtc: new Date().toISOString(), durationMilliseconds: Date.now() - startedAt,
        processStarted: false, exitCode: null, signal: null, timedOut, killedForOverflow,
        spawnCode, streamCode, termination,
        stdout: { ...stdout, ...sha256File(options.stdoutPath,
          options.maximumStdoutBytes + 1, true) },
        stderr: { ...stderr, ...sha256File(options.stderrPath,
          options.maximumStderrBytes + 1, true) } }));
    };
    try {
      child = childProcess.spawn(executablePath, argumentsList, {
        cwd: options.workingDirectory,
        windowsHide: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch {
      spawnCode = "numerical-execution-process-spawn";
      completeWithoutChild();
      return;
    }
    let settled = false;
    const requestTermination = (reason) => {
      if (termination.requested) return;
      if (reason === "timeout") timedOut = true;
      if (reason === "overflow") killedForOverflow = true;
      termination = terminateOwnedProcess(child, options);
    };
    child.stdout.on("data", (chunk) => {
      try {
        stdoutCapture.append(chunk);
        if (fs.lstatSync(options.stdoutPath).size > options.maximumStdoutBytes) {
          requestTermination("overflow");
        }
      } catch {
        streamCode = "numerical-execution-stdout-capture";
        requestTermination("stream");
      }
    });
    child.stderr.on("data", (chunk) => {
      try {
        stderrCapture.append(chunk);
        if (fs.lstatSync(options.stderrPath).size > options.maximumStderrBytes) {
          requestTermination("overflow");
        }
      } catch {
        streamCode = "numerical-execution-stderr-capture";
        requestTermination("stream");
      }
    });
    child.stdout.once("error", () => {
      streamCode = "numerical-execution-stdout-stream";
      requestTermination("stream");
    });
    child.stderr.once("error", () => {
      streamCode = "numerical-execution-stderr-stream";
      requestTermination("stream");
    });
    child.once("error", () => { spawnCode = "numerical-execution-process-error"; });
    const timer = setTimeout(() => requestTermination("timeout"),
      options.maximumDurationMilliseconds);
    child.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdout = stdoutCapture.close();
      const stderr = stderrCapture.close();
      resolve(Object.freeze({ stage: options.stage,
        startedAtUtc: new Date(startedAt).toISOString(),
        finishedAtUtc: new Date().toISOString(), durationMilliseconds: Date.now() - startedAt,
        processStarted: child.pid !== undefined, exitCode, signal, timedOut, killedForOverflow,
        spawnCode, streamCode, termination,
        stdout: { ...stdout, ...sha256File(options.stdoutPath,
          options.maximumStdoutBytes + 1, true) },
        stderr: { ...stderr, ...sha256File(options.stderrPath,
          options.maximumStderrBytes + 1, true) } }));
    });
  });
}

function processPassed(outcome) {
  return outcome.processStarted === true && outcome.exitCode === 0 && outcome.signal === null
    && outcome.timedOut === false && outcome.killedForOverflow === false
    && outcome.spawnCode === null && outcome.streamCode === null && outcome.stdout.overflow === false
    && outcome.stderr.overflow === false && outcome.stderr.byteLength === 0;
}

function argumentsSha256(argumentsList) {
  return crypto.createHash("sha256").update(canonicalJsonBytes(argumentsList)).digest("hex");
}

function createProcessTerminal(operationId, stage, executableBefore, executableAfter,
  argumentsList, outcome) {
  return {
    schema: PROCESS_TERMINAL_SCHEMA,
    operationId,
    stage,
    launchOrdinal: 1,
    launchCountLimit: 1,
    argumentsSha256: argumentsSha256(argumentsList),
    executableBefore,
    executableAfter,
    executableUnchanged: executableBefore.byteLength === executableAfter.byteLength
      && executableBefore.sha256 === executableAfter.sha256,
    outcome,
    retryAllowed: false,
    overwriteAllowed: false,
    repairAllowed: false
  };
}

function inventoryEvidence(root) {
  return fs.readdirSync(root).sort().map((fileName) => {
    const filePath = safeChild(root, fileName, "numerical-execution-evidence-inventory");
    const identity = sha256File(filePath, MAXIMUM_STREAM_BYTES + 1, true);
    return { fileName, ...identity };
  });
}

function createOwnerTerminal(state, status, reasonCode, launchedStages, verifierReceipt,
  evidenceRoot) {
  return {
    schema: OWNER_TERMINAL_SCHEMA,
    operationId: state.registration.ownerContract.operationId,
    status,
    reasonCode,
    claim: status === "terminal-pass"
      ? "registered-source-reconstructed-scalar-numerical-gate-only"
      : "no-numerical-pass-claim",
    registration: state.registrationIdentity,
    registrationSource: state.request.registrationSource,
    ownerRequest: state.requestIdentity,
    launchedStages,
    launchCounts: Object.fromEntries(STAGES.map((stage) =>
      [stage, launchedStages.filter((item) => item === stage).length])),
    verifierReceipt,
    evidenceInventoryBeforeTerminal: inventoryEvidence(evidenceRoot),
    immutableClosure: {
      retryAllowed: false,
      overwriteAllowed: false,
      repairAllowed: false,
      partialOutputCleanupAllowed: false,
      thresholdChangeAllowed: false,
      failedOutputAdoptionAllowed: false
    },
    allowedClaim: status === "terminal-pass"
      ? "source-to-reconstructed-and-reconstructed-to-scalar-numerical-gate"
      : "none",
    prohibitedClaims: ["optimized-native-parity", "browser-wasm-parity",
      "behavioral-quality", "p2p-availability", "site-release", "campaign-progress"]
  };
}

async function execute(requestPath) {
  const state = validateRequest(requestPath);
  const artifacts = verifySourceState(state);
  invariant(artifacts.get("execution-owner").path.toLowerCase() === __filename.toLowerCase(),
    "numerical-execution-owner-path");
  const executables = verifyExecutables(state);
  const paths = derivePaths(state);
  const contract = state.registration.ownerContract;
  const names = contract.evidenceFiles;
  const requests = childRequests(state, paths);
  const evidence = (name) => safeChild(paths.ownerEvidenceRoot, name,
    "numerical-execution-evidence-path");
  const launchedStages = [];
  let verifierReceipt = null;
  let terminalStatus = "terminal-ambiguous";
  let reasonCode = "numerical-execution-unclosed";
  let evidenceRootCreated = false;
  try {
    fs.mkdirSync(paths.ownerEvidenceRoot);
    evidenceRootCreated = true;
    fs.mkdirSync(paths.sourceScratchRoot);
    writeCanonicalNew(evidence(names.binding), {
      schema: "tinyrustlm.qwen3_numerical_execution_binding.v1",
      operationId: contract.operationId,
      registration: state.registrationIdentity,
      registrationSource: state.request.registrationSource,
      ownerRequest: state.requestIdentity,
      executables,
      roots: Object.fromEntries(Object.entries(paths).map(([key, value]) =>
        [key, path.basename(value)])),
      sourceDirectoryObserved: true,
      compositionRootObserved: true
    });
    writeCanonicalNew(evidence(names.start), {
      schema: "tinyrustlm.qwen3_numerical_execution_start.v1",
      operationId: contract.operationId,
      startedAtUtc: new Date().toISOString(),
      stageOrder: STAGES,
      launchLimitPerStage: 1,
      retryAllowed: false,
      outputRootsAbsentBeforeStart: true
    });
    const requestFiles = {
      source: evidence(names.sourceRequest),
      reconstructed: evidence(names.reconstructedRequest),
      scalar: evidence(names.scalarRequest),
      verifier: evidence(names.verificationRequest)
    };
    writeCanonicalNew(requestFiles.source, requests.source);
    writeCanonicalNew(requestFiles.reconstructed, requests.reconstructed);
    writeCanonicalNew(requestFiles.scalar, requests.scalar);

    const stageConfiguration = {
      source: { executable: executables.python,
        executablePath: state.executablePaths.pythonPath,
        arguments: [artifacts.get("source-owner").path, requestFiles.source],
        stdout: names.sourceStdout, stderr: names.sourceStderr, terminal: names.sourceTerminal },
      reconstructed: { executable: executables.python,
        executablePath: state.executablePaths.pythonPath,
        arguments: [artifacts.get("reconstructed-owner").path, requestFiles.reconstructed],
        stdout: names.reconstructedStdout, stderr: names.reconstructedStderr,
        terminal: names.reconstructedTerminal },
      scalar: { executable: executables.scalar,
        executablePath: state.executablePaths.scalarPath,
        arguments: [requestFiles.scalar], stdout: names.scalarStdout,
        stderr: names.scalarStderr, terminal: names.scalarTerminal }
    };
    for (const stage of ["source", "reconstructed", "scalar"]) {
      const configuration = stageConfiguration[stage];
      const executableBefore = sha256File(configuration.executablePath,
        MAXIMUM_EXECUTABLE_BYTES, false);
      invariant(executableBefore.byteLength === configuration.executable.byteLength
        && executableBefore.sha256 === configuration.executable.sha256,
      "numerical-execution-executable-before-launch");
      launchedStages.push(stage);
      const outcome = await runCapturedProcess(configuration.executablePath,
        configuration.arguments, {
          stage,
          workingDirectory: state.repositoryRoot,
          stdoutPath: evidence(configuration.stdout),
          stderrPath: evidence(configuration.stderr),
          maximumStdoutBytes: contract.processPolicy.maximumStdoutBytes,
          maximumStderrBytes: contract.processPolicy.maximumStderrBytes,
          maximumDurationMilliseconds: contract.processPolicy.maximumDurationMilliseconds[stage],
          terminationPath: state.executablePaths.terminationPath
        });
      const executableAfter = sha256File(configuration.executablePath,
        MAXIMUM_EXECUTABLE_BYTES, false);
      writeCanonicalNew(evidence(configuration.terminal), createProcessTerminal(
        contract.operationId, stage, executableBefore, executableAfter,
        configuration.arguments, outcome));
      if (!processPassed(outcome) || executableBefore.sha256 !== executableAfter.sha256
          || executableBefore.byteLength !== executableAfter.byteLength) {
        terminalStatus = "terminal-failure";
        reasonCode = `${stage}-process-not-pass`;
        break;
      }
    }

    if (launchedStages.length === 3 && terminalStatus === "terminal-ambiguous") {
      const verificationRequest = finalizeVerificationRequest(requests, paths);
      writeCanonicalNew(requestFiles.verifier, verificationRequest);
      const configuration = { executable: executables.node,
        executablePath: state.executablePaths.nodePath,
        arguments: [artifacts.get("verifier").path, requestFiles.verifier],
        stdout: names.verifierStdout, stderr: names.verifierStderr,
        terminal: names.verifierTerminal };
      const executableBefore = sha256File(configuration.executablePath,
        MAXIMUM_EXECUTABLE_BYTES, false);
      launchedStages.push("verifier");
      const outcome = await runCapturedProcess(configuration.executablePath,
        configuration.arguments, {
          stage: "verifier",
          workingDirectory: state.repositoryRoot,
          stdoutPath: evidence(configuration.stdout), stderrPath: evidence(configuration.stderr),
          maximumStdoutBytes: contract.processPolicy.maximumStdoutBytes,
          maximumStderrBytes: contract.processPolicy.maximumStderrBytes,
          maximumDurationMilliseconds:
            contract.processPolicy.maximumDurationMilliseconds.verifier,
          terminationPath: state.executablePaths.terminationPath
        });
      const executableAfter = sha256File(configuration.executablePath,
        MAXIMUM_EXECUTABLE_BYTES, false);
      writeCanonicalNew(evidence(configuration.terminal), createProcessTerminal(
        contract.operationId, "verifier", executableBefore, executableAfter,
        configuration.arguments, outcome));
      if (!processPassed(outcome) || executableBefore.sha256 !== executableAfter.sha256
          || executableBefore.byteLength !== executableAfter.byteLength) {
        terminalStatus = "terminal-failure";
        reasonCode = "verifier-process-not-pass";
      } else {
        const receiptDocument = readCanonicalJson(evidence(names.verifierStdout),
          contract.processPolicy.maximumStdoutBytes, "numerical-execution-verifier-receipt");
        verifierReceipt = receiptDocument.value;
        invariant(verifierReceipt.schema === VERIFIER_RECEIPT_SCHEMA
          && verifierReceipt.operationId === contract.operationId
          && verifierReceipt.registrationSha256 === state.registrationIdentity.sha256
          && ["pass", "fail"].includes(verifierReceipt.status)
          && verifierReceipt.writesPerformed === false,
        "numerical-execution-verifier-receipt");
        terminalStatus = verifierReceipt.status === "pass" ? "terminal-pass"
          : "terminal-rejected";
        reasonCode = verifierReceipt.status === "pass" ? "registered-differentials-pass"
          : "registered-differential-rejected";
      }
    }
  } catch (error) {
    terminalStatus = launchedStages.length === 0 ? "terminal-failure" : "terminal-ambiguous";
    reasonCode = safeErrorCode(error);
  }
  invariant(evidenceRootCreated, "numerical-execution-evidence-root-create");
  const terminal = createOwnerTerminal(state, terminalStatus, reasonCode, launchedStages,
    verifierReceipt, paths.ownerEvidenceRoot);
  writeCanonicalNew(evidence(names.ownerTerminal), terminal);
  return Object.freeze({ terminal, ownerEvidenceRoot: paths.ownerEvidenceRoot });
}

async function main(argumentsList) {
  invariant(argumentsList.length === 2 && argumentsList[0] === "execute",
    "numerical-execution-arguments");
  const observation = await execute(requireAbsolutePath(argumentsList[1],
    "numerical-execution-request-path"));
  process.stdout.write(canonicalJsonBytes({
    schema: "tinyrustlm.qwen3_numerical_execution_owner_observation.v1",
    operationId: observation.terminal.operationId,
    status: observation.terminal.status,
    reasonCode: observation.terminal.reasonCode,
    claim: observation.terminal.claim
  }));
  if (observation.terminal.status !== "terminal-pass") process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`qwen3-numerical-execution-owner-error:${safeErrorCode(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  NumericalExecutionOwnerError,
  REGISTRATION_RELATIVE_PATH,
  REQUEST_SCHEMA,
  REGISTRATION_SCHEMA,
  OWNER_CONTRACT_SCHEMA,
  canonicalJsonBytes,
  childRequests,
  createProcessTerminal,
  execute,
  processPassed,
  runCapturedProcess,
  safeErrorCode,
  validateOwnerContract,
  validateRegistration
});

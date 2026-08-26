"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REQUEST_SCHEMA = "tinyrustlm.qwen3_numerical_execution_request.v2";
const REGISTRATION_SCHEMA =
  "tinyrustlm.qwen3_numerical_differential_execution_preregistration.v2";
const OWNER_CONTRACT_SCHEMA =
  "tinyrustlm.qwen3_numerical_execution_owner_contract.v2";
const OWNER_TERMINAL_SCHEMA =
  "tinyrustlm.qwen3_numerical_execution_terminal.v1";
const PROCESS_TERMINAL_SCHEMA =
  "tinyrustlm.qwen3_numerical_execution_process_terminal.v1";
const SOURCE_REQUEST_SCHEMA = "tinyrustlm.qwen3_numerical_source_request.v2";
const RECONSTRUCTED_REQUEST_SCHEMA =
  "tinyrustlm.qwen3_slm2_reconstructed_request.v1";
const SCALAR_REQUEST_SCHEMA = "tinyrustlm.scalar-numerical-probe-request.v1";
const VERIFICATION_SCHEMA =
  "tinyrustlm.qwen3_numerical_source_terminal_verification.v1";
const REGISTRATION_RELATIVE_PATH =
  "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v2.json";
const MAXIMUM_JSON_BYTES = 4 * 1024 * 1024;
const MAXIMUM_STREAM_BYTES = 1024 * 1024;
const MAXIMUM_SOURCE_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9.-]{0,254}$/u;
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/u;
const SAFE_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/u;
const UTC_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const PROHIBITED_CLAIMS = Object.freeze([
  "optimized-native-parity",
  "browser-wasm-parity",
  "behavioral-quality",
  "p2p-availability",
  "site-release",
  "campaign-progress"
]);
const STAGE_ORDER = Object.freeze(["source", "reconstructed", "scalar", "verifier"]);

class SourceTerminalVerifierError extends Error {
  constructor(code) {
    super(code);
    this.name = "SourceTerminalVerifierError";
    this.code = code;
  }
}

function invariant(condition, code) {
  if (!condition) throw new SourceTerminalVerifierError(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys, code) {
  invariant(isPlainObject(value), code);
  invariant(JSON.stringify(Object.keys(value).sort())
    === JSON.stringify([...keys].sort()), code);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort()
      .map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(canonicalValue(value), null, 2)}\n`, "utf8");
}

function sameValue(left, right) {
  return canonicalJsonBytes(left).equals(canonicalJsonBytes(right));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function directPath(filePath, kind, maximumBytes, code) {
  invariant(typeof filePath === "string" && path.isAbsolute(filePath)
    && filePath === path.resolve(filePath), code);
  let stat;
  let real;
  try {
    stat = fs.lstatSync(filePath);
    real = fs.realpathSync.native(filePath);
  } catch {
    throw new SourceTerminalVerifierError(code);
  }
  invariant(!stat.isSymbolicLink()
    && (kind === "file" ? stat.isFile() : stat.isDirectory())
    && path.normalize(real).toLowerCase() === path.normalize(filePath).toLowerCase(), code);
  if (kind === "file") {
    invariant(stat.size >= 0 && stat.size <= maximumBytes, code);
  }
  return stat;
}

function absent(filePath, code) {
  try {
    fs.lstatSync(filePath);
  } catch (error) {
    invariant(error && error.code === "ENOENT", code);
    return;
  }
  throw new SourceTerminalVerifierError(code);
}

function safeChild(root, fileName, code) {
  invariant(typeof fileName === "string" && FILE_NAME_PATTERN.test(fileName)
    && path.basename(fileName) === fileName, code);
  const child = path.resolve(root, fileName);
  invariant(path.dirname(child).toLowerCase() === root.toLowerCase(), code);
  return child;
}

function fileIdentity(filePath, maximumBytes, code) {
  const stat = directPath(filePath, "file", maximumBytes, code);
  const descriptor = fs.openSync(filePath, "r");
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let byteLength = 0;
  try {
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      byteLength += count;
      invariant(byteLength <= maximumBytes, code);
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  invariant(byteLength === stat.size, code);
  return Object.freeze({ byteLength, sha256: hash.digest("hex") });
}

function readCanonicalJson(filePath, maximumBytes, code) {
  const identity = fileIdentity(filePath, maximumBytes, code);
  const bytes = fs.readFileSync(filePath);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SourceTerminalVerifierError(code);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new SourceTerminalVerifierError(code);
  }
  invariant(isPlainObject(value) && canonicalJsonBytes(value).equals(bytes), code);
  return Object.freeze({ value, identity, bytes });
}

function artifactReference(value, code) {
  exactKeys(value, ["byteLength", "sha256"], code);
  invariant(Number.isSafeInteger(value.byteLength) && value.byteLength >= 0
    && SHA256_PATTERN.test(value.sha256), code);
}

function registrationReference(value, code) {
  exactKeys(value, ["relativePath", "byteLength", "sha256"], code);
  invariant(value.relativePath === REGISTRATION_RELATIVE_PATH, code);
  artifactReference({ byteLength: value.byteLength, sha256: value.sha256 }, code);
}

function validUtc(value) {
  return typeof value === "string" && UTC_PATTERN.test(value)
    && Number.isFinite(Date.parse(value));
}

function validateRegistration(registration, operationId) {
  exactKeys(registration, ["schema", "profileId", "status", "registeredAtUtc",
    "registrationParentCommit", "registrationParentTree", "authority", "sourceAnchor",
    "reportLineage", "implementationCheckpoint", "candidate", "ownerContract",
    "outputBoundary", "claimBoundary", "campaignCounters"],
  "source-terminal-registration-shape");
  invariant(registration.schema === REGISTRATION_SCHEMA
    && registration.status === "registered-before-private-request-roots-and-real-traces"
    && COMMIT_PATTERN.test(registration.registrationParentCommit)
    && COMMIT_PATTERN.test(registration.registrationParentTree),
  "source-terminal-registration-identity");
  const authority = registration.authority;
  invariant(authority.legacySupport === false && authority.compatibilityReader === false
    && authority.fallbackRuntime === false && authority.automaticRetry === false
    && authority.responseRepair === false && authority.bestOfN === false
    && authority.memoryEndpointsAuthorized === false,
  "source-terminal-registration-authority");
  invariant(sameValue(registration.campaignCounters, {
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    deletionBackedBrowserRounds: "0/50",
    liveCatalogAnnouncements: "0/20",
    qualifiedModels: "0/20"
  }), "source-terminal-registration-counters");

  const contract = registration.ownerContract;
  exactKeys(contract, ["schema", "operationId", "traceProfileId",
    "implementationArtifacts", "executables", "cases", "requests", "processPolicy",
    "privateNames", "evidenceFiles", "terminalPolicy"],
  "source-terminal-owner-contract-shape");
  invariant(contract.schema === OWNER_CONTRACT_SCHEMA && contract.operationId === operationId
    && IDENTIFIER_PATTERN.test(contract.operationId),
  "source-terminal-owner-contract-identity");
  exactKeys(contract.privateNames, ["ownerRequestFileBasename", "ownerEvidenceRootBasename",
    "sourceScratchRootBasename", "sourceOutputRootBasename",
    "reconstructedOutputRootBasename", "scalarOutputRootBasename"],
  "source-terminal-private-names");
  invariant(sameValue(contract.privateNames, {
    ownerRequestFileBasename: `${operationId}-owner-request.json`,
    ownerEvidenceRootBasename: `${operationId}-owner-evidence`,
    sourceScratchRootBasename: `${operationId}-source-scratch`,
    sourceOutputRootBasename: `${operationId}-source`,
    reconstructedOutputRootBasename: `${operationId}-reconstructed`,
    scalarOutputRootBasename: `${operationId}-scalar`
  }), "source-terminal-private-names");
  const names = {
    binding: "binding.json",
    start: "start.json",
    sourceRequest: "source.request.json",
    sourceStdout: "source.stdout.bin",
    sourceStderr: "source.stderr.bin",
    sourceTerminal: "source.process-terminal.json",
    reconstructedRequest: "reconstructed.request.json",
    reconstructedStdout: "reconstructed.stdout.bin",
    reconstructedStderr: "reconstructed.stderr.bin",
    reconstructedTerminal: "reconstructed.process-terminal.json",
    scalarRequest: "scalar.request.json",
    scalarStdout: "scalar.stdout.bin",
    scalarStderr: "scalar.stderr.bin",
    scalarTerminal: "scalar.process-terminal.json",
    verificationRequest: "verification.request.json",
    verifierStdout: "verifier.stdout.bin",
    verifierStderr: "verifier.stderr.bin",
    verifierTerminal: "verifier.process-terminal.json",
    ownerTerminal: "owner-terminal.json"
  };
  invariant(sameValue(contract.evidenceFiles, names), "source-terminal-evidence-names");
  invariant(contract.requests.source.schema === SOURCE_REQUEST_SCHEMA
    && contract.requests.reconstructed.schema === RECONSTRUCTED_REQUEST_SCHEMA
    && contract.requests.scalar.schema === SCALAR_REQUEST_SCHEMA,
  "source-terminal-child-schemas");
  invariant(contract.processPolicy.launchLimitPerStage === 1
    && contract.processPolicy.retryAllowed === false
    && contract.processPolicy.overwriteAllowed === false
    && contract.processPolicy.repairAllowed === false
    && contract.processPolicy.continueAfterFailedStage === false,
  "source-terminal-process-policy");
  invariant(sameValue(contract.terminalPolicy, {
    successStatus: "terminal-pass",
    rejectionStatus: "terminal-rejected",
    failureStatus: "terminal-failure",
    ambiguousStatus: "terminal-ambiguous",
    secondInvocationAllowed: false,
    partialOutputCleanupAllowed: false,
    evidenceOverwriteAllowed: false,
    thresholdChangeAfterLaunchAllowed: false
  }), "source-terminal-terminal-policy");
  return Object.freeze({ contract, names });
}

function validateRequest(requestPath) {
  const requestDocument = readCanonicalJson(requestPath, MAXIMUM_JSON_BYTES,
    "source-terminal-owner-request-json");
  const request = requestDocument.value;
  exactKeys(request, ["schema", "operationId", "registration", "registrationSource",
    "repositoryRoot", "gitPath", "evidenceParent", "sourceDirectory",
    "compositionRoot", "executables"], "source-terminal-owner-request-shape");
  invariant(request.schema === REQUEST_SCHEMA && IDENTIFIER_PATTERN.test(request.operationId),
    "source-terminal-owner-request-identity");
  registrationReference(request.registration, "source-terminal-registration-reference");
  exactKeys(request.registrationSource, ["commit", "tree", "branch", "trackingRef",
    "remoteRef", "fetchHeadExpected"], "source-terminal-registration-source");
  invariant(COMMIT_PATTERN.test(request.registrationSource.commit)
    && COMMIT_PATTERN.test(request.registrationSource.tree)
    && request.registrationSource.branch === "codex/model-acquisition-v2"
    && request.registrationSource.trackingRef === "origin/codex/model-acquisition-v2"
    && request.registrationSource.remoteRef
      === "refs/remotes/origin/codex/model-acquisition-v2"
    && request.registrationSource.fetchHeadExpected === true,
  "source-terminal-registration-source");
  for (const root of [request.repositoryRoot, request.evidenceParent,
    request.sourceDirectory, request.compositionRoot]) {
    directPath(root, "directory", 0, "source-terminal-request-root");
  }
  invariant(new Set([request.repositoryRoot, request.evidenceParent,
    request.sourceDirectory, request.compositionRoot]
    .map((value) => value.toLowerCase())).size === 4,
  "source-terminal-request-root-overlap");
  invariant(typeof request.gitPath === "string" && path.isAbsolute(request.gitPath),
    "source-terminal-request-executable-path");
  exactKeys(request.executables, ["pythonPath", "nodePath", "scalarPath",
    "terminationPath"], "source-terminal-request-executable-paths");
  invariant(Object.values(request.executables)
    .every((value) => typeof value === "string" && path.isAbsolute(value)),
  "source-terminal-request-executable-path");

  const registrationPath = path.resolve(request.repositoryRoot,
    ...request.registration.relativePath.split("/"));
  invariant(registrationPath.startsWith(`${request.repositoryRoot}${path.sep}`),
    "source-terminal-registration-path");
  const registrationDocument = readCanonicalJson(registrationPath, MAXIMUM_JSON_BYTES,
    "source-terminal-registration-json");
  invariant(registrationDocument.identity.byteLength === request.registration.byteLength
    && registrationDocument.identity.sha256 === request.registration.sha256,
  "source-terminal-registration-drift");
  const validated = validateRegistration(registrationDocument.value, request.operationId);
  const names = validated.contract.privateNames;
  invariant(path.basename(requestPath).toLowerCase()
      === names.ownerRequestFileBasename.toLowerCase()
    && path.dirname(requestPath).toLowerCase() === request.evidenceParent.toLowerCase(),
  "source-terminal-owner-request-path");
  return Object.freeze({ requestPath, request, requestIdentity: requestDocument.identity,
    registration: registrationDocument.value,
    registrationIdentity: registrationDocument.identity,
    contract: validated.contract, names: validated.names });
}

function expectedChildRequests(state, roots) {
  const contract = state.contract;
  const cases = contract.cases.map(({ id, tokenIds }) => ({ id, tokenIds }));
  const differentialProfileSha256 =
    contract.requests.verification.differentialProfile.sha256;
  return Object.freeze({
    source: {
      schema: SOURCE_REQUEST_SCHEMA,
      operationId: contract.operationId,
      differentialProfileSha256,
      registrationSha256: state.registrationIdentity.sha256,
      sourceLock: contract.requests.source.sourceLock,
      sourceDirectory: state.request.sourceDirectory,
      scratchRoot: roots.sourceScratchRoot,
      evidenceParent: state.request.evidenceParent,
      outputRoot: roots.sourceOutputRoot,
      traceProfileId: contract.traceProfileId,
      framework: contract.requests.source.framework,
      policy: contract.requests.source.policy,
      cases
    },
    reconstructed: {
      schema: RECONSTRUCTED_REQUEST_SCHEMA,
      operationId: contract.operationId,
      differentialProfileSha256,
      registrationSha256: state.registrationIdentity.sha256,
      compositionResultSha256:
        contract.requests.reconstructed.compositionResultSha256,
      compositionRoot: state.request.compositionRoot,
      model: contract.requests.reconstructed.model,
      evidenceParent: state.request.evidenceParent,
      outputRoot: roots.reconstructedOutputRoot,
      traceProfileId: contract.traceProfileId,
      implementation: contract.requests.reconstructed.implementation,
      modelSpec: contract.requests.reconstructed.modelSpec,
      policy: contract.requests.reconstructed.policy,
      cases
    },
    scalar: {
      schema: SCALAR_REQUEST_SCHEMA,
      operationId: contract.operationId,
      compositionResultSha256: contract.requests.scalar.compositionResultSha256,
      compositionRoot: state.request.compositionRoot,
      model: contract.requests.scalar.model,
      evidenceParent: state.request.evidenceParent,
      outputRoot: roots.scalarOutputRoot,
      traceProfileId: contract.traceProfileId,
      policy: contract.requests.scalar.policy,
      cases
    }
  });
}

function validateChildRequest(actual, expected, keys, shapeCode, bindingCode) {
  exactKeys(actual, keys, shapeCode);
  invariant(sameValue(actual, expected), bindingCode);
}

function verify(requestPath) {
  const state = validateRequest(requestPath);
  const privateNames = state.contract.privateNames;
  const evidenceParent = state.request.evidenceParent;
  const roots = {
    ownerEvidenceRoot: safeChild(evidenceParent, privateNames.ownerEvidenceRootBasename,
      "source-terminal-private-root"),
    sourceScratchRoot: safeChild(evidenceParent, privateNames.sourceScratchRootBasename,
      "source-terminal-private-root"),
    sourceOutputRoot: safeChild(evidenceParent, privateNames.sourceOutputRootBasename,
      "source-terminal-private-root"),
    reconstructedOutputRoot: safeChild(evidenceParent,
      privateNames.reconstructedOutputRootBasename, "source-terminal-private-root"),
    scalarOutputRoot: safeChild(evidenceParent, privateNames.scalarOutputRootBasename,
      "source-terminal-private-root")
  };
  directPath(roots.ownerEvidenceRoot, "directory", 0,
    "source-terminal-evidence-root");
  directPath(roots.sourceScratchRoot, "directory", 0,
    "source-terminal-scratch-root");
  invariant(fs.readdirSync(roots.sourceScratchRoot).length === 0,
    "source-terminal-scratch-not-empty");
  for (const root of [roots.sourceOutputRoot, roots.reconstructedOutputRoot,
    roots.scalarOutputRoot]) {
    absent(root, "source-terminal-material-output-present");
  }

  const names = state.names;
  const expectedEvidenceNames = [names.binding, names.ownerTerminal,
    names.reconstructedRequest, names.scalarRequest, names.sourceRequest,
    names.sourceStdout, names.sourceStderr, names.sourceTerminal, names.start].sort();
  const entries = fs.readdirSync(roots.ownerEvidenceRoot, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  invariant(JSON.stringify(entries.map((entry) => entry.name))
      === JSON.stringify(expectedEvidenceNames)
    && entries.every((entry) => entry.isFile() && !entry.isSymbolicLink()),
  "source-terminal-evidence-inventory");
  const evidence = (name) => safeChild(roots.ownerEvidenceRoot, name,
    "source-terminal-evidence-path");

  const binding = readCanonicalJson(evidence(names.binding), MAXIMUM_JSON_BYTES,
    "source-terminal-binding-json").value;
  const start = readCanonicalJson(evidence(names.start), MAXIMUM_JSON_BYTES,
    "source-terminal-start-json").value;
  const sourceRequest = readCanonicalJson(evidence(names.sourceRequest), MAXIMUM_JSON_BYTES,
    "source-terminal-source-request-json").value;
  const reconstructedRequest = readCanonicalJson(evidence(names.reconstructedRequest),
    MAXIMUM_JSON_BYTES, "source-terminal-reconstructed-request-json").value;
  const scalarRequest = readCanonicalJson(evidence(names.scalarRequest), MAXIMUM_JSON_BYTES,
    "source-terminal-scalar-request-json").value;
  const sourceTerminalDocument = readCanonicalJson(evidence(names.sourceTerminal),
    MAXIMUM_JSON_BYTES, "source-terminal-process-json");
  const ownerTerminalDocument = readCanonicalJson(evidence(names.ownerTerminal),
    MAXIMUM_JSON_BYTES, "source-terminal-owner-json");

  const expectedRequests = expectedChildRequests(state, roots);
  validateChildRequest(sourceRequest, expectedRequests.source,
    ["schema", "operationId", "differentialProfileSha256", "registrationSha256",
      "sourceLock", "sourceDirectory", "scratchRoot", "evidenceParent", "outputRoot",
      "traceProfileId", "framework", "policy", "cases"],
    "source-terminal-source-request-shape", "source-terminal-source-request-binding");
  validateChildRequest(reconstructedRequest, expectedRequests.reconstructed,
    ["schema", "operationId", "differentialProfileSha256", "registrationSha256",
      "compositionResultSha256", "compositionRoot", "model", "evidenceParent",
      "outputRoot", "traceProfileId", "implementation", "modelSpec", "policy", "cases"],
    "source-terminal-reconstructed-request-shape",
    "source-terminal-reconstructed-request-binding");
  validateChildRequest(scalarRequest, expectedRequests.scalar,
    ["schema", "operationId", "compositionResultSha256", "compositionRoot", "model",
      "evidenceParent", "outputRoot", "traceProfileId", "policy", "cases"],
    "source-terminal-scalar-request-shape", "source-terminal-scalar-request-binding");

  exactKeys(binding, ["schema", "operationId", "registration", "registrationSource",
    "ownerRequest", "executables", "roots", "sourceDirectoryObserved",
    "compositionRootObserved"], "source-terminal-binding-shape");
  const expectedExecutablePaths = {
    git: state.request.gitPath,
    python: state.request.executables.pythonPath,
    node: state.request.executables.nodePath,
    scalar: state.request.executables.scalarPath,
    termination: state.request.executables.terminationPath
  };
  const expectedExecutables = Object.fromEntries(Object.entries(
    state.contract.executables).map(([role, value]) => [role, {
      path: expectedExecutablePaths[role],
      byteLength: value.byteLength,
      sha256: value.sha256
    }]));
  const expectedRootNames = Object.fromEntries(Object.entries(roots)
    .map(([role, value]) => [role, path.basename(value)]));
  invariant(binding.schema === "tinyrustlm.qwen3_numerical_execution_binding.v1"
    && binding.operationId === state.contract.operationId
    && sameValue(binding.registration, state.registrationIdentity)
    && sameValue(binding.registrationSource, state.request.registrationSource)
    && sameValue(binding.ownerRequest, state.requestIdentity)
    && sameValue(binding.executables, expectedExecutables)
    && sameValue(binding.roots, expectedRootNames)
    && binding.sourceDirectoryObserved === true
    && binding.compositionRootObserved === true,
  "source-terminal-binding");

  exactKeys(start, ["schema", "operationId", "startedAtUtc", "stageOrder",
    "launchLimitPerStage", "retryAllowed", "outputRootsAbsentBeforeStart"],
  "source-terminal-start-shape");
  invariant(start.schema === "tinyrustlm.qwen3_numerical_execution_start.v1"
    && start.operationId === state.contract.operationId && validUtc(start.startedAtUtc)
    && sameValue(start.stageOrder, STAGE_ORDER) && start.launchLimitPerStage === 1
    && start.retryAllowed === false && start.outputRootsAbsentBeforeStart === true,
  "source-terminal-start");

  const sourceTerminal = sourceTerminalDocument.value;
  exactKeys(sourceTerminal, ["schema", "operationId", "stage", "launchOrdinal",
    "launchCountLimit", "argumentsSha256", "executableBefore", "executableAfter",
    "executableUnchanged", "outcome", "retryAllowed", "overwriteAllowed",
    "repairAllowed"], "source-terminal-process-shape");
  const sourceArtifact = state.contract.implementationArtifacts
    .filter((artifact) => artifact.role === "source-owner");
  invariant(sourceArtifact.length === 1, "source-terminal-source-owner-artifact");
  const sourceArguments = [path.resolve(state.request.repositoryRoot,
    ...sourceArtifact[0].relativePath.split("/")), evidence(names.sourceRequest)];
  const argumentsSha256 = sha256(canonicalJsonBytes(sourceArguments));
  const pythonIdentity = state.contract.executables.python;
  invariant(sourceTerminal.schema === PROCESS_TERMINAL_SCHEMA
    && sourceTerminal.operationId === state.contract.operationId
    && sourceTerminal.stage === "source" && sourceTerminal.launchOrdinal === 1
    && sourceTerminal.launchCountLimit === 1
    && sourceTerminal.argumentsSha256 === argumentsSha256
    && sameValue(sourceTerminal.executableBefore, pythonIdentity)
    && sameValue(sourceTerminal.executableAfter, pythonIdentity)
    && sourceTerminal.executableUnchanged === true
    && sourceTerminal.retryAllowed === false && sourceTerminal.overwriteAllowed === false
    && sourceTerminal.repairAllowed === false,
  "source-terminal-process-binding");
  const outcome = sourceTerminal.outcome;
  exactKeys(outcome, ["stage", "startedAtUtc", "finishedAtUtc", "durationMilliseconds",
    "processStarted", "exitCode", "signal", "timedOut", "killedForOverflow",
    "spawnCode", "streamCode", "termination", "stdout", "stderr"],
  "source-terminal-process-outcome-shape");
  exactKeys(outcome.termination, ["requested", "method"],
    "source-terminal-process-termination");
  exactKeys(outcome.stdout, ["byteLength", "overflow", "sha256"],
    "source-terminal-process-stream");
  exactKeys(outcome.stderr, ["byteLength", "overflow", "sha256"],
    "source-terminal-process-stream");
  const started = Date.parse(outcome.startedAtUtc);
  const finished = Date.parse(outcome.finishedAtUtc);
  invariant(outcome.stage === "source" && validUtc(outcome.startedAtUtc)
    && validUtc(outcome.finishedAtUtc) && finished >= started
    && outcome.durationMilliseconds === finished - started
    && outcome.durationMilliseconds >= 0
    && outcome.durationMilliseconds
      <= state.contract.processPolicy.maximumDurationMilliseconds.source
    && outcome.processStarted === true && outcome.exitCode === 1
    && outcome.signal === null && outcome.timedOut === false
    && outcome.killedForOverflow === false && outcome.spawnCode === null
    && outcome.streamCode === null
    && sameValue(outcome.termination, { requested: false, method: null }),
  "source-terminal-process-outcome");

  const stdoutIdentity = fileIdentity(evidence(names.sourceStdout), MAXIMUM_STREAM_BYTES,
    "source-terminal-stream-identity");
  const stderrIdentity = fileIdentity(evidence(names.sourceStderr), MAXIMUM_STREAM_BYTES,
    "source-terminal-stream-identity");
  invariant(sameValue(outcome.stdout, { ...stdoutIdentity, overflow: false })
    && sameValue(outcome.stderr, { ...stderrIdentity, overflow: false })
    && stdoutIdentity.byteLength === 0,
  "source-terminal-stream-identity");
  const stderrBytes = fs.readFileSync(evidence(names.sourceStderr));
  let stderrText;
  try {
    stderrText = new TextDecoder("utf-8", { fatal: true }).decode(stderrBytes);
  } catch {
    throw new SourceTerminalVerifierError("source-terminal-safe-code");
  }
  const safeMatch = /^qwen3-source-trace-error:([a-z0-9][a-z0-9-]{0,127})\r\n$/u
    .exec(stderrText);
  invariant(safeMatch !== null && SAFE_CODE_PATTERN.test(safeMatch[1]),
    "source-terminal-safe-code");

  const ownerTerminal = ownerTerminalDocument.value;
  exactKeys(ownerTerminal, ["schema", "operationId", "status", "reasonCode", "claim",
    "registration", "registrationSource", "ownerRequest", "launchedStages",
    "launchCounts", "verifierReceipt", "evidenceInventoryBeforeTerminal",
    "immutableClosure", "allowedClaim", "prohibitedClaims"],
  "source-terminal-owner-shape");
  invariant(ownerTerminal.schema === OWNER_TERMINAL_SCHEMA
    && ownerTerminal.operationId === state.contract.operationId
    && ownerTerminal.status === "terminal-failure"
    && ownerTerminal.reasonCode === "source-process-not-pass"
    && ownerTerminal.claim === "no-numerical-pass-claim"
    && ownerTerminal.allowedClaim === "none"
    && ownerTerminal.verifierReceipt === null,
  "source-terminal-owner-decision");
  invariant(sameValue(ownerTerminal.registration, state.registrationIdentity)
    && sameValue(ownerTerminal.registrationSource, state.request.registrationSource)
    && sameValue(ownerTerminal.ownerRequest, state.requestIdentity),
  "source-terminal-owner-binding");
  invariant(sameValue(ownerTerminal.launchedStages, ["source"])
    && sameValue(ownerTerminal.launchCounts,
      { source: 1, reconstructed: 0, scalar: 0, verifier: 0 }),
  "source-terminal-owner-launches");
  invariant(sameValue(ownerTerminal.immutableClosure, {
    retryAllowed: false,
    overwriteAllowed: false,
    repairAllowed: false,
    partialOutputCleanupAllowed: false,
    thresholdChangeAllowed: false,
    failedOutputAdoptionAllowed: false
  }) && sameValue(ownerTerminal.prohibitedClaims, PROHIBITED_CLAIMS),
  "source-terminal-owner-authority");

  const preTerminalNames = expectedEvidenceNames
    .filter((fileName) => fileName !== names.ownerTerminal);
  const expectedInventory = preTerminalNames.map((fileName) => ({
    fileName,
    ...fileIdentity(evidence(fileName), MAXIMUM_STREAM_BYTES + 1,
      "source-terminal-evidence-member")
  }));
  invariant(sameValue(ownerTerminal.evidenceInventoryBeforeTerminal, expectedInventory),
    "source-terminal-owner-inventory");

  const evidenceByteLength = expectedEvidenceNames.reduce((sum, fileName) =>
    sum + directPath(evidence(fileName), "file", MAXIMUM_STREAM_BYTES + 1,
      "source-terminal-evidence-member").size, 0);
  const verifierIdentity = fileIdentity(__filename, MAXIMUM_SOURCE_BYTES,
    "source-terminal-verifier-identity");
  const finding = {
    schema: VERIFICATION_SCHEMA,
    operationId: state.contract.operationId,
    verificationStatus: "pass",
    ownerStatus: ownerTerminal.status,
    ownerReasonCode: ownerTerminal.reasonCode,
    sourceSafeCode: safeMatch[1],
    launchCounts: ownerTerminal.launchCounts,
    registration: state.registrationIdentity,
    ownerRequest: state.requestIdentity,
    ownerTerminal: ownerTerminalDocument.identity,
    sourceTerminal: sourceTerminalDocument.identity,
    sourceStdout: stdoutIdentity,
    sourceStderr: stderrIdentity,
    evidenceFileCount: expectedEvidenceNames.length,
    evidenceByteLength,
    sourceScratchEmpty: true,
    materialOutputRootsAbsent: true,
    verifier: verifierIdentity,
    writesPerformed: false,
    allowedClaim: "none",
    prohibitedClaims: PROHIBITED_CLAIMS
  };
  const verificationId = sha256(canonicalJsonBytes(finding));
  return Object.freeze({ ...finding, verificationId });
}

function safeErrorCode(error) {
  return error instanceof SourceTerminalVerifierError
    && SAFE_CODE_PATTERN.test(error.code) ? error.code : "source-terminal-verifier-fault";
}

function main(argumentsList) {
  invariant(argumentsList.length === 2 && argumentsList[0] === "verify",
    "source-terminal-verifier-arguments");
  const result = verify(argumentsList[1]);
  process.stdout.write(canonicalJsonBytes(result));
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`qwen3-source-terminal-verifier-error:${safeErrorCode(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  SourceTerminalVerifierError,
  VERIFICATION_SCHEMA,
  canonicalJsonBytes,
  safeErrorCode,
  verify
});

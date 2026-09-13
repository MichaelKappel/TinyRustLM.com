"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const owner = require("../tools/qwen3-numerical-execution-owner.js");
const verifier = require("../tools/qwen3-numerical-source-terminal-verifier.js");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } =
  require("../tools/canonical-operation-scratch.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const registrationPath = path.join(repositoryRoot,
  "contracts", "vnext",
  "qwen3-numerical-differential-execution-preregistration.v2.json");
const operationId = "qwen3-numerical-c1899de-4891e8a-20260826-v2";
const safeSourceCode = "source-trace-environment-drift";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(canonicalValue(value), null, 2)}\n`, "utf8");
}

function writeCanonical(filePath, value) {
  fs.writeFileSync(filePath, canonicalBytes(value), { flag: "wx" });
}

function replaceCanonical(filePath, value) {
  fs.writeFileSync(filePath, canonicalBytes(value), { flag: "w" });
}

function identity(filePath) {
  const bytes = fs.readFileSync(filePath);
  return { byteLength: bytes.length, sha256: sha256(bytes) };
}

function evidenceInventory(root) {
  return fs.readdirSync(root).sort().map((fileName) => ({
    fileName,
    ...identity(path.join(root, fileName))
  }));
}

function snapshot(root) {
  return fs.readdirSync(root).sort().map((fileName) => {
    const filePath = path.join(root, fileName);
    const stat = fs.lstatSync(filePath);
    return { fileName, byteLength: stat.size, mtimeMs: stat.mtimeMs,
      sha256: sha256(fs.readFileSync(filePath)) };
  });
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Synthetic historical receipts stay in owned artifacts and never run the closed model owner. */
function fixture(t) {
  const owned = createOwnedTemporaryDirectory({ temporaryParent:
    path.join(repositoryRoot, "artifacts/tests/numerical-source-terminal-verifier") });
  const root = owned.rootPath;
  t.after(() => {
    removeOwnedTemporaryDirectory(owned);
    assert.equal(fs.existsSync(root), false);
  });
  const evidenceParent = path.join(root, "private-evidence");
  const sourceDirectory = path.join(root, "source");
  const compositionRoot = path.join(root, "composition");
  for (const directory of [evidenceParent, sourceDirectory, compositionRoot]) {
    fs.mkdirSync(directory);
  }

  const registrationBytes = fs.readFileSync(registrationPath);
  const registration = JSON.parse(registrationBytes.toString("utf8"));
  const registrationIdentity = {
    byteLength: registrationBytes.length,
    sha256: sha256(registrationBytes)
  };
  const names = registration.ownerContract.privateNames;
  const requestPath = path.join(evidenceParent, names.ownerRequestFileBasename);
  const registrationSource = {
    commit: "e6999eb44edfd3d76a71e0dc5c90f94912108e2a",
    tree: "0ce6a8f3c0baeea2db78aa683d4f7e95d51d8f74",
    branch: "codex/model-acquisition-v2",
    trackingRef: "origin/codex/model-acquisition-v2",
    remoteRef: "refs/remotes/origin/codex/model-acquisition-v2",
    fetchHeadExpected: true
  };
  const request = {
    schema: "tinyrustlm.qwen3_numerical_execution_request.v2",
    operationId,
    registration: {
      relativePath: "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v2.json",
      ...registrationIdentity
    },
    registrationSource,
    repositoryRoot,
    gitPath: process.execPath,
    evidenceParent,
    sourceDirectory,
    compositionRoot,
    executables: {
      pythonPath: process.execPath,
      nodePath: process.execPath,
      scalarPath: process.execPath,
      terminationPath: process.execPath
    }
  };
  writeCanonical(requestPath, request);
  const requestIdentity = identity(requestPath);

  const paths = {
    ownerEvidenceRoot: path.join(evidenceParent, names.ownerEvidenceRootBasename),
    sourceScratchRoot: path.join(evidenceParent, names.sourceScratchRootBasename),
    sourceOutputRoot: path.join(evidenceParent, names.sourceOutputRootBasename),
    reconstructedOutputRoot: path.join(evidenceParent,
      names.reconstructedOutputRootBasename),
    scalarOutputRoot: path.join(evidenceParent, names.scalarOutputRootBasename)
  };
  fs.mkdirSync(paths.ownerEvidenceRoot);
  fs.mkdirSync(paths.sourceScratchRoot);

  const childRequests = owner.childRequests({ registration, registrationIdentity,
    sourceDirectory, compositionRoot, evidenceParent }, paths);
  assert.deepEqual(Object.keys(childRequests.scalar).sort(), [
    "cases",
    "compositionResultSha256",
    "compositionRoot",
    "evidenceParent",
    "model",
    "operationId",
    "outputRoot",
    "policy",
    "schema",
    "traceProfileId"
  ]);
  assert.equal(Object.hasOwn(childRequests.scalar, "registrationSha256"), false);

  const expectedExecutables = registration.ownerContract.executables;
  const executablePaths = {
    git: request.gitPath,
    python: request.executables.pythonPath,
    node: request.executables.nodePath,
    scalar: request.executables.scalarPath,
    termination: request.executables.terminationPath
  };
  const executables = Object.fromEntries(Object.entries(expectedExecutables)
    .map(([role, value]) => [role, { path: executablePaths[role],
      byteLength: value.byteLength, sha256: value.sha256 }]));
  const rootNames = Object.fromEntries(Object.entries(paths)
    .map(([role, value]) => [role, path.basename(value)]));

  const files = registration.ownerContract.evidenceFiles;
  writeCanonical(path.join(paths.ownerEvidenceRoot, files.binding), {
    schema: "tinyrustlm.qwen3_numerical_execution_binding.v1",
    operationId,
    registration: registrationIdentity,
    registrationSource,
    ownerRequest: requestIdentity,
    executables,
    roots: rootNames,
    sourceDirectoryObserved: true,
    compositionRootObserved: true
  });
  writeCanonical(path.join(paths.ownerEvidenceRoot, files.start), {
    schema: "tinyrustlm.qwen3_numerical_execution_start.v1",
    operationId,
    startedAtUtc: "2026-08-26T18:00:00.000Z",
    stageOrder: ["source", "reconstructed", "scalar", "verifier"],
    launchLimitPerStage: 1,
    retryAllowed: false,
    outputRootsAbsentBeforeStart: true
  });
  writeCanonical(path.join(paths.ownerEvidenceRoot, files.sourceRequest),
    childRequests.source);
  writeCanonical(path.join(paths.ownerEvidenceRoot, files.reconstructedRequest),
    childRequests.reconstructed);
  writeCanonical(path.join(paths.ownerEvidenceRoot, files.scalarRequest),
    childRequests.scalar);

  const stdoutPath = path.join(paths.ownerEvidenceRoot, files.sourceStdout);
  const stderrPath = path.join(paths.ownerEvidenceRoot, files.sourceStderr);
  fs.writeFileSync(stdoutPath, Buffer.alloc(0), { flag: "wx" });
  fs.writeFileSync(stderrPath,
    Buffer.from(`qwen3-source-trace-error:${safeSourceCode}\r\n`, "utf8"),
    { flag: "wx" });
  const outcome = {
    stage: "source",
    startedAtUtc: "2026-08-26T18:00:01.000Z",
    finishedAtUtc: "2026-08-26T18:00:01.100Z",
    durationMilliseconds: 100,
    processStarted: true,
    exitCode: 1,
    signal: null,
    timedOut: false,
    killedForOverflow: false,
    spawnCode: null,
    streamCode: null,
    termination: { requested: false, method: null },
    stdout: { byteLength: 0, overflow: false,
      sha256: sha256(Buffer.alloc(0)) },
    stderr: { byteLength: fs.statSync(stderrPath).size, overflow: false,
      sha256: sha256(fs.readFileSync(stderrPath)) }
  };
  const sourceArguments = [path.join(repositoryRoot,
    "tinyrustlm", "tools", "qwen3-numerical-source-owner.py"),
  path.join(paths.ownerEvidenceRoot, files.sourceRequest)];
  const sourceExecutable = {
    byteLength: expectedExecutables.python.byteLength,
    sha256: expectedExecutables.python.sha256
  };
  writeCanonical(path.join(paths.ownerEvidenceRoot, files.sourceTerminal),
    owner.createProcessTerminal(operationId, "source", sourceExecutable,
      sourceExecutable, sourceArguments, outcome));

  const ownerTerminalPath = path.join(paths.ownerEvidenceRoot, files.ownerTerminal);
  writeCanonical(ownerTerminalPath, {
    schema: "tinyrustlm.qwen3_numerical_execution_terminal.v1",
    operationId,
    status: "terminal-failure",
    reasonCode: "source-process-not-pass",
    claim: "no-numerical-pass-claim",
    registration: registrationIdentity,
    registrationSource,
    ownerRequest: requestIdentity,
    launchedStages: ["source"],
    launchCounts: { source: 1, reconstructed: 0, scalar: 0, verifier: 0 },
    verifierReceipt: null,
    evidenceInventoryBeforeTerminal: evidenceInventory(paths.ownerEvidenceRoot),
    immutableClosure: {
      retryAllowed: false,
      overwriteAllowed: false,
      repairAllowed: false,
      partialOutputCleanupAllowed: false,
      thresholdChangeAllowed: false,
      failedOutputAdoptionAllowed: false
    },
    allowedClaim: "none",
    prohibitedClaims: ["optimized-native-parity", "browser-wasm-parity",
      "behavioral-quality", "p2p-availability", "site-release",
      "campaign-progress"]
  });

  return { root, requestPath, registration, paths, files, ownerTerminalPath,
    sourceTerminalPath: path.join(paths.ownerEvidenceRoot, files.sourceTerminal),
    scalarRequestPath: path.join(paths.ownerEvidenceRoot, files.scalarRequest),
    stderrPath };
}

test("verifies one source-stage terminal failure without writing evidence", (t) => {
  const value = fixture(t);
  const before = snapshot(value.paths.ownerEvidenceRoot);
  const result = verifier.verify(value.requestPath);
  const after = snapshot(value.paths.ownerEvidenceRoot);
  assert.deepEqual(after, before);
  assert.equal(result.verificationStatus, "pass");
  assert.equal(result.ownerStatus, "terminal-failure");
  assert.equal(result.sourceSafeCode, safeSourceCode);
  assert.equal(result.writesPerformed, false);
  assert.equal(result.allowedClaim, "none");
});

test("requires the exact two-field process executable identity shape", (t) => {
  const extra = fixture(t);
  const extraTerminal = JSON.parse(fs.readFileSync(extra.sourceTerminalPath, "utf8"));
  extraTerminal.executableBefore.basename = "python.exe";
  replaceCanonical(extra.sourceTerminalPath, extraTerminal);
  assert.throws(() => verifier.verify(extra.requestPath),
    (error) => error.code === "source-terminal-process-shape");

  const missing = fixture(t);
  const missingTerminal = JSON.parse(fs.readFileSync(missing.sourceTerminalPath, "utf8"));
  delete missingTerminal.executableAfter.sha256;
  replaceCanonical(missing.sourceTerminalPath, missingTerminal);
  assert.throws(() => verifier.verify(missing.requestPath),
    (error) => error.code === "source-terminal-process-shape");
});

test("rejects wrong or changed process executable identities", (t) => {
  const wrongLength = fixture(t);
  const wrongLengthTerminal = JSON.parse(
    fs.readFileSync(wrongLength.sourceTerminalPath, "utf8"));
  wrongLengthTerminal.executableBefore.byteLength += 1;
  replaceCanonical(wrongLength.sourceTerminalPath, wrongLengthTerminal);
  assert.throws(() => verifier.verify(wrongLength.requestPath),
    (error) => error.code === "source-terminal-process-binding");

  const wrongDigest = fixture(t);
  const wrongDigestTerminal = JSON.parse(
    fs.readFileSync(wrongDigest.sourceTerminalPath, "utf8"));
  wrongDigestTerminal.executableAfter.sha256 = "0".repeat(64);
  replaceCanonical(wrongDigest.sourceTerminalPath, wrongDigestTerminal);
  assert.throws(() => verifier.verify(wrongDigest.requestPath),
    (error) => error.code === "source-terminal-process-binding");

  const changed = fixture(t);
  const changedTerminal = JSON.parse(fs.readFileSync(changed.sourceTerminalPath, "utf8"));
  changedTerminal.executableAfter.sha256 = "f".repeat(64);
  changedTerminal.executableUnchanged = false;
  replaceCanonical(changed.sourceTerminalPath, changedTerminal);
  assert.throws(() => verifier.verify(changed.requestPath),
    (error) => error.code === "source-terminal-process-binding");
});

test("accepts the exact scalar request without inventing registrationSha256", (t) => {
  const value = fixture(t);
  assert.equal(verifier.verify(value.requestPath).verificationStatus, "pass");
  const scalar = JSON.parse(fs.readFileSync(value.scalarRequestPath, "utf8"));
  scalar.registrationSha256 = "0".repeat(64);
  replaceCanonical(value.scalarRequestPath, scalar);
  assert.throws(() => verifier.verify(value.requestPath),
    (error) => error.code === "source-terminal-scalar-request-shape");
});

test("rejects owner launch inflation and output-root creation", (t) => {
  const first = fixture(t);
  const terminal = JSON.parse(fs.readFileSync(first.ownerTerminalPath, "utf8"));
  terminal.launchCounts.scalar = 1;
  replaceCanonical(first.ownerTerminalPath, terminal);
  assert.throws(() => verifier.verify(first.requestPath),
    (error) => error.code === "source-terminal-owner-launches");

  const second = fixture(t);
  fs.mkdirSync(second.paths.sourceOutputRoot);
  assert.throws(() => verifier.verify(second.requestPath),
    (error) => error.code === "source-terminal-material-output-present");
});

test("rejects stream drift and an unexpected evidence member", (t) => {
  const first = fixture(t);
  fs.appendFileSync(first.stderrPath, "x");
  assert.throws(() => verifier.verify(first.requestPath),
    (error) => error.code === "source-terminal-stream-identity");

  const second = fixture(t);
  fs.writeFileSync(path.join(second.paths.ownerEvidenceRoot, "unexpected.bin"), "x");
  assert.throws(() => verifier.verify(second.requestPath),
    (error) => error.code === "source-terminal-evidence-inventory");
});

test("rejects request, process, and terminal identity drift", (t) => {
  const first = fixture(t);
  const source = JSON.parse(fs.readFileSync(first.sourceTerminalPath, "utf8"));
  source.outcome.exitCode = 0;
  replaceCanonical(first.sourceTerminalPath, source);
  assert.throws(() => verifier.verify(first.requestPath),
    (error) => error.code === "source-terminal-process-outcome");

  const second = fixture(t);
  const ownerTerminal = JSON.parse(fs.readFileSync(second.ownerTerminalPath, "utf8"));
  ownerTerminal.ownerRequest.sha256 = "0".repeat(64);
  replaceCanonical(second.ownerTerminalPath, ownerTerminal);
  assert.throws(() => verifier.verify(second.requestPath),
    (error) => error.code === "source-terminal-owner-binding");
});

test("CLI emits one canonical path-free verification summary", (t) => {
  const value = fixture(t);
  const toolPath = path.join(repositoryRoot, "tinyrustlm", "tools",
    "qwen3-numerical-source-terminal-verifier.js");
  const result = childProcess.spawnSync(process.execPath,
    [toolPath, "verify", value.requestPath], {
      cwd: repositoryRoot,
      encoding: "buffer",
      maxBuffer: 1024 * 1024,
      windowsHide: true
    });
  assert.equal(result.status, 0);
  assert.equal(result.stderr.length, 0);
  const parsed = JSON.parse(result.stdout.toString("utf8"));
  assert.deepEqual(result.stdout, verifier.canonicalJsonBytes(parsed));
  assert.equal(parsed.verificationStatus, "pass");
  assert.doesNotMatch(result.stdout.toString("utf8"), /[A-Z]:[\\/]/u);
  assert.doesNotMatch(result.stdout.toString("utf8"), /qwen3-source-trace-error:/u);
});

test("verifier source has no evidence writer, subprocess, network, or owner import", () => {
  const source = fs.readFileSync(path.join(repositoryRoot, "tinyrustlm", "tools",
    "qwen3-numerical-source-terminal-verifier.js"), "utf8");
  assert.doesNotMatch(source,
    /writeFile|appendFile|createWriteStream|mkdir|rmSync|unlink|rename|linkSync|symlink/u);
  assert.doesNotMatch(source, /child_process|fetch\s*\(|https?\.|net\.|dgram\./u);
  assert.doesNotMatch(source, /qwen3-numerical-execution-owner/u);
});

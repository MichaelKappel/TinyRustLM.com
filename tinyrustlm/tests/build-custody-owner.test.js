"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const { after, before, test } = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const templateOwnerPath = path.join(repositoryRoot, "tinyrustlm", "tools",
  "build-custody-owner.js");
const templateProfilePath = path.join(repositoryRoot, "contracts", "vnext",
  "build-custody-profile.v1.json");
const templateFixturePath = path.join(__dirname, "helpers",
  "build-custody-child-fixture.js");
const templateOwner = require(templateOwnerPath);
const isWindowsX64 = process.platform === "win32" && process.arch === "x64";
const evidenceFileNames = [
  "build.binding.json",
  "build.process-terminal.json",
  "build.start.json",
  "build.stderr.bin",
  "build.stdout.bin",
  "build.terminal.json"
];

let temporaryRoot;
let sourceRoot;
let copiedOwnerPath;
let copiedProfilePath;
let copiedFixturePath;
let owner;
let gitPath;
let gitArtifact;
let taskkillPath;
let taskkillArtifact;
let nodeArtifact;
let ownerArtifact;
let profileArtifact;
let sourceCommit;
let sourceTree;
let operationOrdinal = 0;

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function artifact(filePath, maximumBytes = 17_179_869_184) {
  return templateOwner.sha256File(filePath, maximumBytes, false);
}

function runGit(argumentsList) {
  return childProcess.execFileSync(gitPath, argumentsList, {
    cwd: sourceRoot,
    encoding: "utf8",
    env: process.env,
    windowsHide: true
  }).trim();
}

function locateGit() {
  const wherePath = path.join(process.env.SystemRoot, "System32", "where.exe");
  const candidates = childProcess.execFileSync(wherePath, ["git.exe"], {
    encoding: "utf8",
    windowsHide: true
  }).split(/\r?\n/u).filter(Boolean);
  assert.ok(candidates.length > 0);
  return path.resolve(candidates[0]);
}

function orderedEnvironment(entries = { SystemRoot: process.env.SystemRoot }) {
  return Object.entries(entries)
    .sort(([left], [right]) => left.toUpperCase().localeCompare(right.toUpperCase(), "en"))
    .map(([name, value]) => ({ name, value }));
}

function createOperation(options = {}) {
  operationOrdinal += 1;
  const operationParent = path.join(temporaryRoot,
    `operation-${String(operationOrdinal).padStart(3, "0")}`);
  fs.mkdirSync(operationParent);
  const controlRoot = path.resolve(operationParent, "control");
  const targetRoot = path.resolve(operationParent, "target");
  const mode = options.mode || "success";
  const commandPath = options.commandPath || process.execPath;
  const commandArtifact = options.commandArtifact || nodeArtifact;
  const required = options.required || [{
    relativePath: "artifact.bin",
    maximumByteLength: 1_048_576,
    kind: "regular-file"
  }];
  const request = {
    schema: "tinyrustlm.build-custody-request.v1",
    operationId: `build-custody-test/${String(operationOrdinal).padStart(3, "0")}`,
    profile: {
      path: copiedProfilePath,
      byteLength: profileArtifact.byteLength,
      sha256: profileArtifact.sha256,
      profileId: "tinyrustlm.source-controlled-build-custody/1"
    },
    source: {
      repositoryRoot: sourceRoot,
      commit: sourceCommit,
      tree: sourceTree,
      branch: "build-custody-test",
      gitPath,
      gitByteLength: gitArtifact.byteLength,
      gitSha256: gitArtifact.sha256,
      ownerPath: copiedOwnerPath,
      ownerByteLength: ownerArtifact.byteLength,
      ownerSha256: ownerArtifact.sha256
    },
    runtime: {
      nodePath: path.resolve(process.execPath),
      nodeByteLength: nodeArtifact.byteLength,
      nodeSha256: nodeArtifact.sha256,
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch
    },
    command: {
      executablePath: path.resolve(commandPath),
      executableByteLength: commandArtifact.byteLength,
      executableSha256: commandArtifact.sha256,
      arguments: options.arguments || [copiedFixturePath, targetRoot, mode,
        ...(options.fixtureArguments || [])],
      workingDirectory: sourceRoot,
      environment: orderedEnvironment(options.environment)
    },
    roots: { controlRoot, targetRoot },
    capture: {
      maximumDurationMilliseconds: options.maximumDurationMilliseconds || 10_000,
      maximumStdoutBytes: options.maximumStdoutBytes === undefined
        ? 1_048_576
        : options.maximumStdoutBytes,
      maximumStderrBytes: options.maximumStderrBytes === undefined
        ? 1_048_576
        : options.maximumStderrBytes
    },
    termination: {
      strategy: "windows-taskkill-tree-v1",
      executablePath: taskkillPath,
      executableByteLength: taskkillArtifact.byteLength,
      executableSha256: taskkillArtifact.sha256
    },
    outputs: {
      maximumEntryCount: options.maximumEntryCount || 64,
      maximumAggregateBytes: options.maximumAggregateBytes || 8_388_608,
      required
    }
  };
  const requestBytes = Buffer.from(canonicalJson(request), "utf8");
  const requestPath = path.resolve(operationParent, "request.json");
  fs.writeFileSync(requestPath, requestBytes, { flag: "wx" });
  return Object.freeze({
    operationParent,
    controlRoot,
    targetRoot,
    request,
    requestBytes,
    requestPath,
    requestSha256: sha256(requestBytes)
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function controlFiles(operation) {
  return fs.readdirSync(operation.controlRoot).sort();
}

async function waitForFile(filePath, maximumMilliseconds = 15_000) {
  const deadline = Date.now() + maximumMilliseconds;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Timed out waiting for ${path.basename(filePath)}`);
}

before(() => {
  if (!isWindowsX64) return;
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-build-custody-"));
  sourceRoot = path.resolve(temporaryRoot, "source");
  copiedOwnerPath = path.resolve(sourceRoot, "tinyrustlm", "tools",
    "build-custody-owner.js");
  copiedProfilePath = path.resolve(sourceRoot, "contracts", "vnext",
    "build-custody-profile.v1.json");
  copiedFixturePath = path.resolve(sourceRoot, "tinyrustlm", "tests", "helpers",
    "build-custody-child-fixture.js");
  for (const filePath of [copiedOwnerPath, copiedProfilePath, copiedFixturePath]) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  fs.copyFileSync(templateOwnerPath, copiedOwnerPath);
  fs.copyFileSync(templateProfilePath, copiedProfilePath);
  fs.copyFileSync(templateFixturePath, copiedFixturePath);

  gitPath = locateGit();
  taskkillPath = path.resolve(process.env.SystemRoot, "System32", "taskkill.exe");
  gitArtifact = artifact(gitPath);
  taskkillArtifact = artifact(taskkillPath);
  nodeArtifact = artifact(process.execPath);
  ownerArtifact = artifact(copiedOwnerPath);
  profileArtifact = artifact(copiedProfilePath);

  childProcess.execFileSync(gitPath, ["init", "--initial-branch=build-custody-test"], {
    cwd: sourceRoot,
    env: process.env,
    stdio: "ignore",
    windowsHide: true
  });
  runGit(["config", "user.email", "build-custody-test@invalid.example"]);
  runGit(["config", "user.name", "Build Custody Test"]);
  runGit(["add", "."]);
  runGit(["commit", "-m", "freeze build custody test source"]);
  sourceCommit = runGit(["rev-parse", "HEAD"]);
  sourceTree = runGit(["rev-parse", "HEAD^{tree}"]);
  owner = require(copiedOwnerPath);
});

after(() => {
  if (!temporaryRoot) return;
  const temporaryParent = path.resolve(os.tmpdir());
  const relative = path.relative(temporaryParent, temporaryRoot);
  assert.ok(relative.length > 0 && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`));
  assert.match(path.basename(temporaryRoot), /^tinyrustlm-build-custody-/u);
  fs.rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

test("freezes the sole prelaunch build-custody profile and owner identity", () => {
  const profileBytes = fs.readFileSync(templateProfilePath);
  assert.equal(profileBytes.length, 3407);
  assert.equal(sha256(profileBytes),
    "589883f42c1e047dfa6e132c8c4937c05d23b936ae1a6f62fe41c91b672a82fa");
  assert.equal(templateOwner.profileByteLength, profileBytes.length);
  assert.equal(templateOwner.profileSha256, sha256(profileBytes));
  const profile = JSON.parse(profileBytes.toString("utf8"));
  assert.equal(profile.profileId, "tinyrustlm.source-controlled-build-custody/1");
  assert.equal(profile.authority.legacySupport, false);
  assert.equal(profile.authority.retry, false);
  assert.equal(profile.processPolicy.workerEnvironment,
    "system-root-derived-only-no-caller-environment");
  assert.equal(profile.processPolicy.environmentLaunch,
    "dedicated-owner-clears-ambient-during-process-create-then-restores");
  assert.equal(profile.limits.maximumTargetEntries, 131072);
});

test("rejects reordered, unknown, and noncanonical request material", {
  skip: !isWindowsX64
}, () => {
  const operation = createOperation();
  const reordered = {
    operationId: operation.request.operationId,
    schema: operation.request.schema,
    profile: operation.request.profile,
    source: operation.request.source,
    runtime: operation.request.runtime,
    command: operation.request.command,
    roots: operation.request.roots,
    capture: operation.request.capture,
    termination: operation.request.termination,
    outputs: operation.request.outputs
  };
  assert.throws(() => owner.validateRequestShape(reordered),
    /build-custody-request-fields/u);
  assert.throws(() => owner.validateRequestShape({ ...operation.request, extra: true }),
    /build-custody-request-fields/u);
  const compactPath = path.join(operation.operationParent, "compact.json");
  fs.writeFileSync(compactPath, JSON.stringify(operation.request), { flag: "wx" });
  assert.throws(() => owner.prepareRequest(path.resolve(compactPath)),
    /build-custody-request-json/u);
  assert.equal(fs.existsSync(operation.controlRoot), false);
  assert.equal(fs.existsSync(operation.targetRoot), false);
});

test("preflight is read-only and binds exact source, Git, Node, command, and taskkill bytes", {
  skip: !isWindowsX64
}, () => {
  const operation = createOperation();
  const prepared = owner.prepareRequest(operation.requestPath);
  assert.equal(prepared.requestDocument.artifact.sha256, operation.requestSha256);
  assert.deepEqual(prepared.source.gitArtifact, gitArtifact);
  assert.deepEqual(prepared.runtimeArtifact, nodeArtifact);
  assert.deepEqual(prepared.commandArtifact, nodeArtifact);
  assert.deepEqual(prepared.terminationArtifact, taskkillArtifact);
  assert.deepEqual(Object.keys(prepared.environment), ["SystemRoot"]);
  assert.equal(fs.existsSync(operation.controlRoot), false);
  assert.equal(fs.existsSync(operation.targetRoot), false);
});

test("captures zero exit before diagnostics and inventories one exact required output", {
  skip: !isWindowsX64
}, async () => {
  const operation = createOperation();
  const result = await owner.runWorker(operation.requestPath, operation.requestSha256);
  assert.equal(result.terminal.status, "pass");
  assert.equal(result.terminal.code, "build-custody-pass");
  assert.deepEqual(controlFiles(operation), evidenceFileNames);
  const processTerminal = readJson(path.join(operation.controlRoot,
    "build.process-terminal.json"));
  assert.equal(processTerminal.event, "exit");
  assert.equal(processTerminal.exitCode, 0);
  assert.equal(processTerminal.exitTimeMetadataQueried, false);
  assert.equal(result.terminal.closeOutcome.exitCode, 0);
  assert.equal(result.terminal.finalCapture.stdoutOverflow, false);
  assert.equal(result.terminal.identities.sourceControl.sha256, gitArtifact.sha256);
  assert.equal(result.terminal.target.entryCount, 1);
  assert.equal(result.terminal.target.fileCount, 1);
  assert.equal(result.terminal.target.directoryCount, 0);
  assert.equal(result.terminal.target.required[0].sha256,
    sha256(Buffer.from("custodied-build-output", "utf8")));
  assert.equal(fs.readFileSync(path.join(operation.controlRoot, "build.stdout.bin"),
    "utf8"), "fixture-stdout");
  assert.equal(fs.readFileSync(path.join(operation.controlRoot, "build.stderr.bin"),
    "utf8"), "fixture-stderr");
  assert.deepEqual(readJson(path.join(operation.controlRoot, "build.binding.json"))
    .workerEnvironmentNames, ["SystemRoot"]);
});

test("preserves a nonzero child as a terminal build failure without output adoption", {
  skip: !isWindowsX64
}, async () => {
  const operation = createOperation({ mode: "nonzero" });
  const result = await owner.runWorker(operation.requestPath, operation.requestSha256);
  assert.equal(result.terminal.status, "terminal-build-failure");
  assert.equal(result.terminal.code, "build-custody-child-nonzero");
  assert.equal(result.terminal.processTerminal.outcome.exitCode, 23);
  assert.equal(result.terminal.target, null);
  assert.equal(result.terminal.retryAllowed, false);
  assert.deepEqual(controlFiles(operation), evidenceFileNames);
});

test("detects stdout overflow even when final pipe state follows the exit event", {
  skip: !isWindowsX64
}, async () => {
  const operation = createOperation({
    mode: "stdout-overflow",
    fixtureArguments: ["4096"],
    maximumStdoutBytes: 32
  });
  const result = await owner.runWorker(operation.requestPath, operation.requestSha256);
  assert.equal(result.terminal.status, "terminal-build-failure");
  assert.equal(result.terminal.code, "build-custody-stdout-overflow");
  assert.equal(result.terminal.finalCapture.stdoutOverflow, true);
  assert.equal(result.terminal.stdout.byteLength, 33);
  assert.equal(result.terminal.stdout.overflow, true);
  assert.equal(result.terminal.target, null);
});

test("kills a timed-out Windows process tree before its grandchild can mutate evidence", {
  skip: !isWindowsX64
}, async () => {
  const markerPath = path.join(temporaryRoot, `grandchild-${operationOrdinal + 1}.marker`);
  const operation = createOperation({
    mode: "timeout-tree",
    fixtureArguments: [markerPath, "1800"],
    maximumDurationMilliseconds: 300
  });
  const result = await owner.runWorker(operation.requestPath, operation.requestSha256);
  assert.equal(result.terminal.status, "terminal-build-failure");
  assert.equal(result.terminal.code, "build-custody-timeout");
  assert.equal(result.terminal.finalCapture.timedOut, true);
  assert.equal(result.terminal.finalCapture.termination.attempted, true);
  assert.equal(result.terminal.finalCapture.termination.helperStatus, 0);
  await new Promise((resolve) => setTimeout(resolve, 2100));
  assert.equal(fs.existsSync(markerPath), false);
});

test("records a spawn failure without inventing a process exit", {
  skip: !isWindowsX64
}, async () => {
  const operation = createOperation();
  const syntheticSpawn = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => false;
    process.nextTick(() => {
      child.emit("error", new Error("synthetic-spawn-failure"));
      child.stdout.end();
      child.stderr.end();
      child.emit("close", null, null);
    });
    return child;
  };
  const result = await owner.runWorker(operation.requestPath, operation.requestSha256, {
    spawn: syntheticSpawn
  });
  assert.equal(result.terminal.status, "terminal-build-failure");
  assert.equal(result.terminal.code, "build-custody-spawn-failure");
  assert.equal(result.terminal.processTerminal.outcome.processStarted, false);
  assert.equal(result.terminal.processTerminal.outcome.event, "spawn-error");
  assert.equal(result.terminal.processTerminal.outcome.exitCode, null);
});

test("keeps zero exit durable when optional ExitTime-style diagnostics fail", {
  skip: !isWindowsX64
}, async () => {
  const operation = createOperation();
  const result = await owner.runWorker(operation.requestPath, operation.requestSha256, {
    collectOptionalDiagnostics() {
      throw new Error("build-custody-exit-time-unavailable");
    }
  });
  assert.equal(result.terminal.status, "terminal-custody-failure");
  assert.equal(result.terminal.code, "build-custody-exit-time-unavailable");
  assert.equal(result.terminal.processTerminal.outcome.exitCode, 0);
  assert.equal(result.terminal.processTerminal.outcome.exitTimeMetadataQueried, false);
  assert.equal(result.terminal.optionalDiagnostics.collected, false);
  assert.equal(result.terminal.target, null);
  assert.deepEqual(controlFiles(operation), evidenceFileNames);
});

test("fails closed on a missing required output and on an entry-count overflow", {
  skip: !isWindowsX64
}, async () => {
  const missing = createOperation({ mode: "missing-output" });
  const missingResult = await owner.runWorker(missing.requestPath, missing.requestSha256);
  assert.equal(missingResult.terminal.status, "terminal-custody-failure");
  assert.equal(missingResult.terminal.code, "build-custody-file-invalid");
  assert.equal(missingResult.terminal.processTerminal.outcome.exitCode, 0);

  const entries = createOperation({
    mode: "many-entries",
    fixtureArguments: ["5"],
    maximumEntryCount: 3
  });
  const entryResult = await owner.runWorker(entries.requestPath, entries.requestSha256);
  assert.equal(entryResult.terminal.status, "terminal-custody-failure");
  assert.equal(entryResult.terminal.code, "build-custody-target-entry-limit");
  assert.equal(entryResult.terminal.processTerminal.outcome.exitCode, 0);
});

test("does not inherit an unrequested environment variable into the build child", {
  skip: !isWindowsX64
}, async () => {
  const inheritedName = "TINYRUSTLM_UNREQUESTED_BUILD_CUSTODY_SENTINEL";
  const prior = process.env[inheritedName];
  process.env[inheritedName] = "must-not-cross-boundary";
  try {
    const operation = createOperation({
      mode: "environment",
      environment: {
        BUILD_CUSTODY_ALLOWED: "yes",
        SystemRoot: process.env.SystemRoot
      },
      required: [{
        relativePath: "environment.json",
        maximumByteLength: 4096,
        kind: "regular-file"
      }]
    });
    const result = await owner.runWorker(operation.requestPath, operation.requestSha256);
    assert.equal(result.terminal.status, "pass");
    const names = JSON.parse(fs.readFileSync(path.join(operation.targetRoot,
      "environment.json"), "utf8"));
    assert.deepEqual(names, ["BUILD_CUSTODY_ALLOWED", "SystemRoot"]);
    assert.equal(names.includes(inheritedName), false);
  } finally {
    if (prior === undefined) delete process.env[inheritedName];
    else process.env[inheritedName] = prior;
  }
});

test("validates an exact x64 PE output only after the zero exit is durable", {
  skip: !isWindowsX64
}, async () => {
  const operation = createOperation({
    mode: "copy-pe",
    fixtureArguments: [taskkillPath],
    maximumAggregateBytes: 2_097_152,
    required: [{
      relativePath: "artifact.exe",
      maximumByteLength: 2_097_152,
      kind: "pe-x64"
    }]
  });
  const result = await owner.runWorker(operation.requestPath, operation.requestSha256);
  assert.equal(result.terminal.status, "pass");
  assert.equal(result.terminal.processTerminal.outcome.exitCode, 0);
  assert.equal(result.terminal.target.required[0].peMachine, "0x8664");
  assert.equal(result.terminal.target.required[0].sha256, taskkillArtifact.sha256);
});

test("refuses existing roots and never overwrites a colliding final terminal", {
  skip: !isWindowsX64
}, async () => {
  const existingRoot = createOperation();
  fs.mkdirSync(existingRoot.controlRoot);
  assert.throws(() => owner.prepareRequest(existingRoot.requestPath),
    /build-custody-control-root-exists/u);
  assert.equal(fs.existsSync(existingRoot.targetRoot), false);

  const terminalCollision = createOperation();
  const collisionBytes = Buffer.from("preexisting-terminal-collision", "utf8");
  await assert.rejects(owner.runWorker(terminalCollision.requestPath,
    terminalCollision.requestSha256, {
      beforeFinal() {
        fs.writeFileSync(path.join(terminalCollision.controlRoot, "build.terminal.json"),
          collisionBytes, { flag: "wx" });
      }
    }), /EEXIST/u);
  assert.deepEqual(fs.readFileSync(path.join(terminalCollision.controlRoot,
    "build.terminal.json")), collisionBytes);
  assert.equal(fs.existsSync(path.join(terminalCollision.controlRoot,
    "build.process-terminal.json")), true);
});

test("a detached owner completes after its CLI observer is forcibly terminated", {
  skip: !isWindowsX64
}, async () => {
  const operation = createOperation({
    mode: "delayed-success",
    fixtureArguments: ["1400"]
  });
  const observerEnvironment = {
    ...process.env,
    TINYRUSTLM_CALLER_ONLY_SENTINEL: "must-not-enter-detached-worker"
  };
  const cli = childProcess.spawn(process.execPath,
    [copiedOwnerPath, "execute", operation.requestPath], {
      env: observerEnvironment,
      shell: false,
      stdio: "ignore",
      windowsHide: true
    });
  const observerClosed = new Promise((resolve) => cli.once("close", resolve));
  await waitForFile(path.join(operation.controlRoot, "build.start.json"));
  assert.equal(cli.kill("SIGKILL"), true);
  await observerClosed;
  await waitForFile(path.join(operation.controlRoot, "build.terminal.json"));
  const terminal = readJson(path.join(operation.controlRoot, "build.terminal.json"));
  assert.equal(terminal.status, "pass");
  assert.equal(terminal.processTerminal.outcome.exitCode, 0);
  assert.equal(fs.readFileSync(path.join(operation.targetRoot, "artifact.bin"), "utf8"),
    "detached-owner-completed");
  const observed = childProcess.spawnSync(process.execPath,
    [copiedOwnerPath, "observe", operation.requestPath], {
      env: { SystemRoot: process.env.SystemRoot },
      encoding: "utf8",
      shell: false,
      windowsHide: true
    });
  assert.equal(observed.status, 0, observed.stderr);
  assert.equal(JSON.parse(observed.stdout).status, "pass");
});

"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const materializerPath = path.join(repositoryRoot, "tinyrustlm", "tools",
  "build-custody-request-materializer.js");
const materializer = require(materializerPath);
const custodyOwner = require(path.join(repositoryRoot, "tinyrustlm", "tools",
  "build-custody-owner.js"));
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "build-custody-request-materializer-profile.v1.json");
const custodyProfilePath = path.join(repositoryRoot, "contracts", "vnext",
  "build-custody-profile.v4.json");
const environmentOwnerPath = path.join(repositoryRoot, "tinyrustlm", "tools",
  "windows-x64-msvc-environment.js");
const environmentProfilePath = path.join(repositoryRoot, "contracts", "vnext",
  "windows-x64-msvc-environment-profile.v1.json");
const scratchProfilePath = path.join(repositoryRoot, "contracts", "vnext",
  "build-scratch-inspector-profile.v1.json");
const custodyOwnerPath = path.join(repositoryRoot, "tinyrustlm", "tools",
  "build-custody-owner.js");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function artifact(filePath) {
  const bytes = fs.readFileSync(filePath);
  return Object.freeze({
    path: path.resolve(filePath),
    byteLength: bytes.length,
    sha256: sha256(bytes)
  });
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeNew(filePath, bytes) {
  fs.writeFileSync(filePath, bytes, { flag: "wx" });
}

function createIntent(root) {
  const environmentFiles = {};
  for (const name of ["request", "privateBinding", "publicLock", "terminal"]) {
    const filePath = path.resolve(root, `environment-${name}.json`);
    writeNew(filePath, Buffer.from(`${name} evidence`, "utf8"));
    environmentFiles[name] = artifact(filePath);
  }
  const sourceOwner = artifact(custodyOwnerPath);
  const node = artifact(process.execPath);
  const supplementalEnvironment = [
    ["APPDATA", path.resolve(root, "environment", "home", "AppData", "Roaming")],
    ["HOMEDRIVE", path.parse(root).root.slice(0, 2) || "/"],
    ["HOMEPATH", path.resolve(root, "environment", "home")],
    ["LOCALAPPDATA", path.resolve(root, "environment", "home", "AppData", "Local")],
    ["LOGONSERVER", "\\\\LOCALHOST"],
    ["SYSTEMDRIVE", path.parse(root).root.slice(0, 2) || "/"],
    ["SystemRoot", path.resolve(root, "system")],
    ["TEMP", path.resolve(root, "environment", "temp")],
    ["TMP", path.resolve(root, "environment", "temp")],
    ["USERDOMAIN", "LOCAL"],
    ["USERNAME", "tinyrustlm"],
    ["USERPROFILE", path.resolve(root, "environment", "home")],
    ["WINDIR", path.resolve(root, "system")]
  ].map(([name, value]) => ({ name, value }));
  return {
    schema: materializer.intentSchema,
    operationId: "request-materializer-test/001",
    profile: {
      ...artifact(custodyProfilePath),
      profileId: "tinyrustlm.source-controlled-build-custody/4"
    },
    source: {
      repositoryRoot,
      commit: "1".repeat(40),
      tree: "2".repeat(40),
      branch: "request-materializer-test",
      git: node,
      owner: sourceOwner
    },
    runtime: {
      node,
      nodeVersion: process.version,
      platform: "win32",
      architecture: "x64"
    },
    environmentAuthority: {
      owner: artifact(environmentOwnerPath),
      profile: {
        ...artifact(environmentProfilePath),
        profileId: "tinyrustlm.windows-x64-msvc-environment/1"
      },
      request: environmentFiles.request,
      privateBinding: environmentFiles.privateBinding,
      publicLock: environmentFiles.publicLock,
      terminal: environmentFiles.terminal
    },
    scratchInspection: {
      profile: {
        ...artifact(scratchProfilePath),
        profileId: "tinyrustlm.build-scratch-inspection/1"
      },
      executableRelativePath: "scratch-inspector.exe",
      operationId: "request-materializer-test/scratch-001",
      maximumDurationMilliseconds: 10000,
      maximumStdoutBytes: 1048576
    },
    command: {
      executable: node,
      arguments: ["--version"],
      workingDirectory: repositoryRoot,
      supplementalEnvironment
    },
    roots: {
      controlRoot: path.resolve(root, "control"),
      targetRoot: path.resolve(root, "target"),
      environmentRoot: path.resolve(root, "environment")
    },
    capture: {
      maximumDurationMilliseconds: 10000,
      maximumStdoutBytes: 1048576,
      maximumStderrBytes: 1048576
    },
    termination: {
      strategy: "windows-taskkill-tree-v1",
      executable: node
    },
    outputs: {
      maximumEntryCount: 64,
      maximumAggregateBytes: 8388608,
      maximumEnvironmentEntryCount: 64,
      maximumEnvironmentAggregateBytes: 8388608,
      maximumEnvironmentJunctionCount: 16,
      required: [{
        relativePath: "scratch-inspector.exe",
        maximumByteLength: 1048576,
        kind: "pe-x64"
      }]
    }
  };
}

function withRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-request-materializer-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true,
    maxRetries: 5, retryDelay: 50 }));
  return path.resolve(root);
}

test("freezes the sole request-materializer profile and authority", () => {
  const ownerBytes = fs.readFileSync(materializerPath);
  assert.equal(ownerBytes.length, 14781);
  assert.equal(sha256(ownerBytes),
    "cfdcf78000a9a60158c1fe4a227a8ebea4a1a2e99d71484a57b045bc9dff10b1");
  const bytes = fs.readFileSync(profilePath);
  assert.equal(bytes.length, 6327);
  assert.equal(sha256(bytes),
    "450e1300eb80fe15bcb058713a16fd517a7f4206a4ef420995ac0ea4f4cae041");
  assert.equal(bytes.toString("utf8"), canonicalJson(JSON.parse(bytes.toString("utf8"))));
  assert.equal(materializer.profileByteLength, bytes.length);
  assert.equal(materializer.profileSha256, sha256(bytes));
  const profile = materializer.validateProfile().value;
  assert.equal(profile.profileId, "tinyrustlm.build-custody-request-materializer/1");
  assert.equal(profile.authority.adHocTransformation, false);
  assert.equal(profile.materialization.pureNamedMappingBeforeWrite, true);
  assert.equal(profile.materialization.recursiveStringReplacement, false);
  assert.equal(profile.failurePolicy.automaticRetry, false);
  assert.equal(profile.claimBoundary.custodyPreflightPassed, false);
});

test("maps nested Git owner runtime command and termination artifacts exactly", (t) => {
  const root = withRoot(t);
  const intent = createIntent(root);
  const request = materializer.buildRequest(intent);
  assert.equal(request.schema, custodyOwner.requestSchema);
  assert.deepEqual(request.source, {
    repositoryRoot: intent.source.repositoryRoot,
    commit: intent.source.commit,
    tree: intent.source.tree,
    branch: intent.source.branch,
    gitPath: intent.source.git.path,
    gitByteLength: intent.source.git.byteLength,
    gitSha256: intent.source.git.sha256,
    ownerPath: intent.source.owner.path,
    ownerByteLength: intent.source.owner.byteLength,
    ownerSha256: intent.source.owner.sha256
  });
  assert.equal(Object.hasOwn(request.source, "byteLength"), false);
  assert.equal(Object.hasOwn(request.source, "sha256"), false);
  assert.deepEqual(request.runtime, {
    nodePath: intent.runtime.node.path,
    nodeByteLength: intent.runtime.node.byteLength,
    nodeSha256: intent.runtime.node.sha256,
    nodeVersion: intent.runtime.nodeVersion,
    platform: intent.runtime.platform,
    architecture: intent.runtime.architecture
  });
  assert.equal(request.command.executablePath, intent.command.executable.path);
  assert.equal(request.termination.executablePath, intent.termination.executable.path);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.command.arguments), true);
  assert.equal(Object.isFrozen(request.outputs.required), true);
});

test("preserves the execution /11 malformed source shape as an exact rejection", (t) => {
  const root = withRoot(t);
  for (const field of ["byteLength", "sha256"]) {
    const caseRoot = path.resolve(root, field);
    fs.mkdirSync(caseRoot);
    const intent = createIntent(caseRoot);
    intent.source[field] = field === "byteLength" ? 103310 : "3".repeat(64);
    assert.throws(() => materializer.buildRequest(intent),
      /request-materializer-intent-source-fields/u, field);
  }
});

test("rejects unknown nested fields reordered input and stale output profile identity", (t) => {
  const root = withRoot(t);
  const nestedRoot = path.resolve(root, "nested");
  fs.mkdirSync(nestedRoot);
  const nested = createIntent(nestedRoot);
  nested.source.owner = {
    path: nested.source.owner.path,
    byteLength: nested.source.owner.byteLength,
    sha256: nested.source.owner.sha256,
    extra: true
  };
  assert.throws(() => materializer.buildRequest(nested),
    /request-materializer-intent-source-owner-fields/u);

  const reorderedRoot = path.resolve(root, "reordered");
  fs.mkdirSync(reorderedRoot);
  const valid = createIntent(reorderedRoot);
  const reordered = {
    operationId: valid.operationId,
    schema: valid.schema,
    profile: valid.profile,
    source: valid.source,
    runtime: valid.runtime,
    environmentAuthority: valid.environmentAuthority,
    scratchInspection: valid.scratchInspection,
    command: valid.command,
    roots: valid.roots,
    capture: valid.capture,
    termination: valid.termination,
    outputs: valid.outputs
  };
  assert.throws(() => materializer.buildRequest(reordered),
    /request-materializer-intent-fields/u);

  const staleRoot = path.resolve(root, "stale");
  fs.mkdirSync(staleRoot);
  const stale = createIntent(staleRoot);
  stale.profile.sha256 = "4".repeat(64);
  assert.throws(() => materializer.buildRequest(stale),
    /build-custody-profile-hash/u);
});

test("writes one canonical request create-only and returns bounded nonclaim summary", (t) => {
  const root = withRoot(t);
  const intent = createIntent(root);
  const intentPath = path.resolve(root, "intent.json");
  const outputPath = path.resolve(root, "request.json");
  writeNew(intentPath, Buffer.from(canonicalJson(intent), "utf8"));
  const summary = materializer.materialize(intentPath, outputPath);
  const requestBytes = fs.readFileSync(outputPath);
  const request = JSON.parse(requestBytes.toString("utf8"));
  assert.equal(requestBytes.toString("utf8"), canonicalJson(request));
  assert.equal(requestBytes.length, summary.request.byteLength);
  assert.equal(sha256(requestBytes), summary.request.sha256);
  assert.equal(summary.status, "pass");
  assert.equal(summary.code, "build-custody-request-materialized");
  assert.equal(summary.outputBasename, "request.json");
  assert.equal(summary.outputPrivatePathPublished, false);
  assert.equal(summary.custodyPreflightPassed, false);
  assert.equal(summary.custodyExecuted, false);
  assert.equal(summary.retryAllowed, false);
  assert.equal(summary.campaignCreditAuthorized, false);
  assert.throws(() => materializer.materialize(intentPath, outputPath),
    /request-materializer-output-exists/u);
  assert.equal(fs.readFileSync(outputPath).equals(requestBytes), true);
});

test("rejects noncanonical intent before output creation", (t) => {
  const root = withRoot(t);
  const intent = createIntent(root);
  const intentPath = path.resolve(root, "compact-intent.json");
  const outputPath = path.resolve(root, "request.json");
  writeNew(intentPath, Buffer.from(JSON.stringify(intent), "utf8"));
  assert.throws(() => materializer.materialize(intentPath, outputPath),
    /request-materializer-intent-json/u);
  assert.equal(fs.existsSync(outputPath), false);
});

test("CLI emits a canonical path-free summary and bounded typed failure", (t) => {
  const root = withRoot(t);
  const intent = createIntent(root);
  const intentPath = path.resolve(root, "intent.json");
  const outputPath = path.resolve(root, "request.json");
  writeNew(intentPath, Buffer.from(canonicalJson(intent), "utf8"));

  const success = childProcess.spawnSync(process.execPath, [materializerPath,
    "materialize", intentPath, outputPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(success.stderr, "");
  const summary = JSON.parse(success.stdout);
  assert.equal(success.stdout, canonicalJson(summary));
  assert.equal(summary.outputBasename, "request.json");
  assert.equal(summary.outputPrivatePathPublished, false);
  assert.equal(success.stdout.includes(root), false);
  assert.equal(summary.custodyPreflightPassed, false);

  const rejection = childProcess.spawnSync(process.execPath, [materializerPath,
    "materialize", intentPath, outputPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(rejection.status, 1);
  assert.equal(rejection.stdout, "");
  const error = JSON.parse(rejection.stderr);
  assert.equal(rejection.stderr, canonicalJson(error));
  assert.equal(error.code, "request-materializer-output-exists");
  assert.equal(error.retryAllowed, false);
  assert.equal(error.campaignCreditAuthorized, false);
  assert.equal(rejection.stderr.includes(root), false);
});

test("contains no recursive replacement spread assignment retry or repair route", () => {
  const source = fs.readFileSync(materializerPath, "utf8");
  assert.doesNotMatch(source, /replaceAll|Object\.assign|\.\.\./u);
  assert.match(source, /custodyOwner\.validateRequestShape\(request\)/u);
  assert.match(source, /custodyOwner\.writeNewDurable/u);
  assert.match(source, /outputPrivatePathPublished: false/u);
  assert.match(source, /custodyPreflightPassed: false/u);
});

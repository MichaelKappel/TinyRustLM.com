"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const { after, before, test } = require("node:test");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");
const { requireCanonicalArtifactPath } = require("../tools/canonical-operation-scratch.js");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const templateOwnerPath = path.join(repositoryRoot, "tinyrustlm", "tools",
  "build-custody-owner.js");
const templateRequestMaterializerPath = path.join(repositoryRoot, "tinyrustlm", "tools",
  "build-custody-request-materializer.js");
const templateProfilePath = path.join(repositoryRoot, "contracts", "vnext",
  "build-custody-profile.v4.json");
const templateScratchInspectionProfilePath = path.join(repositoryRoot, "contracts", "vnext",
  "build-scratch-inspector-profile.v1.json");
const templateScratchInspectorPath = path.join(
  resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR), "debug",
  "tinyrustlm-build-scratch-inspect.exe");
const templateEnvironmentOwnerPath = path.join(repositoryRoot, "tinyrustlm", "tools",
  "windows-x64-msvc-environment.js");
const templateEnvironmentProfilePath = path.join(repositoryRoot, "contracts", "vnext",
  "windows-x64-msvc-environment-profile.v1.json");
const templateFixturePath = path.join(__dirname, "helpers",
  "build-custody-child-fixture.js");
const templateOwner = require(templateOwnerPath);
const requestMaterializer = require(templateRequestMaterializerPath);
const isWindowsX64 = process.platform === "win32" && process.arch === "x64";
const baseEvidenceFileNames = [
  "build.binding.json",
  "build.process-terminal.json",
  "build.start.json",
  "build.stderr.bin",
  "build.stdout.bin",
  "build.terminal.json"
];
const completeEvidenceFileNames = [
  "build.binding.json",
  "build.process-terminal.json",
  "build.scratch-inspection.process-terminal.json",
  "build.scratch-inspection.request.json",
  "build.scratch-inspection.stderr.bin",
  "build.scratch-inspection.stdout.bin",
  "build.start.json",
  "build.stderr.bin",
  "build.stdout.bin",
  "build.terminal.json"
];
const temporaryRootPrefix = "tinyrustlm-build-custody-";
const temporaryOwnershipMarkerName =
  ".tinyrustlm-build-custody-test-root.json";
const temporaryOwnershipSchema =
  "tinyrustlm.test-owned-build-custody-root.v1";

let temporaryParent;
let temporaryRoot;
let temporaryOwnershipBytes;
let sourceRoot;
let copiedOwnerPath;
let copiedProfilePath;
let copiedScratchInspectionProfilePath;
let copiedScratchInspectorPath;
let copiedEnvironmentOwnerPath;
let copiedEnvironmentProfilePath;
let copiedFixturePath;
let owner;
let environmentTool;
let gitPath;
let gitArtifact;
let taskkillPath;
let taskkillArtifact;
let nodeArtifact;
let ownerArtifact;
let profileArtifact;
let scratchInspectionProfileArtifact;
let scratchInspectorArtifact;
let environmentOwnerArtifact;
let environmentProfileArtifact;
let sourceCommit;
let sourceTree;
let operationOrdinal = 0;
let environmentOrdinal = 0;
const environmentFixtures = new WeakMap();
const msvcTools = ["cl.exe", "dumpbin.exe", "lib.exe", "link.exe", "ml64.exe"];
const sdkTools = ["mt.exe", "rc.exe"];
const msvcLibraries = ["libcmt.lib", "libvcruntime.lib", "oldnames.lib",
  "vcruntime.lib"];
const ucrtLibraries = ["libucrt.lib", "ucrt.lib"];
const umLibraries = ["advapi32.lib", "bcrypt.lib", "kernel32.lib", "ntdll.lib",
  "userenv.lib", "ws2_32.lib"];

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Keep bounded test fixtures inside canonical artifacts, never a retired source root. */
function buildCustodyTemporaryParent() {
  return requireCanonicalArtifactPath(path.join(repositoryRoot, "artifacts", "tests",
    "build-custody"));
}

function assertDirectDirectory(candidate, label) {
  const stat = fs.lstatSync(candidate);
  assert.equal(stat.isDirectory(), true, label);
  assert.equal(stat.isSymbolicLink(), false, label);
  assert.equal(fs.realpathSync.native(candidate), path.resolve(candidate), label);
}

function preflightNoStaleBuildCustodyRoots(parent) {
  assertDirectDirectory(parent, "build custody temporary parent");
  const stale = fs.readdirSync(parent, { withFileTypes: true }).filter((entry) =>
    entry.name.startsWith(temporaryRootPrefix));
  assert.equal(stale.length, 0,
    "stale owned build-custody test root requires exact cleanup");
}

function removeOwnedBuildCustodyRoot() {
  if (!temporaryRoot) return;
  const resolvedParent = path.resolve(temporaryParent);
  const resolvedRoot = path.resolve(temporaryRoot);
  const relative = path.relative(resolvedParent, resolvedRoot);
  assert.equal(path.dirname(resolvedRoot), resolvedParent,
    "build custody temporary root must be a direct child");
  assert.ok(relative.length > 0 && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    "build custody temporary root containment");
  assert.match(path.basename(resolvedRoot),
    /^tinyrustlm-build-custody-[A-Za-z0-9_-]+$/u);
  assertDirectDirectory(resolvedParent, "build custody temporary parent");
  assertDirectDirectory(resolvedRoot, "build custody temporary root");
  const markerPath = path.join(resolvedRoot, temporaryOwnershipMarkerName);
  const markerStat = fs.lstatSync(markerPath);
  assert.equal(markerStat.isFile(), true, "build custody ownership marker");
  assert.equal(markerStat.isSymbolicLink(), false,
    "build custody ownership marker");
  assert.equal(fs.realpathSync.native(markerPath), path.resolve(markerPath),
    "build custody ownership marker");
  assert.ok(markerStat.size > 0 && markerStat.size <= 1024,
    "build custody ownership marker bound");
  assert.deepEqual(fs.readFileSync(markerPath), temporaryOwnershipBytes,
    "build custody ownership marker identity");
  fs.rmSync(resolvedRoot, {
    force: false,
    maxRetries: 5,
    recursive: true,
    retryDelay: 50
  });
  assert.equal(fs.existsSync(resolvedRoot), false,
    "build custody temporary root removal");
  temporaryRoot = undefined;
  temporaryOwnershipBytes = undefined;
}

function artifact(filePath, maximumBytes = 17_179_869_184) {
  return templateOwner.sha256File(filePath, maximumBytes, false);
}

function artifactReference(filePath, maximumBytes = 17_179_869_184) {
  return Object.freeze({ path: path.resolve(filePath), ...artifact(filePath, maximumBytes) });
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

function locateCargo() {
  const wherePath = path.join(process.env.SystemRoot, "System32", "where.exe");
  const candidates = childProcess.execFileSync(wherePath, ["cargo.exe"], {
    encoding: "utf8",
    windowsHide: true
  }).split(/\r?\n/u).filter(Boolean);
  assert.ok(candidates.length > 0);
  return path.resolve(candidates[0]);
}

function orderedEnvironment(entries) {
  return Object.entries(entries)
    .sort(([left], [right]) => left.toUpperCase().localeCompare(right.toUpperCase(), "en"))
    .map(([name, value]) => ({ name, value }));
}

function windowsBaselineSupplement(systemRoot, environmentRoot, extra = {}) {
  const resolvedSystemRoot = path.resolve(systemRoot);
  const systemDrive = path.parse(resolvedSystemRoot).root.slice(0, 2);
  const userProfile = path.resolve(environmentRoot, "home");
  const homeDrive = path.parse(userProfile).root.slice(0, 2);
  return {
    APPDATA: path.resolve(userProfile, "AppData", "Roaming"),
    HOMEDRIVE: homeDrive,
    HOMEPATH: userProfile.slice(2),
    LOCALAPPDATA: path.resolve(userProfile, "AppData", "Local"),
    LOGONSERVER: process.env.LOGONSERVER || "\\\\LOCALHOST",
    SYSTEMDRIVE: systemDrive,
    SystemRoot: resolvedSystemRoot,
    TEMP: path.resolve(environmentRoot, "temp"),
    TMP: path.resolve(environmentRoot, "temp"),
    USERDOMAIN: process.env.USERDOMAIN || "LOCAL",
    USERNAME: process.env.USERNAME || "tinyrustlm",
    USERPROFILE: userProfile,
    WINDIR: resolvedSystemRoot,
    ...extra
  };
}

function writeNew(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes, { flag: "wx" });
}

function fakePe(label, machine = 0x8664) {
  const bytes = Buffer.alloc(256);
  bytes.writeUInt16LE(0x5a4d, 0);
  bytes.writeUInt32LE(128, 0x3c);
  bytes.writeUInt32LE(0x00004550, 128);
  bytes.writeUInt16LE(machine, 132);
  Buffer.from(label, "utf8").copy(bytes, 160, 0, 80);
  return bytes;
}

function fakeArchive(label) {
  return Buffer.concat([Buffer.from("!<arch>\n", "ascii"),
    Buffer.from(label, "utf8")]);
}

function writeToolDirectory(root, names, prefix) {
  fs.mkdirSync(root, { recursive: true });
  for (const name of names) writeNew(path.join(root, name), fakePe(`${prefix}/${name}`));
  writeNew(path.join(root, `${prefix}-support.dll`),
    Buffer.from(`${prefix} support bytes`, "utf8"));
}

function writeLibraryDirectory(root, names, prefix) {
  fs.mkdirSync(root, { recursive: true });
  for (const name of names) {
    writeNew(path.join(root, name), fakeArchive(`${prefix}/${name}`));
  }
  writeNew(path.join(root, `${prefix}-extra.lib`), fakeArchive(`${prefix}/extra`));
}

function writeSdk(kitsRoot, version) {
  for (const family of ["Include", "Lib", "bin"]) {
    fs.mkdirSync(path.join(kitsRoot, family, version), { recursive: true });
  }
  for (const role of ["shared", "ucrt", "um"]) {
    fs.mkdirSync(path.join(kitsRoot, "Include", version, role), { recursive: true });
  }
  writeToolDirectory(path.join(kitsRoot, "bin", version, "x64"), sdkTools, "sdk");
  writeLibraryDirectory(path.join(kitsRoot, "Lib", version, "ucrt", "x64"),
    ucrtLibraries, "ucrt");
  writeLibraryDirectory(path.join(kitsRoot, "Lib", version, "um", "x64"),
    umLibraries, "um");
}

function createSyntheticEnvironmentAuthority(t) {
  environmentOrdinal += 1;
  const root = path.resolve(temporaryRoot,
    `environment-${String(environmentOrdinal).padStart(3, "0")}`);
  fs.mkdirSync(root);
  const visualStudioRoot = path.resolve(root, "visual-studio-2022");
  const toolsetVersion = "14.44.35207";
  const toolRoot = path.join(visualStudioRoot, "VC", "Tools", "MSVC", toolsetVersion);
  const msvcBin = path.join(toolRoot, "bin", "Hostx64", "x64");
  writeToolDirectory(msvcBin, msvcTools, "msvc");
  writeLibraryDirectory(path.join(toolRoot, "lib", "x64"), msvcLibraries, "msvc");
  writeNew(path.join(visualStudioRoot, "VC", "Auxiliary", "Build",
    "Microsoft.VCToolsVersion.default.txt"), Buffer.from(`${toolsetVersion}\r\n`, "ascii"));

  const kitsRoot = path.resolve(root, "windows-kits-10");
  writeSdk(kitsRoot, "10.0.26100.0");
  const systemRoot = path.resolve(process.env.SystemRoot);
  assert.equal(fs.statSync(path.join(systemRoot, "System32")).isDirectory(), true);
  const vswherePath = path.resolve(root, "discovery", "vswhere.exe");
  writeNew(vswherePath, fakePe("vswhere"));
  const outputRoot = path.resolve(root, "outputs");
  fs.mkdirSync(outputRoot);
  const request = {
    schema: environmentTool.requestSchema,
    operationId: `build-custody-environment/${String(environmentOrdinal).padStart(3, "0")}`,
    materializedAtUtc: "2026-08-25T22:00:00Z",
    profile: {
      path: copiedEnvironmentProfilePath,
      byteLength: environmentProfileArtifact.byteLength,
      sha256: environmentProfileArtifact.sha256,
      profileId: environmentTool.profileId
    },
    discovery: {
      vswhere: artifactReference(vswherePath),
      windowsKitsRoot: kitsRoot,
      systemRoot
    },
    selection: {
      visualStudioProductLineVersion: "2022",
      minimumInstallationVersion: "17.0.0.0",
      maximumInstallationVersionExclusive: "18.0.0.0",
      minimumWindowsSdkVersion: "10.0.20000.0",
      maximumWindowsSdkVersionExclusive: "11.0.0.0"
    },
    outputs: {
      privateBindingPath: path.join(outputRoot, "environment.private.json"),
      publicLockPath: path.join(outputRoot, "environment.public.json"),
      terminalPath: path.join(outputRoot, "environment.terminal.json")
    },
    prohibitedWriteRoots: ["D:\\"]
  };
  const requestPath = path.resolve(root, "request.json");
  writeNew(requestPath, Buffer.from(canonicalJson(request), "utf8"));
  const instances = [{
    instanceId: "visual-studio-2022-build-custody-test",
    installationPath: visualStudioRoot,
    installationVersion: "17.14.37531.7",
    productId: "Microsoft.VisualStudio.Product.Community",
    channelId: "VisualStudio.17.Release",
    isComplete: true,
    isLaunchable: true,
    isPrerelease: false,
    isRebootRequired: false,
    catalog: { productLineVersion: "2022" }
  }];
  const vswhereOutput = Buffer.from(JSON.stringify(instances), "utf8");
  const originalSpawnSync = childProcess.spawnSync;
  t.mock.method(childProcess, "spawnSync", (file, argumentsList, options) => {
    if (path.resolve(file) !== vswherePath) {
      return originalSpawnSync(file, argumentsList, options);
    }
    assert.deepEqual(argumentsList, ["-all", "-products", "*", "-requires",
      "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-format", "json", "-utf8"]);
    assert.equal(options.shell, false);
    assert.equal(options.cwd, systemRoot);
    assert.deepEqual(options.env, { SystemRoot: systemRoot });
    return { error: undefined, status: 0, signal: null, stdout: vswhereOutput,
      stderr: Buffer.alloc(0) };
  });
  environmentTool.materialize(requestPath);
  const privateBinding = readJson(request.outputs.privateBindingPath);
  return Object.freeze({
    root,
    systemRoot,
    driftPath: path.join(kitsRoot, "Lib", "10.0.26100.0", "um", "x64",
      "kernel32.lib"),
    authorityNames: privateBinding.environment.entries.map((entry) => entry.name),
    reference: Object.freeze({
      owner: environmentOwnerArtifact,
      profile: Object.freeze({ ...environmentProfileArtifact,
        profileId: environmentTool.profileId }),
      request: artifactReference(requestPath),
      privateBinding: artifactReference(request.outputs.privateBindingPath),
      publicLock: artifactReference(request.outputs.publicLockPath),
      terminal: artifactReference(request.outputs.terminalPath)
    })
  });
}

function createRealEnvironmentAuthority() {
  environmentOrdinal += 1;
  const root = path.resolve(temporaryRoot,
    `environment-real-${String(environmentOrdinal).padStart(3, "0")}`);
  fs.mkdirSync(root);
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  assert.equal(typeof programFilesX86, "string");
  const vswherePath = path.resolve(programFilesX86, "Microsoft Visual Studio", "Installer",
    "vswhere.exe");
  const kitsRoot = path.resolve(programFilesX86, "Windows Kits", "10");
  const systemRoot = path.resolve(process.env.SystemRoot);
  assert.equal(fs.statSync(vswherePath).isFile(), true);
  assert.equal(fs.statSync(kitsRoot).isDirectory(), true);
  assert.equal(fs.statSync(path.join(systemRoot, "System32")).isDirectory(), true);
  const outputRoot = path.resolve(root, "outputs");
  fs.mkdirSync(outputRoot);
  const request = {
    schema: environmentTool.requestSchema,
    operationId: `build-custody-environment-real/${String(environmentOrdinal)
      .padStart(3, "0")}`,
    materializedAtUtc: "2026-08-25T23:00:00Z",
    profile: {
      path: copiedEnvironmentProfilePath,
      byteLength: environmentProfileArtifact.byteLength,
      sha256: environmentProfileArtifact.sha256,
      profileId: environmentTool.profileId
    },
    discovery: {
      vswhere: artifactReference(vswherePath),
      windowsKitsRoot: kitsRoot,
      systemRoot
    },
    selection: {
      visualStudioProductLineVersion: "2022",
      minimumInstallationVersion: "17.0.0.0",
      maximumInstallationVersionExclusive: "18.0.0.0",
      minimumWindowsSdkVersion: "10.0.20000.0",
      maximumWindowsSdkVersionExclusive: "11.0.0.0"
    },
    outputs: {
      privateBindingPath: path.join(outputRoot, "environment.private.json"),
      publicLockPath: path.join(outputRoot, "environment.public.json"),
      terminalPath: path.join(outputRoot, "environment.terminal.json")
    },
    prohibitedWriteRoots: ["D:\\"]
  };
  const requestPath = path.resolve(root, "request.json");
  writeNew(requestPath, Buffer.from(canonicalJson(request), "utf8"));
  environmentTool.materialize(requestPath);
  const privateBinding = readJson(request.outputs.privateBindingPath);
  return Object.freeze({
    root,
    systemRoot,
    authorityNames: privateBinding.environment.entries.map((entry) => entry.name),
    reference: Object.freeze({
      owner: environmentOwnerArtifact,
      profile: Object.freeze({ ...environmentProfileArtifact,
        profileId: environmentTool.profileId }),
      request: artifactReference(requestPath),
      privateBinding: artifactReference(request.outputs.privateBindingPath),
      publicLock: artifactReference(request.outputs.publicLockPath),
      terminal: artifactReference(request.outputs.terminalPath)
    })
  });
}

function environmentAuthorityFor(t) {
  let fixture = environmentFixtures.get(t);
  if (!fixture) {
    fixture = createSyntheticEnvironmentAuthority(t);
    environmentFixtures.set(t, fixture);
  }
  return fixture;
}

function createOperation(t, options = {}) {
  const environmentFixture = options.environmentFixture || environmentAuthorityFor(t);
  operationOrdinal += 1;
  const operationParent = path.join(temporaryRoot,
    `operation-${String(operationOrdinal).padStart(3, "0")}`);
  fs.mkdirSync(operationParent);
  const controlRoot = path.resolve(operationParent, "control");
  const targetRoot = path.resolve(operationParent, "target");
  const environmentRoot = path.resolve(operationParent, "environment");
  const mode = options.mode || "success";
  const commandPath = options.commandPath || process.execPath;
  const commandArtifact = options.commandArtifact || nodeArtifact;
  const required = [...(options.required || [{
    relativePath: "artifact.bin",
    maximumByteLength: 1_048_576,
    kind: "regular-file"
  }]), {
    relativePath: "scratch-inspector.exe",
    maximumByteLength: scratchInspectorArtifact.byteLength,
    kind: "pe-x64"
  }].sort((left, right) => left.relativePath < right.relativePath ? -1 : 1);
  const request = {
    schema: "tinyrustlm.build-custody-request.v4",
    operationId: `build-custody-test/${String(operationOrdinal).padStart(3, "0")}`,
    profile: {
      path: copiedProfilePath,
      byteLength: profileArtifact.byteLength,
      sha256: profileArtifact.sha256,
      profileId: "tinyrustlm.source-controlled-build-custody/4"
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
    environmentAuthority: environmentFixture.reference,
    scratchInspection: {
      profile: {
        path: copiedScratchInspectionProfilePath,
        byteLength: scratchInspectionProfileArtifact.byteLength,
        sha256: scratchInspectionProfileArtifact.sha256,
        profileId: "tinyrustlm.build-scratch-inspection/1"
      },
      executableRelativePath: "scratch-inspector.exe",
      operationId: `build-custody-scratch/${String(operationOrdinal).padStart(3, "0")}`,
      maximumDurationMilliseconds: 10_000,
      maximumStdoutBytes: 1_048_576
    },
    command: {
      executablePath: path.resolve(commandPath),
      executableByteLength: commandArtifact.byteLength,
      executableSha256: commandArtifact.sha256,
      arguments: options.arguments || [copiedFixturePath, targetRoot, mode,
        copiedScratchInspectorPath,
        ...(options.fixtureArguments || [])],
      workingDirectory: sourceRoot,
      supplementalEnvironment: orderedEnvironment(windowsBaselineSupplement(
        environmentFixture.systemRoot, environmentRoot,
        options.supplementalEnvironmentExtra))
    },
    roots: { controlRoot, targetRoot, environmentRoot },
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
      maximumEnvironmentEntryCount: options.maximumEnvironmentEntryCount || 64,
      maximumEnvironmentAggregateBytes:
        options.maximumEnvironmentAggregateBytes || 8_388_608,
      maximumEnvironmentJunctionCount:
        options.maximumEnvironmentJunctionCount === undefined
          ? 16
          : options.maximumEnvironmentJunctionCount,
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
    environmentRoot,
    request,
    requestBytes,
    requestPath,
    requestSha256: sha256(requestBytes),
    environmentFixture
  });
}

function requestToMaterializationIntent(request) {
  return {
    schema: requestMaterializer.intentSchema,
    operationId: request.operationId,
    profile: {
      path: request.profile.path,
      byteLength: request.profile.byteLength,
      sha256: request.profile.sha256,
      profileId: request.profile.profileId
    },
    source: {
      repositoryRoot: request.source.repositoryRoot,
      commit: request.source.commit,
      tree: request.source.tree,
      branch: request.source.branch,
      git: {
        path: request.source.gitPath,
        byteLength: request.source.gitByteLength,
        sha256: request.source.gitSha256
      },
      owner: {
        path: request.source.ownerPath,
        byteLength: request.source.ownerByteLength,
        sha256: request.source.ownerSha256
      }
    },
    runtime: {
      node: {
        path: request.runtime.nodePath,
        byteLength: request.runtime.nodeByteLength,
        sha256: request.runtime.nodeSha256
      },
      nodeVersion: request.runtime.nodeVersion,
      platform: request.runtime.platform,
      architecture: request.runtime.architecture
    },
    environmentAuthority: request.environmentAuthority,
    scratchInspection: request.scratchInspection,
    command: {
      executable: {
        path: request.command.executablePath,
        byteLength: request.command.executableByteLength,
        sha256: request.command.executableSha256
      },
      arguments: request.command.arguments,
      workingDirectory: request.command.workingDirectory,
      supplementalEnvironment: request.command.supplementalEnvironment
    },
    roots: request.roots,
    capture: request.capture,
    termination: {
      strategy: request.termination.strategy,
      executable: {
        path: request.termination.executablePath,
        byteLength: request.termination.executableByteLength,
        sha256: request.termination.executableSha256
      }
    },
    outputs: request.outputs
  };
}

function writeRequestVariant(operation, name, request) {
  const requestPath = path.resolve(operation.operationParent, name);
  const requestBytes = Buffer.from(canonicalJson(request), "utf8");
  writeNew(requestPath, requestBytes);
  return Object.freeze({ requestPath, requestBytes, requestSha256: sha256(requestBytes) });
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

async function waitForFileWhileRunning(filePath, child, maximumMilliseconds) {
  const deadline = Date.now() + maximumMilliseconds;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return true;
    if (child.exitCode !== null || child.signalCode !== null) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

function collectProcess(child) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal, stdout, stderr }));
  });
}

before(() => {
  if (!isWindowsX64) return;
  temporaryParent = buildCustodyTemporaryParent();
  fs.mkdirSync(temporaryParent, { recursive: true });
  requireCanonicalArtifactPath(temporaryParent);
  preflightNoStaleBuildCustodyRoots(temporaryParent);
  childProcess.execFileSync(locateCargo(), ["build", "--manifest-path",
    path.join(repositoryRoot, "Cargo.toml"), "-p", "tinyrustlm-build-custody", "--bin",
    "tinyrustlm-build-scratch-inspect"], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "ignore",
    windowsHide: true
  });
  assert.ok(fs.statSync(templateScratchInspectorPath).isFile());
  temporaryRoot = fs.mkdtempSync(path.join(temporaryParent,
    temporaryRootPrefix));
  temporaryOwnershipBytes = Buffer.from(canonicalJson({
    schema: temporaryOwnershipSchema,
    ownerProcessId: process.pid,
    ownershipId: crypto.randomBytes(16).toString("hex"),
    rootName: path.basename(temporaryRoot)
  }), "utf8");
  fs.writeFileSync(path.join(temporaryRoot, temporaryOwnershipMarkerName),
    temporaryOwnershipBytes, { flag: "wx" });
  try {
  sourceRoot = path.resolve(temporaryRoot, "source");
  copiedOwnerPath = path.resolve(sourceRoot, "tinyrustlm", "tools",
    "build-custody-owner.js");
  copiedProfilePath = path.resolve(sourceRoot, "contracts", "vnext",
    "build-custody-profile.v4.json");
  copiedScratchInspectionProfilePath = path.resolve(sourceRoot, "contracts", "vnext",
    "build-scratch-inspector-profile.v1.json");
  copiedScratchInspectorPath = path.resolve(sourceRoot, "tinyrustlm", "tests", "helpers",
    "scratch-inspector.exe");
  copiedEnvironmentOwnerPath = path.resolve(sourceRoot, "tinyrustlm", "tools",
    "windows-x64-msvc-environment.js");
  copiedEnvironmentProfilePath = path.resolve(sourceRoot, "contracts", "vnext",
    "windows-x64-msvc-environment-profile.v1.json");
  copiedFixturePath = path.resolve(sourceRoot, "tinyrustlm", "tests", "helpers",
    "build-custody-child-fixture.js");
  for (const filePath of [copiedOwnerPath, copiedProfilePath,
    copiedScratchInspectionProfilePath, copiedScratchInspectorPath,
    copiedEnvironmentOwnerPath, copiedEnvironmentProfilePath, copiedFixturePath]) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  fs.copyFileSync(templateOwnerPath, copiedOwnerPath);
  fs.copyFileSync(templateProfilePath, copiedProfilePath);
  fs.copyFileSync(templateScratchInspectionProfilePath, copiedScratchInspectionProfilePath);
  fs.copyFileSync(templateScratchInspectorPath, copiedScratchInspectorPath);
  fs.copyFileSync(templateEnvironmentOwnerPath, copiedEnvironmentOwnerPath);
  fs.copyFileSync(templateEnvironmentProfilePath, copiedEnvironmentProfilePath);
  fs.copyFileSync(templateFixturePath, copiedFixturePath);

  gitPath = locateGit();
  taskkillPath = path.resolve(process.env.SystemRoot, "System32", "taskkill.exe");
  gitArtifact = artifact(gitPath);
  taskkillArtifact = artifact(taskkillPath);
  nodeArtifact = artifact(process.execPath);
  ownerArtifact = artifact(copiedOwnerPath);
  profileArtifact = artifact(copiedProfilePath);
  scratchInspectionProfileArtifact = artifact(copiedScratchInspectionProfilePath);
  scratchInspectorArtifact = artifact(copiedScratchInspectorPath);
  environmentOwnerArtifact = artifactReference(copiedEnvironmentOwnerPath);
  environmentProfileArtifact = artifactReference(copiedEnvironmentProfilePath);

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
  environmentTool = require(copiedEnvironmentOwnerPath);
  } catch (error) {
    try {
      removeOwnedBuildCustodyRoot();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError],
        "build custody setup and exact cleanup failed");
    }
    throw error;
  }
});

after(() => {
  removeOwnedBuildCustodyRoot();
});

test("owns and bounds the copied build-custody source fixture", {
  skip: !isWindowsX64
}, () => {
  assertDirectDirectory(temporaryParent, "build custody temporary parent");
  assert.equal(temporaryParent, path.join(repositoryRoot, "artifacts", "tests", "build-custody"));
  assertDirectDirectory(temporaryRoot, "build custody temporary root");
  assert.equal(path.dirname(temporaryRoot), temporaryParent);
  assert.deepEqual(fs.readdirSync(temporaryParent, { withFileTypes: true })
    .filter((entry) => entry.name.startsWith(temporaryRootPrefix))
    .map((entry) => entry.name), [path.basename(temporaryRoot)]);
  const markerPath = path.join(temporaryRoot, temporaryOwnershipMarkerName);
  assert.deepEqual(fs.readFileSync(markerPath), temporaryOwnershipBytes);
  const marker = JSON.parse(temporaryOwnershipBytes.toString("utf8"));
  assert.deepEqual(Object.keys(marker), [
    "schema",
    "ownerProcessId",
    "ownershipId",
    "rootName"
  ]);
  assert.equal(marker.schema, temporaryOwnershipSchema);
  assert.equal(marker.ownerProcessId, process.pid);
  assert.match(marker.ownershipId, /^[0-9a-f]{32}$/u);
  assert.equal(marker.rootName, path.basename(temporaryRoot));
});

test("freezes the sole prelaunch build-custody profile and owner identity", () => {
  assert.equal(fs.existsSync(path.join(repositoryRoot, "contracts", "vnext",
    "build-custody-profile.v3.json")), false);
  const profileBytes = fs.readFileSync(templateProfilePath);
  assert.equal(profileBytes.length, 10274);
  assert.equal(sha256(profileBytes),
    "26b75c36911c14d744a764c19d8a40ec0c28762add5e6616501080120aad9b45");
  assert.equal(templateOwner.profileByteLength, profileBytes.length);
  assert.equal(templateOwner.profileSha256, sha256(profileBytes));
  const profile = JSON.parse(profileBytes.toString("utf8"));
  assert.equal(profile.profileId, "tinyrustlm.source-controlled-build-custody/4");
  assert.equal(profile.authority.legacySupport, false);
  assert.equal(profile.authority.retry, false);
  assert.equal(profile.processPolicy.workerEnvironment,
    "system-root-request-plus-fixed-windows-injected-name-allowlist");
  assert.equal(profile.processPolicy.environmentLaunch,
    "explicit-authority-plus-request-bound-owned-application-data-and-windows-baseline-no-global-process-environment-mutation");
  assert.equal(profile.processPolicy.workerAmbientValuesUsedByCustody, false);
  assert.equal(profile.processPolicy.testOnlyInProcess,
    "explicitly-marked-redacted-and-never-campaign-evidence");
  assert.equal(profile.environmentAuthority.profileSha256,
    "76de6c5985c000dadedefa457286111af80ebd2deb6e6e3d8de246f6a0eed607");
  assert.equal(profile.environmentAuthority.ownerSha256,
    "48b550da9fa0a81735467d2af6dc733fa5ba2df4e9f815e505c37b57bfdb4ebf");
  assert.equal(profile.environmentPolicy.callerFullEnvironmentAccepted, false);
  assert.deepEqual(profile.environmentPolicy.applicationDataBindings, {
    APPDATA: "exact-environment-root-home-appdata-roaming-child",
    LOCALAPPDATA: "exact-environment-root-home-appdata-local-child"
  });
  assert.equal(profile.environmentPolicy.tempAndTmp,
    "same-exact-environment-root-temp-child");
  assert.equal(profile.environmentAuthority.postChildValidationForEveryProcessOutcome, true);
  assert.equal(profile.environmentAuthority.productionValidationProcess,
    "fresh-exact-source-bound-node-for-every-validation");
  assert.equal(profile.environmentAuthority.testValidationProcess,
    "explicit-in-process-test-only-never-campaign-evidence");
  assert.equal(profile.environmentAuthority.postScratchInspectionValidationBeforePass, true);
  assert.equal(profile.scratchInspectionAuthority.profileSha256,
    "08a2c5cb57cff8b260972129efcdfbcd2e598b51a5d6660f3c11c83a0be05aef");
  assert.equal(profile.scratchInspectionAuthority.invocationCount, 1);
  assert.equal(profile.scratchInspectionAuthority.retry, false);
  assert.equal(profile.limits.maximumTargetEntries, 131072);
});

test("rejects reordered, unknown, and noncanonical request material", {
  skip: !isWindowsX64
}, (t) => {
  const operation = createOperation(t);
  const reordered = {
    operationId: operation.request.operationId,
    schema: operation.request.schema,
    profile: operation.request.profile,
    source: operation.request.source,
    runtime: operation.request.runtime,
    environmentAuthority: operation.request.environmentAuthority,
    scratchInspection: operation.request.scratchInspection,
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
  assert.throws(() => owner.validateRequestShape({ ...operation.request,
    schema: "tinyrustlm.build-custody-request.v3" }),
  /build-custody-request-schema/u);
  assert.throws(() => owner.validateRequestShape({
    ...operation.request,
    profile: { ...operation.request.profile,
      profileId: "tinyrustlm.source-controlled-build-custody/3" }
  }), /build-custody-profile-id/u);
  const missingBaseline = {
    ...operation.request,
    command: {
      ...operation.request.command,
      supplementalEnvironment: operation.request.command.supplementalEnvironment
        .filter((entry) => entry.name !== "TEMP")
    }
  };
  assert.throws(() => owner.validateRequestShape(missingBaseline),
    /build-custody-windows-baseline-supplement/u);
  for (const name of ["APPDATA", "LOCALAPPDATA", "TMP"]) {
    const missing = {
      ...operation.request,
      command: {
        ...operation.request.command,
        supplementalEnvironment: operation.request.command.supplementalEnvironment
          .filter((entry) => entry.name !== name)
      }
    };
    assert.throws(() => owner.validateRequestShape(missing),
      /build-custody-windows-baseline-supplement/u, name);
  }
  assert.throws(() => owner.validateRequestShape({
    ...operation.request,
    outputs: { ...operation.request.outputs, maximumEnvironmentEntryCount: 4 }
  }), /build-custody-environment-output-count/u);
  const compactPath = path.join(operation.operationParent, "compact.json");
  fs.writeFileSync(compactPath, JSON.stringify(operation.request), { flag: "wx" });
  assert.throws(() => owner.prepareRequest(path.resolve(compactPath)),
    /build-custody-request-json/u);
  assert.equal(fs.existsSync(operation.controlRoot), false);
  assert.equal(fs.existsSync(operation.targetRoot), false);
  assert.equal(fs.existsSync(operation.environmentRoot), false);
});

test("preflight is read-only and binds exact source, Git, Node, command, and taskkill bytes", {
  skip: !isWindowsX64
}, (t) => {
  const operation = createOperation(t);
  const prepared = owner.prepareRequest(operation.requestPath,
    { testOnlyInProcess: true });
  assert.equal(prepared.requestDocument.artifact.sha256, operation.requestSha256);
  assert.deepEqual(prepared.source.gitArtifact, gitArtifact);
  assert.deepEqual(prepared.runtimeArtifact, nodeArtifact);
  assert.deepEqual(prepared.commandArtifact, nodeArtifact);
  assert.deepEqual(prepared.terminationArtifact, taskkillArtifact);
  assert.equal(prepared.environmentAuthority.validationCode,
    "msvc-environment-validation-pass");
  assert.deepEqual(Object.keys(prepared.environment),
    prepared.environmentAuthority.entries.map((entry) => entry.name));
  assert.equal(Object.keys(prepared.environment).includes("PATH"), true);
  assert.equal(Object.keys(prepared.environment).includes(
    "CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER"), true);
  assert.equal(prepared.environment.SystemRoot, operation.environmentFixture.systemRoot);
  assert.equal(prepared.environment.APPDATA, path.resolve(operation.environmentRoot,
    "home", "AppData", "Roaming"));
  assert.equal(prepared.environment.LOCALAPPDATA, path.resolve(operation.environmentRoot,
    "home", "AppData", "Local"));
  assert.equal(prepared.environment.TEMP,
    path.resolve(operation.environmentRoot, "temp"));
  assert.equal(prepared.environment.TMP, prepared.environment.TEMP);
  assert.equal(fs.existsSync(operation.controlRoot), false);
  assert.equal(fs.existsSync(operation.targetRoot), false);
  assert.equal(fs.existsSync(operation.environmentRoot), false);
});

test("source-controlled materialization produces a byte-exact real-preflight request", {
  skip: !isWindowsX64
}, (t) => {
  const operation = createOperation(t);
  const intent = requestToMaterializationIntent(operation.request);
  const intentPath = path.resolve(operation.operationParent, "materialization-intent.json");
  const requestPath = path.resolve(operation.operationParent, "materialized-request.json");
  writeNew(intentPath, Buffer.from(canonicalJson(intent), "utf8"));
  const summary = requestMaterializer.materialize(intentPath, requestPath);
  const requestBytes = fs.readFileSync(requestPath);
  assert.deepEqual(JSON.parse(requestBytes.toString("utf8")), operation.request);
  assert.equal(summary.request.byteLength, requestBytes.length);
  assert.equal(summary.request.sha256, sha256(requestBytes));
  assert.equal(summary.custodyPreflightPassed, false);

  const prepared = owner.prepareRequest(requestPath, { testOnlyInProcess: true });
  assert.equal(prepared.requestDocument.artifact.sha256, sha256(requestBytes));
  assert.equal(prepared.environmentAuthority.validationCode,
    "msvc-environment-validation-pass");
  assert.equal(fs.existsSync(operation.controlRoot), false);
  assert.equal(fs.existsSync(operation.targetRoot), false);
  assert.equal(fs.existsSync(operation.environmentRoot), false);
});

test("rejects application-data and temporary paths outside owned scratch before writing", {
  skip: !isWindowsX64
}, (t) => {
  const operation = createOperation(t);
  const cases = [
    ["APPDATA", path.resolve(operation.operationParent, "foreign-roaming"),
      /build-custody-appdata-binding/u],
    ["LOCALAPPDATA", path.resolve(operation.operationParent, "foreign-local"),
      /build-custody-local-appdata-binding/u],
    ["TMP", path.resolve(operation.operationParent, "foreign-temp"),
      /build-custody-temp-binding/u]
  ];
  for (const [name, value, expected] of cases) {
    const supplementalEnvironment = operation.request.command.supplementalEnvironment
      .map((entry) => entry.name === name ? { name, value } : entry);
    const request = {
      ...operation.request,
      command: { ...operation.request.command, supplementalEnvironment }
    };
    const variant = writeRequestVariant(operation, `foreign-${name}.json`, request);
    assert.throws(() => owner.prepareRequest(variant.requestPath,
      { testOnlyInProcess: true }), expected, name);
  }
  assert.equal(fs.existsSync(operation.controlRoot), false);
  assert.equal(fs.existsSync(operation.targetRoot), false);
  assert.equal(fs.existsSync(operation.environmentRoot), false);
});

test("rejects cross-bound environment evidence and authority-name overlap before writing", {
  skip: !isWindowsX64
}, (t) => {
  const operation = createOperation(t);
  const foreignPublicPath = path.resolve(operation.operationParent, "foreign-public.json");
  fs.copyFileSync(operation.request.environmentAuthority.publicLock.path, foreignPublicPath,
    fs.constants.COPYFILE_EXCL);
  const crossBound = {
    ...operation.request,
    environmentAuthority: {
      ...operation.request.environmentAuthority,
      publicLock: artifactReference(foreignPublicPath)
    }
  };
  const crossBoundVariant = writeRequestVariant(operation, "cross-bound.json", crossBound);
  assert.throws(() => owner.prepareRequest(crossBoundVariant.requestPath,
    { testOnlyInProcess: true }),
    /build-custody-environment-output-binding/u);

  const overlapping = {
    ...operation.request,
    command: {
      ...operation.request.command,
      supplementalEnvironment: orderedEnvironment(windowsBaselineSupplement(
        operation.environmentFixture.systemRoot, operation.environmentRoot, {
          PATH: "C:\\untrusted-path-override"
        }))
    }
  };
  const overlappingVariant = writeRequestVariant(operation, "overlapping-path.json",
    overlapping);
  assert.throws(() => owner.prepareRequest(overlappingVariant.requestPath,
    { testOnlyInProcess: true }),
    /build-custody-environment-authority-overlap/u);
  assert.equal(fs.existsSync(operation.controlRoot), false);
  assert.equal(fs.existsSync(operation.targetRoot), false);
});

test("captures zero exit before diagnostics and inventories both required outputs", {
  skip: !isWindowsX64
}, async (t) => {
  const operation = createOperation(t);
  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256);
  assert.equal(result.terminal.status, "pass");
  assert.equal(result.terminal.code, "build-custody-pass");
  assert.deepEqual(controlFiles(operation), completeEvidenceFileNames);
  const processTerminal = readJson(path.join(operation.controlRoot,
    "build.process-terminal.json"));
  assert.equal(processTerminal.event, "exit");
  assert.equal(processTerminal.exitCode, 0);
  assert.equal(processTerminal.exitTimeMetadataQueried, false);
  assert.equal(result.terminal.closeOutcome.exitCode, 0);
  assert.equal(result.terminal.finalCapture.stdoutOverflow, false);
  assert.equal(result.terminal.environmentAuthority.initial.validationCode,
    "msvc-environment-validation-pass");
  assert.equal(result.terminal.environmentAuthority.preLaunch.validationCode,
    "msvc-environment-validation-pass");
  assert.equal(result.terminal.environmentAuthority.postChild.validationCode,
    "msvc-environment-validation-pass");
  assert.equal(result.terminal.environmentAuthority.postScratchInspection.validationCode,
    "msvc-environment-validation-pass");
  assert.equal(owner.publicSummary(result.terminal).environmentValidated, true);
  assert.equal(owner.publicSummary(result.terminal).environmentPublicLockSha256,
    operation.request.environmentAuthority.publicLock.sha256);
  assert.equal(result.terminal.identities.sourceControl.sha256, gitArtifact.sha256);
  assert.equal(result.terminal.identities.scratchInspectionProfile.sha256,
    scratchInspectionProfileArtifact.sha256);
  assert.equal(result.terminal.target.entryCount, 2);
  assert.equal(result.terminal.target.fileCount, 2);
  assert.equal(result.terminal.target.directoryCount, 0);
  assert.equal(result.terminal.target.required[0].sha256,
    sha256(Buffer.from("custodied-build-output", "utf8")));
  assert.equal(fs.readFileSync(path.join(operation.controlRoot, "build.stdout.bin"),
    "utf8"), "fixture-stdout");
  assert.equal(fs.readFileSync(path.join(operation.controlRoot, "build.stderr.bin"),
    "utf8"), "fixture-stderr");
  const binding = readJson(path.join(operation.controlRoot, "build.binding.json"));
  assert.deepEqual(binding.workerEnvironmentNames, []);
  assert.equal(binding.workerEnvironmentConstrained, false);
  assert.equal(binding.testOnlyInProcess, true);
  assert.ok(binding.workerEnvironmentEntryCount > 1);
  assert.match(binding.workerEnvironmentNamesSha256, /^[a-f0-9]{64}$/u);
  assert.equal(result.terminal.testOnlyInProcess, true);
  assert.equal(owner.publicSummary(result.terminal).testOnlyInProcess, true);
  assert.equal(binding.environmentAuthority.publicLock.sha256,
    operation.request.environmentAuthority.publicLock.sha256);
  assert.equal(binding.combinedEnvironmentEntryCount,
    operation.environmentFixture.authorityNames.length +
      operation.request.command.supplementalEnvironment.length);
  assert.equal(result.terminal.target.required[1].relativePath, "scratch-inspector.exe");
  assert.equal(result.terminal.target.required[1].sha256, scratchInspectorArtifact.sha256);
  assert.equal(result.terminal.scratchInspection.status, "pass");
  assert.equal(result.terminal.scratchInspection.invocationCount, 1);
  assert.equal(result.terminal.scratchInspection.observation.entryCount, 5);
  assert.equal(result.terminal.scratchInspection.observation.fileCount, 0);
  assert.equal(result.terminal.scratchInspection.observation.directoryCount, 5);
  assert.equal(result.terminal.scratchInspection.observation.aggregateBytes, 0);
  assert.equal(result.terminal.scratchInspection.observation.junctionCount, 0);
  assert.equal(result.terminal.scratchInspection.processTerminal.outcome.exitCode, 0);
  assert.equal(fs.readFileSync(path.join(operation.controlRoot,
    "build.scratch-inspection.stderr.bin")).length, 0);
  assert.equal(owner.publicSummary(result.terminal).environmentScratchEntryCount, 5);
  assert.equal(owner.publicSummary(result.terminal).environmentScratchBytes, 0);
  assert.equal(owner.publicSummary(result.terminal).environmentScratchJunctionCount, 0);
  assert.equal(owner.publicSummary(result.terminal).scratchInspectionInvoked, true);
  assert.equal(owner.publicSummary(result.terminal).scratchInspectionStatus, "pass");
});

test("accepts one real same-root direct known-folder junction with exact evidence", {
  skip: !isWindowsX64
}, async (t) => {
  const operation = createOperation(t, { mode: "environment-junction" });

  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256);

  assert.equal(result.terminal.status, "pass");
  assert.equal(result.terminal.scratchInspection.status, "pass");
  const observation = result.terminal.scratchInspection.observation;
  assert.equal(observation.junctionCount, 1);
  assert.equal(observation.junctions[0].relativePath,
    "home/AppData/Local/Microsoft/Windows/INetCache/Content.IE5");
  assert.equal(observation.junctions[0].targetRelativePath,
    "home/AppData/Local/Microsoft/Windows/INetCache/IE");
  assert.equal(observation.junctions[0].reparseTag, "0xa0000003");
  assert.equal(observation.aggregateBytes, Buffer.byteLength("contained"));
  assert.deepEqual(controlFiles(operation), completeEvidenceFileNames);
  assert.equal(readJson(path.join(operation.controlRoot,
    "build.scratch-inspection.process-terminal.json")).exitCode, 0);
});

test("rejects one real external junction without retry repair or output adoption", {
  skip: !isWindowsX64
}, async (t) => {
  const operation = createOperation(t, { mode: "environment-external-junction" });

  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256);

  assert.equal(result.terminal.status, "terminal-custody-failure");
  assert.equal(result.terminal.code, "build-custody-scratch-inspection-rejected");
  assert.equal(result.terminal.scratchInspection.status, "failed");
  assert.equal(result.terminal.scratchInspection.invocationCount, 1);
  assert.equal(result.terminal.scratchInspection.processTerminal.outcome.exitCode, 2);
  assert.equal(result.terminal.scratchInspection.helperFailure.errorCode,
    "scratch_inspection_junction_external_target");
  assert.equal(result.terminal.identities, null);
  assert.equal(result.terminal.retryAllowed, false);
  assert.deepEqual(controlFiles(operation), completeEvidenceFileNames);
});

test("rejects malformed inspector output and post-invocation executable mutation", {
  skip: !isWindowsX64
}, async (t) => {
  const malformed = createOperation(t);
  let malformedCalls = 0;
  const malformedResult = await owner.runWorkerForTest(malformed.requestPath,
    malformed.requestSha256, {
      spawnScratchInspectorSync() {
        malformedCalls += 1;
        return { error: null, signal: null, status: 0, stderr: Buffer.alloc(0),
          stdout: Buffer.from("{}", "utf8") };
      }
    });
  assert.equal(malformedCalls, 1);
  assert.equal(malformedResult.terminal.status, "terminal-custody-failure");
  assert.equal(malformedResult.terminal.code,
    "build-custody-scratch-inspection-observation-invalid");

  const mutation = createOperation(t);
  let mutationCalls = 0;
  const mutationResult = await owner.runWorkerForTest(mutation.requestPath,
    mutation.requestSha256, {
      spawnScratchInspectorSync(executablePath, argumentsList, options) {
        mutationCalls += 1;
        const result = childProcess.spawnSync(executablePath, argumentsList, options);
        fs.appendFileSync(executablePath, Buffer.from([0x00]));
        return result;
      }
    });
  assert.equal(mutationCalls, 1);
  assert.equal(mutationResult.terminal.status, "terminal-custody-failure");
  assert.equal(mutationResult.terminal.code,
    "build-custody-scratch-inspection-executable-drift");
  assert.equal(mutationResult.terminal.scratchInspection.executable.after, null);
});

test("preserves a nonzero child as a terminal build failure without output adoption", {
  skip: !isWindowsX64
}, async (t) => {
  const operation = createOperation(t, { mode: "nonzero" });
  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256);
  assert.equal(result.terminal.status, "terminal-build-failure");
  assert.equal(result.terminal.code, "build-custody-child-nonzero");
  assert.equal(result.terminal.processTerminal.outcome.exitCode, 23);
  assert.equal(result.terminal.target, null);
  assert.equal(result.terminal.retryAllowed, false);
  assert.deepEqual(controlFiles(operation), baseEvidenceFileNames);
});

test("detects stdout overflow even when final pipe state follows the exit event", {
  skip: !isWindowsX64
}, async (t) => {
  const operation = createOperation(t, {
    mode: "stdout-overflow",
    fixtureArguments: ["4096"],
    maximumStdoutBytes: 32
  });
  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256);
  assert.equal(result.terminal.status, "terminal-build-failure");
  assert.equal(result.terminal.code, "build-custody-stdout-overflow");
  assert.equal(result.terminal.finalCapture.stdoutOverflow, true);
  assert.equal(result.terminal.stdout.byteLength, 33);
  assert.equal(result.terminal.stdout.overflow, true);
  assert.equal(result.terminal.target, null);
});

test("kills a timed-out Windows process tree before its grandchild can mutate evidence", {
  skip: !isWindowsX64
}, async (t) => {
  const markerPath = path.join(temporaryRoot, `grandchild-${operationOrdinal + 1}.marker`);
  const operation = createOperation(t, {
    mode: "timeout-tree",
    fixtureArguments: [markerPath, "1800"],
    maximumDurationMilliseconds: 300
  });
  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256);
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
}, async (t) => {
  const operation = createOperation(t);
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
  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256, {
    spawn: syntheticSpawn
  });
  assert.equal(result.terminal.status, "terminal-build-failure");
  assert.equal(result.terminal.code, "build-custody-spawn-failure");
  assert.equal(result.terminal.processTerminal.outcome.processStarted, false);
  assert.equal(result.terminal.processTerminal.outcome.event, "spawn-error");
  assert.equal(result.terminal.processTerminal.outcome.exitCode, null);
});

test("blocks child launch when the environment closure drifts after initial binding", {
  skip: !isWindowsX64
}, async (t) => {
  const operation = createOperation(t);
  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256, {
    beforeEnvironmentPreLaunchValidation() {
      fs.appendFileSync(operation.environmentFixture.driftPath,
        Buffer.from("prelaunch-drift", "utf8"));
    }
  });
  assert.equal(result.terminal.status, "terminal-custody-failure");
  assert.match(result.terminal.code, /msvc-environment-private-binding-drift/u);
  assert.equal(result.terminal.processTerminal.outcome.processStarted, false);
  assert.equal(result.terminal.processTerminal.outcome.environmentValidationCode,
    result.terminal.code);
  assert.equal(result.terminal.environmentAuthority.preLaunch, null);
  assert.equal(result.terminal.environmentAuthority.postChild, null);
  assert.equal(owner.publicSummary(result.terminal).environmentValidated, false);
  assert.equal(fs.existsSync(path.join(operation.targetRoot, "artifact.bin")), false);
});

test("gives post-child environment drift custody precedence over a nonzero exit", {
  skip: !isWindowsX64
}, async (t) => {
  const operation = createOperation(t, { mode: "nonzero" });
  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256, {
    beforeEnvironmentPostChildValidation() {
      fs.appendFileSync(operation.environmentFixture.driftPath,
        Buffer.from("post-child-drift", "utf8"));
    }
  });
  assert.equal(result.terminal.status, "terminal-custody-failure");
  assert.match(result.terminal.code, /msvc-environment-private-binding-drift/u);
  assert.equal(result.terminal.processTerminal.outcome.exitCode, 23);
  assert.equal(result.terminal.environmentAuthority.preLaunch.validationCode,
    "msvc-environment-validation-pass");
  assert.equal(result.terminal.environmentAuthority.postChild, null);
  assert.equal(result.terminal.target, null);
  assert.equal(owner.publicSummary(result.terminal).environmentValidated, false);
});

test("keeps zero exit durable when optional ExitTime-style diagnostics fail", {
  skip: !isWindowsX64
}, async (t) => {
  const operation = createOperation(t);
  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256, {
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
  assert.deepEqual(controlFiles(operation), baseEvidenceFileNames);
});

test("fails closed on a missing required output and on an entry-count overflow", {
  skip: !isWindowsX64
}, async (t) => {
  const missing = createOperation(t, { mode: "missing-output" });
  const missingResult = await owner.runWorkerForTest(missing.requestPath,
    missing.requestSha256);
  assert.equal(missingResult.terminal.status, "terminal-custody-failure");
  assert.equal(missingResult.terminal.code, "build-custody-file-invalid");
  assert.equal(missingResult.terminal.processTerminal.outcome.exitCode, 0);

  const entries = createOperation(t, {
    mode: "many-entries",
    fixtureArguments: ["5"],
    maximumEntryCount: 3
  });
  const entryResult = await owner.runWorkerForTest(entries.requestPath,
    entries.requestSha256);
  assert.equal(entryResult.terminal.status, "terminal-custody-failure");
  assert.equal(entryResult.terminal.code, "build-custody-target-entry-limit");
  assert.equal(entryResult.terminal.processTerminal.outcome.exitCode, 0);
});

test("does not inherit an unrequested environment variable into the build child", {
  skip: !isWindowsX64
}, async (t) => {
  const inheritedName = "TINYRUSTLM_UNREQUESTED_BUILD_CUSTODY_SENTINEL";
  const prior = process.env[inheritedName];
  process.env[inheritedName] = "must-not-cross-boundary";
  try {
    const operation = createOperation(t, {
      mode: "environment",
      supplementalEnvironmentExtra: { BUILD_CUSTODY_ALLOWED: "yes" },
      required: [{
        relativePath: "environment.json",
        maximumByteLength: 16384,
        kind: "regular-file"
      }]
    });
    const prepared = owner.prepareRequest(operation.requestPath,
      { testOnlyInProcess: true });
    const result = await owner.runWorkerForTest(operation.requestPath,
      operation.requestSha256);
    assert.equal(result.terminal.status, "pass");
    const observed = JSON.parse(fs.readFileSync(path.join(operation.targetRoot,
      "environment.json"), "utf8"));
    const expectedEntries = Object.entries(prepared.environment)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    assert.deepEqual(observed.names, expectedEntries.map(([name]) => name));
    assert.deepEqual(observed.values, Object.fromEntries(expectedEntries));
    assert.equal(observed.names.includes(inheritedName), false);
  } finally {
    if (prior === undefined) delete process.env[inheritedName];
    else process.env[inheritedName] = prior;
  }
});

test("validates an exact x64 PE output only after the zero exit is durable", {
  skip: !isWindowsX64
}, async (t) => {
  const operation = createOperation(t, {
    mode: "copy-pe",
    fixtureArguments: [taskkillPath],
    maximumAggregateBytes: 2_097_152,
    required: [{
      relativePath: "artifact.exe",
      maximumByteLength: 2_097_152,
      kind: "pe-x64"
    }]
  });
  const result = await owner.runWorkerForTest(operation.requestPath,
    operation.requestSha256);
  assert.equal(result.terminal.status, "pass");
  assert.equal(result.terminal.processTerminal.outcome.exitCode, 0);
  assert.equal(result.terminal.target.required[0].peMachine, "0x8664");
  assert.equal(result.terminal.target.required[0].sha256, taskkillArtifact.sha256);
});

test("refuses existing roots and never overwrites a colliding final terminal", {
  skip: !isWindowsX64
}, async (t) => {
  const existingRoot = createOperation(t);
  fs.mkdirSync(existingRoot.controlRoot);
  assert.throws(() => owner.prepareRequest(existingRoot.requestPath),
    /build-custody-control-root-exists/u);
  assert.equal(fs.existsSync(existingRoot.targetRoot), false);
  assert.equal(fs.existsSync(existingRoot.environmentRoot), false);

  const terminalCollision = createOperation(t);
  const collisionBytes = Buffer.from("preexisting-terminal-collision", "utf8");
  await assert.rejects(owner.runWorkerForTest(terminalCollision.requestPath,
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
  skip: !isWindowsX64,
  timeout: 1_200_000
}, async (t) => {
  const realEnvironment = createRealEnvironmentAuthority();
  const directOperation = createOperation(t, { environmentFixture: realEnvironment });
  const directWorker = childProcess.spawn(process.execPath,
    [copiedOwnerPath, "worker", directOperation.requestPath,
      directOperation.requestSha256], {
      env: { SystemRoot: process.env.SystemRoot },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
  const directOutcome = await collectProcess(directWorker);
  assert.equal(directOutcome.exitCode, 0,
    `direct worker failed: ${JSON.stringify(directOutcome)}`);
  assert.equal(readJson(path.join(directOperation.controlRoot,
    "build.terminal.json")).status, "pass");
  const operation = createOperation(t, {
    environmentFixture: realEnvironment,
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
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
  let observerStdout = "";
  let observerStderr = "";
  cli.stdout.setEncoding("utf8");
  cli.stderr.setEncoding("utf8");
  cli.stdout.on("data", (chunk) => { observerStdout += chunk; });
  cli.stderr.on("data", (chunk) => { observerStderr += chunk; });
  const observerClosed = new Promise((resolve) => cli.once("close", (exitCode, signal) =>
    resolve({ exitCode, signal })));
  const startPath = path.join(operation.controlRoot, "build.start.json");
  const started = await waitForFileWhileRunning(startPath, cli, 180_000);
  assert.equal(started, true,
    "observer closed before start: " +
    `stdout=${observerStdout} stderr=${observerStderr} ` +
    `environment=${JSON.stringify(operation.request.environmentAuthority)}`);
  assert.equal(cli.kill("SIGKILL"), true);
  await observerClosed;
  await waitForFile(path.join(operation.controlRoot, "build.terminal.json"), 180_000);
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
  const summary = JSON.parse(observed.stdout);
  assert.equal(summary.status, "pass");
  assert.equal(summary.environmentValidated, true);
  assert.equal(summary.environmentPublicLockSha256,
    operation.request.environmentAuthority.publicLock.sha256);
});

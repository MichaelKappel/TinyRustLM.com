"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const toolPath = path.join(repositoryRoot, "tinyrustlm", "tools",
  "windows-x64-msvc-environment.js");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "windows-x64-msvc-environment-profile.v1.json");
const environmentTool = require(toolPath);
const isWindowsX64 = process.platform === "win32" && process.arch === "x64";
const ownedPrefix = "tinyrustlm-msvc-environment-test-";
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
  return Buffer.concat([Buffer.from("!<arch>\n", "ascii"), Buffer.from(label, "utf8")]);
}

function artifact(filePath) {
  const bytes = fs.readFileSync(filePath);
  return { path: filePath, byteLength: bytes.length, sha256: sha256(bytes) };
}

function makeOwnedRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ownedPrefix));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.equal(path.basename(resolved).startsWith(ownedPrefix), true);
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

function writeToolDirectory(root, names, prefix) {
  fs.mkdirSync(root, { recursive: true });
  for (const name of names) writeNew(path.join(root, name), fakePe(`${prefix}/${name}`));
  writeNew(path.join(root, `${prefix}-support.dll`),
    Buffer.from(`${prefix} support bytes`, "utf8"));
}

function writeLibraryDirectory(root, names, prefix) {
  fs.mkdirSync(root, { recursive: true });
  for (const name of names) writeNew(path.join(root, name),
    fakeArchive(`${prefix}/${name}`));
  writeNew(path.join(root, `${prefix}-extra.lib`),
    fakeArchive(`${prefix}/extra`));
}

function writeSdk(kitsRoot, version, complete) {
  for (const family of ["Include", "Lib", "bin"]) {
    fs.mkdirSync(path.join(kitsRoot, family, version), { recursive: true });
  }
  if (!complete) return;
  for (const role of ["shared", "ucrt", "um"]) {
    fs.mkdirSync(path.join(kitsRoot, "Include", version, role), { recursive: true });
  }
  writeToolDirectory(path.join(kitsRoot, "bin", version, "x64"), sdkTools, "sdk");
  writeLibraryDirectory(path.join(kitsRoot, "Lib", version, "ucrt", "x64"),
    ucrtLibraries, "ucrt");
  writeLibraryDirectory(path.join(kitsRoot, "Lib", version, "um", "x64"),
    umLibraries, "um");
}

function makeFixture(t, options = {}) {
  assert.equal(isWindowsX64, true);
  const root = makeOwnedRoot(t);
  const visualStudioRoot = path.resolve(root, "visual-studio-2022");
  const toolsetVersion = "14.44.35207";
  const toolRoot = path.join(visualStudioRoot, "VC", "Tools", "MSVC", toolsetVersion);
  const msvcBin = path.join(toolRoot, "bin", "Hostx64", "x64");
  const msvcLib = path.join(toolRoot, "lib", "x64");
  writeToolDirectory(msvcBin, msvcTools, "msvc");
  writeLibraryDirectory(msvcLib, msvcLibraries, "msvc");
  writeNew(path.join(visualStudioRoot, "VC", "Auxiliary", "Build",
    "Microsoft.VCToolsVersion.default.txt"), Buffer.from(`${toolsetVersion}\r\n`, "ascii"));

  const kitsRoot = path.resolve(root, "windows-kits-10");
  writeSdk(kitsRoot, "10.0.22621.0", true);
  writeSdk(kitsRoot, "10.0.26100.0", true);
  writeSdk(kitsRoot, "10.0.99999.0", false);

  const systemRoot = path.resolve(root, "windows");
  const system32 = path.join(systemRoot, "System32");
  fs.mkdirSync(system32, { recursive: true });
  if (options.system32Collision) {
    writeNew(path.join(system32, options.system32Collision),
      fakePe(`system32/${options.system32Collision}`));
  }

  const vswherePath = path.resolve(root, "discovery", "vswhere.exe");
  writeNew(vswherePath, fakePe("vswhere"));
  const outputRoot = path.resolve(root, "outputs");
  fs.mkdirSync(outputRoot);
  const operationId = options.operationId || "msvc-environment-test/001";
  const request = {
    schema: "tinyrustlm.windows_x64_msvc_environment_request.v1",
    operationId,
    materializedAtUtc: "2026-08-25T20:00:00Z",
    profile: {
      path: profilePath,
      byteLength: environmentTool.profileByteLength,
      sha256: environmentTool.profileSha256,
      profileId: environmentTool.profileId
    },
    discovery: {
      vswhere: artifact(vswherePath),
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
    instanceId: "visual-studio-2022-test-instance",
    installationPath: visualStudioRoot,
    installationVersion: "17.14.37531.7",
    productId: "Microsoft.VisualStudio.Product.Community",
    channelId: "VisualStudio.17.Release",
    isComplete: true,
    isLaunchable: true,
    isPrerelease: false,
    isRebootRequired: false,
    catalog: { productLineVersion: "2022" }
  }, {
    instanceId: "visual-studio-18-ineligible-instance",
    installationPath: visualStudioRoot,
    installationVersion: "18.9.12112.369",
    productId: "Microsoft.VisualStudio.Product.Community",
    channelId: "VisualStudio.18.Release",
    isComplete: true,
    isLaunchable: true,
    isPrerelease: false,
    isRebootRequired: false,
    catalog: { productLineVersion: "18" }
  }];
  if (options.duplicateHighestInstance) {
    instances.push({ ...instances[0], instanceId: "duplicate-highest-instance" });
  }
  const vswhereOutput = Buffer.from(JSON.stringify(instances), "utf8");
  return Object.freeze({ root, visualStudioRoot, toolRoot, msvcBin, msvcLib, kitsRoot,
    systemRoot, system32, outputRoot, vswherePath, request, requestPath, vswhereOutput });
}

function mockVswhere(t, fixture) {
  t.mock.method(childProcess, "spawnSync", (file, argumentsList, options) => {
    assert.equal(file, fixture.vswherePath);
    assert.deepEqual(argumentsList, ["-all", "-products", "*", "-requires",
      "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-format", "json", "-utf8"]);
    assert.equal(options.shell, false);
    assert.equal(options.cwd, fixture.systemRoot);
    assert.deepEqual(options.env, { SystemRoot: fixture.systemRoot });
    return {
      error: undefined,
      status: 0,
      signal: null,
      stdout: fixture.vswhereOutput,
      stderr: Buffer.alloc(0)
    };
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function partialFiles(root) {
  return fs.readdirSync(root).filter((name) => name.endsWith(".partial"));
}

test("freezes the sole prelaunch MSVC environment profile identity", () => {
  const bytes = fs.readFileSync(profilePath);
  assert.equal(bytes.length, 6510);
  assert.equal(sha256(bytes),
    "76de6c5985c000dadedefa457286111af80ebd2deb6e6e3d8de246f6a0eed607");
  assert.equal(environmentTool.profileByteLength, bytes.length);
  assert.equal(environmentTool.profileSha256, sha256(bytes));
  const profile = JSON.parse(bytes.toString("utf8"));
  assert.equal(profile.profileId, "tinyrustlm.windows-x64-msvc-environment/1");
  assert.equal(profile.authority.legacySupport, false);
  assert.equal(profile.authority.fallback, false);
  assert.equal(profile.authority.automaticRetry, false);
  assert.equal(profile.environmentPolicy.explicitCargoTargetLinker, true);
  assert.equal(profile.requestPolicy.absoluteUppercaseLocalDrivePathsOnly, true);
  assert.equal(profile.materializationPolicy.promotion,
    "create-only-same-volume-hard-link");
  assert.equal(profile.materializationPolicy.directoryFlushClaimed, false);
});

test("rejects unknown, reordered, noncanonical, and prohibited output requests", {
  skip: !isWindowsX64
}, (t) => {
  const fixture = makeFixture(t);
  assert.throws(() => environmentTool.validateRequestShape({ ...fixture.request, extra: true }),
    /msvc-environment-request-fields/u);
  const reordered = {
    operationId: fixture.request.operationId,
    schema: fixture.request.schema,
    materializedAtUtc: fixture.request.materializedAtUtc,
    profile: fixture.request.profile,
    discovery: fixture.request.discovery,
    selection: fixture.request.selection,
    outputs: fixture.request.outputs,
    prohibitedWriteRoots: fixture.request.prohibitedWriteRoots
  };
  assert.throws(() => environmentTool.validateRequestShape(reordered),
    /msvc-environment-request-fields/u);
  const compactPath = path.resolve(fixture.root, "compact.json");
  writeNew(compactPath, Buffer.from(JSON.stringify(fixture.request), "utf8"));
  assert.throws(() => environmentTool.prepareRequest(compactPath),
    /msvc-environment-request-json/u);
  const dOutput = {
    ...fixture.request,
    outputs: {
      privateBindingPath: "D:\\environment.private.json",
      publicLockPath: "D:\\environment.public.json",
      terminalPath: "D:\\environment.terminal.json"
    }
  };
  assert.throws(() => environmentTool.validateRequestShape(dOutput),
    /msvc-environment-prohibited-write/u);
});

test("materializes one public-private lock and validates exact current closure", {
  skip: !isWindowsX64
}, (t) => {
  const fixture = makeFixture(t);
  mockVswhere(t, fixture);
  const materialized = environmentTool.materialize(fixture.requestPath);
  assert.equal(materialized.status, "pass");
  assert.equal(materialized.code, "msvc-environment-materialized");
  assert.equal(materialized.selected.visualStudioInstallationVersion, "17.14.37531.7");
  assert.equal(materialized.selected.msvcToolsetVersion, "14.44.35207");
  assert.equal(materialized.selected.windowsSdkVersion, "10.0.26100.0");
  assert.equal(materialized.rustBuildAssessed, false);
  assert.equal(materialized.campaignCreditAuthorized, false);
  assert.deepEqual(partialFiles(fixture.outputRoot), []);

  const publicBytes = fs.readFileSync(fixture.request.outputs.publicLockPath);
  const publicLock = JSON.parse(publicBytes.toString("utf8"));
  const privateBinding = readJson(fixture.request.outputs.privateBindingPath);
  const terminal = readJson(fixture.request.outputs.terminalPath);
  assert.equal(publicBytes.toString("utf8"), canonicalJson(publicLock));
  assert.equal(publicLock.status, "locked");
  assert.equal(publicLock.basis.discovery.candidateCount, 2);
  assert.equal(publicLock.basis.discovery.eligibleCount, 1);
  assert.equal(publicLock.basis.windowsSdk.version, "10.0.26100.0");
  assert.equal(publicLock.privateBinding.sha256,
    sha256(fs.readFileSync(fixture.request.outputs.privateBindingPath)));
  assert.equal(terminal.publicLock.sha256, sha256(publicBytes));
  assert.equal(terminal.status, "pass");
  assert.equal(JSON.stringify(publicLock).includes(fixture.root), false);
  assert.equal(JSON.stringify(terminal).includes(fixture.root), false);
  assert.equal(privateBinding.request.path.startsWith(fixture.root), true);
  assert.equal(privateBinding.selectedVisualStudio.installationPath.startsWith(
    fixture.root), true);
  assert.equal(publicLock.basis.environment.entries.some((entry) =>
    entry.name === "CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER" &&
    entry.valueKind === "private-sha256"), true);
  const validated = environmentTool.validateMaterialization(fixture.requestPath);
  assert.equal(validated.code, "msvc-environment-validation-pass");
  assert.deepEqual(validated.publicLock, materialized.publicLock);
  assert.throws(() => environmentTool.materialize(fixture.requestPath),
    /msvc-environment-output-exists/u);
});

test("rejects an equal-highest Visual Studio instance before writing", {
  skip: !isWindowsX64
}, (t) => {
  const fixture = makeFixture(t, { duplicateHighestInstance: true,
    operationId: "msvc-environment-test/ambiguous" });
  mockVswhere(t, fixture);
  assert.throws(() => environmentTool.materialize(fixture.requestPath),
    /msvc-environment-instance-ambiguous/u);
  assert.deepEqual(fs.readdirSync(fixture.outputRoot), []);
});

test("rejects ambient System32 command collision before writing", {
  skip: !isWindowsX64
}, (t) => {
  const fixture = makeFixture(t, { system32Collision: "link.exe",
    operationId: "msvc-environment-test/system32-collision" });
  mockVswhere(t, fixture);
  assert.throws(() => environmentTool.materialize(fixture.requestPath),
    /msvc-environment-command-resolution/u);
  assert.deepEqual(fs.readdirSync(fixture.outputRoot), []);
});

test("detects byte drift after lock materialization", {
  skip: !isWindowsX64
}, (t) => {
  const fixture = makeFixture(t, { operationId: "msvc-environment-test/drift" });
  mockVswhere(t, fixture);
  environmentTool.materialize(fixture.requestPath);
  fs.appendFileSync(path.join(fixture.kitsRoot, "Lib", "10.0.26100.0", "um", "x64",
    "kernel32.lib"), Buffer.from("drift", "utf8"));
  assert.throws(() => environmentTool.validateMaterialization(fixture.requestPath),
    /msvc-environment-private-binding-drift/u);
  assert.equal(readJson(fixture.request.outputs.terminalPath).status, "pass");
});

test("preserves a partial operation and forbids same-operation resume", {
  skip: !isWindowsX64
}, (t) => {
  const fixture = makeFixture(t, { operationId: "msvc-environment-test/partial" });
  mockVswhere(t, fixture);
  const realLinkSync = fs.linkSync;
  let linkCount = 0;
  t.mock.method(fs, "linkSync", (...argumentsList) => {
    linkCount += 1;
    if (linkCount === 2) {
      const error = new Error("injected publication failure");
      error.code = "EIO";
      throw error;
    }
    return realLinkSync(...argumentsList);
  });
  assert.throws(() => environmentTool.materialize(fixture.requestPath), /injected/u);
  assert.equal(fs.existsSync(fixture.request.outputs.privateBindingPath), true);
  assert.equal(fs.existsSync(fixture.request.outputs.publicLockPath), false);
  assert.equal(fs.existsSync(fixture.request.outputs.terminalPath), false);
  assert.equal(partialFiles(fixture.outputRoot).length, 1);
  assert.throws(() => environmentTool.materialize(fixture.requestPath),
    /msvc-environment-output-exists/u);
});

test("returns only a bounded error code from the command-line boundary", {
  skip: !isWindowsX64
}, () => {
  const result = childProcess.spawnSync(process.execPath, [toolPath, "unknown", "not-a-path"], {
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(result.stderr), {
    schema: "tinyrustlm.windows_x64_msvc_environment_error.v1",
    status: "error",
    code: "msvc-environment-command"
  });
  assert.equal(result.stderr.includes(repositoryRoot), false);
});

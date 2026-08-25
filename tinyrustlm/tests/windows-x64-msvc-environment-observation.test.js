"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const environmentTool = require("../tools/windows-x64-msvc-environment.js");
const repositoryRoot = path.resolve(__dirname, "..", "..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "windows-x64-msvc-environment-profile.v1.json");
const realObservationEnabled =
  process.env.TINYRUSTLM_REAL_MSVC_ENVIRONMENT_OBSERVATION === "1";
const isWindowsX64 = process.platform === "win32" && process.arch === "x64";
const ownedPrefix = "tinyrustlm-real-msvc-environment-observation-";

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function artifact(filePath) {
  const bytes = fs.readFileSync(filePath);
  return { path: filePath, byteLength: bytes.length, sha256: sha256(bytes) };
}

test("observes and revalidates the installed Visual Studio 2022 x64 closure", {
  skip: !isWindowsX64 || !realObservationEnabled,
  timeout: 600_000
}, (t) => {
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  assert.equal(typeof programFilesX86, "string");
  const vswherePath = path.resolve(programFilesX86, "Microsoft Visual Studio", "Installer",
    "vswhere.exe");
  const kitsRoot = path.resolve(programFilesX86, "Windows Kits", "10");
  const systemRoot = path.resolve(process.env.SystemRoot);
  assert.equal(fs.statSync(vswherePath).isFile(), true);
  assert.equal(fs.statSync(kitsRoot).isDirectory(), true);
  assert.equal(fs.statSync(path.join(systemRoot, "System32")).isDirectory(), true);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), ownedPrefix));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.equal(path.basename(resolved).startsWith(ownedPrefix), true);
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const outputRoot = path.resolve(root, "outputs");
  fs.mkdirSync(outputRoot);
  const request = {
    schema: "tinyrustlm.windows_x64_msvc_environment_request.v1",
    operationId: "msvc-environment-real-observation/2026-08-25",
    materializedAtUtc: "2026-08-25T21:00:00Z",
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
  fs.writeFileSync(requestPath, Buffer.from(canonicalJson(request), "utf8"), { flag: "wx" });

  const materialized = environmentTool.materialize(requestPath);
  assert.equal(materialized.status, "pass");
  assert.equal(materialized.selected.visualStudioProductLineVersion, "2022");
  assert.match(materialized.selected.visualStudioInstallationVersion,
    /^17\.[0-9]+\.[0-9]+\.[0-9]+$/u);
  assert.match(materialized.selected.msvcToolsetVersion,
    /^14\.[0-9]+\.[0-9]+$/u);
  assert.match(materialized.selected.windowsSdkVersion,
    /^10\.0\.[0-9]+\.0$/u);
  const validated = environmentTool.validateMaterialization(requestPath);
  assert.equal(validated.status, "pass");
  assert.equal(validated.code, "msvc-environment-validation-pass");
  assert.deepEqual(validated.publicLock, materialized.publicLock);

  const publicBytes = fs.readFileSync(request.outputs.publicLockPath);
  const publicLock = JSON.parse(publicBytes.toString("utf8"));
  assert.equal(publicBytes.toString("utf8"), canonicalJson(publicLock));
  assert.equal(publicLock.basis.inventories.length, 5);
  for (const inventory of publicLock.basis.inventories) {
    assert.ok(inventory.memberCount > 0);
    assert.ok(inventory.aggregateBytes > 0);
    assert.match(inventory.closureSha256, /^[a-f0-9]{64}$/u);
  }
  assert.equal(publicLock.basis.requiredTools.length, 7);
  assert.equal(publicLock.basis.environment.commandResolution.length, 6);
  assert.doesNotMatch(publicBytes.toString("utf8"), /[A-Z]:\\/u);
  assert.equal(publicLock.basis.claimBoundary.rustBuildAssessed, false);
  assert.equal(publicLock.basis.claimBoundary.modelQualityAssessed, false);
  assert.equal(publicLock.basis.claimBoundary.campaignCreditAuthorized, false);
});

"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const {
  materializeArchiveScanHelperPackage
} = require("../../tools/archive-scan-helper-package.js");
const { resolveCargoTargetRoot } = require("./cargo-target-root.js");

const repositoryRoot = [
  process.cwd(),
  path.resolve(process.cwd(), ".."),
  path.resolve(__dirname, "../../..")
].find((candidate) => fs.existsSync(path.join(candidate, "Cargo.lock")) &&
  fs.existsSync(path.join(candidate, "tinyrustlm", "package.json")));
if (repositoryRoot === undefined) {
  throw new Error("archive scan test repository root is unavailable");
}
let cachedPackageRoot;

function cargoExecutable() {
  return process.env.CARGO || (process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
    : "cargo");
}

function runtimeIdentifier() {
  const operatingSystemName = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return `${operatingSystemName}-${process.arch}`;
}

function ensureArchiveScanTestPackage() {
  if (cachedPackageRoot !== undefined) return cachedPackageRoot;
  const configuredPackageRoot = process.env.TINYRUSTLM_ARCHIVE_SCAN_TEST_PACKAGE_ROOT;
  if (configuredPackageRoot !== undefined) {
    if (!path.isAbsolute(configuredPackageRoot) ||
        path.resolve(configuredPackageRoot) !== path.normalize(configuredPackageRoot)) {
      throw new Error("configured archive scan test package root is invalid");
    }
    cachedPackageRoot = configuredPackageRoot;
    return cachedPackageRoot;
  }
  const targetRoot = resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR);
  const result = childProcess.spawnSync(cargoExecutable(), [
    "build", "-p", "tinyrustlm-archive", "--bin",
    "tinyrustlm-archive-scan", "--locked"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`archive scan helper build failed: ${result.error?.code || result.status}`);
  }
  const executableFile = process.platform === "win32"
    ? "tinyrustlm-archive-scan.exe"
    : "tinyrustlm-archive-scan";
  const packageRoot = path.join(
    targetRoot,
    "archive-scan-test-packages",
    `${runtimeIdentifier()}-${process.pid}`
  );
  fs.rmSync(packageRoot, { recursive: true, force: true });
  const resultIdentity = materializeArchiveScanHelperPackage({
    buildProfile: "debug",
    executablePath: path.join(targetRoot, "debug", executableFile),
    outputRoot: packageRoot,
    trustClass: "local-test-build"
  });
  if (resultIdentity.outputRoot !== packageRoot) {
    throw new Error("archive scan test package output identity mismatch");
  }
  cachedPackageRoot = packageRoot;
  return cachedPackageRoot;
}

module.exports = Object.freeze({ ensureArchiveScanTestPackage });

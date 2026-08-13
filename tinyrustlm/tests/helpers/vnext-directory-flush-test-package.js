"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalizeVnextJcsBytes } = require("../../tools/vnext-jcs.js");
const { resolveCargoTargetRoot } = require("./cargo-target-root.js");

const repositoryRoot = path.resolve(__dirname, "../../..");
const packageEnvironmentVariable = "TINYRUSTLM_DIRECTORY_FLUSH_PACKAGE_ROOT";
let cachedPackageRoot;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function operatingSystem() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return process.platform;
}

function architecture() {
  if (process.arch === "x64") return "x86_64";
  if (process.arch === "arm64") return "aarch64";
  return process.arch;
}

function runtimeIdentifier() {
  const osName = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function cargoExecutable() {
  return process.env.CARGO || (process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
    : "cargo");
}

function sourceClosureSha256() {
  const paths = [
    "Cargo.lock",
    "Cargo.toml",
    "contracts/vnext/directory-flush-profile.v1.json",
    "rust/crates/tinyrustlm-durability/Cargo.toml",
    "rust/crates/tinyrustlm-durability/src/bin/tinyrustlm-directory-flush.rs",
    "rust/crates/tinyrustlm-durability/src/lib.rs"
  ];
  const members = paths.map((relativePath) => {
    const bytes = fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")));
    return Object.freeze({
      byteCount: bytes.length,
      path: relativePath,
      sha256: sha256(bytes)
    });
  });
  return sha256(canonicalizeVnextJcsBytes(members));
}

function writeExact(filePath, bytes) {
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 });
  try {
    fs.renameSync(temporary, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch (_cleanupError) {
      // The generated target tree is disposable test output.
    }
    throw error;
  }
}

function ensureVnextDirectoryFlushTestPackage() {
  if (cachedPackageRoot !== undefined) return cachedPackageRoot;
  const targetRoot = resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR);
  const result = childProcess.spawnSync(cargoExecutable(), [
    "build", "-p", "tinyrustlm-durability", "--bin",
    "tinyrustlm-directory-flush", "--locked"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`directory flush helper build failed: ${result.error?.code || result.status}`);
  }

  const executableFile = process.platform === "win32"
    ? "tinyrustlm-directory-flush.exe"
    : "tinyrustlm-directory-flush";
  const sourceExecutable = path.join(targetRoot, "debug", executableFile);
  const executableBytes = fs.readFileSync(sourceExecutable);
  const sourceClosure = sourceClosureSha256();
  const packageRoot = path.join(
    targetRoot,
    "vnext-directory-flush-test-packages",
    `${runtimeIdentifier()}-${process.pid}-${sourceClosure.slice(0, 16)}`
  );
  fs.rmSync(packageRoot, { recursive: true, force: true });
  fs.mkdirSync(packageRoot, { recursive: true, mode: 0o700 });
  writeExact(path.join(packageRoot, executableFile), executableBytes);

  const profileBytes = fs.readFileSync(path.join(
    repositoryRoot,
    "contracts",
    "vnext",
    "directory-flush-profile.v1.json"
  ));
  const manifest = Object.freeze({
    architecture: architecture(),
    buildProfile: "debug",
    directoryFlushProfileId: "tinyrustlm.vnext.directory-flush.v1",
    directoryFlushProfileSha256: sha256(profileBytes),
    executableByteCount: executableBytes.length,
    executableFile,
    executableSha256: sha256(executableBytes),
    operatingSystem: operatingSystem(),
    runtimeIdentifier: runtimeIdentifier(),
    schema: "tinyrustlm.vnext.directory_flush_helper_manifest.v1",
    sourceClosureSha256: sourceClosure,
    trustClass: "local-test-build"
  });
  writeExact(
    path.join(packageRoot, "directory-flush-helper-manifest.v1.json"),
    canonicalizeVnextJcsBytes(manifest)
  );
  process.env[packageEnvironmentVariable] = packageRoot;
  cachedPackageRoot = packageRoot;
  return cachedPackageRoot;
}

module.exports = Object.freeze({
  ensureVnextDirectoryFlushTestPackage,
  packageEnvironmentVariable
});

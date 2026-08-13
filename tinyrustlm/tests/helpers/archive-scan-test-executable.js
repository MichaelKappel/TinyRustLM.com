"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalizeVnextJcsBytes } = require("../../tools/vnext-jcs.js");
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
let cachedExecutablePath;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function cargoExecutable() {
  return process.env.CARGO || (process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
    : "cargo");
}

function runtimeIdentifier() {
  const operatingSystem = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return `${operatingSystem}-${process.arch}`;
}

function sourceClosureSha256() {
  const paths = [
    "Cargo.lock",
    "Cargo.toml",
    "contracts/vnext/archive-admission-profile.v1.json",
    "contracts/vnext/archive-scan-process-profile.v1.json",
    "rust/crates/tinyrustlm-archive/Cargo.toml",
    "rust/crates/tinyrustlm-archive/src/bin/tinyrustlm-archive-scan.rs",
    "rust/crates/tinyrustlm-archive/src/lib.rs",
    "rust/crates/tinyrustlm-archive/src/path_contract.rs",
    "rust/crates/tinyrustlm-archive/src/process_protocol.rs",
    "rust/crates/tinyrustlm-archive/src/tar_gzip_format.rs",
    "rust/crates/tinyrustlm-archive/src/zip_format.rs"
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
  fs.writeFileSync(temporary, bytes, { flag: "wx", mode: 0o700 });
  try {
    fs.renameSync(temporary, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch (_cleanupError) {
      // The generated test package is disposable output.
    }
    throw error;
  }
}

function ensureArchiveScanTestExecutable() {
  if (cachedExecutablePath !== undefined) return cachedExecutablePath;
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
  const executableBytes = fs.readFileSync(path.join(targetRoot, "debug", executableFile));
  const packageRoot = path.join(
    targetRoot,
    "archive-scan-test-packages",
    `${runtimeIdentifier()}-${process.pid}-${sourceClosureSha256().slice(0, 16)}`
  );
  fs.rmSync(packageRoot, { recursive: true, force: true });
  fs.mkdirSync(packageRoot, { recursive: true, mode: 0o700 });
  cachedExecutablePath = path.join(packageRoot, executableFile);
  writeExact(cachedExecutablePath, executableBytes);
  return cachedExecutablePath;
}

module.exports = Object.freeze({ ensureArchiveScanTestExecutable });

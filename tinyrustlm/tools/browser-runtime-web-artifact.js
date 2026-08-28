#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const loader = require("../app/browser-runtime-loader.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const targetRoot = path.join(repositoryRoot, "target", "browser-runtime-web-artifact");
const builtWasmPath = path.join(
  targetRoot,
  "wasm32-unknown-unknown",
  "release",
  "tinyrustlm_browser_runtime_wasm.wasm"
);
const publicWasmPath = path.join(
  repositoryRoot,
  "tinyrustlm",
  "runtime",
  "tinyrustlm-browser-runtime.wasm"
);
const publicManifestPath = `${publicWasmPath}.manifest.json`;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function cargoExecutable() {
  if (process.env.CARGO) {
    return process.env.CARGO;
  }
  const candidate = process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
    : "cargo";
  return fs.existsSync(candidate) ? candidate : "cargo";
}

function buildWasm() {
  const result = childProcess.spawnSync(cargoExecutable(), [
    "build",
    "--locked",
    "--offline",
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "--target-dir",
    targetRoot,
    "-p",
    "tinyrustlm-browser-runtime-wasm"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  invariant(result.error === undefined, "browser runtime Cargo process failed");
  invariant(result.status === 0, "browser runtime Cargo build failed");
  const bytes = fs.readFileSync(builtWasmPath);
  invariant(bytes.length >= 8 && bytes.length <= loader.maximumWasmBytes,
    "browser runtime WASM size is invalid");
  return bytes;
}

function buildManifest(bytes) {
  const module = new WebAssembly.Module(bytes);
  const imports = WebAssembly.Module.imports(module).map((entry) => entry.name);
  const exports = WebAssembly.Module.exports(module).map((entry) => entry.name);
  invariant(imports.length === 0, "browser runtime WASM imports are forbidden");
  invariant(
    JSON.stringify(exports) === JSON.stringify(loader.requiredExports),
    "browser runtime WASM export closure drifted"
  );
  return loader.normalizeManifest({
    schema: loader.manifestSchema,
    profileId: loader.profileId,
    workerProtocol: loader.workerProtocol,
    sourceCrate: "tinyrustlm-browser-runtime-wasm",
    buildProfile: "cargo-release-wasm32-unknown-unknown-locked-offline",
    byteCount: bytes.length,
    sha256: sha256(bytes),
    maximumMemoryBytes: loader.maximumMemoryBytes,
    imports,
    exports,
    requiredNextGate: "worker-initialize-and-six-member-activation"
  });
}

function createArtifact() {
  const wasmBytes = buildWasm();
  const manifest = buildManifest(wasmBytes);
  const manifestBytes = Buffer.from(loader.serializeManifest(manifest), "utf8");
  return Object.freeze({ wasmBytes, manifest, manifestBytes });
}

function requireEqualFile(filePath, expected, label) {
  invariant(fs.existsSync(filePath), `${label} is missing`);
  invariant(fs.readFileSync(filePath).equals(expected), `${label} does not match a fresh build`);
}

function verifyArtifact(artifact) {
  requireEqualFile(publicWasmPath, artifact.wasmBytes, "tracked browser runtime WASM");
  requireEqualFile(
    publicManifestPath,
    artifact.manifestBytes,
    "tracked browser runtime manifest"
  );
  return artifact;
}

function writeArtifact(artifact) {
  fs.writeFileSync(publicWasmPath, artifact.wasmBytes, { flag: "w" });
  fs.writeFileSync(publicManifestPath, artifact.manifestBytes, { flag: "w" });
  return verifyArtifact(artifact);
}

function main() {
  const mode = process.argv[2] || "check";
  invariant(mode === "check" || mode === "write",
    "Usage: browser-runtime-web-artifact.js [check|write]");
  const artifact = createArtifact();
  if (mode === "write") {
    writeArtifact(artifact);
  } else {
    verifyArtifact(artifact);
  }
  process.stdout.write(
    `Browser runtime web artifact ${mode} passed: ` +
    `${artifact.manifest.byteCount} bytes / sha256:${artifact.manifest.sha256}\n`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (_) {
    process.stderr.write("Browser runtime web artifact check failed\n");
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  builtWasmPath,
  publicManifestPath,
  publicWasmPath,
  buildManifest,
  createArtifact,
  verifyArtifact,
  writeArtifact
});

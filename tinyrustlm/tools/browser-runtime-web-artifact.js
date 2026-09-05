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
  "browser-runtime",
  "tinyrustlm-browser-runtime.wasm"
);
const publicManifestPath = `${publicWasmPath}.manifest.json`;
const encodedRustFlagSeparator = "\u001f";
const ambientRustFlagVariables = Object.freeze([
  "CARGO_BUILD_RUSTC",
  "CARGO_ENCODED_RUSTFLAGS",
  "RUSTC_WRAPPER",
  "RUSTC_WORKSPACE_WRAPPER",
  "RUSTFLAGS"
]);
const forbiddenBuildPathPatterns = Object.freeze([
  /(?<![A-Za-z0-9+.-])[A-Za-z]:[\\/]/u,
  /(?:^|[\x00-\x20"'`=(])\\\\(?:[?]\\)?[^\\/\x00-\x20]+[\\/]/u,
  /(?:^|[\x00-\x20"'`=(])\/(?:Users|home|private|tmp|var\/tmp|Volumes)(?:[\\/])/u,
  /(?:^|[\x00-\x20"'`=(])\/mnt\/[A-Za-z](?:[\\/])/u
]);

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

function existingRealPath(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const resolved = path.resolve(value);
  return fs.existsSync(resolved) ? fs.realpathSync.native(resolved) : resolved;
}

function remapRoots(environment, options) {
  const home = environment.USERPROFILE || environment.HOME || null;
  const candidates = [
    [options.sourceRoot || repositoryRoot, "tinyrustlm-workspace"],
    [options.targetRoot || targetRoot, "cargo-target"],
    [environment.CARGO_HOME || (home ? path.join(home, ".cargo") : null), "cargo-home"],
    [environment.RUSTUP_HOME || (home ? path.join(home, ".rustup") : null), "rustup-home"],
    [options.temporaryRoot || environment.TEMP || environment.TMP, "build-temp"],
    [home, "build-home"]
  ];
  const seen = new Set();
  const roots = [];
  for (const [candidate, replacement] of candidates) {
    if (!candidate) continue;
    const source = existingRealPath(candidate);
    if (!path.isAbsolute(source)) continue;
    for (const variant of [source, source.replaceAll("\\", "/")]) {
      const identity = process.platform === "win32" ? variant.toLowerCase() : variant;
      if (seen.has(identity)) continue;
      seen.add(identity);
      roots.push(Object.freeze({ replacement, source: variant }));
    }
  }
  return roots.sort((left, right) =>
    right.source.length - left.source.length ||
    left.replacement.localeCompare(right.replacement, "en") ||
    left.source.localeCompare(right.source, "en")
  );
}

function deterministicRustFlags(environment, options = {}) {
  return Object.freeze([
    ...remapRoots(environment, options).map(
      ({ source, replacement }) => `--remap-path-prefix=${source}=${replacement}`
    ),
    "-Cdebuginfo=0",
    "-Cstrip=symbols"
  ]);
}

function createDeterministicBuildEnvironment(baseEnvironment, options = {}) {
  const environment = { ...baseEnvironment };
  for (const variableName of ambientRustFlagVariables) delete environment[variableName];
  environment.CARGO_INCREMENTAL = "0";
  environment.CARGO_NET_OFFLINE = "true";
  if (options.targetRoot) environment.CARGO_TARGET_DIR = path.resolve(options.targetRoot);
  environment.CARGO_ENCODED_RUSTFLAGS = deterministicRustFlags(
    environment,
    options
  ).join(encodedRustFlagSeparator);
  return environment;
}

function assertNoForbiddenBuildPaths(value) {
  invariant(Buffer.isBuffer(value) || ArrayBuffer.isView(value),
    "browser runtime WASM bytes are required");
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  const binaryText = bytes.toString("latin1");
  invariant(
    forbiddenBuildPathPatterns.every((pattern) => !pattern.test(binaryText)),
    "browser runtime WASM contains a forbidden build path"
  );
  return value;
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
    env: createDeterministicBuildEnvironment(process.env, {
      sourceRoot: repositoryRoot,
      targetRoot,
      temporaryRoot: process.env.TEMP || process.env.TMP
    }),
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  invariant(result.error === undefined, "browser runtime Cargo process failed");
  invariant(result.status === 0, "browser runtime Cargo build failed");
  const bytes = fs.readFileSync(builtWasmPath);
  invariant(bytes.length >= 8 && bytes.length <= loader.maximumWasmBytes,
    "browser runtime WASM size is invalid");
  assertNoForbiddenBuildPaths(bytes);
  return bytes;
}

function buildManifest(bytes) {
  assertNoForbiddenBuildPaths(bytes);
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
    requiredNextGate:
      "real-qwen3-native-wasm-parity-clean-profile-quality-and-companion-acquisition"
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
  assertNoForbiddenBuildPaths(artifact.wasmBytes);
  requireEqualFile(publicWasmPath, artifact.wasmBytes, "tracked browser runtime WASM");
  assertNoForbiddenBuildPaths(fs.readFileSync(publicWasmPath));
  requireEqualFile(
    publicManifestPath,
    artifact.manifestBytes,
    "tracked browser runtime manifest"
  );
  return artifact;
}

function writeArtifact(artifact) {
  assertNoForbiddenBuildPaths(artifact.wasmBytes);
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
  assertNoForbiddenBuildPaths,
  builtWasmPath,
  createDeterministicBuildEnvironment,
  publicManifestPath,
  publicWasmPath,
  buildManifest,
  createArtifact,
  verifyArtifact,
  writeArtifact
});

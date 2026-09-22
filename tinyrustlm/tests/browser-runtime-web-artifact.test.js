"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const loader = require("../app/browser-runtime-loader.js");
const artifactTool = require("../tools/browser-runtime-web-artifact.js");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } =
  require("../tools/canonical-operation-scratch.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const manifestRelativePath =
  "tinyrustlm/browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json";
const wasmRelativePath =
  "tinyrustlm/browser-runtime/tinyrustlm-browser-runtime.wasm";
const candidatePackage = "tinyrustlm-browser-runtime-wasm";
const candidateTarget = "wasm32-unknown-unknown";
const candidateFileName = "tinyrustlm_browser_runtime_wasm.wasm";
const expectedTracked = Object.freeze({
  manifestByteCount: 1209,
  manifestSha256: "c64f9d28a35bda7b3e39667cc512a149e78e5cda9973e4fc259b640b897ce2bb",
  wasmByteCount: 576696,
  wasmSha256: "43225b5f986ed2d1f1f445157693761d99550e0cd6eb7e1ca01aba83bb217c7a"
});
const exactToolchain = Object.freeze({
  cargoCommit: "30a34c6821b57de0aaec83a901aca39f88f6778c",
  cargoExecutableSha256:
    "122f18d28a63fa358f3db266abee1ff1d8aabf0ab7f2dd9ac38a38da99977ae5",
  cargoFirstLine: "cargo 1.96.0 (30a34c682 2026-05-25)",
  host: "x86_64-pc-windows-msvc",
  llvm: "22.1.2",
  release: "1.96.0",
  rustcCommit: "ac68faa20c58cbccd01ee7208bf3b6e93a7d7f96",
  rustcExecutableSha256:
    "acb138286bbe20c6cf3ec39a7e0a68c3fab0cd949baa2912cf466514d0d531ab",
  rustcFirstLine: "rustc 1.96.0 (ac68faa20 2026-05-25)",
  rustupProxySha256:
    "86478e53f769379d7f0ebfa7c9aa97cb76ca92233f79aa2cc0dbee2efaac73c7",
  rustupToolchain: "stable"
});
const forbiddenBuildEnvironment = Object.freeze([
  "CARGO_BUILD_RUSTC",
  "CARGO_ENCODED_RUSTFLAGS",
  "RUSTC_WRAPPER",
  "RUSTC_WORKSPACE_WRAPPER",
  "RUSTFLAGS"
]);

let candidate;
let candidateFailure;
let tracked;

/** Returns lowercase SHA-256 for an in-memory byte sequence. */
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Runs one bounded synchronous command and returns stdout only on clean exit. */
function command(executable, arguments_, options = {}) {
  const result = childProcess.spawnSync(executable, arguments_, {
    cwd: options.cwd || repositoryRoot,
    encoding: options.encoding === undefined ? "utf8" : options.encoding,
    env: options.env || process.env,
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(result.error, undefined,
    `${options.label || executable} spawn failed: ${result.error?.code}`);
  assert.equal(result.signal, null, `${options.label || executable} was terminated`);
  assert.equal(result.status, 0,
    `${options.label || executable} failed:\n${result.stdout || ""}\n${result.stderr || ""}`);
  return result.stdout;
}

/** Loads and validates the pinned tracked worktree artifact tuple once. */
function trackedArtifact() {
  if (tracked) return tracked;
  const wasmBytes = fs.readFileSync(path.join(repositoryRoot, wasmRelativePath));
  const manifestBytes = fs.readFileSync(path.join(repositoryRoot, manifestRelativePath));
  assert.equal(wasmBytes.length, expectedTracked.wasmByteCount);
  assert.equal(sha256(wasmBytes), expectedTracked.wasmSha256);
  assert.equal(manifestBytes.length, expectedTracked.manifestByteCount);
  assert.equal(sha256(manifestBytes), expectedTracked.manifestSha256);
  const manifest = loader.parseManifestBytes(manifestBytes);
  assert.equal(manifest.byteCount, wasmBytes.length);
  assert.equal(manifest.sha256, sha256(wasmBytes));
  assert.deepEqual(manifest.imports, []);
  assert.deepEqual(manifest.exports, loader.requiredExports);
  assert.equal(
    loader.serializeManifest(artifactTool.buildManifest(wasmBytes)),
    manifestBytes.toString("utf8")
  );
  tracked = Object.freeze({ wasmBytes, manifest, manifestBytes });
  return tracked;
}

/** Requires an absolute non-link E-drive directory and returns its normalized path. */
function requireDirectEDirectory(value, label) {
  assert.equal(typeof value, "string", `${label} must be a path`);
  assert.ok(path.isAbsolute(value), `${label} must be absolute`);
  const normalized = path.resolve(value);
  assert.equal(path.parse(normalized).root.toLowerCase(), "e:\\",
    `${label} must be on E:`);
  const stat = fs.lstatSync(normalized);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink(),
    `${label} must be a direct directory`);
  return normalized;
}

/** Captures build-relevant process variables for the restoration check. */
function environmentSnapshot() {
  const names = [
    "CARGO", "CARGO_HOME", "CARGO_TARGET_DIR", "RUSTC", "RUSTUP_HOME",
    "RUSTUP_TOOLCHAIN", "TEMP", "TMP", ...forbiddenBuildEnvironment
  ];
  return Object.freeze(Object.fromEntries(names.map((name) => [
    name,
    Object.hasOwn(process.env, name) ? process.env[name] : null
  ])));
}

/** Parses verbose tool identity output into its first line and named fields. */
function parseVerboseVersion(value) {
  const lines = value.trim().split(/\r?\n/u);
  const fields = new Map();
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(": ");
    if (separator > 0) fields.set(line.slice(0, separator), line.slice(separator + 2));
  }
  return Object.freeze({ firstLine: lines[0], fields });
}

/** Resolves installed stable through rustup and verifies exact toolchain custody. */
function discoverExactToolchain() {
  assert.equal(process.platform, "win32");
  const discovered = command("where.exe", ["rustup.exe"], {
    label: "rustup proxy discovery"
  }).trim().split(/\r?\n/u).map((value) => path.resolve(value));
  const rustupPath = discovered.find((value) =>
    path.isAbsolute(value) && fs.existsSync(value) && fs.statSync(value).isFile() &&
    sha256(fs.readFileSync(value)) === exactToolchain.rustupProxySha256);
  assert.equal(typeof rustupPath, "string", "exact rustup proxy was not found");
  const toolchains = command(rustupPath, ["toolchain", "list"], {
    label: "installed Rust toolchains"
  });
  assert.match(toolchains, /^stable-x86_64-pc-windows-msvc\b.*\b(?:active|default)\b/mu);
  const cargoPath = path.resolve(command(rustupPath, [
    "which", "cargo", "--toolchain", exactToolchain.rustupToolchain
  ], { label: "stable Cargo path" }).trim());
  const rustcPath = path.resolve(command(rustupPath, [
    "which", "rustc", "--toolchain", exactToolchain.rustupToolchain
  ], { label: "stable rustc path" }).trim());
  assert.ok(fs.statSync(cargoPath).isFile());
  assert.ok(fs.statSync(rustcPath).isFile());
  assert.equal(path.dirname(cargoPath), path.dirname(rustcPath));

  const cargo = parseVerboseVersion(command(cargoPath, ["--version", "--verbose"], {
    label: "exact Cargo"
  }));
  const rustc = parseVerboseVersion(command(rustcPath, ["--version", "--verbose"], {
    label: "exact rustc"
  }));
  assert.equal(cargo.firstLine, exactToolchain.cargoFirstLine);
  assert.equal(cargo.fields.get("release"), exactToolchain.release);
  assert.equal(cargo.fields.get("commit-hash"), exactToolchain.cargoCommit);
  assert.equal(cargo.fields.get("host"), exactToolchain.host);
  assert.equal(rustc.firstLine, exactToolchain.rustcFirstLine);
  assert.equal(rustc.fields.get("release"), exactToolchain.release);
  assert.equal(rustc.fields.get("commit-hash"), exactToolchain.rustcCommit);
  assert.equal(rustc.fields.get("host"), exactToolchain.host);
  assert.equal(rustc.fields.get("LLVM version"), exactToolchain.llvm);

  const sysroot = path.resolve(cargoPath, "..", "..");
  assert.equal(path.resolve(command(rustcPath, ["--print", "sysroot"], {
    label: "rustc sysroot"
  }).trim()), sysroot);
  const realCargoPath = path.join(sysroot, "bin", "cargo.exe");
  const realRustcPath = path.join(sysroot, "bin", "rustc.exe");
  assert.equal(cargoPath, realCargoPath);
  assert.equal(rustcPath, realRustcPath);
  assert.equal(sha256(fs.readFileSync(realCargoPath)), exactToolchain.cargoExecutableSha256);
  assert.equal(sha256(fs.readFileSync(realRustcPath)), exactToolchain.rustcExecutableSha256);
  const targetLibraryDirectory = path.resolve(command(rustcPath, [
    "--print",
    "target-libdir",
    "--target",
    candidateTarget
  ], { label: "rustc target library" }).trim());
  const relativeTargetLibrary = path.relative(sysroot, targetLibraryDirectory);
  assert.ok(relativeTargetLibrary.length > 0 &&
    !relativeTargetLibrary.startsWith("..") &&
    !path.isAbsolute(relativeTargetLibrary));
  assert.ok(fs.statSync(targetLibraryDirectory).isDirectory());
  return Object.freeze({
    cargoPath,
    rustcPath,
    rustupPath,
    sysroot,
    targetLibraryDirectory
  });
}

/** Creates a child-only offline environment bound to owned scratch and target roots. */
function buildEnvironment(custody, scratchDirectory, targetDirectory) {
  const environment = { ...process.env };
  for (const variableName of forbiddenBuildEnvironment) delete environment[variableName];
  delete environment.RUSTUP_HOME;
  delete environment.RUSTUP_TOOLCHAIN;
  environment.CARGO = custody.cargoPath;
  environment.CARGO_HOME = process.env.CARGO_HOME ||
    path.dirname(path.dirname(custody.rustupPath));
  // Bind virtual home remapping to the pinned toolchain owner, not the invoking account.
  environment.USERPROFILE = path.dirname(environment.CARGO_HOME);
  environment.CARGO_INCREMENTAL = "0";
  environment.CARGO_NET_OFFLINE = "true";
  environment.CARGO_TARGET_DIR = targetDirectory;
  environment.RUSTC = custody.rustcPath;
  environment.TEMP = scratchDirectory;
  environment.TMP = scratchDirectory;
  assert.ok(path.isAbsolute(environment.CARGO_HOME) &&
    fs.statSync(environment.CARGO_HOME).isDirectory());
  return artifactTool.createDeterministicBuildEnvironment(environment, {
    sourceRoot: repositoryRoot,
    targetRoot: targetDirectory,
    temporaryRoot: scratchDirectory
  });
}

/** Builds one release WASM candidate into a previously absent owned target. */
function buildCandidate(custody, targetDirectory, scratchDirectory) {
  command(custody.cargoPath, [
    "build",
    "--locked",
    "--offline",
    "--release",
    "--target",
    candidateTarget,
    "--target-dir",
    targetDirectory,
    "-p",
    candidatePackage
  ], {
    env: buildEnvironment(custody, scratchDirectory, targetDirectory),
    label: `browser runtime build ${path.basename(targetDirectory)}`
  });
  const wasmPath = path.join(
    targetDirectory,
    candidateTarget,
    "release",
    candidateFileName
  );
  const bytes = fs.readFileSync(wasmPath);
  assert.ok(bytes.length >= 8 && bytes.length <= loader.maximumWasmBytes);
  return bytes;
}

/** Compares two transient candidates without mutating or retaining public artifacts. */
function createCandidateArtifact() {
  if (candidate) return candidate;
  if (candidateFailure) throw candidateFailure;
  const environmentBefore = environmentSnapshot();
  const custody = discoverExactToolchain();
  const owned = createOwnedTemporaryDirectory({
    temporaryParent: path.join(repositoryRoot, "artifacts", "tests", "browser-runtime-build")
  });
  const ownedRoot = owned.rootPath;
  const targetA = path.join(ownedRoot, "build-a");
  const targetB = path.join(ownedRoot, "build-b");
  const scratchA = path.join(ownedRoot, "scratch-a");
  const scratchB = path.join(ownedRoot, "scratch-b");
  assert.notEqual(targetA, targetB);
  let wasmA;
  let wasmB;
  try {
    for (const scratch of [scratchA, scratchB]) {
      fs.mkdirSync(scratch, { recursive: false });
      requireDirectEDirectory(scratch, "browser runtime build scratch");
    }
    for (const target of [targetA, targetB]) {
      assert.equal(path.parse(path.resolve(target)).root.toLowerCase(), "e:\\");
      const relative = path.relative(ownedRoot, target);
      assert.ok(relative.length > 0 &&
        !relative.startsWith("..") && !path.isAbsolute(relative));
      assert.equal(fs.existsSync(target), false);
    }

    const publicWasmBefore = fs.readFileSync(artifactTool.publicWasmPath);
    const publicManifestBefore = fs.readFileSync(artifactTool.publicManifestPath);
    wasmA = buildCandidate(custody, targetA, scratchA);
    wasmB = buildCandidate(custody, targetB, scratchB);
    assert.ok(wasmA.equals(wasmB), "fresh browser runtime builds differ");
    const manifestA = artifactTool.buildManifest(wasmA);
    const manifestB = artifactTool.buildManifest(wasmB);
    const manifestBytesA = Buffer.from(loader.serializeManifest(manifestA), "utf8");
    const manifestBytesB = Buffer.from(loader.serializeManifest(manifestB), "utf8");
    assert.ok(manifestBytesA.equals(manifestBytesB), "fresh manifests differ");
    assert.ok(wasmA.equals(publicWasmBefore),
      "fresh browser runtime build differs from the tracked artifact");
    assert.ok(manifestBytesA.equals(publicManifestBefore),
      "fresh browser runtime manifest differs from the tracked manifest");
    wasmB.fill(0);
    manifestBytesB.fill(0);
    candidate = Object.freeze({
      manifest: manifestA,
      manifestBytes: manifestBytesA,
      ownedRoot,
      publicManifestBefore,
      publicWasmBefore,
      scratchA,
      scratchB,
      targetA,
      targetB,
      wasmBytes: wasmA
    });
  } catch (error) {
    candidateFailure = error;
  } finally {
    if (wasmB) wasmB.fill(0);
    try {
      removeOwnedTemporaryDirectory(owned);
    } catch (error) {
      candidateFailure = candidateFailure
        ? new AggregateError([candidateFailure, error], "Runtime build and cleanup failed") : error;
    }
    if (candidateFailure) {
      candidate = null;
      throw candidateFailure;
    }
    assert.equal(fs.existsSync(ownedRoot), false);
    assert.deepEqual(environmentSnapshot(), environmentBefore);
  }
  return candidate;
}

/** Declares that source verification alone never authorizes artifact promotion. */
function sourceVerificationPromotionStatus() {
  return Object.freeze({
    authorized: false,
    code: "browser-runtime-promotion-requires-registration-owner"
  });
}

test("binary path gate rejects host paths and permits deterministic virtual paths", () => {
  const hostilePaths = [
    "C:\\Users\\operator\\.cargo\\registry\\src\\crate\\src\\lib.rs",
    "D:/build/TinyRustLM/rust/crates/runtime/src/lib.rs",
    "\\\\build-server\\private-share\\runtime.rs",
    "/home/operator/.cargo/registry/src/crate/src/lib.rs",
    "/Users/operator/.cargo/registry/src/crate/src/lib.rs",
    "/private/tmp/tinyrustlm/runtime.rs",
    "/tmp/tinyrustlm/runtime.rs",
    "/var/tmp/tinyrustlm/runtime.rs",
    "/Volumes/build/tinyrustlm/runtime.rs"
  ];
  for (const hostilePath of hostilePaths) {
    assert.throws(
      () => artifactTool.assertNoForbiddenBuildPaths(Buffer.from(hostilePath, "utf8")),
      /forbidden build path/u
    );
  }

  assert.doesNotThrow(() => artifactTool.assertNoForbiddenBuildPaths(Buffer.from(
    [
      "rust\\crates\\tinyrustlm-runtime\\src\\scalar.rs",
      "cargo-home\\registry\\src\\crate\\src\\lib.rs",
      "/rustc/ac68faa20c58cbccd01ee7208bf3b6e93a7d7f96/library/core/src/slice/index.rs",
      "https://tinyrustlm.com/browser-runtime/runtime.wasm"
    ].join("\n"),
    "utf8"
  )));
});

test("tracked browser runtime contains no absolute or private build paths", () => {
  assert.doesNotThrow(() => artifactTool.assertNoForbiddenBuildPaths(
    fs.readFileSync(artifactTool.publicWasmPath)
  ));
});

test("browser runtime artifact and manifest remain the current tracked identity", () => {
  const value = trackedArtifact();
  assert.equal(value.manifest.schema, "tinyrustlm.browser-runtime-wasm-manifest/1");
  assert.equal(value.manifest.profileId, "tinyrustlm.browser-runtime-wasm/1");
  assert.equal(value.manifest.workerProtocol, "tinyrustlm.model-runtime-worker/1");
  assert.equal(value.manifest.maximumMemoryBytes, 3 * 1024 * 1024 * 1024);
  assert.equal(loader.serializeManifest(value.manifest), value.manifestBytes.toString("utf8"));
});

test("current source reproduces in two owned E-drive roots without promotion", {
  timeout: 180_000
}, () => {
  const value = createCandidateArtifact();
  assert.equal(fs.existsSync(value.ownedRoot), false);
  assert.equal(fs.existsSync(value.scratchA), false);
  assert.equal(fs.existsSync(value.scratchB), false);
  assert.equal(fs.existsSync(value.targetA), false);
  assert.equal(fs.existsSync(value.targetB), false);
  assert.ok(fs.readFileSync(artifactTool.publicWasmPath).equals(value.publicWasmBefore));
  assert.ok(fs.readFileSync(artifactTool.publicManifestPath).equals(value.publicManifestBefore));
  assert.deepEqual(sourceVerificationPromotionStatus(), {
    authorized: false,
    code: "browser-runtime-promotion-requires-registration-owner"
  });
});

test("fresh manifest parser rejects noncanonical, permissive, and wrong-ABI declarations", () => {
  const value = createCandidateArtifact().manifest;
  assert.throws(
    () => loader.parseManifestBytes(Buffer.from(JSON.stringify(value, null, 2), "utf8")),
    (error) => error.code === "browser-runtime-manifest-canonical"
  );
  assert.throws(
    () => loader.normalizeManifest({ ...value, legacyRuntime: true }),
    (error) => error.code === "browser-runtime-manifest-fields"
  );
  assert.throws(
    () => loader.normalizeManifest({
      ...value,
      workerProtocol: "tinyrustlm.legacy-worker/1"
    }),
    (error) => error.code === "browser-runtime-manifest-worker"
  );
  assert.throws(
    () => loader.normalizeManifest({
      ...value,
      exports: value.exports.slice(0, -1)
    }),
    (error) => error.code === "browser-runtime-manifest-exports"
  );
});

test("loader verifies fresh bytes without instantiating WASM in the top-window boundary", async () => {
  const value = createCandidateArtifact();
  const manifestUrl = "https://tinyrustlm.test/runtime/runtime.manifest.json";
  const wasmUrl = "https://tinyrustlm.test/runtime/runtime.wasm";
  const responses = new Map([
    [manifestUrl, value.manifestBytes],
    [wasmUrl, value.wasmBytes]
  ]);
  const calls = [];
  const result = await loader.load({
    manifestUrl,
    wasmUrl,
    async fetchFunction(url, options) {
      calls.push({ url, options });
      const bytes = responses.get(url);
      return new Response(bytes, { headers: { "Content-Length": String(bytes.length) } });
    }
  });
  assert.equal(result.manifest.sha256, value.manifest.sha256);
  assert.equal(result.wasmBytes.byteLength, value.wasmBytes.length);
  assert.equal(calls[0].options.signal, calls[1].options.signal);
  assert.equal(calls[0].options.signal.aborted, false);
  assert.deepEqual(calls.map(({ options: { signal, ...options } }) => options), [
    { cache: "no-store", credentials: "omit" },
    { cache: "no-store", credentials: "omit" }
  ]);
  assert.doesNotMatch(
    fs.readFileSync(require.resolve("../app/browser-runtime-loader.js"), "utf8"),
    /WebAssembly\.instantiate/u
  );
});

test("loader wipes and rejects a fresh WASM identity mismatch", async () => {
  const value = createCandidateArtifact();
  const bad = Buffer.from(value.wasmBytes);
  bad[bad.length - 1] ^= 1;
  await assert.rejects(loader.load({
    manifestUrl: "manifest",
    wasmUrl: "wasm",
    async fetchFunction(url) {
      const bytes = url === "manifest" ? value.manifestBytes : bad;
      return new Response(bytes, { headers: { "Content-Length": String(bytes.length) } });
    }
  }), (error) => error.code === "browser-runtime-wasm-identity");
});

"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  materializeDirectoryFlushHelperPackage
} = require("../tools/directory-flush-helper-package.js");
const {
  createVnextDirectoryFlushClient
} = require("../tools/vnext-directory-flush-client.js");
const { parseStrictJson } = require("../tools/strict-json.js");
const {
  ensureVnextDirectoryFlushTestPackage
} = require("./helpers/vnext-directory-flush-test-package.js");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");
const { resolveRepositoryRoot } = require("./helpers/repository-root.js");

const repositoryRoot = resolveRepositoryRoot({
  requiredFiles: ["eng/build-directory-flush-helper.ps1"]
});

test("CI declares native package and replay evidence for every supported RID", () => {
  const workflow = fs.readFileSync(path.join(
    repositoryRoot,
    ".github",
    "workflows",
    "ci.yml"
  ), "utf8");
  const jobStart = workflow.indexOf("  verify-directory-flush-helper:");
  const nextJob = workflow.indexOf("\n  verify-archive-fuzz:", jobStart);
  assert.ok(jobStart > 0);
  assert.ok(nextJob > jobStart);
  const job = workflow.slice(jobStart, nextJob);
  for (const value of [
    "windows-latest",
    "ubuntu-latest",
    "ubuntu-24.04-arm",
    "win-x64",
    "linux-x64",
    "linux-arm64",
    "eng/build-directory-flush-helper.ps1 -Configuration release",
    "bash eng/build-directory-flush-helper.sh release",
    "directory-flush-helper-verification.js run",
    "directory-flush-helper-verification.js verify",
    "tinyrustlm-directory-flush-helper-${{ matrix.rid }}",
    "tinyrustlm-directory-flush-helper-verification-${{ matrix.rid }}",
    "retention-days: 90"
  ]) {
    assert.ok(job.includes(value), value);
  }
  assert.match(job, /--test-concurrency=1/u);
  assert.doesNotMatch(job, /qemu|cross|--target/u);
});

function makeRoot(context, label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), label));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  return root;
}

function debugExecutablePath() {
  ensureVnextDirectoryFlushTestPackage();
  const targetRoot = resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR);
  return path.join(
    targetRoot,
    "debug",
    process.platform === "win32"
      ? "tinyrustlm-directory-flush.exe"
      : "tinyrustlm-directory-flush"
  );
}

function options(outputRoot, overrides = {}) {
  return {
    buildProfile: "debug",
    executablePath: debugExecutablePath(),
    outputRoot,
    trustClass: "local-test-build",
    ...overrides
  };
}

if (process.platform === "win32") {
  test("PowerShell directory helper builder rejects non-absolute outputs", () => {
    const scriptPath = path.join(
      repositoryRoot,
      "eng",
      "build-directory-flush-helper.ps1"
    );
    for (const outputRoot of [
      "relative-output",
      "D:drive-relative",
      "\\current-drive-rooted"
    ]) {
      const result = spawnSync("powershell.exe", [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-OutputDirectory",
        outputRoot
      ], {
        cwd: repositoryRoot,
        encoding: "utf8",
        windowsHide: true
      });
      assert.notEqual(result.status, 0, outputRoot);
      assert.match(
        `${result.stdout}\n${result.stderr}`,
        /Directory flush helper output must be an absolute path/u,
        outputRoot
      );
    }
  });
}

test("materializes one create-only package consumed by the frozen client", (context) => {
  const root = makeRoot(context, "tinyrustlm-directory-materialize-");
  const outputRoot = path.join(root, "package");
  const result = materializeDirectoryFlushHelperPackage(options(outputRoot));
  const executableFile = process.platform === "win32"
    ? "tinyrustlm-directory-flush.exe"
    : "tinyrustlm-directory-flush";
  assert.deepEqual(fs.readdirSync(outputRoot).sort(), [
    "directory-flush-helper-manifest.v1.json",
    "directory-flush-helper-provenance.v1.json",
    executableFile
  ].sort());
  for (const key of [
    "executableSha256", "helperSourceClosureSha256", "manifestSha256",
    "packageBuilderSourceClosureSha256", "provenanceSha256"
  ]) {
    assert.match(result[key], /^[a-f0-9]{64}$/u, key);
  }
  assert.match(result.sourceRevision, /^[a-f0-9]{40}$/u);
  assert.equal(result.runtimeIdentifier,
    process.platform === "win32" ? "win-x64" : `linux-${process.arch}`);
  assert.equal(result.trustClass, "local-test-build");

  const manifest = parseStrictJson(fs.readFileSync(path.join(
    outputRoot,
    "directory-flush-helper-manifest.v1.json"
  )));
  const provenance = parseStrictJson(fs.readFileSync(path.join(
    outputRoot,
    "directory-flush-helper-provenance.v1.json"
  )));
  assert.equal(manifest.executableSha256, result.executableSha256);
  assert.equal(manifest.sourceClosureSha256, result.helperSourceClosureSha256);
  assert.equal(provenance.packageBuilderSourceClosureSha256,
    result.packageBuilderSourceClosureSha256);
  assert.equal(provenance.sourceRevision, result.sourceRevision);

  const ownedRoot = path.join(root, "owned");
  fs.mkdirSync(ownedRoot);
  const observation = createVnextDirectoryFlushClient(outputRoot).flush({
    operationId: "directory-package-consumer",
    ownedRoot,
    relativeDirectory: "."
  });
  assert.equal(observation.executableSha256, result.executableSha256);
  assert.equal(observation.helperManifestSha256, result.manifestSha256);
  assert.equal(observation.helperSourceClosureSha256,
    result.helperSourceClosureSha256);
  assert.equal(observation.helperTrustClass, "local-test-build");
  assert.equal(observation.status, "performed");
});

test("rejects overwrite, relative roots, accessors, and dishonest profiles", (context) => {
  const root = makeRoot(context, "tinyrustlm-directory-materialize-reject-");
  const existing = path.join(root, "existing");
  fs.mkdirSync(existing);
  assert.throws(
    () => materializeDirectoryFlushHelperPackage(options(existing)),
    (error) => error.code === "directory_flush_package_output_exists"
  );
  assert.throws(
    () => materializeDirectoryFlushHelperPackage(options("relative-output")),
    (error) => error.code === "directory_flush_package_output_invalid"
  );
  assert.throws(
    () => materializeDirectoryFlushHelperPackage(options(path.join(root, "release"), {
      buildProfile: "release"
    })),
    (error) => error.code === "directory_flush_package_build_profile_mismatch"
  );
  assert.throws(
    () => materializeDirectoryFlushHelperPackage(options(path.join(root, "trust"), {
      trustClass: "release-package"
    })),
    (error) => error.code === "directory_flush_package_options_invalid"
  );
  const hostile = {};
  Object.defineProperty(hostile, "buildProfile", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  for (const [key, value] of Object.entries(options(path.join(root, "hostile")))) {
    if (key !== "buildProfile") hostile[key] = value;
  }
  assert.throws(
    () => materializeDirectoryFlushHelperPackage(hostile),
    (error) => error.code === "directory_flush_package_options_invalid"
  );
});

test("removes only newly owned package output after bounded tool failure", (context) => {
  const root = makeRoot(context, "tinyrustlm-directory-materialize-cleanup-");
  const outputRoot = path.join(root, "package");
  const priorCargo = process.env.CARGO;
  process.env.CARGO = path.join(root, "missing-cargo");
  try {
    assert.throws(
      () => materializeDirectoryFlushHelperPackage(options(outputRoot)),
      (error) => error.code === "directory_flush_package_cargo_version_failed"
    );
  } finally {
    if (priorCargo === undefined) delete process.env.CARGO;
    else process.env.CARGO = priorCargo;
  }
  assert.equal(fs.existsSync(outputRoot), false);
  assert.equal(fs.existsSync(root), true);
});

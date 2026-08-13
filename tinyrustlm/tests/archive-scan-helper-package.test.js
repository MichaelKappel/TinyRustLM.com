"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  materializeArchiveScanHelperPackage
} = require("../tools/archive-scan-helper-package.js");
const { createArchiveScanClient } = require("../tools/archive-scan-client.js");
const { ensureArchiveScanTestPackage } = require(
  "./helpers/archive-scan-test-package.js"
);
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");

const repositoryRoot = path.resolve(__dirname, "../..");

function makeRoot(context, label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), label));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  return root;
}

function debugExecutablePath() {
  ensureArchiveScanTestPackage();
  const targetRoot = resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR);
  return path.join(
    targetRoot,
    "debug",
    process.platform === "win32"
      ? "tinyrustlm-archive-scan.exe"
      : "tinyrustlm-archive-scan"
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
  test("PowerShell builder rejects paths that are not fully qualified", () => {
    const scriptPath = path.join(repositoryRoot, "eng", "build-archive-scan-helper.ps1");
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
      const diagnostic = `${result.stdout}\n${result.stderr}`;
      assert.match(
        diagnostic,
        /Archive scan helper output must be an absolute path/u,
        outputRoot
      );
      assert.doesNotMatch(diagnostic, /IsPathFullyQualified/u, outputRoot);
    }
  });
}

test("materializes one create-only package consumed through the frozen client", (context) => {
  const root = makeRoot(context, "tinyrustlm-archive-materialize-");
  const outputRoot = path.join(root, "package");
  const result = materializeArchiveScanHelperPackage(options(outputRoot));
  assert.deepEqual(fs.readdirSync(outputRoot).sort(), [
    "archive-scan-helper-manifest.v1.json",
    "archive-scan-helper-provenance.v1.json",
    process.platform === "win32"
      ? "tinyrustlm-archive-scan.exe"
      : "tinyrustlm-archive-scan"
  ].sort());
  assert.equal(result.outputRoot, outputRoot);
  assert.match(result.executableSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.helperSourceClosureSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.packageBuilderSourceClosureSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.manifestSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.provenanceSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.sourceRevision, /^[a-f0-9]{40}$/u);
  assert.equal(result.trustClass, "local-test-build");
  const client = createArchiveScanClient(outputRoot);
  assert.equal(client.packageIdentity.executableSha256, result.executableSha256);
  assert.equal(client.packageIdentity.helperManifestSha256, result.manifestSha256);
  assert.equal(client.packageIdentity.helperProvenanceSha256,
    result.provenanceSha256);
  assert.equal(client.packageIdentity.helperPackageBuilderSourceClosureSha256,
    result.packageBuilderSourceClosureSha256);
});

test("rejects overwrite relative roots accessors and dishonest build profiles", (context) => {
  const root = makeRoot(context, "tinyrustlm-archive-materialize-reject-");
  const existing = path.join(root, "existing");
  fs.mkdirSync(existing);
  assert.throws(
    () => materializeArchiveScanHelperPackage(options(existing)),
    (error) => error.code === "archive_scan_package_output_exists"
  );
  assert.throws(
    () => materializeArchiveScanHelperPackage(options("relative-output")),
    (error) => error.code === "archive_scan_package_output_invalid"
  );
  assert.throws(
    () => materializeArchiveScanHelperPackage(options(path.join(root, "release"), {
      buildProfile: "release"
    })),
    (error) => error.code === "archive_scan_package_build_profile_mismatch"
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
    () => materializeArchiveScanHelperPackage(hostile),
    (error) => error.code === "archive_scan_package_options_invalid"
  );
});

test("removes only its newly owned output after a bounded identity failure", (context) => {
  const root = makeRoot(context, "tinyrustlm-archive-materialize-cleanup-");
  const outputRoot = path.join(root, "package");
  const executablePath = debugExecutablePath();
  const priorCargo = process.env.CARGO;
  process.env.CARGO = path.join(root, "missing-cargo");
  try {
    assert.throws(
      () => materializeArchiveScanHelperPackage({
        buildProfile: "debug",
        executablePath,
        outputRoot,
        trustClass: "local-test-build"
      }),
      (error) => error.code === "archive_scan_package_cargo_version_failed"
    );
  } finally {
    if (priorCargo === undefined) delete process.env.CARGO;
    else process.env.CARGO = priorCargo;
  }
  assert.equal(fs.existsSync(outputRoot), false);
  assert.equal(fs.existsSync(root), true);
});

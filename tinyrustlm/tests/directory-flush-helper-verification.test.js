"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  materializeDirectoryFlushHelperPackage
} = require("../tools/directory-flush-helper-package.js");
const {
  directoryFlushHelperVerificationProfileId,
  directoryFlushHelperVerificationProfileSha256,
  runDirectoryFlushHelperVerification,
  verifyDirectoryFlushHelperEvidence
} = require("../tools/directory-flush-helper-verification.js");
const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const { parseStrictJson } = require("../tools/strict-json.js");
const {
  ensureVnextDirectoryFlushTestPackage
} = require("./helpers/vnext-directory-flush-test-package.js");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");
const { resolveRepositoryRoot } = require("./helpers/repository-root.js");

const receiptFileName = "directory-flush-helper-verification.v1.json";
const receiptKeys = Object.freeze([
  "architecture", "buildProfile", "cases", "clientProfileId",
  "clientProfileSha256", "clientSourceClosureSha256", "executionClass",
  "executableByteCount", "executableSha256", "helperManifestSha256",
  "helperPackageBuilderSourceClosureSha256", "helperProvenanceSha256",
  "helperSourceClosureSha256", "helperSourceRevision",
  "helperSourceWorktreeClean", "nodeVersion", "operatingSystem", "profileId",
  "profileSha256", "runtimeIdentifier", "schema", "scratchCleanup",
  "trustClass", "verdict", "verificationSourceClosureSha256"
].sort());
const repositoryRoot = resolveRepositoryRoot({
  requiredFiles: ["eng/build-directory-flush-helper.ps1"]
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

function makePackage(root) {
  const packageRoot = path.join(root, "package");
  materializeDirectoryFlushHelperPackage({
    buildProfile: "debug",
    executablePath: debugExecutablePath(),
    outputRoot: packageRoot,
    trustClass: "local-test-build"
  });
  return packageRoot;
}

function verificationOptions(root, overrides = {}) {
  const scratchRoot = path.join(root, "scratch");
  fs.mkdirSync(scratchRoot, { recursive: true });
  return {
    outputRoot: path.join(root, "evidence"),
    packageRoot: makePackage(root),
    scratchRoot,
    ...overrides
  };
}

function readReceipt(outputRoot) {
  const bytes = fs.readFileSync(path.join(outputRoot, receiptFileName));
  const receipt = parseStrictJson(bytes);
  assert.equal(canonicalizeVnextJcsBytes(receipt).equals(bytes), true);
  return { bytes, receipt };
}

test("executes exact directories, cleans scratch, and emits one path-free receipt", (context) => {
  const root = makeRoot(context, "tinyrustlm-directory-verification-");
  const options = verificationOptions(root);
  const result = runDirectoryFlushHelperVerification(options);

  assert.deepEqual(fs.readdirSync(options.outputRoot), [receiptFileName]);
  assert.deepEqual(fs.readdirSync(options.scratchRoot), []);
  const { bytes, receipt } = readReceipt(options.outputRoot);
  assert.deepEqual(Object.keys(receipt).sort(), receiptKeys);
  assert.equal(result.outputRoot, options.outputRoot);
  assert.equal(result.receiptByteCount, bytes.length);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/u);
  assert.equal(result.runtimeIdentifier,
    process.platform === "win32" ? "win-x64" : `linux-${process.arch}`);
  assert.equal(result.verdict, "pass");
  assert.equal(receipt.schema,
    "tinyrustlm.vnext.directory_flush_helper_verification.v1");
  assert.equal(receipt.profileId, directoryFlushHelperVerificationProfileId);
  assert.equal(receipt.profileSha256,
    directoryFlushHelperVerificationProfileSha256);
  assert.equal(receipt.executionClass,
    "native-package-fixed-directory-replay");
  assert.equal(receipt.scratchCleanup, "completed-before-receipt");
  assert.equal(receipt.verdict, "pass");
  assert.equal(receipt.nodeVersion, process.version);
  assert.deepEqual(receipt.cases.map((entry) => ({
    caseId: entry.caseId,
    fixtureByteCount: entry.fixtureByteCount,
    fixtureSha256: entry.fixtureSha256,
    operationId: entry.operationId
  })), [
    {
      caseId: "nested-state-directory",
      fixtureByteCount: 42,
      fixtureSha256:
        "c6e3d0b1ae0ccde152214f4d9d26a5df6a0d8b1d1e67a78ccfabcc2b93e17c7f",
      operationId: "directory-flush-fixed-nested-state"
    },
    {
      caseId: "owned-root-directory",
      fixtureByteCount: 40,
      fixtureSha256:
        "da0bdd4d0197e6aff467caadf37a4b9fa5101c3ac30bb3d3241852f594f00d31",
      operationId: "directory-flush-fixed-owned-root"
    }
  ]);
  for (const entry of receipt.cases) {
    assert.match(entry.directoryIdentitySha256, /^[a-f0-9]{64}$/u);
    assert.match(entry.observationSha256, /^[a-f0-9]{64}$/u);
    assert.match(entry.requestSha256, /^[a-f0-9]{64}$/u);
  }
  const publicText = bytes.toString("utf8");
  assert.equal(publicText.includes(options.packageRoot), false);
  assert.equal(publicText.includes(options.outputRoot), false);
  assert.equal(publicText.includes(options.scratchRoot), false);

  const staticResult = verifyDirectoryFlushHelperEvidence({
    evidenceRoot: options.outputRoot,
    packageRoot: options.packageRoot
  });
  assert.equal(staticResult.receiptSha256, result.receiptSha256);
  assert.equal(staticResult.verdict, "pass");
});

test("rejects overwrite, relative roots, overlap, and hostile accessors", (context) => {
  const root = makeRoot(context, "tinyrustlm-directory-verification-reject-");
  const existing = path.join(root, "existing");
  fs.mkdirSync(existing);
  const overwrite = verificationOptions(root, { outputRoot: existing });
  assert.throws(
    () => runDirectoryFlushHelperVerification(overwrite),
    (error) => error.code === "directory_flush_verification_output_exists"
  );

  const separate = makeRoot(context, "tinyrustlm-directory-relative-");
  const relative = verificationOptions(separate, {
    outputRoot: "relative-evidence"
  });
  assert.throws(
    () => runDirectoryFlushHelperVerification(relative),
    (error) => error.code === "directory_flush_verification_options_invalid"
  );

  const overlapRoot = makeRoot(context, "tinyrustlm-directory-overlap-");
  const overlap = verificationOptions(overlapRoot);
  assert.throws(
    () => runDirectoryFlushHelperVerification({
      ...overlap,
      outputRoot: path.join(overlap.scratchRoot, "evidence")
    }),
    (error) => error.code === "directory_flush_verification_roots_overlap"
  );

  const hostile = {};
  Object.defineProperty(hostile, "packageRoot", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  hostile.outputRoot = path.join(overlapRoot, "hostile-evidence");
  hostile.scratchRoot = overlap.scratchRoot;
  assert.throws(
    () => runDirectoryFlushHelperVerification(hostile),
    (error) => error.code === "directory_flush_verification_options_invalid"
  );
});

test("package drift creates no receipt and removes only owned scratch", (context) => {
  const root = makeRoot(context, "tinyrustlm-directory-verification-drift-");
  const options = verificationOptions(root);
  const manifest = parseStrictJson(fs.readFileSync(path.join(
    options.packageRoot,
    "directory-flush-helper-manifest.v1.json"
  )));
  fs.appendFileSync(path.join(options.packageRoot, manifest.executableFile),
    Buffer.from([0]));
  assert.throws(
    () => runDirectoryFlushHelperVerification(options),
    (error) => error.code === "directory_flush_verification_executable_invalid" ||
      error.code === "directory_flush_verification_provenance_invalid"
  );
  assert.equal(fs.existsSync(options.outputRoot), false);
  assert.deepEqual(fs.readdirSync(options.scratchRoot), []);
  assert.equal(fs.existsSync(options.packageRoot), true);
});

test("static verifier rejects receipt tampering and unexpected files", (context) => {
  const root = makeRoot(context, "tinyrustlm-directory-static-drift-");
  const options = verificationOptions(root);
  runDirectoryFlushHelperVerification(options);
  const receiptPath = path.join(options.outputRoot, receiptFileName);
  const original = fs.readFileSync(receiptPath);
  const receipt = parseStrictJson(original);
  receipt.verdict = "fail";
  fs.writeFileSync(receiptPath, canonicalizeVnextJcsBytes(receipt));
  assert.throws(
    () => verifyDirectoryFlushHelperEvidence({
      evidenceRoot: options.outputRoot,
      packageRoot: options.packageRoot
    }),
    (error) => error.code === "directory_flush_verification_receipt_invalid"
  );
  fs.writeFileSync(receiptPath, original);
  fs.writeFileSync(path.join(options.outputRoot, "unexpected.txt"), "no\n");
  assert.throws(
    () => verifyDirectoryFlushHelperEvidence({
      evidenceRoot: options.outputRoot,
      packageRoot: options.packageRoot
    }),
    (error) => error.code ===
      "directory_flush_verification_evidence_file_set_invalid"
  );
});

test("static verifier rejects package provenance and package file-set drift", (context) => {
  const root = makeRoot(context, "tinyrustlm-directory-package-drift-");
  const options = verificationOptions(root);
  runDirectoryFlushHelperVerification(options);
  const provenancePath = path.join(
    options.packageRoot,
    "directory-flush-helper-provenance.v1.json"
  );
  const original = fs.readFileSync(provenancePath);
  const provenance = parseStrictJson(original);
  provenance.sourceRevision = "0".repeat(40);
  fs.writeFileSync(provenancePath, canonicalizeVnextJcsBytes(provenance));
  assert.throws(
    () => verifyDirectoryFlushHelperEvidence({
      evidenceRoot: options.outputRoot,
      packageRoot: options.packageRoot
    }),
    (error) => error.code === "directory_flush_verification_provenance_invalid"
  );
  fs.writeFileSync(provenancePath, original);
  fs.writeFileSync(path.join(options.packageRoot, "unexpected.txt"), "no\n");
  assert.throws(
    () => verifyDirectoryFlushHelperEvidence({
      evidenceRoot: options.outputRoot,
      packageRoot: options.packageRoot
    }),
    (error) => error.code ===
      "directory_flush_verification_package_file_set_invalid"
  );
});

test("CLI exposes only bounded identities and refuses evidence replacement", (context) => {
  const root = makeRoot(context, "tinyrustlm-directory-verification-cli-");
  const options = verificationOptions(root);
  const toolPath = path.resolve(
    __dirname,
    "../tools/directory-flush-helper-verification.js"
  );
  const nodeArguments = ["--preserve-symlinks", "--preserve-symlinks-main"];
  const runArguments = [
    ...nodeArguments,
    toolPath,
    "run",
    options.packageRoot,
    options.outputRoot,
    options.scratchRoot
  ];
  const first = childProcess.spawnSync(process.execPath, runArguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(first.error, undefined);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.signal, null);
  assert.equal(first.stderr, "");
  const output = JSON.parse(first.stdout);
  assert.deepEqual(Object.keys(output), [
    "receiptByteCount", "receiptSha256", "runtimeIdentifier", "verdict"
  ]);
  assert.ok(Number.isSafeInteger(output.receiptByteCount));
  assert.match(output.receiptSha256, /^[a-f0-9]{64}$/u);
  assert.match(output.runtimeIdentifier, /^(?:linux|win)-(?:arm64|x64)$/u);
  assert.equal(output.verdict, "pass");
  assert.equal(first.stdout.includes(options.packageRoot), false);
  assert.equal(first.stdout.includes(options.outputRoot), false);
  assert.equal(first.stdout.includes(options.scratchRoot), false);

  const verifyResult = childProcess.spawnSync(process.execPath, [
    ...nodeArguments,
    toolPath,
    "verify",
    options.packageRoot,
    options.outputRoot
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(verifyResult.status, 0, verifyResult.stderr);
  assert.deepEqual(JSON.parse(verifyResult.stdout), output);

  const second = childProcess.spawnSync(process.execPath, runArguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.notEqual(second.status, 0);
  assert.equal(second.stdout, "");
  assert.equal(second.stderr,
    "TinyRustLM directory flush helper verification failed\n");
});

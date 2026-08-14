"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createArchiveScanClient } = require("../tools/archive-scan-client.js");
const {
  archiveScanHelperVerificationProfileId,
  archiveScanHelperVerificationProfileSha256,
  verifyArchiveScanHelperPackage
} = require("../tools/archive-scan-helper-verification.js");
const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const { parseStrictJson } = require("../tools/strict-json.js");
const { ensureArchiveScanTestPackage } = require(
  "./helpers/archive-scan-test-package.js"
);

const receiptFileName = "archive-scan-helper-verification.v1.json";
const receiptKeys = Object.freeze([
  "architecture",
  "buildProfile",
  "cases",
  "clientProfileId",
  "clientProfileSha256",
  "clientSourceClosureSha256",
  "executionClass",
  "executableByteCount",
  "executableSha256",
  "helperManifestSha256",
  "helperPackageBuilderSourceClosureSha256",
  "helperProvenanceSha256",
  "helperSourceClosureSha256",
  "helperSourceRevision",
  "helperSourceWorktreeClean",
  "nodeVersion",
  "operatingSystem",
  "profileId",
  "profileSha256",
  "runtimeIdentifier",
  "schema",
  "scratchCleanup",
  "trustClass",
  "verdict",
  "verificationSourceClosureSha256"
].sort());

function makeRoot(context, label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), label));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  return root;
}

function verificationOptions(root, overrides = {}) {
  const scratchRoot = path.join(root, "scratch");
  fs.mkdirSync(scratchRoot, { recursive: true });
  return {
    outputRoot: path.join(root, "evidence"),
    packageRoot: ensureArchiveScanTestPackage(),
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

test("executes both frozen vectors and emits one canonical path-free receipt", async (context) => {
  const root = makeRoot(context, "tinyrustlm-archive-verification-");
  const options = verificationOptions(root);
  const packageIdentity = createArchiveScanClient(options.packageRoot).packageIdentity;
  const result = await verifyArchiveScanHelperPackage(options);

  assert.deepEqual(fs.readdirSync(options.outputRoot), [receiptFileName]);
  assert.deepEqual(fs.readdirSync(options.scratchRoot), []);
  const { bytes, receipt } = readReceipt(options.outputRoot);
  assert.deepEqual(Object.keys(receipt).sort(), receiptKeys);
  assert.equal(result.outputRoot, options.outputRoot);
  assert.equal(result.receiptByteCount, bytes.length);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/u);
  assert.equal(result.runtimeIdentifier, packageIdentity.runtimeIdentifier);
  assert.equal(receipt.schema,
    "tinyrustlm.vnext.archive_scan_helper_verification.v1");
  assert.equal(receipt.profileId, archiveScanHelperVerificationProfileId);
  assert.equal(receipt.profileSha256, archiveScanHelperVerificationProfileSha256);
  assert.equal(receipt.executionClass, "native-package-fixed-vector-replay");
  assert.equal(receipt.verdict, "pass");
  assert.equal(receipt.scratchCleanup, "completed-before-receipt");
  assert.equal(receipt.nodeVersion, process.version);
  for (const [key, value] of Object.entries(packageIdentity)) {
    assert.equal(receipt[key], value, key);
  }
  assert.deepEqual(receipt.cases, [
    {
      archiveByteCount: 198,
      archiveSha256: "38bf0a28a4a687f76dbbf04edc85ad3fd70905394af636fc491c8be21412e77d",
      caseId: "canonical-package-tar-gzip",
      contentManifestSha256:
        "1e6bd2756f9b93b54b7e7fad260d8380992105694980a4aa0af0d2227270934c",
      format: "tar-gzip",
      memberCount: 2,
      totalContentBytes: 112
    },
    {
      archiveByteCount: 326,
      archiveSha256: "e08b94a7eb91772cda32a9a7f0886130bb9afdb8eb1fba737ebb4d3a20f05685",
      caseId: "canonical-package-zip",
      contentManifestSha256:
        "c20d58bfbae32112e54b9558e89ab23fa7dd74bd4f3d8e529663cfef886141f6",
      format: "zip",
      memberCount: 2,
      totalContentBytes: 38
    }
  ]);
  const publicBytes = bytes.toString("utf8");
  assert.equal(publicBytes.includes(options.packageRoot), false);
  assert.equal(publicBytes.includes(options.outputRoot), false);
  assert.equal(publicBytes.includes(options.scratchRoot), false);
});

test("rejects overwrite relative roots and hostile option accessors", async (context) => {
  const root = makeRoot(context, "tinyrustlm-archive-verification-reject-");
  const existing = path.join(root, "existing");
  fs.mkdirSync(existing);
  const first = verificationOptions(root, { outputRoot: existing });
  await assert.rejects(
    verifyArchiveScanHelperPackage(first),
    (error) => error.code === "archive_scan_verification_output_exists"
  );

  const relative = verificationOptions(root, { outputRoot: "relative-evidence" });
  await assert.rejects(
    verifyArchiveScanHelperPackage(relative),
    (error) => error.code === "archive_scan_verification_options_invalid"
  );

  const hostile = {};
  Object.defineProperty(hostile, "packageRoot", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  hostile.outputRoot = path.join(root, "hostile-evidence");
  hostile.scratchRoot = path.join(root, "scratch");
  await assert.rejects(
    verifyArchiveScanHelperPackage(hostile),
    (error) => error.code === "archive_scan_verification_options_invalid"
  );
});

test("package drift leaves no receipt and removes only owned scratch", async (context) => {
  const root = makeRoot(context, "tinyrustlm-archive-verification-drift-");
  const sourcePackage = ensureArchiveScanTestPackage();
  const packageRoot = path.join(root, "package");
  fs.cpSync(sourcePackage, packageRoot, { recursive: true, errorOnExist: true });
  const manifest = parseStrictJson(fs.readFileSync(path.join(
    packageRoot,
    "archive-scan-helper-manifest.v1.json"
  )));
  fs.appendFileSync(path.join(packageRoot, manifest.executableFile), Buffer.from([0]));
  const options = verificationOptions(root, { packageRoot });
  await assert.rejects(
    verifyArchiveScanHelperPackage(options),
    (error) => error.code === "archive_scan_executable_identity_mismatch"
  );
  assert.equal(fs.existsSync(options.outputRoot), false);
  assert.deepEqual(fs.readdirSync(options.scratchRoot), []);
  assert.equal(fs.existsSync(packageRoot), true);
});

test("CLI emits only bounded public identity and refuses replacement", (context) => {
  const root = makeRoot(context, "tinyrustlm-archive-verification-cli-");
  const options = verificationOptions(root);
  const toolPath = path.resolve(
    __dirname,
    "../tools/archive-scan-helper-verification.js"
  );
  const argumentsList = [
    toolPath,
    options.packageRoot,
    options.outputRoot,
    options.scratchRoot
  ];
  const first = childProcess.spawnSync(process.execPath, argumentsList, {
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
    "receiptByteCount",
    "receiptSha256",
    "runtimeIdentifier"
  ]);
  assert.ok(Number.isSafeInteger(output.receiptByteCount));
  assert.match(output.receiptSha256, /^[a-f0-9]{64}$/u);
  assert.match(output.runtimeIdentifier, /^(?:linux|win)-(?:arm64|x64)$/u);
  assert.equal(first.stdout.includes(options.packageRoot), false);
  assert.equal(first.stdout.includes(options.outputRoot), false);
  assert.equal(first.stdout.includes(options.scratchRoot), false);

  const second = childProcess.spawnSync(process.execPath, argumentsList, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(second.error, undefined);
  assert.notEqual(second.status, 0);
  assert.equal(second.stdout, "");
  assert.equal(
    second.stderr,
    "TinyRustLM archive scan helper verification failed\n"
  );
});

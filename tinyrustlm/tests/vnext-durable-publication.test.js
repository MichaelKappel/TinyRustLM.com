"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");

const {
  ensureVnextDirectoryFlushTestPackage,
  packageEnvironmentVariable
} = require("./helpers/vnext-directory-flush-test-package.js");

ensureVnextDirectoryFlushTestPackage();

const {
  createVnextDurablePublication,
  durablePublicationProfile,
  durablePublicationProfileSha256,
  validateDurablePublicationReceiptBytes
} = require("../tools/vnext-durable-publication.js");

const ownedPrefix = "tinyrustlm-vnext-durable-publication-";
const storeProfileId = "tinyrustlm.vnext.test-durable-store.v1";
const storeProfileSha256 = "6".repeat(64);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function makeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ownedPrefix));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.equal(path.basename(resolved).startsWith(ownedPrefix), true);
    fs.rmSync(resolved, { force: true, recursive: true });
  });
  return root;
}

function configuration(overrides = {}) {
  return {
    codePrefix: "durable_test",
    steps: {
      open: "durable-test-open",
      path: "durable-test-path",
      persist: "durable-test-persist",
      read: "durable-test-read",
      scan: "durable-test-scan"
    },
    storeProfileId,
    storeProfileSha256,
    ...overrides
  };
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error?.code, code);
    return true;
  });
}

function targetRelativePath(bytes) {
  const digest = sha256(bytes);
  return `objects/sha256/${digest.slice(0, 2)}/${digest}.json`;
}

test("freezes the non-recursive durability profile and exact raw-byte identity", () => {
  const profileBytes = fs.readFileSync(path.resolve(
    __dirname,
    "../../contracts/vnext/durable-publication-profile.v1.json"
  ));
  assert.equal(sha256(profileBytes), durablePublicationProfileSha256);
  assert.equal(durablePublicationProfile.profileId,
    "tinyrustlm.vnext.durable-publication.v1");
  assert.equal(durablePublicationProfile.bootstrap.recursiveReceipt, "forbidden");
  assert.equal(durablePublicationProfile.bootstrap.receiptExcludesOwnPublicationEvidence,
    true);
  assert.equal(durablePublicationProfile.activation.targetWithoutMatchingReceipt,
    "inactive");
  assert.equal(JSON.stringify(durablePublicationProfile).includes(
    "unavailable-win32-node"), false);
});

test("requires a preexisting absolute owned root", (t) => {
  const parent = makeRoot(t);
  const missing = path.join(parent, "missing-root");
  throwsCode(() => createVnextDurablePublication(missing, configuration()),
    "durable_test_owned_root_missing");
  throwsCode(() => createVnextDurablePublication("relative-root", configuration()),
    "durable_test_owned_root_invalid");
});

test("rejects caller-supplied IO, platform, helper, and success seams", (t) => {
  const root = makeRoot(t);
  for (const name of ["io", "platform", "randomBytes", "directoryFlushClient",
    "directoryFlushResult", "readbackResult"]) {
    throwsCode(() => createVnextDurablePublication(root,
      configuration({ [name]: {} })), "durable_test_configuration_unknown");
  }
});

test("fails closed when the explicit helper package is not configured", (t) => {
  const root = makeRoot(t);
  const prior = process.env[packageEnvironmentVariable];
  t.after(() => {
    process.env[packageEnvironmentVariable] = prior;
  });
  delete process.env[packageEnvironmentVariable];
  throwsCode(() => createVnextDurablePublication(root, configuration()),
    "directory_flush_package_not_configured");
});

test("publishes one target and its content-addressed durability receipt", (t) => {
  const root = makeRoot(t);
  const boundary = createVnextDurablePublication(root, configuration());
  assert.equal(Object.hasOwn(boundary, "root"), false);
  assert.equal(Object.hasOwn(boundary, "boundedReadFile"), false);
  assert.equal(Object.hasOwn(boundary, "assertNoLinkComponents"), false);
  const bytes = Buffer.from("durability target 001", "utf8");
  const relativePath = targetRelativePath(bytes);

  const created = boundary.publishBytes(relativePath, bytes, 4096);
  assert.equal(created.schema, durablePublicationProfile.resultSchema);
  assert.equal(created.profileId, durablePublicationProfile.profileId);
  assert.equal(created.profileSha256, durablePublicationProfileSha256);
  assert.equal(created.targetRelativePath, relativePath);
  assert.equal(created.targetSha256, sha256(bytes));
  assert.equal(created.targetByteCount, bytes.length);
  assert.equal(created.targetDisposition, "created");
  assert.equal(created.targetReadbackStatus, "verified");
  assert.equal(created.durabilityReceiptStatus, "verified");
  assert.equal(created.targetDirectoryFlush.status, "performed");
  assert.equal(created.durabilityReceiptDirectoryFlush.status, "performed");
  assert.equal(created.targetDirectoryFlush.clientProfileSha256,
    durablePublicationProfile.directoryFlushClientProfileSha256);
  assert.equal(created.targetDirectoryFlush.clientSourceClosureSha256,
    durablePublicationProfile.directoryFlushClientSourceClosureSha256);
  assert.equal(created.targetDirectoryFlush.directoryFlushProfileSha256,
    durablePublicationProfile.directoryFlushProfileSha256);
  assert.match(created.durabilityReceiptSha256, /^[a-f0-9]{64}$/u);
  assert.equal(created.durabilityReceiptRelativePath,
    `durability/sha256/${created.durabilityReceiptSha256.slice(0, 2)}/` +
    `${created.durabilityReceiptSha256}.json`);
  assert.doesNotMatch(JSON.stringify(created),
    new RegExp(root.replace(/\\/gu, "\\\\"), "u"));
  assert.equal(JSON.stringify(created).includes("unavailable-win32-node"), false);

  const receiptBytes = fs.readFileSync(path.join(
    root,
    ...created.durabilityReceiptRelativePath.split("/")
  ));
  assert.equal(sha256(receiptBytes), created.durabilityReceiptSha256);
  const receipt = validateDurablePublicationReceiptBytes(receiptBytes, {
    ownedRoot: root,
    storeProfileId,
    storeProfileSha256
  });
  assert.equal(receipt.receipt.targetRelativePath, relativePath);
  assert.equal(receipt.receipt.targetSha256, sha256(bytes));
  assert.deepEqual(receipt.bytes, receiptBytes);
  assert.deepEqual(fs.readFileSync(path.join(root, ...relativePath.split("/"))), bytes);
});

test("publishes one deterministic durability batch through bounded helper batches", (t) => {
  const root = makeRoot(t);
  const boundary = createVnextDurablePublication(root, configuration());
  const originalSpawnSync = childProcess.spawnSync;
  const helperRequests = [];
  t.mock.method(childProcess, "spawnSync", (file, argumentsList, options) => {
    helperRequests.push(parseStrictJson(options.input));
    return originalSpawnSync(file, argumentsList, options);
  });
  const results = boundary.publishMany([
    { bytes: Buffer.from("batch target 003"), maximumBytes: 4096,
      relativePath: "objects/batch/003.bin" },
    { bytes: Buffer.from("batch target 001"), maximumBytes: 4096,
      relativePath: "objects/batch/001.bin" },
    { bytes: Buffer.from("batch target 002"), maximumBytes: 4096,
      relativePath: "objects/batch/002.bin" }
  ]);

  assert.equal(Object.isFrozen(results), true);
  assert.deepEqual(results.map((entry) => entry.targetRelativePath), [
    "objects/batch/001.bin",
    "objects/batch/002.bin",
    "objects/batch/003.bin"
  ]);
  assert.equal(helperRequests.length, 4);
  const targetBatches = helperRequests.filter((batch) => batch.requests.every((entry) =>
    entry.operationId.startsWith("durability:target-publish:")));
  const receiptBatches = helperRequests.filter((batch) => batch.requests.every((entry) =>
    entry.operationId.startsWith("durability:receipt-publish:")));
  assert.equal(targetBatches.length, 1);
  assert.equal(receiptBatches.length, 1);
  assert.equal(targetBatches[0].requests.length, 3);
  assert.equal(receiptBatches[0].requests.length, 3);
  assert.equal(new Set(results.map((entry) => entry.targetDirectoryFlush.operationId)).size, 3);
  assert.equal(new Set(results.map((entry) =>
    entry.durabilityReceiptDirectoryFlush.operationId)).size, 3);
  for (const result of results) {
    assert.equal(Object.isFrozen(result), true);
    assert.equal(result.targetReadbackStatus, "verified");
    assert.equal(result.durabilityReceiptStatus, "verified");
  }
});

test("rejects malformed durability publication batches before writing", (t) => {
  const root = makeRoot(t);
  const boundary = createVnextDurablePublication(root, configuration());
  throwsCode(() => boundary.publishMany([]), "durable_test_publish_batch_invalid");
  const duplicate = {
    bytes: Buffer.from("duplicate"),
    maximumBytes: 4096,
    relativePath: "objects/batch/duplicate.bin"
  };
  throwsCode(() => boundary.publishMany([duplicate, duplicate]),
    "durable_test_publish_batch_invalid");
  const hostile = [];
  Object.defineProperty(hostile, "0", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  throwsCode(() => boundary.publishMany(hostile),
    "durable_test_publish_batch_invalid");
  throwsCode(() => boundary.publishMany(Array.from({ length: 1_025 }, (_entry, index) => ({
    bytes: Buffer.from(`oversized ${index}`),
    maximumBytes: 4096,
    relativePath: `objects/batch/${String(index).padStart(4, "0")}.bin`
  }))), "durable_test_publish_batch_invalid");
});

test("is idempotent and derives the same receipt for byte-identical reuse", (t) => {
  const root = makeRoot(t);
  const boundary = createVnextDurablePublication(root, configuration());
  const bytes = Buffer.from("durability target 002", "utf8");
  const relativePath = targetRelativePath(bytes);
  const first = boundary.publishBytes(relativePath, bytes, 4096);
  const second = boundary.publishBytes(relativePath, bytes, 4096);

  assert.equal(second.targetDisposition, "existing-byte-identical");
  assert.equal(second.durabilityReceiptDisposition, "existing-byte-identical");
  assert.equal(second.durabilityReceiptSha256, first.durabilityReceiptSha256);
  assert.equal(second.durabilityReceiptRelativePath,
    first.durabilityReceiptRelativePath);
});

test("performs fresh target and receipt flushes before restart activation", (t) => {
  const root = makeRoot(t);
  const first = createVnextDurablePublication(root, configuration());
  const bytes = Buffer.from("durability target 003", "utf8");
  const relativePath = targetRelativePath(bytes);
  const persisted = first.publishBytes(relativePath, bytes, 4096);

  const restarted = createVnextDurablePublication(root, configuration());
  const activated = restarted.activateBytes(relativePath, 4096);
  assert.deepEqual(activated.bytes, bytes);
  assert.equal(activated.durability.durabilityReceiptSha256,
    persisted.durabilityReceiptSha256);
  assert.equal(activated.durability.targetDirectoryFlush.status, "performed");
  assert.equal(activated.durability.durabilityReceiptDirectoryFlush.status,
    "performed");
  assert.equal(activated.durability.targetReadbackStatus, "verified");
  assert.equal(activated.durability.durabilityReceiptStatus, "verified");
});

test("batches prepared restart flushes before activating any target", (t) => {
  const root = makeRoot(t);
  const first = createVnextDurablePublication(root, configuration());
  const values = ["batch restart target one", "batch restart target two"]
    .map((value) => Buffer.from(value, "utf8"));
  const paths = values.map(targetRelativePath);
  const persisted = first.publishMany(values.map((bytes, index) => ({
    bytes,
    maximumBytes: 4096,
    relativePath: paths[index]
  })));
  const restarted = createVnextDurablePublication(root, configuration());
  const originalSpawnSync = childProcess.spawnSync;
  const helperRequests = [];
  t.mock.method(childProcess, "spawnSync", (...argumentsList) => {
    helperRequests.push(parseStrictJson(argumentsList[2].input));
    return originalSpawnSync(...argumentsList);
  });

  const activated = restarted.activateMany(paths.map((relativePath) => ({
    maximumBytes: 4096,
    relativePath
  })));

  assert.equal(helperRequests.length, 1);
  assert.equal(helperRequests[0].requests.length, values.length * 2);
  assert.equal(helperRequests[0].requests.filter((entry) =>
    entry.operationId.includes(":restart-target:")).length, values.length);
  assert.equal(helperRequests[0].requests.filter((entry) =>
    entry.operationId.includes(":restart-receipt:")).length, values.length);
  assert.deepEqual(activated.map((entry) => entry.bytes), values);
  const persistedByPath = new Map(persisted.map((entry) => [
    entry.targetRelativePath,
    entry.durabilityReceiptSha256
  ]));
  assert.deepEqual(activated.map((entry) =>
    entry.durability.durabilityReceiptSha256), paths.map((relativePath) =>
    persistedByPath.get(relativePath)));
});

test("keeps a target inactive when its durability receipt is absent", (t) => {
  const root = makeRoot(t);
  const first = createVnextDurablePublication(root, configuration());
  const bytes = Buffer.from("durability target 004", "utf8");
  const relativePath = targetRelativePath(bytes);
  const persisted = first.publishBytes(relativePath, bytes, 4096);
  fs.unlinkSync(path.join(root, ...persisted.durabilityReceiptRelativePath.split("/")));

  const restarted = createVnextDurablePublication(root, configuration());
  throwsCode(() => restarted.activateBytes(relativePath, 4096),
    "durable_test_durability_receipt_missing");
  assert.deepEqual(fs.readFileSync(path.join(root, ...relativePath.split("/"))), bytes);
});

test("keeps a durability receipt inactive when its target is absent", (t) => {
  const root = makeRoot(t);
  const first = createVnextDurablePublication(root, configuration());
  const bytes = Buffer.from("durability target 005", "utf8");
  const relativePath = targetRelativePath(bytes);
  first.publishBytes(relativePath, bytes, 4096);
  fs.unlinkSync(path.join(root, ...relativePath.split("/")));

  const restarted = createVnextDurablePublication(root, configuration());
  throwsCode(() => restarted.activateBytes(relativePath, 4096),
    "durable_test_target_missing");
});

test("rejects target bit drift before activation", (t) => {
  const root = makeRoot(t);
  const first = createVnextDurablePublication(root, configuration());
  const bytes = Buffer.from("durability target 006", "utf8");
  const relativePath = targetRelativePath(bytes);
  first.publishBytes(relativePath, bytes, 4096);
  const target = path.join(root, ...relativePath.split("/"));
  const changed = Buffer.from(bytes);
  changed[0] ^= 0xff;
  fs.writeFileSync(target, changed);

  const restarted = createVnextDurablePublication(root, configuration());
  throwsCode(() => restarted.activateBytes(relativePath, 4096),
    "durable_test_target_readback_mismatch");
});

test("rejects noncanonical, unknown-field, and profile-drift receipt bytes", (t) => {
  const root = makeRoot(t);
  const boundary = createVnextDurablePublication(root, configuration());
  const bytes = Buffer.from("durability target 007", "utf8");
  const persisted = boundary.publishBytes(targetRelativePath(bytes), bytes, 4096);
  const receiptPath = path.join(root,
    ...persisted.durabilityReceiptRelativePath.split("/"));
  const receiptBytes = fs.readFileSync(receiptPath);
  const value = JSON.parse(receiptBytes.toString("utf8"));

  throwsCode(() => validateDurablePublicationReceiptBytes(
    Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"), {
      ownedRoot: root,
      storeProfileId,
      storeProfileSha256
    }), "durable_publication_receipt_noncanonical");
  throwsCode(() => validateDurablePublicationReceiptBytes(
    Buffer.from(JSON.stringify({ ...value, injectedSuccess: true }), "utf8"), {
      ownedRoot: root,
      storeProfileId,
      storeProfileSha256
    }), "durable_publication_receipt_invalid");
  throwsCode(() => validateDurablePublicationReceiptBytes(receiptBytes, {
    ownedRoot: root,
    storeProfileId,
    storeProfileSha256: "7".repeat(64)
  }), "durable_publication_receipt_store_profile_mismatch");
});

test("does not expose a recursive receipt or raw helper process material", (t) => {
  const root = makeRoot(t);
  const boundary = createVnextDurablePublication(root, configuration());
  const bytes = Buffer.from("durability target 008", "utf8");
  const result = boundary.publishBytes(targetRelativePath(bytes), bytes, 4096);
  const receiptBytes = fs.readFileSync(path.join(
    root,
    ...result.durabilityReceiptRelativePath.split("/")
  ));
  const receipt = JSON.parse(receiptBytes.toString("utf8"));
  const names = Object.keys(receipt).sort();

  assert.deepEqual(names, [...durablePublicationProfile.receiptFields].sort());
  assert.equal(Object.hasOwn(receipt, "durabilityReceiptDirectoryFlush"), false);
  assert.equal(Object.hasOwn(receipt, "durabilityReceiptSha256"), false);
  assert.equal(JSON.stringify(receipt).includes(root), false);
  assert.equal(JSON.stringify(receipt).includes("stdout"), false);
  assert.equal(JSON.stringify(receipt).includes("stderr"), false);
});

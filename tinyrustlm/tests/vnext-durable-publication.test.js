"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

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

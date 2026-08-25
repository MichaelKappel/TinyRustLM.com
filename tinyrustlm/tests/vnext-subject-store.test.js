"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  ensureVnextDirectoryFlushTestPackage
} = require("./helpers/vnext-directory-flush-test-package.js");
const { parseStrictJson } = require("../tools/strict-json.js");
const {
  durablePublicationProfile,
  durablePublicationProfileSha256,
  createVnextDurablePublication
} = require("../tools/vnext-durable-publication.js");
const {
  finalizeVnextIdentityDocument,
  identityContractForSchema
} = require("../tools/vnext-content-identity.js");
const {
  createVnextSubjectStore,
  subjectRelativePath,
  subjectStoreProfile,
  subjectStoreProfileSha256
} = require("../tools/vnext-subject-store.js");

ensureVnextDirectoryFlushTestPackage();

const repositoryRoot = path.resolve(__dirname, "../..");
const corpusPath = path.join(repositoryRoot, "contracts", "vnext",
  "contract-corpus.v1.json");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "subject-store-profile.v1.json");
const ownedPrefix = "tinyrustlm-vnext-subject-store-";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function makeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ownedPrefix));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.equal(path.basename(resolved).startsWith(ownedPrefix), true);
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

function corpusDocument(name) {
  const corpus = parseStrictJson(fs.readFileSync(corpusPath));
  const item = corpus.cases.find((entry) => entry.id === `valid-${name}`);
  return parseStrictJson(Buffer.from(item.payloadBase64, "base64"));
}

function finalized(name, mutate = null) {
  const draft = corpusDocument(name);
  const descriptor = identityContractForSchema(draft.schema);
  for (const field of descriptor.identityExcludedFields) delete draft[field];
  if (mutate !== null) mutate(draft);
  return finalizeVnextIdentityDocument(draft);
}

function physicalPath(root, subjectId) {
  return path.join(root, ...subjectRelativePath(subjectId).split("/"));
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

function trackNativeFs(t, hooks = {}) {
  const descriptorPaths = new Map();
  const originalOpen = fs.openSync.bind(fs);
  const originalClose = fs.closeSync.bind(fs);
  const originalWrite = fs.writeSync.bind(fs);
  const originalRead = fs.readSync.bind(fs);
  t.mock.method(fs, "openSync", (filePath, ...args) => {
      const descriptor = originalOpen(filePath, ...args);
      descriptorPaths.set(descriptor, path.resolve(String(filePath)));
      return descriptor;
  });
  t.mock.method(fs, "closeSync", (descriptor) => {
      descriptorPaths.delete(descriptor);
      return originalClose(descriptor);
  });
  t.mock.method(fs, "writeSync", (descriptor, buffer, offset, length, position) => {
      hooks.beforeWrite?.(descriptorPaths.get(descriptor));
      return originalWrite(descriptor, buffer, offset, length, position);
  });
  t.mock.method(fs, "readSync", (descriptor, buffer, offset, length, position) => {
      const count = originalRead(descriptor, buffer, offset, length, position);
      hooks.afterRead?.(descriptorPaths.get(descriptor), buffer, offset, count);
      return count;
  });
}

function publishSeed(root, relativePath, bytes) {
  const publisher = createVnextDurablePublication(root, {
    codePrefix: "subject_seed",
    steps: {
      open: "subject-store-open",
      path: "subject-store-path",
      persist: "subject-store-persist",
      read: "subject-store-read",
      scan: "subject-store-scan"
    },
    storeProfileId: subjectStoreProfile.profileId,
    storeProfileSha256: subjectStoreProfileSha256
  });
  publisher.publishBytes(relativePath, bytes,
    Math.max(...subjectStoreProfile.acceptedSubjects.map((entry) => entry.maximumBytes)));
}

function concurrentPut(root, bytes) {
  const modulePath = path.resolve(__dirname, "../tools/vnext-subject-store.js");
  const script = [
    `const {createVnextSubjectStore}=require(${JSON.stringify(modulePath)});`,
    "const store=createVnextSubjectStore(process.argv[1]);",
    "const result=store.put(Buffer.from(process.argv[2], 'base64'));",
    "process.stdout.write(JSON.stringify(result));"
  ].join("");
  return new Promise((resolve, reject) => {
    childProcess.execFile(
      process.execPath,
      ["-e", script, root, bytes.toString("base64")],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`concurrent put failed (${error.code || "unknown"}): ${stderr}`));
          return;
        }
        resolve(JSON.parse(stdout));
      }
    );
  });
}

test("freezes one public-only sole prelaunch subject-store profile", () => {
  const bytes = fs.readFileSync(profilePath);
  const parsed = parseStrictJson(bytes);

  assert.equal(subjectStoreProfileSha256, sha256(bytes));
  assert.equal(subjectStoreProfile.profileId, "tinyrustlm.vnext.subject-store.v1");
  assert.equal(Object.isFrozen(subjectStoreProfile), true);
  assert.equal(Object.isFrozen(subjectStoreProfile.acceptedSubjects), true);
  assert.equal(parsed.status, "frozen");
  assert.equal(parsed.visibility, "public-safe-only");
  assert.equal(parsed.layout.mutablePointerPolicy, "forbidden");
  assert.equal(parsed.layout.replacementPolicy, "never");
  assert.equal(parsed.durablePublication.profileId, durablePublicationProfile.profileId);
  assert.equal(parsed.durablePublication.profileSha256, durablePublicationProfileSha256);
  assert.deepEqual(parsed.activeStateAccess, {
    startup: "one-full-validated-rebuild-per-store-open",
    crossInstanceSync:
      "same-process-same-root-generation-only-registry-rebuilds-before-access",
    membershipSnapshot: "immutable-active-ids-and-total-bytes-no-filesystem-scan",
    documentSnapshot:
      "immutable-validated-documents-with-defensive-byte-copies-no-filesystem-scan",
    cachedDocumentRead:
      "active-membership-required-validated-owned-copy-no-filesystem-read",
    physicalRead:
      "target-and-durability-receipt-read-twice-exact-bytes-hash-and-subject-validation",
    restartValidation:
      "fresh-store-open-full-rebuild-with-verified-directory-flush-readback"
  });
  assert.deepEqual(parsed.batch, {
    minimumEntries: 1,
    maximumEntries: 1024,
    inputOrdering: "subject-id-utf8-bytewise-ascending",
    duplicateSubjectIds: "forbidden",
    preflight: "complete-before-publication",
    publication: "one-durable-publish-many-call",
    activation: "all-published-before-any-in-memory-activation",
    partialResult: "forbidden"
  });
  assert.equal(Object.hasOwn(parsed, "atomicCreate"), false);
  assert.doesNotMatch(bytes.toString("utf8"), /unavailable/iu);
  assert.deepEqual(parsed.acceptedSubjects.map((entry) => entry.schema), [
    "tinyrustlm.vnext.artifact_manifest.v1",
    "tinyrustlm.vnext.claim.v2",
    "tinyrustlm.vnext.outside_proof.v2",
    "tinyrustlm.vnext.p2p_manifest.v1",
    "tinyrustlm.vnext.release_manifest.v3"
  ]);
  assert.deepEqual(parsed.rejectedSubjects.map((entry) => entry.schema), [
    "tinyrustlm.vnext.context.v1",
    "tinyrustlm.vnext.receipt.v1"
  ]);
  assert.doesNotMatch(bytes.toString("utf8"), /alias|fallback|migration|dual-reader|dual-writer/iu);
});

test("rejects hostile options and coercive subject identifiers", (t) => {
  const root = makeRoot(t);
  let getterInvoked = false;
  const options = {};
  Object.defineProperty(options, "io", {
    enumerable: true,
    get() {
      getterInvoked = true;
      return fs;
    }
  });
  throwsCode(() => createVnextSubjectStore(root, options),
    "subject_store_option_accessor");
  assert.equal(getterInvoked, false);

  let coercionInvoked = false;
  const coercive = {
    toString() {
      coercionInvoked = true;
      return `sha256:${"a".repeat(64)}`;
    }
  };
  throwsCode(() => subjectRelativePath(coercive), "subject_id_invalid");
  assert.equal(coercionInvoked, false);
});

test("creates, reads, and byte-identically reuses every accepted subject class", (t) => {
  const root = makeRoot(t);
  const store = createVnextSubjectStore(root);
  const values = ["artifact", "claim", "proof", "p2p", "release"]
    .map((name) => finalized(name));

  assert.deepEqual(store.startup.activeSubjectIds, []);
  for (const value of values) {
    const created = store.put(value.bytes);
    assert.equal(created.subjectId, value.subjectId);
    assert.equal(created.canonicalContentSha256, value.canonicalContentSha256);
    assert.equal(created.disposition, "created");
    assert.equal(created.relativePath, subjectRelativePath(value.subjectId));
    assert.equal(created.durability.schema, durablePublicationProfile.resultSchema);
    assert.equal(created.durability.profileSha256, durablePublicationProfileSha256);
    assert.match(created.durability.durabilityReceiptSha256, /^[a-f0-9]{64}$/u);
    assert.equal(created.durability.targetDirectoryFlush.status, "performed");
    assert.doesNotMatch(JSON.stringify(created),
      new RegExp(root.replace(/\\/gu, "\\\\"), "u"));
    const read = store.read(value.subjectId);
    assert.deepEqual(read.bytes, value.bytes);
    assert.equal(read.durability.durabilityReceiptSha256,
      created.durability.durabilityReceiptSha256);
  }

  const beforeReuse = store.operationCounts();
  const originalSpawnSync = childProcess.spawnSync;
  let reuseHelperCalls = 0;
  t.mock.method(childProcess, "spawnSync", (...argumentsList) => {
    reuseHelperCalls += 1;
    return originalSpawnSync(...argumentsList);
  });
  for (const value of values) {
    const reused = store.put(value.bytes);
    assert.equal(reused.disposition, "existing-byte-identical");
    assert.equal(reused.durability.durabilityReceiptSha256,
      store.read(value.subjectId).durability.durabilityReceiptSha256);
  }
  assert.equal(reuseHelperCalls, 0);
  const afterReuse = store.operationCounts();
  assert.equal(afterReuse.publishedEntries, beforeReuse.publishedEntries);
  assert.equal(afterReuse.snapshotRevision, beforeReuse.snapshotRevision);
  assert.equal(afterReuse.putCalls, beforeReuse.putCalls + values.length);
  assert.equal(afterReuse.putManyCalls, beforeReuse.putManyCalls + values.length);

  const rebuilt = store.rebuild();
  assert.deepEqual(rebuilt.activeSubjectIds,
    values.map((entry) => entry.subjectId).sort());
  assert.equal(rebuilt.activeTotalBytes,
    values.reduce((total, entry) => total + entry.bytes.length, 0));
  assert.equal(fs.existsSync(path.join(root, "current")), false);
  assert.equal(fs.existsSync(path.join(root, "latest")), false);
});

test("publishes unordered subjects through one bounded durable batch", (t) => {
  const root = makeRoot(t);
  const store = createVnextSubjectStore(root);
  const values = ["artifact", "claim", "proof", "p2p", "release"]
    .map((name) => finalized(name));
  const originalSpawnSync = childProcess.spawnSync;
  const helperRequests = [];
  t.mock.method(childProcess, "spawnSync", (file, argumentsList, options) => {
    helperRequests.push(parseStrictJson(options.input));
    return originalSpawnSync(file, argumentsList, options);
  });

  const results = store.putMany([
    values[4].bytes,
    values[1].bytes,
    values[3].bytes,
    values[0].bytes,
    values[2].bytes
  ]);

  assert.equal(Object.isFrozen(results), true);
  assert.equal(results.every((entry) => Object.isFrozen(entry)), true);
  assert.deepEqual(results.map((entry) => entry.subjectId),
    values.map((entry) => entry.subjectId).sort());
  const targetBatches = helperRequests.filter((batch) => batch.requests.every((entry) =>
    entry.operationId.startsWith("durability:target-publish:")));
  const receiptBatches = helperRequests.filter((batch) => batch.requests.every((entry) =>
    entry.operationId.startsWith("durability:receipt-publish:")));
  assert.equal(targetBatches.length, 1);
  assert.equal(receiptBatches.length, 1);
  assert.equal(targetBatches[0].requests.length, 5);
  assert.equal(receiptBatches[0].requests.length, 5);
  for (const value of values) assert.deepEqual(store.read(value.subjectId).bytes, value.bytes);
});

test("serves immutable subject membership snapshots without rescanning", (t) => {
  const root = makeRoot(t);
  const store = createVnextSubjectStore(root);
  const values = ["artifact", "claim", "proof", "p2p", "release"]
    .map((name) => finalized(name));

  const empty = store.snapshot();
  assert.equal(Object.isFrozen(empty), true);
  assert.equal(Object.isFrozen(empty.activeSubjectIds), true);
  assert.deepEqual(empty.activeSubjectIds, []);
  assert.equal(empty.activeTotalBytes, 0);
  for (let index = 0; index < 1_024; index += 1) {
    assert.equal(store.snapshot(), empty);
  }

  const persisted = store.putMany(values.map((entry) => entry.bytes));
  const populated = store.snapshot();
  assert.notEqual(populated, empty);
  assert.deepEqual(populated.activeSubjectIds,
    persisted.map((entry) => entry.subjectId).sort());
  assert.equal(populated.activeTotalBytes,
    values.reduce((total, entry) => total + entry.bytes.length, 0));
  const documentSnapshot = store.documentSnapshot();
  assert.equal(Object.isFrozen(documentSnapshot), true);
  assert.equal(Object.isFrozen(documentSnapshot.documents), true);
  assert.deepEqual(documentSnapshot.activeSubjectIds, populated.activeSubjectIds);
  assert.deepEqual(documentSnapshot.documents.map((entry) => entry.subjectId),
    populated.activeSubjectIds);
  assert.equal(store.readDocument(populated.activeSubjectIds[0]),
    documentSnapshot.documents[0]);
  const firstDocumentBytes = documentSnapshot.documents[0].bytes;
  firstDocumentBytes[0] ^= 0xff;
  assert.notDeepEqual(firstDocumentBytes, documentSnapshot.documents[0].bytes);
  throwsCode(() => store.readDocument("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
    "subject_not_active");
  assert.deepEqual(store.operationCounts(), {
    fullRebuilds: 1,
    fullRebuildsInsidePutMany: 0,
    publishedEntries: 5,
    putCalls: 0,
    putManyCalls: 1,
    snapshotFilesystemScans: 0,
    snapshotReads: 1_027,
    snapshotRevision: 2
  });
});

test("rebuilds before access when another same-root subject store advances", (t) => {
  const root = makeRoot(t);
  const first = createVnextSubjectStore(root);
  const second = createVnextSubjectStore(root);

  assert.deepEqual(first.snapshot().activeSubjectIds, []);
  assert.equal(first.operationCounts().fullRebuilds, 2);
  const subject = finalized("claim");
  second.put(subject.bytes);

  assert.deepEqual(first.snapshot().activeSubjectIds, [subject.subjectId]);
  assert.equal(first.operationCounts().fullRebuilds, 3);
  assert.equal(first.operationCounts().snapshotFilesystemScans, 0);
  assert.deepEqual(first.read(subject.subjectId).bytes, subject.bytes);
});

test("rejects malformed subject batches before publishing any target", (t) => {
  const root = makeRoot(t);
  const store = createVnextSubjectStore(root);
  const value = finalized("proof");
  throwsCode(() => store.putMany([]), "subject_batch_invalid");
  throwsCode(() => store.putMany([value.bytes, value.bytes]),
    "subject_batch_duplicate_id");

  let getterInvoked = false;
  const hostile = [value.bytes];
  Object.defineProperty(hostile, "0", {
    enumerable: true,
    get() {
      getterInvoked = true;
      return value.bytes;
    }
  });
  throwsCode(() => store.putMany(hostile), "subject_batch_invalid_accessor");
  assert.equal(getterInvoked, false);
  throwsCode(() => store.putMany(Array.from({ length: 1_025 }, () => value.bytes)),
    "subject_batch_invalid");
  assert.equal(fs.existsSync(physicalPath(root, value.subjectId)), false);
});

test("rejects private context and receipt documents from the subject store", (t) => {
  const store = createVnextSubjectStore(makeRoot(t));
  throwsCode(() => store.put(finalized("context").bytes), "subject_schema_not_allowed");
  throwsCode(() => store.put(finalized("receipt").bytes), "subject_schema_not_allowed");
  assert.deepEqual(store.rebuild().activeSubjectIds, []);
});

test("serializes independent process creates by immutable subject identity", async (t) => {
  const root = makeRoot(t);
  const value = finalized("proof");
  const results = await Promise.all([
    concurrentPut(root, value.bytes),
    concurrentPut(root, value.bytes)
  ]);

  assert.deepEqual(results.map((entry) => entry.disposition).sort(),
    ["created", "existing-byte-identical"]);
  const restarted = createVnextSubjectStore(root);
  assert.deepEqual(restarted.startup.activeSubjectIds, [value.subjectId]);
  assert.deepEqual(restarted.read(value.subjectId).bytes, value.bytes);
});

test("fails closed when one artifact identity is assigned conflicting manifest bytes", (t) => {
  const root = makeRoot(t);
  const first = finalized("artifact");
  const conflicting = finalized("artifact", (draft) => {
    draft.metadataSha256 = "3".repeat(64);
  });
  assert.equal(conflicting.subjectId, first.subjectId);
  assert.notEqual(conflicting.canonicalContentSha256, first.canonicalContentSha256);

  const store = createVnextSubjectStore(root);
  store.put(first.bytes);
  throwsCode(() => store.put(conflicting.bytes), "subject_target_conflict");
  assert.deepEqual(store.read(first.subjectId).bytes, first.bytes);
});

test("quarantines invalid, unaccepted, and path-mismatched subjects on rebuild", (t) => {
  const root = makeRoot(t);
  const proof = finalized("proof");
  const context = finalized("context");
  const wrongDigest = "f".repeat(64);
  const invalidPath = path.join(root, "subjects", "sha256", "aa", `${"a".repeat(64)}.json`);
  const contextPath = physicalPath(root, context.subjectId);
  const wrongPath = path.join(root, "subjects", "sha256", "ff", `${wrongDigest}.json`);
  publishSeed(root, "subjects/sha256/aa/" + `${"a".repeat(64)}.json`,
    Buffer.from("not-json"));
  publishSeed(root, subjectRelativePath(context.subjectId), context.bytes);
  publishSeed(root, `subjects/sha256/ff/${wrongDigest}.json`, proof.bytes);

  const store = createVnextSubjectStore(root);
  assert.deepEqual(store.startup.activeSubjectIds, []);
  assert.deepEqual(store.startup.newQuarantines.map((entry) => entry.reasonCode).sort(),
    ["invalid_subject", "path_identity_mismatch", "schema_not_allowed"].sort());
  assert.equal(fs.existsSync(invalidPath), false);
  assert.equal(fs.existsSync(contextPath), false);
  assert.equal(fs.existsSync(wrongPath), false);
});

test("retains fresh temporaries and quarantines interrupted old writes", (t) => {
  const root = makeRoot(t);
  const value = finalized("proof");
  const target = physicalPath(root, value.subjectId);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const digest = value.subjectId.slice("sha256:".length);
  const temporary = path.join(path.dirname(target),
    `.${digest}.${process.pid}.abcd.tmp`);
  fs.writeFileSync(temporary, Buffer.from("partial"));

  const store = createVnextSubjectStore(root);
  assert.equal(store.startup.pendingTemporaryCount, 1);
  assert.equal(fs.existsSync(temporary), true);
  const old = new Date(Date.now() - 600000);
  fs.utimesSync(temporary, old, old);
  const rebuilt = store.rebuild();
  assert.equal(rebuilt.pendingTemporaryCount, 0);
  assert.deepEqual(rebuilt.newQuarantines.map((entry) => entry.reasonCode),
    ["incomplete_temporary"]);
  assert.equal(fs.existsSync(temporary), false);
});

test("turns disk-full writes into bounded errors without publishing partial subjects", (t) => {
  const root = makeRoot(t);
  const value = finalized("proof");
  const store = createVnextSubjectStore(root);
  trackNativeFs(t, {
    beforeWrite(filePath) {
      if (filePath?.endsWith(".tmp")) {
        const error = new Error(`private disk detail ${root}`);
        error.code = "ENOSPC";
        throw error;
      }
    }
  });
  let caught;
  try {
    store.put(value.bytes);
  } catch (error) {
    caught = error;
  }
  assert.equal(caught?.code, "subject_temporary_write_failed");
  assert.equal(caught?.causeCode, "enospc");
  assert.doesNotMatch(String(caught?.message), new RegExp(root.replace(/\\/gu, "\\\\"), "u"));
  assert.equal(fs.existsSync(physicalPath(root, value.subjectId)), false);
});

test("detects post-startup subject mutation and withdraws it on restart", (t) => {
  const root = makeRoot(t);
  const value = finalized("proof");
  const store = createVnextSubjectStore(root);
  store.put(value.bytes);
  const target = physicalPath(root, value.subjectId);
  const tampered = Buffer.from(value.bytes);
  tampered[tampered.length - 2] ^= 1;
  fs.writeFileSync(target, tampered);

  throwsCode(() => store.read(value.subjectId), "subject_active_read_failed");
  const restarted = createVnextSubjectStore(root);
  assert.deepEqual(restarted.startup.activeSubjectIds, []);
  assert.deepEqual(restarted.startup.newQuarantines.map((entry) => entry.reasonCode),
    ["durability_target_mismatch"]);
  throwsCode(() => restarted.read(value.subjectId), "subject_not_active");
});

test("fails a false readback while retaining recoverable canonical bytes", (t) => {
  const root = makeRoot(t);
  const value = finalized("proof");
  const target = physicalPath(root, value.subjectId);
  const store = createVnextSubjectStore(root);
  let injected = false;
  trackNativeFs(t, {
    afterRead(filePath, buffer, offset, count) {
      if (!injected && filePath === target && count > 0) {
        injected = true;
        buffer[offset] ^= 0xff;
      }
    }
  });

  throwsCode(() => store.put(value.bytes), "subject_readback_mismatch");
  assert.deepEqual(fs.readFileSync(target), value.bytes);
  const restarted = createVnextSubjectStore(root);
  assert.deepEqual(restarted.startup.activeSubjectIds, []);
  assert.deepEqual(restarted.startup.newQuarantines.map((entry) => entry.reasonCode),
    ["durability_receipt_missing"]);
});

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
  finalizeVnextIdentityDocument,
  identityContractForSchema
} = require("../tools/vnext-content-identity.js");
const {
  createVnextSubjectStore,
  subjectRelativePath,
  subjectStoreProfile,
  subjectStoreProfileSha256
} = require("../tools/vnext-subject-store.js");

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

function proxyIo(overrides) {
  return new Proxy(fs, {
    get(target, property) {
      if (Object.hasOwn(overrides, property)) return overrides[property];
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function trackedIo(hooks = {}) {
  const descriptorPaths = new Map();
  return proxyIo({
    openSync(filePath, ...args) {
      const descriptor = fs.openSync(filePath, ...args);
      descriptorPaths.set(descriptor, path.resolve(String(filePath)));
      return descriptor;
    },
    closeSync(descriptor) {
      descriptorPaths.delete(descriptor);
      return fs.closeSync(descriptor);
    },
    writeSync(descriptor, buffer, offset, length, position) {
      hooks.beforeWrite?.(descriptorPaths.get(descriptor));
      return fs.writeSync(descriptor, buffer, offset, length, position);
    },
    readSync(descriptor, buffer, offset, length, position) {
      const count = fs.readSync(descriptor, buffer, offset, length, position);
      hooks.afterRead?.(descriptorPaths.get(descriptor), buffer, offset, count);
      return count;
    }
  });
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

test("freezes one public-only incompatible subject-store profile", () => {
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
  assert.deepEqual(parsed.acceptedSubjects.map((entry) => entry.schema), [
    "tinyrustlm.vnext.artifact_manifest.v1",
    "tinyrustlm.vnext.claim.v1",
    "tinyrustlm.vnext.outside_proof.v2",
    "tinyrustlm.vnext.p2p_manifest.v1",
    "tinyrustlm.vnext.release_manifest.v1"
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
    assert.equal(created.durability.fileData, "fsync-complete");
    assert.ok(["performed", "unavailable-win32-node"].includes(
      created.durability.directoryMetadata));
    assert.equal(created.durability.readback, "verified");
    assert.doesNotMatch(JSON.stringify(created),
      new RegExp(root.replace(/\\/gu, "\\\\"), "u"));
    assert.deepEqual(store.read(value.subjectId).bytes, value.bytes);
    assert.equal(store.put(value.bytes).disposition, "existing-byte-identical");
  }

  const rebuilt = store.rebuild();
  assert.deepEqual(rebuilt.activeSubjectIds,
    values.map((entry) => entry.subjectId).sort());
  assert.equal(rebuilt.activeTotalBytes,
    values.reduce((total, entry) => total + entry.bytes.length, 0));
  assert.equal(fs.existsSync(path.join(root, "current")), false);
  assert.equal(fs.existsSync(path.join(root, "latest")), false);
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
  fs.mkdirSync(path.dirname(invalidPath), { recursive: true });
  fs.mkdirSync(path.dirname(contextPath), { recursive: true });
  fs.mkdirSync(path.dirname(wrongPath), { recursive: true });
  fs.writeFileSync(invalidPath, Buffer.from("not-json"));
  fs.writeFileSync(contextPath, context.bytes);
  fs.writeFileSync(wrongPath, proof.bytes);

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
  const io = trackedIo({
    beforeWrite(filePath) {
      if (filePath?.endsWith(".tmp")) {
        const error = new Error(`private disk detail ${root}`);
        error.code = "ENOSPC";
        throw error;
      }
    }
  });
  const store = createVnextSubjectStore(root, { io });
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
    ["invalid_subject"]);
  throwsCode(() => restarted.read(value.subjectId), "subject_not_active");
});

test("fails a false readback while retaining recoverable canonical bytes", (t) => {
  const root = makeRoot(t);
  const value = finalized("proof");
  const target = physicalPath(root, value.subjectId);
  let injected = false;
  const io = trackedIo({
    afterRead(filePath, buffer, offset, count) {
      if (!injected && filePath === target && count > 0) {
        injected = true;
        buffer[offset] ^= 0xff;
      }
    }
  });
  const store = createVnextSubjectStore(root, { io });

  throwsCode(() => store.put(value.bytes), "subject_readback_mismatch");
  assert.deepEqual(fs.readFileSync(target), value.bytes);
  const restarted = createVnextSubjectStore(root);
  assert.deepEqual(restarted.read(value.subjectId).bytes, value.bytes);
});

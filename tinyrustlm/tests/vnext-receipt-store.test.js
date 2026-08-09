"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  finalizeVnextReceipt,
  receiptIdentityExcludedFields
} = require("../tools/vnext-receipt-identity.js");
const {
  classifyReceiptGraph,
  collectParentReceiptIds,
  createVnextReceiptStore,
  receiptRelativePath,
  storeProfile
} = require("../tools/vnext-receipt-store.js");

const corpusPath = path.resolve(__dirname, "../../contracts/vnext/contract-corpus.v1.json");
const ownedPrefix = "tinyrustlm-vnext-receipt-store-";

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

function baseDraft() {
  const corpus = parseStrictJson(fs.readFileSync(corpusPath));
  const item = corpus.cases.find((entry) => entry.id === "valid-receipt");
  const receipt = parseStrictJson(Buffer.from(item.payloadBase64, "base64"));
  for (const name of receiptIdentityExcludedFields) delete receipt[name];
  return receipt;
}

function finalized(attempt, parents = []) {
  const draft = baseDraft();
  draft.attemptId = attempt;
  draft.inputReceiptIds = [...parents].sort();
  return finalizeVnextReceipt(draft);
}

function physicalPath(root, receiptId) {
  return path.join(root, ...receiptRelativePath(receiptId).split("/"));
}

function seedReceipt(root, value, relativePath = receiptRelativePath(value.receipt.receiptId)) {
  const target = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value.bytes, { flag: "wx", mode: 0o600 });
  return target;
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
  const io = proxyIo({
    openSync(filePath, ...args) {
      const descriptor = fs.openSync(filePath, ...args);
      descriptorPaths.set(descriptor, path.resolve(String(filePath)));
      return descriptor;
    },
    closeSync(descriptor) {
      descriptorPaths.delete(descriptor);
      return fs.closeSync(descriptor);
    },
    fsyncSync(descriptor) {
      hooks.beforeFsync?.(descriptorPaths.get(descriptor), descriptor);
      return fs.fsyncSync(descriptor);
    },
    linkSync(source, destination) {
      hooks.beforeLink?.(path.resolve(source), path.resolve(destination));
      return fs.linkSync(source, destination);
    },
    readSync(descriptor, buffer, offset, length, position) {
      const count = fs.readSync(descriptor, buffer, offset, length, position);
      hooks.afterRead?.(
        descriptorPaths.get(descriptor),
        buffer,
        offset,
        count,
        descriptor
      );
      return count;
    }
  });
  return io;
}

function concurrentPut(root, bytes) {
  const modulePath = path.resolve(__dirname, "../tools/vnext-receipt-store.js");
  const script = [
    `const {createVnextReceiptStore}=require(${JSON.stringify(modulePath)});`,
    "const store=createVnextReceiptStore(process.argv[1]);",
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

test("rejects accessor-bearing store options without executing them", (t) => {
  const root = makeRoot(t);
  let executed = false;
  const options = {};
  Object.defineProperty(options, "io", {
    enumerable: true,
    get() {
      executed = true;
      return fs;
    }
  });

  throwsCode(() => createVnextReceiptStore(root, options),
    "receipt_store_option_accessor");
  assert.equal(executed, false);
});

test("rejects explicit invalid options instead of silently selecting defaults", (t) => {
  const root = makeRoot(t);
  throwsCode(() => createVnextReceiptStore(root, { io: null }),
    "receipt_store_io_invalid");
  throwsCode(() => createVnextReceiptStore(root, { platform: "" }),
    "receipt_store_options_invalid");
  throwsCode(() => createVnextReceiptStore(root, { randomBytes: null }),
    "receipt_store_options_invalid");
});

test("rejects coercive receipt identifiers and graph accessors without executing them", () => {
  let receiptIdExecuted = false;
  const coerciveId = {
    toString() {
      receiptIdExecuted = true;
      return `sha256:${"a".repeat(64)}`;
    }
  };
  throwsCode(() => receiptRelativePath(coerciveId), "receipt_id_invalid");
  assert.equal(receiptIdExecuted, false);

  let recordExecuted = false;
  const record = { parentReceiptIds: [] };
  Object.defineProperty(record, "receiptId", {
    enumerable: true,
    get() {
      recordExecuted = true;
      return `sha256:${"a".repeat(64)}`;
    }
  });
  throwsCode(() => classifyReceiptGraph([record]),
    "receipt_graph_record_invalid_accessor");
  assert.equal(recordExecuted, false);

  let arrayExecuted = false;
  const records = [null];
  Object.defineProperty(records, "0", {
    enumerable: true,
    get() {
      arrayExecuted = true;
      return record;
    }
  });
  throwsCode(() => classifyReceiptGraph(records),
    "receipt_graph_records_invalid_accessor");
  assert.equal(arrayExecuted, false);
});

test("creates, reads, and idempotently reuses exact canonical receipt bytes", (t) => {
  const root = makeRoot(t);
  const store = createVnextReceiptStore(root);
  const value = finalized("attempt-store-create-001");

  assert.deepEqual(store.startup.activeReceiptIds, []);
  const created = store.put(value.bytes);
  assert.equal(created.receiptId, value.receipt.receiptId);
  assert.equal(created.relativePath, receiptRelativePath(value.receipt.receiptId));
  assert.equal(created.disposition, "created");
  assert.equal(created.durability.fileData, "fsync-complete");
  assert.ok(["performed", "unavailable-win32-node"].includes(
    created.durability.directoryMetadata));
  assert.equal(created.durability.readback, "verified");
  assert.doesNotMatch(JSON.stringify(created), new RegExp(root.replace(/\\/gu, "\\\\"), "u"));
  assert.deepEqual(store.read(value.receipt.receiptId).bytes, value.bytes);

  const reused = store.put(value.bytes);
  assert.equal(reused.disposition, "existing-byte-identical");
  assert.equal(reused.receiptId, created.receiptId);
  assert.deepEqual(fs.readFileSync(physicalPath(root, created.receiptId)), value.bytes);
});

test("serializes two independent process creates through immutable target identity", async (t) => {
  const root = makeRoot(t);
  const value = finalized("attempt-store-concurrent-create-001");
  const results = await Promise.all([
    concurrentPut(root, value.bytes),
    concurrentPut(root, value.bytes)
  ]);

  assert.deepEqual(results.map((entry) => entry.disposition).sort(),
    ["created", "existing-byte-identical"]);
  assert.equal(results.every((entry) => entry.receiptId === value.receipt.receiptId), true);
  assert.deepEqual(fs.readFileSync(physicalPath(root, value.receipt.receiptId)), value.bytes);
  const restarted = createVnextReceiptStore(root);
  assert.deepEqual(restarted.startup.activeReceiptIds, [value.receipt.receiptId]);
});

test("never replaces an existing target whose bytes conflict with its identity path", (t) => {
  const root = makeRoot(t);
  const store = createVnextReceiptStore(root);
  const value = finalized("attempt-store-conflict-001");
  const target = physicalPath(root, value.receipt.receiptId);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from("conflict", "utf8"), { flag: "wx" });

  throwsCode(() => store.put(value.bytes), "receipt_target_conflict");
  assert.equal(fs.readFileSync(target, "utf8"), "conflict");
});

test("reconstructs a complete graph after process restart", (t) => {
  const root = makeRoot(t);
  const first = createVnextReceiptStore(root);
  const parent = finalized("attempt-store-parent-001");
  first.put(parent.bytes);
  const child = finalized("attempt-store-child-001", [parent.receipt.receiptId]);
  first.put(child.bytes);

  const restarted = createVnextReceiptStore(root);
  assert.deepEqual(restarted.startup.activeReceiptIds,
    [parent.receipt.receiptId, child.receipt.receiptId].sort());
  assert.deepEqual(collectParentReceiptIds(child.receipt), [parent.receipt.receiptId]);
  assert.equal(restarted.read(child.receipt.receiptId).receipt.attemptId,
    "attempt-store-child-001");
});

test("revalidates the complete parent closure against disk before reads and writes", (t) => {
  const root = makeRoot(t);
  const store = createVnextReceiptStore(root);
  const parent = finalized("attempt-store-live-parent-001");
  store.put(parent.bytes);
  const child = finalized("attempt-store-live-child-001", [parent.receipt.receiptId]);
  store.put(child.bytes);
  fs.writeFileSync(physicalPath(root, parent.receipt.receiptId), Buffer.from("mutated"));

  throwsCode(() => store.read(child.receipt.receiptId), "receipt_active_parent_invalid");
  const grandchild = finalized("attempt-store-live-grandchild-001", [child.receipt.receiptId]);
  throwsCode(() => store.put(grandchild.bytes), "receipt_active_parent_invalid");
});

test("does not publish a child when its parent changes after preflight", (t) => {
  const root = makeRoot(t);
  const parent = finalized("attempt-store-racing-parent-001");
  const child = finalized("attempt-store-racing-child-001", [parent.receipt.receiptId]);
  const parentTarget = physicalPath(root, parent.receipt.receiptId);
  const childTarget = physicalPath(root, child.receipt.receiptId);
  let mutated = false;
  const io = trackedIo({
    beforeLink(_source, destination) {
      if (!mutated && destination === childTarget) {
        mutated = true;
        fs.writeFileSync(parentTarget, Buffer.from("mutated-parent"));
      }
    }
  });
  const store = createVnextReceiptStore(root, { io });
  store.put(parent.bytes);

  throwsCode(() => store.put(child.bytes), "receipt_active_parent_invalid");
  assert.equal(fs.existsSync(childTarget), false);
  throwsCode(() => store.read(child.receipt.receiptId), "receipt_not_active");
});

test("rejects a receipt parent directory replaced by an outside junction", (t) => {
  const root = makeRoot(t);
  const store = createVnextReceiptStore(root);
  const value = finalized("attempt-store-parent-junction-001");
  store.put(value.bytes);
  const target = physicalPath(root, value.receipt.receiptId);
  const prefix = path.dirname(target);
  const backup = `${prefix}.owned-backup`;
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), `${ownedPrefix}outside-read-`));
  fs.renameSync(prefix, backup);
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, path.basename(target)), value.bytes, { flag: "wx" });
  fs.symlinkSync(outside, prefix, process.platform === "win32" ? "junction" : "dir");
  try {
    assert.throws(
      () => store.read(value.receipt.receiptId),
      (error) => error?.code === "receipt_active_read_failed" &&
        error?.causeCode === "receipt_store_path_link"
    );
  } finally {
    fs.unlinkSync(prefix);
    fs.renameSync(backup, prefix);
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("rejects a write whose receipt parent is absent", (t) => {
  const root = makeRoot(t);
  const store = createVnextReceiptStore(root);
  const missing = `sha256:${"e".repeat(64)}`;
  const child = finalized("attempt-store-missing-parent-put-001", [missing]);

  throwsCode(() => store.put(child.bytes), "receipt_parent_missing");
  assert.equal(fs.existsSync(physicalPath(root, child.receipt.receiptId)), false);
});

test("quarantines missing-parent chains while preserving unrelated receipts", (t) => {
  const root = makeRoot(t);
  const missing = `sha256:${"e".repeat(64)}`;
  const broken = finalized("attempt-store-broken-001", [missing]);
  const dependent = finalized("attempt-store-dependent-001", [broken.receipt.receiptId]);
  const unrelated = finalized("attempt-store-unrelated-001");
  seedReceipt(root, broken);
  seedReceipt(root, dependent);
  seedReceipt(root, unrelated);

  const store = createVnextReceiptStore(root);
  const reasons = new Map(store.startup.newQuarantines.map((entry) =>
    [entry.receiptId, entry.reasonCode]));
  assert.equal(reasons.get(broken.receipt.receiptId), "missing_parent");
  assert.equal(reasons.get(dependent.receipt.receiptId), "invalid_ancestor");
  assert.deepEqual(store.startup.activeReceiptIds, [unrelated.receipt.receiptId]);
  assert.equal(fs.existsSync(physicalPath(root, broken.receipt.receiptId)), false);
  assert.equal(fs.existsSync(physicalPath(root, dependent.receipt.receiptId)), false);
  assert.deepEqual(store.read(unrelated.receipt.receiptId).bytes, unrelated.bytes);
});

test("classifies cycles and their descendants without invalidating unrelated nodes", () => {
  const a = `sha256:${"a".repeat(64)}`;
  const b = `sha256:${"b".repeat(64)}`;
  const child = `sha256:${"c".repeat(64)}`;
  const unrelated = `sha256:${"d".repeat(64)}`;
  const result = classifyReceiptGraph([
    { receiptId: a, parentReceiptIds: [b] },
    { receiptId: b, parentReceiptIds: [a] },
    { receiptId: child, parentReceiptIds: [a] },
    { receiptId: unrelated, parentReceiptIds: [] }
  ]);
  assert.deepEqual(result.activeReceiptIds, [unrelated]);
  assert.deepEqual(result.invalid, [
    { receiptId: a, reasonCode: "receipt_cycle" },
    { receiptId: b, reasonCode: "receipt_cycle" },
    { receiptId: child, reasonCode: "invalid_ancestor" }
  ]);
});

test("classifies a deep bounded graph without recursive stack exhaustion", () => {
  const count = 20_000;
  const receiptIds = Array.from({ length: count }, (_entry, index) =>
    `sha256:${index.toString(16).padStart(64, "0")}`);
  const records = receiptIds.map((receiptId, index) => ({
    receiptId,
    parentReceiptIds: index + 1 < receiptIds.length ? [receiptIds[index + 1]] : []
  }));

  const result = classifyReceiptGraph(records);
  assert.equal(result.invalid.length, 0);
  assert.deepEqual(result.activeReceiptIds, [...receiptIds].sort());
});

test("rejects a new quarantine mutation when the bounded quarantine is full", (t) => {
  const root = makeRoot(t);
  const unexpected = path.join(root, "unexpected.txt");
  fs.writeFileSync(unexpected, "preserve");
  const quarantine = path.join(root, "quarantine");
  let syntheticIndex = 0;
  const io = proxyIo({
    opendirSync(directory) {
      if (path.resolve(directory) !== path.resolve(quarantine)) {
        return fs.opendirSync(directory);
      }
      return {
        readSync() {
          if (syntheticIndex >= storeProfile.limits.maximumQuarantineEntries) return null;
          syntheticIndex += 1;
          return { name: `existing-${syntheticIndex.toString().padStart(8, "0")}.q` };
        },
        closeSync() {}
      };
    }
  });

  throwsCode(() => createVnextReceiptStore(root, { io }),
    "receipt_store_quarantine_limit");
  assert.equal(fs.readFileSync(unexpected, "utf8"), "preserve");
});

test("enforces the bounded per-directory scan before processing entries", (t) => {
  const root = makeRoot(t);
  const shaRoot = path.join(root, "receipts", "sha256");
  let syntheticIndex = 0;
  const io = proxyIo({
    opendirSync(directory) {
      if (path.resolve(directory) !== path.resolve(shaRoot)) {
        return fs.opendirSync(directory);
      }
      return {
        readSync() {
          if (syntheticIndex > storeProfile.limits.maximumDirectoryEntries) return null;
          syntheticIndex += 1;
          return { name: "synthetic-entry" };
        },
        closeSync() {}
      };
    }
  });

  throwsCode(() => createVnextReceiptStore(root, { io }),
    "receipt_store_directory_entry_limit");
});

test("quarantines truncation, temporary files, path drift, and unknown entries", (t) => {
  const root = makeRoot(t);
  const value = finalized("attempt-store-path-drift-001");
  const digest = value.receipt.receiptId.slice("sha256:".length);
  const prefix = path.join(root, "receipts", "sha256", digest.slice(0, 2));
  fs.mkdirSync(prefix, { recursive: true });
  fs.writeFileSync(path.join(prefix, `${"f".repeat(64)}.json`), value.bytes);
  const temporary = path.join(prefix, `.${digest}.${process.pid}.abcd.tmp`);
  fs.writeFileSync(temporary, Buffer.from("partial"));
  const old = new Date(Date.now() - storeProfile.concurrency.minimumIncompleteTemporaryAgeMs - 1000);
  fs.utimesSync(temporary, old, old);
  fs.writeFileSync(path.join(prefix, `${"0".repeat(64)}.json`), Buffer.from("{"));
  fs.writeFileSync(path.join(root, "receipts", "sha256", "README.txt"), Buffer.from("unknown"));

  const store = createVnextReceiptStore(root);
  const reasons = store.startup.newQuarantines.map((entry) => entry.reasonCode).sort();
  assert.deepEqual(reasons, [
    "incomplete_temporary",
    "invalid_receipt",
    "path_identity_mismatch",
    "unknown_entry"
  ]);
  assert.deepEqual(store.startup.activeReceiptIds, []);
  assert.equal(reasons.length, store.startup.newQuarantines.length);
  assert.doesNotMatch(JSON.stringify(store.startup),
    new RegExp(root.replace(/\\/gu, "\\\\"), "u"));
});

test("recovers a published receipt when interruption leaves its temporary link", (t) => {
  const root = makeRoot(t);
  const value = finalized("attempt-store-published-with-temp-001");
  seedReceipt(root, value);
  const target = physicalPath(root, value.receipt.receiptId);
  const digest = value.receipt.receiptId.slice("sha256:".length);
  const temporary = path.join(path.dirname(target), `.${digest}.${process.pid}.abcd.tmp`);
  fs.writeFileSync(temporary, value.bytes, { flag: "wx" });
  const old = new Date(Date.now() - storeProfile.concurrency.minimumIncompleteTemporaryAgeMs - 1000);
  fs.utimesSync(temporary, old, old);

  const store = createVnextReceiptStore(root);
  assert.deepEqual(store.startup.activeReceiptIds, [value.receipt.receiptId]);
  assert.deepEqual(store.startup.newQuarantines.map((entry) => entry.reasonCode),
    ["incomplete_temporary"]);
  assert.deepEqual(store.read(value.receipt.receiptId).bytes, value.bytes);
});

test("leaves a fresh unpublished temporary pending and quarantines it only after aging", (t) => {
  const root = makeRoot(t);
  const value = finalized("attempt-store-fresh-temporary-001");
  const target = physicalPath(root, value.receipt.receiptId);
  const digest = value.receipt.receiptId.slice("sha256:".length);
  const temporary = path.join(path.dirname(target), `.${digest}.${process.pid}.abcd.tmp`);
  fs.mkdirSync(path.dirname(temporary), { recursive: true });
  fs.writeFileSync(temporary, value.bytes, { flag: "wx" });

  const first = createVnextReceiptStore(root);
  assert.equal(first.startup.pendingTemporaryCount, 1);
  assert.deepEqual(first.startup.newQuarantines, []);
  assert.equal(fs.existsSync(temporary), true);

  const old = new Date(Date.now() - storeProfile.concurrency.minimumIncompleteTemporaryAgeMs - 1000);
  fs.utimesSync(temporary, old, old);
  const rebuilt = first.rebuild();
  assert.equal(rebuilt.pendingTemporaryCount, 0);
  assert.deepEqual(rebuilt.newQuarantines.map((entry) => entry.reasonCode),
    ["incomplete_temporary"]);
  assert.equal(fs.existsSync(temporary), false);
});

test("does not traverse an unknown directory link during startup recovery", (t) => {
  const root = makeRoot(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), `${ownedPrefix}outside-`));
  t.after(() => {
    const resolved = path.resolve(outside);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.equal(path.basename(resolved).startsWith(`${ownedPrefix}outside-`), true);
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const sentinel = path.join(outside, "sentinel.txt");
  fs.writeFileSync(sentinel, "untouched");
  const shaRoot = path.join(root, "receipts", "sha256");
  fs.mkdirSync(shaRoot, { recursive: true });
  fs.symlinkSync(outside, path.join(shaRoot, "zz"), process.platform === "win32" ? "junction" : "dir");

  const store = createVnextReceiptStore(root);
  assert.equal(store.startup.newQuarantines.length, 1);
  assert.equal(store.startup.newQuarantines[0].reasonCode, "unknown_entry");
  assert.equal(fs.readFileSync(sentinel, "utf8"), "untouched");
});

test("turns disk-full writes into bounded errors and removes partial temporaries", (t) => {
  const root = makeRoot(t);
  const diskFullIo = new Proxy(fs, {
    get(target, property) {
      if (property === "writeSync") {
        return () => {
          const error = new Error(`sensitive host detail ${root}`);
          error.code = "ENOSPC";
          throw error;
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
  const store = createVnextReceiptStore(root, { io: diskFullIo });
  const value = finalized("attempt-store-disk-full-001");
  let caught;
  try {
    store.put(value.bytes);
  } catch (error) {
    caught = error;
  }
  assert.equal(caught?.code, "receipt_temporary_write_failed");
  assert.equal(caught?.causeCode, "enospc");
  assert.doesNotMatch(caught?.message || "", new RegExp(root.replace(/\\/gu, "\\\\"), "u"));
  assert.equal(fs.existsSync(physicalPath(root, value.receipt.receiptId)), false);
  const prefix = path.dirname(physicalPath(root, value.receipt.receiptId));
  assert.equal(fs.readdirSync(prefix).some((name) => name.endsWith(".tmp")), false);
});

test("removes an unpublished temporary when file fsync fails", (t) => {
  const root = makeRoot(t);
  const io = trackedIo({
    beforeFsync(filePath) {
      if (filePath?.endsWith(".tmp")) {
        const error = new Error(`private fsync detail ${root}`);
        error.code = "EIO";
        throw error;
      }
    }
  });
  const store = createVnextReceiptStore(root, { io });
  const value = finalized("attempt-store-file-fsync-failure-001");

  let caught;
  try {
    store.put(value.bytes);
  } catch (error) {
    caught = error;
  }
  assert.equal(caught?.code, "receipt_temporary_write_failed");
  assert.equal(caught?.causeCode, "eio");
  assert.equal(fs.existsSync(physicalPath(root, value.receipt.receiptId)), false);
  const prefix = path.dirname(physicalPath(root, value.receipt.receiptId));
  assert.equal(fs.readdirSync(prefix).some((name) => name.endsWith(".tmp")), false);
});

test("removes an unpublished temporary when hard-link publication fails", (t) => {
  const root = makeRoot(t);
  const io = trackedIo({
    beforeLink(source, destination) {
      if (source.endsWith(".tmp") && destination.endsWith(".json")) {
        const error = new Error(`private link detail ${root}`);
        error.code = "EIO";
        throw error;
      }
    }
  });
  const store = createVnextReceiptStore(root, { io });
  const value = finalized("attempt-store-link-failure-001");

  let caught;
  try {
    store.put(value.bytes);
  } catch (error) {
    caught = error;
  }
  assert.equal(caught?.code, "receipt_publish_failed");
  assert.equal(caught?.causeCode, "eio");
  assert.equal(fs.existsSync(physicalPath(root, value.receipt.receiptId)), false);
  const prefix = path.dirname(physicalPath(root, value.receipt.receiptId));
  assert.equal(fs.readdirSync(prefix).some((name) => name.endsWith(".tmp")), false);
});

test("recovers a published receipt after directory synchronization fails", (t) => {
  const root = makeRoot(t);
  const value = finalized("attempt-store-directory-fsync-failure-001");
  const target = physicalPath(root, value.receipt.receiptId);
  const prefix = path.dirname(target);
  let injected = false;
  const io = trackedIo({
    beforeFsync(filePath) {
      if (!injected && filePath === prefix) {
        injected = true;
        const error = new Error(`private directory fsync detail ${root}`);
        error.code = "EIO";
        throw error;
      }
    }
  });
  const store = createVnextReceiptStore(root, { io });

  let caught;
  try {
    store.put(value.bytes);
  } catch (error) {
    caught = error;
  }
  assert.equal(caught?.code, "receipt_directory_sync_failed");
  assert.equal(caught?.causeCode, "eio");
  assert.deepEqual(fs.readFileSync(target), value.bytes);

  const restarted = createVnextReceiptStore(root);
  assert.deepEqual(restarted.startup.activeReceiptIds, [value.receipt.receiptId]);
  assert.equal(restarted.put(value.bytes).disposition, "existing-byte-identical");
});

test("fails a false readback without corrupting the published receipt", (t) => {
  const root = makeRoot(t);
  const value = finalized("attempt-store-readback-failure-001");
  const target = physicalPath(root, value.receipt.receiptId);
  let injected = false;
  const io = trackedIo({
    afterRead(filePath, buffer, offset, count) {
      if (!injected && filePath === target && count > 0) {
        injected = true;
        buffer[offset] ^= 0xff;
      }
    }
  });
  const store = createVnextReceiptStore(root, { io });

  throwsCode(() => store.put(value.bytes), "receipt_readback_mismatch");
  assert.deepEqual(fs.readFileSync(target), value.bytes);
  const restarted = createVnextReceiptStore(root);
  assert.deepEqual(restarted.read(value.receipt.receiptId).bytes, value.bytes);
});

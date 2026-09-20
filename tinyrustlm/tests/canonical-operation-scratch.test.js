"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory,
  requireCanonicalArtifactPath, requireCanonicalSiteRoot, verifyOwnedTemporaryDirectory
} = require("../tools/canonical-operation-scratch.js");
const { temporaryDirectory } = require("./site-release-test-fixture.js");
const siteRoot = path.resolve(__dirname, "..");

test("a real Windows file lock preserves cleanup ownership", {
  skip: process.platform !== "win32", timeout: 15000
}, async context => {
  const parent = temporaryDirectory(context, "canonical-operation-locked-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const locked = path.join(owned.rootPath, "locked.bin");
  fs.writeFileSync(locked, "owned locked fixture");
  // FileShare.None reproduces the native analyzer-DLL lock without a compiler server.
  const script = `$stream = [IO.File]::Open('${locked.replaceAll("'", "''")}', ` +
    `[IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None); ` +
    `try { [Console]::Out.WriteLine('locked'); [Console]::Out.Flush(); ` +
    `[Console]::In.ReadLine() | Out-Null } finally { $stream.Dispose() }`;
  const child = require("node:child_process").spawn("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")
  ], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const closed = new Promise(resolve => child.once("close", code => resolve(code)));
  let timer;
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Lock child did not become ready")), 5000);
      child.once("error", reject);
      child.once("exit", () => reject(new Error("Lock child exited before readiness")));
      child.stdout.once("data", bytes => {
        if (bytes.toString("utf8").trim() === "locked") resolve();
        else reject(new Error("Unexpected lock child output"));
      });
    });
    assert.throws(() => removeOwnedTemporaryDirectory(owned),
      error => ["EPERM", "EBUSY"].includes(error.code));
    assert.deepEqual(fs.readFileSync(owned.markerPath), owned.markerBytes);
    verifyOwnedTemporaryDirectory(owned);
  } finally {
    clearTimeout(timer);
    child.stdin.end("\n");
    const deadline = setTimeout(() => child.kill(), 5000);
    await closed;
    clearTimeout(deadline);
  }
  removeOwnedTemporaryDirectory(owned);
  assert.equal(fs.existsSync(owned.rootPath), false);
  assert.equal(fs.existsSync(owned.markerPath), false);
});

test("ownership survives a failed terminal directory removal", context => {
  const parent = temporaryDirectory(context, "canonical-operation-terminal-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const original = fs.rmdirSync;
  const failure = Object.assign(new Error("held directory"), { code: "EPERM" });
  const mocked = context.mock.method(fs, "rmdirSync", function (target, ...args) {
    if (path.resolve(target) === owned.rootPath) throw failure;
    return original.call(fs, target, ...args);
  });
  try {
    assert.throws(() => removeOwnedTemporaryDirectory(owned), error => error === failure);
    assert.deepEqual(fs.readFileSync(owned.markerPath), owned.markerBytes);
    verifyOwnedTemporaryDirectory(owned);
  } finally {
    mocked.mock.restore();
  }
  removeOwnedTemporaryDirectory(owned);
  assert.equal(fs.existsSync(owned.rootPath), false);
  assert.equal(fs.existsSync(owned.markerPath), false);
});

test("failed marker retirement can finish after the owned root is absent", context => {
  const parent = temporaryDirectory(context, "canonical-operation-marker-final-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const original = fs.unlinkSync;
  const failure = Object.assign(new Error("held marker"), { code: "EPERM" });
  const mocked = context.mock.method(fs, "unlinkSync", function (target, ...args) {
    if (path.resolve(target) === owned.markerPath) throw failure;
    return original.call(fs, target, ...args);
  });
  try {
    assert.throws(() => removeOwnedTemporaryDirectory(owned), error => error === failure);
    assert.equal(fs.existsSync(owned.rootPath), false);
    assert.deepEqual(fs.readFileSync(owned.markerPath), owned.markerBytes);
    assert.throws(() => verifyOwnedTemporaryDirectory(owned), /directory/);
  } finally {
    mocked.mock.restore();
  }
  removeOwnedTemporaryDirectory(owned);
  assert.equal(fs.existsSync(owned.markerPath), false);
});

test("canonical paths reject roots, siblings, relative paths, and alternate source roots", () => {
  assert.equal(requireCanonicalSiteRoot(), siteRoot);
  for (const invalid of ["", "relative", siteRoot, path.join(siteRoot, "artifacts"),
    path.join(siteRoot, "artifacts-other", "scratch"),
    path.join(siteRoot, "artifacts", "..", "scratch"), "D:\\LLMs\\TinyRustLM\\scratch"]) {
    assert.throws(() => requireCanonicalArtifactPath(invalid), /canonical project artifacts/);
  }
  assert.throws(() => requireCanonicalSiteRoot(path.dirname(siteRoot)), /canonical site/);
  assert.throws(() => verifyOwnedTemporaryDirectory(null), /ownership record/);
});

test("marked canonical scratch is verified and removed without touching sibling output", (context) => {
  const parent = temporaryDirectory(context, "canonical-operation-test-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent, siteRoot });
  assert.equal(path.dirname(owned.rootPath), parent);
  assert.equal(path.dirname(owned.markerPath), parent);
  assert.equal(owned.markerPath, owned.rootPath + ".owner.v2");
  fs.mkdirSync(path.join(owned.rootPath, "nested"));
  fs.writeFileSync(path.join(owned.rootPath, "nested", "fixture.txt"), "synthetic output");
  const sibling = path.join(parent, "keep.txt");
  fs.writeFileSync(sibling, "keep");
  verifyOwnedTemporaryDirectory(owned);
  removeOwnedTemporaryDirectory(owned);
  assert.equal(fs.existsSync(owned.rootPath), false);
  assert.equal(fs.existsSync(owned.markerPath), false);
  assert.equal(fs.readFileSync(sibling, "utf8"), "keep");
});

test("partial file removal retains the original external marker", context => {
  const parent = temporaryDirectory(context, "canonical-operation-partial-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const first = path.join(owned.rootPath, "a");
  const blocked = path.join(owned.rootPath, "b");
  fs.writeFileSync(first, "first");
  fs.writeFileSync(blocked, "second");
  const original = fs.unlinkSync;
  const mocked = context.mock.method(fs, "unlinkSync", function (target, ...args) {
    if (target === blocked) throw Object.assign(new Error("locked"), { code: "EBUSY" });
    return original.call(fs, target, ...args);
  });
  try {
    assert.throws(() => removeOwnedTemporaryDirectory(owned), { code: "EBUSY" });
    assert.equal(fs.existsSync(first), false);
    assert.equal(fs.readFileSync(blocked, "utf8"), "second");
    verifyOwnedTemporaryDirectory(owned);
  } finally { mocked.mock.restore(); }
  removeOwnedTemporaryDirectory(owned);
  assert.equal(fs.existsSync(owned.markerPath), false);
});

test("a late unreviewed file stops nonrecursive directory removal", context => {
  const parent = temporaryDirectory(context, "canonical-operation-late-entry-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const child = path.join(owned.rootPath, "child");
  fs.mkdirSync(child);
  const originalFile = path.join(child, "original");
  const lateFile = path.join(child, "late");
  fs.writeFileSync(originalFile, "original");
  const original = fs.unlinkSync;
  const mocked = context.mock.method(fs, "unlinkSync", function (target, ...args) {
    const value = original.call(fs, target, ...args);
    if (target === originalFile) fs.writeFileSync(lateFile, "unreviewed concurrent output");
    return value;
  });
  try {
    assert.throws(() => removeOwnedTemporaryDirectory(owned), { code: "ENOTEMPTY" });
    assert.equal(fs.readFileSync(lateFile, "utf8"), "unreviewed concurrent output");
    verifyOwnedTemporaryDirectory(owned);
  } finally { mocked.mock.restore(); }
  fs.unlinkSync(lateFile);
  removeOwnedTemporaryDirectory(owned);
});

test("a new external hard link stops cleanup before removing the linked file", context => {
  const parent = temporaryDirectory(context, "canonical-operation-new-link-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const first = path.join(owned.rootPath, "a");
  const linked = path.join(owned.rootPath, "b");
  const external = path.join(parent, "external");
  fs.writeFileSync(first, "first");
  fs.writeFileSync(linked, "preserve");
  const original = fs.unlinkSync;
  const mocked = context.mock.method(fs, "unlinkSync", function (target, ...args) {
    const value = original.call(fs, target, ...args);
    if (target === first) fs.linkSync(linked, external);
    return value;
  });
  try {
    assert.throws(() => removeOwnedTemporaryDirectory(owned), /hard-link identity/);
    assert.equal(fs.readFileSync(linked, "utf8"), "preserve");
    assert.equal(fs.readFileSync(external, "utf8"), "preserve");
    verifyOwnedTemporaryDirectory(owned);
  } finally { mocked.mock.restore(); }
  fs.unlinkSync(external);
  removeOwnedTemporaryDirectory(owned);
});

test("a changed remaining file stops cleanup without deleting its new bytes", context => {
  const parent = temporaryDirectory(context, "canonical-operation-changed-entry-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const first = path.join(owned.rootPath, "a");
  const changed = path.join(owned.rootPath, "b");
  fs.writeFileSync(first, "first");
  fs.writeFileSync(changed, "old");
  const original = fs.unlinkSync;
  const mocked = context.mock.method(fs, "unlinkSync", function (target, ...args) {
    const value = original.call(fs, target, ...args);
    if (target === first) fs.writeFileSync(changed, "new unreviewed bytes");
    return value;
  });
  try {
    assert.throws(() => removeOwnedTemporaryDirectory(owned), /entry identity/);
    assert.equal(fs.readFileSync(changed, "utf8"), "new unreviewed bytes");
    verifyOwnedTemporaryDirectory(owned);
  } finally { mocked.mock.restore(); }
  removeOwnedTemporaryDirectory(owned);
});

test("marker creation failure removes only its new empty root", context => {
  const parent = temporaryDirectory(context, "canonical-operation-create-failure-");
  const original = fs.writeFileSync;
  const failure = new Error("exclusive marker write failed");
  const mocked = context.mock.method(fs, "writeFileSync", function (target, ...args) {
    if (String(target).endsWith(".owner.v2")) throw failure;
    return original.call(fs, target, ...args);
  });
  try {
    assert.throws(() => createOwnedTemporaryDirectory({ temporaryParent: parent }),
      error => error === failure);
    assert.deepEqual(fs.readdirSync(parent), [".fixture-owner"]);
  } finally { mocked.mock.restore(); }
});

test("terminal marker retirement refuses a replacement root at the same path", context => {
  const parent = temporaryDirectory(context, "canonical-operation-replaced-root-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const original = fs.unlinkSync;
  const mocked = context.mock.method(fs, "unlinkSync", function (target, ...args) {
    if (target === owned.markerPath) throw new Error("retain marker for review");
    return original.call(fs, target, ...args);
  });
  try { assert.throws(() => removeOwnedTemporaryDirectory(owned), /retain marker/); }
  finally { mocked.mock.restore(); }
  fs.mkdirSync(owned.rootPath);
  fs.writeFileSync(path.join(owned.rootPath, "unrelated"), "preserve replacement");
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /directory identity/);
  assert.equal(fs.readFileSync(path.join(owned.rootPath, "unrelated"), "utf8"), "preserve replacement");
  assert.deepEqual(fs.readFileSync(owned.markerPath), owned.markerBytes);
});

test("inventory bounds are checked before any content deletion", context => {
  const parent = temporaryDirectory(context, "canonical-operation-count-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  for (let index = 0; index < 8193; index++) fs.writeFileSync(path.join(owned.rootPath, String(index)), "");
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /inventory exceeds/);
  assert.equal(fs.readdirSync(owned.rootPath).length, 8193);
  verifyOwnedTemporaryDirectory(owned);
});

test("changed markers and substituted ownership paths stop cleanup", (context) => {
  const parent = temporaryDirectory(context, "canonical-operation-identity-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  assert.throws(() => verifyOwnedTemporaryDirectory({ ...owned, temporaryParent: siteRoot }), /parent/);
  assert.throws(() => verifyOwnedTemporaryDirectory({ ...owned, markerPath: path.join(parent, "other") }), /marker path/);
  assert.throws(() => verifyOwnedTemporaryDirectory({ ...owned, rootStat: { dev: -1n, ino: -1n } }), /directory identity/);
  fs.writeFileSync(owned.markerPath, Buffer.alloc(owned.markerBytes.length, 48));
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /marker content/);
  fs.writeFileSync(owned.markerPath, "wrong length");
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /marker identity/);
  fs.writeFileSync(owned.markerPath, owned.markerBytes);
  removeOwnedTemporaryDirectory(owned);
});

test("linked and dangling ancestors and linked cleanup children are rejected", (context) => {
  const parent = temporaryDirectory(context, "canonical-operation-links-");
  const target = path.join(parent, "target");
  fs.mkdirSync(target);
  const link = path.join(parent, "link");
  fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => requireCanonicalArtifactPath(path.join(link, "new")), /ancestry/);
  fs.rmdirSync(target);
  assert.throws(() => requireCanonicalArtifactPath(link), /ancestry/);
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const child = path.join(owned.rootPath, "link");
  fs.symlinkSync(parent, child, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /linked or special/);
  fs.unlinkSync(child);
  fs.unlinkSync(link);
  removeOwnedTemporaryDirectory(owned);
});

test("cleanup accepts hard links wholly inside the owned tree", context => {
  const parent = temporaryDirectory(context, "canonical-operation-internal-links-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const original = path.join(owned.rootPath, "original");
  fs.writeFileSync(original, "synthetic compiled artifact");
  fs.mkdirSync(path.join(owned.rootPath, "nested"));
  fs.linkSync(original, path.join(owned.rootPath, "nested", "alias"));
  removeOwnedTemporaryDirectory(owned);
  assert.equal(fs.existsSync(owned.rootPath), false);
});

test("an external hard-link name rejects cleanup before removing anything", context => {
  const parent = temporaryDirectory(context, "canonical-operation-external-links-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const original = path.join(owned.rootPath, "original");
  const alias = path.join(owned.rootPath, "alias");
  const external = path.join(parent, "external");
  fs.writeFileSync(original, "retained evidence");
  fs.linkSync(original, alias);
  fs.linkSync(original, external);
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /external hard link/);
  for (const file of [original, alias, external]) {
    assert.equal(fs.readFileSync(file, "utf8"), "retained evidence");
  }
  fs.unlinkSync(alias);
  fs.unlinkSync(original);
  removeOwnedTemporaryDirectory(owned);
  assert.equal(fs.readFileSync(external, "utf8"), "retained evidence");
});

test("excessive cleanup depth preserves the owned tree for review", (context) => {
  const parent = temporaryDirectory(context, "canonical-operation-depth-");
  const owned = createOwnedTemporaryDirectory({ temporaryParent: parent });
  const deep = path.join(owned.rootPath, ...Array(34).fill("d"));
  fs.mkdirSync(deep, { recursive: true });
  assert.throws(() => removeOwnedTemporaryDirectory(owned), /depth/);
  assert.equal(fs.existsSync(deep), true);
});

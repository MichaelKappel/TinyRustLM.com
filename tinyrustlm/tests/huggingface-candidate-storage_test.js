"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const storage = require("../tools/huggingface-candidate-storage.js");
const acquire = require("../tools/huggingface-candidate-acquire.js");
const supported = require("../tools/huggingface-supported-candidates.js");
const qwen = require("../tools/huggingface-qwen-candidates.js");
const { createSourceAcquisitionFixture } = require("./helpers/source-acquisition-fixture.js");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } = require("../tools/canonical-operation-scratch.js");

/** Hash synthetic input bytes independently of the downloader. */
function digest(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }

/** Construct exact metadata for small non-model fixtures, served only by an injected fetch. */
function candidateFixture() {
  const template = "{% for message in messages %}<|im_start|>{{ message.role }}<|im_end|>{% endfor %}";
  const files = {
    "config.json": Buffer.from("{}"), "tokenizer.json": Buffer.from("{}"),
    "tokenizer_config.json": Buffer.from(JSON.stringify({ chat_template: template })),
    "LICENSE": Buffer.from("Apache License\nVersion 2.0"), "model.safetensors": Buffer.from("synthetic storage fixture")
  };
  const identity = (filename) => ({ filename, byteCount: files[filename].length, sha256: digest(files[filename]) });
  const weight = identity("model.safetensors");
  const candidate = { modelId: "Example/Storage-Instruct", revision: "a".repeat(40), sourceTemplate: "qwen3-0.6b-bpe",
    licenseId: "apache-2.0", licenseEvidenceKind: "revision-metadata-plus-apache-authority-text",
    licenseSourceUrl: "https://fixture.invalid/LICENSE", licenseSha256: digest(files.LICENSE),
    configSha256: digest(files["config.json"]), tokenizer: identity("tokenizer.json"),
    tokenizerConfig: identity("tokenizer_config.json"), chatTemplateKind: "revision-chatml-template-v1",
    chatTemplateSha256: digest(Buffer.from(template)), sourceWeightByteCount: weight.byteCount,
    weightFiles: [weight], weightIdentity: digest(Buffer.from(`${weight.filename}:${weight.byteCount}:${weight.sha256}`)) };
  const calls = [];
  return { candidate, files, calls,
    async fetchImpl(url) {
      calls.push(url);
      const bytes = files[new URL(url).pathname.split("/").pop()];
      assert.ok(bytes, "Unexpected fixture URL");
      return new Response(bytes, { headers: { "Content-Length": bytes.length } });
    }
  };
}

test("acquisition refuses noncanonical, traversal and alias roots before creating output or fetching", async () => {
  const fixture = candidateFixture();
  for (const value of [undefined, "", "relative", "C:\\outside", "D:\\LLMs\\TinyRustLM-other",
    "D:\\LLMs\\TinyRustLM\\..\\outside", "D:\\LLMs\\TinyRustLM\\alias.\\child",
    "D:\\LLMs\\TinyRustLM\\file:stream", "\\\\?\\D:\\LLMs\\TinyRustLM\\child",
    path.resolve("artifacts/tests/forbidden-model-output")]) {
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, value, { fetchImpl: fixture.fetchImpl }),
      /model output/);
  }
  assert.equal(fixture.calls.length, 0);
  assert.equal(fs.existsSync(path.resolve("artifacts/tests/forbidden-model-output")), false);
  assert.equal(storage.requireModelOutputRoot("D:\\LLMs\\TinyRustLM"), "D:\\LLMs\\TinyRustLM");
});

test("filenames reject traversal, Windows aliases and role collisions before acquisition", async () => {
  for (const filename of ["../model", "model.", "NUL", "con.json", "a:stream", "a/b", "a\\b", "a ", ""]) {
    assert.throws(() => storage.requireFilename(filename), /filename/);
  }
  assert.equal(storage.requireFilename("model-00001-of-00002.safetensors"), "model-00001-of-00002.safetensors");
  const fixture = candidateFixture();
  for (const altered of [
    { ...fixture.candidate, tokenizer: { ...fixture.candidate.tokenizer, filename: "config.json" } },
    { ...fixture.candidate, weightFiles: [{ ...fixture.candidate.weightFiles[0], filename: "LICENSE" }] },
    { ...fixture.candidate, weightFiles: [fixture.candidate.weightFiles[0], fixture.candidate.weightFiles[0]] },
    { ...fixture.candidate, weightIdentity: "b".repeat(64) }
  ]) {
    await assert.rejects(acquire.acquireCandidate(altered, "D:\\LLMs\\TinyRustLM", { fetchImpl: fixture.fetchImpl }),
      /filenames|weightIdentity/);
  }
  const first = acquire.candidateDirectory("D:\\LLMs\\TinyRustLM", { ...fixture.candidate, modelId: "A--B/C" });
  const second = acquire.candidateDirectory("D:\\LLMs\\TinyRustLM", { ...fixture.candidate, modelId: "A/B--C" });
  assert.notEqual(first, second, "Repository separators must not collide with literal dashes");
  assert.ok(path.basename(first).length < 160);
  assert.equal(fixture.calls.length, 0);
});

test("existing junction roots are rejected without following them", async () => {
  const owned = createSourceAcquisitionFixture();
  const link = path.join(owned.rootPath, "redirect");
  const target = path.join(owned.rootPath, "target");
  const fixture = candidateFixture();
  try {
    fs.mkdirSync(target);
    fs.symlinkSync(target, link, "junction");
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, link, { fetchImpl: fixture.fetchImpl }), /ancestry/);
    assert.deepEqual(fs.readdirSync(target), []);
    assert.equal(fixture.calls.length, 0);
  } finally {
    if (fs.lstatSync(link, { throwIfNoEntry: false })) fs.unlinkSync(link);
    owned.remove();
  }
});

test("hardlinked partial files cannot be appended to or retired by acquisition", async () => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  const directory = acquire.candidateDirectory(owned.rootPath, fixture.candidate);
  const target = path.join(owned.rootPath, "control");
  const link = path.join(directory, "model.safetensors.part");
  try {
    fs.mkdirSync(directory);
    fs.writeFileSync(target, "untouched");
    fs.linkSync(target, link);
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: fixture.fetchImpl }),
      /linked or not ordinary/);
    assert.equal(fs.readFileSync(target, "utf8"), "untouched");
    assert.equal(fs.readFileSync(link, "utf8"), "untouched");
    assert.equal(fixture.calls.some((url) => url.endsWith("model.safetensors")), false);
    assert.equal(fs.existsSync(path.join(directory, "source-acquisition.lock")), false);
  } finally {
    if (fs.existsSync(link)) fs.unlinkSync(link);
    owned.remove();
  }
});

test("one exclusive owner rejects concurrent acquisition and preserves an abandoned lock", async () => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  const directory = acquire.candidateDirectory(owned.rootPath, fixture.candidate);
  const lock = path.join(directory, "source-acquisition.lock");
  let release;
  let started;
  const entered = new Promise((resolve) => { started = resolve; });
  const paused = new Promise((resolve) => { release = resolve; });
  const first = acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: async (url) => {
    started(); await paused; return fixture.fetchImpl(url);
  } });
  try {
    await entered;
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: fixture.fetchImpl }),
      { code: "EEXIST" });
    assert.equal(fixture.calls.length, 0);
    release();
    assert.equal((await first).status, "verified");
    assert.equal(fs.existsSync(lock), false);
    fs.writeFileSync(lock, "abandoned owner", { flag: "wx" });
    const requests = fixture.calls.length;
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: fixture.fetchImpl }),
      { code: "EEXIST" });
    assert.equal(fixture.calls.length, requests);
    assert.equal(fs.readFileSync(lock, "utf8"), "abandoned owner");
  } finally {
    release();
    await first.catch(() => {});
    owned.remove();
  }
});

test("a file replaced during fetch is rejected before body consumption and its response is cancelled", async () => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  const directory = acquire.candidateDirectory(owned.rootPath, fixture.candidate);
  const control = path.join(owned.rootPath, "control");
  const link = path.join(directory, "config.json");
  let cancelled = false;
  try {
    fs.writeFileSync(control, "untouched");
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: async () => {
      fs.linkSync(control, link);
      return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    } }), /linked or not ordinary/);
    assert.equal(cancelled, true);
    assert.equal(fs.readFileSync(control, "utf8"), "untouched");
    assert.equal(fs.existsSync(path.join(directory, "source-acquisition.lock")), false);
  } finally {
    if (fs.existsSync(link)) fs.unlinkSync(link);
    owned.remove();
  }
});

test("Windows prevents moving the candidate directory while its owner lock is open", async () => {
  const owned = createSourceAcquisitionFixture();
  const directory = path.join(owned.rootPath, "original");
  const moved = path.join(owned.rootPath, "moved");
  try {
    storage.requireModelOutputRoot(directory);
    storage.requireModelOutputRoot(moved);
    assert.equal(fs.existsSync(moved), false);
    await storage.withCandidateDirectory(directory, async (guard) => {
      assert.throws(() => fs.renameSync(directory, moved), { code: "EPERM" });
      assert.equal(guard(path.join(directory, "config.json")), undefined);
      assert.throws(() => guard(path.join(owned.rootPath, "outside.json")), /escaped its directory/);
    });
    assert.deepEqual(fs.readdirSync(directory), []);
    assert.equal(fs.existsSync(moved), false);
  } finally {
    owned.remove();
  }
});

test("cached receipt must contain the exact files and current candidate identities", async () => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  const directory = acquire.candidateDirectory(owned.rootPath, fixture.candidate);
  try {
    const original = await acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: fixture.fetchImpl });
    const requests = fixture.calls.length;
    const variants = [
      { ...original, files: [] },
      { ...original, files: original.files.slice(0, -1) },
      { ...original, files: [...original.files, original.files[0]] },
      { ...original, files: original.files.map(() => original.files[0]) },
      { ...original, files: original.files.map((file) => ({ ...file, sha256: "c".repeat(64) })) },
      { ...original, sourceWeightByteCount: 1 },
      { ...original, licenseId: "different" },
      { ...original, qualified: true },
      { ...original, verifiedUtc: "invalid" }
    ];
    for (const altered of variants) {
      fs.writeFileSync(path.join(directory, "source-acquisition.json"), JSON.stringify(altered));
      await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: fixture.fetchImpl }), /receipt/);
      assert.equal(fs.existsSync(path.join(directory, "source-acquisition.lock")), false);
    }
    fs.writeFileSync(path.join(directory, "source-acquisition.json"), JSON.stringify(original));
    const changed = { ...fixture.candidate, configSha256: "b".repeat(64) };
    await assert.rejects(acquire.acquireCandidate(changed, owned.rootPath, { fetchImpl: fixture.fetchImpl }), /receipt/);
    const changedBlob = { ...fixture.candidate, tokenizer: { ...fixture.candidate.tokenizer, gitBlobId: "c".repeat(40) } };
    await assert.rejects(acquire.acquireCandidate(changedBlob, owned.rootPath, { fetchImpl: fixture.fetchImpl }), /Git blob identity mismatch/);
    const weightPath = path.join(directory, "model.safetensors");
    fs.unlinkSync(weightPath);
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: fixture.fetchImpl }), /missing/);
    fs.writeFileSync(weightPath, fixture.files["model.safetensors"], { flag: "wx" });
    assert.deepEqual(await acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: fixture.fetchImpl }), original);
    assert.equal(fixture.calls.length, requests);
    assert.deepEqual(fs.readFileSync(path.join(directory, "model.safetensors")), fixture.files["model.safetensors"]);
  } finally { owned.remove(); }
});

test("both report writers use canonical artifacts and reject linked output", () => {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.resolve("artifacts/tests/candidate-storage") });
  const target = path.join(owned.rootPath, "inventory.json");
  const control = path.join(owned.rootPath, "control.json");
  try {
    for (const owner of [supported, qwen]) {
      for (const invalid of ["relative.json", "D:\\LLMs\\TinyRustLM\\inventory.json", path.resolve("outside-inventory.json")]) {
        assert.throws(() => owner.writeReport(invalid, {}), /canonical|artifacts/);
      }
      assert.equal(owner.writeReport(target, { fixture: 1 }), target);
      assert.deepEqual(JSON.parse(fs.readFileSync(target)), { fixture: 1 });
      assert.equal(owner.writeReport(target, { fixture: 2 }), target);
      assert.deepEqual(JSON.parse(fs.readFileSync(target)), { fixture: 2 });
      fs.linkSync(target, control);
      assert.throws(() => owner.writeReport(target, { fixture: 3 }), /linked or not ordinary/);
      assert.deepEqual(JSON.parse(fs.readFileSync(control)), { fixture: 2 });
      fs.unlinkSync(control);
    }
    assert.throws(() => supported.writeReport(target, { text: "x".repeat(16 * 1024 * 1024) }), /oversized/);
    assert.equal(fs.readdirSync(owned.rootPath).some((name) => name.endsWith(".tmp")), false);
  } finally {
    if (fs.existsSync(control)) fs.unlinkSync(control);
    removeOwnedTemporaryDirectory(owned);
  }
});

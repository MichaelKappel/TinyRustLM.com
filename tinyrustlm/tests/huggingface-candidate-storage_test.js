"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");
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

test("bounded local reads reject size and link violations before reading and detect mutations", (t) => {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.resolve("artifacts/tests/candidate-storage") });
  const file = path.join(owned.rootPath, "input.json");
  const link = path.join(owned.rootPath, "linked.json");
  try {
    fs.writeFileSync(file, "12345678");
    const read = fs.readSync;
    let reads = 0;
    const mockedRead = t.mock.method(fs, "readSync", (fd, bytes, offset, length, position) => {
      reads++;
      return read(fd, bytes, offset, Math.min(length, 2), position);
    });
    for (const limit of [0, -1, 1.5, 33 * 1024 * 1024]) {
      assert.throws(() => storage.readBoundedFile(file, limit), /limit/);
    }
    assert.throws(() => storage.readBoundedFile(file, 7), /size limit/);
    assert.throws(() => storage.readBoundedFile(path.join(owned.rootPath, "absent"), 8), /size limit/);
    fs.linkSync(file, link);
    assert.throws(() => storage.readBoundedFile(file, 8), /linked/);
    fs.unlinkSync(link);
    assert.equal(reads, 0);
    assert.equal(storage.readBoundedFile(file, 8).toString(), "12345678");
    assert.equal(reads, 4, "Partial OS reads must fill the exact admitted buffer");
    let guards = 0;
    assert.throws(() => storage.readBoundedFile(file, 8, (target) => {
      assert.equal(target, file);
      if (++guards === 2) fs.appendFileSync(file, "growth");
      return fs.lstatSync(target, { bigint: true });
    }), /changed during bounded read/);
    mockedRead.mock.restore();
    const eof = t.mock.method(fs, "readSync", () => 0);
    assert.throws(() => storage.readBoundedFile(file, 32), /ended during bounded read/);
    eof.mock.restore();
    const open = fs.openSync;
    // Open with a writable handle only in this fault injection, so a change occurs before fstat.
    const changedBefore = t.mock.method(fs, "openSync", (target, flags) => {
      const fd = open(target, target === file ? "r+" : flags);
      if (target === file) fs.ftruncateSync(fd, 1);
      return fd;
    });
    assert.throws(() => storage.readBoundedFile(file, 32), /changed before bounded read/);
    changedBefore.mock.restore();
  } finally {
    t.mock.restoreAll();
    if (fs.existsSync(link)) fs.unlinkSync(link);
    removeOwnedTemporaryDirectory(owned);
  }
});

test("inventory CLI rejects an oversized sparse input before parsing or model output", () => {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.resolve("artifacts/tests/candidate-storage") });
  const input = path.join(owned.rootPath, "inventory.json");
  try {
    const fd = fs.openSync(input, "wx");
    try { fs.ftruncateSync(fd, 16 * 1024 * 1024 + 1); } finally { fs.closeSync(fd); }
    const child = spawnSync(process.execPath, ["tinyrustlm/tools/huggingface-candidate-acquire.js", input,
      "D:\\LLMs\\TinyRustLM"], { encoding: "utf8", windowsHide: true, timeout: 5000,
      env: { ...process.env, NODE_V8_COVERAGE: "" } });
    assert.ifError(child.error);
    assert.equal(child.status, 1);
    assert.match(child.stderr, /inventory.json is outside its size limit/);
  } finally { removeOwnedTemporaryDirectory(owned); }
});

test("tokenizer sizes and timeout bounds fail before fetching or creating a candidate directory", async () => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  try {
    for (const timeoutMs of [0, -1, 999, 1000.5, 4 * 60 * 60 * 1000 + 1, Number.MAX_SAFE_INTEGER]) {
      await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath,
        { fetchImpl: fixture.fetchImpl, timeoutMs }), /timeout/);
    }
    for (const key of ["tokenizer", "tokenizerConfig"]) {
      const candidate = { ...fixture.candidate, [key]: { ...fixture.candidate[key], byteCount: 32 * 1024 * 1024 + 1 } };
      await assert.rejects(acquire.acquireCandidate(candidate, owned.rootPath, { fetchImpl: fixture.fetchImpl }), /size limit/);
    }
    assert.equal(fixture.calls.length, 0);
    assert.deepEqual(fs.readdirSync(owned.rootPath), [".fixture-owner"]);
  } finally { owned.remove(); }
});

test("oversized resumed chunks cannot append past the range and a later transfer still resumes", async () => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  const directory = acquire.candidateDirectory(owned.rootPath, fixture.candidate);
  const part = path.join(directory, "model.safetensors.part");
  const weight = fixture.files["model.safetensors"];
  let cancelled = false;
  try {
    fs.mkdirSync(directory);
    fs.writeFileSync(part, weight.subarray(0, 3));
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: async (url, options) => {
      if (!url.endsWith("model.safetensors")) return fixture.fetchImpl(url);
      assert.equal(options.headers.Range, "bytes=3-");
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(Buffer.alloc(65536)); },
        cancel() { cancelled = true; } }), { status: 206, headers: { "Content-Range": `bytes 3-${weight.length - 1}/${weight.length}` } });
    } }), /exceeded its expected byte count/);
    assert.equal(cancelled, true);
    assert.deepEqual(fs.readFileSync(part), weight.subarray(0, 3));
    assert.equal(fs.existsSync(path.join(directory, "source-acquisition.json")), false);
    const ranges = [];
    const receipt = await acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: async (url, options) => {
      if (!url.endsWith("model.safetensors")) return fixture.fetchImpl(url);
      const start = Number(/^bytes=(\d+)-$/.exec(options.headers.Range)[1]);
      const end = start === 3 ? 4 : weight.length - 1;
      ranges.push(start);
      return new Response(weight.subarray(start, end + 1), { status: 206,
        headers: { "Content-Range": `bytes ${start}-${end}/${weight.length}`, "Content-Length": end - start + 1 } });
    } });
    assert.equal(receipt.status, "verified");
    assert.deepEqual(ranges, [3, 5]);
    assert.deepEqual(fs.readFileSync(path.join(directory, "model.safetensors")), weight);
    assert.equal(fs.existsSync(part), false);
  } finally { owned.remove(); }
});

test("range totals, endpoints, encoding and Content-Length must agree before appending", async () => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  const directory = acquire.candidateDirectory(owned.rootPath, fixture.candidate);
  const part = path.join(directory, "model.safetensors.part");
  const weight = fixture.files["model.safetensors"];
  const validRange = `bytes 3-${weight.length - 1}/${weight.length}`;
  try {
    fs.mkdirSync(directory);
    fs.writeFileSync(part, weight.subarray(0, 3));
    const cases = [
      { "Content-Range": "bytes 3-nonsense" }, { "Content-Range": "bytes 3-4/*" },
      { "Content-Range": `bytes 3-2/${weight.length}` }, { "Content-Range": `bytes 2-4/${weight.length}` },
      { "Content-Range": `bytes 3-${weight.length}/${weight.length}` },
      { "Content-Range": `bytes 3-4/${weight.length + 1}` },
      { "Content-Range": "bytes 3-4/9007199254740993" },
      { "Content-Range": validRange, "Content-Encoding": "gzip" },
      { "Content-Range": validRange, "Content-Length": "1" },
      ...["-1", "abc", "1.5", "9007199254740993"].map((value) => ({ "Content-Range": validRange, "Content-Length": value }))
    ];
    for (const headers of cases) {
      let cancelled = false;
      await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: async (url) => {
        if (!url.endsWith("model.safetensors")) return fixture.fetchImpl(url);
        return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 206, headers });
      } }), /Content-Range|Content-Length|encoded range/);
      assert.equal(cancelled, true);
      assert.deepEqual(fs.readFileSync(part), weight.subarray(0, 3));
    }
  } finally { owned.remove(); }
});

test("real HTTP gzip expansion is limited by decoded bytes before disk writes", async () => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  const expanded = Buffer.alloc(128 * 1024, 0x61);
  const compressed = zlib.gzipSync(expanded);
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Encoding": "gzip", "Content-Length": compressed.length });
    response.end(compressed);
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: async (url, options) => {
      if (!url.endsWith("model.safetensors")) return fixture.fetchImpl(url);
      return fetch(`http://127.0.0.1:${server.address().port}/`, options);
    } }), /exceeded its expected byte count/);
    const directory = acquire.candidateDirectory(owned.rootPath, fixture.candidate);
    const part = path.join(directory, "model.safetensors.part");
    assert.ok(fs.statSync(part).size <= fixture.candidate.sourceWeightByteCount);
    assert.equal(fs.existsSync(path.join(directory, "model.safetensors")), false);
    assert.equal(fs.existsSync(path.join(directory, "source-acquisition.json")), false);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    owned.remove();
  }
});

test("small evidence streams enforce decoded limits without writing oversized bodies", async () => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  const directory = acquire.candidateDirectory(owned.rootPath, fixture.candidate);
  try {
    let cancelled = false;
    let pulls = 0;
    const chunk = Buffer.alloc(1024 * 1024);
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: async () =>
      new Response(new ReadableStream({ pull(controller) { pulls++; controller.enqueue(chunk); },
        cancel() { cancelled = true; } }), { headers: { "Content-Encoding": "gzip", "Content-Length": "1" } })
    }), /config.json is oversized/);
    assert.equal(cancelled, true);
    assert.ok(pulls <= 35, `Reader pulled ${pulls} chunks after its 32 MiB limit`);
    assert.deepEqual(fs.readdirSync(directory), []);
    for (const length of [String(32 * 1024 * 1024 + 1), "-1", "abc"]) {
      cancelled = false;
      await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: async () =>
        new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "Content-Length": length } })
      }), /oversized|Content-Length/);
      assert.equal(cancelled, true);
    }
    const exact = Buffer.from(`\ufeff${"x".repeat(70000)}`);
    const altered = { ...fixture.candidate, configSha256: digest(exact) };
    await acquire.acquireCandidate(altered, owned.rootPath, { fetchImpl: async (url) => {
      if (!url.endsWith("config.json") || url.endsWith("tokenizer_config.json")) return fixture.fetchImpl(url);
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(exact.subarray(0, 65536)); controller.enqueue(exact.subarray(65536)); controller.close();
      } }));
    } });
    assert.deepEqual(fs.readFileSync(path.join(directory, "config.json")), exact, "Original bytes must survive buffer growth");
  } finally { owned.remove(); }
});

test("the body deadline cancels stalled evidence and weight streams and releases ownership", async () => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  const directory = acquire.candidateDirectory(owned.rootPath, fixture.candidate);
  // AbortSignal.timeout is unref'ed; retain a test deadline while the injected body has no OS socket.
  const keepAlive = setTimeout(() => {}, 5000);
  try {
    for (const target of ["config.json", "model.safetensors"]) {
      let cancelled = false;
      await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { timeoutMs: 1000,
        fetchImpl: async (url) => {
          if (new URL(url).pathname.split("/").pop() !== target) return fixture.fetchImpl(url);
          return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
        } }), /abort/i);
      assert.equal(cancelled, true);
      assert.equal(fs.existsSync(path.join(directory, "source-acquisition.lock")), false);
      assert.equal(fs.existsSync(path.join(directory, "source-acquisition.json")), false);
      assert.equal(fs.readdirSync(directory).some((name) => name.endsWith(".tmp")), false);
    }
    assert.equal((await acquire.acquireCandidate(fixture.candidate, owned.rootPath,
      { fetchImpl: fixture.fetchImpl })).status, "verified");
  } finally { clearTimeout(keepAlive); owned.remove(); }
});

test("failed evidence promotion removes its temporary but preserves an exclusive-name collision", async (t) => {
  const owned = createSourceAcquisitionFixture();
  const fixture = candidateFixture();
  const directory = acquire.candidateDirectory(owned.rootPath, fixture.candidate);
  try {
    for (const operation of ["fsyncSync", "renameSync"]) {
      const fault = t.mock.method(fs, operation, () => { throw new Error(`injected ${operation} failure`); });
      await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: fixture.fetchImpl }),
        new RegExp(`injected ${operation}`));
      fault.mock.restore();
      assert.deepEqual(fs.readdirSync(directory), []);
    }
    const collision = path.join(directory, "config.json.fixed.tmp");
    fs.writeFileSync(collision, "preserve existing bytes", { flag: "wx" });
    const uuid = t.mock.method(crypto, "randomUUID", () => "fixed");
    await assert.rejects(acquire.acquireCandidate(fixture.candidate, owned.rootPath, { fetchImpl: fixture.fetchImpl }),
      { code: "EEXIST" });
    uuid.mock.restore();
    assert.equal(fs.readFileSync(collision, "utf8"), "preserve existing bytes");
    assert.equal(fs.existsSync(path.join(directory, "source-acquisition.lock")), false);
  } finally { t.mock.restoreAll(); owned.remove(); }
});

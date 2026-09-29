"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const owner = require("../tools/real-composition-execution.js");
const scratch = require("../tools/canonical-operation-scratch.js");
const requestParser = require("../tools/prompt2-reference.js");
const ROOT = path.resolve(__dirname, "../..");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

/** Build metadata only; no fixture claims admission or contains real model bytes. */
function plan() {
  const identity = (file) => ({ path: file, bytes: 1, sha256: "a".repeat(64) });
  return { schema: owner.SCHEMA, sourceCommit: "1".repeat(40), operationId: "2".repeat(64), compositionId: "3".repeat(64),
    compositionRoot: "D:\\LLMs\\TinyRustLM\\test-never-executed", outputDirectory: path.join(ROOT, "artifacts/verification/never-executed"),
    members: owner.MEMBERS.map((name, index) => ({ name, bytes: [1, 1, 1, 65800, 512, 896][index], sha256: "4".repeat(64) })),
    tools: { dotnet: identity(process.execPath), native: identity(path.join(ROOT, "artifacts/native.dll")), browser: identity(process.execPath),
      managed: owner.MANAGED.map((name) => identity(path.join(ROOT, "artifacts/probe", name))),
      assets: owner.ASSETS.map((name) => identity(path.join(ROOT, "tinyrustlm", name))) },
    policy: { maximumModelBytes: 1024, maximumSequenceTokens: 1024, maximumKvBytes: 1024,
      maximumScratchBytes: 1024, maximumResolvedMemberBytes: 2 * 1024 * 1024, maximumResidentDependencyBytes: 1024 * 1024,
      maximumRequestBytes: 1054848, maximumLinearMemoryBytes: 3 * 1024 * 1024 },
    cases: [{ id: "first", conversation: "chat", historyFrom: null, messages: [{ role: "user", content: "Remember Nora." }],
      sampling: { temperatureMillionths: 0, topK: 1, topPMillionths: 1000000, repetitionPenaltyMillionths: 1000000,
        repetitionWindow: 0, maximumNewTokens: 32 }, seed: "20260929", transcriptRevision: 0,
      resetBefore: true, cancelAfterSteps: null, deadlineMilliseconds: 1000 }],
    browserViewports: [{ id: "desktop", width: 1365, height: 768, isMobile: false }], totalDeadlineMilliseconds: 5000 };
}

/** Allocate only a marked canonical non-source scratch root, retaining original ownership through cleanup. */
async function owned(action) {
  const directory = scratch.createOwnedTemporaryDirectory({ temporaryParent: path.join(ROOT, "artifacts/tests/real-composition-execution") });
  try { return await action(directory.rootPath); }
  finally { scratch.removeOwnedTemporaryDirectory(directory); }
}

test("frozen plan validates exact tool closure, greedy settings, bounds and declared history", () => {
  assert.equal(owner.validateRequest(plan()).schema, owner.SCHEMA);
  for (const change of [
    (p) => { p.extra = true; }, (p) => { p.schema = "old"; }, (p) => { p.sourceCommit = "HEAD"; },
    (p) => { p.operationId = "0".repeat(64); }, (p) => { p.members.pop(); },
    (p) => { p.members[0].name = "other"; }, (p) => { p.members[0].bytes = 0; },
    (p) => { p.tools.dotnet.sha256 = "bad"; }, (p) => { p.tools.dotnet.path = "relative"; },
    (p) => { p.tools.managed.pop(); }, (p) => { p.tools.assets[0].path = p.tools.assets[1].path; },
    (p) => { p.tools.managed[1].path = path.join(ROOT, "elsewhere", owner.MANAGED[1]); },
    (p) => { p.policy.maximumRequestBytes = 1; }, (p) => { p.policy.maximumLinearMemoryBytes = 1; },
    (p) => { p.policy.maximumResolvedMemberBytes = 1; },
    (p) => { p.policy.maximumResolvedMemberBytes = p.policy.maximumResidentDependencyBytes; },
    (p) => { p.policy.maximumLinearMemoryBytes = 65536; }, (p) => { p.cases = []; },
    (p) => { p.cases[0].seed = 5; }, (p) => { p.cases[0].sampling.topK = 2; },
    (p) => { p.cases[0].id = "../x"; }, (p) => { p.cases[0].historyFrom = "missing"; },
    (p) => { p.cases[0].cancelAfterSteps = -1; }, (p) => { p.cases[0].deadlineMilliseconds = 0; },
    (p) => { p.cases[0].deadlineMilliseconds = 999; }, (p) => { p.cases[0].deadlineMilliseconds = 600001; },
    (p) => { p.browserViewports[0].width = 1; }, (p) => { p.browserViewports.push(p.browserViewports[0]); },
    (p) => { p.totalDeadlineMilliseconds = Infinity; }
  ]) { const value = plan(); change(value); assert.throws(() => owner.validateRequest(value)); }
});

test("dependent wire contains exact actual prior output and never substitutes a canned answer", () => {
  const p = plan();
  const first = owner.caseRequest(p.cases[0], []);
  const second = { ...p.cases[0], id: "second", resetBefore: false, historyFrom: "first", transcriptRevision: 1,
    messages: [{ role: "user", content: "Correction: Leila." }] };
  p.cases.push(second); owner.validateRequest(p);
  const raw = "Nóra\n🦀 <think>raw</think>";
  const record = { ...first, capture: { status: "captured", output: { text: raw } } };
  const wire = owner.caseRequest(second, [record]);
  assert.deepEqual(requestParser.parseRequest(Buffer.from(wire.requestBase64, "base64")).messages,
    [...first.messages, { role: "assistant", content: raw }, ...second.messages]);
  assert.equal(wire.requestSha256, hash(Buffer.from(wire.requestBase64, "base64")));
  assert.throws(() => owner.caseRequest(second, []), /history-unavailable/);
  p.cases[1].resetBefore = true;
  assert.throws(() => owner.validateRequest(p), /history/);
});

test("exact file verification catches altered bytes, wrong size and nonordinary input", async () => owned((directory) => {
  const file = path.join(directory, "bounded-evidence.bin");
  fs.writeFileSync(file, Buffer.from("not a model"));
  const identity = { path: file, bytes: 11, sha256: hash("not a model") };
  owner.verifyFile(identity);
  assert.throws(() => owner.verifyFile({ ...identity, bytes: 10 }), /identity/);
  assert.throws(() => owner.verifyFile({ ...identity, sha256: "0".repeat(64) }), /changed/);
  assert.throws(() => owner.verifyFile({ ...identity, path: directory }), /identity/);
}));

test("actual child protocol preserves split Unicode, dependent wire and terminal failure evidence", async () => {
  const before = process.env.TINYRUSTLM_PROBE_FIXTURE_MODE;
  try {
    for (const mode of ["success", "failure", "early", "malformed", "timeout", "stderr-limit"]) await owned(async (directory) => {
      process.env.TINYRUSTLM_PROBE_FIXTURE_MODE = mode;
      const p = plan();
      p.tools.managed[0].path = path.join(__dirname, "helpers/real-composition-probe-protocol-fixture.js");
      p.cases.push({ ...p.cases[0], id: "second", historyFrom: "first", resetBefore: false, transcriptRevision: 1,
        messages: [{ role: "user", content: "What did you say?" }] });
      if (mode === "timeout") p.cases[0].deadlineMilliseconds = 50;
      if (["early", "malformed", "timeout", "stderr-limit"].includes(mode)) await assert.rejects(owner.runNative(p, directory));
      else {
        const result = await owner.runNative(p, directory);
        assert.equal(result.modelQualified, false);
        assert.equal(result.status, mode === "success" ? "captured" : "failed");
        assert.equal(result.records.length, mode === "success" ? 2 : 1);
        if (mode === "success") assert.equal(result.records[1].capture.output.text, "raw\nNóra 🦀");
      }
      assert.ok(fs.existsSync(path.join(directory, "native.stdout.bin")));
      assert.ok(fs.existsSync(path.join(directory, "native.stderr.bin")));
      if (mode === "stderr-limit") assert.equal(fs.statSync(path.join(directory, "native.stderr.bin")).size, 65536);
    });
  } finally {
    if (before === undefined) delete process.env.TINYRUSTLM_PROBE_FIXTURE_MODE;
    else process.env.TINYRUSTLM_PROBE_FIXTURE_MODE = before;
  }
});

test("browser case orchestration streams each member, captures raw tokens, cancels and resets explicitly", async () => {
  const previous = { window: global.window, fetch: global.fetch };
  const clients = [];
  const p = plan();
  const item = p.cases[0];
  const request = owner.caseRequest(item, []);
  let failure = null;
  try {
    global.fetch = async (url) => {
      const index = /members\/(\d+)$/.exec(url)?.[1];
      const length = index === undefined ? 1 : p.members[Number(index)].bytes;
      return new Response(new Uint8Array(length), { headers: { "Content-Length": String(length) } });
    };
    global.window = { TinyRustLMModelRuntimeClient: {
      MAXIMUM_BINARY_CHUNK_BYTES: 1024,
      identityFromText: async (domain, value) => { assert.ok(domain && value); return "b".repeat(64); },
      createBrowserClient: () => {
        const client = {
          released: 0, generations: 0, artifacts: 0,
          async initialize(input) { assert.equal(input.wasmSha256, p.tools.assets[3].sha256); },
          async activate(inputs) { for (const input of inputs) { let received = 0;
            for await (const chunk of input.chunks) { assert.deepEqual(Object.keys(chunk), ["offset", "bytes"]);
              assert.equal(chunk.offset, received); assert.ok(chunk.bytes.byteLength <= 1024); received += chunk.bytes.byteLength; }
            assert.equal(received, input.byteLength); this.artifacts++; }
            return { memoryPlan: { modelBytes: 1 }, observedLinearMemoryBytes: 65536 }; },
          async setTranscript() {},
          async release() { this.released++; },
          terminate() { this.reject?.(Object.assign(new Error(), { code: "execution-browser-deadline" })); },
          async generate(options) {
            this.generations++;
            if (failure === "runtime") throw Object.assign(new Error(), { code: "fixture-runtime-error" });
            if (failure === "timeout") return new Promise((_resolve, reject) => { this.reject = reject; });
            options.onStep({ emittedTokenId: 7, status: { kind: "active" } });
            return { text: "raw\nNóra 🦀", tokenIds: [7], status: { kind: options.signal.aborted ? "cancelled" : "stop-token" } };
          }
        }; clients.push(client); return client;
      }
    } };
    const first = await owner.browserCase({ plan: p, item, request, base: "http://127.0.0.1/test/" });
    assert.equal(first.capture.output.text, "raw\nNóra 🦀");
    assert.equal(clients[0].artifacts, 6);
    const cancelled = await owner.browserCase({ plan: p, item: { ...item, resetBefore: false, cancelAfterSteps: 1 }, request, base: "http://127.0.0.1/test/" });
    assert.equal(cancelled.capture.output.status.kind, "cancelled");
    assert.notEqual(cancelled.capture.cancellationLatencyMilliseconds, null);
    await owner.browserCase({ plan: p, item, request, base: "http://127.0.0.1/test/" });
    assert.equal(clients[0].released, 1); assert.equal(clients.length, 2);
    failure = "runtime";
    const failed = await owner.browserCase({ plan: p, item: { ...item, resetBefore: false }, request, base: "http://127.0.0.1/test/" });
    assert.equal(failed.capture.errorCode, "fixture-runtime-error"); assert.equal(failed.capture.output, null);
    failure = "timeout";
    const timed = await owner.browserCase({ plan: p, item: { ...item, resetBefore: false, deadlineMilliseconds: 5 }, request, base: "http://127.0.0.1/test/" });
    assert.equal(timed.capture.status, "failed"); assert.equal(timed.capture.errorCode, "execution-browser-deadline");
  } finally { global.window = previous.window; global.fetch = previous.fetch; }
});

test("actual Chromium production worker preserves rejected non-model fixture activation", { timeout: 60000 }, async () => owned(async (directory) => {
  const p = plan();
  p.compositionRoot = path.join(directory, "invalid-non-model-fixture");
  fs.mkdirSync(p.compositionRoot);
  const sizes = [64, 64, 64, 65800, 512, 896];
  p.members = owner.MEMBERS.map((name, index) => {
    const bytes = Buffer.alloc(sizes[index]);
    fs.writeFileSync(path.join(p.compositionRoot, name), bytes);
    return { name, bytes: bytes.length, sha256: hash(bytes) };
  });
  p.tools.assets = owner.ASSETS.map((name) => {
    const file = path.join(ROOT, "tinyrustlm", name);
    const bytes = fs.readFileSync(file);
    return { path: file, bytes: bytes.length, sha256: hash(bytes) };
  });
  p.tools.browser.path = path.join(ROOT, "artifacts/browser-packages/playwright/chromium-1228/chrome-win64/chrome.exe");
  p.policy.maximumModelBytes = 1024;
  p.policy.maximumResolvedMemberBytes = 2 * 1024 * 1024;
  p.policy.maximumResidentDependencyBytes = 1024 * 1024;
  p.policy.maximumLinearMemoryBytes = 3 * 1024 * 1024 * 1024;
  p.cases[0].deadlineMilliseconds = 10000;
  p.totalDeadlineMilliseconds = 30000;
  const result = await owner.runBrowser(p, directory, p.browserViewports[0]);
  assert.equal(result.modelQualified, false);
  assert.equal(result.status, "failed");
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].capture.status, "failed");
  assert.equal(result.records[0].capture.phase, "activation");
  assert.equal(result.records[0].capture.errorCode, "acg2-header");
  assert.equal(result.records[0].capture.output, null);
  assert.equal(result.visibleStopButton, "not-exercised");
}));

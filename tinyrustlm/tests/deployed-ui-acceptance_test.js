"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const tool = require("../tools/deployed-ui-acceptance.js");
const prompt = require("../tools/prompt2-reference.js");
const ROOT = path.resolve(__dirname, "../..");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");

/** Prospective metadata only: no qualified model, network, browser launch or model files. */
function plan() {
  const identity = { bytes: 1, sha256: "a".repeat(64) };
  return { schema: tool.SCHEMA, registeredAtUtc: "2026-09-29T00:00:00.000Z", toolSha256: "1".repeat(64),
    casesSha256: tool.CASE_SHA256, release: { sourceRevision: "2".repeat(40), marker: { ...identity }, additionalGetRoutes: [],
      assets: tool.REQUIRED_ASSETS.map(route => ({ route, ...identity })) },
    seed: { entryId: "test-only/never-publish", compositionId: `sha256:${"3".repeat(64)}`,
      admissionSha256: "4".repeat(64), receiptSha256: "5".repeat(64), catalogSha256: "6".repeat(64), peerFeedSha256: "7".repeat(64) },
    browser: { path: process.execPath, ...identity },
    ui: { contract: "production-simple-defaults-distinct-from-qualification", systemMessages: [], creativity: "balanced", length: "normal",
      sampling: { temperatureMillionths: 650000, topK: 40, topPMillionths: 900000, repetitionPenaltyMillionths: 1000000,
        repetitionWindow: 0, maximumNewTokens: 80 }, seedPolicy: "production-random-u32", templateSha256: "8".repeat(64) },
    functional: { cancelPrompt: "Write a long list of ways to organize notes.", cancelAfterTokens: 1,
      afterStopPrompt: "Now say hello.", afterResetPrompt: "Say one short greeting.", restartPrompt: "Say hello after reopening.",
      offlinePrompt: "Say hello without a network.", interruption: "close-after-first-model-response-body-progress" },
    limits: { installationMilliseconds: 600000, maximumFirstTokenMilliseconds: 30000,
      minimumSustainedDecodeTokensPerSecond: 1, maximumStopLatencyMilliseconds: 2000, maximumTurnMilliseconds: 180000 },
    profileParent: "D:\\LLMs\\TinyRustLM\\public-ui-acceptance", outputDirectory: path.join(ROOT, "artifacts/verification/test-never-run") };
}

/** Build a real Prompt2 wire with synthetic event envelopes for parser and custody regression tests. */
function events(p, messages = [{ role: "user", content: "Hello." }], cancelled = false) {
  const bytes = prompt.writeRequest({ messages, config: p.ui.sampling, seed: 123n });
  const base = { generationId: "a".repeat(64), operationId: "b".repeat(64), compositionId: "3".repeat(64) };
  const output = { schema: "test-only", operationId: base.operationId, composition: { graphIdentitySha256: base.compositionId },
    text: "  untouched\nanswer  ", tokenIds: [10, 20], status: { kind: cancelled ? "cancelled" : "stop-token" } };
  const result = [
    { ...base, direction: "command", kind: "artifact-chunk", offset: 0, bytes: Array.from(bytes.subarray(0, 100)), time: 1 },
    { ...base, direction: "command", kind: "artifact-chunk", offset: 100, bytes: Array.from(bytes.subarray(100)), time: 2 },
    { ...base, direction: "command", kind: "begin-generation", time: 10 },
    { ...base, direction: "event", kind: "generation-step", time: 30, payload: { step: { emittedTokenId: 10 } } },
    { ...base, direction: "event", kind: "generation-step", time: 50, payload: { step: { emittedTokenId: 20 } } }
  ];
  if (cancelled) result.push({ kind: "stop-click", direction: "ui", time: 51 },
    { ...base, kind: "cancel-generation", direction: "command", time: 52 });
  result.push({ ...base, kind: "generation-complete", direction: "event", time: 60, payload: { output } });
  return result;
}

test("plan binds distinct normal UI defaults, exact cases, assets, future qualification and immutable performance criteria", () => {
  assert.equal(tool.validatePlan(plan()).schema, tool.SCHEMA);
  const mutations = [
    p => { p.fakeQualification = true; }, p => { p.schema = "old"; }, p => { p.registeredAtUtc = "yesterday"; },
    p => { p.toolSha256 = "bad"; }, p => { p.casesSha256 = "0".repeat(64); }, p => { p.release.sourceRevision = "HEAD"; },
    p => { p.release.marker.bytes = 0; }, p => { p.release.assets.pop(); },
    p => { p.release.assets.push(p.release.assets[0]); }, p => { p.release.assets[0].route = "//elsewhere.test/a"; },
    p => { p.release.assets[0].route = "/../x"; }, p => { p.release.assets[0].route = "/x?key=abc"; },
    p => { p.release.assets[0].bytes = Infinity; }, p => { p.release.assets[0].sha256 = "bad"; },
    p => { p.seed.compositionId = "not-an-identity"; }, p => { p.seed.receiptSha256 = "bad"; },
    p => { p.browser.path = "relative.exe"; }, p => { p.browser.bytes = -1; },
    p => { p.ui.contract = "greedy-qualification"; }, p => { p.ui.systemMessages = ["injected"]; },
    p => { p.ui.creativity = "focused"; }, p => { p.ui.length = "detailed"; },
    p => { p.ui.seedPolicy = "fixed"; }, p => { p.ui.templateSha256 = "bad"; },
    p => { p.ui.sampling.maximumNewTokens = 128; }, p => { p.ui.sampling.topK = 1; },
    p => { p.ui.sampling.temperatureMillionths = 0; }, p => { p.ui.sampling.topPMillionths = 1000000; },
    p => { p.ui.sampling.hidden = true; }, p => { p.functional.cancelPrompt = " "; },
    p => { p.functional.cancelAfterTokens = 0; }, p => { p.functional.interruption = "mock-a-response"; },
    p => { p.limits.maximumStopLatencyMilliseconds = 5000; }, p => { p.limits.installationMilliseconds = -1; },
    p => { p.outputDirectory = null; }
  ];
  for (const mutate of mutations) { const p = plan(); mutate(p); assert.throws(() => tool.validatePlan(p)); }
});

test("eight unchanged public cases retain nine turns and criteria; altered bytes never become a new equivalent plan", () => {
  const bytes = fs.readFileSync(path.join(ROOT, tool.CASE_PATH));
  const cases = tool.acceptanceCases(bytes);
  assert.equal(cases.length, 8); assert.equal(cases.reduce((n, c) => n + c.turns.length, 0), 9);
  assert.equal(cases[6].turns[1].user.includes("Leila"), true);
  assert.throws(() => tool.acceptanceCases(Buffer.concat([bytes, Buffer.from("\n")])), /cases-identity/);
});

test("bounded GET rejects redirected, missing, oversized or failing streams and releases its reader", async () => {
  let cancelled = 0, released = 0;
  const response = values => ({ status: 200, redirected: false, body: { getReader: () => ({
    read: async () => values.length ? { done: false, value: values.shift() } : { done: true },
    cancel: async () => { cancelled += 1; }, releaseLock: () => { released += 1; }
  }) } });
  assert.equal((await tool.boundedGet("https://tinyrustlm.com/test", 3, async (url, opts) => {
    assert.equal(url, "https://tinyrustlm.com/test"); assert.equal(opts.redirect, "error");
    return response([Buffer.from("a"), Buffer.from("bc")]);
  })).toString(), "abc");
  assert.equal(cancelled, 1); assert.equal(released, 1);
  await assert.rejects(tool.boundedGet("https://tinyrustlm.com/test", 2, async () => response([Buffer.from("abc")])), /http-size/);
  assert.equal(cancelled, 2); assert.equal(released, 2);
  for (const value of [{ status: 301 }, { status: 200, redirected: true }, { status: 200 }])
    await assert.rejects(tool.boundedGet("https://tinyrustlm.com/test", 3, async () => value), /http-response/);
  const identity = { bytes: 3, sha256: hash("abc") };
  tool.verifyBytes(Buffer.from("abc"), identity, "ui-test-hash");
  assert.throws(() => tool.verifyBytes(Buffer.from("abd"), identity, "ui-test-hash"), /test-hash/);
  await assert.rejects(tool.preflight(plan(), async () => new Response("not a release")), /marker-hash/);
});

test("one raw generation captures exact real history, random seed, output, tokens and independently measured latency", () => {
  const p = plan(); const history = [{ role: "user", content: "My name is Nora." },
    { role: "assistant", content: "Raw Nora\n<think>untouched</think>" }, { role: "user", content: "Correction: Leila." }];
  const result = tool.analyzeTurn(events(p, history), history, p);
  assert.deepEqual(result.messages, history); assert.equal(result.seed, "123");
  assert.equal(result.output.text, "  untouched\nanswer  "); assert.deepEqual(result.output.tokenIds, [10, 20]);
  assert.equal(result.timing.firstTokenMilliseconds, 20); assert.equal(result.timing.decodeTokensPerSecond, 50);
  assert.equal(result.semanticAssessment, "ungraded");
  const cancelled = tool.analyzeTurn(events(p, history, true), history, p, true);
  assert.equal(cancelled.timing.stopLatencyMilliseconds, 9);
  assert.throws(() => tool.analyzeTurn(events(p, history), history.slice(-1), p), /observed-history/);
});

test("wire, sampling, identities, extra generations, silent errors and slow output cannot pass", () => {
  const p = plan(), messages = [{ role: "user", content: "Hello." }];
  const mutations = [
    e => { e.push(e[2]); }, e => { e.pop(); }, e => { e.push({ kind: "command-rejected" }); },
    e => { e.at(-1).generationId = "other"; }, e => { e[2].compositionId = "9".repeat(64); },
    e => { e[1].offset += 1; }, e => { e[0].bytes[0] = 256; }, e => { e[0].generationId = "other"; },
    e => { e.at(-1).payload.output.operationId = "other"; }, e => { e.at(-1).payload.output.text = null; },
    e => { e.at(-1).payload.output.tokenIds[0] = 90; }, e => { e.at(-1).payload.output.status.kind = "failed"; },
    e => { e[3].time = 31011; }, e => { e[4].time = 2031; }, e => { e.at(-1).time = 180011; },
    e => { e.push({ direction: "ui", kind: "stop-click", time: 49 }); }
  ];
  for (const mutate of mutations) { const e = events(p); mutate(e); assert.throws(() => tool.analyzeTurn(e, messages, p)); }
  const different = plan(); different.ui.sampling.topK = 41;
  assert.throws(() => tool.analyzeTurn(events(p), messages, different), /observed-sampling/);
  const slowStop = events(p, messages, true); slowStop.at(-1).time = 3000;
  assert.throws(() => tool.analyzeTurn(slowStop, messages, p, true), /performance-gate/);
  assert.throws(() => tool.analyzeTurn(events(p), messages, p, true), /terminal-output/);
  const noClick = events(p, messages, true).filter(e => e.kind !== "stop-click");
  assert.throws(() => tool.analyzeTurn(noClick, messages, p, true), /visible-stop/);
});

test("a final-token-only terminal is measured honestly; empty context-limit output fails useful-chat performance", () => {
  const p = plan(), messages = [{ role: "user", content: "Hello." }];
  const e = events(p).filter(item => item.kind !== "generation-step");
  e.at(-1).payload.output.tokenIds = [10];
  const result = tool.analyzeTurn(e, messages, p);
  assert.equal(result.timing.firstTokenMilliseconds, 50); assert.equal(result.timing.decodeTokensPerSecond, null);
  e.at(-1).payload.output.tokenIds = []; e.at(-1).payload.output.status.kind = "context-limit";
  assert.throws(() => tool.analyzeTurn(e, messages, p), /performance-gate/);
});

test("runtime activation proves the exact admitted model graph and artifact, and restoration requests fail closed", () => {
  const admission = { operationId: "o", composition: { graphIdentitySha256: "g", memberTableSha256: "m" },
    artifacts: [0, 0, 0, 0, 0, { sha256: "a", byteCount: 896 }] };
  const state = { state: "active-idle", operationId: "o", activeComposition: {
    graphIdentitySha256: "g", memberTableSha256: "m", artifactSha256: "a", artifactBytes: 896 } };
  assert.equal(tool.verifyActivation([{ kind: "composition-active", payload: { state } }], admission), state);
  assert.throws(() => tool.verifyActivation([], admission), /activation-identity/);
  for (const key of Object.keys(state.activeComposition)) {
    const modified = structuredClone(state); modified.activeComposition[key] = "wrong";
    assert.throws(() => tool.verifyActivation([{ kind: "composition-active", payload: { state: modified } }], admission));
  }
  tool.assertNoMemberDownload([{ url: "catalog" }], ["model"]);
  assert.throws(() => tool.assertNoMemberDownload([{ url: "model" }], ["model"]), /restoration-model-request/);
});

test("passive observer forwards original transfers and errors, captures only prompt bytes, and clicks the visible Stop after actual progress", () => {
  const workers = [], forwarded = [], clicks = [];
  class NativeWorker {
    constructor(...args) { this.args = args; this.listeners = {}; workers.push(this); }
    postMessage(...args) { forwarded.push(args); return 71; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
  }
  const stop = { disabled: false, dataset: { action: "stop" }, click: () => clicks.push("clicked") };
  const sandbox = { window: { Worker: NativeWorker }, URL, Uint8Array, performance: { now: () => 40 },
    MutationObserver: class { observe() {} },
    location: { origin: "https://tinyrustlm.com" }, document: { baseURI: "https://tinyrustlm.com/", getElementById: () => stop } };
  vm.runInNewContext(`(${tool.installObserver.toString()})()`, sandbox);
  const worker = new sandbox.window.Worker("/app/model-runtime-worker.js");
  const log = sandbox.window.__tinyUiCapture;
  const buffer = new Uint8Array([1, 2, 3]).buffer;
  const command = { kind: "artifact-chunk", payload: { artifactKind: "model", bytes: buffer } };
  assert.equal(worker.postMessage(command, [buffer]), 71); assert.equal(forwarded[0][0], command);
  assert.equal(log.events.length, 0);
  command.payload.artifactKind = "prompt-request"; command.payload.offset = 0;
  worker.postMessage(command); assert.deepEqual(Array.from(log.events[0].bytes), [1, 2, 3]);
  log.stopAfterTokens = 1; worker.postMessage({ kind: "begin-generation" });
  worker.listeners.message({ data: { kind: "generation-step", payload: { step: { emittedTokenId: 9 } } } });
  assert.deepEqual(clicks, ["clicked"]); assert.equal(log.events.at(-1).kind, "stop-click");
  worker.listeners.error({}); assert.deepEqual(Array.from(log.errors), ["ui-production-worker-error"]);
  worker.listeners.message({ data: { kind: "unrelated", payload: { modelBytes: buffer } } });
  const unrelated = new sandbox.window.Worker("https://other.test/worker.js");
  unrelated.postMessage(command); assert.equal(Object.keys(unrelated.listeners).length, 0);
  stop.disabled = true; log.stopAfterTokens = 1; worker.postMessage({ kind: "begin-generation" });
  worker.listeners.message({ data: { kind: "generation-step", payload: { step: { emittedTokenId: 10 } } } });
  assert.equal(log.errors.at(-1), "ui-stop-not-available");
  log.events.length = 20000; worker.postMessage({ kind: "begin-generation" }); assert.equal(log.overflow, true);
});

/** In-memory lifecycle driver verifies orchestration only; never interpreted as browser/model evidence. */
function driverFixture(options = {}) {
  const calls = [], sessions = [];
  const driver = {
    createProfile: (parent, id) => { calls.push(["profile", parent, id]); return { root: "test-only-owned-profile" }; },
    retireProfile: owner => { calls.push(["retire", owner.root]); if (options.cleanupFailure) throw new Error("ui-test-cleanup-failed"); },
    launch: async (p, owner, viewport, offline) => {
      const index = sessions.length;
      const session = { offline, network: (index <= (viewport.mobile ? 1 : 0) || options.redownload) ? [{ url: "model", method: "GET", type: "fetch" }] : [],
        context: { close: async () => calls.push(["close", index]) } };
      sessions.push(session); calls.push(["launch", offline]); return session;
    },
    ready: async session => { calls.push(["ready", session.offline]); if (options.readyFailure) throw new Error("ui-test-not-ready"); return {}; },
    interrupt: async session => { calls.push(["interrupt"]); await session.context.close(); return { receivedBytes: 13 }; },
    newChat: async () => calls.push(["new-chat"]), screenshot: async (_, name) => calls.push(["screenshot", name]),
    snapshot: async () => ({ fixture: true }),
    turn: async (session, p, user, history, report, cancel = false) => {
      calls.push(["turn", user, history, cancel]); report.turns.push({ status: "test-only-capture" });
      if (options.turnFailure) throw new Error("ui-test-turn-failed");
      return [...history, { role: "user", content: user }, { role: "assistant", content: `actual-fixture-${user}` }];
    }
  };
  return { driver, calls, sessions };
}

test("orchestration preserves exact actual first-turn history, visible reset, Stop/next turn, new-process cache/offline, and closes before cleanup", async () => {
  const p = plan(), cases = [{ id: "correction", criteria: ["same criteria"], turns: [{ user: "Nora" }, { user: "Leila" }] }];
  for (const mobile of [false, true]) {
    const fixture = driverFixture(), report = {};
    await tool.runViewport(p, cases, { memberUrls: ["model"], allowedGetUrls: ["model"], validUntilUtc: "2999-01-01T00:00:00Z" },
      { id: mobile ? "mobile-viewport" : "desktop", mobile }, report, fixture.driver);
    assert.equal(report.status, "captured-not-graded"); assert.equal(report.profileCleanup, "removed-original-owned-profile");
    const turns = fixture.calls.filter(c => c[0] === "turn");
    assert.deepEqual(turns[1][2], [{ role: "user", content: "Nora" }, { role: "assistant", content: "actual-fixture-Nora" }]);
    assert.equal(turns[2][3], true); assert.equal(turns[3][2].at(-1).content, `actual-fixture-${p.functional.cancelPrompt}`);
    assert.deepEqual(turns[4][2], []); assert.deepEqual(turns[5][2], []); assert.deepEqual(turns[6][2], []);
    assert.deepEqual(fixture.calls.filter(c => c[0] === "launch").map(c => c[1]), mobile ? [false, false, false, true] : [false, false, true]);
    assert.equal(fixture.calls.filter(c => c[0] === "interrupt").length, mobile ? 1 : 0);
    assert.equal(fixture.calls.at(-2)[0], "close"); assert.equal(fixture.calls.at(-1)[0], "retire");
  }
});

test("failed installation, turn, expired authority, redownload and cleanup retain failure without a hidden generation retry", async () => {
  const cases = [{ id: "one", criteria: [], turns: [{ user: "hello" }] }];
  for (const options of [{ readyFailure: true }, { turnFailure: true }, { redownload: true }, { cleanupFailure: true }, { expired: true }]) {
    const fixture = driverFixture(options), report = {};
    await assert.rejects(tool.runViewport(plan(), cases, { memberUrls: ["model"], allowedGetUrls: ["model"],
      validUntilUtc: options.expired ? "2000-01-01T00:00:00Z" : "2999-01-01T00:00:00Z" },
    { id: "desktop", mobile: false }, report, fixture.driver));
    assert.equal(fixture.calls.filter(c => c[0] === "retire").length, 1);
    if (options.turnFailure) assert.equal(fixture.calls.filter(c => c[0] === "turn").length, 1);
    if (options.cleanupFailure) assert.equal(report.profileCleanup, "retained-cleanup-failed-no-retry");
  }
});

test("invalid path/registration never launches a browser; error reporting does not echo exception secrets", () => {
  assert.throws(() => tool.readRegisteredPlan("missing", "HEAD"), /registration-commit/);
  assert.equal(tool.safeCode(new Error("ui-observed-history")), "ui-observed-history");
  assert.equal(tool.safeCode(new Error("password=never-print")), "ui-operation-failed");
  assert.equal(tool.safeCode(null), "ui-operation-failed");
  assert.throws(() => tool.createProfile(path.join(ROOT, "artifacts/tests/disallowed-model-profile"), "fixture"), /model output/);
});

/** Minimal DOM/transport adapter exercises production callbacks without launching a browser or executing a model. */
function pageFixture(p) {
  const log = { events: [], errors: [], overflow: false, stopAfterTokens: null,
    loading: [{ fields: { simpleModelPickerStatus: { text: "Saving fixture in this browser / 25%", visible: true } } }] };
  const rows = [], calls = [], handlers = {}, contextHandlers = {};
  const document = {
    querySelector: selector => selector === ".app-shell" ? { dataset: { mode: "simple", generationState: "idle" } } :
      { value: selector.includes("simpleCreativity") ? "balanced" : "normal" },
    querySelectorAll: () => rows.map(row => ({ dataset: { rawText: row.raw }, closest: () => ({ dataset: { status: row.status } }) })),
    getElementById: id => ({ textContent: id === "wasmState" ? "verified" : id === "modelState" ? "worker active (fixture)" :
      id === "simpleModelPickerStatus" ? "Saving fixture in this browser / 25%" : "ready", getClientRects: () => [1], disabled: false })
  };
  const sandbox = { document, window: { __tinyUiCapture: log } };
  const evaluate = async (fn, arg) => {
    sandbox.argument = arg;
    return vm.runInNewContext(`(${fn.toString()})(argument)`, sandbox);
  };
  const page = {
    setDefaultTimeout: value => calls.push(["timeout", value]), on: (event, callback) => { handlers[event] = callback; },
    goto: async (...args) => { calls.push(["goto", ...args]); }, evaluate,
    screenshot: async options => { calls.push(["screenshot", options.path]); },
    waitForFunction: async (fn, arg) => { assert.ok(await evaluate(fn, arg)); },
    locator: selector => ({
      fill: async value => calls.push(["fill", selector, value]),
      click: async () => {
        calls.push(["click", selector]);
        if (selector === "#newChatButton") { rows.length = 0; return; }
        const user = calls.filter(c => c[0] === "fill").at(-1)[2];
        const cancel = log.stopAfterTokens !== null;
        log.stopAfterTokens = null;
        const next = events(p, [{ role: "user", content: user }], cancel);
        log.events.push(...next); rows.push({ raw: next.at(-1).payload.output.text, status: cancel ? "stopped" : "completed" });
      }
    })
  };
  const context = { pages: () => [page], newPage: async () => page,
    browser: () => ({ version: () => "test-only-browser-adapter" }),
    close: async () => calls.push(["close"]), setOffline: async value => calls.push(["offline", value]),
    addInitScript: async fn => assert.equal(fn, tool.installObserver), on: (event, callback) => { contextHandlers[event] = callback; } };
  return { page, context, log, rows, calls, handlers, contextHandlers };
}

test("browser launch keeps every writable browser directory inside the declared model profile and never routes fake responses", async () => {
  const p = plan(), fixture = pageFixture(p), owner = { root: "D:\\LLMs\\TinyRustLM\\test-only-uncreated" };
  let options;
  const session = await tool.launchSession(p, owner, { width: 390, height: 844, mobile: true }, true, {
    launchPersistentContext: async (profile, value) => { options = value; assert.equal(profile, path.join(owner.root, "profile")); return fixture.context; }
  });
  assert.equal(options.executablePath, p.browser.path); assert.equal(options.serviceWorkers, "allow");
  assert.equal(options.env.TEMP, path.join(owner.root, "temporary")); assert.equal(options.env.TMP, options.env.TEMP);
  assert.equal(options.downloadsPath, path.join(owner.root, "downloads")); assert.equal(options.isMobile, true);
  assert.equal(options.acceptDownloads, false); assert.equal(options.args.some(value => value.includes(owner.root)), true);
  assert.deepEqual(fixture.calls.find(c => c[0] === "offline"), ["offline", true]);
  fixture.contextHandlers.request({ url: () => "https://minimodel.org/model", method: () => "GET", resourceType: () => "fetch" });
  assert.equal(session.network.length, 1);
  fixture.handlers.console({ type: () => "info" });
  fixture.handlers.console({ type: () => "error", location: () => ({ url: "https://tinyrustlm.com/.well-known/site-release.json" }),
    text: () => "Failed to load resource: net::ERR_INTERNET_DISCONNECTED" });
  assert.equal(session.expectedOfflineErrors.length, 1); assert.equal(session.errors.length, 0);
  fixture.handlers.console({ type: () => "error", location: () => ({ url: "https://other.test/" }), text: () => "genuine error" });
  fixture.handlers.pageerror(new Error("not suppressed")); assert.equal(session.errors.length, 2);
  fixture.handlers.websocket({ url: () => "wss://tinyrustlm.com/unexpected" });
  assert.equal(session.network.at(-1).method, "WEBSOCKET");
  fixture.contextHandlers.response({ url: () => "https://minimodel.org/model.slm2" });
  fixture.contextHandlers.response({ url: () => "https://tinyrustlm.com/not-a-pinned-asset" });
  const asset = p.release.assets[0]; asset.bytes = 3; asset.sha256 = hash("abc");
  fixture.contextHandlers.response({ url: () => "https://tinyrustlm.com/", status: () => 200,
    headerValue: async () => "3", body: async () => Buffer.from("abc") });
  await Promise.all(session.pendingAssetChecks); assert.equal(session.observedAssets.has("/"), true);
  fixture.contextHandlers.response({ url: () => "https://tinyrustlm.com/", status: () => 500 });
  await Promise.all(session.pendingAssetChecks); assert.equal(session.errors.at(-1), "ui-browser-asset-status");
  fixture.context.setOffline = async () => { throw new Error("expected launch failure"); };
  await assert.rejects(tool.launchSession(p, owner, { width: 1440, height: 1000, mobile: false }, false,
    { launchPersistentContext: async () => fixture.context }), /expected launch failure/);
  assert.equal(fixture.calls.at(-1)[0], "close");
});

test("ready/submit callbacks assert real DOM defaults, preserve raw terminal records and retain failures without retry", async () => {
  const p = plan(), fixture = pageFixture(p);
  const session = { ...fixture, network: [], errors: [], pendingAssetChecks: [], observedAssets: new Set(), expectedOfflineErrors: [],
    started: Date.now(), phase: "fresh-install", viewport: { id: "test-only" } };
  const admission = { operationId: "o", composition: { graphIdentitySha256: "g", memberTableSha256: "m" },
    artifacts: [0, 0, 0, 0, 0, { sha256: "a", byteCount: 896 }] };
  fixture.log.events.push({ kind: "composition-active", payload: { state: { state: "active-idle", operationId: "o",
    activeComposition: { graphIdentitySha256: "g", memberTableSha256: "m", artifactSha256: "a", artifactBytes: 896 } } } });
  const result = await tool.ready(session, p, { admission, allowedGetUrls: [] });
  assert.equal(result.browserVersion, "test-only-browser-adapter");
  const report = { turns: [] };
  const history = await tool.turn(session, p, "Hello.", [], report);
  assert.equal(history.at(-1).content, "  untouched\nanswer  "); assert.equal(report.turns[0].status, "captured-not-graded");
  assert.equal(report.turns[0].raw.events.some(e => e.kind === "composition-active"), false);
  await tool.newChat(session); assert.equal(fixture.rows.length, 0);
  await tool.turn(session, p, "Stop me.", [], report, true);
  assert.equal(report.turns[1].capture.output.status.kind, "cancelled");
  session.errors.push("ui-real-error");
  await assert.rejects(tool.turn(session, p, "Failure remains raw.", [], report), /visible-raw-output/);
  assert.equal(report.turns.at(-1).status, "started"); assert.equal(report.turns.at(-1).raw.events.at(-1).kind, "generation-complete");
  assert.equal(fixture.calls.filter(c => c[0] === "fill").length, 3);
  session.page.waitForFunction = async () => { throw new Error("timeout fixture"); };
  await assert.rejects(tool.turn(session, p, "One failed request only.", [], report), /timeout fixture/);
  assert.ok(report.turns.at(-1).raw); assert.equal(fixture.calls.filter(c => c[0] === "fill").length, 4);
});

test("installation interruption observes actual body progress before closure; late activation and no progress fail", async () => {
  for (const mode of ["progress", "late", "timeout"]) {
    const p = plan(); p.limits.installationMilliseconds = 10;
    const fixture = pageFixture(p), callbacks = {};
    fixture.context.newCDPSession = async () => ({ on: (event, callback) => { callbacks[event] = callback; },
      send: async method => assert.equal(method, "Network.enable"), detach: async () => fixture.calls.push(["detach"]) });
    fixture.page.goto = async () => {
      if (mode === "timeout") return;
      callbacks["Network.requestWillBeSent"]({ requestId: "actual", request: { url: "model" } });
      callbacks["Network.dataReceived"]({ requestId: "unrelated", dataLength: 900 });
      callbacks["Network.dataReceived"]({ requestId: "actual", dataLength: 17 });
      if (mode === "late") fixture.log.events.push({ kind: "composition-active" });
    };
    if (mode === "progress") {
      const result = await tool.interruptInstallation(fixture, p, { memberUrls: ["model"] });
      assert.equal(result.receivedBytes, 17); assert.equal(result.activationObserved, false);
      assert.deepEqual(fixture.calls, [["close"], ["detach"]]);
    } else {
      await assert.rejects(tool.interruptInstallation(fixture, p, { memberUrls: ["model"] }),
        mode === "late" ? /too-late/ : /no-model-progress/);
      assert.deepEqual(fixture.calls, [["detach"]]);
    }
  }
});

/** In-memory filesystem isolates ownership failure paths; it never creates a D: profile or reads model bytes. */
function profileFilesystem(options = {}) {
  const entries = new Map(), removed = []; let nextId = 1n;
  const put = (target, directory, text = "") => {
    const stat = { dev: 1n, ino: nextId++, nlink: 1n, size: BigInt(Buffer.byteLength(text)),
      isDirectory: () => directory, isFile: () => !directory, isSymbolicLink: () => false };
    entries.set(target, { stat, text }); return stat;
  };
  const parent = "D:\\LLMs\\TinyRustLM\\uncreated-unit-adapter"; put(parent, true);
  const fakeFs = {
    lstatSync: target => { assert.ok(entries.has(target), target); return entries.get(target).stat; },
    readFileSync: target => entries.get(target).text,
    writeFileSync: (target, text, settings) => {
      assert.equal(settings.flag, "wx"); assert.equal(entries.has(target), false);
      if (options.markerFailure) throw new Error("ui-test-marker-failure"); put(target, false, text);
    },
    readdirSync: target => [...entries.keys()].filter(key => path.dirname(key) === target).map(key => path.basename(key)),
    rmdirSync: target => { assert.equal(fakeFs.readdirSync(target).length, 0); entries.delete(target); removed.push(target); },
    unlinkSync: target => { entries.delete(target); removed.push(target); }
  };
  const fakeFiles = {
    createOwnedDirectory: target => {
      assert.equal(entries.has(target), false);
      if (options.childFailure && path.basename(target) === "cache") throw new Error("ui-test-directory-failure");
      put(target, true); return target;
    },
    assertSafeRegularFile: target => { assert.equal(entries.get(target).stat.isFile(), true); return { stat: entries.get(target).stat }; },
    assertSafeDirectoryAncestry: target => assert.equal(entries.get(target).stat.isDirectory(), true)
  };
  const realRequire = require("node:module").createRequire(path.join(ROOT, "tinyrustlm/tools/deployed-ui-acceptance.js"));
  const sandbox = { module: { exports: {} }, exports: {}, __dirname: path.join(ROOT, "tinyrustlm/tools"),
    __filename: path.join(ROOT, "tinyrustlm/tools/deployed-ui-acceptance.js"), Buffer, process,
    require: name => name === "node:fs" ? fakeFs : name === "./immutable-publication-files.js" ? fakeFiles :
      name === "./huggingface-candidate-storage.js" ? { requireModelOutputRoot: target => {
        assert.ok(target.startsWith(parent)); return target;
      } } : realRequire(name) };
  vm.runInNewContext(fs.readFileSync(sandbox.__filename, "utf8"), sandbox, { filename: sandbox.__filename });
  return { tool: sandbox.module.exports, parent, entries, removed };
}

test("owned browser-data cleanup removes only original identity and refuses changed marker, link, or directory; partial allocation is accounted for", () => {
  const fixture = profileFilesystem();
  const owner = fixture.tool.createProfile(fixture.parent, "desktop");
  assert.equal(fixture.entries.size, 8);
  fixture.tool.retireProfile(owner);
  assert.equal(fixture.entries.size, 1); assert.equal(fixture.removed.at(-1), owner.marker);
  for (const mutation of [
    (f, o) => { f.entries.get(o.marker).text = "replaced"; },
    (f, o) => { f.entries.get(o.marker).stat.ino += 100n; },
    (f, o) => { f.entries.get(o.root).stat.ino += 100n; },
    (f, o) => { f.entries.get(path.join(o.root, "cache")).stat.isSymbolicLink = () => true; }
  ]) {
    const f = profileFilesystem(), o = f.tool.createProfile(f.parent, "mobile");
    // Original ownership metadata is a snapshot, as real fs.Stats values are.
    o.stat = { ...o.stat }; o.markerStat = { ...o.markerStat };
    mutation(f, o); assert.throws(() => f.tool.retireProfile(o)); assert.equal(f.removed.length, 0);
  }
  const childFailure = profileFilesystem({ childFailure: true });
  assert.throws(() => childFailure.tool.createProfile(childFailure.parent, "desktop"), /directory-failure/);
  assert.equal(childFailure.entries.size, 1);
  const markerFailure = profileFilesystem({ markerFailure: true });
  assert.throws(() => markerFailure.tool.createProfile(markerFailure.parent, "desktop"), error => {
    assert.ok(error.retainedProfile.startsWith(markerFailure.parent)); return true;
  });
  assert.equal(markerFailure.removed.length, 0);
});

test("browser-close uncertainty prevents profile cleanup rather than deleting an active browser's files", async () => {
  const fixture = driverFixture(), report = {};
  fixture.driver.launch = async () => { const error = new Error("ui-test-browser-open"); error.browserMayBeOpen = true; throw error; };
  await assert.rejects(tool.runViewport(plan(), [], { memberUrls: [], validUntilUtc: "2999-01-01T00:00:00Z" },
    { id: "desktop", mobile: false }, report, fixture.driver), /browser-open/);
  assert.equal(report.profileCleanup, "retained-browser-close-failed-no-retry");
  assert.equal(fixture.calls.filter(c => c[0] === "retire").length, 0);
  let attempts = 0;
  const session = { context: { close: async () => { attempts += 1; throw new Error("ui-test-close-failed"); } } };
  await assert.rejects(tool.closeSession(session), error => error.browserMayBeOpen === true);
  assert.equal(attempts, 1); assert.equal(session.closed, undefined); assert.equal(session.closeAttempted, true);
});

test("closed normal-flow network policy rejects writes, unexpected destinations, query-bearing leaks and WebSockets without reading bodies", () => {
  const allowed = ["https://tinyrustlm.com/", "https://minimodel.org/catalog/v1/index.json",
    "https://tinyrustlm.com/app/app.js?v=sha256-" + "a".repeat(64)];
  tool.assertNetworkPrivacy([{ url: allowed[0], method: "GET", type: "document" },
    { url: allowed[1], method: "HEAD", type: "fetch" }, { url: allowed[2], method: "GET", type: "script" }], allowed);
  for (const request of [
    { url: allowed[0], method: "POST" }, { url: allowed[0], method: "PUT" },
    { url: "https://elsewhere.test/", method: "GET" }, { url: allowed[0] + "?prompt=private", method: "GET" },
    { url: "wss://tinyrustlm.com/", method: "WEBSOCKET" }, { url: allowed[2] + "&message=private", method: "GET" }
  ]) assert.throws(() => tool.assertNetworkPrivacy([request], allowed), /unexpected-network/);
});

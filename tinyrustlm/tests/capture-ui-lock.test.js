"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const capture = require("../tools/capture-ui-lock.js");
const admission = require("../app/browser-model-admission.js");
const scratch = require("../tools/canonical-operation-scratch.js");

const desktop = { name: "desktop", width: 1365, height: 768, mobile: false };
const output = path.resolve(__dirname, "../../artifacts/tests/ui-lock-options");
const modelRoot = "D:\\LLMs\\TinyRustLM\\test-only-ui-lock-never-written";

/** Allocate only disposable metadata beneath canonical artifacts. */
function ownedTest(t) {
  const owned = scratch.createOwnedTemporaryDirectory({ temporaryParent: output });
  t.after(() => scratch.removeOwnedTemporaryDirectory(owned));
  return owned.rootPath;
}

/** Produce structurally valid test-only admission metadata without writing any model bytes. */
function admissionText() {
  const digest = "a".repeat(64);
  const sizes = [1048576, 7038773, 1403, 65800, 512, 896];
  const artifacts = admission.artifactSpecs.map((spec, index) => ({ role: spec.role, format: spec.format, fileName: spec.fileName,
    byteCount: sizes[index], sha256: digest, formatProfileSha256: spec.profileSha256 }));
  const resolved = sizes.slice(0, 5).reduce((a, b) => a + b, 0);
  return admission.serializeAdmission({
    schema: admission.schema, modelId: "test-only/never-live-ui-lock", operationId: digest, artifacts,
    composition: { graphIdentitySha256: digest, memberTableSha256: digest, resolvedMemberBytes: resolved },
    qualification: { receiptId: `sha256:${digest}`, sourceEvidenceSha256: digest,
      structuralEvidenceSha256: digest, numericalEvidenceSha256: digest, qualityEvidenceSha256: digest,
      evalCasesSha256: digest, qualityClaim: "task-specific-qualified", qualityScope: "test-only/never-live" },
    runtime: { workerProtocol: admission.workerProtocol, wasmByteCount: 676916, wasmSha256: digest,
      policy: { maximumModelBytes: sizes[0], maximumSequenceTokens: 4096, maximumKvBytes: 268435456,
        maximumScratchBytes: 134217728, maximumResolvedMemberBytes: resolved,
        maximumResidentDependencyBytes: resolved - sizes[0], maximumRequestBytes: 1054848,
        maximumLinearMemoryBytes: 1610612736 },
      defaultSampling: { temperatureMillionths: 600000, topK: 20, topPMillionths: 950000,
        repetitionPenaltyMillionths: 1000000, repetitionWindow: 64, maximumNewTokens: 512 } }
  });
}

/** Simulate read-only D: inventory; the one real metadata file stays in owned artifacts. */
function compositionInventory(t, { entries, memberStat } = {}) {
  const root = ownedTest(t);
  const metadata = path.join(root, "admission.json");
  fs.writeFileSync(metadata, admissionText());
  const parsed = admission.parseAdmissionText(fs.readFileSync(metadata, "utf8"));
  const admissionPath = path.join(modelRoot, "test.browser-composition-admission.json");
  const lstat = fs.lstatSync;
  const realpath = fs.realpathSync.native;
  const readdir = fs.readdirSync;
  const open = fs.openSync;
  t.mock.method(fs, "lstatSync", (target, options) => {
    if (target === modelRoot) return { isDirectory: () => true, isSymbolicLink: () => false };
    if (target === admissionPath) return lstat(metadata, options);
    const artifact = parsed.artifacts.find((a) => path.join(modelRoot, a.fileName) === target);
    if (artifact) return { isFile: () => true, isSymbolicLink: () => false,
      nlink: 1, size: artifact.byteCount, ...memberStat };
    return lstat(target, options);
  });
  t.mock.method(fs.realpathSync, "native", (target) => target === modelRoot ? modelRoot : realpath(target));
  t.mock.method(fs, "readdirSync", (target, options) => target === modelRoot
    ? entries || [...parsed.artifacts.map((a) => a.fileName), path.basename(admissionPath)]
    : readdir(target, options));
  t.mock.method(fs, "openSync", (target, ...args) => open(target === admissionPath ? metadata : target, ...args));
  return parsed;
}

test("options require explicit current modes, canonical output and secure origins", () => {
  const empty = capture.parseOptions(["http://127.0.0.1:1234/app/", output]);
  assert.equal(empty.visualMode, "empty");
  assert.equal(empty.baselinePath, "");
  for (const mode of ["active", "long"]) {
    const args = ["https://tinyrustlm.com/", output, "-", mode, modelRoot];
    if (process.platform !== "win32") {
      assert.throws(() => capture.parseOptions(args), /absolute path under D:/);
      continue;
    }
    const options = capture.parseOptions(args);
    assert.equal(options.compositionDir, modelRoot);
    assert.equal(options.visualMode, mode);
  }
  for (const args of [[], ["https://tinyrustlm.com/"],
    ["http://tinyrustlm.com/", output], ["file:///index.html", output],
    ["https://user:pass@tinyrustlm.com/", output],
    ["https://tinyrustlm.com/", path.resolve("outside-artifacts")],
    ["https://tinyrustlm.com/", output, "-", "unknown"],
    ["https://tinyrustlm.com/", output, "-", "active"],
    ["https://tinyrustlm.com/", output, "-", "empty", modelRoot],
    ["https://tinyrustlm.com/", output, "-", "long", modelRoot, "extra"],
    ["https://tinyrustlm.com/", output, "-", "long", output],
    ["https://tinyrustlm.com/", output, path.join(output, "baseline.json")]]) {
    assert.throws(() => capture.parseOptions(args));
  }
});

test("current composition selection uses all six bound members and admission", (t) => {
  if (process.platform !== "win32") {
    assert.throws(() => capture.compositionFiles(modelRoot), /absolute path under D:/);
    return;
  }
  compositionInventory(t);
  const files = capture.compositionFiles(modelRoot);
  assert.equal(files.length, 7);
  assert.deepEqual(files.slice(0, 6).map((f) => path.basename(f)), admission.artifactSpecs.map((a) => a.fileName));
});

// D: inventory is a Windows boundary. Other hosts exercise its explicit rejection above.
for (const [name, options] of Object.entries(process.platform === "win32" ? {
  missing: { entries: ["tiny-test-model-q8.slm"] },
  ambiguous: { entries: ["a.browser-composition-admission.json", "b.browser-composition-admission.json"] },
  oversized: { entries: Array(129).fill("x") },
  changedSize: { memberStat: { size: 1 } },
  linked: { memberStat: { isSymbolicLink: () => true } },
  hardlink: { memberStat: { nlink: 2 } },
  directory: { memberStat: { isFile: () => false } }
} : {})) {
  test(`composition selection rejects ${name}`, (t) => {
    compositionInventory(t, options);
    assert.throws(() => capture.compositionFiles(modelRoot));
  });
}

/** Build complete presentation evidence to test comparison independently of browser capture. */
function report(mode = "empty") {
  return { conversation_mode: mode,
    comparison_policy: "stable-ui-fields-with-rect-tolerance-and-screenshot-evidence-v1",
    captures: [desktop, { name: "mobile", width: 390, height: 844 }].map((v) => ({
      viewport: v.name, width: v.width, height: v.height, screenshot_sha256: "a".repeat(64), screenshot_bytes: 5000,
      state: { requiredShellPresent: true, signatureFields: {
        viewport: v.name, conversationMode: mode, title: "TinyRustLM", bodyBackground: "black", bodyColor: "white",
        sidebarBackground: "black", primaryButtonBackground: "blue", h1: "TinyRustLM", privacyBadge: "Local",
        starterLabels: ["Summarize"], setupLabels: [], presetLabels: [], panelHeadings: ["Advanced"],
        conversationState: mode === "empty" ? "empty" : "active", messageCount: mode === "long" ? 14 : mode === "active" ? 2 : 0,
        completedAssistantCount: mode === "long" ? 7 : mode === "active" ? 1 : 0,
        responseCount: 1, generationState: "idle", simpleExperienceHidden: true, modelPopoverHidden: true,
        shellRects: Object.fromEntries(["leftSidebar", "mainWorkspace", "advancedOptionsPanel", "modelToolbar",
          "composerPanel", "conversationPanel"].map((key) => [key, { x: 0, y: key === "composerPanel" ? 100 : 0,
          width: 300, height: 100 }]))
      } }
    })) };
}

test("comparison accepts complete matching fields but rejects missing/changed evidence", () => {
  const baseline = report();
  assert.deepEqual(capture.compareBaseline(report(), baseline), []);
  const mutations = [
    (r) => { r.conversation_mode = "active"; }, (r) => { r.comparison_policy = "other"; },
    (r) => { r.captures = []; }, (r) => { r.captures.pop(); },
    (r) => { r.captures[1] = r.captures[0]; }, (r) => { r.captures[0].width++; },
    (r) => { r.captures[0].screenshot_bytes = 0; }, (r) => { r.captures[0].screenshot_sha256 = "bad"; },
    (r) => { delete r.captures[0].state.signatureFields; },
    (r) => { r.captures[0].state.requiredShellPresent = false; },
    (r) => { r.captures[0].state.signatureFields.title = "wrong"; },
    (r) => { r.captures[0].state.signatureFields.conversationMode = "active"; },
    (r) => { r.captures[0].state.signatureFields.starterLabels = []; },
    (r) => { r.captures[0].state.signatureFields.shellRects.composerPanel.x += 9; },
    (r) => { r.captures[1].state.signatureFields.shellRects.composerPanel.x += 25; },
    (r) => { delete r.captures[0].state.signatureFields.shellRects.leftSidebar; },
    (r) => { r.captures[0].state.signatureFields.shellRects.leftSidebar.width = NaN; }
  ];
  for (const mutate of mutations) {
    const changed = report(); mutate(changed);
    assert.ok(capture.compareBaseline(report(), changed).length);
    assert.ok(capture.compareBaseline(changed, baseline).length);
  }
});

test("mode assertions reject failed answers, wrong counts, obstruction and overflow", () => {
  for (const mode of ["empty", "active", "long"]) {
    capture.assertVisualModeState(report(mode).captures[0].state, desktop, mode);
  }
  const mutations = [
    (s) => { s.requiredShellPresent = false; }, (s) => { s.signatureFields.conversationState = "empty"; },
    (s) => { s.signatureFields.messageCount = 0; }, (s) => { s.signatureFields.responseCount = 2; },
    (s) => { s.signatureFields.generationState = "generating"; },
    (s) => { s.signatureFields.completedAssistantCount = 0; },
    (s) => { s.signatureFields.simpleExperienceHidden = false; },
    (s) => { delete s.signatureFields.shellRects.composerPanel; },
    (s) => { s.signatureFields.shellRects.conversationPanel.height = 102; },
    (s) => { s.signatureFields.shellRects.composerPanel.height = 1000; }
  ];
  for (const mutate of mutations) {
    const state = report("active").captures[0].state; mutate(state);
    assert.throws(() => capture.assertVisualModeState(state, desktop, "active"));
  }
});

/** Read the exact ownership minted by the tested function, solely for simulated failure teardown. */
function ownership(rootPath) {
  const markerPath = rootPath + ".owner.v2";
  return { rootPath, temporaryParent: path.dirname(rootPath), markerPath,
    rootStat: fs.lstatSync(rootPath, { bigint: true }), markerStat: fs.lstatSync(markerPath, { bigint: true }),
    markerBytes: fs.readFileSync(markerPath) };
}

for (const scenario of ["success", "action-failed", "launch-failed", "close-failed", "cleanup-failed"]) {
  test(`owned browser lifecycle: ${scenario}`, async (t) => {
    let owned;
    const events = [];
    const context = { setDefaultTimeout: (ms) => assert.equal(ms, 30000),
      setDefaultNavigationTimeout: (ms) => assert.equal(ms, 30000),
      close: async () => { events.push("close"); if (scenario === "close-failed") throw Error("close failure"); } };
    const rm = fs.rmdirSync;
    if (scenario === "cleanup-failed") t.mock.method(fs, "rmdirSync", (target, options) => {
      if (target === owned?.rootPath) throw Error("cleanup failure");
      return rm(target, options);
    });
    const promise = capture.withBrowserProfile(desktop, async (received) => {
      assert.equal(received, context); events.push("action");
      if (scenario === "action-failed") throw Error("action failure");
      return "captured";
    }, async (root, options) => {
      owned = ownership(root);
      assert.deepEqual(options.viewport, { width: 1365, height: 768 });
      assert.equal(options.headless, true);
      assert.equal(options.isMobile, false);
      if (scenario === "launch-failed") throw Error("launch failure");
      return context;
    });
    try {
      if (scenario === "success") assert.equal(await promise, "captured");
      else await assert.rejects(promise, /fail/i);
      if (["close-failed", "cleanup-failed"].includes(scenario)) assert.ok(fs.existsSync(owned.rootPath));
      else assert.ok(!fs.existsSync(owned.rootPath));
      assert.deepEqual(events, scenario === "launch-failed" ? [] : ["action", "close"]);
    } finally {
      t.mock.restoreAll();
      if (owned && fs.existsSync(owned.rootPath)) scratch.removeOwnedTemporaryDirectory(owned);
    }
  });
}

/** Execute browser callbacks against minimal state, without pretending this is real model execution. */
function fakePage({ failure = false, idleNoProgress = false, expanded = true } = {}) {
  let messages = 0;
  const actions = [];
  const state = { readyState: "complete", fonts: { status: "loaded" },
    getElementById: (id) => ({ textContent: { runtimeStatus: "Choose a qualified composition",
      modelState: "choose a model", wasmState: "waiting", errorState: failure ? "failed" : "none" }[id],
      style: {}, scrollHeight: 100 }),
    querySelector: (selector) => selector === ".message-assistant.error" ? null : { dataset: { generationState: "idle" } },
    querySelectorAll: (selector) => ({ length: selector === ".starter-action" ? 4 :
      selector === "#conversation .message" ? messages : messages / 2 }) };
  const sandbox = vm.createContext({ document: state, window: { scrollTo() {} } });
  return { actions, state,
    locator: (selector) => ({ getAttribute: async () => expanded ? "true" : "false",
      click: async () => { actions.push(selector); if (selector === "#importLocalModelButton") {
        const get = state.getElementById;
        state.getElementById = (id) => ({ ...get(id), textContent: { runtimeStatus: "Ready",
          modelState: "loaded composition", wasmState: "verified", errorState: failure ? "failed" : "none" }[id] });
      } },
      setInputFiles: async (files) => actions.push(files), fill: async (value) => actions.push(value),
      evaluate: async (fn) => fn({ requestSubmit: () => { if (!idleNoProgress) messages += 2; } }) }),
    evaluate: async (fn) => vm.runInContext(`(${fn.toString()})()`, sandbox),
    waitForFunction: async (fn, arg, options) => {
      assert.ok([30000, 60000, 90000].includes(options.timeout));
      sandbox.argument = arg;
      if (!vm.runInContext(`(${fn.toString()})(argument)`, sandbox)) throw Error("bounded wait timed out");
    } };
}

test("current startup and Advanced import use the seven supplied files without collapsing setup", async () => {
  for (const expanded of [true, false]) {
    const page = fakePage({ expanded });
    await capture.waitForVisualReady(page);
    const files = Array.from({ length: 7 }, (_, i) => `member-${i}`);
    await capture.loadComposition(page, files);
    assert.equal(page.actions.includes("#modelEditButton"), !expanded);
    assert.deepEqual(page.actions.filter(Array.isArray), [files]);
    assert.equal(page.actions.at(-1), "#importLocalModelButton");
    await capture.waitForVisualReady(page);
    const get = page.state.getElementById;
    page.state.getElementById = (id) => id === "wasmState" ? { textContent: "waiting" } : get(id);
    await assert.rejects(capture.waitForVisualReady(page), /timed out/);
  }
  await assert.rejects(capture.loadComposition(fakePage({ failure: true }), []), /import failed/);
  await assert.rejects(capture.waitForVisualReady(fakePage({ failure: true })), /timed out/);
});

test("generation is bounded and only completed turns advance the selected mode", async () => {
  for (const [mode, turns] of [["empty", 0], ["active", 1], ["long", 7]]) {
    const page = fakePage();
    await capture.prepareConversationVisualMode(page, mode);
    assert.equal(page.actions.length, turns);
  }
  await assert.rejects(capture.prepareConversationVisualMode(fakePage({ failure: true }), "active"), /generation failed/);
  await assert.rejects(capture.prepareConversationVisualMode(fakePage({ idleNoProgress: true }), "long"), /timed out/);
});

test("existing visual evidence cannot be overwritten", async (t) => {
  const root = ownedTest(t);
  fs.writeFileSync(path.join(root, "tinyrustlm-ui-lock-report.json"), "retained");
  await assert.rejects(capture.runCapture(capture.parseOptions(["http://localhost/", root])), /already exists/);
  assert.equal(fs.readFileSync(path.join(root, "tinyrustlm-ui-lock-report.json"), "utf8"), "retained");
});

// Explicit browser evidence adds this check to the standard unit cases; absence grants no browser claim.
if (process.env.TINYRUSTLM_UI_LOCK_EVIDENCE) test("real browser captures the current shell at desktop and mobile without model fixtures", async () => {
  const { startSourceServer } = require("../tools/static-server.js");
  const root = scratch.requireCanonicalArtifactPath(process.env.TINYRUSTLM_UI_LOCK_EVIDENCE);
  const server = await startSourceServer();
  try {
    const options = capture.parseOptions([`${server.origin}/app/`, path.join(root, "browser")]);
    const result = await capture.runCapture(options);
    assert.equal(result.status, "captured-without-baseline");
    const actual = JSON.parse(fs.readFileSync(result.report, "utf8"));
    assert.equal(actual.captures.length, 2);
    assert.deepEqual(capture.compareBaseline(actual, actual), []);
    for (const item of actual.captures) {
      assert.ok(item.screenshot_bytes > 4096);
      assert.deepEqual(item.page_errors, []);
      assert.equal(item.state.signatureFields.messageCount, 0);
      assert.ok(fs.existsSync(item.screenshot));
    }
    const historicalPath = path.resolve(__dirname, "../artifacts/reports/ui-lock-live/tinyrustlm-ui-lock-report.json");
    const historical = JSON.parse(fs.readFileSync(historicalPath, "utf8"));
    fs.writeFileSync(path.join(root, "historical-baseline-comparison.json"), JSON.stringify({
      baseline: historicalPath, report: result.report,
      failures: capture.compareBaseline(actual, historical)
    }, null, 2), { flag: "wx" });
  } finally {
    await server.close();
  }
});

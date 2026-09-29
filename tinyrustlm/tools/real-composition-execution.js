"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const os = require("node:os");
const childProcess = require("node:child_process");
const { once } = require("node:events");
const { encodeRequest } = require("../app/prompt2-request.js");
const runtimeClient = require("../app/model-runtime-client.js");
const scratch = require("./canonical-operation-scratch.js");
const storage = require("./huggingface-candidate-storage.js");

const ROOT = path.resolve(__dirname, "../..");
const SCHEMA = "tinyrustlm.real-composition-execution-request/1";
const MEMBERS = Object.freeze(["model.slm2", "tokenizer.tokenizer2", "template.template2",
  "sampling.sampling2", "prompt.prompt2", "composition.acg2"]);
const ASSETS = Object.freeze(["app/model-runtime-client.js", "app/model-runtime-worker.js",
  "app/prompt2-request.js", "browser-runtime/tinyrustlm-browser-runtime.wasm"]);
const MANAGED = Object.freeze(["TinyRustLM.ConversationProbe.dll", "TinyRustLM.ConversationProbe.deps.json",
  "TinyRustLM.ConversationProbe.runtimeconfig.json", "TinyRustLM.Core.dll", "TinyRustLM.Abstractions.dll"]);
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

/** Reject invalid inputs without printing request content or filesystem exception messages. */
function requireValue(value, code) { if (!value) throw new Error(code); }
/** Hash raw bytes; no text trimming, answer repair or normalization is performed. */
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
/** Require exactly the declared record fields. */
function exact(value, fields, code) {
  requireValue(value && Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).sort().join(",") === [...fields].sort().join(","), code);
}
/** Bound integers before allocating memory or scheduling work. */
function integer(value, min, max, code) {
  requireValue(Number.isSafeInteger(value) && value >= min && value <= max, code);
}
/** A frozen identity includes length and digest, not a trusted filename alone. */
function identity(value, maximum) {
  exact(value, ["path", "bytes", "sha256"], "execution-identity");
  requireValue(typeof value.path === "string" && path.isAbsolute(value.path), "execution-identity-path");
  integer(value.bytes, 1, maximum, "execution-identity-size");
  requireValue(HASH.test(value.sha256), "execution-identity-sha256");
}

/** Validate the immutable plan, retaining dynamic history as an explicit dependency on a prior real turn. */
function validateRequest(value) {
  exact(value, ["schema", "sourceCommit", "operationId", "compositionId", "compositionRoot", "members",
    "tools", "policy", "cases", "browserViewports", "totalDeadlineMilliseconds", "outputDirectory"], "execution-fields");
  requireValue(value.schema === SCHEMA && /^[a-f0-9]{40}$/.test(value.sourceCommit) &&
    HASH.test(value.operationId) && !/^0+$/.test(value.operationId) && HASH.test(value.compositionId), "execution-identity");
  requireValue(typeof value.compositionRoot === "string" && typeof value.outputDirectory === "string", "execution-paths");
  requireValue(Array.isArray(value.members) && value.members.length === MEMBERS.length, "execution-members");
  value.members.forEach((member, index) => {
    exact(member, ["name", "bytes", "sha256"], "execution-member");
    requireValue(member.name === MEMBERS[index] && HASH.test(member.sha256), "execution-member");
    integer(member.bytes, 1, [0x80000000, 0x4000000, 0x100000, 65800, 512, 896][index], "execution-member-size");
    if (index >= 3) requireValue(member.bytes === [65800, 512, 896][index - 3], "execution-member-size");
  });
  exact(value.tools, ["dotnet", "native", "browser", "managed", "assets"], "execution-tools");
  for (const key of ["dotnet", "native", "browser"]) identity(value.tools[key], 512 * 1024 * 1024);
  for (const [key, names] of [["managed", MANAGED], ["assets", ASSETS]]) {
    requireValue(Array.isArray(value.tools[key]) && value.tools[key].length === names.length, "execution-tool-closure");
    value.tools[key].forEach((item, index) => {
      identity(item, 64 * 1024 * 1024);
      requireValue(key === "assets" ? path.resolve(item.path) === path.join(ROOT, "tinyrustlm", names[index]) :
        path.basename(item.path) === names[index] && path.dirname(item.path) === path.dirname(value.tools.managed[0].path),
      "execution-tool-path");
    });
  }
  exact(value.policy, runtimeClient.POLICY_FIELDS, "execution-policy");
  for (const field of runtimeClient.POLICY_FIELDS) integer(value.policy[field], 1, 0xffffffff, "execution-policy");
  requireValue(value.policy.maximumModelBytes >= value.members[0].bytes && value.policy.maximumModelBytes <= 0x80000000 &&
    value.policy.maximumSequenceTokens <= 40960 && value.policy.maximumKvBytes <= 0x80000000 &&
    value.policy.maximumScratchBytes <= 0x40000000 && value.policy.maximumResolvedMemberBytes <= 0x88000000 &&
    value.policy.maximumResolvedMemberBytes >= value.members.slice(0, 5).reduce((n, item) => n + item.bytes, 0) &&
    value.policy.maximumResidentDependencyBytes <= 0x08000000 &&
    value.policy.maximumResidentDependencyBytes >= value.members.slice(1, 5).reduce((n, item) => n + item.bytes, 0) &&
    value.policy.maximumRequestBytes === 1054848 && value.policy.maximumLinearMemoryBytes <= 0xc0000000 &&
    value.policy.maximumLinearMemoryBytes % 65536 === 0, "execution-policy");
  requireValue(value.policy.maximumModelBytes + value.policy.maximumResidentDependencyBytes <= value.policy.maximumResolvedMemberBytes &&
    2 * value.policy.maximumModelBytes + value.policy.maximumKvBytes + value.policy.maximumScratchBytes +
      value.policy.maximumResidentDependencyBytes + value.policy.maximumRequestBytes <= value.policy.maximumLinearMemoryBytes,
  "execution-policy");
  requireValue(Array.isArray(value.cases) && value.cases.length > 0 && value.cases.length <= 32, "execution-cases");
  const seen = new Map();
  value.cases.forEach((item) => {
    exact(item, ["id", "conversation", "historyFrom", "messages", "sampling", "seed", "transcriptRevision",
      "resetBefore", "cancelAfterSteps", "deadlineMilliseconds"], "execution-case");
    requireValue(ID.test(item.id) && ID.test(item.conversation) && !seen.has(item.id) &&
      typeof item.resetBefore === "boolean", "execution-case");
    integer(item.transcriptRevision, 0, Number.MAX_SAFE_INTEGER, "execution-revision");
    integer(item.deadlineMilliseconds, 1000, 600000, "execution-deadline");
    if (item.cancelAfterSteps !== null) integer(item.cancelAfterSteps, 0, 4096, "execution-cancel");
    requireValue(typeof item.seed === "string" && item.sampling.temperatureMillionths === 0 &&
      item.sampling.topK === 1 && item.sampling.topPMillionths === 1000000, "execution-greedy");
    encodeRequest({ messages: item.messages, sampling: item.sampling, seed: item.seed });
    if (item.historyFrom !== null) {
      const prior = seen.get(item.historyFrom);
      requireValue(prior && prior.conversation === item.conversation && !item.resetBefore &&
        item.messages.length === 1 && item.messages[0].role === "user" &&
        item.transcriptRevision > prior.transcriptRevision, "execution-history");
    }
    seen.set(item.id, item);
  });
  requireValue(Array.isArray(value.browserViewports) && value.browserViewports.length >= 1 && value.browserViewports.length <= 2,
    "execution-viewports");
  const viewportIds = new Set();
  value.browserViewports.forEach((item) => {
    exact(item, ["id", "width", "height", "isMobile"], "execution-viewport");
    requireValue(ID.test(item.id) && !viewportIds.has(item.id) && typeof item.isMobile === "boolean", "execution-viewport");
    integer(item.width, 320, 2560, "execution-viewport"); integer(item.height, 240, 1600, "execution-viewport");
    viewportIds.add(item.id);
  });
  integer(value.totalDeadlineMilliseconds, 1000, 12 * 3600000, "execution-total-deadline");
  return value;
}

/** Derive a wire only from frozen new messages and the exact captured prior assistant text. */
function caseRequest(item, records) {
  let messages = item.messages;
  if (item.historyFrom !== null) {
    const prior = records.find((record) => record.id === item.historyFrom);
    requireValue(prior && prior.capture.status === "captured" && typeof prior.capture.output.text === "string",
      "execution-history-unavailable");
    messages = [...prior.messages, { role: "assistant", content: prior.capture.output.text }, ...item.messages];
  }
  const wire = Buffer.from(encodeRequest({ messages, sampling: item.sampling, seed: item.seed }));
  return { id: item.id, messages, requestBytes: wire.length, requestSha256: sha256(wire),
    requestBase64: wire.toString("base64") };
}

/** Stream one exact ordinary file through a stable handle without copying model bytes to evidence. */
function verifyFile(item) {
  const before = fs.lstatSync(item.path, { bigint: true });
  requireValue(before.isFile() && !before.isSymbolicLink() && before.nlink === 1n && before.size === BigInt(item.bytes),
    "execution-file-identity");
  const fd = fs.openSync(item.path, "r");
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    requireValue(before.dev === opened.dev && before.ino === opened.ino, "execution-file-changed");
    const digest = crypto.createHash("sha256");
    const buffer = Buffer.alloc(Math.min(item.bytes, 1024 * 1024));
    let offset = 0;
    while (offset < item.bytes) {
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, item.bytes - offset), offset);
      requireValue(count > 0, "execution-file-short");
      digest.update(buffer.subarray(0, count)); offset += count;
    }
    const after = fs.fstatSync(fd, { bigint: true });
    const named = fs.lstatSync(item.path, { bigint: true });
    requireValue(after.size === before.size && after.mtimeNs === before.mtimeNs && after.ctimeNs === before.ctimeNs &&
      named.ino === before.ino && named.dev === before.dev && digest.digest("hex") === item.sha256,
    "execution-file-changed");
  } finally { fs.closeSync(fd); }
}

/** Keep raw evidence exclusively created; a repeated operation cannot overwrite its first attempt. */
function writeEvidence(directory, name, value) {
  fs.writeFileSync(path.join(directory, name), Buffer.isBuffer(value) ? value : Buffer.from(`${JSON.stringify(value, null, 2)}\n`),
    { flag: "wx" });
}

/** Suppress inherited Node injection/coverage; preserve the admitted caller's Windows/tool prerequisites. */
function childEnvironment() {
  const env = { ...process.env, NODE_OPTIONS: "", NODE_V8_COVERAGE: "", NODE_PATH: "",
    DOTNET_EnableDiagnostics: "0", DOTNET_CLI_TELEMETRY_OPTOUT: "1" };
  for (const name of Object.keys(env)) if (/^(CORECLR_|COR_|DOTNET_STARTUP_HOOKS|DOTNET_ADDITIONAL_DEPS|DOTNET_SHARED_STORE)/i.test(name)) delete env[name];
  return env;
}

/** Capture one SDK process with bounded line framing and no case retries. */
async function runNative(plan, directory) {
  const { maximumLinearMemoryBytes: _linear, ...policy } = plan.policy;
  const child = childProcess.spawn(plan.tools.dotnet.path, [plan.tools.managed[0].path], {
    cwd: ROOT, env: childEnvironment(), windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"]
  });
  const raw = [], errors = [], queue = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = Buffer.alloc(0), total = 0, stderrBytes = 0, ended = false, failure = null, waiter = null;
  const records = [];
  /** Wake the sole protocol reader on data, exit or framing failure. */
  function wake() { if (waiter) { const resolve = waiter; waiter = null; resolve(); } }
  child.stdout.on("data", (chunk) => {
    total += chunk.length;
    if (total > 16 * 1024 * 1024) { failure = new Error("execution-native-output-limit"); child.kill(); wake(); return; }
    raw.push(chunk); pending = Buffer.concat([pending, chunk]);
    for (;;) {
      const newline = pending.indexOf(10); if (newline < 0) break;
      const line = pending.subarray(0, newline); pending = pending.subarray(newline + 1);
      try { queue.push(JSON.parse(decoder.decode(line).replace(/\r$/, ""))); }
      catch (_) { failure = new Error("execution-native-json"); child.kill(); }
    }
    wake();
  });
  child.stderr.on("data", (chunk) => {
    const remaining = Math.max(0, 65536 - stderrBytes);
    errors.push(chunk.subarray(0, remaining)); stderrBytes += chunk.length;
    if (stderrBytes > 65536) { failure = new Error("execution-native-stderr-limit"); child.kill(); wake(); }
  });
  child.on("error", () => { failure = new Error("execution-native-launch"); wake(); });
  child.stdin.on("error", () => { failure = new Error("execution-native-input"); wake(); });
  const closed = new Promise((resolve) => child.on("close", (code, signal) => { ended = true; wake(); resolve({ code, signal }); }));
  const timeout = setTimeout(() => { failure = new Error("execution-native-deadline"); child.kill(); wake(); }, plan.totalDeadlineMilliseconds);
  /** Read exactly the next event; an early exit is a failure, never missing evidence treated as success. */
  async function next() {
    while (!queue.length && !ended && !failure) await new Promise((resolve) => { waiter = resolve; });
    if (failure) throw failure;
    requireValue(queue.length > 0, "execution-native-early-exit"); return queue.shift();
  }
  let terminal = null;
  try {
    child.stdin.write(`${JSON.stringify({ schema: "tinyrustlm.native-conversation-request/1", operationId: plan.operationId,
      nativePath: plan.tools.native.path, nativeSha256: plan.tools.native.sha256, compositionRoot: plan.compositionRoot,
      members: plan.members, policy, cases: plan.cases.map(({ id, transcriptRevision, resetBefore, cancelAfterSteps, deadlineMilliseconds }) =>
        ({ id, transcriptRevision, resetBefore, cancelAfterSteps, deadlineMilliseconds })) })}\n`);
    requireValue((await next()).kind === "ready", "execution-native-ready");
    for (const item of plan.cases) {
      const request = caseRequest(item, records);
      writeEvidence(directory, `native-${item.id}.request.json`, request);
      child.stdin.write(`${JSON.stringify({ id: item.id, requestBase64: request.requestBase64 })}\n`);
      const beginning = await next();
      let event = beginning;
      if (beginning.kind === "case-started") {
        requireValue(beginning.id === item.id, "execution-native-start");
        const caseTimeout = setTimeout(() => { failure = new Error("execution-native-case-deadline"); child.kill(); wake(); }, item.deadlineMilliseconds);
        try { event = await next(); } finally { clearTimeout(caseTimeout); }
      } else requireValue(beginning.kind === "case" && beginning.value.status === "failed", "execution-native-start");
      requireValue(event.kind === "case" && event.value.id === item.id, "execution-native-case");
      const record = { ...request, capture: event.value };
      records.push(record); writeEvidence(directory, `native-${item.id}.capture.json`, record);
      if (event.value.status !== "captured") break;
    }
    child.stdin.end();
    terminal = await next();
    requireValue(terminal.kind === "terminal" && terminal.value.modelQualified === false, "execution-native-terminal");
    const exit = await closed;
    requireValue(exit.signal === null && exit.code === (terminal.value.status === "captured" ? 0 : 1) &&
      queue.length === 0 && pending.length === 0, "execution-native-exit");
    return { ...terminal.value, records, exit };
  } finally {
    clearTimeout(timeout);
    if (!ended) { child.kill(); await closed; }
    writeEvidence(directory, "native.stdout.bin", Buffer.concat(raw));
    writeEvidence(directory, "native.stderr.bin", Buffer.concat(errors));
  }
}

/** Execute a real dedicated worker; no app admission, catalog, network peer or qualification is fabricated. */
async function runBrowser(plan, directory, viewport) {
  const { chromium } = require("@playwright/test");
  const owned = scratch.createOwnedTemporaryDirectory({ temporaryParent: path.join(ROOT, "artifacts/tests/real-composition-browser") });
  const token = crypto.randomBytes(16).toString("hex");
  const routes = new Map(plan.tools.assets.map((item, index) => [`/${token}/${ASSETS[index]}`, item]));
  plan.members.forEach((member, index) => routes.set(`/${token}/members/${index}`, { ...member, path: path.join(plan.compositionRoot, member.name) }));
  const html = Buffer.from(`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Local execution evidence</title><script src="/${token}/app/model-runtime-client.js"></script>`);
  let server, context, closed = false, base, deadline;
  const errors = [], records = [], activations = [];
  try {
    server = http.createServer((request, response) => {
      const item = routes.get(request.url);
      if (request.method !== "GET" || (request.url !== `/${token}/` && !item)) { response.writeHead(404); response.end(); return; }
      response.setHeader("Cache-Control", "no-store");
      if (!item) { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); return; }
      response.setHeader("Content-Length", item.bytes);
      response.setHeader("Content-Type", item.path.endsWith(".js") ? "text/javascript; charset=utf-8" : "application/octet-stream");
      const stream = fs.createReadStream(item.path, { start: 0, end: item.bytes - 1 });
      stream.on("error", () => response.destroy()); response.on("close", () => stream.destroy()); stream.pipe(response);
    });
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}/${token}/`;
    context = await chromium.launchPersistentContext(owned.rootPath, { executablePath: plan.tools.browser.path,
      headless: true, timeout: 30000, viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile, serviceWorkers: "block", acceptDownloads: false });
    deadline = setTimeout(() => { context.close().catch(() => {}); }, plan.totalDeadlineMilliseconds);
    await context.route("**/*", (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push({ kind: "pageerror", name: error.name }));
    await page.goto(base, { waitUntil: "load", timeout: 30000 });
    for (const item of plan.cases) {
      const request = caseRequest(item, records);
      writeEvidence(directory, `browser-${viewport.id}-${item.id}.request.json`, request);
      const value = await page.evaluate(browserCase, { plan, item, request, base });
      if (value.activation) activations.push(value.activation);
      const record = { ...request, capture: value.capture };
      records.push(record); writeEvidence(directory, `browser-${viewport.id}-${item.id}.capture.json`, record);
      if (value.capture.status !== "captured") break;
    }
    await page.evaluate(async () => { if (window.executionClient) await window.executionClient.release(); });
    return { schema: "tinyrustlm.browser-conversation-capture/1", modelQualified: false,
      status: errors.length === 0 && records.length === plan.cases.length && records.every((r) => r.capture.status === "captured") ? "captured" : "failed",
      browserVersion: context.browser().version(), viewport,
      activations, records, errors, processPeakMemory: "unmeasured", visibleStopButton: "not-exercised" };
  } finally {
    clearTimeout(deadline);
    if (context) { await context.close(); closed = true; } else closed = true;
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (closed) scratch.removeOwnedTemporaryDirectory(owned);
  }
}

/** Runs only inside the isolated page, through the unchanged production runtime client. */
async function browserCase({ plan, item, request, base }) {
        const api = window.TinyRustLMModelRuntimeClient;
        let activation = null, started = performance.now(), firstToken = null, cancelAt = null, timer;
        const steps = [];
        let phase = "activation";
        try {
        if (!window.executionClient || item.resetBefore) {
          if (window.executionClient) await window.executionClient.release();
          const started = performance.now();
          const wasm = await (await fetch(`${base}browser-runtime/tinyrustlm-browser-runtime.wasm`)).arrayBuffer();
          const client = api.createBrowserClient(`${base}app/model-runtime-worker.js`, item.deadlineMilliseconds);
          window.executionClient = client;
          await client.initialize({ operationId: plan.operationId, compositionId: plan.compositionId,
            wasmBytes: wasm, wasmSha256: plan.tools.assets[3].sha256, policy: plan.policy, transcriptRevision: 0 });
          const roles = ["model", "tokenizer", "template", "sampling", "prompt", "composition"];
          const artifacts = plan.members.map((member, index) => ({ role: roles[index], byteLength: member.bytes,
            chunks: { async *[Symbol.asyncIterator]() {
              const response = await fetch(`${base}members/${index}`);
              if (!response.ok || Number(response.headers.get("Content-Length")) !== member.bytes) throw new Error("execution-member-response");
              const reader = response.body.getReader();
              let transferred = 0;
              try { for (;;) { const chunk = await reader.read(); if (chunk.done) break;
                for (let offset = 0; offset < chunk.value.length; offset += api.MAXIMUM_BINARY_CHUNK_BYTES) {
                  const bytes = chunk.value.slice(offset, offset + api.MAXIMUM_BINARY_CHUNK_BYTES).buffer;
                  const length = bytes.byteLength;
                  yield { offset: transferred, bytes };
                  transferred += length;
                }
              } } finally { reader.releaseLock(); }
            } } }));
          const state = await client.activate(artifacts);
          activation = { elapsedMilliseconds: performance.now() - started, state };
        }
        const client = window.executionClient;
        const conversationId = await api.identityFromText("execution-conversation/1", `${plan.operationId}:${item.conversation}`);
        await client.setTranscript(item.transcriptRevision, conversationId);
        const promptRequest = Uint8Array.from(atob(request.requestBase64), (char) => char.charCodeAt(0)).buffer;
        const controller = new AbortController();
        started = performance.now();
        phase = "generation";
        if (item.cancelAfterSteps === 0) { cancelAt = performance.now(); controller.abort(); }
        timer = setTimeout(() => client.terminate("execution-browser-deadline"), item.deadlineMilliseconds);
          const output = await client.generate({ conversationId,
            turnId: await api.identityFromText("execution-turn/1", `${plan.operationId}:${item.id}`),
            generationId: await api.identityFromText("execution-generation/1", `${plan.operationId}:${item.id}`),
            promptRequest, signal: controller.signal, onStep: (step) => {
              const elapsed = performance.now() - started; steps.push({ elapsedMilliseconds: elapsed, step });
              if (step.emittedTokenId !== null && firstToken === null) firstToken = elapsed;
              if (item.cancelAfterSteps !== null && steps.length >= item.cancelAfterSteps && cancelAt === null) {
                cancelAt = performance.now(); controller.abort();
              }
            } });
          const elapsed = performance.now() - started;
          if (output.tokenIds.length > 0 && firstToken === null) firstToken = elapsed;
          return { activation, capture: { id: item.id, status: elapsed > item.deadlineMilliseconds ? "failed" : "captured",
            errorCode: elapsed > item.deadlineMilliseconds ? "execution-browser-deadline" : null,
            elapsedMilliseconds: elapsed, firstEmittedTokenMilliseconds: firstToken,
            cancellationRequested: cancelAt !== null, cancellationLatencyMilliseconds: cancelAt === null ? null : performance.now() - cancelAt,
            phase, steps, output } };
        } catch (error) {
          return { activation, capture: { id: item.id, status: "failed",
            errorCode: /^[a-z0-9-]{1,160}$/.test(error.code) ? error.code : "execution-browser-runtime",
            elapsedMilliseconds: performance.now() - started, firstEmittedTokenMilliseconds: firstToken,
            cancellationRequested: cancelAt !== null, cancellationLatencyMilliseconds: cancelAt === null ? null : performance.now() - cancelAt,
            phase, steps, output: null } };
        } finally { clearTimeout(timer); }
}

/** Freeze execution admission before reading any model payload or creating its one exclusive evidence directory. */
async function execute(plan) {
  // Own plain JSON before the first await; an API caller cannot swap a future turn or tool identity.
  plan = validateRequest(JSON.parse(JSON.stringify(plan)));
  requireValue(process.platform === "win32", "execution-windows-required");
  storage.requireModelOutputRoot(plan.compositionRoot);
  scratch.requireCanonicalArtifactPath(plan.outputDirectory);
  plan.tools.managed.forEach((item) => scratch.requireCanonicalArtifactPath(path.dirname(item.path)));
  scratch.requireCanonicalArtifactPath(path.dirname(plan.tools.native.path));
  const gate = childProcess.spawnSync(process.execPath, [path.join(__dirname, "verify-single-source-authority.js"),
    "--require-clean", "--require-remote-exact"], { cwd: ROOT, env: childEnvironment(), windowsHide: true,
    timeout: 120000, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  requireValue(gate.status === 0 && !gate.error, "execution-source-authority");
  const head = childProcess.spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, env: childEnvironment(), windowsHide: true,
    timeout: 10000, encoding: "utf8" });
  requireValue(head.status === 0 && head.stdout.trim() === plan.sourceCommit, "execution-source-commit");
  const identities = [...[plan.tools.dotnet, plan.tools.native, plan.tools.browser], ...plan.tools.managed, ...plan.tools.assets,
    ...plan.members.map((item) => ({ ...item, path: path.join(plan.compositionRoot, item.name) }))];
  identities.forEach(verifyFile);
  fs.mkdirSync(plan.outputDirectory);
  writeEvidence(plan.outputDirectory, "request.json", plan);
  const report = { schema: "tinyrustlm.real-composition-execution/1", status: "failed", modelQualified: false,
    requestSha256: sha256(Buffer.from(`${JSON.stringify(plan, null, 2)}\n`)), startedAtUtc: new Date().toISOString(),
    hardware: { platform: process.platform, architecture: process.arch, release: os.release(),
      cpuModel: os.cpus()[0]?.model ?? "unavailable", logicalProcessors: os.cpus().length,
      totalMemoryBytes: os.totalmem(), nodeVersion: process.version },
    native: null, browser: [], failures: [], finishedAtUtc: null };
  const deadline = Date.now() + plan.totalDeadlineMilliseconds;
  /** Every arm shares the same frozen operation deadline; none receives a hidden reset of its budget. */
  function remainingPlan() {
    const remaining = deadline - Date.now();
    requireValue(remaining > 0, "execution-total-deadline");
    return { ...plan, totalDeadlineMilliseconds: remaining };
  }
  try {
    try { report.native = await runNative(remainingPlan(), plan.outputDirectory); }
    catch (error) { report.failures.push({ stage: "native", code: /^execution-[a-z-]+$/.test(error.message) ? error.message : "execution-stage-failed" }); }
    for (const viewport of plan.browserViewports) try { report.browser.push(await runBrowser(remainingPlan(), plan.outputDirectory, viewport)); }
    catch (error) { report.failures.push({ stage: `browser-${viewport.id}`, code: /^execution-[a-z-]+$/.test(error.message) ? error.message : "execution-stage-failed" }); }
    identities.forEach(verifyFile);
    report.status = report.failures.length === 0 && report.native?.status === "captured" &&
      report.browser.length === plan.browserViewports.length && report.browser.every((value) => value.status === "captured")
      ? "captured-not-graded" : "failed";
  } catch (_) { report.failures.push({ stage: "readback", code: "execution-file-changed" }); }
  finally { report.finishedAtUtc = new Date().toISOString(); writeEvidence(plan.outputDirectory, "execution.json", report); }
  return report;
}

/** Explicit CLI only: no test, import, or tool discovery may start a model run. */
async function main() {
  requireValue(process.argv.length === 3, "execution-arguments");
  const file = path.resolve(process.argv[2]);
  scratch.requireCanonicalArtifactPath(path.dirname(file));
  const bytes = storage.readBoundedFile(file, 1024 * 1024);
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  requireValue(bytes.equals(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)), "execution-request-canonical");
  const report = await execute(value);
  process.stdout.write(`${JSON.stringify({ status: report.status, modelQualified: false })}\n`);
  if (report.status !== "captured-not-graded") process.exitCode = 1;
}

module.exports = Object.freeze({ SCHEMA, MEMBERS, ASSETS, MANAGED, validateRequest, caseRequest, verifyFile, runNative, runBrowser, browserCase, execute });
if (require.main === module) main().catch((error) => {
  process.stderr.write(`${/^execution-[a-z-]+$/.test(error.message) ? error.message : "execution-failed"}\n`); process.exitCode = 1;
});

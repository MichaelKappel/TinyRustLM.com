"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");

const launcher = require("../tools/interview-demo-launcher.js");
const demoServer = require("../tools/interview-demo-server.js");

const siteRoot = path.resolve(__dirname, "..");

// Select an explicit port for cases that exercise caller-specified bindings.
async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

// Produces the minimum exact ready UI-preflight child result.
function passingPreflightExecution() {
  const report = {
    schema: "tinyrustlm.interview_demo_preflight.v1",
    mode: "ui",
    status: "ready",
    ready: true,
    checks: ["source-authority", "static-shell", "deployment-closure", "browser-modules",
      "companion-modules", "stale-bridge"].map(id => ({ id, status: "pass", code: "ok" })),
    failureCodes: []
  };
  return {
    exitCode: 0,
    stderr: "fixture diagnostics are private",
    stdout: `${JSON.stringify(report)}\n`
  };
}

// Captures public stream writes and optionally observes each bounded write.
function capture(onWrite) {
  let text = "";
  return {
    read: () => text,
    stream: {
      write(chunk) {
        const value = String(chunk);
        text += value;
        if (onWrite) onWrite(value, text);
        return true;
      }
    }
  };
}

// Proves an owned loopback listener released its exact port.
async function assertPortReleased(port) {
  const rebound = net.createServer();
  try {
    await new Promise((resolve, reject) => {
      rebound.once("error", reject);
      rebound.listen(port, "127.0.0.1", resolve);
    });
  } finally {
    await new Promise((resolve, reject) =>
      rebound.close((error) => error ? reject(error) : resolve()));
  }
}

// Supplies existing-server dependencies that own no real listener or browser.
function fixtureServerOptions(sequence, port, overrides = {}) {
  return {
    async runUiPreflight({ argv }) {
      sequence.push("preflight");
      assert.deepEqual(argv, ["--ui"]);
      return passingPreflightExecution();
    },
    async startSourceServer(options) {
      sequence.push("start");
      assert.equal(options.port, port);
      return {
        origin: `http://127.0.0.1:${port}`,
        async close() {
          sequence.push("close");
        }
      };
    },
    async waitForHttpReadiness(origin) {
      sequence.push("http-ready");
      assert.equal(origin, `http://127.0.0.1:${port}`);
    },
    async waitForTermination() {
      sequence.push("wait-for-ctrl-c");
      return new Promise(resolve => setImmediate(() => resolve("SIGINT")));
    },
    ...overrides
  };
}

test("accepts only a free/default launch, explicit port, and no-browser mode", () => {
  assert.deepEqual(launcher.parseArguments([]), {
    browserEnabled: true,
    port: null
  });
  assert.deepEqual(launcher.parseArguments(["--no-browser"]), {
    browserEnabled: false,
    port: null
  });
  assert.deepEqual(launcher.parseArguments([
    "--port", "43127", "--no-browser"
  ]), {
    browserEnabled: false,
    port: 43127
  });
  assert.deepEqual(launcher.parseArguments([
    "--no-browser", "--port", "43127"
  ]), {
    browserEnabled: false,
    port: 43127
  });
  for (const argv of [
    ["--live-model"],
    ["--synthetic"],
    ["--port", "0"],
    ["--port", "1023"],
    ["--port", "65536"],
    ["--port"],
    ["--no-browser", "--no-browser"],
    ["--port", "43127", "--port", "43128"]
  ]) {
    assert.throws(() => launcher.parseArguments(argv), (error) =>
      error.code === launcher.ERROR_CODES.ARGUMENTS_INVALID, JSON.stringify(argv));
  }
});

test("opens the default browser only after existing HTTP readiness", async () => {
  const port = 43127;
  const sequence = [];
  const stdout = capture();
  const stderr = capture();
  const result = await launcher.runInterviewDemo({
    browserEnabled: true,
    openBrowser(url) {
      sequence.push("open-browser");
      assert.equal(url, `http://127.0.0.1:${port}/`);
    },
    port,
    serverOptions: fixtureServerOptions(sequence, port),
    siteRoot,
    stderr: stderr.stream,
    stdout: stdout.stream
  });

  assert.deepEqual(sequence, [
    "preflight",
    "start",
    "http-ready",
    "wait-for-ctrl-c",
    "open-browser",
    "close"
  ]);
  assert.deepEqual(result, {
    browserRequested: true,
    origin: `http://127.0.0.1:${port}`,
    port,
    signal: "SIGINT"
  });
  assert.match(stdout.read(), /Browser: request sent after loopback HTTP readiness\./u);
  assert.match(stdout.read(), /Synthetic P2P walkthrough: NOT RUN/u);
  assert.match(stdout.read(), /Live model: NOT CLAIMED/u);
  assert.doesNotMatch(stdout.read(), /live model: READY|synthetic.*(?:pass|ready)/iu);
  assert.match(stderr.read(), /UI preflight: READY/u);
});

test("no-browser fixture mode stays attached and closes without opening", async () => {
  const port = 43128;
  const sequence = [];
  const stdout = capture();
  let openCalls = 0;
  const result = await launcher.runInterviewDemo({
    browserEnabled: false,
    port,
    openBrowser() {
      openCalls += 1;
      throw new Error("CI must never open a browser");
    },
    serverOptions: fixtureServerOptions(sequence, port),
    siteRoot,
    stderr: capture().stream,
    stdout: stdout.stream
  });

  assert.equal(openCalls, 0);
  assert.deepEqual(sequence, [
    "preflight",
    "start",
    "http-ready",
    "wait-for-ctrl-c",
    "close"
  ]);
  assert.equal(result.browserRequested, false);
  assert.match(stdout.read(), /Browser: disabled by explicit --no-browser\./u);
});

test("CLI no-browser fixture mode cannot invoke the browser handler", async () => {
  const port = 43131;
  const sequence = [];
  let openCalls = 0;
  const exitCode = await launcher.runCli({
    argv: ["--no-browser", "--port", String(port)],
    openBrowser() {
      openCalls += 1;
      throw new Error("CI must never open a browser");
    },
    serverOptions: fixtureServerOptions(sequence, port),
    siteRoot,
    stderr: capture().stream,
    stdout: capture().stream
  });
  assert.equal(exitCode, 0);
  assert.equal(openCalls, 0);
  assert.deepEqual(sequence, [
    "preflight",
    "start",
    "http-ready",
    "wait-for-ctrl-c",
    "close"
  ]);
});

test("CI no-browser smoke releases its real listener and signal handlers", {
  timeout: 10_000
}, async () => {
  const port = await availablePort();
  const signalSource = new EventEmitter();
  let browserCalls = 0;
  let readinessShutdownScheduled = false;
  let watchdogFired = false;
  const stdout = capture((_chunk, output) => {
    if (!readinessShutdownScheduled &&
        output.includes("Browser: disabled by explicit --no-browser.")) {
      readinessShutdownScheduled = true;
      setImmediate(() => signalSource.emit("SIGINT"));
    }
  });
  const watchdog = setTimeout(() => {
    watchdogFired = true;
    signalSource.emit("SIGINT");
  }, 5_000);
  let result;
  try {
    result = await launcher.runInterviewDemo({
      browserEnabled: false,
      openBrowser() {
        browserCalls += 1;
        throw new Error("CI must never open a browser");
      },
      port,
      serverOptions: {
        async runUiPreflight({ argv }) {
          assert.deepEqual(argv, ["--ui"]);
          return passingPreflightExecution();
        },
        signalSource
      },
      siteRoot,
      stderr: capture().stream,
      stdout: stdout.stream
    });
  } finally {
    clearTimeout(watchdog);
  }

  assert.equal(watchdogFired, false);
  assert.equal(readinessShutdownScheduled, true);
  assert.equal(browserCalls, 0);
  assert.deepEqual(result, {
    browserRequested: false,
    origin: `http://127.0.0.1:${port}`,
    port,
    signal: "SIGINT"
  });
  assert.equal(signalSource.listenerCount("SIGINT"), 0);
  assert.equal(signalSource.listenerCount("SIGTERM"), 0);
  assert.match(stdout.read(), /Synthetic P2P walkthrough: NOT RUN/u);
  assert.match(stdout.read(), /Live model: NOT CLAIMED/u);
  assert.match(stdout.read(), /UI demo: STOPPED \(SIGINT\)/u);
  assert.doesNotMatch(stdout.read(), /live model: READY|synthetic.*(?:pass|ready)/iu);
  await assertPortReleased(port);
});

test("readiness failure never opens a browser and still closes the listener", async () => {
  const port = 43129;
  const sequence = [];
  let openCalls = 0;
  await assert.rejects(launcher.runInterviewDemo({
    browserEnabled: true,
    openBrowser() {
      openCalls += 1;
    },
    port,
    serverOptions: fixtureServerOptions(sequence, port, {
      async waitForHttpReadiness() {
        sequence.push("http-not-ready");
        throw new Error("fixture readiness failure");
      }
    }),
    siteRoot,
    stderr: capture().stream,
    stdout: capture().stream
  }), (error) => error.code === "demo_server_readiness_failed");
  assert.equal(openCalls, 0);
  assert.deepEqual(sequence, [
    "preflight", "start", "http-not-ready", "close"
  ]);
});

test("browser handoff failure closes the ready listener before reporting", async () => {
  const port = 43130;
  const sequence = [];
  await assert.rejects(launcher.runInterviewDemo({
    browserEnabled: true,
    openBrowser() {
      sequence.push("open-browser-failed");
      throw new launcher.InterviewDemoLauncherError(
        launcher.ERROR_CODES.BROWSER_OPEN_FAILED);
    },
    port,
    serverOptions: fixtureServerOptions(sequence, port),
    siteRoot,
    stderr: capture().stream,
    stdout: capture().stream
  }), (error) => error.code === launcher.ERROR_CODES.BROWSER_OPEN_FAILED);
  assert.deepEqual(sequence, [
    "preflight",
    "start",
    "http-ready",
    "wait-for-ctrl-c",
    "open-browser-failed",
    "close"
  ]);
});

test("default-browser handoff is shell-free and injectable in every platform", async () => {
  const url = "http://127.0.0.1:43127/";
  const expectedCommands = new Map([
    ["win32", "explorer.exe"],
    ["darwin", "open"],
    ["linux", "xdg-open"]
  ]);
  for (const [platform, expectedCommand] of expectedCommands) {
    const calls = [];
    await launcher.openDefaultBrowser(url, {
      execFile(command, arguments_, options, callback) {
        calls.push({ arguments_, command, options });
        setImmediate(() => callback(null));
      },
      platform
    });
    assert.equal(calls.length, 1, platform);
    assert.equal(calls[0].command, expectedCommand, platform);
    assert.deepEqual(calls[0].arguments_, [url], platform);
    assert.equal(calls[0].options.shell, false, platform);
    assert.equal(calls[0].options.windowsHide, true, platform);
    assert.equal(calls[0].options.maxBuffer, 16 * 1024, platform);
    assert.equal(calls[0].options.timeout, 10000, platform);
  }
  for (const unsafe of [
    "not a URL",
    "http://127.0.0.1/",
    "https://127.0.0.1:43127/",
    "http://localhost:43127/",
    "http://127.0.0.1:43127/path",
    "http://user@127.0.0.1:43127/"
  ]) {
    await assert.rejects(launcher.openDefaultBrowser(unsafe, {
      execFile() {
        throw new Error("must not execute");
      },
      platform: "win32"
    }), (error) => error.code === launcher.ERROR_CODES.READINESS_INVALID,
    unsafe);
  }
});

test("selects the actual listener port only after source preflight", async () => {
  const signals = new EventEmitter();
  let admitted = false;
  const result = await launcher.runInterviewDemo({ browserEnabled: false,
    stdout: capture((_chunk, output) => {
      if (output.includes("Browser: disabled")) setImmediate(() => signals.emit("SIGINT"));
    }).stream, stderr: capture().stream,
    serverOptions: {
      runUiPreflight: async () => { admitted = true; return passingPreflightExecution(); },
      startSourceServer: async options => {
        assert.equal(admitted, true);
        assert.equal(options.port, 0);
        return require("../tools/static-server.js").startSourceServer(options);
      }, signalSource: signals
    }
  });
  assert.ok(result.port >= 1024 && result.port <= 65535);
  assert.equal(result.origin, `http://127.0.0.1:${result.port}`);
  await assertPortReleased(result.port);
});

test("browser handoff waits asynchronously while the real local server answers", async (context) => {
  context.mock.method(childProcess, "execFileSync", () => { throw new Error("synchronous handoff is forbidden"); });
  const port = await availablePort();
  let child;
  let requestsSucceeded = false;
  const result = await launcher.runInterviewDemo({ port, siteRoot,
    stdout: capture().stream, stderr: capture().stream,
    serverOptions: { runUiPreflight: async () => passingPreflightExecution(),
      waitForTermination: () => new Promise(resolve => setTimeout(() => resolve("SIGINT"), 500)) },
    openBrowser: url => launcher.openDefaultBrowser(url, { platform: "win32",
      execFile(_command, args, options, callback) {
        assert.deepEqual(args, [url]);
        const script = "require('node:http').get(process.argv[1], r => { r.resume(); r.once('end', () => { if (r.statusCode !== 200) process.exitCode=2; }); }).on('error',()=>{process.exitCode=3;});";
        child = childProcess.execFile(process.execPath, ["-e", script, url], options,
          (error, stdout, stderr) => { requestsSucceeded = error === null; callback(error, stdout, stderr); });
        return child;
      }
    }) });
  assert.equal(result.browserRequested, true);
  assert.equal(requestsSucceeded, true);
  assert.equal(child.exitCode, 0);
  await assertPortReleased(port);
});

test("termination during browser handoff aborts it and releases the real listener", { timeout: 5000 }, async () => {
  const signals = new EventEmitter();
  const port = await availablePort();
  let observedAbort = false;
  const output = capture();
  const result = await launcher.runInterviewDemo({ port, siteRoot,
    stdout: output.stream, stderr: capture().stream,
    serverOptions: { runUiPreflight: async () => passingPreflightExecution(), signalSource: signals },
    async openBrowser(_url, { signal } = {}) {
      setImmediate(() => signals.emit("SIGTERM"));
      if (!signal) return;
      await new Promise(resolve => signal.addEventListener("abort", () => { observedAbort = true; resolve(); }, { once: true }));
    }
  });
  assert.equal(observedAbort, true);
  assert.equal(result.signal, "SIGTERM");
  assert.equal(result.browserRequested, false);
  assert.doesNotMatch(output.read(), /Browser: request sent/);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
  await assertPortReleased(port);
});

test("terminal prose cannot authorize a browser request without structured readiness", async () => {
  let opens = 0;
  await assert.rejects(launcher.runInterviewDemo({ port: 43127, siteRoot,
    stdout: capture().stream, stderr: capture().stream,
    openBrowser: () => { opens += 1; },
    runDemoServer: async ({ stdout }) => {
      stdout.write(demoServer.renderReadySummary("http://127.0.0.1:43127") + "\n");
      return { origin: "http://127.0.0.1:43127", signal: "SIGINT" };
    }
  }), error => error.code === launcher.ERROR_CODES.READINESS_INVALID);
  assert.equal(opens, 0);
});

test("alternate roots fail before source execution or browser activity", async () => {
  let calls = 0;
  await assert.rejects(launcher.runInterviewDemo({ siteRoot: path.join(siteRoot, "other"),
    runDemoServer: async () => { calls += 1; }, openBrowser: () => { calls += 1; }
  }), /canonical site root/);
  assert.equal(calls, 0);
});

test("a failed asynchronous handoff removes termination subscriptions", async () => {
  const signals = new EventEmitter();
  const port = await availablePort();
  const output = capture();
  const errors = capture();
  const result = await launcher.runCli({ argv: ["--port", String(port)],
    stdout: output.stream, stderr: errors.stream,
    serverOptions: { runUiPreflight: async () => passingPreflightExecution(), signalSource: signals },
    openBrowser: async () => { await new Promise(resolve => setImmediate(resolve)); throw new Error("private handoff failure"); }
  });
  assert.equal(result, 1);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
  assert.match(errors.read(), /interview_demo_browser_open_failed/);
  assert.doesNotMatch(errors.read(), /private handoff failure/);
  assert.doesNotMatch(output.read(), /Browser: request sent/);
  await assertPortReleased(port);
});

test("invalid browser budgets, platforms and prior cancellation start no child", async () => {
  let calls = 0;
  const execFile = () => { calls += 1; };
  for (const timeoutMilliseconds of [null, 0, -1, 1.5, NaN, Infinity, "10", 30001]) {
    await assert.rejects(launcher.openDefaultBrowser("http://127.0.0.1:43127/", { execFile, timeoutMilliseconds }),
      error => error.code === launcher.ERROR_CODES.BROWSER_OPEN_FAILED);
  }
  for (const extra of [{ platform: "unknown" }, { signal: {} }, { execFile: 1 }]) {
    await assert.rejects(launcher.openDefaultBrowser("http://127.0.0.1:43127/", { execFile, ...extra }),
      error => error.code === launcher.ERROR_CODES.BROWSER_OPEN_FAILED);
  }
  const controller = new AbortController(); controller.abort();
  await assert.rejects(launcher.openDefaultBrowser("http://127.0.0.1:43127/", { execFile, signal: controller.signal }));
  assert.equal(calls, 0);
});

test("a timed-out or cancelled real handoff child terminates", { timeout: 5000 }, async context => {
  for (const cancel of [false, true]) {
    await context.test(cancel ? "cancelled" : "timed out", async () => {
      let child;
      let closed;
      const controller = new AbortController();
      const operation = launcher.openDefaultBrowser("http://127.0.0.1:43127/", {
        timeoutMilliseconds: cancel ? 2000 : 80, signal: controller.signal,
        execFile(_command, _args, options, callback) {
          child = childProcess.execFile(process.execPath, ["-e", "setInterval(()=>{},1000)"], options, callback);
          closed = new Promise(resolve => child.once("close", resolve));
          if (cancel) child.once("spawn", () => controller.abort());
          return child;
        }
      });
      await assert.rejects(operation, error => error.code === launcher.ERROR_CODES.BROWSER_OPEN_FAILED);
      await closed;
      assert.ok(child.exitCode !== null || child.signalCode !== null);
    });
  }
});

test("package exposes one honest interview command and a no-browser check", () => {
  const packageDocument = JSON.parse(fs.readFileSync(
    path.join(siteRoot, "package.json"), "utf8"));
  assert.equal(packageDocument.scripts["demo:interview"],
    "node tools/interview-demo-launcher.js");
  assert.doesNotMatch(packageDocument.scripts["demo:interview"],
    /synthetic|live-model/iu);
  assert.equal(packageDocument.scripts["test:demo:interview:no-browser"],
    "node --test --test-concurrency=1 " +
    "tests/interview-demo-preflight.test.js " +
    "tests/interview-demo-server.test.js " +
    "tests/interview-demo-launcher.test.js");
  assert.doesNotMatch(
    packageDocument.scripts["test:demo:interview:no-browser"],
    /synthetic|--live-model|tools\/interview-demo-launcher\.js/iu);
});

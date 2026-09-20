"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");

const demo = require("../tools/interview-demo-server.js");
const preflight = require("../tools/interview-demo-preflight.js");

const siteRoot = path.resolve(__dirname, "..");
const uiChecks = [
  ["source-authority", "demo_source_authority_failed"],
  ["static-shell", "demo_static_shell_failed"],
  ["deployment-closure", "demo_deployment_closure_failed"],
  ["browser-modules", "demo_browser_modules_missing"],
  ["companion-modules", "demo_companion_modules_missing"],
  ["stale-bridge", "demo_stale_bridge_path_present"]
];

// Build an independently declared complete report with selected check failures.
function report(options = {}) {
  const failureCodes = options.failureCodes || [];
  const ready = failureCodes.length === 0;
  return {
    schema: "tinyrustlm.interview_demo_preflight.v1",
    mode: "ui",
    status: ready ? "ready" : "blocked",
    ready,
    checks: uiChecks.map(([id, code], index) => ({
      id,
      status: failureCodes.includes("demo_source_authority_failed") && index > 0
        ? "skipped" : failureCodes.includes(code) ? "fail" : "pass",
      code: failureCodes.includes("demo_source_authority_failed") && index > 0
        ? "demo_source_authority_failed" : failureCodes.includes(code) ? code : "ok"
    })),
    failureCodes
  };
}

// Serialize the public report while retaining untrusted child diagnostics.
function execution(value) {
  return {
    exitCode: value.ready ? 0 : 1,
    stdout: `${JSON.stringify(value)}\n`,
    stderr: "private child diagnostics must not be forwarded"
  };
}

// Capture output and optionally notify lifecycle assertions after each write.
function capture(onWrite) {
  let value = "";
  return {
    stream: {
      write(chunk) {
        value += String(chunk);
        if (onWrite) onWrite(value);
      }
    },
    read: () => value
  };
}

// Match stable typed failures without accepting unrelated thrown errors.
function errorCode(code) {
  return (error) => error instanceof demo.DemoServerError && error.code === code;
}

// Obtain and release an OS-assigned loopback port for real listener checks.
async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : null;
  await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()));
  assert.ok(Number.isInteger(port));
  return port;
}

test("accepts only the default or an explicit unprivileged loopback port", () => {
  assert.deepEqual(demo.parseArguments([]), { port: demo.DEFAULT_PORT });
  assert.deepEqual(demo.parseArguments(["--port", "43127"]), { port: 43127 });
  for (const argv of [
    ["--live-model"],
    ["--ui"],
    ["--port"],
    ["--port", "0"],
    ["--port", "1023"],
    ["--port", "65536"],
    ["--port", "43127", "extra"]
  ]) {
    assert.throws(
      () => demo.parseArguments(argv),
      errorCode(demo.ERROR_CODES.ARGUMENTS_INVALID),
      JSON.stringify(argv)
    );
  }
});

test("a blocked real UI-preflight result prevents all server startup and shows every blocker", async () => {
  const stdout = capture();
  const stderr = capture();
  let starts = 0;
  const blocked = report({
    failureCodes: [
      "demo_static_shell_failed",
      "demo_deployment_closure_failed"
    ]
  });

  await assert.rejects(
    demo.runDemoServer({
      port: 43127,
      siteRoot,
      stdout: stdout.stream,
      stderr: stderr.stream,
      runUiPreflight: async ({ argv }) => {
        assert.deepEqual(argv, ["--ui"]);
        return execution(blocked);
      },
      startSourceServer: async () => {
        starts += 1;
        throw new Error("must not start");
      }
    }),
    errorCode(demo.ERROR_CODES.PREFLIGHT_BLOCKED)
  );

  assert.equal(starts, 0);
  assert.equal(stdout.read(), "");
  assert.match(stderr.read(), /UI preflight: BLOCKED/u);
  assert.match(stderr.read(), /demo_static_shell_failed/u);
  assert.match(stderr.read(), /demo_deployment_closure_failed/u);
  assert.doesNotMatch(stderr.read(), /private child diagnostics/u);
});

test("malformed preflight blocker text is rejected instead of reaching public output", async () => {
  const stdout = capture();
  const stderr = capture();
  const malformed = report({ failureCodes: ["E:\\private\\operator"] });
  let starts = 0;

  await assert.rejects(
    demo.runDemoServer({
      port: 43127,
      siteRoot,
      stdout: stdout.stream,
      stderr: stderr.stream,
      runUiPreflight: async () => execution(malformed),
      startSourceServer: async () => {
        starts += 1;
      }
    }),
    errorCode(demo.ERROR_CODES.PREFLIGHT_UNAVAILABLE)
  );

  assert.equal(starts, 0);
  assert.equal(stdout.read(), "");
  assert.equal(stderr.read(), "");
});

test("source-failed skipped checks remain a valid blocked report", () => {
  const blocked = report({ failureCodes: ["demo_source_authority_failed"] });
  assert.deepEqual(demo.normalizePreflightExecution(execution(blocked)).report, blocked);
});

test("incomplete and contradictory preflight reports cannot admit startup", async (context) => {
  const mutations = [
    ["missing checks", r => { r.checks = r.checks.slice(0, 1); }],
    ["duplicate check", r => { r.checks[1] = r.checks[0]; }],
    ["reordered checks", r => { r.checks.reverse(); }],
    ["unknown check", r => { r.checks[2].id = "unknown"; }],
    ["extra check field", r => { r.checks[1].note = "ignored"; }],
    ["extra report field", r => { r.secret = "unapproved"; }],
    ["wrong schema", r => { r.schema += "-old"; }],
    ["wrong mode", r => { r.mode = "live-model"; }],
    ["pass with failure code", r => { r.checks[2].code = uiChecks[2][1]; }],
    ["undisclosed failure", r => { r.checks[1].status = "fail"; r.checks[1].code = uiChecks[1][1]; }],
    ["failure without check", r => { r.failureCodes = [uiChecks[2][1]]; r.ready = false; r.status = "blocked"; }],
    ["unsanctioned skip", r => { r.checks[2].status = "skipped"; }],
    ["ready flag contradicts checks", r => { r.ready = false; }],
    ["status contradicts checks", r => { r.status = "blocked"; }],
    ["arguments-mode ready", r => { r.mode = null; }]
  ];
  for (const [name, mutate] of mutations) {
    await context.test(name, () => {
      const malformed = report(); mutate(malformed);
      assert.throws(() => demo.normalizePreflightExecution(execution(malformed)),
        errorCode(demo.ERROR_CODES.PREFLIGHT_UNAVAILABLE));
    });
  }
  const blocked = report({ failureCodes: [uiChecks[0][1]] });
  blocked.checks[1] = { id: uiChecks[1][0], status: "pass", code: "ok" };
  assert.throws(() => demo.normalizePreflightExecution(execution(blocked)),
    errorCode(demo.ERROR_CODES.PREFLIGHT_UNAVAILABLE));
  const contradiction = execution(report()); contradiction.exitCode = 1;
  assert.throws(() => demo.normalizePreflightExecution(contradiction),
    errorCode(demo.ERROR_CODES.PREFLIGHT_UNAVAILABLE));
  const valid = execution(report());
  for (const stdout of [valid.stdout.replace('"ready":true', '"ready":false,"ready":true'),
    "\uFEFF" + valid.stdout, valid.stdout + "{}\n", " ".repeat(128 * 1024 + 1)]) {
    assert.throws(() => demo.normalizePreflightExecution({ ...valid, stdout }),
      errorCode(demo.ERROR_CODES.PREFLIGHT_UNAVAILABLE));
  }
});

test("actual producer reports pass through the consumer without weakened fixtures", async () => {
  const dependencies = Object.fromEntries(preflight.UI_CHECKS.map(check => [check.dependency, () => true]));
  for (const sourcePassed of [true, false]) {
    const produced = await preflight.runPreflight({ mode: preflight.MODES.UI,
      dependencies: { ...dependencies, verifyCanonicalSource: () => sourcePassed } });
    assert.deepEqual(demo.normalizePreflightExecution(execution(produced)).report, produced);
  }
  let invalidOutput = "";
  await preflight.runCli({ argv: ["--invalid"], stdout: { write: chunk => { invalidOutput += chunk; } },
    stderr: { write() {} } });
  assert.equal(demo.normalizePreflightExecution({ exitCode: 1, stdout: invalidOutput, stderr: "" }).report.ready, false);
});

test("default preflight refuses alternate source roots before starting a child", (context) => {
  let started = false;
  context.mock.method(childProcess, "execFile", () => { started = true; });
  assert.throws(() => demo.runUiPreflight({ siteRoot: path.join(siteRoot, "alternate") }),
    /canonical site root/);
  assert.equal(started, false);
});

test("a continuously streaming readiness body cannot extend the deadline", async (context) => {
  let requests = 0;
  let ticks = 0;
  const timers = new Set();
  const server = http.createServer((_request, response) => {
    requests += 1;
    response.writeHead(200, { "content-type": "text/html" });
    response.write("<html>");
    const interval = setInterval(() => { ticks += 1; response.write(" "); }, 5);
    const ending = setTimeout(() => response.end("</html>"), 500);
    timers.add(interval); timers.add(ending);
    response.once("close", () => { clearInterval(interval); clearTimeout(ending); });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(async () => {
    for (const timer of timers) { clearInterval(timer); clearTimeout(timer); }
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await assert.rejects(demo.waitForHttpReadiness(origin, { timeoutMilliseconds: 100 }),
    errorCode(demo.ERROR_CODES.READINESS_FAILED));
  assert.ok(ticks > 0);
  assert.equal(requests, 1);
});

test("readiness rejects incomplete or wrong responses and accepts recovery", async (context) => {
  for (const behavior of ["status", "content-type", "aborted", "stalled", "recovery"]) {
    await context.test(behavior, async (child) => {
      let requests = 0;
      let completed = 0;
      const server = http.createServer((_request, response) => {
        requests += 1;
        if (behavior === "recovery" && requests > 1) {
          completed += 1;
          response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          response.end("<html>ready</html>");
        } else if (behavior === "content-type") {
          response.writeHead(200, { "content-type": "application/json" });
          response.end("{}");
        } else if (behavior === "aborted") {
          response.writeHead(200, { "content-type": "text/html", "content-length": "100" });
          response.write("<html>");
          setImmediate(() => response.destroy());
        } else if (behavior === "stalled") {
          // The peer sends no headers or body; the absolute timer must close it.
        } else {
          response.writeHead(503, { "content-type": "text/html" });
          response.end("unavailable");
        }
      });
      await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
      child.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      });
      const origin = `http://127.0.0.1:${server.address().port}`;
      if (behavior === "recovery") {
        assert.equal(await demo.waitForHttpReadiness(origin, { timeoutMilliseconds: 1000 }), true);
        assert.equal(requests, 2);
        assert.equal(completed, 1);
      } else {
        await assert.rejects(demo.waitForHttpReadiness(origin, { timeoutMilliseconds: 150 }),
          errorCode(demo.ERROR_CODES.READINESS_FAILED));
        assert.ok(requests > 0);
        assert.equal(completed, 0);
      }
    });
  }
});

test("refused connections expire without unhandled socket errors", async () => {
  const port = await availablePort();
  await assert.rejects(demo.waitForHttpReadiness(`http://127.0.0.1:${port}`, { timeoutMilliseconds: 50 }),
    errorCode(demo.ERROR_CODES.READINESS_FAILED));
});

test("invalid readiness budgets and nonlocal origins cannot start requests", async (context) => {
  let requests = 0;
  context.mock.method(http, "get", () => { requests += 1; throw new Error("must not request"); });
  for (const timeoutMilliseconds of [null, 0, -1, 1.5, NaN, Infinity, "100", 30001]) {
    await assert.rejects(demo.waitForHttpReadiness("http://127.0.0.1:43127", { timeoutMilliseconds }),
      errorCode(demo.ERROR_CODES.READINESS_FAILED));
  }
  for (const origin of ["not a URL", "https://127.0.0.1:43127", "http://localhost:43127",
    "http://example.com:43127", "http://127.0.0.1:80", "http://127.0.0.1:43127/path",
    "http://127.0.0.1:43127/?query", "http://127.0.0.1:43127/#hash", "http://user@127.0.0.1:43127"]) {
    await assert.rejects(demo.waitForHttpReadiness(origin), errorCode(demo.ERROR_CODES.READINESS_FAILED));
  }
  assert.equal(requests, 0);
});

test("real producer source refusal prevents server creation through the CLI", async () => {
  const blocked = await preflight.runPreflight({ mode: preflight.MODES.UI,
    dependencies: { verifyCanonicalSource: () => false } });
  const stdout = capture();
  const stderr = capture();
  let starts = 0;
  assert.equal(await demo.runCli({ argv: ["--port", "43127"], stdout: stdout.stream,
    stderr: stderr.stream, runUiPreflight: async () => execution(blocked),
    startSourceServer: async () => { starts += 1; } }), 1);
  assert.equal(starts, 0);
  assert.equal(stdout.read(), "");
  assert.match(stderr.read(), /demo_source_authority_failed/);
  assert.match(stderr.read(), /demo_server_ui_preflight_blocked/);
  assert.doesNotMatch(stderr.read(), /preflight_unavailable|private child/);
});

test("starts only after UI preflight, probes HTTP, stays foreground, and closes on termination", async () => {
  const stdout = capture();
  const stderr = capture();
  const sequence = [];
  let closeCalls = 0;
  const result = await demo.runDemoServer({
    port: 43127,
    siteRoot,
    stdout: stdout.stream,
    stderr: stderr.stream,
    runUiPreflight: async ({ argv }) => {
      sequence.push("preflight");
      assert.deepEqual(argv, ["--ui"]);
      return execution(report());
    },
    startSourceServer: async ({ port }) => {
      sequence.push("start");
      assert.equal(port, 43127);
      return {
        origin: "http://127.0.0.1:43127",
        async close() {
          sequence.push("close");
          closeCalls += 1;
        }
      };
    },
    waitForHttpReadiness: async (origin) => {
      sequence.push("ready");
      assert.equal(origin, "http://127.0.0.1:43127");
    },
    waitForTermination: async () => {
      sequence.push("wait");
      return "SIGINT";
    }
  });

  assert.deepEqual(sequence, ["preflight", "start", "ready", "wait", "close"]);
  assert.equal(closeCalls, 1);
  assert.deepEqual(result, {
    origin: "http://127.0.0.1:43127",
    signal: "SIGINT"
  });
  assert.match(stderr.read(), /UI preflight: READY/u);
  assert.match(stdout.read(), /URL: http:\/\/127\.0\.0\.1:43127\//u);
  assert.match(stdout.read(), /READY does not cover catalog qualification, P2P reachability, or deployment/u);
  assert.match(stdout.read(), /Catalog entries and peer announcements are metadata/u);
  assert.match(stdout.read(),
    /No model is bundled, injected, downloaded, activated, or run/u);
  assert.match(stdout.read(), /Live-model readiness: NOT CLAIMED/u);
  assert.match(stdout.read(),
    /npm --prefix \.\\tinyrustlm run demo:preflight:live/u);
  assert.match(stdout.read(), /separate BLOCKED report/u);
  assert.doesNotMatch(stdout.read(), /live-model readiness: READY/iu);
});

test("a readiness failure closes the source server without printing a ready URL", async () => {
  const stdout = capture();
  let closeCalls = 0;
  await assert.rejects(
    demo.runDemoServer({
      port: 43127,
      siteRoot,
      stdout: stdout.stream,
      stderr: capture().stream,
      runUiPreflight: async () => execution(report()),
      startSourceServer: async () => ({
        origin: "http://127.0.0.1:43127",
        async close() {
          closeCalls += 1;
        }
      }),
      waitForHttpReadiness: async () => {
        throw new Error("private readiness detail");
      }
    }),
    errorCode(demo.ERROR_CODES.READINESS_FAILED)
  );

  assert.equal(closeCalls, 1);
  assert.equal(stdout.read(), "");
});

test("termination waiting removes both signal handlers after the first signal", async () => {
  const signals = new EventEmitter();
  const waiting = demo.waitForTermination(signals);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  assert.equal(signals.listenerCount("SIGTERM"), 1);

  signals.emit("SIGTERM");
  assert.equal(await waiting, "SIGTERM");
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("the real source server becomes HTTP-ready and releases its explicit port", async () => {
  const port = await availablePort();
  const stdout = capture();
  const result = await demo.runDemoServer({
    port,
    siteRoot,
    stdout: stdout.stream,
    stderr: capture().stream,
    runUiPreflight: async () => execution(report()),
    waitForTermination: async () => "SIGTERM"
  });

  assert.equal(result.origin, `http://127.0.0.1:${port}`);
  assert.match(stdout.read(), new RegExp(`URL: http://127\\.0\\.0\\.1:${port}/`, "u"));

  const rebound = net.createServer();
  try {
    await new Promise((resolve, reject) => {
      rebound.once("error", reject);
      rebound.listen(port, "127.0.0.1", resolve);
    });
  } finally {
    await new Promise((resolve) => rebound.close(resolve));
  }
});

test("the launcher rejects live-model mode and points to its blocker-reporting preflight", async () => {
  const stderr = capture();
  const exitCode = await demo.runCli({
    argv: ["--live-model"],
    stderr: stderr.stream
  });

  assert.equal(exitCode, 1);
  assert.match(stderr.read(), /demo_server_arguments_invalid/u);
  assert.match(stderr.read(),
    /npm --prefix \.\\tinyrustlm run demo:start/u);
  assert.match(stderr.read(),
    /npm --prefix \.\\tinyrustlm run demo:preflight:live/u);
  assert.doesNotMatch(stderr.read(), /live-model readiness: READY/iu);
});

test("the package launcher exposes only the UI demo command", () => {
  const packageDocument = JSON.parse(fs.readFileSync(
    path.join(siteRoot, "package.json"),
    "utf8"
  ));
  assert.equal(
    packageDocument.scripts["demo:start"],
    "node tools/interview-demo-server.js"
  );
  assert.doesNotMatch(packageDocument.scripts["demo:start"], /live-model|model(?:=|\s)/iu);
});

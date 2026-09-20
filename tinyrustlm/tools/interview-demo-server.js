#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const { startSourceServer } = require("./static-server.js");
const preflight = require("./interview-demo-preflight.js");
const { parseStrictJson } = require("./strict-json.js");
const { requireCanonicalSiteRoot } = require("./canonical-operation-scratch.js");

const DEFAULT_PORT = 8187;
const MINIMUM_PORT = 1024;
const MAXIMUM_PORT = 65535;
const PREFLIGHT_TIMEOUT_MILLISECONDS = 45_000;
const READINESS_TIMEOUT_MILLISECONDS = 5_000;
const REQUEST_TIMEOUT_MILLISECONDS = 1_000;
const MAXIMUM_PREFLIGHT_OUTPUT_BYTES = 128 * 1024;
const ERROR_CODES = Object.freeze({
  ARGUMENTS_INVALID: "demo_server_arguments_invalid",
  PREFLIGHT_UNAVAILABLE: "demo_server_ui_preflight_unavailable",
  PREFLIGHT_BLOCKED: "demo_server_ui_preflight_blocked",
  SERVER_FAILED: "demo_server_start_failed",
  READINESS_FAILED: "demo_server_readiness_failed"
});

class DemoServerError extends Error {
  // Carry only a stable public-safe failure code across the CLI boundary.
  constructor(code) {
    super(code);
    this.name = "DemoServerError";
    this.code = code;
  }
}

// Stop the current operation with a typed public failure.
function reject(code) {
  throw new DemoServerError(code);
}

// Exclude arrays and non-record objects from process-result admission.
function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Restrict binding to an explicit unprivileged TCP port.
function normalizePort(value) {
  const port = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(port) || port < MINIMUM_PORT || port > MAXIMUM_PORT) {
    reject(ERROR_CODES.ARGUMENTS_INVALID);
  }
  return port;
}

// Accept only the UI server's optional port argument.
function parseArguments(argv) {
  if (!Array.isArray(argv)) reject(ERROR_CODES.ARGUMENTS_INVALID);
  if (argv.length === 0) return Object.freeze({ port: DEFAULT_PORT });
  if (argv.length !== 2 || argv[0] !== "--port" ||
      !/^[1-9][0-9]{0,4}$/u.test(String(argv[1]))) {
    reject(ERROR_CODES.ARGUMENTS_INVALID);
  }
  return Object.freeze({ port: normalizePort(Number(argv[1])) });
}

// Admit the complete current producer contract, including prerequisite skips.
function parsePreflightReport(stdout) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout, "utf8") < 1 ||
      Buffer.byteLength(stdout, "utf8") > MAXIMUM_PREFLIGHT_OUTPUT_BYTES) {
    reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
  }
  const lines = stdout.replace(/\r?\n$/u, "").split(/\r?\n/u);
  if (lines.length !== 1) reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
  let report;
  try {
    report = parseStrictJson(Buffer.from(lines[0], "utf8"), {
      maximumBytes: MAXIMUM_PREFLIGHT_OUTPUT_BYTES, maximumDepth: 8,
      maximumTotalEntries: 128, maximumObjectMembers: 8, maximumArrayItems: 32,
      maximumStringCodeUnits: 128, maximumTotalStringCodeUnits: 4096
    });
  } catch (_error) {
    reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
  }
  if (!hasExactKeys(report, ["schema", "mode", "status", "ready", "checks", "failureCodes"]) ||
      report.schema !== preflight.SCHEMA || !Array.isArray(report.checks) ||
      !Array.isArray(report.failureCodes) || typeof report.ready !== "boolean" ||
      !["ready", "blocked"].includes(report.status)) {
    reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
  }
  if (report.mode === null) {
    const check = report.checks[0];
    if (report.checks.length !== 1 ||
        !hasExactKeys(check, ["id", "status", "code"]) ||
        check.id !== "arguments" || check.status !== "fail" ||
        ![preflight.FAILURE_CODES.ARGUMENTS_INVALID, preflight.FAILURE_CODES.PREFLIGHT_FAILED]
          .includes(check.code)) reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
  } else {
    if (report.mode !== preflight.MODES.UI || report.checks.length !== preflight.UI_CHECKS.length) {
      reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
    }
    const sourceFailed = report.checks[0]?.status === "fail";
    for (const [index, definition] of preflight.UI_CHECKS.entries()) {
      const check = report.checks[index];
      const skipped = index > 0 && sourceFailed;
      if (!hasExactKeys(check, ["id", "status", "code"]) || check.id !== definition.id ||
          (skipped ? check.status !== "skipped" : !["pass", "fail"].includes(check.status)) ||
          check.code !== (skipped ? preflight.FAILURE_CODES.SOURCE_AUTHORITY :
            check.status === "pass" ? "ok" : definition.failureCode)) {
        reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
      }
    }
  }
  const failures = [...new Set(report.checks.filter(check => check.status === "fail")
    .map(check => check.code))];
  const ready = report.checks.every(check => check.status === "pass");
  if (JSON.stringify(report.failureCodes) !== JSON.stringify(failures) ||
      report.ready !== ready || report.status !== (ready ? "ready" : "blocked")) {
    reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
  }
  return report;
}

// Require exact fields without accepting arrays, host objects or hidden extras.
function hasExactKeys(value, keys) {
  return isPlainObject(value) && Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key));
}

// Require the child exit status and complete structured report to agree.
function normalizePreflightExecution(value) {
  if (!isPlainObject(value) || !Number.isInteger(value.exitCode) ||
      typeof value.stdout !== "string" || typeof value.stderr !== "string" ||
      Buffer.byteLength(value.stderr, "utf8") > MAXIMUM_PREFLIGHT_OUTPUT_BYTES) {
    reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
  }
  const report = parsePreflightReport(value.stdout);
  if (value.exitCode !== (report.ready ? 0 : 1)) reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
  return Object.freeze({ exitCode: value.exitCode, report });
}

// Execute the canonical UI preflight with bounded time and output.
function runUiPreflight(options = {}) {
  const siteRoot = requireCanonicalSiteRoot(options.siteRoot || path.join(__dirname, ".."));
  const preflightPath = path.join(siteRoot, "tools", "interview-demo-preflight.js");
  const argv = options.argv || ["--ui"];
  if (!Array.isArray(argv) || argv.length !== 1 || argv[0] !== "--ui") {
    reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
  }
  return new Promise((resolve) => {
    childProcess.execFile(
      process.execPath,
      [preflightPath, "--ui"],
      {
        cwd: siteRoot,
        encoding: "utf8",
        maxBuffer: MAXIMUM_PREFLIGHT_OUTPUT_BYTES,
        timeout: PREFLIGHT_TIMEOUT_MILLISECONDS,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        resolve(Object.freeze({
          exitCode: error === null
            ? 0
            : (Number.isInteger(error.code) ? error.code : 1),
          stdout: typeof stdout === "string" ? stdout : "",
          stderr: typeof stderr === "string" ? stderr : ""
        }));
      }
    );
  });
}

// Render admitted codes, never the child's raw diagnostics or private paths.
function renderPreflightSummary(report) {
  const passed = report.checks.filter((check) =>
    check && check.status === "pass").length;
  const lines = [
    `TinyRustLM interview UI preflight: ${report.status.toUpperCase()} ` +
      `(${passed}/${report.checks.length} checks passed).`
  ];
  if (report.failureCodes.length > 0) {
    lines.push(`Blockers: ${report.failureCodes.join(", ")}.`);
  }
  return lines.join("\n");
}

// Bind readiness and displayed URLs to the requested local server only.
function normalizeLoopbackOrigin(value, expectedPort) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch (_error) {
    reject(ERROR_CODES.SERVER_FAILED);
  }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" ||
      url.username || url.password || url.search || url.hash ||
      url.pathname !== "/" || Number(url.port) !== expectedPort) {
    reject(ERROR_CODES.SERVER_FAILED);
  }
  return url.origin;
}

// Complete one bounded response; ongoing traffic cannot renew the absolute timer.
function requestReadiness(url, deadline) {
  return new Promise((resolve) => {
    let request;
    let response;
    let settled = false;
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      response?.destroy();
      request?.destroy();
      resolve(ready && performance.now() <= deadline);
    };
    const timer = setTimeout(() => finish(false), Math.max(0, deadline - performance.now()));
    try {
      request = http.get(url, { headers: { connection: "close" } }, (incoming) => {
        response = incoming;
        response.once("error", () => finish(false));
        response.once("aborted", () => finish(false));
        response.once("end", () => finish(response.complete === true));
        response.once("close", () => finish(false));
        const contentType = String(response.headers["content-type"] || "");
        if (settled || response.statusCode !== 200 || !/^text\/html(?:;|$)/iu.test(contentType)) {
          response.destroy();
          finish(false);
        } else {
          response.resume();
        }
      });
      request.once("error", () => finish(false));
    } catch (_error) {
      finish(false);
    }
  });
}

// Space attempts within the caller's remaining readiness budget.
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Retry complete HTML responses within one monotonic total deadline.
async function waitForHttpReadiness(origin, options = {}) {
  const timeoutMilliseconds = options.timeoutMilliseconds === undefined
    ? READINESS_TIMEOUT_MILLISECONDS
    : options.timeoutMilliseconds;
  if (!Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 ||
      timeoutMilliseconds > 30_000) {
    reject(ERROR_CODES.READINESS_FAILED);
  }
  const deadline = performance.now() + timeoutMilliseconds;
  let url;
  try {
    const expectedPort = normalizePort(new URL(origin).port);
    url = new URL("/", normalizeLoopbackOrigin(origin, expectedPort)).href;
  } catch (_error) {
    reject(ERROR_CODES.READINESS_FAILED);
  }
  do {
    if (await requestReadiness(
      url,
      Math.min(deadline, performance.now() + REQUEST_TIMEOUT_MILLISECONDS)
    )) return true;
    if (performance.now() >= deadline) break;
    await delay(Math.min(100, Math.max(1, deadline - performance.now())));
  } while (performance.now() < deadline);
  reject(ERROR_CODES.READINESS_FAILED);
}

// Observe one foreground termination signal and release both subscriptions.
function waitForTermination(signalSource = process) {
  if (!signalSource || typeof signalSource.once !== "function" ||
      typeof signalSource.removeListener !== "function") {
    reject(ERROR_CODES.SERVER_FAILED);
  }
  return new Promise((resolve) => {
    const finish = (signal) => {
      signalSource.removeListener("SIGINT", onInterrupt);
      signalSource.removeListener("SIGTERM", onTerminate);
      resolve(signal);
    };
    const onInterrupt = () => finish("SIGINT");
    const onTerminate = () => finish("SIGTERM");
    signalSource.once("SIGINT", onInterrupt);
    signalSource.once("SIGTERM", onTerminate);
  });
}

// Describe local shell readiness without making a model or deployment claim.
function renderReadySummary(origin) {
  return [
    "TinyRustLM interview UI demo: READY.",
    `URL: ${origin}/`,
    "Scope: canonical local UI shell and loopback HTTP only.",
    "READY does not cover catalog qualification, P2P reachability, or deployment.",
    "Catalog entries and peer announcements are metadata; no model bytes, execution, or external peer are proved.",
    "No model is bundled, injected, downloaded, activated, or run by this launcher.",
    "Live-model readiness: NOT CLAIMED. From the repository root run `npm --prefix .\\tinyrustlm run demo:preflight:live` to see the separate BLOCKED report.",
    "Press Ctrl+C to stop."
  ].join("\n");
}

// Admit preflight, own the local server, and close it on every post-start exit.
async function runDemoServer(options = {}) {
  const port = normalizePort(options.port === undefined ? DEFAULT_PORT : options.port);
  const siteRoot = path.resolve(options.siteRoot || path.join(__dirname, ".."));
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const executePreflight = options.runUiPreflight || runUiPreflight;
  const startServer = options.startSourceServer || startSourceServer;
  const waitUntilReady = options.waitForHttpReadiness || waitForHttpReadiness;
  const waitUntilTerminated = options.waitForTermination || (() =>
    waitForTermination(options.signalSource || process));

  let preflightExecution;
  try {
    preflightExecution = normalizePreflightExecution(await executePreflight({
      argv: Object.freeze(["--ui"]),
      siteRoot
    }));
  } catch (error) {
    if (error instanceof DemoServerError) throw error;
    reject(ERROR_CODES.PREFLIGHT_UNAVAILABLE);
  }
  stderr.write(`${renderPreflightSummary(preflightExecution.report)}\n`);
  if (preflightExecution.exitCode !== 0 || !preflightExecution.report.ready) {
    reject(ERROR_CODES.PREFLIGHT_BLOCKED);
  }

  let server;
  try {
    server = await startServer({ siteRoot, port });
  } catch (_error) {
    reject(ERROR_CODES.SERVER_FAILED);
  }
  if (!server || typeof server.close !== "function") {
    reject(ERROR_CODES.SERVER_FAILED);
  }

  let origin;
  let signal;
  try {
    origin = normalizeLoopbackOrigin(server.origin, port);
    try {
      await waitUntilReady(origin, { timeoutMilliseconds: READINESS_TIMEOUT_MILLISECONDS });
    } catch (_error) {
      reject(ERROR_CODES.READINESS_FAILED);
    }
    stdout.write(`${renderReadySummary(origin)}\n`);
    signal = await waitUntilTerminated();
  } finally {
    await server.close();
  }
  stdout.write(`TinyRustLM interview UI demo: STOPPED (${signal}).\n`);
  return Object.freeze({ origin, signal });
}

// Convert argument/startup failures into bounded public diagnostics and exit status.
async function runCli(options = {}) {
  const stderr = options.stderr || process.stderr;
  let parsed;
  try {
    parsed = parseArguments(options.argv || process.argv.slice(2));
  } catch (_error) {
    stderr.write(
      `TinyRustLM interview UI demo: BLOCKED (${ERROR_CODES.ARGUMENTS_INVALID}).\n` +
      "Usage: npm --prefix .\\tinyrustlm run demo:start -- [--port 1024-65535].\n" +
      "Live-model checks remain separate: npm --prefix .\\tinyrustlm run demo:preflight:live.\n"
    );
    return 1;
  }
  try {
    await runDemoServer({
      ...options,
      port: parsed.port
    });
    return 0;
  } catch (error) {
    const code = error instanceof DemoServerError
      ? error.code
      : ERROR_CODES.SERVER_FAILED;
    stderr.write(`TinyRustLM interview UI demo: BLOCKED (${code}).\n`);
    return 1;
  }
}

if (require.main === module) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

module.exports = Object.freeze({
  DEFAULT_PORT,
  ERROR_CODES,
  DemoServerError,
  normalizePreflightExecution,
  parseArguments,
  renderReadySummary,
  runCli,
  runDemoServer,
  runUiPreflight,
  waitForHttpReadiness,
  waitForTermination
});

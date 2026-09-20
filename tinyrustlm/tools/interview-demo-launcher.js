#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const path = require("node:path");

const demoServer = require("./interview-demo-server.js");
const { requireCanonicalSiteRoot } = require("./canonical-operation-scratch.js");

const BROWSER_OPEN_TIMEOUT_MILLISECONDS = 10_000;
const ERROR_CODES = Object.freeze({
  ARGUMENTS_INVALID: "interview_demo_arguments_invalid",
  BROWSER_OPEN_FAILED: "interview_demo_browser_open_failed",
  LAUNCH_FAILED: "interview_demo_launch_failed",
  READINESS_INVALID: "interview_demo_readiness_invalid"
});

class InterviewDemoLauncherError extends Error {
  // Carry a public code without exposing browser-handler diagnostics.
  constructor(code) {
    super(code);
    this.name = "InterviewDemoLauncherError";
    this.code = code;
  }
}

// Throws one stable public launcher error without forwarding private details.
function reject(code) {
  throw new InterviewDemoLauncherError(code);
}

// Reuses the existing server's exact explicit-port validation contract.
function normalizePort(value) {
  try {
    return demoServer.parseArguments(["--port", String(value)]).port;
  } catch (_error) {
    reject(ERROR_CODES.ARGUMENTS_INVALID);
  }
}

// Accepts only an optional explicit port and the explicit no-browser mode.
function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.some((value) => typeof value !== "string")) {
    reject(ERROR_CODES.ARGUMENTS_INVALID);
  }
  let browserEnabled = true;
  let port = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-browser" && browserEnabled) {
      browserEnabled = false;
      continue;
    }
    if (argument === "--port" && port === null && index + 1 < argv.length) {
      port = normalizePort(argv[index + 1]);
      index += 1;
      continue;
    }
    reject(ERROR_CODES.ARGUMENTS_INVALID);
  }
  return Object.freeze({ browserEnabled, port });
}

// Normalizes the sole URL shape permitted to reach the OS browser handler.
function normalizeLoopbackUrl(value, expectedPort) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch (_error) {
    reject(ERROR_CODES.READINESS_INVALID);
  }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" ||
      Number(url.port) !== expectedPort || url.pathname !== "/" ||
      url.username || url.password || url.search || url.hash) {
    reject(ERROR_CODES.READINESS_INVALID);
  }
  return `${url.origin}/`;
}

// Opens one validated loopback URL through the platform's default URL handler.
async function openDefaultBrowser(url, options = {}) {
  const platform = options.platform || process.platform;
  const execute = options.execFile || childProcess.execFile;
  const timeoutMilliseconds = options.timeoutMilliseconds === undefined
    ? BROWSER_OPEN_TIMEOUT_MILLISECONDS
    : options.timeoutMilliseconds;
  let expectedPort;
  try {
    expectedPort = Number(new URL(String(url || "")).port);
  } catch (_error) {
    reject(ERROR_CODES.READINESS_INVALID);
  }
  if (!Number.isSafeInteger(expectedPort) || expectedPort < 1024 ||
      expectedPort > 65535) {
    reject(ERROR_CODES.READINESS_INVALID);
  }
  const normalizedUrl = normalizeLoopbackUrl(url, expectedPort);
  if (typeof execute !== "function" ||
      !Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 ||
      timeoutMilliseconds > 30_000 ||
      (options.signal !== undefined && !(options.signal instanceof AbortSignal))) {
    reject(ERROR_CODES.BROWSER_OPEN_FAILED);
  }
  const invocation = platform === "win32"
    ? ["explorer.exe", [normalizedUrl]]
    : platform === "darwin"
      ? ["open", [normalizedUrl]]
      : platform === "linux"
        ? ["xdg-open", [normalizedUrl]]
        : null;
  if (!invocation) reject(ERROR_CODES.BROWSER_OPEN_FAILED);
  options.signal?.throwIfAborted();
  try {
    await new Promise((resolve, rejectPromise) => {
      execute(invocation[0], invocation[1], {
        shell: false,
        encoding: "utf8",
        maxBuffer: 16 * 1024,
        timeout: timeoutMilliseconds,
        signal: options.signal,
        windowsHide: true
      }, error => error ? rejectPromise(error) : resolve());
    });
  } catch (_error) {
    reject(ERROR_CODES.BROWSER_OPEN_FAILED);
  }
}



// Runs the existing attached UI server with a free/configured port and browser hook.
async function runInterviewDemo(options = {}) {
  const siteRoot = requireCanonicalSiteRoot(options.siteRoot || path.join(__dirname, ".."));
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const browserEnabled = options.browserEnabled !== false;
  const runServer = options.runDemoServer || demoServer.runDemoServer;
  const openBrowser = options.openBrowser || openDefaultBrowser;
  if (!stdout || typeof stdout.write !== "function" ||
      !stderr || typeof stderr.write !== "function" ||
      typeof runServer !== "function" ||
      typeof openBrowser !== "function") {
    reject(ERROR_CODES.LAUNCH_FAILED);
  }
  let port = options.port === null || options.port === undefined
    ? null
    : normalizePort(options.port);
  let readinessObserved = false;
  let browserRequested = false;
  stdout.write(
    "Interview mode: canonical UI shell only. " +
    "Synthetic P2P walkthrough: NOT RUN. Live model: NOT CLAIMED.\n"
  );
  const result = await runServer({
    ...(options.serverOptions || {}),
    port,
    siteRoot,
    stderr,
    stdout,
    async onReady(origin, { signal }) {
      if (readinessObserved) reject(ERROR_CODES.READINESS_INVALID);
      if (port === null) {
        try { port = normalizePort(new URL(origin).port); }
        catch (_error) { reject(ERROR_CODES.READINESS_INVALID); }
      }
      const url = normalizeLoopbackUrl(`${origin}/`, port);
      readinessObserved = true;
      if (signal.aborted) return;
      if (browserEnabled) {
        try {
          await openBrowser(url, { signal });
        } catch (_error) {
          if (signal.aborted) return;
          reject(ERROR_CODES.BROWSER_OPEN_FAILED);
        }
        if (signal.aborted) return;
        browserRequested = true;
        stdout.write("Browser: request sent after loopback HTTP readiness.\n");
      } else {
        stdout.write("Browser: disabled by explicit --no-browser.\n");
      }
    }
  });
  if (!readinessObserved) reject(ERROR_CODES.READINESS_INVALID);
  if (!result || typeof result.origin !== "string" ||
      !["SIGINT", "SIGTERM"].includes(result.signal)) {
    reject(ERROR_CODES.LAUNCH_FAILED);
  }
  const resultUrl = normalizeLoopbackUrl(`${result.origin}/`, port);
  if (new URL(resultUrl).origin !== result.origin) {
    reject(ERROR_CODES.LAUNCH_FAILED);
  }
  return Object.freeze({
    browserRequested,
    origin: result.origin,
    port,
    signal: result.signal
  });
}

// Maps the CLI to stable output without leaking child or browser diagnostics.
async function runCli(options = {}) {
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  let parsed;
  try {
    parsed = parseArguments(options.argv || process.argv.slice(2));
  } catch (_error) {
    stderr.write(
      `TinyRustLM interview launcher: BLOCKED (${ERROR_CODES.ARGUMENTS_INVALID}).\n` +
      "Usage: npm --prefix .\\tinyrustlm run demo:interview -- " +
      "[--port 1024-65535] [--no-browser].\n"
    );
    return 1;
  }
  try {
    await runInterviewDemo({
      ...options,
      browserEnabled: parsed.browserEnabled,
      port: parsed.port,
      stderr,
      stdout
    });
    return 0;
  } catch (error) {
    const code = error instanceof InterviewDemoLauncherError ||
      error instanceof demoServer.DemoServerError
      ? error.code
      : ERROR_CODES.LAUNCH_FAILED;
    stderr.write(`TinyRustLM interview launcher: BLOCKED (${code}).\n`);
    stderr.write(
      "Synthetic P2P walkthrough: NOT RUN. Live model: NOT CLAIMED.\n"
    );
    return 1;
  }
}

if (require.main === module) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

module.exports = Object.freeze({
  ERROR_CODES,
  InterviewDemoLauncherError,
  normalizeLoopbackUrl,
  openDefaultBrowser,
  parseArguments,
  runCli,
  runInterviewDemo
});

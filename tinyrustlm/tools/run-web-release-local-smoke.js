#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const {
  createOwnedTemporaryDirectory,
  removeOwnedTemporaryDirectory,
  requireCanonicalSiteRoot,
  verifyOwnedTemporaryDirectory
} = require("./canonical-operation-scratch.js");
const digestPattern = /^[0-9a-f]{64}$/;

/** Reject incomplete or invalid local-smoke results. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Keep only the bounded public result envelope. */
function requireBoundedResult(value) {
  invariant(value && typeof value === "object",
    "Local web release smoke returned no result");
  invariant(value.status === "pass",
    "Local web release smoke did not pass");
  // The release smoke owns four routes at three viewport sizes.
  invariant(value.observationCount === 12,
  "Local web release smoke observation count is invalid");
  invariant(typeof value.reportSha256 === "string" &&
    digestPattern.test(value.reportSha256),
  "Local web release smoke report identity is invalid");
  return Object.freeze({
    status: value.status,
    observationCount: value.observationCount,
    reportSha256: value.reportSha256
  });
}

/** Launch the explicit CLI with all child scratch variables confined. */
function invokeLocalWebReleaseSmokeCli(options, dependencies = {}) {
  invariant(options && typeof options === "object",
    "Local web release smoke invocation options are required");
  const execFile = dependencies.execFile || childProcess.execFile;
  const explicitCliPath = path.join(__dirname, "web-release-local-smoke.js");
  const environment = {
    ...process.env,
    TEMP: options.scratchDirectory,
    TMP: options.scratchDirectory,
    TMPDIR: options.scratchDirectory
  };
  // A child CLI is an application process, not a nested Node test worker.
  delete environment.NODE_TEST_CONTEXT;

  return new Promise((resolve, reject) => {
    execFile(process.execPath, [
      explicitCliPath,
      options.outputDirectory,
      options.siteRoot
    ], {
      cwd: options.siteRoot,
      encoding: "utf8",
      env: environment,
      maxBuffer: 16 * 1024,
      signal: options.signal,
      timeout: 120_000,
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        invariant(String(stderr).trim() === "",
          "Local web release smoke wrote unexpected standard error");
        const serialized = String(stdout).trim();
        invariant(serialized.length > 0 && !serialized.includes("\n"),
          "Local web release smoke returned an invalid result envelope");
        resolve(requireBoundedResult(JSON.parse(serialized)));
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

/** Preserve both failure cause and cleanup outcome without leaking subprocess output. */
function runError(code, cleanupStatus, cause) {
  const error = new Error(code, { cause });
  error.code = code;
  error.temporaryOutputCleanup = cleanupStatus;
  return error;
}

/** Run once and verify cleanup on success, invocation failure, and malformed results. */
async function runOwnedLocalWebReleaseSmoke(options = {}, dependencies = {}) {
  const invokeSmoke = dependencies.invokeLocalWebReleaseSmokeCli ||
    invokeLocalWebReleaseSmokeCli;
  let owned;
  try {
    owned = createOwnedTemporaryDirectory(options);
  } catch (error) {
    throw runError("LOCAL_WEB_RELEASE_SMOKE_SETUP_FAILED", "not-created", error);
  }

  const outputDirectory = path.join(owned.rootPath, "evidence");
  const scratchDirectory = path.join(owned.rootPath, "scratch");
  let result = null;
  let smokeError = null;
  try {
    invariant(!fs.existsSync(outputDirectory),
      "Local web release smoke evidence directory must be create-only");
    fs.mkdirSync(scratchDirectory, { mode: 0o700 });
    result = requireBoundedResult(await invokeSmoke({
      outputDirectory,
      scratchDirectory,
      siteRoot: requireCanonicalSiteRoot(options.siteRoot)
    }));
  } catch (error) {
    smokeError = error;
  }

  let cleanupError = null;
  try {
    removeOwnedTemporaryDirectory(owned);
  } catch (error) {
    cleanupError = error;
  }

  if (cleanupError) {
    const cause = smokeError
      ? new AggregateError([smokeError, cleanupError],
        "Local smoke and temporary output cleanup failed")
      : cleanupError;
    throw runError(
      smokeError
        ? "LOCAL_WEB_RELEASE_SMOKE_AND_CLEANUP_FAILED"
        : "LOCAL_WEB_RELEASE_SMOKE_CLEANUP_FAILED",
      "failed",
      cause
    );
  }
  if (smokeError) {
    throw runError("LOCAL_WEB_RELEASE_SMOKE_FAILED", "verified", smokeError);
  }

  return Object.freeze({
    ...result,
    temporaryOutputCleanup: "verified"
  });
}

/** Zero-argument entry point for disposable local browser evidence. */
async function main() {
  invariant(process.argv.length === 2,
    "run-web-release-local-smoke.js does not accept arguments");
  const result = await runOwnedLocalWebReleaseSmoke();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    const cleanupStatus = ["verified", "failed", "not-created"].includes(
      error?.temporaryOutputCleanup
    ) ? error.temporaryOutputCleanup : "unknown";
    const failureCode = typeof error?.code === "string" &&
      /^LOCAL_WEB_RELEASE_SMOKE_[A-Z_]+$/.test(error.code)
      ? error.code.toLowerCase()
      : "local_web_release_smoke_runner_failed";
    process.stderr.write(`${JSON.stringify({
      status: "fail",
      failureCode,
      temporaryOutputCleanup: cleanupStatus
    })}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  createOwnedTemporaryDirectory,
  invokeLocalWebReleaseSmokeCli,
  removeOwnedTemporaryDirectory,
  runOwnedLocalWebReleaseSmoke,
  verifyOwnedTemporaryDirectory
});

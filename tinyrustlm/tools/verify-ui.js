#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const scratch = require("./canonical-operation-scratch.js");
const { startSourceServer } = require("./static-server.js");
const { validateReport } = require("../../eng/verify-release-report.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const siteRoot = path.join(repositoryRoot, "tinyrustlm");
const defaultReportPath = path.join(repositoryRoot, "artifacts/reports/tinyrustlm-ui-verification.json");
const schema = "tinyrustlm.ui_verification.v2";
const gateNames = Object.freeze([
  "source_authority", "static_contract", "javascript_syntax", "interview_demo_no_browser",
  "acquisition_playwright", "browser_contracts", "chromium_release",
  "acquisition_browser_bridge", "acquisition_companion", "acquisition_converter",
  "visual_lock", "temporary_cleanup"
]);

/** Throw a bounded local diagnostic without inheriting child output or private paths. */
function requireValue(condition, code) {
  if (!condition) throw Object.assign(new Error(code), { code });
}

/** Parse one current CLI; reject duplicate, unknown and valueless options before writing. */
function parseOptions(args) {
  requireValue(Array.isArray(args), "ui_arguments_invalid");
  const values = { root: siteRoot, report: defaultReportPath,
    visualBaseline: path.join(siteRoot, "artifacts/reports/ui-lock-live/tinyrustlm-ui-lock-report.json"),
    browser: false, deep: false, visual: false };
  const valueFlags = { "--root": "root", "--report": "report", "--visual-baseline": "visualBaseline" };
  const boolFlags = { "--browser": "browser", "--deep": "deep", "--visual": "visual" };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    requireValue(!seen.has(flag), "ui_arguments_invalid");
    seen.add(flag);
    if (Object.hasOwn(boolFlags, flag)) values[boolFlags[flag]] = true;
    else {
      requireValue(Object.hasOwn(valueFlags, flag) && typeof args[i + 1] === "string" &&
        args[i + 1].length > 0 && !args[i + 1].startsWith("--"), "ui_arguments_invalid");
      values[valueFlags[flag]] = path.resolve(args[++i]);
    }
  }
  return Object.freeze(values);
}

/** Require the canonical app and an ordinary report destination beneath its artifacts. */
function validateOptions(options) {
  scratch.requireCanonicalSiteRoot(options.root);
  for (const flag of ["browser", "deep", "visual"]) requireValue(typeof options[flag] === "boolean", "ui_arguments_invalid");
  requireValue(typeof options.report === "string" && path.isAbsolute(options.report) &&
    path.extname(options.report) === ".json", "ui_report_path_invalid");
  scratch.requireCanonicalArtifactPath(path.dirname(options.report));
  const stat = fs.lstatSync(options.report, { throwIfNoEntry: false });
  requireValue(!stat || (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1), "ui_report_path_invalid");
  requireValue(!stat || options.report === defaultReportPath, "ui_report_already_exists");
  requireValue(typeof options.visualBaseline === "string" && path.isAbsolute(options.visualBaseline), "ui_arguments_invalid");
}

/** Resolve a maintained package command to direct Node argv, never a shell command. */
function packageArguments(name) {
  const command = JSON.parse(fs.readFileSync(path.join(siteRoot, "package.json"), "utf8")).scripts[name];
  requireValue(typeof command === "string", "ui_package_command_invalid");
  const tokens = command.split(/\s+/u);
  requireValue(tokens.every(token => /^[A-Za-z0-9_./:=\-]+$/u.test(token)), "ui_package_command_invalid");
  if (tokens[0] === "node" && tokens[1] === "--test") return tokens.slice(1);
  requireValue(tokens[0] === "playwright" && tokens[1] === "test", "ui_package_command_invalid");
  return [require.resolve("@playwright/test/cli"), ...tokens.slice(1)];
}

/** Execute bounded direct Node work; an interrupted child cannot certify descendant quiescence. */
function runCommand(args, { cwd = siteRoot, env = process.env, signal,
  timeoutMilliseconds = 30 * 60 * 1000, maxBuffer = 1024 * 1024 } = {}) {
  requireValue(Number.isSafeInteger(timeoutMilliseconds) && timeoutMilliseconds > 0 &&
    timeoutMilliseconds <= 30 * 60 * 1000 && Number.isSafeInteger(maxBuffer) &&
    maxBuffer > 0 && maxBuffer <= 1024 * 1024, "ui_command_limits_invalid");
  return new Promise((resolve, reject) => {
    childProcess.execFile(process.execPath, args, { cwd, env, signal, timeout: timeoutMilliseconds,
      maxBuffer, encoding: "utf8", windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const interrupted = Boolean(error.killed || error.code === "ABORT_ERR" ||
          error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER");
        reject(Object.assign(new Error(interrupted ? "ui_command_interrupted" : "ui_command_failed"),
          { code: interrupted ? "ui_command_interrupted" : "ui_command_failed", interrupted,
            observation: { exitCode: Number.isInteger(error.code) ? error.code : null, interrupted,
              capturedStdoutBytes: Buffer.byteLength(stdout), capturedStderrBytes: Buffer.byteLength(stderr),
              capturedStdoutSha256: crypto.createHash("sha256").update(stdout).digest("hex"),
              capturedStderrSha256: crypto.createHash("sha256").update(stderr).digest("hex") } }));
      } else resolve({ stdout, stderr });
    });
  });
}

/** Replace only an admitted local report; temporary writer bytes never include raw child output. */
function writeVerificationReport(output, report) {
  validateOptions({ ...parseOptions([]), report: output });
  requireValue(report.schema === schema && ["pass", "fail"].includes(report.status), "ui_report_invalid");
  if (report.status === "pass") validateReport("ui", report);
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + "\n");
  requireValue(bytes.length <= 256 * 1024, "ui_report_too_large");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, bytes, { flag: "wx" });
  try {
    if (output === defaultReportPath) fs.renameSync(temporary, output);
    else fs.linkSync(temporary, output); // Exclusive publication cannot overwrite another run.
  }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

/** Own source-first verification, one optional listener and all disposable gate output. */
async function runVerification(options, dependencies = {}) {
  validateOptions(options);
  const deps = { runCommand, startServer: startSourceServer,
    createScratch: scratch.createOwnedTemporaryDirectory, removeScratch: scratch.removeOwnedTemporaryDirectory,
    ...dependencies };
  const browser = options.browser || options.deep;
  const gates = Object.fromEntries(gateNames.map(name => [name, "not_run"]));
  if (!browser) for (const name of ["acquisition_playwright", "browser_contracts", "chromium_release"]) gates[name] = "skipped";
  if (!options.deep) for (const name of ["acquisition_browser_bridge", "acquisition_companion", "acquisition_converter"]) gates[name] = "skipped";
  if (!options.visual) gates.visual_lock = "skipped";
  const report = { schema, generated_utc: new Date().toISOString(), run_id: crypto.randomUUID(), status: "fail",
    repository_root: repositoryRoot, app_root: siteRoot, browser_smoke_requested: browser,
    deep_acquisition_requested: options.deep, visual_lock_requested: options.visual, gates,
    evidence: { root: "", web_release: "", visual_lock: "", cleanup: "not_created" }, outputs: {}, error: "" };
  let owned, currentGate = "source_authority", interrupted = false;
  let env = { ...process.env, NODE_V8_COVERAGE: "" };
  /** Record only bounded output identities after each command returns successfully. */
  async function step(name, commands, timeoutMilliseconds) {
    currentGate = name;
    report.outputs[name] = [];
    for (const args of commands) {
      let output;
      try { output = await deps.runCommand(args, { cwd: siteRoot, env, timeoutMilliseconds }); }
      catch (error) {
        if (error.observation) report.outputs[name].push(error.observation);
        throw error;
      }
      const bytes = Buffer.from(`${output.stdout}\n${output.stderr}`);
      report.outputs[name].push({ bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
    }
    gates[name] = "pass";
  }
  try {
    await step("source_authority", [[path.join(__dirname, "verify-single-source-authority.js")]], 30000);
    // No browser or build can resolve the missing real acquisition registration.
    if (options.deep) {
      currentGate = "acquisition_browser_bridge";
      throw Object.assign(new Error("ui_deep_acquisition_unregistered"), { code: "ui_deep_acquisition_unregistered" });
    }
    currentGate = "temporary_cleanup";
    owned = deps.createScratch({ temporaryParent: path.join(repositoryRoot, "artifacts/verification/ui") });
    report.evidence = { root: owned.rootPath, web_release: browser ? path.join(owned.rootPath, "web-release") : "",
      visual_lock: options.visual ? path.join(owned.rootPath, "visual-lock") : "", cleanup: "pending" };
    env = { ...env, TEMP: owned.rootPath, TMP: owned.rootPath, TMPDIR: owned.rootPath,
      CARGO_TARGET_DIR: path.join(owned.rootPath, "target") };
    await step("static_contract", [["tools/browser-runtime-web-artifact.js", "check"],
      ["--test", "tests/browser-runtime-web-artifact.test.js", "tests/model-runtime-worker.test.js", "tests/static-shell-parity.test.js"]]);
    await step("javascript_syntax", ["app.js", "companion-capability.js", "model-runtime-worker.js", "model-runtime-client.js"]
      .map(name => ["--check", `app/${name}`]));
    currentGate = "interview_demo_no_browser";
    await step(currentGate, [packageArguments("test:demo:interview:no-browser")]);
    if (browser) {
      currentGate = "acquisition_playwright";
      await step(currentGate, [packageArguments("test:e2e:acquisition")]);
      currentGate = "browser_contracts";
      await step(currentGate, [packageArguments("test:ui")]);
      await step("chromium_release", [["tools/web-release-local-smoke.js", report.evidence.web_release, siteRoot]]);
    }
    if (options.visual) {
      currentGate = "visual_lock";
      const baseline = fs.lstatSync(options.visualBaseline, { throwIfNoEntry: false });
      requireValue(baseline?.isFile() && !baseline.isSymbolicLink(), "ui_visual_baseline_missing");
      const server = await deps.startServer({ siteRoot, port: 0 });
      try {
        await step("visual_lock", [["tools/capture-ui-lock.js", `${server.origin}/app/`,
          report.evidence.visual_lock, options.visualBaseline]]);
      } finally { await server.close(); }
    }
    report.status = "pass";
  } catch (error) {
    gates[currentGate] = "fail";
    interrupted = error.interrupted === true;
    report.error = /^ui_[a-z_]+$/u.test(error.code || "") ? error.code : "ui_verification_failed";
  } finally {
    if (owned) {
      if (interrupted) {
        gates.temporary_cleanup = "fail";
        report.evidence.cleanup = "retained_interrupted_child_requires_quiescence_review";
      } else {
        try { deps.removeScratch(owned); gates.temporary_cleanup = "pass"; report.evidence.cleanup = "removed"; }
        catch { gates.temporary_cleanup = "fail"; report.evidence.cleanup = "retained_cleanup_failed";
          report.status = "fail"; report.error = "ui_cleanup_failed"; }
      }
    }
  }
  writeVerificationReport(options.report, report);
  return report;
}

if (require.main === module) {
  Promise.resolve().then(() => runVerification(parseOptions(process.argv.slice(2)))).then(report => {
    console.log(`TinyRustLM UI verification: ${report.status}${report.error ? ` (${report.error})` : ""}`);
    process.exitCode = report.status === "pass" ? 0 : 1;
  }).catch(() => { console.error("TinyRustLM UI verification rejected its input or report destination."); process.exitCode = 1; });
}

module.exports = Object.freeze({ schema, gateNames, parseOptions, packageArguments, runCommand,
  writeVerificationReport, runVerification });

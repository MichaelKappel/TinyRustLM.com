"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const owner = require("../tools/verify-ui.js");
const scratch = require("../tools/canonical-operation-scratch.js");
const { validateReport, verifyReportFile } = require("../../eng/verify-release-report.js");
const root = path.resolve(__dirname, "../..");

/** Give each case original ownership and retire any intentionally retained failed output. */
function setup(t, flags = []) {
  const records = [];
  const create = () => {
    const owned = scratch.createOwnedTemporaryDirectory({ temporaryParent: path.join(root, "artifacts/tests/ui-verification-owner") });
    records.push(owned);
    return owned;
  };
  const parent = create();
  t.after(() => { for (const owned of records.reverse()) {
    if (fs.existsSync(owned.markerPath)) scratch.removeOwnedTemporaryDirectory(owned);
  } });
  const options = owner.parseOptions(["--report", path.join(parent.rootPath, "report with spaces.json"), ...flags]);
  const calls = [];
  const dependencies = { createScratch: create, runCommand: async (args, context) => {
    calls.push({ args, context }); return { stdout: "private-fixture-canary", stderr: "fixture-progress" };
  } };
  return { parent, options, dependencies, calls, records };
}

test("options reject unknown/duplicate flags, empty values and noncanonical write targets", async (t) => {
  for (const args of [null, ["--wat"], ["--browser", "--browser"], ["--root"], ["--report", ""], ["--root", "--deep"]]) {
    assert.throws(() => owner.parseOptions(args), /ui_arguments_invalid/);
  }
  const f = setup(t);
  const defaults = owner.parseOptions([]);
  assert.equal(defaults.root, path.join(root, "tinyrustlm"));
  assert.equal(Object.isFrozen(defaults), true);
  for (const change of [{ root }, { browser: 1 }, { report: "relative.json" },
    { report: path.join(root, "wrong.json") }, { report: f.parent.rootPath }, { visualBaseline: "relative" }]) {
    await assert.rejects(owner.runVerification({ ...f.options, ...change }, f.dependencies));
  }
  fs.mkdirSync(f.options.report);
  await assert.rejects(owner.runVerification(f.options, f.dependencies), /ui_report_path_invalid/);
  assert.equal(f.calls.length, 0);
});

test("package commands resolve current test argv without a shell or hidden retry", () => {
  assert.deepEqual(owner.packageArguments("test:demo:interview:no-browser").slice(0, 2), ["--test", "--test-concurrency=1"]);
  const acquisition = owner.packageArguments("test:e2e:acquisition");
  assert.match(acquisition[0], /playwright.*cli/u);
  assert.ok(acquisition.includes("--retries=0"));
  assert.ok(acquisition.includes("--forbid-only"));
  assert.throws(() => owner.packageArguments("missing"), /ui_package_command_invalid/);
  assert.throws(() => owner.packageArguments("pretest:ui"), /ui_package_command_invalid/);
});

test("source refusal runs nothing else and creates no scratch", async (t) => {
  const f = setup(t, ["--browser", "--visual"]);
  f.dependencies.runCommand = async (args) => {
    assert.match(args[0], /verify-single-source-authority\.js$/u);
    throw new Error("sensitive child output");
  };
  f.dependencies.createScratch = () => assert.fail("source refusal created scratch");
  const report = await owner.runVerification(f.options, f.dependencies);
  assert.equal(report.gates.source_authority, "fail");
  assert.equal(report.gates.static_contract, "not_run");
  assert.equal(report.evidence.cleanup, "not_created");
  assert.equal(report.error, "ui_verification_failed");
  assert.doesNotMatch(fs.readFileSync(f.options.report, "utf8"), /sensitive child output/);
  assert.throws(() => verifyReportFile("ui", f.options.report));
});

test("unregistered deep acquisition fails before expensive checks or scratch", async (t) => {
  const f = setup(t, ["--deep"]);
  const report = await owner.runVerification(f.options, f.dependencies);
  assert.equal(report.error, "ui_deep_acquisition_unregistered");
  assert.equal(report.gates.acquisition_browser_bridge, "fail");
  assert.equal(report.browser_smoke_requested, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.records.length, 1);
});

test("base and browser plans preserve every requested gate and retire scratch before success", async (t) => {
  for (const flags of [[], ["--browser"]]) {
    const f = setup(t, flags);
    const report = await owner.runVerification(f.options, f.dependencies);
    validateReport("ui", report);
    verifyReportFile("ui", f.options.report);
    assert.equal(report.schema, "tinyrustlm.ui_verification.v2");
    assert.equal(f.calls.length, flags.length ? 11 : 8);
    assert.equal(f.calls[0].context.timeoutMilliseconds, 30000);
    assert.equal(report.gates.acquisition_playwright, flags.length ? "pass" : "skipped");
    assert.equal(report.gates.interview_demo_no_browser, "pass");
    assert.equal(report.evidence.cleanup, "removed");
    assert.equal(fs.existsSync(report.evidence.root), false);
    assert.equal(fs.existsSync(report.evidence.root + ".owner.v2"), false);
    for (const call of f.calls.slice(1)) {
      assert.equal(call.context.env.TEMP, report.evidence.root);
      assert.equal(call.context.env.TMPDIR, report.evidence.root);
      assert.equal(call.context.env.CARGO_TARGET_DIR, path.join(report.evidence.root, "target"));
    }
    assert.doesNotMatch(fs.readFileSync(f.options.report, "utf8"), /private-fixture-canary|fixture-progress/);
    // Custom evidence paths are create-only; only the fixed current-status alias is replaceable.
    assert.throws(() => owner.writeVerificationReport(f.options.report, report), /ui_report_already_exists/);
    const fresh = path.join(f.parent.rootPath, "new.json");
    assert.throws(() => owner.writeVerificationReport(fresh, { ...report, schema: "tinyrustlm.ui_verification.v1" }));
    assert.throws(() => owner.writeVerificationReport(fresh, { ...report, outputs: "x".repeat(256 * 1024) }));
    for (const gate of ["source_authority", "interview_demo_no_browser", "temporary_cleanup", ...(flags.length ? ["acquisition_playwright"] : [])]) {
      for (const value of ["skipped", undefined]) {
        const changed = structuredClone(report);
        if (value === undefined) delete changed.gates[gate]; else changed.gates[gate] = value;
        assert.throws(() => validateReport("ui", changed), gate);
      }
    }
  }
});

for (const [index, gate] of [[1, "static_contract"], [3, "javascript_syntax"], [7, "interview_demo_no_browser"],
  [8, "acquisition_playwright"], [9, "browser_contracts"], [10, "chromium_release"]]) {
  test(`failed ${gate} stops subsequent work and records the responsible gate`, async (t) => {
    const f = setup(t, ["--browser"]), run = f.dependencies.runCommand;
    f.dependencies.runCommand = async (...args) => {
      if (f.calls.length === index) throw Object.assign(new Error("fixture failure"), { code: "ui_command_failed" });
      return run(...args);
    };
    const report = await owner.runVerification(f.options, f.dependencies);
    assert.equal(report.status, "fail");
    assert.equal(report.gates[gate], "fail");
    assert.equal(f.calls.length, index);
    assert.equal(report.evidence.cleanup, "removed");
  });
}

test("interruption and cleanup failure retain original ownership and cannot pass", async (t) => {
  for (const interrupted of [false, true]) {
    const f = setup(t), run = f.dependencies.runCommand;
    if (interrupted) f.dependencies.runCommand = async (...args) => {
      if (f.calls.length > 0) throw Object.assign(new Error("interrupted"), { code: "ui_command_interrupted", interrupted: true });
      return run(...args);
    };
    else f.dependencies.removeScratch = () => { throw Error("cannot clean"); };
    const report = await owner.runVerification(f.options, f.dependencies);
    assert.equal(report.status, "fail");
    assert.equal(report.gates.temporary_cleanup, "fail");
    assert.match(report.evidence.cleanup, /^retained_/);
    assert.equal(fs.existsSync(report.evidence.root + ".owner.v2"), true);
  }
});

test("visual capture uses one owned OS-assigned listener and closes on success or failure", async (t) => {
  for (const failure of ["", "baseline", "start", "capture", "close"]) {
    const f = setup(t, ["--visual"]), baseline = path.join(f.parent.rootPath, "baseline.json");
    fs.writeFileSync(baseline, "{}");
    const options = { ...f.options, visualBaseline: failure === "baseline" ? baseline + "-missing" : baseline };
    let started = 0, closed = 0;
    f.dependencies.startServer = async (input) => {
      started++;
      assert.deepEqual(input, { siteRoot: path.join(root, "tinyrustlm"), port: 0 });
      if (failure === "start") throw Error("start failure");
      return { origin: "http://127.0.0.1:48765", close: async () => { closed++; if (failure === "close") throw Error("close failure"); } };
    };
    const run = f.dependencies.runCommand;
    f.dependencies.runCommand = async (args, context) => {
      if (args[0] === "tools/capture-ui-lock.js") {
        assert.equal(args[1], "http://127.0.0.1:48765/app/"); assert.equal(args[3], baseline);
        if (failure === "capture") throw Error("capture failure");
      }
      return run(args, context);
    };
    const report = await owner.runVerification(options, f.dependencies);
    assert.equal(report.status, failure ? "fail" : "pass");
    assert.equal(started, failure === "baseline" ? 0 : 1);
    assert.equal(closed, ["start", "baseline"].includes(failure) ? 0 : 1);
    assert.equal(report.gates.visual_lock, failure ? "fail" : "pass");
  }
});

test("real child execution binds cwd/env, bounds output/time and reports cancellation safely", async (t) => {
  const f = setup(t);
  const result = await owner.runCommand(["-e", "console.log(process.cwd()); console.error(process.env.UI_CASE)"],
    { cwd: f.parent.rootPath, env: { ...process.env, UI_CASE: "only-this-fixture" } });
  assert.equal(result.stdout.trim(), f.parent.rootPath);
  assert.equal(result.stderr.trim(), "only-this-fixture");
  for (const options of [{ timeoutMilliseconds: 0 }, { maxBuffer: 0 }, { timeoutMilliseconds: Infinity }]) {
    assert.throws(() => owner.runCommand([], options), /ui_command_limits_invalid/);
  }
  await assert.rejects(owner.runCommand(["-e", "console.error('private-value');process.exit(2)"]),
    error => error.code === "ui_command_failed" && !error.message.includes("private-value"));
  await assert.rejects(owner.runCommand(["-e", "console.log('a'.repeat(20000))"], { maxBuffer: 8 }),
    error => error.interrupted === true);
  await assert.rejects(owner.runCommand(["-e", "setInterval(()=>{},100)"], { timeoutMilliseconds: 100 }),
    error => error.interrupted === true);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(owner.runCommand(["-e", "setInterval(()=>{},100)"], { signal: controller.signal }),
    error => error.interrupted === true);
  const cli = spawnSync(process.execPath, [path.join(root, "tinyrustlm/tools/verify-ui.js"), "--wat"],
    { encoding: "utf8", windowsHide: true, timeout: 10000 });
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /rejected its input/);
});

test("the real visual listener serves a child request while verification awaits it", async (t) => {
  const f = setup(t, ["--visual"]), baseline = path.join(f.parent.rootPath, "baseline.json");
  fs.writeFileSync(baseline, "{}");
  let url;
  const run = f.dependencies.runCommand;
  f.dependencies.runCommand = async (args, context) => {
    if (args[0] !== "tools/capture-ui-lock.js") return run(args, context);
    url = args[1];
    return owner.runCommand(["-e", "fetch(process.argv[1]).then(async r=>{if(r.status!==200 || !(await r.text()).includes('TinyRustLM'))process.exitCode=1;else console.log('source served')}).catch(()=>process.exitCode=1)", url], context);
  };
  const report = await owner.runVerification({ ...f.options, visualBaseline: baseline }, f.dependencies);
  assert.equal(report.status, "pass");
  assert.equal(report.gates.visual_lock, "pass");
  assert.ok(url);
  await assert.rejects(fetch(url));
});

test("failed real child output retains exit and digest evidence without retaining its text", async (t) => {
  const f = setup(t);
  f.dependencies.runCommand = () => owner.runCommand(["-e", "console.error('private-canary');process.exit(19)"]);
  const report = await owner.runVerification(f.options, f.dependencies);
  assert.equal(report.outputs.source_authority[0].exitCode, 19);
  assert.ok(report.outputs.source_authority[0].capturedStderrBytes > 0);
  assert.match(report.outputs.source_authority[0].capturedStderrSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(fs.readFileSync(f.options.report, "utf8"), /private-canary/);
});

test("PowerShell adapter preserves spaces, flags and the Node failure status", { skip: process.platform !== "win32" }, () => {
  const script = path.join(root, "eng/verify-tinyrustlm-ui.ps1").replace(/'/gu, "''");
  for (const status of [0, 7]) {
    const program = `function node { [Console]::Out.WriteLine((ConvertTo-Json -InputObject @($args) -Compress)); $global:LASTEXITCODE=${status} }; try { & '${script}' -Root 'root with spaces' -ReportOutput 'report with spaces' -VisualLockBaseline 'baseline with spaces' -RunBrowserSmoke -RunDeepAcquisition -RunVisualLock; exit 0 } catch { exit 1 }`;
    const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", program], { encoding: "utf8", windowsHide: true, timeout: 10000 });
    assert.equal(result.status, status ? 1 : 0);
    assert.deepEqual(JSON.parse(result.stdout).slice(1), ["--root", "root with spaces", "--report", "report with spaces",
      "--visual-baseline", "baseline with spaces", "--browser", "--deep", "--visual"]);
  }
});

test("Bash adapter preserves argv and rejects invalid switches using the actual script", async (t) => {
  const f = setup(t);
  const distribution = process.env.TINYRUSTLM_FEED_TEST_WSL_DISTRIBUTION;
  if (process.platform === "win32" && !distribution) { t.skip("A named WSL distribution is required for Bash execution."); return; }
  const unix = value => process.platform === "win32"
    ? `/mnt/${value[0].toLowerCase()}${value.slice(2).replace(/\\/gu, "/")}` : value;
  const shim = path.join(f.parent.rootPath, "node");
  fs.writeFileSync(shim, '#!/bin/sh\nprintf \'%s\\0\' "$@"\nexit "${UI_FIXTURE_EXIT:-0}"\n', { mode: 0o700 });
  const run = args => process.platform === "win32"
    ? spawnSync("wsl.exe", ["-d", distribution, "--", ...args], { encoding: "utf8", timeout: 10000, windowsHide: true })
    : spawnSync(args[0], args.slice(1), { encoding: "utf8", timeout: 10000 });
  assert.equal(run(["chmod", "700", unix(shim)]).status, 0);
  const script = unix(path.join(root, "eng/verify-tinyrustlm-ui.sh"));
  assert.equal(run(["bash", "-n", script]).status, 0);
  for (const status of [0, 7]) {
    const result = run(["env", `PATH=${unix(f.parent.rootPath)}:/usr/bin:/bin`, `UI_FIXTURE_EXIT=${status}`,
      "TINYRUSTLM_ROOT=root with spaces", "TINYRUSTLM_UI_REPORT=report with spaces",
      "VISUAL_LOCK_BASELINE=baseline with spaces", "RUN_BROWSER_SMOKE=1", "RUN_DEEP_ACQUISITION=1", "RUN_VISUAL_LOCK=1", "bash", script]);
    assert.equal(result.status, status, result.stderr);
    assert.deepEqual(result.stdout.split("\0").slice(1, -1), ["--root", "root with spaces", "--report", "report with spaces",
      "--visual-baseline", "baseline with spaces", "--browser", "--deep", "--visual"]);
  }
  const invalid = run(["env", `PATH=${unix(f.parent.rootPath)}:/usr/bin:/bin`, "RUN_VISUAL_LOCK=yes", "bash", script]);
  assert.equal(invalid.status, 1); assert.equal(invalid.stdout, ""); assert.match(invalid.stderr, /Invalid UI verification switch/);
});

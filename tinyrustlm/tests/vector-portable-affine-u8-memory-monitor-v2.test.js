"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  memoryMonitorScript
} = require("../tools/vector-portable-affine-u8-observation.js");
const {
  expectedScriptBytes,
  expectedScriptSha256,
  memoryMonitorContract,
  memoryMonitorScriptV2,
  minimumSamplesIfPostPrepareIsFirstLoopSample,
  validateMemoryMonitorScriptV2
} = require("../tools/vector-portable-affine-u8-memory-monitor-v2.js");

function offlineEnvironment(extra = {}) {
  return {
    SYSTEMROOT: process.env.SYSTEMROOT,
    WINDIR: process.env.WINDIR,
    PATH: process.env.PATH,
    PATHEXT: process.env.PATHEXT,
    COMSPEC: process.env.COMSPEC,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    HTTP_PROXY: "http://127.0.0.1:9",
    HTTPS_PROXY: "http://127.0.0.1:9",
    ALL_PROXY: "http://127.0.0.1:9",
    NO_PROXY: "",
    ...extra
  };
}

function collect(child) {
  return new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (exitCode, signal) => resolve({
      exitCode,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
  });
}

test("preserves the frozen one-sample race and fixes it in v2", () => {
  assert.equal(
    minimumSamplesIfPostPrepareIsFirstLoopSample(memoryMonitorScript),
    1
  );
  assert.equal(
    minimumSamplesIfPostPrepareIsFirstLoopSample(memoryMonitorScriptV2),
    2
  );
  assert.equal(memoryMonitorContract.baselineSampleBeforeReady, true);
  assert.equal(memoryMonitorContract.bytes, expectedScriptBytes);
  assert.equal(memoryMonitorContract.sha256, expectedScriptSha256);
  assert.deepEqual(validateMemoryMonitorScriptV2(), memoryMonitorContract);
});

test(
  "v2 captures two samples when the target exits immediately after ack",
  { skip: process.platform !== "win32" },
  async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "portable-affine-u8-monitor-v2-test-")
    );
    const scriptPath = path.join(root, "monitor-v2.ps1");
    const outputPath = path.join(root, "memory.json");
    let target;
    let monitor;
    try {
      fs.writeFileSync(scriptPath, memoryMonitorScriptV2, { flag: "wx" });
      const targetSource = [
        "\"use strict\";",
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "const root = process.argv[1];",
        "const sleeper = new Int32Array(new SharedArrayBuffer(4));",
        "const marker = (name) => path.join(root, name);",
        "const write = (name) => fs.writeFileSync(marker(name), 'ready\\n', { flag: 'wx' });",
        "const wait = (name) => {",
        "  const deadline = Date.now() + 10000;",
        "  while (!fs.existsSync(marker(name))) {",
        "    if (Date.now() >= deadline) throw new Error('target-marker-timeout');",
        "    Atomics.wait(sleeper, 0, 0, 1);",
        "  }",
        "};",
        "write('performance-monitor-request.marker');",
        "wait('performance-monitor-ready.marker');",
        "write('performance-post-prepare.marker');",
        "wait('performance-post-prepare-ack.marker');"
      ].join("\n");
      target = childProcess.spawn(
        process.execPath,
        ["-e", targetSource, root],
        {
          env: offlineEnvironment(),
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
      const where = childProcess.spawnSync("where.exe", ["powershell.exe"], {
        encoding: "utf8",
        windowsHide: true
      });
      assert.equal(where.status, 0);
      const powershell = where.stdout
        .split(/\r?\n/u)
        .find((line) => line.trim().length > 0)
        .trim();
      monitor = childProcess.spawn(powershell, [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-TargetProcessId",
        String(target.pid),
        "-ProcessRoot",
        root,
        "-OutputPath",
        outputPath
      ], {
        env: offlineEnvironment(),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      const [targetResult, monitorResult] = await Promise.all([
        collect(target),
        collect(monitor)
      ]);
      assert.deepEqual(targetResult, {
        exitCode: 0,
        signal: null,
        stdout: "",
        stderr: ""
      });
      assert.deepEqual(monitorResult, {
        exitCode: 0,
        signal: null,
        stdout: "",
        stderr: ""
      });
      const bytes = fs.readFileSync(outputPath, "utf8");
      assert.equal(bytes, `${JSON.stringify(JSON.parse(bytes))}\n`);
      const measurement = JSON.parse(bytes);
      assert.equal(measurement.monitorExitCode, 0);
      assert.ok(measurement.sampleCount >= 2);
      assert.ok(
        measurement.peakWorkingSetBytes >=
          measurement.postPrepareWorkingSetBytes
      );
      assert.ok(measurement.osReportedPeakWorkingSetBytes > 0);
    } finally {
      if (target && target.exitCode === null) target.kill();
      if (monitor && monitor.exitCode === null) monitor.kill();
      const resolved = fs.realpathSync.native(root);
      assert.equal(path.dirname(resolved), fs.realpathSync.native(os.tmpdir()));
      assert.match(
        path.basename(resolved),
        /^portable-affine-u8-monitor-v2-test-/u
      );
      fs.rmSync(resolved, { recursive: true, force: false });
    }
  }
);

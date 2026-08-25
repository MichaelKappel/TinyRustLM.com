"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const projectPath = path.join(repositoryRoot, "dotnet", "tools",
  "TinyRustLM.CompositionInspector", "TinyRustLM.CompositionInspector.csproj");
const stagedFileName = "tinyrustlm-build-scratch-inspect.exe";
const sourceProperty = "TinyRustLmCustodyScratchInspectorSource";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function runManagedBuild(outputPath, sourcePath) {
  return childProcess.spawnSync("dotnet", [
    "build",
    projectPath,
    "--configuration",
    "Release",
    "--no-restore",
    "--no-incremental",
    "--output",
    outputPath,
    `--property:${sourceProperty}=${sourcePath}`
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      DOTNET_CLI_TELEMETRY_OPTOUT: "1",
      DOTNET_NOLOGO: "1",
      DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
      MSBUILDDISABLENODEREUSE: "1"
    },
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true
  });
}

test("defines one explicit create-by-build custody staging target", () => {
  const project = fs.readFileSync(projectPath, "utf8");
  assert.match(project,
    /<Target Name="StageTinyRustLmCustodyScratchInspector"\s+AfterTargets="Build"\s+Condition="'\$\(TinyRustLmCustodyScratchInspectorSource\)' != ''">/u);
  assert.match(project,
    /<Copy SourceFiles="\$\(TinyRustLmCustodyScratchInspectorSource\)"\s+DestinationFiles="\$\(TargetDir\)tinyrustlm-build-scratch-inspect\.exe"\s+SkipUnchangedFiles="false"\s+UseHardlinksIfPossible="false"\s+UseSymboliclinksIfPossible="false" \/>/u);
  assert.equal((project.match(/StageTinyRustLmCustodyScratchInspector/gu) || []).length, 1);
  assert.equal((project.match(/tinyrustlm-build-scratch-inspect\.exe/gu) || []).length, 1);
  assert.doesNotMatch(project, /fallback|retry|repair|legacy|compatib/iu);
});

test("stages exact bytes into one fresh managed build output", {
  skip: process.platform !== "win32" || process.arch !== "x64",
  timeout: 120000
}, (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-managed-custody-stage-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, stagedFileName);
  const outputPath = path.join(root, "managed-output");
  fs.copyFileSync(process.execPath, sourcePath, fs.constants.COPYFILE_EXCL);

  const result = runManagedBuild(outputPath, sourcePath);

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.signal, null);
  const stagedPath = path.join(outputPath, stagedFileName);
  const sourceBytes = fs.readFileSync(sourcePath);
  const stagedBytes = fs.readFileSync(stagedPath);
  assert.equal(stagedBytes.length, sourceBytes.length);
  assert.equal(sha256(stagedBytes), sha256(sourceBytes));
  for (const required of [
    "TinyRustLM.CompositionInspector.deps.json",
    "TinyRustLM.CompositionInspector.dll",
    "TinyRustLM.CompositionInspector.runtimeconfig.json",
    "TinyRustLM.Conversion.dll"
  ]) {
    assert.equal(fs.lstatSync(path.join(outputPath, required)).isFile(), true, required);
  }
});

test("rejects relative and absent custody staging sources", {
  skip: process.platform !== "win32" || process.arch !== "x64",
  timeout: 120000
}, (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-managed-custody-reject-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cases = [
    {
      source: "relative-scratch-inspector.exe",
      output: path.join(root, "relative-output"),
      message: /must be an absolute path\./u
    },
    {
      source: path.join(root, "absent-scratch-inspector.exe"),
      output: path.join(root, "absent-output"),
      message: /does not exist\./u
    }
  ];

  for (const rejection of cases) {
    const result = runManagedBuild(rejection.output, rejection.source);
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.equal(result.signal, null);
    assert.match(`${result.stdout}\n${result.stderr}`, rejection.message);
    assert.equal(fs.existsSync(path.join(rejection.output, stagedFileName)), false);
  }
});

"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const projectPath = path.join(repositoryRoot, "dotnet", "tools",
  "TinyRustLM.CompositionInspector", "TinyRustLM.CompositionInspector.csproj");
const assetsPath = path.join(path.dirname(projectPath), "obj", "project.assets.json");
const sourceProperty = "TinyRustLmCustodyScratchInspectorSource";
const migrationMarkerParts = ["NuGet", "Migrations", "1"];

function requireAbsoluteEnvironment(name) {
  const value = process.env[name];
  assert.equal(typeof value, "string", name);
  assert.equal(path.isAbsolute(value), true, name);
  return path.resolve(value);
}

function findDotnetExecutable(systemRoot) {
  const wherePath = path.join(systemRoot, "System32", "where.exe");
  const result = childProcess.spawnSync(wherePath, ["dotnet.exe"], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SystemRoot: systemRoot,
      WINDIR: systemRoot
    },
    maxBuffer: 64 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
  const candidates = result.stdout.split(/\r?\n/u).filter(Boolean);
  assert.ok(candidates.length > 0);
  const executable = path.resolve(candidates[0]);
  assert.equal(fs.lstatSync(executable).isFile(), true);
  return executable;
}

function readPackagesPath() {
  const assets = JSON.parse(fs.readFileSync(assetsPath, "utf8"));
  const packagesPath = assets?.project?.restore?.packagesPath;
  assert.equal(typeof packagesPath, "string");
  assert.equal(path.isAbsolute(packagesPath), true);
  return path.resolve(packagesPath);
}

function createIsolatedEnvironment(root, dotnetPath, packagesPath,
  locations = {}) {
  const systemRoot = requireAbsoluteEnvironment("SystemRoot");
  const home = path.join(root, "home");
  const temp = path.join(root, "temp");
  fs.mkdirSync(home);
  fs.mkdirSync(temp);
  const homeRoot = path.parse(home).root.slice(0, 2);
  const environment = {
    DOTNET_CLI_HOME: home,
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_CLI_UI_LANGUAGE: "en-US",
    DOTNET_MULTILEVEL_LOOKUP: "0",
    DOTNET_NOLOGO: "1",
    DOTNET_ROOT: path.dirname(dotnetPath),
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
    HOMEDRIVE: homeRoot,
    HOMEPATH: home.slice(homeRoot.length),
    LOGONSERVER: "isolated-build",
    MSBUILDDISABLENODEREUSE: "1",
    NUGET_PACKAGES: packagesPath,
    NUGET_XMLDOC_MODE: "skip",
    PATH: [path.dirname(dotnetPath), path.join(systemRoot, "System32")].join(";"),
    SYSTEMDRIVE: path.parse(systemRoot).root.slice(0, 2),
    SystemRoot: systemRoot,
    TEMP: temp,
    TMP: temp,
    USERDOMAIN: "isolated-build",
    USERNAME: "isolated-build",
    USERPROFILE: home,
    WINDIR: systemRoot
  };
  if (locations.appData !== undefined) environment.APPDATA = locations.appData;
  if (locations.localAppData !== undefined) {
    environment.LOCALAPPDATA = locations.localAppData;
  }
  return environment;
}

function runBuild(root, dotnetPath, packagesPath, locations = {}) {
  const workingDirectory = path.join(root, "working");
  const outputPath = path.join(root, "output");
  const sourcePath = path.join(root, "scratch-inspector.exe");
  fs.mkdirSync(workingDirectory);
  fs.copyFileSync(process.execPath, sourcePath, fs.constants.COPYFILE_EXCL);
  const result = childProcess.spawnSync(dotnetPath, [
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
    cwd: workingDirectory,
    encoding: "utf8",
    env: createIsolatedEnvironment(root, dotnetPath, packagesPath, locations),
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  return Object.freeze({ outputPath, result, workingDirectory });
}

test("binds NuGet roaming state instead of resolving it against the worktree", {
  skip: process.platform !== "win32" || process.arch !== "x64",
  timeout: 180000
}, (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-isolated-managed-environment-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const systemRoot = requireAbsoluteEnvironment("SystemRoot");
  const dotnetPath = findDotnetExecutable(systemRoot);
  const packagesPath = readPackagesPath();

  const missingRoot = path.join(root, "missing-appdata");
  fs.mkdirSync(missingRoot);
  const missing = runBuild(missingRoot, dotnetPath, packagesPath);
  const missingOutput = `${missing.result.stdout}\n${missing.result.stderr}`;
  assert.equal(missing.result.error, undefined);
  assert.notEqual(missing.result.status, 0);
  assert.equal(missing.result.signal, null);
  assert.match(missingOutput, /NETSDK1060/u);
  assert.match(missingOutput, /Value cannot be null\. \(Parameter 'path1'\)/u);
  assert.equal(fs.existsSync(path.join(missing.workingDirectory,
    ...migrationMarkerParts)), true);

  const appDataOnlyRoot = path.join(root, "bound-appdata-only");
  const appDataPath = path.join(appDataOnlyRoot, "appdata", "roaming");
  fs.mkdirSync(appDataPath, { recursive: true });
  const appDataOnly = runBuild(appDataOnlyRoot, dotnetPath, packagesPath, {
    appData: appDataPath
  });
  assert.equal(appDataOnly.result.error, undefined);
  assert.equal(appDataOnly.result.status, 0,
    `${appDataOnly.result.stdout}\n${appDataOnly.result.stderr}`);
  assert.equal(appDataOnly.result.signal, null);
  assert.equal(fs.existsSync(path.join(appDataOnly.workingDirectory,
    ...migrationMarkerParts)), true);

  const boundRoot = path.join(root, "bound-roaming-and-local-appdata");
  const boundAppDataPath = path.join(boundRoot, "appdata", "roaming");
  const localAppDataPath = path.join(boundRoot, "appdata", "local");
  fs.mkdirSync(boundAppDataPath, { recursive: true });
  fs.mkdirSync(localAppDataPath);
  const bound = runBuild(boundRoot, dotnetPath, packagesPath, {
    appData: boundAppDataPath,
    localAppData: localAppDataPath
  });
  assert.equal(bound.result.error, undefined);
  assert.equal(bound.result.status, 0,
    `${bound.result.stdout}\n${bound.result.stderr}`);
  assert.equal(bound.result.signal, null);
  assert.equal(fs.existsSync(path.join(bound.workingDirectory,
    ...migrationMarkerParts)), false);
  assert.equal(fs.existsSync(path.join(localAppDataPath,
    ...migrationMarkerParts)), true);
  for (const required of [
    "TinyRustLM.CompositionInspector.deps.json",
    "TinyRustLM.CompositionInspector.dll",
    "TinyRustLM.CompositionInspector.runtimeconfig.json",
    "TinyRustLM.Conversion.dll",
    "tinyrustlm-build-scratch-inspect.exe"
  ]) assert.equal(fs.lstatSync(path.join(bound.outputPath, required)).isFile(), true,
    required);
});

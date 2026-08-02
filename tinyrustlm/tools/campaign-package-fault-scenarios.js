"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");

const packageScenarioSchema = "tinyrustlm.package_fault_scenario.v1";
const packageOwnerSchema = "tinyrustlm.package_fault_owner.v1";
const packageOwnerMarker = ".tinyrustlm-package-fault-owner.json";
const packageFaultIds = Object.freeze(["package-restore-drift"]);
const packageFaultIdSet = new Set(packageFaultIds);
const requiredPackageIds = Object.freeze([
  "TinyRustLM.Abstractions",
  "TinyRustLM.Core",
  "TinyRustLM.Memory",
  "TinyRustLM.P2P"
]);
const scenarioTimeoutMs = 120_000;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashFileSync(filePath, algorithm = "sha256", encoding = "hex") {
  const hash = crypto.createHash(algorithm);
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest(encoding);
}

function regularFile(filePath, maximumBytes, allowSymlink = false) {
  if (typeof filePath !== "string" || filePath.length === 0) return false;
  const resolved = path.resolve(filePath);
  const linkStat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  if (!linkStat || (!allowSymlink && linkStat.isSymbolicLink())) return false;
  const target = allowSymlink ? fs.realpathSync.native(resolved) : resolved;
  const stat = fs.statSync(target, { throwIfNoEntry: false });
  return Boolean(stat?.isFile() && stat.size > 0 && stat.size <= maximumBytes);
}

function plainDirectory(directoryPath) {
  if (typeof directoryPath !== "string" || directoryPath.length === 0) return false;
  const stat = fs.lstatSync(path.resolve(directoryPath), { throwIfNoEntry: false });
  return Boolean(stat?.isDirectory() && !stat.isSymbolicLink());
}

function isStrictChild(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative.length > 0 && !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." && !path.isAbsolute(relative);
}

function packageFileName(packageId, version) {
  return `${packageId}.${version}.nupkg`;
}

function inspectPackageSource(packageSource) {
  invariant(plainDirectory(packageSource), "package source is missing or unsafe");
  const sourcePath = fs.realpathSync.native(path.resolve(packageSource));
  const files = fs.readdirSync(sourcePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".nupkg"))
    .map((entry) => entry.name).sort();
  invariant(files.length >= requiredPackageIds.length && files.length <= 64,
    "package source does not contain a bounded package set");
  const versions = new Set();
  const required = [];
  for (const packageId of requiredPackageIds) {
    const prefix = `${packageId}.`;
    const matches = files.filter((name) => name.startsWith(prefix) && name.endsWith(".nupkg"));
    invariant(matches.length === 1, `package source must contain exactly one ${packageId} package`);
    const version = matches[0].slice(prefix.length, -".nupkg".length);
    invariant(/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(version),
      `${packageId} package version is invalid`);
    versions.add(version);
    const filePath = path.join(sourcePath, matches[0]);
    invariant(regularFile(filePath, 256 * 1024 * 1024), `${packageId} package is invalid`);
    required.push(Object.freeze({
      byteCount: fs.statSync(filePath).size,
      fileName: matches[0],
      packageId,
      path: filePath,
      sha256: hashFileSync(filePath),
      sha512: hashFileSync(filePath, "sha512", "base64"),
      version
    }));
  }
  invariant(versions.size === 1, "required packages do not share one exact version");
  const version = [...versions][0];
  const entries = files.map((fileName) => {
    const filePath = path.join(sourcePath, fileName);
    invariant(regularFile(filePath, 256 * 1024 * 1024),
      `package source entry is invalid: ${fileName}`);
    return Object.freeze({
      byteCount: fs.statSync(filePath).size,
      fileName,
      path: filePath,
      sha256: hashFileSync(filePath)
    });
  });
  return Object.freeze({
    entries: Object.freeze(entries),
    manifestSha256: sha256(canonicalJson(entries.map(({ byteCount, fileName, sha256: digest }) => ({
      byteCount,
      fileName,
      sha256: digest
    })))),
    required: Object.freeze(required),
    sourcePath,
    version
  });
}

function validatePackageFaultInputs(options) {
  invariant(options && typeof options === "object" && !Array.isArray(options),
    "package fault inputs are invalid");
  invariant(regularFile(options.dotnetPath, 512 * 1024 * 1024, true),
    "dotnet executable is missing or invalid");
  invariant(regularFile(options.modelFixturePath, 64 * 1024 * 1024),
    "package model fixture is missing or invalid");
  invariant(typeof options.workParent === "string" && options.workParent.length > 0,
    "package fault work parent is required");
  return inspectPackageSource(options.packageSource);
}

function createOwnedRoot(parentDirectory, campaignId) {
  fs.mkdirSync(parentDirectory, { recursive: true });
  const realParent = fs.realpathSync.native(path.resolve(parentDirectory));
  const rootPath = fs.realpathSync.native(fs.mkdtempSync(
    path.join(realParent, "tinyrustlm-package-fault-")
  ));
  invariant(isStrictChild(realParent, rootPath), "package work root escaped its parent");
  const ownerNonce = crypto.randomBytes(16).toString("hex");
  const marker = Object.freeze({
    campaignId: String(campaignId || ""),
    ownerNonce,
    schema: packageOwnerSchema
  });
  fs.writeFileSync(path.join(rootPath, packageOwnerMarker), `${canonicalJson(marker)}\n`, {
    encoding: "utf8",
    flag: "wx"
  });
  return Object.freeze({ marker, realParent, rootPath });
}

function verifyOwnedRoot(handle) {
  invariant(handle && isStrictChild(handle.realParent, handle.rootPath),
    "package work root ownership is invalid");
  const realRoot = fs.realpathSync.native(handle.rootPath);
  invariant(realRoot === handle.rootPath && isStrictChild(handle.realParent, realRoot),
    "package work root changed identity");
  const markerPath = path.join(realRoot, packageOwnerMarker);
  const markerStat = fs.lstatSync(markerPath, { throwIfNoEntry: false });
  invariant(markerStat?.isFile() && !markerStat.isSymbolicLink(),
    "package work root marker is missing or unsafe");
  const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  invariant(canonicalJson(marker) === canonicalJson(handle.marker),
    "package work root marker changed");
  return realRoot;
}

function removeOwnedChild(handle, childPath) {
  const rootPath = verifyOwnedRoot(handle);
  const target = path.resolve(childPath);
  invariant(isStrictChild(rootPath, target), "package cleanup target escaped its owned root");
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  invariant(!stat.isSymbolicLink(), "package cleanup target is a symbolic link");
  const realTarget = fs.realpathSync.native(target);
  invariant(isStrictChild(rootPath, realTarget), "package cleanup target changed identity");
  fs.rmSync(realTarget, { recursive: stat.isDirectory(), force: false, maxRetries: 3, retryDelay: 50 });
  invariant(!fs.existsSync(target), "package cleanup target still exists");
}

function removeOwnedRoot(handle) {
  const rootPath = verifyOwnedRoot(handle);
  fs.rmSync(rootPath, { recursive: true, force: false, maxRetries: 3, retryDelay: 50 });
  invariant(!fs.existsSync(rootPath), "package work root deletion failed");
  return Object.freeze({
    deleted: true,
    ownerIdentitySha256: sha256(canonicalJson(handle.marker)),
    schema: "tinyrustlm.package_fault_deletion.v1"
  });
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function writeNuGetConfig(filePath, packageSource) {
  const content = [
    "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
    "<configuration>",
    "  <packageSources>",
    "    <clear />",
    `    <add key=\"approved-local\" value=\"${xmlEscape(packageSource)}\" />`,
    "  </packageSources>",
    "</configuration>",
    ""
  ].join("\n");
  fs.writeFileSync(filePath, content, { encoding: "utf8", flag: "wx" });
}

function writeConsumerProject(projectDirectory, version) {
  fs.mkdirSync(projectDirectory, { recursive: false });
  const references = ["TinyRustLM.Core", "TinyRustLM.Memory", "TinyRustLM.P2P"]
    .map((packageId) => `    <PackageReference Include=\"${packageId}\" Version=\"[${version}]\" />`)
    .join("\n");
  const project = [
    "<Project Sdk=\"Microsoft.NET.Sdk\">",
    "  <PropertyGroup>",
    "    <OutputType>Exe</OutputType>",
    "    <TargetFramework>net8.0</TargetFramework>",
    "    <ImplicitUsings>enable</ImplicitUsings>",
    "    <Nullable>enable</Nullable>",
    "    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>",
    "  </PropertyGroup>",
    "  <ItemGroup>",
    references,
    "  </ItemGroup>",
    "</Project>",
    ""
  ].join("\n");
  const program = [
    "using TinyRustLM;",
    "",
    "var modelPath = args.Length == 1 ? args[0] : throw new ArgumentException(\"model path required\");",
    "var inspection = new TinySlmInspector().Inspect(modelPath);",
    "if (inspection.ByteCount <= 0 || !inspection.Sha256.StartsWith(\"sha256:\", StringComparison.Ordinal))",
    "{",
    "    throw new InvalidOperationException(\"model inspection failed\");",
    "}",
    "_ = new TinyRustLmMemoryClient().GetSupportedSetups();",
    "_ = new TinyRustLmP2PClient();",
    "var factory = new TinyRustLmRuntimeFactory();",
    "using var runtime = factory.CreateRuntime();",
    "runtime.LoadModel(modelPath, inspection.Sha256);",
    "var generated = runtime.Generate(\"hello\", new TinyRustLmGenerationOptions(MaxNewTokens: 1));",
    "if (generated.Diagnostics.Length == 0)",
    "{",
    "    throw new InvalidOperationException(\"runtime execution failed\");",
    "}",
    "Console.WriteLine(\"TINYRUSTLM_LOCKED_CONSUMER_PASS\");",
    ""
  ].join("\n");
  fs.writeFileSync(path.join(projectDirectory, "Consumer.csproj"), project,
    { encoding: "utf8", flag: "wx" });
  fs.writeFileSync(path.join(projectDirectory, "Program.cs"), program,
    { encoding: "utf8", flag: "wx" });
}

function commandEnvironment(rootPath, packagesPath, httpCachePath) {
  const environment = {};
  for (const key of [
    "ComSpec", "DOTNET_ROOT", "LANG", "PATHEXT", "Path", "PATH", "ProgramFiles",
    "ProgramFiles(x86)", "ProgramW6432", "SystemRoot", "WINDIR"
  ]) {
    if (typeof process.env[key] === "string") environment[key] = process.env[key];
  }
  const cliHome = path.join(rootPath, "dotnet-home");
  const appData = path.join(cliHome, "AppData", "Roaming");
  const localAppData = path.join(cliHome, "AppData", "Local");
  const tempPath = path.join(rootPath, "temp");
  fs.mkdirSync(cliHome, { recursive: true });
  fs.mkdirSync(appData, { recursive: true });
  fs.mkdirSync(localAppData, { recursive: true });
  fs.mkdirSync(tempPath, { recursive: true });
  return {
    ...environment,
    APPDATA: appData,
    DOTNET_CLI_HOME: cliHome,
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_MULTILEVEL_LOOKUP: "0",
    DOTNET_NOLOGO: "1",
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
    HOME: cliHome,
    LOCALAPPDATA: localAppData,
    NUGET_HTTP_CACHE_PATH: httpCachePath,
    NUGET_PACKAGES: packagesPath,
    NUGET_XMLDOC_MODE: "skip",
    TEMP: tempPath,
    TMP: tempPath,
    USERPROFILE: cliHome
  };
}

function boundedCommandDiagnostic(transcript, pathsToRedact) {
  let sanitized = String(transcript || "");
  for (const value of [...new Set(pathsToRedact.filter(Boolean).map((item) => String(item)))]
    .sort((left, right) => right.length - left.length)) {
    sanitized = sanitized.replaceAll(value, "[path]");
  }
  sanitized = sanitized.replace(/https?:\/\/\S+/giu, "[url]")
    .replace(/[\t ]+/gu, " ");
  const lines = sanitized.split(/\r?\n/gu).map((line) => line.trim())
    .filter((line) => /error|cannot|failed|invalid/iu.test(line));
  return lines.slice(0, 2).join(" | ").slice(0, 320);
}

function runDotnet(dotnetPath, args, environment, cwd, timeout = 60_000, redactions = []) {
  const child = childProcess.spawnSync(dotnetPath, args, {
    cwd,
    dotnetPath,
    ...redactions,
    encoding: "utf8",
    env: environment,
    maxBuffer: 1024 * 1024,
    timeout,
    windowsHide: true
  });
  const transcript = `${child.stdout || ""}\n${child.stderr || ""}`;
  const boundedDiagnostic = boundedCommandDiagnostic(transcript, [
    cwd,
    ...args.filter((item) => path.isAbsolute(String(item))),
    environment.DOTNET_CLI_HOME,
    environment.HOME,
    environment.NUGET_HTTP_CACHE_PATH,
    environment.NUGET_PACKAGES,
    environment.TEMP,
    environment.TMP,
    environment.USERPROFILE
  ]);
  const diagnosticKinds = [];
  for (const [kind, pattern] of [
    ["argument-rejected", /unrecognized command|unrecognized argument|unknown option|expects a single argument/iu],
    ["package-not-found", /unable to find package|package .* is not found/iu],
    ["source-unavailable", /unable to load the service index|source .* does not exist/iu],
    ["project-invalid", /project file .* invalid|does not exist|no project was found/iu],
    ["access-denied", /access .* denied|permission denied/iu],
    ["restore-error", /\berror\b/iu]
  ]) {
    if (pattern.test(transcript)) diagnosticKinds.push(kind);
  }
  const diagnosticTerms = [
    "access", "argument", "cache", "cannot", "config", "configuration", "directory", "file",
    "framework", "global", "invalid", "lock", "missing", "nuget", "option", "package",
    "project", "restore", "root", "source", "version", "write"
  ].filter((term) => new RegExp(`\\b${term}\\b`, "iu").test(transcript));
  const exceptionTypes = Object.freeze([
    ...new Set(transcript.match(/\b(?:System\.)?[A-Za-z]+Exception\b/gu) || [])
  ].sort());
  return Object.freeze({
    boundedDiagnostic,
    diagnosticCodes: Object.freeze([
      ...new Set(transcript.match(/\b(?:NU|MSB|NETSDK)\d{4}\b/gu) || [])
    ].sort()),
    error: child.error ? String(child.error.code || child.error.name || "spawn-error") : null,
    diagnosticKinds: Object.freeze(diagnosticKinds),
    diagnosticTerms: Object.freeze(diagnosticTerms),
    exceptionTypes,
    outputSha256: sha256(transcript),
    signal: child.signal,
    status: child.status,
    transcript
  });
}

function assertCommandPassed(result, label) {
  invariant(result.error === null && result.signal === null && result.status === 0,
    `${label} failed (status=${result.status};codes=${result.diagnosticCodes.join(",") || "none"};` +
      `kinds=${result.diagnosticKinds.join(",") || "none"};` +
      `terms=${result.diagnosticTerms.join(",") || "none"};` +
      `exceptions=${result.exceptionTypes.join(",") || "none"};` +
      `detail=${result.boundedDiagnostic || "none"};output=${result.outputSha256})`);
}

function readAndValidateLock(lockPath, packages) {
  invariant(regularFile(lockPath, 1024 * 1024), "consumer packages.lock.json is missing");
  const bytes = fs.readFileSync(lockPath);
  const lock = JSON.parse(bytes.toString("utf8"));
  invariant(lock.version === 1 && lock.dependencies && typeof lock.dependencies === "object",
    "consumer packages.lock.json has an invalid schema");
  const target = Object.values(lock.dependencies).find((value) =>
    value && typeof value === "object" && !Array.isArray(value));
  invariant(target, "consumer packages.lock.json has no target dependencies");
  for (const packageEntry of packages) {
    const dependency = target[packageEntry.packageId];
    invariant(dependency?.resolved === packageEntry.version,
      `consumer lock does not bind ${packageEntry.packageId} package version`);
    invariant(dependency.contentHash === packageEntry.sha512,
      `consumer lock hash differs for ${packageEntry.packageId} ` +
      `(actual=${dependency.contentHash};expected=${packageEntry.sha512})`);
  }
  return Object.freeze({ bytes, sha256: sha256(bytes) });
}

function copyAndDriftFeed(source, destination) {
  fs.mkdirSync(destination, { recursive: false });
  for (const entry of source.entries) {
    fs.copyFileSync(entry.path, path.join(destination, entry.fileName), fs.constants.COPYFILE_EXCL);
  }
  const core = source.required.find((entry) => entry.packageId === "TinyRustLM.Core");
  invariant(core, "approved package source omitted TinyRustLM.Core");
  const target = path.join(destination, core.fileName);
  fs.appendFileSync(target, Buffer.from("tinyrustlm-package-drift-v1", "ascii"));
  const driftedSha256 = hashFileSync(target);
  invariant(driftedSha256 !== core.sha256, "package drift mutation did not change bytes");
  return Object.freeze({ driftedSha256, originalSha256: core.sha256 });
}

function verifyRecoveredPackages(cachePath, packageEntries) {
  const recovered = [];
  for (const entry of packageEntries) {
    const lowerId = entry.packageId.toLowerCase();
    const lowerVersion = entry.version.toLowerCase();
    const packagePath = path.join(cachePath, lowerId, lowerVersion,
      `${lowerId}.${lowerVersion}.nupkg`);
    invariant(regularFile(packagePath, 256 * 1024 * 1024),
      `recovered cache omitted ${entry.packageId}`);
    const digest = hashFileSync(packagePath);
    invariant(digest === entry.sha256, `recovered ${entry.packageId} package hash changed`);
    recovered.push(Object.freeze({ packageId: entry.packageId, sha256: digest }));
  }
  return Object.freeze({
    entries: Object.freeze(recovered),
    manifestSha256: sha256(canonicalJson(recovered))
  });
}

function restoreArguments(projectPath, configPath, cachePath, lockedMode) {
  const args = [
    "restore", projectPath,
    "--configfile", configPath,
    "--packages", cachePath,
    "--force",
    "--no-http-cache",
    "--verbosity", "minimal",
    "-p:RestorePackagesWithLockFile=true"
  ];
  if (lockedMode) args.push("--locked-mode");
  else args.push("--use-lock-file");
  return args;
}

function executePackageRestoreDrift(options) {
  const faultId = "package-restore-drift";
  const packageSource = validatePackageFaultInputs(options);
  const dotnetPath = fs.realpathSync.native(path.resolve(options.dotnetPath));
  const modelFixturePath = path.resolve(options.modelFixturePath);
  const dotnetExecutableSha256 = hashFileSync(dotnetPath);
  const modelFixtureSha256 = hashFileSync(modelFixturePath);
  const handle = createOwnedRoot(path.resolve(options.workParent), options.campaignId);
  let result = null;
  let deletion = null;
  try {
    const projectDirectory = path.join(handle.rootPath, "consumer");
    const approvedConfig = path.join(handle.rootPath, "approved.nuget.config");
    const driftConfig = path.join(handle.rootPath, "drift.nuget.config");
    const driftFeed = path.join(handle.rootPath, "drift-feed");
    const initialCache = path.join(handle.rootPath, "initial-cache");
    const driftCache = path.join(handle.rootPath, "drift-cache");
    const recoveryCache = path.join(handle.rootPath, "recovery-cache");
    const httpCache = path.join(handle.rootPath, "http-cache");
    writeConsumerProject(projectDirectory, packageSource.version);
    writeNuGetConfig(approvedConfig, packageSource.sourcePath);
    const projectPath = path.join(projectDirectory, "Consumer.csproj");
    const initialEnvironment = commandEnvironment(handle.rootPath, initialCache, httpCache);
    const versionResult = runDotnet(dotnetPath, ["--version"], initialEnvironment,
      projectDirectory, 20_000, [packageSource.sourcePath]);
    assertCommandPassed(versionResult, "dotnet version query");
    const dotnetVersion = versionResult.transcript.trim();
    invariant(/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(dotnetVersion),
      "dotnet version output is invalid");

    const initialRestore = runDotnet(dotnetPath,
      restoreArguments(projectPath, approvedConfig, initialCache, false),
      initialEnvironment, projectDirectory, 60_000, [packageSource.sourcePath]);
    assertCommandPassed(initialRestore, "initial lock-file restore");
    const lockPath = path.join(projectDirectory, "packages.lock.json");
    const approvedLock = readAndValidateLock(lockPath, packageSource.required);

    const drift = copyAndDriftFeed(packageSource, driftFeed);
    writeNuGetConfig(driftConfig, driftFeed);
    removeOwnedChild(handle, path.join(projectDirectory, "obj"));
    const driftEnvironment = commandEnvironment(handle.rootPath, driftCache,
      path.join(handle.rootPath, "drift-http-cache"));
    const driftRestore = runDotnet(dotnetPath,
      restoreArguments(projectPath, driftConfig, driftCache, true),
      driftEnvironment, projectDirectory, 60_000, [driftFeed]);
    const driftDetected = driftRestore.status !== 0 && driftRestore.signal === null &&
      driftRestore.error === null && (driftRestore.diagnosticCodes.includes("NU1403") ||
        /content hash|does not match|integrity|corrupt/iu.test(driftRestore.transcript));
    invariant(driftDetected, "locked restore did not reject changed package bytes");

    removeOwnedChild(handle, driftCache);
    removeOwnedChild(handle, path.join(projectDirectory, "obj"));
    removeOwnedChild(handle, driftFeed);
    removeOwnedChild(handle, path.join(handle.rootPath, "drift-http-cache"));
    const driftedRestoreDiscarded = !fs.existsSync(driftCache) && !fs.existsSync(driftFeed);

    removeOwnedChild(handle, initialCache);
    removeOwnedChild(handle, httpCache);
    const recoveryEnvironment = commandEnvironment(handle.rootPath, recoveryCache,
      path.join(handle.rootPath, "recovery-http-cache"));
    const recoveryRestore = runDotnet(dotnetPath,
      restoreArguments(projectPath, approvedConfig, recoveryCache, true),
      recoveryEnvironment, projectDirectory, 60_000, [packageSource.sourcePath]);
    assertCommandPassed(recoveryRestore, "recovery locked restore");
    const recoveredLock = readAndValidateLock(lockPath, packageSource.required);
    invariant(recoveredLock.sha256 === approvedLock.sha256,
      "recovery locked restore changed packages.lock.json");
    const recoveredPackages = verifyRecoveredPackages(recoveryCache, packageSource.required);
    const consumerRun = runDotnet(dotnetPath, [
      "run", "--project", projectPath, "--configuration", "Release", "--no-restore",
      "--", modelFixturePath
    ], recoveryEnvironment, projectDirectory, 60_000,
    [packageSource.sourcePath, modelFixturePath]);
    assertCommandPassed(consumerRun, "locked package consumer execution");
    const consumerExecutionPassed = consumerRun.transcript.includes(
      "TINYRUSTLM_LOCKED_CONSUMER_PASS");
    invariant(consumerExecutionPassed, "locked package consumer omitted its completion marker");

    result = {
      approvedLockSha256: approvedLock.sha256,
      approvedPackageSetSha256: packageSource.manifestSha256,
      consumerExecutionPassed,
      consumerOutputSha256: consumerRun.outputSha256,
      dotnetVersion,
      driftDiagnosticCodes: driftRestore.diagnosticCodes,
      driftRestoreOutputSha256: driftRestore.outputSha256,
      driftedPackageSha256: drift.driftedSha256,
      driftedRestoreDiscarded,
      isolatedCacheRecreated: recoveryRestore.status === 0 && !fs.existsSync(initialCache),
      lockedModeRestore: true,
      modelFixtureSha256,
      packageHashesVerified: recoveredPackages.entries.length === requiredPackageIds.length,
      passed: driftDetected && driftedRestoreDiscarded && consumerExecutionPassed,
      recoveredPackageSetSha256: recoveredPackages.manifestSha256,
      restoreDriftDetected: driftDetected
    };
  } finally {
    if (fs.existsSync(handle.rootPath)) deletion = removeOwnedRoot(handle);
  }
  invariant(result?.passed === true && deletion?.deleted === true,
    "package restore drift scenario did not pass and clean up");
  result.ownedWorkRootDeleted = true;
  return Object.freeze({
    hardwareEvidence: Object.freeze({
      actualDotnetProcess: true,
      consumerExecutionPassed: true,
      dotnetExecutableHashVerified: true,
      isolatedNuGetCache: true,
      lockedModeRestore: true,
      ownedWorkRootDeleted: true,
      packageContentHashDriftObserved: true,
      packageHashesVerified: true
    }),
    observationCodes: Object.freeze([
      "restore-drift-detected",
      "isolated-cache-recreated",
      "locked-consumer-execution-pass"
    ]),
    outputHashes: Object.freeze({
      approvedLock: result.approvedLockSha256,
      approvedPackageSet: result.approvedPackageSetSha256,
      consumerExecution: result.consumerOutputSha256,
      dotnetExecutable: dotnetExecutableSha256,
      dotnetVersion: sha256(result.dotnetVersion),
      driftedPackage: result.driftedPackageSha256,
      driftRestoreTranscript: result.driftRestoreOutputSha256,
      modelFixture: modelFixtureSha256,
      ownedWorkRootDeletion: sha256(canonicalJson(deletion)),
      recoveredPackageSet: result.recoveredPackageSetSha256,
      scenarioOutcome: sha256(canonicalJson(result))
    })
  });
}

const childScenarios = Object.freeze({
  "package-restore-drift": executePackageRestoreDrift
});

function validateChildEvidence(value, faultId) {
  invariant(value && typeof value === "object" && !Array.isArray(value),
    `${faultId} package child returned invalid evidence`);
  invariant(Array.isArray(value.observationCodes) && value.observationCodes.length === 3,
    `${faultId} package child omitted observation codes`);
  invariant(value.outputHashes && typeof value.outputHashes === "object",
    `${faultId} package child omitted output hashes`);
  for (const digest of Object.values(value.outputHashes)) {
    invariant(/^[a-f0-9]{64}$/u.test(String(digest || "")),
      `${faultId} package child output hash is invalid`);
  }
  const hardware = value.hardwareEvidence || {};
  invariant(hardware.actualDotnetProcess === true &&
    hardware.consumerExecutionPassed === true &&
    hardware.dotnetExecutableHashVerified === true &&
    hardware.isolatedNuGetCache === true &&
    hardware.lockedModeRestore === true &&
    hardware.ownedWorkRootDeleted === true &&
    hardware.packageContentHashDriftObserved === true &&
    hardware.packageHashesVerified === true,
    `${faultId} package child hardware evidence is incomplete`);
  return Object.freeze({
    hardwareEvidence: Object.freeze({ ...hardware }),
    observationCodes: Object.freeze([...value.observationCodes]),
    outputHashes: Object.freeze({ ...value.outputHashes })
  });
}

function runPackageFaultScenario(faultId, options) {
  invariant(packageFaultIdSet.has(faultId), "package fault ID is unsupported");
  validatePackageFaultInputs(options);
  const child = childProcess.spawnSync(process.execPath, [
    __filename,
    "--child",
    faultId,
    path.resolve(options.dotnetPath),
    path.resolve(options.packageSource),
    path.resolve(options.modelFixturePath),
    path.resolve(options.workParent),
    String(options.campaignId || "")
  ], {
    encoding: "utf8",
    maxBuffer: 256 * 1024,
    timeout: scenarioTimeoutMs,
    windowsHide: true
  });
  if (child.error || child.signal !== null || child.status !== 0) {
    const diagnostic = String(child.stderr || child.error?.message || "no diagnostic")
      .replace(/[\r\n]+/gu, " ").replace(/[A-Za-z]:\\[^ ]+/gu, "[path]").slice(0, 240);
    throw new Error(`${faultId} package scenario failed: ${diagnostic}`);
  }
  invariant(child.stderr === "", `${faultId} package scenario wrote diagnostics`);
  let value;
  try {
    value = JSON.parse(child.stdout.trim());
  } catch (_error) {
    throw new Error(`${faultId} package scenario returned invalid JSON`);
  }
  return validateChildEvidence(value, faultId);
}

async function childMain(argv) {
  invariant(argv.length === 7 && argv[0] === "--child", "package child arguments are invalid");
  const faultId = argv[1];
  invariant(packageFaultIdSet.has(faultId), "package child fault ID is unsupported");
  const result = childScenarios[faultId]({
    campaignId: argv[6],
    dotnetPath: path.resolve(argv[2]),
    modelFixturePath: path.resolve(argv[4]),
    packageSource: path.resolve(argv[3]),
    workParent: path.resolve(argv[5])
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  childMain(process.argv.slice(2)).catch((error) => {
    const diagnostic = String(error?.message || error).replace(/[\r\n]+/gu, " ")
      .replace(/[A-Za-z]:\\[^ ]+/gu, "[path]").slice(0, 240);
    process.stderr.write(`${diagnostic}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  packageFaultIds,
  packageScenarioSchema,
  runPackageFaultScenario,
  validatePackageFaultInputs
});

"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate } = require("./durable-files.js");
const {
  expectedWorkloads,
  validateManifestFile
} = require("./vector-physical-target-preregistration.js");
const {
  validatePreviousReceiptFile: validateRetrievalReceiptFile
} = require("./vector-retrieval-receipt.js");
const {
  validateReceiptFile: validateBrowserReceiptFile
} = require("./vector-browser-wasm-verification.js");
const { readGitBlob } = require("./vector-historical-git-input.js");

const sampleSchema = "tinyrustlm.exact_flat_physical_target_sample.v1";
const observationSchema = "tinyrustlm.exact_flat_physical_target_observation.v1";
const attemptSchema = "tinyrustlm.exact_flat_physical_target_attempt.v1";
const expectedExperimentId = "exact-flat-physical-target-win-x64-20260722";
const repositoryRoot = path.resolve(__dirname, "../..");
const observationRelativePath =
  "tinyrustlm/experiments/vector-quantization/exact-flat-physical-target-observation-v1.json";
const observationPath = path.join(repositoryRoot, observationRelativePath);
const attemptRelativeDirectory =
  "tinyrustlm/experiments/vector-quantization/physical-target-attempts/sha256";
const attemptDirectory = path.join(repositoryRoot, attemptRelativeDirectory);
const preregistrationRelativePath =
  "tinyrustlm/experiments/vector-quantization/exact-flat-physical-target-preregistration.v1.json";
const maximumInputBytes = 16 * 1024 * 1024;
const maximumEvidenceBytes = 4 * 1024 * 1024;
const maximumCommandOutputBytes = 32 * 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const observationIdPattern = /^exact-flat-physical-target-[a-f0-9]{16}$/u;
const attemptIdPattern = /^exact-flat-physical-target-attempt-[a-f0-9]{16}$/u;
const safeVersionPattern = /^[A-Za-z0-9][A-Za-z0-9 ._()+:/-]{0,255}$/u;
const forbiddenTextPattern =
  /(?:[a-z]:[\\/]|\/home\/|\/mnt\/[a-z]\/|bearer\s|token=|secret=|password=|serial(?:number)?=|turn\d+(?:search|view)\d+)/iu;
const historicalInputCache = new Map();

const cratePrefix = "rust/experiments/tinyrustlm-vector-oracle/";
const crateInputs = Object.freeze([
  `${cratePrefix}Cargo.toml`,
  `${cratePrefix}src/accounting.rs`,
  `${cratePrefix}src/bitpack.rs`,
  `${cratePrefix}src/codebook.rs`,
  `${cratePrefix}src/error.rs`,
  `${cratePrefix}src/flat_index.rs`,
  `${cratePrefix}src/lib.rs`,
  `${cratePrefix}src/metrics.rs`,
  `${cratePrefix}src/prng.rs`,
  `${cratePrefix}src/score.rs`,
  `${cratePrefix}src/sha256.rs`,
  `${cratePrefix}src/transform.rs`,
  `${cratePrefix}tests/flat_index_test.rs`,
  `${cratePrefix}tests/lib_test.rs`
]);

const inputPaths = Object.freeze([
  ...crateInputs,
  "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-verification-v1.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-physical-target-benchmark.rs",
  preregistrationRelativePath,
  "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-verification-v1.json",
  "tinyrustlm/tests/campaign-evidence-store.test.js",
  "tinyrustlm/tests/durable-files.test.js",
  "tinyrustlm/tests/vector-browser-wasm-verification.test.js",
  "tinyrustlm/tests/vector-physical-target-observation.test.js",
  "tinyrustlm/tests/vector-physical-target-preregistration.test.js",
  "tinyrustlm/tests/vector-retrieval-receipt.test.js",
  "tinyrustlm/tools/campaign-evidence-store.js",
  "tinyrustlm/tools/durable-files.js",
  "tinyrustlm/tools/vector-browser-wasm-verification.js",
  "tinyrustlm/tools/vector-physical-target-observation.js",
  "tinyrustlm/tools/vector-physical-target-preregistration.js",
  "tinyrustlm/tools/vector-retrieval-receipt.js"
]);

const requiredGates = Object.freeze([
  Object.freeze({
    gateId: "physical-target-preregistration-and-evidence-tests",
    executable: "node",
    arguments: Object.freeze([
      "--test",
      "tinyrustlm/tests/campaign-evidence-store.test.js",
      "tinyrustlm/tests/durable-files.test.js",
      "tinyrustlm/tests/vector-browser-wasm-verification.test.js",
      "tinyrustlm/tests/vector-physical-target-observation.test.js",
      "tinyrustlm/tests/vector-physical-target-preregistration.test.js",
      "tinyrustlm/tests/vector-retrieval-receipt.test.js"
    ])
  }),
  Object.freeze({
    gateId: "physical-target-preregistration-validation",
    executable: "node",
    arguments: Object.freeze([
      "tinyrustlm/tools/vector-physical-target-preregistration.js"
    ])
  }),
  Object.freeze({
    gateId: "exact-flat-native-tests",
    executable: "cargo",
    arguments: Object.freeze(["test", "-p", "tinyrustlm-vector-oracle"])
  }),
  Object.freeze({
    gateId: "exact-flat-strict-clippy",
    executable: "cargo",
    arguments: Object.freeze([
      "clippy", "-p", "tinyrustlm-vector-oracle", "--all-targets", "--", "-D", "warnings"
    ])
  }),
  Object.freeze({
    gateId: "exact-flat-rustdoc",
    executable: "cargo",
    arguments: Object.freeze(["doc", "-p", "tinyrustlm-vector-oracle", "--no-deps"])
  })
]);

const authority = Object.freeze({
  namedTargetLatencyMeasured: true,
  namedTargetThroughputMeasured: true,
  namedTargetProcessMemoryMeasured: true,
  namedTargetEnergyMeasured: false,
  physicalChassisIndependentlyAttested: false,
  completePhysicalTargetGateVerified: false,
  browserPerformanceMeasured: false,
  compressedRetrievalVerified: false,
  turboVecParityVerified: false,
  representativeRetrievalQualityVerified: false,
  durableFilesystemDeletionVerified: false,
  productIntegrationAuthorized: false,
  trainingAuthorized: false,
  releaseAuthorized: false
});

const openGaps = Object.freeze([
  Object.freeze({
    gapId: "target-energy-joules",
    status: "not-measured",
    statement: "Windows advertises the Energy Meter counter set but exposes no counter instance, and no authoritative joule source is available."
  }),
  Object.freeze({
    gapId: "physical-chassis-attestation",
    status: "not-independently-verified",
    statement: "Registry CPU and board identity are observed, but no independent physical-chassis attestation is bound to this run."
  }),
  Object.freeze({
    gapId: "retrieval-corpus-quality-metrics",
    status: "not-run",
    statement: "No sealed representative corpus has measured recall, MRR, NDCG, or usefulness."
  }),
  Object.freeze({
    gapId: "durable-filesystem-deletion-proof",
    status: "not-run",
    statement: "No crash-recovered on-disk snapshot has proved deleted vector bytes absent after compaction."
  })
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  invariant(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} fields are invalid`);
}

function exactValue(value, expected, label) {
  invariant(JSON.stringify(value) === JSON.stringify(expected), `${label} is invalid`);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sha256File(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const hash = crypto.createHash("sha256");
  try {
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function canonicalPrettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashInput(relativePath) {
  invariant(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u.test(relativePath),
    `unsafe input path: ${relativePath}`);
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, absolutePath);
  invariant(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    `input escaped repository root: ${relativePath}`);
  const stat = fs.lstatSync(absolutePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumInputBytes, `input is not a bounded regular file: ${relativePath}`);
  return Object.freeze({ path: relativePath, bytes: stat.size, sha256: sha256File(absolutePath) });
}

function hashInputAtRevision(relativePath, revision) {
  invariant(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u.test(relativePath),
    `unsafe historical input path: ${relativePath}`);
  invariant(sourceRevisionPattern.test(revision), "historical input revision is invalid");
  const cacheKey = `${revision}:${relativePath}`;
  const cached = historicalInputCache.get(cacheKey);
  if (cached) return cached;
  const bytes = readGitBlob(
    repositoryRoot,
    revision,
    relativePath,
    maximumInputBytes
  );
  const input = Object.freeze({
    path: relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
  historicalInputCache.set(cacheKey, input);
  return input;
}

function assertInputsCommitted() {
  const tracked = childProcess.spawnSync("git", ["ls-files", "--error-unmatch", "--", ...inputPaths], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(tracked.status === 0 && !tracked.error,
    "physical-target observation inputs are not all tracked");
  for (const argumentsList of [
    ["diff", "--quiet", "--", ...inputPaths],
    ["diff", "--cached", "--quiet", "--", ...inputPaths]
  ]) {
    const result = childProcess.spawnSync("git", argumentsList, {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      shell: false
    });
    invariant(result.status === 0 && !result.error,
      "physical-target observation inputs differ from the current commit");
  }
  const closure = childProcess.spawnSync("git", ["ls-files", "--", cratePrefix], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(closure.status === 0 && !closure.error,
    "vector-oracle source closure could not be enumerated");
  const observed = String(closure.stdout || "").trim().split(/\r?\n/u)
    .filter(Boolean).sort();
  exactValue(observed, [...crateInputs].sort(), "vector-oracle source closure");
}

function sourceRevision() {
  const result = childProcess.spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(result.status === 0 && !result.error, "source revision probe failed");
  const revision = String(result.stdout || "").trim();
  invariant(sourceRevisionPattern.test(revision), "source revision is invalid");
  return revision;
}

function executablePath(label) {
  if (label === "node") return fs.realpathSync.native(process.execPath);
  if (label === "powershell") {
    invariant(process.env.SystemRoot, "SystemRoot is unavailable");
    return fs.realpathSync.native(path.join(
      process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"
    ));
  }
  if (label === "rustc") {
    const configured = process.env.RUSTC;
    if (configured) return configured;
    const local = process.platform === "win32" && process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, ".cargo", "bin", "rustc.exe")
      : null;
    return local && fs.existsSync(local) ? local : "rustc";
  }
  if (label === "cargo") {
    const configured = process.env.CARGO;
    if (configured) return configured;
    const local = process.platform === "win32" && process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
      : null;
    return local && fs.existsSync(local) ? local : "cargo";
  }
  return label;
}

function rustToolchainBinaryPath(label) {
  invariant(label === "rustc" || label === "cargo", "unsupported Rust tool label");
  const result = childProcess.spawnSync(executablePath("rustc"), ["--print", "sysroot"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    shell: false
  });
  invariant(result.status === 0 && !result.error, "Rust sysroot probe failed");
  const sysroot = String(result.stdout || "").trim();
  const binaryName = process.platform === "win32" ? `${label}.exe` : label;
  return fs.realpathSync.native(path.join(sysroot, "bin", binaryName));
}

function toolVersion(label) {
  let executable = executablePath(label);
  let argumentsList = ["--version"];
  if (label === "powershell") {
    argumentsList = ["-NoProfile", "-NonInteractive", "-Command",
      "$PSVersionTable.PSVersion.ToString()"];
  }
  const result = childProcess.spawnSync(executable, argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    shell: false
  });
  invariant(result.status === 0 && !result.error, `${label} version probe failed`);
  const version = String(result.stdout || result.stderr || "").trim().split(/\r?\n/u)[0];
  invariant(safeVersionPattern.test(version), `${label} version is not public-safe`);
  return version;
}

function toolIdentity(label) {
  const filePath = label === "node" || label === "powershell"
    ? executablePath(label)
    : rustToolchainBinaryPath(label);
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= 1024 * 1024 * 1024, `${label} executable is invalid`);
  return Object.freeze({ version: toolVersion(label), sha256: sha256File(filePath) });
}

function runGate(gate) {
  const result = childProcess.spawnSync(executablePath(gate.executable), gate.arguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: maximumCommandOutputBytes,
    shell: false,
    windowsHide: true
  });
  const output = Buffer.from(`${result.stdout || ""}\n${result.stderr || ""}`, "utf8");
  const evidence = Object.freeze({
    gateId: gate.gateId,
    executable: gate.executable,
    arguments: [...gate.arguments],
    exitCode: Number.isInteger(result.status) ? result.status : -1,
    outputSha256: sha256(output),
    spawnErrorCode: result.error && typeof result.error.code === "string"
      ? result.error.code.slice(0, 64)
      : null
  });
  invariant(evidence.exitCode === 0 && evidence.spawnErrorCode === null,
    `${gate.gateId} failed`);
  return evidence;
}

function runPowerShell(script, maximumBytes = 1024 * 1024) {
  const result = childProcess.spawnSync(executablePath("powershell"), [
    "-NoProfile", "-NonInteractive", "-Command", script
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: maximumBytes,
    windowsHide: true,
    shell: false
  });
  return Object.freeze({
    status: Number.isInteger(result.status) ? result.status : -1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    errorCode: result.error && typeof result.error.code === "string"
      ? result.error.code.slice(0, 64)
      : null
  });
}

function normalizedRegistryString(value, label) {
  invariant(typeof value === "string" && value.length > 0 && value.length <= 256,
    `${label} is invalid`);
  const normalized = value.trim();
  invariant(normalized.length > 0 && /^[\x20-\x7e]+$/u.test(normalized),
    `${label} is invalid`);
  return normalized;
}

function normalizeTargetProbe(observed) {
  exactKeys(observed, ["operatingSystem", "processor", "board"], "target probe");
  exactKeys(observed.operatingSystem, [
    "productName", "displayVersion", "build", "installationType"
  ], "target probe operatingSystem");
  exactKeys(observed.processor, [
    "name", "vendor", "registryMegahertz", "logicalProcessors"
  ], "target probe processor");
  exactKeys(observed.board, [
    "manufacturer", "product", "biosVendor", "biosVersion"
  ], "target probe board");
  invariant(Number.isSafeInteger(observed.processor.registryMegahertz) &&
    observed.processor.registryMegahertz > 0 &&
    observed.processor.registryMegahertz <= 100_000,
  "target probe processor registryMegahertz is invalid");
  invariant(Number.isSafeInteger(observed.processor.logicalProcessors) &&
    observed.processor.logicalProcessors > 0 && observed.processor.logicalProcessors <= 4096,
  "target probe processor logicalProcessors is invalid");
  return Object.freeze({
    operatingSystem: Object.freeze({
      productName: normalizedRegistryString(
        observed.operatingSystem.productName, "target probe productName"),
      displayVersion: normalizedRegistryString(
        observed.operatingSystem.displayVersion, "target probe displayVersion"),
      build: normalizedRegistryString(observed.operatingSystem.build, "target probe build"),
      installationType: normalizedRegistryString(
        observed.operatingSystem.installationType, "target probe installationType")
    }),
    processor: Object.freeze({
      name: normalizedRegistryString(observed.processor.name, "target probe processor name"),
      vendor: normalizedRegistryString(
        observed.processor.vendor, "target probe processor vendor"),
      registryMegahertz: observed.processor.registryMegahertz,
      logicalProcessors: observed.processor.logicalProcessors
    }),
    board: Object.freeze({
      manufacturer: normalizedRegistryString(
        observed.board.manufacturer, "target probe board manufacturer"),
      product: normalizedRegistryString(observed.board.product, "target probe board product"),
      biosVendor: normalizedRegistryString(
        observed.board.biosVendor, "target probe BIOS vendor"),
      biosVersion: normalizedRegistryString(
        observed.board.biosVersion, "target probe BIOS version")
    })
  });
}

function probeTarget(manifest) {
  invariant(process.platform === "win32" && process.arch === "x64",
    "registered target requires win32-x64");
  const registryScript = [
    "$cpu=Get-ItemProperty -LiteralPath 'HKLM:\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0' -ErrorAction Stop",
    "$bios=Get-ItemProperty -LiteralPath 'HKLM:\\HARDWARE\\DESCRIPTION\\System\\BIOS' -ErrorAction Stop",
    "$os=Get-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion' -ErrorAction Stop",
    "$value=[ordered]@{operatingSystem=[ordered]@{productName=$os.ProductName;displayVersion=$os.DisplayVersion;build=($os.CurrentBuildNumber+'.'+$os.UBR);installationType=$os.InstallationType};processor=[ordered]@{name=$cpu.ProcessorNameString;vendor=$cpu.VendorIdentifier;registryMegahertz=[int]$cpu.'~MHz';logicalProcessors=[int]$env:NUMBER_OF_PROCESSORS};board=[ordered]@{manufacturer=$bios.BaseBoardManufacturer;product=$bios.BaseBoardProduct;biosVendor=$bios.BIOSVendor;biosVersion=([string]$bios.BIOSVersion)}}",
    "$value | ConvertTo-Json -Compress -Depth 5"
  ].join("; ");
  const registry = runPowerShell(registryScript);
  invariant(registry.status === 0 && registry.errorCode === null && registry.stderr.trim() === "",
    "registered target registry probe failed");
  const observed = normalizeTargetProbe(JSON.parse(registry.stdout.trim()));
  const power = childProcess.spawnSync("powercfg", ["/getactivescheme"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    shell: false
  });
  invariant(power.status === 0 && !power.error, "registered power plan probe failed");
  const powerText = String(power.stdout || "").trim();
  const match = /GUID:\s*([a-f0-9-]{36})\s+\(([^)]+)\)/iu.exec(powerText);
  invariant(match, "registered power plan output is invalid");
  const target = {
    targetId: manifest.target.targetId,
    runtimeIdentifier: "win-x64",
    architecture: "x86_64",
    operatingSystem: observed.operatingSystem,
    processor: observed.processor,
    board: observed.board,
    powerPlan: { guid: match[1].toLowerCase(), name: match[2] },
    identityEvidence: [...manifest.target.identityEvidence],
    physicalChassisAttestation: manifest.target.physicalChassisAttestation,
    finalReleaseHardwareGateEligible: manifest.target.finalReleaseHardwareGateEligible
  };
  exactValue(target, manifest.target, "live target identity");
  return Object.freeze({
    target: Object.freeze(target),
    evidence: Object.freeze({
      registryProbeOutputSha256: sha256(Buffer.from(registry.stdout, "utf8")),
      powerPlanProbeOutputSha256: sha256(Buffer.from(
        `${power.stdout || ""}\n${power.stderr || ""}`, "utf8")),
      liveIdentityMatchedPreregistration: true
    })
  });
}

function probeEnergyCapability(manifest) {
  const setProbe = runPowerShell(
    "Get-Counter -ListSet 'Energy Meter' -ErrorAction Stop | Select-Object -ExpandProperty CounterSetName"
  );
  invariant(setProbe.status === 0 && setProbe.errorCode === null &&
    setProbe.stdout.trim() === manifest.measurement.energyCounterSet,
  "registered energy counter set is unavailable");
  const sampleProbe = runPowerShell([
    `Get-Counter -Counter '${manifest.measurement.energyCounterPath}' -MaxSamples 1 -ErrorAction Stop`,
    "Select-Object -ExpandProperty CounterSamples",
    "Select-Object Path,InstanceName,CookedValue,RawValue,TimeStamp",
    "ConvertTo-Json -Compress"
  ].join(" | "));
  const instanceObserved = sampleProbe.status === 0 && sampleProbe.errorCode === null &&
    sampleProbe.stderr.trim() === "" && sampleProbe.stdout.trim() !== "";
  invariant(!instanceObserved,
    "registered energy counter capability changed after preregistration");
  return Object.freeze({
    counterSet: manifest.measurement.energyCounterSet,
    counterPath: manifest.measurement.energyCounterPath,
    counterSetAdvertised: true,
    counterInstanceObserved: instanceObserved,
    status: "unavailable",
    reasonCode: "counter-instance-absent",
    joules: null,
    counterSetProbeExitCode: setProbe.status,
    counterSetProbeOutputSha256: sha256(Buffer.from(
      `${setProbe.stdout}\n${setProbe.stderr}`, "utf8")),
    counterInstanceProbeExitCode: sampleProbe.status,
    counterInstanceProbeOutputSha256: sha256(Buffer.from(
      `${sampleProbe.stdout}\n${sampleProbe.stderr}`, "utf8"))
  });
}

function createOwnedBuildDirectory() {
  const parent = fs.realpathSync.native(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, "tinyrustlm-physical-target-"));
  const resolved = fs.realpathSync.native(root);
  invariant(path.dirname(resolved).toLowerCase() === parent.toLowerCase() &&
    path.basename(resolved).startsWith("tinyrustlm-physical-target-"),
  "owned build directory escaped the temporary root");
  const marker = crypto.randomBytes(32);
  fs.writeFileSync(path.join(resolved, ".tinyrustlm-physical-target-owned-v1"), marker,
    { flag: "wx" });
  return Object.freeze({ root: resolved, markerSha256: sha256(marker) });
}

function removeOwnedBuildDirectory(owned) {
  const parent = fs.realpathSync.native(os.tmpdir());
  const resolved = fs.realpathSync.native(owned.root);
  const markerPath = path.join(resolved, ".tinyrustlm-physical-target-owned-v1");
  invariant(path.dirname(resolved).toLowerCase() === parent.toLowerCase() &&
    path.basename(resolved).startsWith("tinyrustlm-physical-target-") &&
    fs.lstatSync(markerPath).isFile() && sha256File(markerPath) === owned.markerSha256,
  "owned build directory marker is invalid");
  fs.rmSync(resolved, { recursive: true, force: false, maxRetries: 5, retryDelay: 100 });
  invariant(!fs.existsSync(resolved), "owned build directory deletion was not proven");
  return Object.freeze({ markerSha256: owned.markerSha256, ownedBuildDirectoryDeleted: true });
}

function materializeBuildArguments(template, outputRoot) {
  invariant(Array.isArray(template) && template[0] === "rustc", "build command is invalid");
  const replacement = outputRoot.replaceAll("\\", "/");
  return template.slice(1).map((argument) =>
    argument.replaceAll("<owned-output-directory>", replacement));
}

function runCompile(role, template, outputRoot) {
  const argumentsList = materializeBuildArguments(template, outputRoot);
  const result = childProcess.spawnSync(executablePath("rustc"), argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: maximumCommandOutputBytes,
    timeout: 120000,
    shell: false,
    windowsHide: true
  });
  const output = Buffer.from(`${result.stdout || ""}\n${result.stderr || ""}`, "utf8");
  const evidence = Object.freeze({
    role,
    executable: "rustc",
    arguments: [...template.slice(1)],
    exitCode: Number.isInteger(result.status) ? result.status : -1,
    outputSha256: sha256(output),
    spawnErrorCode: result.error && typeof result.error.code === "string"
      ? result.error.code.slice(0, 64)
      : null
  });
  invariant(evidence.exitCode === 0 && evidence.spawnErrorCode === null,
    `${role} compilation failed`);
  return evidence;
}

function boundedBinary(filePath, label) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= 1024 * 1024 * 1024, `${label} binary is invalid`);
  return Object.freeze({ bytes: stat.size, sha256: sha256File(filePath) });
}

function validateSample(value, workload, processRun) {
  exactKeys(value, [
    "schema", "workloadId", "processRun", "metric", "normalization", "dimension",
    "recordCount", "topK", "warmupQueries", "measuredQueries", "seed",
    "implementationReceiptSha256", "buildDurationNs", "warmupDurationNs",
    "queryDurationNs", "validationChecksum", "serializedIndexBytes",
    "workingSetAfterBuildBytes", "peakWorkingSetAfterBuildBytes",
    "workingSetAfterSearchBytes", "peakWorkingSetAfterSearchBytes",
    "peakWorkingSetAfterSerializationBytes"
  ], `sample ${workload.workloadId}/${processRun}`);
  invariant(value.schema === sampleSchema && value.workloadId === workload.workloadId &&
    value.processRun === processRun && value.metric === workload.metric &&
    value.normalization === workload.normalization && value.dimension === workload.dimension &&
    value.recordCount === workload.recordCount && value.topK === workload.topK &&
    value.warmupQueries === workload.warmupQueries &&
    value.measuredQueries === workload.measuredQueries && value.seed === workload.seed,
  `sample identity is invalid: ${workload.workloadId}/${processRun}`);
  invariant(value.implementationReceiptSha256 ===
    "893e96f461f701f46a3aaaeecddd67bc2b700625ccdb9f0d83ce4b0b67d8c18c",
  "sample implementation receipt is invalid");
  for (const field of ["buildDurationNs", "warmupDurationNs"]) {
    invariant(Number.isSafeInteger(value[field]) && value[field] > 0,
      `sample ${field} is invalid`);
  }
  invariant(Array.isArray(value.queryDurationNs) &&
    value.queryDurationNs.length === workload.measuredQueries &&
    value.queryDurationNs.every((duration) => Number.isSafeInteger(duration) && duration > 0),
  "sample query durations are invalid");
  invariant(/^[a-f0-9]{16}$/u.test(value.validationChecksum),
    "sample validation checksum is invalid");
  const expectedSerializedBytes = 248 + workload.recordCount * (16 + workload.dimension * 4) + 32;
  invariant(value.serializedIndexBytes === expectedSerializedBytes,
    "sample serialized byte count is invalid");
  for (const field of [
    "workingSetAfterBuildBytes", "peakWorkingSetAfterBuildBytes",
    "workingSetAfterSearchBytes", "peakWorkingSetAfterSearchBytes",
    "peakWorkingSetAfterSerializationBytes"
  ]) {
    invariant(Number.isSafeInteger(value[field]) && value[field] > 0,
      `sample ${field} is invalid`);
  }
  invariant(value.peakWorkingSetAfterBuildBytes >= value.workingSetAfterBuildBytes &&
    value.peakWorkingSetAfterSearchBytes >= value.workingSetAfterSearchBytes &&
    value.peakWorkingSetAfterSearchBytes >= value.peakWorkingSetAfterBuildBytes &&
    value.peakWorkingSetAfterSerializationBytes >= value.peakWorkingSetAfterSearchBytes,
  "sample peak memory is not monotonic");
  return value;
}

function validateSampleOutput(stdout, workload, processRun) {
  const bytes = Buffer.from(stdout, "utf8");
  invariant(bytes.length > 0 && bytes.length <= maximumEvidenceBytes,
    "benchmark sample output is not bounded");
  const sample = validateSample(JSON.parse(stdout), workload, processRun);
  invariant(bytes.equals(Buffer.from(`${JSON.stringify(sample)}\n`, "utf8")),
    "benchmark sample stdout is not canonical compact JSON");
  return sample;
}

function executeSample(binaryPath, workload, processRun, timeoutMs) {
  const argumentsList = ["--workload", workload.workloadId, "--run", String(processRun)];
  const result = childProcess.spawnSync(binaryPath, argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: maximumEvidenceBytes,
    timeout: timeoutMs,
    shell: false,
    windowsHide: true
  });
  const stderr = String(result.stderr || "");
  invariant(Number.isInteger(result.status) && result.status === 0 && !result.error &&
    result.signal === null && stderr === "", `benchmark process failed: ${workload.workloadId}/${processRun}`);
  const sample = validateSampleOutput(String(result.stdout || ""), workload, processRun);
  return Object.freeze({
    ...sample,
    stdoutSha256: sha256(Buffer.from(result.stdout, "utf8")),
    stderrSha256: sha256(Buffer.from(stderr, "utf8")),
    exitCode: result.status
  });
}

function nearestRank(values, percentile) {
  invariant(Array.isArray(values) && values.length > 0 && percentile > 0 && percentile <= 1,
    "percentile input is invalid");
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1];
}

function safeRate(numerator, durationNs, label) {
  const value = (BigInt(numerator) * 1_000_000_000n) / BigInt(durationNs);
  invariant(value > 0n && value <= BigInt(Number.MAX_SAFE_INTEGER), `${label} is out of range`);
  return Number(value);
}

function aggregateSamples(samples, workloads = expectedWorkloads) {
  invariant(Array.isArray(samples), "samples must be an array");
  const aggregates = [];
  for (const workload of workloads) {
    const matching = samples.filter((sample) => sample.workloadId === workload.workloadId);
    invariant(matching.length === 3 && matching.every((sample, index) =>
      sample.processRun === index + 1), `sample coverage is invalid: ${workload.workloadId}`);
    invariant(new Set(matching.map((sample) => sample.validationChecksum)).size === 1,
      `validation checksum drifted: ${workload.workloadId}`);
    invariant(new Set(matching.map((sample) => sample.serializedIndexBytes)).size === 1,
      `serialized byte count drifted: ${workload.workloadId}`);
    const durations = matching.flatMap((sample) => sample.queryDurationNs);
    const queryP50Ns = nearestRank(durations, 0.50);
    aggregates.push(Object.freeze({
      workloadId: workload.workloadId,
      processRuns: matching.length,
      rawQuerySampleCount: durations.length,
      buildP50Ns: nearestRank(matching.map((sample) => sample.buildDurationNs), 0.50),
      buildP95Ns: nearestRank(matching.map((sample) => sample.buildDurationNs), 0.95),
      warmupP50Ns: nearestRank(matching.map((sample) => sample.warmupDurationNs), 0.50),
      queryP50Ns,
      queryP95Ns: nearestRank(durations, 0.95),
      queryP99Ns: nearestRank(durations, 0.99),
      medianRecordsPerSecond: safeRate(workload.recordCount, queryP50Ns,
        "median records per second"),
      medianCoordinatesPerSecond: safeRate(workload.recordCount * workload.dimension,
        queryP50Ns, "median coordinates per second"),
      maximumPeakWorkingSetBytes: Math.max(...matching.map((sample) =>
        sample.peakWorkingSetAfterSerializationBytes)),
      serializedIndexBytes: matching[0].serializedIndexBytes,
      validationChecksum: matching[0].validationChecksum
    }));
  }
  return Object.freeze(aggregates);
}

function validateAggregate(value, workload, samples) {
  exactKeys(value, [
    "workloadId", "processRuns", "rawQuerySampleCount", "buildP50Ns", "buildP95Ns",
    "warmupP50Ns", "queryP50Ns", "queryP95Ns", "queryP99Ns",
    "medianRecordsPerSecond", "medianCoordinatesPerSecond", "maximumPeakWorkingSetBytes",
    "serializedIndexBytes", "validationChecksum"
  ], `aggregate ${workload.workloadId}`);
  const expected = aggregateSamples(samples, [workload])[0];
  exactValue(value, expected, `aggregate ${workload.workloadId}`);
}

function finalizeObservation(body) {
  invariant(!Object.hasOwn(body, "observationId") &&
    !Object.hasOwn(body, "observationContentHash"),
  "observation body already contains identity fields");
  const observationContentHash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    ...body,
    observationId: `exact-flat-physical-target-${observationContentHash.slice(0, 16)}`,
    observationContentHash
  });
}

function observationIdentity(value) {
  const body = { ...value };
  delete body.observationId;
  delete body.observationContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({ hash, id: `exact-flat-physical-target-${hash.slice(0, 16)}` });
}

function validateObservation(value, options = {}) {
  exactKeys(value, [
    "schema", "experimentId", "status", "createdAtUtc", "sourceRevision",
    "preregistration", "parents", "inputs", "target", "targetEvidence", "environment",
    "tools", "preflightCommands", "build", "energy", "samples", "aggregates",
    "buildCleanup", "authority", "openGaps", "requiredNextGate", "observationId",
    "observationContentHash"
  ], "observation");
  invariant(value.schema === observationSchema && value.experimentId === expectedExperimentId,
    "observation schema or experiment is invalid");
  invariant(value.status ===
    "latency-throughput-memory-observed-energy-and-attestation-open",
  "observation status is invalid");
  invariant(utcPattern.test(value.createdAtUtc) && sourceRevisionPattern.test(value.sourceRevision),
    "observation timestamp or source revision is invalid");
  const identity = observationIdentity(value);
  invariant(value.observationId === identity.id && value.observationContentHash === identity.hash,
    "observation content identity is invalid");

  const preregistration = validateManifestFile();
  exactValue(value.preregistration, {
    path: preregistrationRelativePath,
    sha256: preregistration.sha256
  }, "observation preregistration");
  const retrievalParent = validateRetrievalReceiptFile();
  const browserParent = validateBrowserReceiptFile();
  exactValue(value.parents, [
    {
      receiptId: retrievalParent.receipt.receiptId,
      sha256: retrievalParent.sha256
    },
    {
      receiptId: browserParent.receipt.receiptId,
      sha256: browserParent.sha256
    }
  ], "observation parents");
  const inputRevision = options.inputRevision || null;
  invariant(inputRevision === null || inputRevision === value.sourceRevision,
    "historical input revision does not match the observation");
  invariant(Array.isArray(value.inputs) && value.inputs.length === inputPaths.length,
    "observation inputs are incomplete");
  for (let index = 0; index < inputPaths.length; index += 1) {
    const expectedInput = inputRevision === null
      ? hashInput(inputPaths[index])
      : hashInputAtRevision(inputPaths[index], inputRevision);
    exactValue(value.inputs[index], expectedInput, `inputs[${index}]`);
  }
  exactValue(value.target, preregistration.manifest.target, "observation target");
  exactKeys(value.targetEvidence, [
    "registryProbeOutputSha256", "powerPlanProbeOutputSha256",
    "liveIdentityMatchedPreregistration"
  ], "targetEvidence");
  invariant(sha256Pattern.test(value.targetEvidence.registryProbeOutputSha256) &&
    sha256Pattern.test(value.targetEvidence.powerPlanProbeOutputSha256) &&
    value.targetEvidence.liveIdentityMatchedPreregistration === true,
  "target evidence is invalid");
  exactValue(value.environment, {
    operatingSystem: "win32",
    architecture: "x64",
    logicalProcessors: 16,
    processIsolation: "nine-sequential-fresh-processes"
  }, "environment");
  exactKeys(value.tools, ["node", "rustc", "powershell", "nativeTargetCfgSha256"], "tools");
  for (const label of ["node", "rustc", "powershell"]) {
    exactKeys(value.tools[label], ["version", "sha256"], `tools.${label}`);
    invariant(safeVersionPattern.test(value.tools[label].version) &&
      sha256Pattern.test(value.tools[label].sha256), `tools.${label} is invalid`);
  }
  invariant(sha256Pattern.test(value.tools.nativeTargetCfgSha256),
    "native target cfg identity is invalid");
  invariant(Array.isArray(value.preflightCommands) &&
    value.preflightCommands.length === requiredGates.length,
  "preflight command evidence is incomplete");
  for (let index = 0; index < requiredGates.length; index += 1) {
    const command = value.preflightCommands[index];
    const gate = requiredGates[index];
    exactKeys(command, [
      "gateId", "executable", "arguments", "exitCode", "outputSha256", "spawnErrorCode"
    ], `preflightCommands[${index}]`);
    invariant(command.gateId === gate.gateId && command.executable === gate.executable &&
      JSON.stringify(command.arguments) === JSON.stringify(gate.arguments) &&
      command.exitCode === 0 && command.spawnErrorCode === null &&
      sha256Pattern.test(command.outputSha256), `preflight gate is invalid: ${gate.gateId}`);
  }
  exactKeys(value.build, [
    "commands", "library", "benchmark", "sourceMutationObserved",
    "workspaceManifestMutationObserved"
  ], "build");
  invariant(Array.isArray(value.build.commands) && value.build.commands.length === 2,
    "build command evidence is incomplete");
  for (let index = 0; index < value.build.commands.length; index += 1) {
    const command = value.build.commands[index];
    const template = index === 0
      ? preregistration.manifest.build.libraryCommand
      : preregistration.manifest.build.benchmarkCommand;
    exactKeys(command, [
      "role", "executable", "arguments", "exitCode", "outputSha256", "spawnErrorCode"
    ], `build.commands[${index}]`);
    invariant(command.role === (index === 0 ? "oracle-library" : "benchmark-executable") &&
      command.executable === "rustc" &&
      JSON.stringify(command.arguments) === JSON.stringify(template.slice(1)) &&
      command.exitCode === 0 && command.spawnErrorCode === null &&
      sha256Pattern.test(command.outputSha256), `build command is invalid: ${index}`);
  }
  for (const label of ["library", "benchmark"]) {
    exactKeys(value.build[label], ["bytes", "sha256"], `build.${label}`);
    invariant(Number.isSafeInteger(value.build[label].bytes) && value.build[label].bytes > 0 &&
      sha256Pattern.test(value.build[label].sha256), `build.${label} is invalid`);
  }
  invariant(value.build.sourceMutationObserved === false &&
    value.build.workspaceManifestMutationObserved === false,
  "build mutation authority is invalid");

  exactKeys(value.energy, [
    "counterSet", "counterPath", "counterSetAdvertised", "counterInstanceObserved",
    "status", "reasonCode", "joules", "counterSetProbeExitCode",
    "counterSetProbeOutputSha256", "counterInstanceProbeExitCode",
    "counterInstanceProbeOutputSha256"
  ], "energy");
  invariant(value.energy.counterSet === preregistration.manifest.measurement.energyCounterSet &&
    value.energy.counterPath === preregistration.manifest.measurement.energyCounterPath &&
    value.energy.counterSetAdvertised === true && value.energy.status === "unavailable" &&
    value.energy.counterInstanceObserved === false &&
    value.energy.reasonCode === "counter-instance-absent" &&
    value.energy.joules === null &&
    value.energy.counterSetProbeExitCode === 0 &&
    Number.isInteger(value.energy.counterInstanceProbeExitCode) &&
    sha256Pattern.test(value.energy.counterSetProbeOutputSha256) &&
    sha256Pattern.test(value.energy.counterInstanceProbeOutputSha256),
  "energy evidence is invalid");
  invariant(Array.isArray(value.samples) && value.samples.length === 9,
    "observation sample coverage is incomplete");
  let sampleIndex = 0;
  for (const workload of expectedWorkloads) {
    for (let processRun = 1; processRun <= 3; processRun += 1) {
      const sample = value.samples[sampleIndex];
      exactKeys(sample, [
        "schema", "workloadId", "processRun", "metric", "normalization", "dimension",
        "recordCount", "topK", "warmupQueries", "measuredQueries", "seed",
        "implementationReceiptSha256", "buildDurationNs", "warmupDurationNs",
        "queryDurationNs", "validationChecksum", "serializedIndexBytes",
        "workingSetAfterBuildBytes", "peakWorkingSetAfterBuildBytes",
        "workingSetAfterSearchBytes", "peakWorkingSetAfterSearchBytes",
        "peakWorkingSetAfterSerializationBytes", "stdoutSha256", "stderrSha256", "exitCode"
      ], `samples[${sampleIndex}]`);
      const publicSample = { ...sample };
      delete publicSample.stdoutSha256;
      delete publicSample.stderrSha256;
      delete publicSample.exitCode;
      validateSample(publicSample, workload, processRun);
      invariant(sha256Pattern.test(sample.stdoutSha256) &&
        sha256Pattern.test(sample.stderrSha256) && sample.exitCode === 0,
      `sample process evidence is invalid: ${workload.workloadId}/${processRun}`);
      sampleIndex += 1;
    }
  }
  invariant(Array.isArray(value.aggregates) && value.aggregates.length === 3,
    "observation aggregates are incomplete");
  for (let index = 0; index < expectedWorkloads.length; index += 1) {
    validateAggregate(value.aggregates[index], expectedWorkloads[index], value.samples);
  }
  exactKeys(value.buildCleanup, ["markerSha256", "ownedBuildDirectoryDeleted"],
    "buildCleanup");
  invariant(sha256Pattern.test(value.buildCleanup.markerSha256) &&
    value.buildCleanup.ownedBuildDirectoryDeleted === true,
  "build cleanup evidence is invalid");
  exactValue(value.authority, authority, "authority");
  exactValue(value.openGaps, openGaps, "openGaps");
  invariant(value.requiredNextGate === preregistration.manifest.requiredNextGate,
    "requiredNextGate changed from preregistration");
  invariant(!forbiddenTextPattern.test(JSON.stringify(value)),
    "observation contains private, credential-like, serial, or internal citation text");
  return value;
}

function validateObservationFile(filePath = observationPath) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumEvidenceBytes, "observation must be a bounded regular file");
  const bytes = fs.readFileSync(filePath);
  const parsed = JSON.parse(bytes.toString("utf8"));
  const observation = validateObservation(parsed, { inputRevision: parsed.sourceRevision });
  invariant(bytes.equals(canonicalPrettyBytes(observation)), "observation bytes are not canonical");
  return Object.freeze({ observation, bytes: bytes.length, sha256: sha256(bytes) });
}

function nativeTargetCfgSha256() {
  const result = childProcess.spawnSync(executablePath("rustc"), [
    "-C", "target-cpu=native", "--print", "cfg"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    shell: false
  });
  invariant(result.status === 0 && !result.error, "native target cfg probe failed");
  return sha256(Buffer.from(`${result.stdout || ""}\n${result.stderr || ""}`, "utf8"));
}

function generateObservation() {
  const preregistration = validateManifestFile();
  const retrievalParent = validateRetrievalReceiptFile();
  const browserParent = validateBrowserReceiptFile();
  assertInputsCommitted();
  const revision = sourceRevision();
  const target = probeTarget(preregistration.manifest);
  const energy = probeEnergyCapability(preregistration.manifest);
  const preflightCommands = requiredGates.map(runGate);
  const owned = createOwnedBuildDirectory();
  let cleanup = null;
  let build = null;
  let samples = null;
  try {
    const commands = [
      runCompile("oracle-library", preregistration.manifest.build.libraryCommand, owned.root),
      runCompile("benchmark-executable", preregistration.manifest.build.benchmarkCommand, owned.root)
    ];
    const libraryPath = path.join(owned.root, "libtinyrustlm_vector_oracle.rlib");
    const benchmarkPath = path.join(owned.root, "exact_flat_physical_target_benchmark.exe");
    build = {
      commands,
      library: boundedBinary(libraryPath, "oracle library"),
      benchmark: boundedBinary(benchmarkPath, "benchmark executable"),
      sourceMutationObserved: false,
      workspaceManifestMutationObserved: false
    };
    samples = [];
    for (const workload of preregistration.manifest.workloads) {
      for (let processRun = 1;
        processRun <= preregistration.manifest.execution.processRunsPerWorkload;
        processRun += 1) {
        samples.push(executeSample(
          benchmarkPath, workload, processRun,
          preregistration.manifest.execution.timeoutMsPerProcess
        ));
      }
    }
  } finally {
    cleanup = removeOwnedBuildDirectory(owned);
  }
  invariant(build !== null && samples !== null && cleanup !== null,
    "physical-target build or execution did not complete");
  const body = {
    schema: observationSchema,
    experimentId: expectedExperimentId,
    status: "latency-throughput-memory-observed-energy-and-attestation-open",
    createdAtUtc: new Date().toISOString(),
    sourceRevision: revision,
    preregistration: {
      path: preregistrationRelativePath,
      sha256: preregistration.sha256
    },
    parents: [
      { receiptId: retrievalParent.receipt.receiptId, sha256: retrievalParent.sha256 },
      { receiptId: browserParent.receipt.receiptId, sha256: browserParent.sha256 }
    ],
    inputs: inputPaths.map(hashInput),
    target: target.target,
    targetEvidence: target.evidence,
    environment: {
      operatingSystem: process.platform,
      architecture: process.arch,
      logicalProcessors: Number(process.env.NUMBER_OF_PROCESSORS),
      processIsolation: "nine-sequential-fresh-processes"
    },
    tools: {
      node: toolIdentity("node"),
      rustc: toolIdentity("rustc"),
      powershell: toolIdentity("powershell"),
      nativeTargetCfgSha256: nativeTargetCfgSha256()
    },
    preflightCommands,
    build,
    energy,
    samples,
    aggregates: aggregateSamples(samples, preregistration.manifest.workloads),
    buildCleanup: cleanup,
    authority,
    openGaps,
    requiredNextGate: preregistration.manifest.requiredNextGate
  };
  const observation = finalizeObservation(body);
  validateObservation(observation);
  return observation;
}

function finalizeAttempt(body) {
  invariant(!Object.hasOwn(body, "attemptId") && !Object.hasOwn(body, "attemptContentHash"),
    "attempt body already contains identity fields");
  const attemptContentHash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    ...body,
    attemptId: `exact-flat-physical-target-attempt-${attemptContentHash.slice(0, 16)}`,
    attemptContentHash
  });
}

function attemptIdentity(value) {
  const body = { ...value };
  delete body.attemptId;
  delete body.attemptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    hash,
    id: `exact-flat-physical-target-attempt-${hash.slice(0, 16)}`
  });
}

function validateAttempt(value) {
  exactKeys(value, [
    "schema", "experimentId", "status", "startedAtUtc", "completedAtUtc",
    "sourceRevision", "preregistrationSha256", "parentReceiptSha256s", "observationId",
    "observationContentHash", "failure", "attemptId", "attemptContentHash"
  ], "attempt");
  invariant(value.schema === attemptSchema && value.experimentId === expectedExperimentId &&
    ["pass", "fail"].includes(value.status), "attempt schema, experiment, or status is invalid");
  invariant(utcPattern.test(value.startedAtUtc) && utcPattern.test(value.completedAtUtc) &&
    Date.parse(value.completedAtUtc) >= Date.parse(value.startedAtUtc),
  "attempt timestamps are invalid");
  invariant(value.sourceRevision === null || sourceRevisionPattern.test(value.sourceRevision),
    "attempt source revision is invalid");
  invariant(value.preregistrationSha256 === null ||
    sha256Pattern.test(value.preregistrationSha256),
  "attempt preregistration identity is invalid");
  invariant(value.parentReceiptSha256s === null ||
    (Array.isArray(value.parentReceiptSha256s) && value.parentReceiptSha256s.length === 2 &&
      value.parentReceiptSha256s.every((hash) => sha256Pattern.test(hash))),
  "attempt parent identities are invalid");
  const identity = attemptIdentity(value);
  invariant(attemptIdPattern.test(value.attemptId) && value.attemptId === identity.id &&
    value.attemptContentHash === identity.hash, "attempt content identity is invalid");
  if (value.status === "pass") {
    invariant(sourceRevisionPattern.test(value.sourceRevision) &&
      sha256Pattern.test(value.preregistrationSha256) &&
      Array.isArray(value.parentReceiptSha256s) &&
      observationIdPattern.test(value.observationId) &&
      sha256Pattern.test(value.observationContentHash) && value.failure === null,
    "passing attempt evidence is incomplete");
  } else {
    invariant(value.observationId === null && value.observationContentHash === null,
      "failed attempt must not claim an observation");
    exactKeys(value.failure, ["code", "errorName", "messageSha256"], "attempt.failure");
    invariant(value.failure.code === "physical-target-observation-failed" &&
      /^[A-Za-z0-9._-]{1,64}$/u.test(value.failure.errorName) &&
      sha256Pattern.test(value.failure.messageSha256), "failure evidence is invalid");
  }
  invariant(!forbiddenTextPattern.test(JSON.stringify(value)),
    "attempt contains private, credential-like, serial, or internal citation text");
  return value;
}

function validateAttemptFile(filePath) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumEvidenceBytes, "attempt must be a bounded regular file");
  const bytes = fs.readFileSync(filePath);
  const attempt = validateAttempt(JSON.parse(bytes.toString("utf8")));
  invariant(bytes.equals(canonicalPrettyBytes(attempt)), "attempt bytes are not canonical");
  invariant(path.basename(filePath) === `${attempt.attemptContentHash}.json` &&
    path.basename(path.dirname(filePath)) === attempt.attemptContentHash.slice(0, 2),
  "attempt path is not content-addressed");
  return Object.freeze({ attempt, bytes: bytes.length, sha256: sha256(bytes) });
}

function writeAttempt(attempt) {
  validateAttempt(attempt);
  const filePath = path.join(attemptDirectory, attempt.attemptContentHash.slice(0, 2),
    `${attempt.attemptContentHash}.json`);
  atomicCreate(filePath, canonicalPrettyBytes(attempt));
  const reopened = validateAttemptFile(filePath);
  return Object.freeze({
    relativePath: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
    sha256: reopened.sha256
  });
}

function publicFailure(error) {
  const name = String(error?.name || "Error").replace(/[^A-Za-z0-9._-]+/gu, "-").slice(0, 64);
  const message = String(error?.message || "physical target observation failed");
  return Object.freeze({
    code: "physical-target-observation-failed",
    errorName: name || "Error",
    messageSha256: sha256(Buffer.from(message, "utf8"))
  });
}

function runAndWriteObservation() {
  const startedAtUtc = new Date().toISOString();
  let revision = null;
  let preregistrationSha256 = null;
  let parentReceiptSha256s = null;
  try {
    revision = sourceRevision();
    preregistrationSha256 = validateManifestFile().sha256;
    parentReceiptSha256s = [
      validateRetrievalReceiptFile().sha256,
      validateBrowserReceiptFile().sha256
    ];
    const observation = generateObservation();
    atomicCreate(observationPath, canonicalPrettyBytes(observation));
    const validated = validateObservationFile();
    const attempt = finalizeAttempt({
      schema: attemptSchema,
      experimentId: expectedExperimentId,
      status: "pass",
      startedAtUtc,
      completedAtUtc: new Date().toISOString(),
      sourceRevision: revision,
      preregistrationSha256,
      parentReceiptSha256s,
      observationId: observation.observationId,
      observationContentHash: observation.observationContentHash,
      failure: null
    });
    const attemptEvidence = writeAttempt(attempt);
    return Object.freeze({ attempt, attemptEvidence, observation: validated });
  } catch (error) {
    const attempt = finalizeAttempt({
      schema: attemptSchema,
      experimentId: expectedExperimentId,
      status: "fail",
      startedAtUtc,
      completedAtUtc: new Date().toISOString(),
      sourceRevision: revision,
      preregistrationSha256,
      parentReceiptSha256s,
      observationId: null,
      observationContentHash: null,
      failure: publicFailure(error)
    });
    try {
      writeAttempt(attempt);
    } catch (_attemptError) {
      // The original failure remains authoritative when evidence persistence also fails.
    }
    throw error;
  }
}

function main(argumentsList) {
  invariant(argumentsList.length === 1 && argumentsList[0] === "--write",
    "usage: node vector-physical-target-observation.js --write");
  const result = runAndWriteObservation();
  process.stdout.write(`${JSON.stringify({
    schema: result.observation.observation.schema,
    observationId: result.observation.observation.observationId,
    status: result.observation.observation.status,
    sourceRevision: result.observation.observation.sourceRevision,
    targetId: result.observation.observation.target.targetId,
    processRuns: result.observation.observation.samples.length,
    energyMeasured: result.observation.observation.authority.namedTargetEnergyMeasured,
    attemptId: result.attempt.attemptId,
    attemptPath: result.attemptEvidence.relativePath,
    bytes: result.observation.bytes,
    sha256: result.observation.sha256,
    productAuthority: result.observation.observation.authority.productIntegrationAuthorized
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Vector physical-target observation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  aggregateSamples,
  attemptIdentity,
  attemptSchema,
  authority,
  canonicalPrettyBytes,
  expectedExperimentId,
  finalizeAttempt,
  finalizeObservation,
  hashInput,
  hashInputAtRevision,
  inputPaths,
  materializeBuildArguments,
  normalizeTargetProbe,
  nearestRank,
  observationIdentity,
  observationPath,
  observationSchema,
  openGaps,
  publicFailure,
  requiredGates,
  runAndWriteObservation,
  sampleSchema,
  sha256,
  validateAttempt,
  validateAttemptFile,
  validateObservation,
  validateObservationFile,
  validateSample,
  validateSampleOutput
});

"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  validateArtifact,
  validateCandidateExecutable,
  validateCorpus,
  validateEnvironment,
  validateExecutionProfile,
  validateSource,
  validateVerificationProfile
} = require("./qwen-template2-parity-verifier.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const executionProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-template2-parity-preregistration.v1.json"
);
const verificationProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-template2-parity-verification-preregistration.v1.json"
);
const sourceOraclePath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/qwen-template2-source-oracle.py"
);
const verifierPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/qwen-template2-parity-verifier.js"
);
const MAXIMUM_PROFILE_BYTES = 1024 * 1024;
const MAXIMUM_SUMMARY_BYTES = 1024 * 1024;
const CHILD_TIMEOUT_MILLISECONDS = 10 * 60 * 1000;
const RESULT_SCHEMA = "tinyrustlm.qwen3_template2_parity_result.v1";
const RECEIPT_SCHEMA =
  "tinyrustlm.qwen3_template2_parity_verification_receipt.v1";

class Template2ObservationError extends Error {
  constructor(code) {
    super(code);
    this.name = "Template2ObservationError";
    this.code = code;
  }
}

function fail(code) {
  throw new Template2ObservationError(code);
}

function invariant(condition, code) {
  if (!condition) fail(code);
}

function normalizePath(filePath) {
  return path.normalize(filePath).toLowerCase();
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function directDirectory(directoryPath, code) {
  invariant(path.isAbsolute(directoryPath), code);
  let stat;
  let resolved;
  try {
    stat = fs.lstatSync(directoryPath);
    resolved = fs.realpathSync.native(directoryPath);
  } catch {
    fail(code);
  }
  invariant(
    stat.isDirectory() && !stat.isSymbolicLink() &&
      normalizePath(resolved) === normalizePath(directoryPath),
    code
  );
  return resolved;
}

function directRegularFile(filePath, maximumBytes, code) {
  invariant(path.isAbsolute(filePath), code);
  let stat;
  let resolved;
  let bytes;
  try {
    stat = fs.lstatSync(filePath);
    resolved = fs.realpathSync.native(filePath);
    bytes = fs.readFileSync(filePath);
  } catch {
    fail(code);
  }
  invariant(
    stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
      stat.size <= maximumBytes && bytes.length === stat.size &&
      normalizePath(resolved) === normalizePath(filePath),
    code
  );
  return Object.freeze({ path: resolved, bytes, stat });
}

function readProfile(filePath, code) {
  const file = directRegularFile(filePath, MAXIMUM_PROFILE_BYTES, code);
  let value;
  try {
    value = parseStrictJson(file.bytes, {
      maximumBytes: MAXIMUM_PROFILE_BYTES,
      maximumDepth: 64,
      maximumTotalEntries: 262_144,
      maximumObjectMembers: 4096,
      maximumArrayItems: 65_536,
      maximumStringCodeUnits: MAXIMUM_PROFILE_BYTES,
      maximumTotalStringCodeUnits: MAXIMUM_PROFILE_BYTES,
      maximumNumberCharacters: 32
    });
  } catch {
    fail(code);
  }
  return Object.freeze({ ...file, value });
}

function pathExists(filePath) {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    fail("template2-observation-path-state-invalid");
  }
}

function createOwnedDirectory(directoryPath, code) {
  invariant(path.isAbsolute(directoryPath) && !pathExists(directoryPath), code);
  try {
    fs.mkdirSync(directoryPath, { recursive: false, mode: 0o700 });
  } catch {
    fail(code);
  }
  return directDirectory(directoryPath, code);
}

function boundedChildEnvironment() {
  const output = {};
  for (const key of [
    "COMSPEC", "HOMEDRIVE", "HOMEPATH", "LOCALAPPDATA", "PATH", "PATHEXT",
    "SYSTEMDRIVE", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE", "WINDIR"
  ]) {
    if (typeof process.env[key] === "string") output[key] = process.env[key];
  }
  output.NO_COLOR = "1";
  output.PYTHONDONTWRITEBYTECODE = "1";
  return output;
}

function parseSummary(stdout, expectedSchema, expectedStatus, code) {
  const bytes = Buffer.from(stdout, "utf8");
  invariant(bytes.length > 0 && bytes.length <= MAXIMUM_SUMMARY_BYTES, code);
  let value;
  try {
    value = parseStrictJson(bytes, {
      maximumBytes: MAXIMUM_SUMMARY_BYTES,
      maximumDepth: 16,
      maximumTotalEntries: 256,
      maximumObjectMembers: 32,
      maximumArrayItems: 32,
      maximumStringCodeUnits: MAXIMUM_SUMMARY_BYTES,
      maximumTotalStringCodeUnits: MAXIMUM_SUMMARY_BYTES,
      maximumNumberCharacters: 32
    });
  } catch {
    fail(code);
  }
  invariant(
    value !== null && typeof value === "object" && !Array.isArray(value) &&
      value.schema === expectedSchema && value.status === expectedStatus,
    code
  );
  return value;
}

function runChild(executable, arguments_, phase, expectedSchema, expectedStatus) {
  const code = `template2-observation-${phase}-failed`;
  let result;
  try {
    result = childProcess.spawnSync(executable, arguments_, {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: boundedChildEnvironment(),
      maxBuffer: MAXIMUM_SUMMARY_BYTES,
      shell: false,
      timeout: CHILD_TIMEOUT_MILLISECONDS,
      windowsHide: true
    });
  } catch {
    fail(code);
  }
  invariant(
    result.error === undefined && result.signal === null && result.status === 0 &&
      result.stderr === "",
    code
  );
  return parseSummary(result.stdout, expectedSchema, expectedStatus, code);
}

function writeTerminalFailure(outputDirectory, profile, phase, errorCode) {
  if (outputDirectory === null || !pathExists(outputDirectory)) return;
  const passReceipt = profile?.runSet?.receiptFile;
  if (typeof passReceipt === "string" &&
      pathExists(path.join(outputDirectory, passReceipt))) return;
  const receiptPath = path.join(outputDirectory, "terminal-failure.v1.json");
  if (pathExists(receiptPath)) return;
  const value = {
    schema: "tinyrustlm.qwen3_template2_parity_terminal_failure.v1",
    status: "terminal-failure-no-retry",
    recordedAtUtc: new Date().toISOString(),
    attemptId: profile?.runSet?.attemptId ?? "unavailable",
    phase,
    errorCode,
    rawOutputsPreserved: true,
    retryAllowed: false
  };
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  let descriptor;
  try {
    descriptor = fs.openSync(receiptPath, "wx", 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
  } catch {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the original bounded operation failure.
      }
    }
  }
}

function removeEmptyDirectory(directoryPath) {
  invariant(fs.readdirSync(directoryPath).length === 0,
    "template2-observation-pycache-not-empty");
  try {
    fs.rmdirSync(directoryPath);
  } catch {
    fail("template2-observation-pycache-cleanup-failed");
  }
}

function observe(arguments_) {
  invariant(Array.isArray(arguments_) && arguments_.length === 7,
    "template2-observation-arguments-invalid");
  const [rawVerificationProfile, rawOutputParent, rawSourceDirectory,
    rawEnvironmentRoot, rawPythonLauncher, rawPycacheParent,
    rawCandidateExecutable] = arguments_;
  for (const value of arguments_) {
    invariant(path.isAbsolute(value), "template2-observation-arguments-invalid");
  }

  let outputDirectory = null;
  let verificationProfile = null;
  let phase = "preflight";
  try {
    const suppliedVerification = directRegularFile(
      rawVerificationProfile,
      MAXIMUM_PROFILE_BYTES,
      "template2-observation-profile-invalid"
    );
    invariant(
      normalizePath(suppliedVerification.path) === normalizePath(verificationProfilePath),
      "template2-observation-profile-invalid"
    );
    const executionDocument = readProfile(
      executionProfilePath,
      "template2-observation-execution-profile-invalid"
    );
    const verificationDocument = readProfile(
      suppliedVerification.path,
      "template2-observation-profile-invalid"
    );
    const executionProfile = validateExecutionProfile(
      executionDocument.value,
      executionDocument.bytes
    );
    verificationProfile = validateVerificationProfile(
      verificationDocument.value,
      executionDocument.bytes
    );
    const observationScript = directRegularFile(
      __filename,
      2 * 1024 * 1024,
      "template2-observation-profile-invalid"
    );
    invariant(
      observationScript.bytes.length ===
        verificationProfile.observationRunner.scriptByteLength &&
      sha256(observationScript.bytes) ===
        verificationProfile.observationRunner.scriptSha256,
      "template2-observation-profile-invalid"
    );

    const outputParent = directDirectory(
      rawOutputParent,
      "template2-observation-output-parent-invalid"
    );
    const pycacheParent = directDirectory(
      rawPycacheParent,
      "template2-observation-pycache-parent-invalid"
    );
    const environmentRoot = directDirectory(
      rawEnvironmentRoot,
      "template2-observation-environment-invalid"
    );
    const pythonLauncher = directRegularFile(
      rawPythonLauncher,
      16 * 1024 * 1024,
      "template2-observation-python-invalid"
    );
    invariant(
      normalizePath(pythonLauncher.path) ===
        normalizePath(path.join(environmentRoot, "Scripts/python.exe")) &&
      pythonLauncher.bytes.length === 274_424 &&
      sha256(pythonLauncher.bytes) === executionProfile.oracle.launcherSha256,
      "template2-observation-python-invalid"
    );
    validateCorpus(executionProfile);
    validateSource(rawSourceDirectory, executionProfile);
    validateEnvironment(environmentRoot, executionProfile);
    validateCandidateExecutable(
      rawCandidateExecutable,
      executionProfile,
      verificationProfile
    );
    validateArtifact(executionProfile);

    outputDirectory = path.join(
      outputParent,
      verificationProfile.runSet.outputDirectoryName
    );
    const pycacheDirectories = [1, 2].map((ordinal) => path.join(
      pycacheParent,
      `${verificationProfile.runSet.attemptId}-oracle-${ordinal}-pycache`
    ));
    invariant(
      !pathExists(outputDirectory) &&
        pycacheDirectories.every((directory) => !pathExists(directory)),
      "template2-observation-root-already-exists"
    );
    phase = "create-owned-roots";
    outputDirectory = createOwnedDirectory(
      outputDirectory,
      "template2-observation-output-create-failed"
    );
    for (const directory of pycacheDirectories) {
      createOwnedDirectory(directory, "template2-observation-pycache-create-failed");
    }

    const sourceLockPath = path.join(
      repositoryRoot,
      ...executionProfile.source.sourceLockPath.split("/")
    );
    const corpusPath = path.join(
      repositoryRoot,
      ...executionProfile.corpus.path.split("/")
    );
    const environmentLockPath = path.join(
      repositoryRoot,
      ...executionProfile.oracle.environmentLockPath.split("/")
    );
    const sourceRuns = verificationProfile.runSet.oracleRunFiles;
    for (let index = 0; index < sourceRuns.length; index += 1) {
      phase = `source-oracle-${index + 1}`;
      runChild(
        pythonLauncher.path,
        [
          "-I",
          "-B",
          "-X",
          `pycache_prefix=${pycacheDirectories[index]}`,
          sourceOraclePath,
          executionProfilePath,
          corpusPath,
          sourceLockPath,
          rawSourceDirectory,
          environmentLockPath,
          pycacheDirectories[index],
          path.join(outputDirectory, sourceRuns[index])
        ],
        phase,
        RESULT_SCHEMA,
        "source-oracle-output-created"
      );
    }

    const candidateRuns = verificationProfile.runSet.candidateRunFiles;
    for (let index = 0; index < candidateRuns.length; index += 1) {
      phase = `candidate-${index + 1}`;
      runChild(
        rawCandidateExecutable,
        [
          executionProfilePath,
          corpusPath,
          sourceLockPath,
          environmentLockPath,
          path.join(outputDirectory, candidateRuns[index])
        ],
        phase,
        RESULT_SCHEMA,
        "candidate-output-created"
      );
    }

    phase = "pycache-cleanup";
    for (const directory of pycacheDirectories) removeEmptyDirectory(directory);
    phase = "verifier-1";
    const verificationSummary = runChild(
      process.execPath,
      [
        verifierPath,
        verificationProfilePath,
        outputDirectory,
        rawSourceDirectory,
        environmentRoot,
        rawCandidateExecutable
      ],
      phase,
      RECEIPT_SCHEMA,
      "pass"
    );
    return Object.freeze({
      schema: "tinyrustlm.qwen3_template2_parity_observation_summary.v1",
      status: "pass",
      attemptId: verificationProfile.runSet.attemptId,
      childProcessCount: 5,
      retryCount: 0,
      outputRootWasAbsent: true,
      caseCount: verificationSummary.caseCount,
      receiptSha256: verificationSummary.receiptSha256
    });
  } catch (error) {
    const errorCode = error instanceof Template2ObservationError
      ? error.code
      : error instanceof Error && typeof error.code === "string" &&
          /^template2-/u.test(error.code)
        ? error.code
        : "template2-observation-unexpected-failure";
    writeTerminalFailure(outputDirectory, verificationProfile, phase, errorCode);
    fail(errorCode);
  }
}

function main() {
  const result = observe(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error instanceof Template2ObservationError
      ? error.code
      : "template2-observation-unexpected-failure";
    process.stderr.write(`Qwen Template2 parity observation failed: ${code}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  Template2ObservationError,
  observe
});

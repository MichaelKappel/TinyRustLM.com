#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");

const archiveFuzzHostedVerificationProfileId =
  "tinyrustlm.vnext.archive-fuzz-hosted-verification.v1";
const archiveFuzzHostedVerificationProfileSha256 =
  "0943bba8ceba94c6f925cd5cb33d163c33d654e4e59266c00ca3ef6346bfc415";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^[a-f0-9]{40}$/u;
const runIdPattern = /^[1-9][0-9]{0,23}$/u;
const safeCodePattern = /^[a-z][a-z0-9_-]{2,95}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const repositoryRoot = resolveRepositoryRoot();
const profilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "archive-fuzz-hosted-verification-profile.v1.json"
);

function fail(code) {
  const error = new Error("Archive fuzz hosted verification failed");
  error.code = code;
  throw error;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function resolveRepositoryRoot() {
  const configured = Object.getOwnPropertyDescriptor(
    process.env,
    "TINYRUSTLM_REPOSITORY_ROOT"
  );
  const candidates = configured && "value" in configured && configured.value
    ? [configured.value]
    : [process.cwd(), path.resolve(process.cwd(), ".."), path.resolve(__dirname, "../..")];
  const roots = [];
  const identities = new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !path.isAbsolute(candidate) ||
        candidate.includes("\0")) {
      continue;
    }
    const normalized = path.normalize(candidate);
    const identity = process.platform === "win32"
      ? normalized.toLowerCase()
      : normalized;
    if (identities.has(identity)) continue;
    identities.add(identity);
    try {
      if (fs.lstatSync(path.join(normalized, "tinyrustlm", "package.json")).isFile() &&
          fs.lstatSync(path.join(normalized, "contracts", "vnext",
            "archive-fuzz-hosted-verification-profile.v1.json")).isFile()) {
        roots.push(normalized);
      }
    } catch (_error) {
      // Exactly one complete source root is authoritative.
    }
  }
  if (roots.length !== 1) fail("archive_fuzz_hosted_repository_root_invalid");
  return roots[0];
}

function assertDataObject(value, expectedKeys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    fail(code);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  if (keys.join(",") !== [...expectedKeys].sort().join(",") ||
      keys.some((key) => !("value" in descriptors[key]) ||
        descriptors[key].get !== undefined || descriptors[key].set !== undefined)) {
    fail(code);
  }
}

function exactStringArray(value, expected, code) {
  if (!Array.isArray(value) || value.length !== expected.length ||
      value.some((entry, index) => entry !== expected[index])) {
    fail(code);
  }
}

function readRegularFile(filePath, maximumBytes, allowEmpty, code) {
  let descriptor;
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() ||
        (!allowEmpty && stat.size === 0) || stat.size > maximumBytes) {
      fail(code);
    }
    descriptor = fs.openSync(
      filePath,
      Number(fs.constants.O_RDONLY) | Number(fs.constants.O_NOFOLLOW || 0)
    );
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count <= 0) fail(code);
      offset += count;
    }
    const after = fs.fstatSync(descriptor);
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs ||
        after.ctimeMs !== stat.ctimeMs) {
      fail(code);
    }
    return bytes;
  } catch (error) {
    if (error?.code === code) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // The bounded read or typed failure is already authoritative.
      }
    }
  }
}

function sourcePath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 ||
      relativePath.includes("\\") || relativePath.startsWith("/") ||
      relativePath.split("/").some((part) => !part || part === "." || part === "..")) {
    fail("archive_fuzz_hosted_profile_invalid");
  }
  const resolved = path.resolve(repositoryRoot, ...relativePath.split("/"));
  const relative = path.relative(repositoryRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("archive_fuzz_hosted_profile_invalid");
  }
  return resolved;
}

function loadProfile() {
  let bytes;
  let profile;
  try {
    bytes = fs.readFileSync(profilePath);
    profile = parseStrictJson(bytes);
  } catch (_error) {
    fail("archive_fuzz_hosted_profile_invalid");
  }
  if (sha256(bytes) !== archiveFuzzHostedVerificationProfileSha256) {
    fail("archive_fuzz_hosted_profile_identity_mismatch");
  }
  const profileFields = [
    "acceptedArchitectures", "acceptedEvents", "canonicalJsonProfile",
    "cargoFuzzVersion", "cargoLockPath", "cargoLockSha256",
    "childEnvironmentAllowlist", "corpusManifestPath", "corpusManifestSha256",
    "executionClass", "failureCodes", "findingRecordFields", "fuzzProfileId",
    "fuzzProfileSha256", "hashAlgorithm", "libfuzzerSysVersion", "limits",
    "nonClaims", "operatingSystem", "pathPolicy", "profileId", "provider",
    "recordFields", "recordFile", "recordPolicy", "recordSchema", "repository",
    "runnerEnvironment", "sanitizer", "schema", "scratchCleanup", "status",
    "stepRecordFields", "steps", "target", "toolchain",
    "verificationSourceClosureMembers", "verdicts", "versionPolicy",
    "workflowJob", "workflowPath"
  ];
  assertDataObject(profile, profileFields, "archive_fuzz_hosted_profile_invalid");
  if (profile.schema !==
        "tinyrustlm.vnext.archive_fuzz_hosted_verification_profile.v1" ||
      profile.profileId !== archiveFuzzHostedVerificationProfileId ||
      profile.status !== "frozen" ||
      profile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      profile.canonicalJsonProfile !== "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      profile.hashAlgorithm !== "sha256" ||
      profile.recordSchema !==
        "tinyrustlm.vnext.archive_fuzz_hosted_verification.v1" ||
      profile.recordFile !== "archive-fuzz-hosted-verification.v1.json" ||
      profile.executionClass !== "github-hosted-address-sanitizer-fuzz" ||
      profile.provider !== "github-actions" ||
      profile.repository !== "MichaelKappel/TinyRustLM.com" ||
      profile.workflowPath !== ".github/workflows/ci.yml" ||
      profile.workflowJob !== "verify-archive-fuzz" ||
      profile.operatingSystem !== "Linux" ||
      profile.runnerEnvironment !== "github-hosted" ||
      profile.toolchain !== "nightly-2026-08-01" ||
      profile.cargoFuzzVersion !== "0.13.2" ||
      profile.libfuzzerSysVersion !== "0.4.13" ||
      profile.sanitizer !== "address" ||
      profile.target !== "structured_archive" ||
      profile.fuzzProfileId !== "tinyrustlm.vnext.archive-fuzz.v1" ||
      !sha256Pattern.test(profile.fuzzProfileSha256) ||
      !sha256Pattern.test(profile.corpusManifestSha256) ||
      !sha256Pattern.test(profile.cargoLockSha256) ||
      profile.scratchCleanup !== "completed-before-record") {
    fail("archive_fuzz_hosted_profile_invalid");
  }
  exactStringArray(profile.acceptedEvents,
    ["pull_request", "push", "workflow_dispatch"],
    "archive_fuzz_hosted_profile_invalid");
  exactStringArray(profile.acceptedArchitectures, ["ARM64", "X64"],
    "archive_fuzz_hosted_profile_invalid");
  exactStringArray(profile.verificationSourceClosureMembers, [
    "contracts/vnext/archive-fuzz-hosted-verification-profile.v1.json",
    "tinyrustlm/tools/archive-fuzz-hosted-verification.js",
    "tinyrustlm/tools/strict-json.js",
    "tinyrustlm/tools/vnext-jcs.js"
  ], "archive_fuzz_hosted_profile_invalid");
  exactStringArray(profile.recordFields, [
    "architecture", "cargoFuzzVersion", "cargoLockSha256",
    "corpusManifestSha256", "eventName", "executionClass", "failureCode",
    "findings", "finishedUtc", "fuzzProfileId", "fuzzProfileSha256",
    "libfuzzerSysVersion", "nodeVersion", "operatingSystem", "profileId",
    "profileSha256", "provider", "repository", "runnerEnvironment", "sanitizer",
    "schema", "scratchCleanup", "sourceRevision", "sourceWorktreeClean",
    "startedUtc", "steps", "target", "toolchain", "verdict",
    "verificationSourceClosureSha256", "workflowJob", "workflowPath",
    "workflowRunAttempt", "workflowRunId", "workflowSha256"
  ], "archive_fuzz_hosted_profile_invalid");
  exactStringArray(profile.stepRecordFields, [
    "durationMilliseconds", "exitCode", "id", "outputLimitExceeded", "signal",
    "stderrByteCount", "stderrFile", "stderrSha256", "stdoutByteCount",
    "stdoutFile", "stdoutSha256", "timedOut"
  ], "archive_fuzz_hosted_profile_invalid");
  exactStringArray(profile.findingRecordFields, ["byteCount", "file", "sha256"],
    "archive_fuzz_hosted_profile_invalid");
  exactStringArray(profile.verdicts, ["fail", "pass"],
    "archive_fuzz_hosted_profile_invalid");
  if (!Array.isArray(profile.steps) || profile.steps.length !== 5 ||
      !Array.isArray(profile.failureCodes) || profile.failureCodes.length !== 6 ||
      profile.failureCodes.some((entry) => !safeCodePattern.test(entry)) ||
      !Array.isArray(profile.nonClaims) || profile.nonClaims.length !== 5) {
    fail("archive_fuzz_hosted_profile_invalid");
  }
  assertDataObject(profile.limits, [
    "maximumFindingBytes", "maximumFindingCount", "maximumLogBytesPerStream",
    "maximumRecordBytes", "maximumRunAttempt", "maximumRunIdCharacters",
    "maximumSourceMemberBytes", "maximumTotalDurationMilliseconds",
    "maximumTotalFindingBytes", "maximumWorkflowBytes"
  ], "archive_fuzz_hosted_profile_invalid");
  if (profile.limits.maximumFindingBytes !== 4_096 ||
      profile.limits.maximumFindingCount !== 16 ||
      profile.limits.maximumLogBytesPerStream !== 8_388_608 ||
      profile.limits.maximumRecordBytes !== 65_536 ||
      profile.limits.maximumRunAttempt !== 1_000 ||
      profile.limits.maximumRunIdCharacters !== 24 ||
      profile.limits.maximumSourceMemberBytes !== 16_777_216 ||
      profile.limits.maximumTotalDurationMilliseconds !== 1_200_000 ||
      profile.limits.maximumTotalFindingBytes !== 65_536 ||
      profile.limits.maximumWorkflowBytes !== 1_048_576) {
    fail("archive_fuzz_hosted_profile_invalid");
  }
  const expectedStepIds = [
    "cargo-fuzz-version", "rustc-version", "corpus-manifest-replay",
    "libfuzzer-corpus-replay", "bounded-sanitizer-fuzz"
  ];
  profile.steps.forEach((step, index) => {
    assertDataObject(step,
      ["arguments", "command", "id", "maximumDurationMilliseconds"],
      "archive_fuzz_hosted_profile_invalid");
    if (step.id !== expectedStepIds[index] ||
        !["cargo", "rustc"].includes(step.command) ||
        !Array.isArray(step.arguments) || step.arguments.length === 0 ||
        step.arguments.some((entry) => typeof entry !== "string" ||
          entry.length === 0 || entry.length > 1_024 || entry.includes("\0")) ||
        !Number.isSafeInteger(step.maximumDurationMilliseconds) ||
        step.maximumDurationMilliseconds <= 0 ||
        step.maximumDurationMilliseconds > 600_000) {
      fail("archive_fuzz_hosted_profile_invalid");
    }
  });
  const expectedIdentities = [
    [profile.corpusManifestPath, profile.corpusManifestSha256],
    [profile.cargoLockPath, profile.cargoLockSha256],
    ["contracts/vnext/archive-fuzz-profile.v1.json", profile.fuzzProfileSha256]
  ];
  for (const [relativePath, expectedSha256] of expectedIdentities) {
    const bytesToVerify = readRegularFile(
      sourcePath(relativePath),
      profile.limits.maximumSourceMemberBytes,
      false,
      "archive_fuzz_hosted_profile_dependency_invalid"
    );
    if (sha256(bytesToVerify) !== expectedSha256) {
      fail("archive_fuzz_hosted_profile_dependency_invalid");
    }
  }
  return Object.freeze(profile);
}

const profile = loadProfile();

function normalizeAbsolutePath(value, code) {
  if (typeof value !== "string" || value.length < 2 || value.length > 4_096 ||
      value.includes("\0") || !path.isAbsolute(value) ||
      path.resolve(value) !== path.normalize(value)) {
    fail(code);
  }
  return path.resolve(value);
}

function assertExistingDirectoryWithoutLinks(target, code) {
  const parsed = path.parse(target);
  const parts = target.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (_error) {
      fail(code);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(code);
  }
}

function pathIdentity(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function isDirectChild(parent, child) {
  const relative = path.relative(pathIdentity(parent), pathIdentity(child));
  return Boolean(relative) && !relative.startsWith("..") &&
    !path.isAbsolute(relative) && !relative.includes(path.sep);
}

function verificationSourceClosureSha256() {
  const members = profile.verificationSourceClosureMembers.map((relativePath) => {
    const bytes = readRegularFile(
      sourcePath(relativePath),
      profile.limits.maximumSourceMemberBytes,
      false,
      "archive_fuzz_hosted_source_invalid"
    );
    return Object.freeze({
      byteCount: bytes.length,
      path: relativePath,
      sha256: sha256(bytes)
    });
  });
  return sha256(canonicalizeVnextJcsBytes(members));
}

function currentWorkflowSha256() {
  const bytes = readRegularFile(
    sourcePath(profile.workflowPath),
    profile.limits.maximumWorkflowBytes,
    false,
    "archive_fuzz_hosted_workflow_invalid"
  );
  return sha256(bytes);
}

function runIdentityCommand(command, argumentsList) {
  const result = childProcess.spawnSync(command, argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16_384,
    shell: false,
    windowsHide: true
  });
  if (result.error || result.signal !== null || result.status !== 0 ||
      result.stderr !== "" || typeof result.stdout !== "string") {
    fail("archive_fuzz_hosted_source_identity_invalid");
  }
  return result.stdout.trim();
}

function currentSourceRevision() {
  const revision = runIdentityCommand("git", ["-C", repositoryRoot, "rev-parse", "HEAD"]);
  if (!sourceRevisionPattern.test(revision)) {
    fail("archive_fuzz_hosted_source_identity_invalid");
  }
  return revision;
}

function requireCleanSource(expectedRevision) {
  if (currentSourceRevision() !== expectedRevision ||
      runIdentityCommand("git", ["-C", repositoryRoot, "status", "--porcelain=v1"]) !== "") {
    fail("archive_fuzz_hosted_source_not_clean");
  }
}

function readEnvironmentValue(environment, key) {
  const descriptor = Object.getOwnPropertyDescriptor(environment, key);
  if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string" ||
      descriptor.value.length === 0 || descriptor.value.length > 1_024 ||
      descriptor.value.includes("\0")) {
    fail("archive_fuzz_hosted_environment_invalid");
  }
  return descriptor.value;
}

function hostedContext(environment = process.env) {
  if (!environment || typeof environment !== "object" || Array.isArray(environment) ||
      Object.getOwnPropertySymbols(environment).length !== 0) {
    fail("archive_fuzz_hosted_environment_invalid");
  }
  const context = Object.freeze({
    architecture: readEnvironmentValue(environment, "RUNNER_ARCH"),
    eventName: readEnvironmentValue(environment, "GITHUB_EVENT_NAME"),
    repository: readEnvironmentValue(environment, "GITHUB_REPOSITORY"),
    runnerEnvironment: readEnvironmentValue(environment, "RUNNER_ENVIRONMENT"),
    runnerOperatingSystem: readEnvironmentValue(environment, "RUNNER_OS"),
    runnerTemp: readEnvironmentValue(environment, "RUNNER_TEMP"),
    sourceRevision: readEnvironmentValue(environment, "GITHUB_SHA"),
    workflowJob: readEnvironmentValue(environment, "GITHUB_JOB"),
    workflowRef: readEnvironmentValue(environment, "GITHUB_WORKFLOW_REF"),
    workflowRunAttempt: readEnvironmentValue(environment, "GITHUB_RUN_ATTEMPT"),
    workflowRunId: readEnvironmentValue(environment, "GITHUB_RUN_ID")
  });
  if (readEnvironmentValue(environment, "CI") !== "true" ||
      readEnvironmentValue(environment, "GITHUB_ACTIONS") !== "true" ||
      context.repository !== profile.repository ||
      context.runnerEnvironment !== profile.runnerEnvironment ||
      context.runnerOperatingSystem !== profile.operatingSystem ||
      context.workflowJob !== profile.workflowJob ||
      !profile.acceptedEvents.includes(context.eventName) ||
      !profile.acceptedArchitectures.includes(context.architecture) ||
      !sourceRevisionPattern.test(context.sourceRevision) ||
      !runIdPattern.test(context.workflowRunId) ||
      context.workflowRunId.length > profile.limits.maximumRunIdCharacters ||
      !/^[1-9][0-9]{0,3}$/u.test(context.workflowRunAttempt) ||
      Number(context.workflowRunAttempt) > profile.limits.maximumRunAttempt ||
      !context.workflowRef.startsWith(`${profile.repository}/${profile.workflowPath}@`)) {
    fail("archive_fuzz_hosted_environment_invalid");
  }
  const expectedArchitecture = process.arch === "x64"
    ? "X64"
    : process.arch === "arm64" ? "ARM64" : null;
  if (process.platform !== "linux" || expectedArchitecture !== context.architecture) {
    fail("archive_fuzz_hosted_environment_invalid");
  }
  return Object.freeze({
    ...context,
    workflowRunAttempt: Number(context.workflowRunAttempt)
  });
}

function childEnvironment() {
  const environment = Object.create(null);
  for (const key of profile.childEnvironmentAllowlist) {
    const descriptor = Object.getOwnPropertyDescriptor(process.env, key);
    if (descriptor && "value" in descriptor && typeof descriptor.value === "string" &&
        descriptor.value.length > 0 && descriptor.value.length <= 8_192 &&
        !descriptor.value.includes("\0")) {
      environment[key] = descriptor.value;
    }
  }
  environment.CARGO_NET_OFFLINE = "true";
  environment.CARGO_TERM_COLOR = "never";
  environment.RUST_BACKTRACE = "0";
  return environment;
}

function writeExclusive(filePath, bytes) {
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count <= 0) fail("archive_fuzz_hosted_write_failed");
      offset += count;
    }
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (error?.code === "archive_fuzz_hosted_write_failed") throw error;
    fail("archive_fuzz_hosted_write_failed");
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // The exact write or typed failure is already authoritative.
      }
    }
  }
}

function copyFrozenCorpus(corpusDirectory) {
  const manifestPath = sourcePath(profile.corpusManifestPath);
  const manifestBytes = readRegularFile(
    manifestPath,
    profile.limits.maximumSourceMemberBytes,
    false,
    "archive_fuzz_hosted_corpus_invalid"
  );
  let manifest;
  try {
    manifest = parseStrictJson(manifestBytes);
  } catch (_error) {
    fail("archive_fuzz_hosted_corpus_invalid");
  }
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== 29) {
    fail("archive_fuzz_hosted_corpus_invalid");
  }
  const sourceDirectory = path.dirname(manifestPath);
  const expectedFiles = [];
  for (const entry of manifest.entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
        typeof entry.file !== "string" || path.basename(entry.file) !== entry.file ||
        !entry.file.endsWith(".seed") || !Number.isSafeInteger(entry.bytes) ||
        entry.bytes <= 0 || entry.bytes > 4_096 || !sha256Pattern.test(entry.sha256)) {
      fail("archive_fuzz_hosted_corpus_invalid");
    }
    const source = path.join(sourceDirectory, entry.file);
    const bytes = readRegularFile(
      source,
      4_096,
      false,
      "archive_fuzz_hosted_corpus_invalid"
    );
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) {
      fail("archive_fuzz_hosted_corpus_invalid");
    }
    writeExclusive(path.join(corpusDirectory, entry.file), bytes);
    expectedFiles.push(entry.file);
  }
  const actualFiles = fs.readdirSync(corpusDirectory).sort();
  if (new Set(expectedFiles).size !== expectedFiles.length ||
      expectedFiles.join(",") !== [...expectedFiles].sort().join(",") ||
      actualFiles.join(",") !== expectedFiles.join(",")) {
    fail("archive_fuzz_hosted_corpus_invalid");
  }
}

function expandStepArguments(step, paths) {
  const values = Object.freeze({
    corpusDir: paths.corpusDirectory,
    dictionaryPath: sourcePath(
      "rust/crates/tinyrustlm-archive/fuzz/dictionaries/structured_archive.dict"
    ),
    findingsDir: paths.findingsDirectory,
    fuzzManifest: sourcePath("rust/crates/tinyrustlm-archive/fuzz/Cargo.toml"),
    fuzzRoot: sourcePath("rust/crates/tinyrustlm-archive/fuzz"),
    targetDir: paths.targetDirectory
  });
  return step.arguments.map((argument) => argument.replace(
    /\{(corpusDir|dictionaryPath|findingsDir|fuzzManifest|fuzzRoot|targetDir)\}/gu,
    (_match, key) => values[key]
  ));
}

function boundedBuffer(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.alloc(0);
  if (bytes.length <= profile.limits.maximumLogBytesPerStream) {
    return Object.freeze({ bytes, exceeded: false });
  }
  return Object.freeze({
    bytes: bytes.subarray(0, profile.limits.maximumLogBytesPerStream),
    exceeded: true
  });
}

function runStep(step, index, paths) {
  const started = Date.now();
  const result = childProcess.spawnSync(step.command, expandStepArguments(step, paths), {
    cwd: repositoryRoot,
    encoding: null,
    env: childEnvironment(),
    maxBuffer: profile.limits.maximumLogBytesPerStream,
    shell: false,
    timeout: step.maximumDurationMilliseconds,
    windowsHide: true
  });
  const durationMilliseconds = Math.max(0, Date.now() - started);
  const stdout = boundedBuffer(result.stdout);
  const stderr = boundedBuffer(result.stderr);
  const outputLimitExceeded = stdout.exceeded || stderr.exceeded ||
    result.error?.code === "ENOBUFS";
  const timedOut = result.error?.code === "ETIMEDOUT";
  const number = String(index + 1).padStart(2, "0");
  let failureCode = null;
  if (outputLimitExceeded) {
    failureCode = "archive_fuzz_hosted_command_output_limit";
  } else if (timedOut) {
    failureCode = "archive_fuzz_hosted_command_timeout";
  } else if (result.error) {
    failureCode = "archive_fuzz_hosted_command_launch_failed";
  } else if (result.signal !== null || result.status !== 0) {
    failureCode = "archive_fuzz_hosted_command_failed";
  }
  const record = Object.freeze({
    durationMilliseconds,
    exitCode: Number.isSafeInteger(result.status) ? result.status : null,
    id: step.id,
    outputLimitExceeded,
    signal: typeof result.signal === "string" ? result.signal : null,
    stderrByteCount: stderr.bytes.length,
    stderrFile: `${number}-${step.id}.stderr.log`,
    stderrSha256: sha256(stderr.bytes),
    stdoutByteCount: stdout.bytes.length,
    stdoutFile: `${number}-${step.id}.stdout.log`,
    stdoutSha256: sha256(stdout.bytes),
    timedOut
  });
  return Object.freeze({ failureCode, record, stderr: stderr.bytes, stdout: stdout.bytes });
}

function captureFindings(findingsDirectory) {
  const entries = fs.readdirSync(findingsDirectory).sort();
  if (entries.length > profile.limits.maximumFindingCount) {
    return Object.freeze({ files: [], limitExceeded: true });
  }
  const files = [];
  let totalBytes = 0;
  for (const [index, name] of entries.entries()) {
    const filePath = path.join(findingsDirectory, name);
    let bytes;
    try {
      bytes = readRegularFile(
        filePath,
        profile.limits.maximumFindingBytes,
        false,
        "archive_fuzz_hosted_findings_limit"
      );
    } catch (_error) {
      return Object.freeze({ files: [], limitExceeded: true });
    }
    totalBytes += bytes.length;
    if (totalBytes > profile.limits.maximumTotalFindingBytes) {
      return Object.freeze({ files: [], limitExceeded: true });
    }
    const file = `finding-${String(index + 1).padStart(3, "0")}.input`;
    files.push(Object.freeze({
      bytes,
      record: Object.freeze({ byteCount: bytes.length, file, sha256: sha256(bytes) })
    }));
  }
  return Object.freeze({ files: Object.freeze(files), limitExceeded: false });
}

function removeOwnedScratch(scratchRoot, scratchWorktree) {
  const relative = path.relative(scratchRoot, scratchWorktree);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) ||
      relative.includes(path.sep)) {
    fail("archive_fuzz_hosted_scratch_cleanup_failed");
  }
  try {
    fs.rmSync(scratchWorktree, { force: true, recursive: true });
  } catch (_error) {
    fail("archive_fuzz_hosted_scratch_cleanup_failed");
  }
  if (fs.existsSync(scratchWorktree)) {
    fail("archive_fuzz_hosted_scratch_cleanup_failed");
  }
}

function writeEvidence(outputRoot, record, stepOutputs, findingOutputs) {
  const recordBytes = canonicalizeVnextJcsBytes(record);
  if (recordBytes.length === 0 || recordBytes.length > profile.limits.maximumRecordBytes) {
    fail("archive_fuzz_hosted_record_invalid");
  }
  let ownsOutputRoot = false;
  try {
    fs.mkdirSync(outputRoot, { mode: 0o700, recursive: false });
    ownsOutputRoot = true;
    for (const output of stepOutputs) {
      writeExclusive(path.join(outputRoot, output.record.stdoutFile), output.stdout);
      writeExclusive(path.join(outputRoot, output.record.stderrFile), output.stderr);
    }
    for (const finding of findingOutputs) {
      writeExclusive(path.join(outputRoot, finding.record.file), finding.bytes);
    }
    writeExclusive(path.join(outputRoot, profile.recordFile), recordBytes);
    let directoryDescriptor;
    try {
      directoryDescriptor = fs.openSync(outputRoot, fs.constants.O_RDONLY);
      fs.fsyncSync(directoryDescriptor);
    } finally {
      if (directoryDescriptor !== undefined) fs.closeSync(directoryDescriptor);
    }
    const readback = readRegularFile(
      path.join(outputRoot, profile.recordFile),
      profile.limits.maximumRecordBytes,
      false,
      "archive_fuzz_hosted_readback_failed"
    );
    if (!readback.equals(recordBytes)) fail("archive_fuzz_hosted_readback_failed");
    return Object.freeze({
      recordByteCount: recordBytes.length,
      recordSha256: sha256(recordBytes)
    });
  } catch (error) {
    if (ownsOutputRoot && isDirectChild(path.dirname(outputRoot), outputRoot)) {
      try {
        fs.rmSync(outputRoot, { force: true, recursive: true });
      } catch (_cleanupError) {
        // The original bounded evidence-write failure remains authoritative.
      }
    }
    throw error;
  }
}

function validateStepRecord(step, expected, index) {
  assertDataObject(step, profile.stepRecordFields,
    "archive_fuzz_hosted_record_invalid");
  const number = String(index + 1).padStart(2, "0");
  if (step.id !== expected.id || !Number.isSafeInteger(step.durationMilliseconds) ||
      step.durationMilliseconds < 0 ||
      step.durationMilliseconds > expected.maximumDurationMilliseconds + 5_000 ||
      !(step.exitCode === null || (Number.isSafeInteger(step.exitCode) &&
        step.exitCode >= 0 && step.exitCode <= 255)) ||
      !(step.signal === null || (typeof step.signal === "string" &&
        /^[A-Z][A-Z0-9]{2,31}$/u.test(step.signal))) ||
      typeof step.outputLimitExceeded !== "boolean" ||
      typeof step.timedOut !== "boolean" ||
      step.stdoutFile !== `${number}-${expected.id}.stdout.log` ||
      step.stderrFile !== `${number}-${expected.id}.stderr.log` ||
      !Number.isSafeInteger(step.stdoutByteCount) || step.stdoutByteCount < 0 ||
      step.stdoutByteCount > profile.limits.maximumLogBytesPerStream ||
      !Number.isSafeInteger(step.stderrByteCount) || step.stderrByteCount < 0 ||
      step.stderrByteCount > profile.limits.maximumLogBytesPerStream ||
      !sha256Pattern.test(step.stdoutSha256) ||
      !sha256Pattern.test(step.stderrSha256)) {
    fail("archive_fuzz_hosted_record_invalid");
  }
}

function verifyArchiveFuzzHostedEvidence(evidenceRootValue) {
  const evidenceRoot = normalizeAbsolutePath(
    evidenceRootValue,
    "archive_fuzz_hosted_evidence_root_invalid"
  );
  assertExistingDirectoryWithoutLinks(evidenceRoot,
    "archive_fuzz_hosted_evidence_root_invalid");
  const recordPath = path.join(evidenceRoot, profile.recordFile);
  const recordBytes = readRegularFile(
    recordPath,
    profile.limits.maximumRecordBytes,
    false,
    "archive_fuzz_hosted_record_invalid"
  );
  let record;
  try {
    record = parseStrictJson(recordBytes);
  } catch (_error) {
    fail("archive_fuzz_hosted_record_invalid");
  }
  if (!canonicalizeVnextJcsBytes(record).equals(recordBytes)) {
    fail("archive_fuzz_hosted_record_noncanonical");
  }
  assertDataObject(record, profile.recordFields, "archive_fuzz_hosted_record_invalid");
  const started = Date.parse(record.startedUtc);
  const finished = Date.parse(record.finishedUtc);
  if (record.schema !== profile.recordSchema ||
      record.profileId !== profile.profileId ||
      record.profileSha256 !== archiveFuzzHostedVerificationProfileSha256 ||
      record.fuzzProfileId !== profile.fuzzProfileId ||
      record.fuzzProfileSha256 !== profile.fuzzProfileSha256 ||
      record.corpusManifestSha256 !== profile.corpusManifestSha256 ||
      record.cargoLockSha256 !== profile.cargoLockSha256 ||
      record.executionClass !== profile.executionClass ||
      record.provider !== profile.provider || record.repository !== profile.repository ||
      record.runnerEnvironment !== profile.runnerEnvironment ||
      record.operatingSystem !== profile.operatingSystem ||
      !profile.acceptedArchitectures.includes(record.architecture) ||
      !profile.acceptedEvents.includes(record.eventName) ||
      record.workflowPath !== profile.workflowPath ||
      record.workflowJob !== profile.workflowJob ||
      !runIdPattern.test(record.workflowRunId) ||
      record.workflowRunId.length > profile.limits.maximumRunIdCharacters ||
      !Number.isSafeInteger(record.workflowRunAttempt) ||
      record.workflowRunAttempt <= 0 ||
      record.workflowRunAttempt > profile.limits.maximumRunAttempt ||
      !sourceRevisionPattern.test(record.sourceRevision) ||
      record.sourceRevision !== currentSourceRevision() ||
      record.sourceWorktreeClean !== true ||
      record.toolchain !== profile.toolchain ||
      record.cargoFuzzVersion !== profile.cargoFuzzVersion ||
      record.libfuzzerSysVersion !== profile.libfuzzerSysVersion ||
      record.sanitizer !== profile.sanitizer || record.target !== profile.target ||
      record.scratchCleanup !== profile.scratchCleanup ||
      typeof record.nodeVersion !== "string" || !/^v\d+\.\d+\.\d+$/u.test(record.nodeVersion) ||
      !utcPattern.test(record.startedUtc) || !utcPattern.test(record.finishedUtc) ||
      !Number.isFinite(started) || !Number.isFinite(finished) || finished < started ||
      finished - started > profile.limits.maximumTotalDurationMilliseconds ||
      record.workflowSha256 !== currentWorkflowSha256() ||
      record.verificationSourceClosureSha256 !== verificationSourceClosureSha256() ||
      !profile.verdicts.includes(record.verdict) || !Array.isArray(record.steps) ||
      !Array.isArray(record.findings)) {
    fail("archive_fuzz_hosted_record_invalid");
  }
  const expectedFiles = [profile.recordFile];
  let totalStepDuration = 0;
  record.steps.forEach((step, index) => {
    if (index >= profile.steps.length) fail("archive_fuzz_hosted_record_invalid");
    validateStepRecord(step, profile.steps[index], index);
    totalStepDuration += step.durationMilliseconds;
    let stdoutBytes;
    for (const [fileKey, bytesKey, hashKey] of [
      ["stdoutFile", "stdoutByteCount", "stdoutSha256"],
      ["stderrFile", "stderrByteCount", "stderrSha256"]
    ]) {
      const bytes = readRegularFile(
        path.join(evidenceRoot, step[fileKey]),
        profile.limits.maximumLogBytesPerStream,
        true,
        "archive_fuzz_hosted_log_invalid"
      );
      if (bytes.length !== step[bytesKey] || sha256(bytes) !== step[hashKey]) {
        fail("archive_fuzz_hosted_log_invalid");
      }
      if (fileKey === "stdoutFile") stdoutBytes = bytes;
      expectedFiles.push(step[fileKey]);
    }
    if (index === 0 && stdoutBytes.toString("utf8").trim() !==
        `cargo-fuzz ${profile.cargoFuzzVersion}`) {
      fail("archive_fuzz_hosted_log_invalid");
    }
  });
  if (totalStepDuration > profile.limits.maximumTotalDurationMilliseconds) {
    fail("archive_fuzz_hosted_record_invalid");
  }
  let totalFindingBytes = 0;
  record.findings.forEach((finding, index) => {
    assertDataObject(finding, profile.findingRecordFields,
      "archive_fuzz_hosted_record_invalid");
    const expectedFile = `finding-${String(index + 1).padStart(3, "0")}.input`;
    if (finding.file !== expectedFile || !Number.isSafeInteger(finding.byteCount) ||
        finding.byteCount <= 0 || finding.byteCount > profile.limits.maximumFindingBytes ||
        !sha256Pattern.test(finding.sha256)) {
      fail("archive_fuzz_hosted_record_invalid");
    }
    const bytes = readRegularFile(
      path.join(evidenceRoot, finding.file),
      profile.limits.maximumFindingBytes,
      false,
      "archive_fuzz_hosted_finding_invalid"
    );
    if (bytes.length !== finding.byteCount || sha256(bytes) !== finding.sha256) {
      fail("archive_fuzz_hosted_finding_invalid");
    }
    totalFindingBytes += bytes.length;
    expectedFiles.push(finding.file);
  });
  if (record.findings.length > profile.limits.maximumFindingCount ||
      totalFindingBytes > profile.limits.maximumTotalFindingBytes) {
    fail("archive_fuzz_hosted_record_invalid");
  }
  if (record.verdict === "pass") {
    if (record.failureCode !== null || record.steps.length !== profile.steps.length ||
        record.findings.length !== 0 || record.steps.some((step) =>
          step.exitCode !== 0 || step.signal !== null || step.timedOut ||
          step.outputLimitExceeded)) {
      fail("archive_fuzz_hosted_record_invalid");
    }
  } else {
    if (!profile.failureCodes.includes(record.failureCode) || record.steps.length === 0 ||
        (!["archive_fuzz_hosted_findings_limit",
          "archive_fuzz_hosted_tool_identity_mismatch"].includes(record.failureCode) &&
          record.findings.length === 0 &&
          record.steps.at(-1).exitCode === 0 && record.steps.at(-1).signal === null &&
          !record.steps.at(-1).timedOut && !record.steps.at(-1).outputLimitExceeded)) {
      fail("archive_fuzz_hosted_record_invalid");
    }
  }
  const actualFiles = fs.readdirSync(evidenceRoot).sort();
  expectedFiles.sort();
  if (actualFiles.join(",") !== expectedFiles.join(",") ||
      recordBytes.includes(Buffer.from(evidenceRoot, "utf8"))) {
    fail("archive_fuzz_hosted_evidence_root_invalid");
  }
  return Object.freeze({
    architecture: record.architecture,
    recordByteCount: recordBytes.length,
    recordSha256: sha256(recordBytes),
    sourceRevision: record.sourceRevision,
    verdict: record.verdict,
    workflowRunId: record.workflowRunId
  });
}

async function runArchiveFuzzHostedVerification(options) {
  assertDataObject(options, ["outputRoot", "scratchRoot"],
    "archive_fuzz_hosted_options_invalid");
  const context = hostedContext();
  const outputRoot = normalizeAbsolutePath(options.outputRoot,
    "archive_fuzz_hosted_options_invalid");
  const scratchRoot = normalizeAbsolutePath(options.scratchRoot,
    "archive_fuzz_hosted_options_invalid");
  const configuredRunnerTemp = normalizeAbsolutePath(context.runnerTemp,
    "archive_fuzz_hosted_environment_invalid");
  if (scratchRoot !== configuredRunnerTemp ||
      outputRoot !== path.join(scratchRoot, "archive-fuzz-hosted-verification") ||
      !isDirectChild(scratchRoot, outputRoot) || fs.existsSync(outputRoot)) {
    fail("archive_fuzz_hosted_options_invalid");
  }
  assertExistingDirectoryWithoutLinks(scratchRoot,
    "archive_fuzz_hosted_options_invalid");
  requireCleanSource(context.sourceRevision);

  const startedUtc = new Date().toISOString();
  let scratchWorktree;
  const stepOutputs = [];
  let capturedFindings = Object.freeze({ files: Object.freeze([]), limitExceeded: false });
  let failureCode = null;
  try {
    scratchWorktree = fs.mkdtempSync(path.join(scratchRoot, "tinyrustlm-archive-fuzz-"));
    assertExistingDirectoryWithoutLinks(scratchWorktree,
      "archive_fuzz_hosted_scratch_invalid");
    const paths = Object.freeze({
      corpusDirectory: path.join(scratchWorktree, "corpus"),
      findingsDirectory: path.join(scratchWorktree, "findings"),
      targetDirectory: path.join(scratchWorktree, "target")
    });
    fs.mkdirSync(paths.corpusDirectory, { mode: 0o700 });
    fs.mkdirSync(paths.findingsDirectory, { mode: 0o700 });
    copyFrozenCorpus(paths.corpusDirectory);
    for (const [index, step] of profile.steps.entries()) {
      const output = runStep(step, index, paths);
      stepOutputs.push(output);
      if (output.failureCode !== null) {
        failureCode = output.failureCode;
        break;
      }
      if (step.id === "cargo-fuzz-version" &&
          output.stdout.toString("utf8").trim() !==
            `cargo-fuzz ${profile.cargoFuzzVersion}`) {
        failureCode = "archive_fuzz_hosted_tool_identity_mismatch";
        break;
      }
    }
    capturedFindings = captureFindings(paths.findingsDirectory);
    if (capturedFindings.limitExceeded) {
      failureCode = "archive_fuzz_hosted_findings_limit";
    } else if (capturedFindings.files.length > 0 && failureCode === null) {
      failureCode = "archive_fuzz_hosted_command_failed";
    }
  } finally {
    if (scratchWorktree !== undefined) removeOwnedScratch(scratchRoot, scratchWorktree);
  }
  requireCleanSource(context.sourceRevision);
  const verdict = failureCode === null && stepOutputs.length === profile.steps.length
    ? "pass"
    : "fail";
  const finishedUtc = new Date().toISOString();
  const record = Object.freeze({
    architecture: context.architecture,
    cargoFuzzVersion: profile.cargoFuzzVersion,
    cargoLockSha256: profile.cargoLockSha256,
    corpusManifestSha256: profile.corpusManifestSha256,
    eventName: context.eventName,
    executionClass: profile.executionClass,
    failureCode,
    findings: Object.freeze(capturedFindings.files.map((entry) => entry.record)),
    finishedUtc,
    fuzzProfileId: profile.fuzzProfileId,
    fuzzProfileSha256: profile.fuzzProfileSha256,
    libfuzzerSysVersion: profile.libfuzzerSysVersion,
    nodeVersion: process.version,
    operatingSystem: profile.operatingSystem,
    profileId: profile.profileId,
    profileSha256: archiveFuzzHostedVerificationProfileSha256,
    provider: profile.provider,
    repository: profile.repository,
    runnerEnvironment: profile.runnerEnvironment,
    sanitizer: profile.sanitizer,
    schema: profile.recordSchema,
    scratchCleanup: profile.scratchCleanup,
    sourceRevision: context.sourceRevision,
    sourceWorktreeClean: true,
    startedUtc,
    steps: Object.freeze(stepOutputs.map((entry) => entry.record)),
    target: profile.target,
    toolchain: profile.toolchain,
    verdict,
    verificationSourceClosureSha256: verificationSourceClosureSha256(),
    workflowJob: profile.workflowJob,
    workflowPath: profile.workflowPath,
    workflowRunAttempt: context.workflowRunAttempt,
    workflowRunId: context.workflowRunId,
    workflowSha256: currentWorkflowSha256()
  });
  const written = writeEvidence(
    outputRoot,
    record,
    stepOutputs,
    capturedFindings.files
  );
  const verified = verifyArchiveFuzzHostedEvidence(outputRoot);
  if (written.recordByteCount !== verified.recordByteCount ||
      written.recordSha256 !== verified.recordSha256 || verified.verdict !== verdict) {
    fail("archive_fuzz_hosted_readback_failed");
  }
  return verified;
}

async function main() {
  const [operation, firstPath, secondPath, ...extra] = process.argv.slice(2);
  let result;
  if (operation === "run" && firstPath && secondPath && extra.length === 0) {
    result = await runArchiveFuzzHostedVerification({
      outputRoot: firstPath,
      scratchRoot: secondPath
    });
  } else if (operation === "verify" && firstPath && !secondPath && extra.length === 0) {
    result = verifyArchiveFuzzHostedEvidence(firstPath);
  } else {
    fail("archive_fuzz_hosted_cli_invalid");
  }
  process.stdout.write(`${JSON.stringify({
    architecture: result.architecture,
    recordByteCount: result.recordByteCount,
    recordSha256: result.recordSha256,
    sourceRevision: result.sourceRevision,
    verdict: result.verdict,
    workflowRunId: result.workflowRunId
  })}\n`);
  if (result.verdict !== "pass") {
    process.stderr.write("TinyRustLM hosted archive fuzz verification failed\n");
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write("TinyRustLM hosted archive fuzz verification failed\n");
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  archiveFuzzHostedVerificationProfileId,
  archiveFuzzHostedVerificationProfileSha256,
  archiveFuzzHostedVerificationSourceClosureSha256:
    verificationSourceClosureSha256,
  runArchiveFuzzHostedVerification,
  verifyArchiveFuzzHostedEvidence
});

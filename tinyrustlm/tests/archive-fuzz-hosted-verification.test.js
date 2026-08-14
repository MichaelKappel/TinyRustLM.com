"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  archiveFuzzHostedVerificationProfileId,
  archiveFuzzHostedVerificationProfileSha256,
  archiveFuzzHostedVerificationSourceClosureSha256,
  verifyArchiveFuzzHostedEvidence
} = require("../tools/archive-fuzz-hosted-verification.js");
const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const { resolveRepositoryRoot } = require("./helpers/repository-root.js");

const repositoryRoot = resolveRepositoryRoot({
  requiredFiles: [
    "contracts/vnext/archive-fuzz-hosted-verification-profile.v1.json"
  ]
});
const profilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "archive-fuzz-hosted-verification-profile.v1.json"
);
const workflowPath = path.join(repositoryRoot, ".github", "workflows", "ci.yml");
const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function currentSourceRevision() {
  const result = childProcess.spawnSync(
    "git",
    ["-C", repositoryRoot, "rev-parse", "HEAD"],
    { encoding: "utf8", shell: false, windowsHide: true }
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  return result.stdout.trim();
}

function makeRoot(context, label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), label));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  return root;
}

function writeEvidence(context, options = {}) {
  const root = makeRoot(context, "tinyrustlm-hosted-fuzz-evidence-");
  const failureIndex = options.failureIndex ?? null;
  const findingBytes = options.findingBytes ?? [];
  const stepCount = failureIndex === null ? profile.steps.length : failureIndex + 1;
  const steps = [];
  for (let index = 0; index < stepCount; index += 1) {
    const definition = profile.steps[index];
    const number = String(index + 1).padStart(2, "0");
    const stdout = index === 0
      ? Buffer.from(`cargo-fuzz ${profile.cargoFuzzVersion}\n`, "utf8")
      : Buffer.from(`bounded-${definition.id}-stdout\n`, "utf8");
    const stderr = index === failureIndex
      ? Buffer.from("bounded-command-failure\n", "utf8")
      : Buffer.alloc(0);
    const stdoutFile = `${number}-${definition.id}.stdout.log`;
    const stderrFile = `${number}-${definition.id}.stderr.log`;
    fs.writeFileSync(path.join(root, stdoutFile), stdout);
    fs.writeFileSync(path.join(root, stderrFile), stderr);
    steps.push({
      durationMilliseconds: 5,
      exitCode: index === failureIndex ? 1 : 0,
      id: definition.id,
      outputLimitExceeded: false,
      signal: null,
      stderrByteCount: stderr.length,
      stderrFile,
      stderrSha256: sha256(stderr),
      stdoutByteCount: stdout.length,
      stdoutFile,
      stdoutSha256: sha256(stdout),
      timedOut: false
    });
  }
  const findings = findingBytes.map((bytesValue, index) => {
    const bytes = Buffer.from(bytesValue);
    const file = `finding-${String(index + 1).padStart(3, "0")}.input`;
    fs.writeFileSync(path.join(root, file), bytes);
    return { byteCount: bytes.length, file, sha256: sha256(bytes) };
  });
  const failed = failureIndex !== null;
  const record = {
    architecture: "X64",
    cargoFuzzVersion: profile.cargoFuzzVersion,
    cargoLockSha256: profile.cargoLockSha256,
    corpusManifestSha256: profile.corpusManifestSha256,
    eventName: "push",
    executionClass: profile.executionClass,
    failureCode: failed ? "archive_fuzz_hosted_command_failed" : null,
    findings,
    finishedUtc: "2026-08-14T12:00:01.000Z",
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
    sourceRevision: currentSourceRevision(),
    sourceWorktreeClean: true,
    startedUtc: "2026-08-14T12:00:00.000Z",
    steps,
    target: profile.target,
    toolchain: profile.toolchain,
    verdict: failed ? "fail" : "pass",
    verificationSourceClosureSha256:
      archiveFuzzHostedVerificationSourceClosureSha256(),
    workflowJob: profile.workflowJob,
    workflowPath: profile.workflowPath,
    workflowRunAttempt: 1,
    workflowRunId: "123456789",
    workflowSha256: sha256(fs.readFileSync(workflowPath))
  };
  const recordPath = path.join(root, profile.recordFile);
  fs.writeFileSync(recordPath, canonicalizeVnextJcsBytes(record));
  return { record, recordPath, root, steps };
}

test("freezes one hosted sanitizer evidence profile and sole CI runner", () => {
  const profileBytes = fs.readFileSync(profilePath);
  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.equal(sha256(profileBytes),
    "0943bba8ceba94c6f925cd5cb33d163c33d654e4e59266c00ca3ef6346bfc415");
  assert.equal(profile.profileId, archiveFuzzHostedVerificationProfileId);
  assert.equal(profile.status, "frozen");
  assert.equal(profile.versionPolicy,
    "single-current-profile-no-compatibility-reader");
  assert.equal(profile.toolchain, "nightly-2026-08-01");
  assert.equal(profile.cargoFuzzVersion, "0.13.2");
  assert.equal(profile.libfuzzerSysVersion, "0.4.13");
  assert.equal(profile.sanitizer, "address");
  assert.deepEqual(profile.steps.map((entry) => entry.id), [
    "cargo-fuzz-version",
    "rustc-version",
    "corpus-manifest-replay",
    "libfuzzer-corpus-replay",
    "bounded-sanitizer-fuzz"
  ]);
  assert.equal(profile.steps[3].arguments.includes("--sanitizer"), true);
  assert.equal(profile.steps[3].arguments.includes("address"), true);
  assert.equal(profile.steps[4].arguments.includes("-max_total_time=60"), true);
  assert.match(workflow, /^  push:\r?$/mu);
  assert.doesNotMatch(workflow, /push:\r?\n\s+branches:\s*\[\s*main\s*\]/u);
  assert.match(workflow, /Verify hosted fuzz evidence contract/u);
  assert.match(workflow, /Fetch exact locked fuzz dependencies/u);
  assert.match(workflow,
    /node tinyrustlm\/tools\/archive-fuzz-hosted-verification\.js run/u);
  assert.match(workflow, /if: always\(\)/u);
  assert.match(workflow,
    /tinyrustlm-archive-fuzz-hosted-verification-\$\{\{ runner\.arch \}\}/u);
  assert.match(workflow, /retention-days: 90/u);
  assert.doesNotMatch(workflow,
    /cargo \+nightly-2026-08-01 fuzz run[\s\S]*-max_total_time=60/u);
});

test("accepts a canonical path-free pass record with exact bounded logs", (context) => {
  const evidence = writeEvidence(context);
  const result = verifyArchiveFuzzHostedEvidence(evidence.root);
  const recordBytes = fs.readFileSync(evidence.recordPath);

  assert.equal(result.architecture, "X64");
  assert.equal(result.recordByteCount, recordBytes.length);
  assert.equal(result.recordSha256, sha256(recordBytes));
  assert.equal(result.sourceRevision, currentSourceRevision());
  assert.equal(result.verdict, "pass");
  assert.equal(result.workflowRunId, "123456789");
  assert.equal(recordBytes.includes(Buffer.from(evidence.root, "utf8")), false);
});

test("accepts a canonical failed run as failure evidence without promoting it", (context) => {
  const evidence = writeEvidence(context, {
    failureIndex: 2,
    findingBytes: [Buffer.from("TAF1ZV bounded failure", "utf8")]
  });
  const result = verifyArchiveFuzzHostedEvidence(evidence.root);

  assert.equal(result.verdict, "fail");
  assert.equal(evidence.record.failureCode, "archive_fuzz_hosted_command_failed");
  assert.equal(evidence.record.findings.length, 1);
  assert.equal(evidence.record.steps.length, 3);
});

test("rejects log tampering extra files and noncanonical records", (context) => {
  const tampered = writeEvidence(context);
  fs.appendFileSync(path.join(tampered.root, tampered.steps[1].stdoutFile), "drift");
  assert.throws(
    () => verifyArchiveFuzzHostedEvidence(tampered.root),
    (error) => error.code === "archive_fuzz_hosted_log_invalid"
  );

  const extra = writeEvidence(context);
  fs.writeFileSync(path.join(extra.root, "unexpected.txt"), "unexpected");
  assert.throws(
    () => verifyArchiveFuzzHostedEvidence(extra.root),
    (error) => error.code === "archive_fuzz_hosted_evidence_root_invalid"
  );

  const noncanonical = writeEvidence(context);
  fs.writeFileSync(noncanonical.recordPath,
    Buffer.from(JSON.stringify(noncanonical.record, null, 2), "utf8"));
  assert.throws(
    () => verifyArchiveFuzzHostedEvidence(noncanonical.root),
    (error) => error.code === "archive_fuzz_hosted_record_noncanonical"
  );
});

test("local CLI cannot manufacture a github-hosted run", (context) => {
  const root = makeRoot(context, "tinyrustlm-hosted-fuzz-local-reject-");
  const outputRoot = path.join(root, "archive-fuzz-hosted-verification");
  const toolPath = path.resolve(
    __dirname,
    "../tools/archive-fuzz-hosted-verification.js"
  );
  const environment = { ...process.env };
  for (const key of [
    "CI", "GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "GITHUB_JOB",
    "GITHUB_REPOSITORY", "GITHUB_RUN_ATTEMPT", "GITHUB_RUN_ID", "GITHUB_SHA",
    "GITHUB_WORKFLOW_REF", "RUNNER_ARCH", "RUNNER_ENVIRONMENT", "RUNNER_OS",
    "RUNNER_TEMP"
  ]) {
    delete environment[key];
  }
  const result = childProcess.spawnSync(
    process.execPath,
    [toolPath, "run", outputRoot, root],
    {
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024,
      shell: false,
      windowsHide: true
    }
  );

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr,
    "TinyRustLM hosted archive fuzz verification failed\n");
  assert.equal(fs.existsSync(outputRoot), false);
});

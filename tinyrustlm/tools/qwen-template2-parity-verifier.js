"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");

const { parseStrictJson } = require("./strict-json.js");
const {
  parseTemplate2,
  writeTemplate2
} = require("./template2-reference.js");
const {
  categoryCounts,
  renderCorpus
} = require("./qwen-template2-parity-corpus.js");
const {
  renderLock: renderEnvironmentLock
} = require("./template2-source-oracle-environment.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const executionProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-template2-parity-preregistration.v1.json"
);
const verificationProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-template2-parity-verification-preregistration.v1.json"
);
const EXECUTION_PROFILE_SCHEMA =
  "tinyrustlm.vnext.qwen-template2-parity-preregistration.v1";
const VERIFICATION_PROFILE_SCHEMA =
  "tinyrustlm.vnext.qwen-template2-parity-verification-preregistration.v1";
const RESULT_SCHEMA = "tinyrustlm.qwen3_template2_parity_result.v1";
const RECEIPT_SCHEMA =
  "tinyrustlm.qwen3_template2_parity_verification_receipt.v1";
const EXECUTION_PROFILE_ID = "tinyrustlm.qwen3-template2-source-parity/1";
const VERIFICATION_PROFILE_ID =
  "tinyrustlm.qwen3-template2-source-parity-verification/1";
const REGISTERED_AT_UTC = "2026-08-22T10:30:00Z";
const REGISTRATION_PARENT_COMMIT =
  "81a6d53844761d10c0eb1563b5420788c1772f8f";
const MAXIMUM_PROFILE_BYTES = 1024 * 1024;
const MAXIMUM_RESULT_BYTES = 16 * 1024 * 1024;
const MAXIMUM_RECEIPT_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const HEX_PATTERN = /^(?:[a-f0-9]{2})*$/u;
const FORBIDDEN_PUBLIC_TEXT =
  /(?:[a-z]:\\|\/home\/|\/mnt\/[a-z]\/|bearer\s|token=|secret=|invite)/iu;
const EXPECTED_CATEGORY_COUNTS = Object.freeze({
  "bounded-long-content": 64,
  "empty-content": 32,
  "fixed-contract": 32,
  "multi-turn": 256,
  "multilingual-unicode": 128,
  "ordinary-single-turn": 224,
  "system-single-turn": 128,
  "template-syntax-data": 64,
  "whitespace-line-ending": 96
});

class Template2VerificationError extends Error {
  constructor(code) {
    super(code);
    this.name = "Template2VerificationError";
    this.code = code;
  }
}

function fail(code) {
  throw new Template2VerificationError(code);
}

function invariant(condition, code) {
  if (!condition) fail(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys, code) {
  invariant(isPlainObject(value), code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(
    actual.length === expected.length &&
      actual.every((key, index) => key === expected[index]),
    code
  );
  return value;
}

function exactValue(value, expected, code) {
  invariant(isDeepStrictEqual(value, expected), code);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function requireDigest(value, code) {
  invariant(
    typeof value === "string" && SHA256_PATTERN.test(value) &&
      !/^0{64}$/u.test(value),
    code
  );
  return value;
}

function requireRelativePath(value, code) {
  invariant(
    typeof value === "string" && value.length > 0 && value.length <= 256 &&
      !value.includes("\\") && !path.posix.isAbsolute(value) &&
      value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".."),
    code
  );
  return value;
}

function normalizePath(filePath) {
  return path.normalize(filePath).toLowerCase();
}

function readRegularFile(filePath, maximumBytes, code, allowEmpty = false) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    fail(code);
  }
  invariant(
    stat.isFile() && !stat.isSymbolicLink() &&
      (allowEmpty || stat.size > 0) && stat.size <= maximumBytes,
    code
  );
  let bytes;
  try {
    bytes = fs.readFileSync(filePath);
  } catch {
    fail(code);
  }
  invariant(bytes.length === stat.size, code);
  return Object.freeze({ bytes, stat });
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

function directRegularPath(filePath, maximumBytes, code) {
  invariant(path.isAbsolute(filePath), code);
  const file = readRegularFile(filePath, maximumBytes, code);
  let resolved;
  try {
    resolved = fs.realpathSync.native(filePath);
  } catch {
    fail(code);
  }
  invariant(normalizePath(resolved) === normalizePath(filePath), code);
  return Object.freeze({ ...file, path: resolved });
}

function readStrictJson(filePath, maximumBytes, code) {
  const file = directRegularPath(filePath, maximumBytes, code);
  let value;
  try {
    value = parseStrictJson(file.bytes, {
      maximumBytes,
      maximumDepth: 64,
      maximumTotalEntries: 8 * 1024 * 1024,
      maximumObjectMembers: 4096,
      maximumArrayItems: 65_536,
      maximumStringCodeUnits: maximumBytes,
      maximumTotalStringCodeUnits: maximumBytes,
      maximumNumberCharacters: 32
    });
  } catch {
    fail(code);
  }
  return Object.freeze({ ...file, value });
}

function validateRepositoryFile(relativePath, byteLength, digest, maximumBytes, code) {
  requireRelativePath(relativePath, code);
  invariant(Number.isSafeInteger(byteLength) && byteLength > 0, code);
  requireDigest(digest, code);
  const filePath = path.join(repositoryRoot, ...relativePath.split("/"));
  const file = directRegularPath(filePath, maximumBytes, code);
  invariant(file.bytes.length === byteLength && sha256(file.bytes) === digest, code);
  return file;
}

function closureSha256(entries, code) {
  invariant(Array.isArray(entries) && entries.length > 0, code);
  const chunks = [];
  let previous = null;
  for (const entry of entries) {
    exactKeys(entry, ["path", "byteLength", "sha256"], code);
    requireRelativePath(entry.path, code);
    invariant(
      previous === null || Buffer.compare(
        Buffer.from(previous, "utf8"),
        Buffer.from(entry.path, "utf8")
      ) < 0,
      code
    );
    invariant(Number.isSafeInteger(entry.byteLength) && entry.byteLength >= 0, code);
    requireDigest(entry.sha256, code);
    previous = entry.path;
    chunks.push(Buffer.from(
      `${entry.path}\0${entry.byteLength}\0${entry.sha256}\n`,
      "utf8"
    ));
  }
  return sha256(Buffer.concat(chunks));
}

function validateSourceClosure(entries, expectedDigest, expectedPaths, code) {
  invariant(Array.isArray(entries) && entries.length === expectedPaths.length, code);
  for (const entry of entries) {
    exactKeys(entry, ["path", "byteLength", "sha256"], code);
  }
  exactValue(entries.map((entry) => entry.path), expectedPaths, code);
  for (const entry of entries) {
    validateRepositoryFile(
      entry.path,
      entry.byteLength,
      entry.sha256,
      4 * 1024 * 1024,
      code
    );
  }
  invariant(closureSha256(entries, code) === expectedDigest, code);
}

function validateNodeRuntime(binding, code) {
  invariant(
    typeof binding.nodeVersion === "string" && binding.nodeVersion === process.version &&
      Number.isSafeInteger(binding.nodeExecutableByteLength) &&
      binding.nodeExecutableByteLength > 0,
    code
  );
  requireDigest(binding.nodeExecutableSha256, code);
  const executable = directRegularPath(process.execPath, 128 * 1024 * 1024, code);
  invariant(
    executable.bytes.length === binding.nodeExecutableByteLength &&
      sha256(executable.bytes) === binding.nodeExecutableSha256,
    code
  );
}

function validateExecutionProfile(profile, profileBytes) {
  const code = "template2-verifier-execution-profile-invalid";
  exactKeys(profile, [
    "schema", "profileId", "status", "registeredAtUtc",
    "registrationParentCommit", "source", "artifact", "corpus", "oracle",
    "candidate", "execution", "acceptance", "claimBoundary"
  ], code);
  invariant(
    profile.schema === EXECUTION_PROFILE_SCHEMA &&
      profile.profileId === EXECUTION_PROFILE_ID &&
      profile.status === "registered-before-comparative-output" &&
      profile.registeredAtUtc === REGISTERED_AT_UTC &&
      profile.registrationParentCommit === REGISTRATION_PARENT_COMMIT,
    code
  );

  exactKeys(profile.source, [
    "modelId", "revision", "sourceLockPath", "sourceLockByteLength",
    "sourceLockSha256", "tokenizerConfigSha256", "sourceTemplateByteLength",
    "sourceTemplateSha256", "modelConfigSha256"
  ], code);
  exactValue(profile.source, {
    modelId: "Qwen/Qwen3-0.6B",
    revision: "c1899de289a04d12100db370d81485cdf75e47ca",
    sourceLockPath: "contracts/vnext/qwen3-0.6b-template2-source-lock.v1.json",
    sourceLockByteLength: 1580,
    sourceLockSha256:
      "22070f5f605a71580a928291e19fe06d7eb961531732c15f10735c2d677df660",
    tokenizerConfigSha256:
      "d5d09f07b48c3086c508b30d1c9114bd1189145b74e982a265350c923acd8101",
    sourceTemplateByteLength: 4168,
    sourceTemplateSha256:
      "a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8",
    modelConfigSha256:
      "660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd"
  }, code);

  exactKeys(profile.artifact, [
    "formatProfileId", "formatProfileSha256", "byteLength", "sha256",
    "tokenizerArtifactSha256"
  ], code);
  exactValue(profile.artifact, {
    formatProfileId: "org.minimodel.template2/2.0",
    formatProfileSha256:
      "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa",
    byteLength: 1403,
    sha256: "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8",
    tokenizerArtifactSha256:
      "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b"
  }, code);

  exactKeys(profile.corpus, [
    "path", "schema", "corpusId", "generatorPath", "generatorSha256",
    "byteLength", "sha256", "caseCount", "categoryCounts"
  ], code);
  invariant(
    profile.corpus.path === "contracts/vnext/qwen-template2-parity-cases.v1.json" &&
      profile.corpus.schema === "tinyrustlm.qwen3_template2_parity_cases.v1" &&
      profile.corpus.corpusId === "qwen3-0.6b-template2-parity-1024-v1" &&
      profile.corpus.generatorPath ===
        "tinyrustlm/tools/qwen-template2-parity-corpus.js" &&
      Number.isSafeInteger(profile.corpus.byteLength) && profile.corpus.byteLength > 0 &&
      profile.corpus.caseCount === 1024,
    code
  );
  requireDigest(profile.corpus.generatorSha256, code);
  requireDigest(profile.corpus.sha256, code);
  exactValue(profile.corpus.categoryCounts, EXPECTED_CATEGORY_COUNTS, code);

  exactKeys(profile.oracle, [
    "implementation", "pythonVersion", "jinjaVersion", "markupSafeVersion",
    "scriptPath", "scriptSha256", "environmentLockPath",
    "environmentLockByteLength", "environmentLockSha256", "launcherSha256",
    "baseInterpreterSha256", "sourceClosureSha256", "networkAllowed",
    "childProcessAllowed"
  ], code);
  invariant(
    profile.oracle.implementation === "jinja2-immutable-sandbox" &&
      profile.oracle.pythonVersion === "3.12.10" &&
      profile.oracle.jinjaVersion === "3.1.6" &&
      profile.oracle.markupSafeVersion === "3.0.3" &&
      profile.oracle.scriptPath ===
        "tinyrustlm/tools/qwen-template2-source-oracle.py" &&
      profile.oracle.environmentLockPath ===
        "contracts/vnext/template2-source-oracle-environment-lock.v1.json" &&
      Number.isSafeInteger(profile.oracle.environmentLockByteLength) &&
      profile.oracle.environmentLockByteLength > 0 &&
      profile.oracle.networkAllowed === false &&
      profile.oracle.childProcessAllowed === false,
    code
  );
  for (const digest of [
    profile.oracle.scriptSha256,
    profile.oracle.environmentLockSha256,
    profile.oracle.launcherSha256,
    profile.oracle.baseInterpreterSha256,
    profile.oracle.sourceClosureSha256
  ]) requireDigest(digest, code);

  exactKeys(profile.candidate, [
    "implementation", "version", "runnerPath", "runnerSha256",
    "sourceClosureSha256", "sourceClosure", "executableBasename",
    "executableByteLength", "executableSha256"
  ], code);
  invariant(
    profile.candidate.implementation === "tinyrustlm-template2" &&
      profile.candidate.version === "0.1.8" &&
      profile.candidate.runnerPath ===
        "rust/crates/tinyrustlm-template2/examples/qwen_template2_parity.rs" &&
      profile.candidate.executableBasename === "qwen_template2_parity.exe" &&
      Number.isSafeInteger(profile.candidate.executableByteLength) &&
      profile.candidate.executableByteLength > 0,
    code
  );
  for (const digest of [
    profile.candidate.runnerSha256,
    profile.candidate.sourceClosureSha256,
    profile.candidate.executableSha256
  ]) requireDigest(digest, code);

  exactKeys(profile.execution, [
    "tools", "addGenerationPrompt", "enableThinking", "requiredOracleRuns",
    "requiredCandidateRuns", "maximumMessages", "maximumContentBytesPerMessage",
    "maximumTotalContentBytesPerCase", "maximumRenderedBytesPerCase",
    "maximumResultBytes", "comparison", "bestOfN", "repair", "outputLocation"
  ], code);
  exactValue(profile.execution, {
    tools: null,
    addGenerationPrompt: true,
    enableThinking: false,
    requiredOracleRuns: 2,
    requiredCandidateRuns: 2,
    maximumMessages: 16,
    maximumContentBytesPerMessage: 32768,
    maximumTotalContentBytesPerCase: 65536,
    maximumRenderedBytesPerCase: 131072,
    maximumResultBytes: MAXIMUM_RESULT_BYTES,
    comparison: "exact-rendered-utf8-bytes-and-case-order",
    bestOfN: false,
    repair: false,
    outputLocation: "private-external-create-only"
  }, code);

  exactKeys(profile.acceptance, [
    "corpusCommittedBeforeObservation", "sourceLockRevalidated",
    "sourceRehashedAfterObservation", "environmentRehashedAfterObservation",
    "candidateExecutableRehashedAfterObservation", "artifactRecreatedAfterObservation",
    "exactCaseOrderRequired", "exactRenderedBytesRequired",
    "repeatedOracleBytesRequired", "repeatedCandidateBytesRequired",
    "everyCaseRequired", "mismatchIsFatal", "rawOutputsPreserved",
    "networkRequestMaximum", "childProcessMaximum"
  ], code);
  exactValue(profile.acceptance, {
    corpusCommittedBeforeObservation: true,
    sourceLockRevalidated: true,
    sourceRehashedAfterObservation: true,
    environmentRehashedAfterObservation: true,
    candidateExecutableRehashedAfterObservation: true,
    artifactRecreatedAfterObservation: true,
    exactCaseOrderRequired: true,
    exactRenderedBytesRequired: true,
    repeatedOracleBytesRequired: true,
    repeatedCandidateBytesRequired: true,
    everyCaseRequired: true,
    mismatchIsFatal: true,
    rawOutputsPreserved: true,
    networkRequestMaximum: 0,
    childProcessMaximum: 0
  }, code);

  exactKeys(profile.claimBoundary, [
    "templateSourceParityMayBeClaimedAfterPass", "browserWasmMayBeClaimed",
    "modelRuntimeMayBeClaimed", "modelQualityMayBeClaimed", "releaseMayBeClaimed",
    "campaignCreditMayBeClaimed", "requiredNextGate"
  ], code);
  exactValue(profile.claimBoundary, {
    templateSourceParityMayBeClaimedAfterPass: true,
    browserWasmMayBeClaimed: false,
    modelRuntimeMayBeClaimed: false,
    modelQualityMayBeClaimed: false,
    releaseMayBeClaimed: false,
    campaignCreditMayBeClaimed: false,
    requiredNextGate:
      "deterministic-sampling-profile-and-template2-wasm-composition-conformance"
  }, code);

  validateRepositoryFile(
    profile.source.sourceLockPath,
    profile.source.sourceLockByteLength,
    profile.source.sourceLockSha256,
    MAXIMUM_PROFILE_BYTES,
    code
  );
  validateRepositoryFile(
    profile.corpus.path,
    profile.corpus.byteLength,
    profile.corpus.sha256,
    MAXIMUM_RESULT_BYTES,
    code
  );
  const generator = directRegularPath(
    path.join(repositoryRoot, ...profile.corpus.generatorPath.split("/")),
    1024 * 1024,
    code
  );
  invariant(sha256(generator.bytes) === profile.corpus.generatorSha256, code);
  const oracleScript = directRegularPath(
    path.join(repositoryRoot, ...profile.oracle.scriptPath.split("/")),
    1024 * 1024,
    code
  );
  invariant(sha256(oracleScript.bytes) === profile.oracle.scriptSha256, code);
  validateRepositoryFile(
    profile.oracle.environmentLockPath,
    profile.oracle.environmentLockByteLength,
    profile.oracle.environmentLockSha256,
    MAXIMUM_PROFILE_BYTES,
    code
  );
  const candidatePaths = [
    "Cargo.lock",
    "Cargo.toml",
    "contracts/vnext/template2-format-profile.v1.json",
    "rust/crates/tinyrustlm-template2/Cargo.toml",
    "rust/crates/tinyrustlm-template2/examples/qwen_template2_parity.rs",
    "rust/crates/tinyrustlm-template2/src/format.rs",
    "rust/crates/tinyrustlm-template2/src/lib.rs",
    "rust/crates/tinyrustlm-template2/src/runtime.rs"
  ];
  validateSourceClosure(
    profile.candidate.sourceClosure,
    profile.candidate.sourceClosureSha256,
    candidatePaths,
    code
  );
  const runnerEntry = profile.candidate.sourceClosure.find(
    (entry) => entry.path === profile.candidate.runnerPath
  );
  invariant(runnerEntry?.sha256 === profile.candidate.runnerSha256, code);
  invariant(Buffer.isBuffer(profileBytes) && profileBytes.length > 0, code);
  return profile;
}

function validateVerificationProfile(profile, executionBytes) {
  const code = "template2-verifier-profile-invalid";
  exactKeys(profile, [
    "schema", "profileId", "status", "registeredAtUtc",
    "registrationParentCommit", "executionPreregistration", "runSet",
    "observationRunner", "verifier", "execution", "receipt", "claimBoundary"
  ], code);
  invariant(
    profile.schema === VERIFICATION_PROFILE_SCHEMA &&
      profile.profileId === VERIFICATION_PROFILE_ID &&
      profile.status === "registered-before-comparative-output" &&
      profile.registeredAtUtc === REGISTERED_AT_UTC &&
      profile.registrationParentCommit === REGISTRATION_PARENT_COMMIT,
    code
  );
  exactKeys(profile.executionPreregistration, [
    "path", "schema", "profileId", "byteLength", "sha256"
  ], code);
  exactValue(profile.executionPreregistration, {
    path: "contracts/vnext/qwen-template2-parity-preregistration.v1.json",
    schema: EXECUTION_PROFILE_SCHEMA,
    profileId: EXECUTION_PROFILE_ID,
    byteLength: executionBytes.length,
    sha256: sha256(executionBytes)
  }, code);

  exactKeys(profile.runSet, [
    "attemptId", "outputDirectoryName", "oracleRunFiles", "candidateRunFiles",
    "receiptFile", "generatedAfterRegistrationRequired", "priorRunReuseAllowed",
    "outputPathsCreateOnly", "requiredVerifierRuns", "candidateExecutable"
  ], code);
  exactKeys(profile.runSet.candidateExecutable, [
    "basename", "byteLength", "sha256"
  ], code);
  exactValue(profile.runSet, {
    attemptId: "qwen3-template2-parity-20260822-v1",
    outputDirectoryName: "qwen3-template2-parity-20260822-v1",
    oracleRunFiles: ["oracle-run-1.json", "oracle-run-2.json"],
    candidateRunFiles: ["candidate-run-1.json", "candidate-run-2.json"],
    receiptFile: "parity-verification-receipt.v1.json",
    generatedAfterRegistrationRequired: true,
    priorRunReuseAllowed: false,
    outputPathsCreateOnly: true,
    requiredVerifierRuns: 1,
    candidateExecutable: profile.runSet.candidateExecutable
  }, code);
  invariant(
    profile.runSet.candidateExecutable.basename === "qwen_template2_parity.exe" &&
      Number.isSafeInteger(profile.runSet.candidateExecutable.byteLength) &&
      profile.runSet.candidateExecutable.byteLength > 0,
    code
  );
  requireDigest(profile.runSet.candidateExecutable.sha256, code);

  exactKeys(profile.observationRunner, [
    "implementation", "version", "scriptPath", "scriptByteLength", "scriptSha256",
    "nodeVersion", "nodeExecutableByteLength", "nodeExecutableSha256",
    "executionOrder", "requiredChildProcesses", "retryCount", "rootMustNotExist",
    "terminalFailurePreserved", "networkAllowed"
  ], code);
  exactValue(profile.observationRunner.executionOrder, [
    "source-oracle-1",
    "source-oracle-2",
    "candidate-1",
    "candidate-2",
    "verifier-1"
  ], code);
  invariant(
    profile.observationRunner.implementation ===
      "tinyrustlm-qwen-template2-parity-observation" &&
      profile.observationRunner.version === "1" &&
      profile.observationRunner.scriptPath ===
        "tinyrustlm/tools/qwen-template2-parity-observation.js" &&
      Number.isSafeInteger(profile.observationRunner.scriptByteLength) &&
      profile.observationRunner.scriptByteLength > 0 &&
      profile.observationRunner.requiredChildProcesses === 5 &&
      profile.observationRunner.retryCount === 0 &&
      profile.observationRunner.rootMustNotExist === true &&
      profile.observationRunner.terminalFailurePreserved === true &&
      profile.observationRunner.networkAllowed === false,
    code
  );
  requireDigest(profile.observationRunner.scriptSha256, code);
  validateNodeRuntime(profile.observationRunner, code);
  validateRepositoryFile(
    profile.observationRunner.scriptPath,
    profile.observationRunner.scriptByteLength,
    profile.observationRunner.scriptSha256,
    2 * 1024 * 1024,
    code
  );

  exactKeys(profile.verifier, [
    "implementation", "version", "scriptPath", "scriptByteLength", "scriptSha256",
    "nodeVersion", "nodeExecutableByteLength", "nodeExecutableSha256",
    "sourceClosureSha256", "sourceClosure", "resultSchema", "receiptSchema",
    "comparisonSemantics"
  ], code);
  exactKeys(profile.verifier.comparisonSemantics, [
    "jsonObjectMemberOrder", "jsonArrayOrder", "primitiveTypes"
  ], code);
  invariant(
    profile.verifier.implementation ===
      "tinyrustlm-qwen-template2-parity-verifier" &&
      profile.verifier.version === "1" &&
      profile.verifier.scriptPath ===
        "tinyrustlm/tools/qwen-template2-parity-verifier.js" &&
      Number.isSafeInteger(profile.verifier.scriptByteLength) &&
      profile.verifier.scriptByteLength > 0 &&
      profile.verifier.resultSchema === RESULT_SCHEMA &&
      profile.verifier.receiptSchema === RECEIPT_SCHEMA,
    code
  );
  exactValue(profile.verifier.comparisonSemantics, {
    jsonObjectMemberOrder: "ignored-as-nonsemantic",
    jsonArrayOrder: "preserved-as-semantic",
    primitiveTypes: "deep-strict"
  }, code);
  requireDigest(profile.verifier.scriptSha256, code);
  requireDigest(profile.verifier.sourceClosureSha256, code);
  validateNodeRuntime(profile.verifier, code);
  const verifierScript = validateRepositoryFile(
    profile.verifier.scriptPath,
    profile.verifier.scriptByteLength,
    profile.verifier.scriptSha256,
    2 * 1024 * 1024,
    code
  );
  invariant(normalizePath(verifierScript.path) === normalizePath(__filename), code);
  validateSourceClosure(
    profile.verifier.sourceClosure,
    profile.verifier.sourceClosureSha256,
    [
      "tinyrustlm/tools/qwen-template2-parity-corpus.js",
      "tinyrustlm/tools/strict-json.js",
      "tinyrustlm/tools/template2-reference.js",
      "tinyrustlm/tools/template2-source-oracle-environment.js"
    ],
    code
  );

  exactKeys(profile.execution, [
    "requiredOracleRuns", "requiredCandidateRuns", "maximumResultBytes",
    "maximumReceiptBytes", "comparison", "sourceRehashAfterObservation",
    "environmentRehashAfterObservation", "candidateExecutableRehashAfterObservation",
    "artifactRecreationAfterObservation", "rawRunByteEqualityRequired",
    "createOnlyReceipt", "mismatchIsFatal", "rawOutputsPreserved",
    "inputBasenameBindingRequired"
  ], code);
  exactValue(profile.execution, {
    requiredOracleRuns: 2,
    requiredCandidateRuns: 2,
    maximumResultBytes: MAXIMUM_RESULT_BYTES,
    maximumReceiptBytes: MAXIMUM_RECEIPT_BYTES,
    comparison: "exact-rendered-utf8-bytes-and-case-order",
    sourceRehashAfterObservation: true,
    environmentRehashAfterObservation: true,
    candidateExecutableRehashAfterObservation: true,
    artifactRecreationAfterObservation: true,
    rawRunByteEqualityRequired: true,
    createOnlyReceipt: true,
    mismatchIsFatal: true,
    rawOutputsPreserved: true,
    inputBasenameBindingRequired: true
  }, code);

  exactKeys(profile.receipt, [
    "maximumMismatchRecords", "includeMessageContent", "includeRenderedText",
    "includeRenderedHex", "includePrivateAbsolutePaths"
  ], code);
  exactValue(profile.receipt, {
    maximumMismatchRecords: 0,
    includeMessageContent: false,
    includeRenderedText: false,
    includeRenderedHex: false,
    includePrivateAbsolutePaths: false
  }, code);
  exactKeys(profile.claimBoundary, [
    "templateSourceParityMayBeClaimedAfterPass", "browserWasmMayBeClaimed",
    "modelRuntimeMayBeClaimed", "modelQualityMayBeClaimed", "releaseMayBeClaimed",
    "campaignCreditMayBeClaimed", "requiredNextGate"
  ], code);
  exactValue(profile.claimBoundary, {
    templateSourceParityMayBeClaimedAfterPass: true,
    browserWasmMayBeClaimed: false,
    modelRuntimeMayBeClaimed: false,
    modelQualityMayBeClaimed: false,
    releaseMayBeClaimed: false,
    campaignCreditMayBeClaimed: false,
    requiredNextGate:
      "deterministic-sampling-profile-and-template2-wasm-composition-conformance"
  }, code);
  return profile;
}

function validateCorpus(executionProfile) {
  const code = "template2-verifier-corpus-invalid";
  const corpusPath = path.join(
    repositoryRoot,
    ...executionProfile.corpus.path.split("/")
  );
  const corpusFile = readStrictJson(
    corpusPath,
    MAXIMUM_RESULT_BYTES,
    code
  );
  const regenerated = renderCorpus();
  invariant(corpusFile.bytes.equals(regenerated), code);
  const corpus = corpusFile.value;
  exactKeys(corpus, [
    "schema", "corpusId", "generatorProfileId", "generatorSha256", "seedHex",
    "sourceLockSha256", "template2ProfileSha256", "template2ArtifactSha256",
    "sourceTemplateSha256", "caseCount", "categoryCounts",
    "maximumMessagesPerCase", "maximumContentBytesPerMessage",
    "maximumTotalContentBytesPerCase", "expectedRenderedBytesPresent", "cases"
  ], code);
  invariant(
    corpus.schema === executionProfile.corpus.schema &&
      corpus.corpusId === executionProfile.corpus.corpusId &&
      corpus.generatorProfileId ===
        "tinyrustlm.qwen3-template2-parity-corpus/1" &&
      corpus.generatorSha256 === executionProfile.corpus.generatorSha256 &&
      corpus.seedHex ===
        "6115e5fc9bd68e4045529cb12f3088398fa91005572b6c92c9fe17c6627e4e99" &&
      corpus.sourceLockSha256 === executionProfile.source.sourceLockSha256 &&
      corpus.template2ProfileSha256 ===
        executionProfile.artifact.formatProfileSha256 &&
      corpus.template2ArtifactSha256 === executionProfile.artifact.sha256 &&
      corpus.sourceTemplateSha256 === executionProfile.source.sourceTemplateSha256 &&
      corpus.caseCount === 1024 && Array.isArray(corpus.cases) &&
      corpus.cases.length === 1024 && corpus.expectedRenderedBytesPresent === false,
    code
  );
  exactValue(corpus.categoryCounts, categoryCounts, code);
  invariant(
    corpus.maximumMessagesPerCase === executionProfile.execution.maximumMessages &&
      corpus.maximumContentBytesPerMessage ===
        executionProfile.execution.maximumContentBytesPerMessage &&
      corpus.maximumTotalContentBytesPerCase ===
        executionProfile.execution.maximumTotalContentBytesPerCase,
    code
  );
  const ids = new Set();
  for (const entry of corpus.cases) {
    exactKeys(entry, ["caseId", "category", "messages"], code);
    invariant(
      typeof entry.caseId === "string" && entry.caseId.length > 0 &&
        !ids.has(entry.caseId) && Object.hasOwn(categoryCounts, entry.category) &&
        Array.isArray(entry.messages) && entry.messages.length > 0,
      code
    );
    ids.add(entry.caseId);
    for (const message of entry.messages) {
      exactKeys(message, ["role", "content"], code);
      invariant(
        ["system", "user", "assistant"].includes(message.role) &&
          typeof message.content === "string",
        code
      );
    }
  }
  return corpus;
}

function validateArtifact(executionProfile) {
  const code = "template2-verifier-artifact-invalid";
  const bytes = writeTemplate2();
  invariant(
    bytes.length === executionProfile.artifact.byteLength &&
      sha256(bytes) === executionProfile.artifact.sha256,
    code
  );
  const parsed = parseTemplate2(bytes);
  exactValue(parsed.identity, {
    byteLength: executionProfile.artifact.byteLength,
    sha256: executionProfile.artifact.sha256
  }, code);
  return Object.freeze({
    byteLength: bytes.length,
    sha256: sha256(bytes)
  });
}

function validateEnvironment(environmentRoot, executionProfile) {
  const code = "template2-verifier-environment-invalid";
  const resolvedRoot = directDirectory(environmentRoot, code);
  const lockPath = path.join(
    repositoryRoot,
    ...executionProfile.oracle.environmentLockPath.split("/")
  );
  const lock = directRegularPath(lockPath, MAXIMUM_PROFILE_BYTES, code);
  let regenerated;
  try {
    regenerated = renderEnvironmentLock(resolvedRoot);
  } catch {
    fail(code);
  }
  invariant(
    lock.bytes.equals(regenerated) &&
      lock.bytes.length === executionProfile.oracle.environmentLockByteLength &&
      sha256(lock.bytes) === executionProfile.oracle.environmentLockSha256,
    code
  );
  return Object.freeze({
    environmentLockByteLength: lock.bytes.length,
    environmentLockSha256: sha256(lock.bytes),
    sourceClosureSha256: executionProfile.oracle.sourceClosureSha256
  });
}

function validateSource(sourceDirectory, executionProfile) {
  const code = "template2-verifier-source-invalid";
  const resolvedSource = directDirectory(sourceDirectory, code);
  invariant(path.basename(resolvedSource) === executionProfile.source.revision, code);
  const lockPath = path.join(
    repositoryRoot,
    ...executionProfile.source.sourceLockPath.split("/")
  );
  const lockFile = readStrictJson(lockPath, MAXIMUM_PROFILE_BYTES, code);
  const lock = lockFile.value;
  exactKeys(lock, [
    "schema", "modelId", "revision", "sourceKind", "parentTokenizerSourceLock",
    "files", "chatTemplate", "supportedExecution", "unsupportedExecution",
    "runtimeSourceTemplateExecution"
  ], code);
  invariant(
    lock.modelId === executionProfile.source.modelId &&
      lock.revision === executionProfile.source.revision &&
      lock.sourceKind === "upstream-checkpoint" &&
      lock.runtimeSourceTemplateExecution === false,
    code
  );
  exactKeys(lock.files, ["config", "tokenizerConfig"], code);
  const observed = {};
  for (const [key, expectedName] of [
    ["config", "config.json"],
    ["tokenizerConfig", "tokenizer_config.json"]
  ]) {
    const identity = exactKeys(lock.files[key], ["path", "byteLength", "sha256"], code);
    invariant(identity.path === expectedName, code);
    const file = directRegularPath(
      path.join(resolvedSource, expectedName),
      MAXIMUM_PROFILE_BYTES,
      code
    );
    invariant(
      file.bytes.length === identity.byteLength && sha256(file.bytes) === identity.sha256,
      code
    );
    observed[key] = Object.freeze({
      byteLength: file.bytes.length,
      sha256: sha256(file.bytes)
    });
  }
  invariant(
    observed.config.sha256 === executionProfile.source.modelConfigSha256 &&
      observed.tokenizerConfig.sha256 ===
        executionProfile.source.tokenizerConfigSha256,
    code
  );
  const tokenizerConfig = readStrictJson(
    path.join(resolvedSource, "tokenizer_config.json"),
    MAXIMUM_PROFILE_BYTES,
    code
  ).value;
  invariant(typeof tokenizerConfig.chat_template === "string", code);
  const templateBytes = Buffer.from(tokenizerConfig.chat_template, "utf8");
  invariant(
    templateBytes.length === executionProfile.source.sourceTemplateByteLength &&
      sha256(templateBytes) === executionProfile.source.sourceTemplateSha256,
    code
  );
  return Object.freeze({
    sourceLockByteLength: lockFile.bytes.length,
    sourceLockSha256: sha256(lockFile.bytes),
    modelConfig: observed.config,
    tokenizerConfig: observed.tokenizerConfig,
    sourceTemplateByteLength: templateBytes.length,
    sourceTemplateSha256: sha256(templateBytes)
  });
}

function validateCandidateExecutable(candidatePath, executionProfile, verificationProfile) {
  const code = "template2-verifier-candidate-executable-invalid";
  const file = directRegularPath(candidatePath, 64 * 1024 * 1024, code);
  const identity = Object.freeze({
    basename: path.basename(file.path),
    byteLength: file.bytes.length,
    sha256: sha256(file.bytes)
  });
  exactValue(identity, {
    basename: executionProfile.candidate.executableBasename,
    byteLength: executionProfile.candidate.executableByteLength,
    sha256: executionProfile.candidate.executableSha256
  }, code);
  exactValue(identity, verificationProfile.runSet.candidateExecutable, code);
  return identity;
}

function expectedImplementation(kind, executionProfile) {
  if (kind === "source-oracle") {
    return {
      kind,
      name: "jinja2-immutable-sandbox",
      version: "3.1.6",
      executableSha256: executionProfile.oracle.launcherSha256,
      sourceIdentitySha256: executionProfile.oracle.sourceClosureSha256
    };
  }
  return {
    kind: "candidate",
    name: "tinyrustlm-template2",
    version: "0.1.8",
    executableSha256: executionProfile.candidate.executableSha256,
    sourceIdentitySha256: executionProfile.candidate.sourceClosureSha256
  };
}

function validateResultDocument(
  document,
  kind,
  executionProfile,
  executionProfileSha256,
  corpus
) {
  const code = "template2-verifier-result-invalid";
  exactKeys(document, [
    "schema", "implementation", "preregistration", "source", "artifact", "corpus",
    "summary", "results"
  ], code);
  invariant(document.schema === RESULT_SCHEMA, code);
  exactKeys(document.implementation, [
    "kind", "name", "version", "executableSha256", "sourceIdentitySha256"
  ], code);
  exactValue(document.implementation, expectedImplementation(kind, executionProfile), code);
  exactKeys(document.preregistration, ["profileId", "profileSha256"], code);
  exactValue(document.preregistration, {
    profileId: executionProfile.profileId,
    profileSha256: executionProfileSha256
  }, code);
  exactKeys(document.source, [
    "modelId", "revision", "sourceTemplateSha256"
  ], code);
  exactValue(document.source, {
    modelId: executionProfile.source.modelId,
    revision: executionProfile.source.revision,
    sourceTemplateSha256: executionProfile.source.sourceTemplateSha256
  }, code);
  exactKeys(document.artifact, [
    "formatProfileId", "formatProfileSha256", "byteLength", "sha256",
    "tokenizerArtifactSha256"
  ], code);
  exactValue(document.artifact, executionProfile.artifact, code);
  exactKeys(document.corpus, ["corpusId", "sha256", "caseCount"], code);
  exactValue(document.corpus, {
    corpusId: executionProfile.corpus.corpusId,
    sha256: executionProfile.corpus.sha256,
    caseCount: executionProfile.corpus.caseCount
  }, code);
  exactKeys(document.summary, [
    "caseCount", "totalRenderedBytes", "maximumRenderedBytes"
  ], code);
  invariant(
    Array.isArray(document.results) && document.results.length === corpus.cases.length &&
      document.summary.caseCount === corpus.cases.length,
    code
  );
  let totalRenderedBytes = 0;
  let maximumRenderedBytes = 0;
  for (let index = 0; index < document.results.length; index += 1) {
    const result = document.results[index];
    exactKeys(result, [
      "caseId", "renderedByteLength", "renderedSha256", "renderedUtf8Hex"
    ], code);
    invariant(result.caseId === corpus.cases[index].caseId, code);
    invariant(
      Number.isSafeInteger(result.renderedByteLength) &&
        result.renderedByteLength >= 0 &&
        result.renderedByteLength <=
          executionProfile.execution.maximumRenderedBytesPerCase &&
        typeof result.renderedUtf8Hex === "string" &&
        HEX_PATTERN.test(result.renderedUtf8Hex) &&
        result.renderedUtf8Hex.length === result.renderedByteLength * 2,
      code
    );
    requireDigest(result.renderedSha256, code);
    const renderedBytes = Buffer.from(result.renderedUtf8Hex, "hex");
    invariant(sha256(renderedBytes) === result.renderedSha256, code);
    totalRenderedBytes += result.renderedByteLength;
    invariant(Number.isSafeInteger(totalRenderedBytes), code);
    maximumRenderedBytes = Math.max(maximumRenderedBytes, result.renderedByteLength);
  }
  exactValue(document.summary, {
    caseCount: corpus.cases.length,
    totalRenderedBytes,
    maximumRenderedBytes
  }, code);
  return document;
}

function compareResultDocuments(oracle, candidate) {
  const code = "template2-verifier-parity-mismatch";
  exactValue(candidate.source, oracle.source, code);
  exactValue(candidate.artifact, oracle.artifact, code);
  exactValue(candidate.corpus, oracle.corpus, code);
  exactValue(candidate.summary, oracle.summary, code);
  exactValue(candidate.results, oracle.results, code);
  return Object.freeze({
    caseCount: oracle.summary.caseCount,
    totalRenderedBytes: oracle.summary.totalRenderedBytes,
    maximumRenderedBytes: oracle.summary.maximumRenderedBytes,
    mismatchCount: 0,
    exactCaseOrder: true,
    exactRenderedBytes: true,
    repeatedOracleBytes: true,
    repeatedCandidateBytes: true
  });
}

function readRunSet(
  evidenceDirectory,
  executionProfile,
  verificationProfile,
  corpus,
  executionProfileSha256
) {
  const code = "template2-verifier-run-set-invalid";
  const directory = directDirectory(evidenceDirectory, code);
  invariant(path.basename(directory) === verificationProfile.runSet.outputDirectoryName, code);
  const expectedNames = [
    ...verificationProfile.runSet.oracleRunFiles,
    ...verificationProfile.runSet.candidateRunFiles
  ].sort();
  let actualNames;
  try {
    actualNames = fs.readdirSync(directory).sort();
  } catch {
    fail(code);
  }
  exactValue(actualNames, expectedNames, code);
  const registrationTime = Date.parse(verificationProfile.registeredAtUtc);
  const readRuns = (names, kind) => names.map((name, index) => {
    invariant(path.basename(name) === name && name.endsWith(".json"), code);
    const runPath = path.join(directory, name);
    const file = readStrictJson(runPath, MAXIMUM_RESULT_BYTES, code);
    invariant(
      Number.isFinite(registrationTime) &&
        file.stat.birthtimeMs >= registrationTime &&
        file.stat.mtimeMs >= registrationTime,
      code
    );
    validateResultDocument(
      file.value,
      kind,
      executionProfile,
      executionProfileSha256,
      corpus
    );
    return Object.freeze({
      role: kind,
      ordinal: index + 1,
      basename: name,
      byteLength: file.bytes.length,
      sha256: sha256(file.bytes),
      bytes: file.bytes,
      value: file.value
    });
  });
  const oracleRuns = readRuns(verificationProfile.runSet.oracleRunFiles, "source-oracle");
  const candidateRuns = readRuns(
    verificationProfile.runSet.candidateRunFiles,
    "candidate"
  );
  invariant(oracleRuns[0].bytes.equals(oracleRuns[1].bytes), code);
  invariant(candidateRuns[0].bytes.equals(candidateRuns[1].bytes), code);
  const comparison = compareResultDocuments(oracleRuns[0].value, candidateRuns[0].value);
  return Object.freeze({ directory, oracleRuns, candidateRuns, comparison });
}

function publicRunIdentity(run) {
  return Object.freeze({
    role: run.role,
    ordinal: run.ordinal,
    basename: run.basename,
    byteLength: run.byteLength,
    sha256: run.sha256
  });
}

function writeCreateOnly(filePath, bytes, maximumBytes) {
  const code = "template2-verifier-receipt-create-failed";
  invariant(
    path.isAbsolute(filePath) && path.extname(filePath) === ".json" &&
      Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumBytes,
    code
  );
  directDirectory(path.dirname(filePath), code);
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "wx", 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
  } catch {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // The original bounded failure remains authoritative.
      }
    }
    fail(code);
  }
}

function verify(arguments_) {
  const code = "template2-verifier-arguments-invalid";
  invariant(Array.isArray(arguments_) && arguments_.length === 5, code);
  const [rawVerificationPath, rawEvidenceDirectory, rawSourceDirectory,
    rawEnvironmentRoot, rawCandidateExecutable] = arguments_;
  for (const value of arguments_) invariant(path.isAbsolute(value), code);
  const suppliedVerification = directRegularPath(
    rawVerificationPath,
    MAXIMUM_PROFILE_BYTES,
    code
  );
  invariant(
    normalizePath(suppliedVerification.path) === normalizePath(verificationProfilePath),
    code
  );
  const verificationDocument = readStrictJson(
    suppliedVerification.path,
    MAXIMUM_PROFILE_BYTES,
    "template2-verifier-profile-invalid"
  );
  const executionDocument = readStrictJson(
    executionProfilePath,
    MAXIMUM_PROFILE_BYTES,
    "template2-verifier-execution-profile-invalid"
  );
  const executionProfile = validateExecutionProfile(
    executionDocument.value,
    executionDocument.bytes
  );
  const verificationProfile = validateVerificationProfile(
    verificationDocument.value,
    executionDocument.bytes
  );
  const executionProfileSha256 = sha256(executionDocument.bytes);
  const verificationProfileSha256 = sha256(verificationDocument.bytes);
  const corpus = validateCorpus(executionProfile);
  const sourceBefore = validateSource(rawSourceDirectory, executionProfile);
  const environmentBefore = validateEnvironment(rawEnvironmentRoot, executionProfile);
  const candidateBefore = validateCandidateExecutable(
    rawCandidateExecutable,
    executionProfile,
    verificationProfile
  );
  const artifactBefore = validateArtifact(executionProfile);
  const runSet = readRunSet(
    rawEvidenceDirectory,
    executionProfile,
    verificationProfile,
    corpus,
    executionProfileSha256
  );
  const sourceAfter = validateSource(rawSourceDirectory, executionProfile);
  const environmentAfter = validateEnvironment(rawEnvironmentRoot, executionProfile);
  const candidateAfter = validateCandidateExecutable(
    rawCandidateExecutable,
    executionProfile,
    verificationProfile
  );
  const artifactAfter = validateArtifact(executionProfile);
  exactValue(sourceAfter, sourceBefore, "template2-verifier-source-drift");
  exactValue(environmentAfter, environmentBefore, "template2-verifier-environment-drift");
  exactValue(candidateAfter, candidateBefore, "template2-verifier-candidate-drift");
  exactValue(artifactAfter, artifactBefore, "template2-verifier-artifact-drift");

  validateExecutionProfile(executionDocument.value, executionDocument.bytes);
  validateVerificationProfile(verificationDocument.value, executionDocument.bytes);
  const receipt = {
    schema: RECEIPT_SCHEMA,
    status: "pass",
    verifiedAtUtc: new Date().toISOString(),
    attemptId: verificationProfile.runSet.attemptId,
    executionPreregistration: {
      profileId: executionProfile.profileId,
      byteLength: executionDocument.bytes.length,
      sha256: executionProfileSha256
    },
    verificationPreregistration: {
      profileId: verificationProfile.profileId,
      byteLength: verificationDocument.bytes.length,
      sha256: verificationProfileSha256
    },
    source: {
      modelId: executionProfile.source.modelId,
      revision: executionProfile.source.revision,
      sourceLockSha256: sourceAfter.sourceLockSha256,
      sourceTemplateSha256: sourceAfter.sourceTemplateSha256
    },
    artifact: artifactAfter,
    corpus: {
      corpusId: executionProfile.corpus.corpusId,
      byteLength: executionProfile.corpus.byteLength,
      sha256: executionProfile.corpus.sha256,
      caseCount: executionProfile.corpus.caseCount
    },
    implementations: {
      sourceOracle: {
        name: "jinja2-immutable-sandbox",
        version: executionProfile.oracle.jinjaVersion,
        executableSha256: executionProfile.oracle.launcherSha256,
        sourceClosureSha256: executionProfile.oracle.sourceClosureSha256
      },
      candidate: {
        name: executionProfile.candidate.implementation,
        version: executionProfile.candidate.version,
        executableSha256: candidateAfter.sha256,
        sourceClosureSha256: executionProfile.candidate.sourceClosureSha256
      },
      verifier: {
        name: verificationProfile.verifier.implementation,
        version: verificationProfile.verifier.version,
        nodeVersion: verificationProfile.verifier.nodeVersion,
        nodeExecutableSha256: verificationProfile.verifier.nodeExecutableSha256,
        scriptSha256: verificationProfile.verifier.scriptSha256,
        sourceClosureSha256: verificationProfile.verifier.sourceClosureSha256
      }
    },
    runs: [
      ...runSet.oracleRuns.map(publicRunIdentity),
      ...runSet.candidateRuns.map(publicRunIdentity)
    ],
    comparison: runSet.comparison,
    postObservation: {
      sourceRehashed: true,
      environmentRehashed: true,
      candidateExecutableRehashed: true,
      artifactRecreated: true,
      environmentLockSha256: environmentAfter.environmentLockSha256
    },
    privacy: {
      messageContentIncluded: false,
      renderedTextIncluded: false,
      renderedHexIncluded: false,
      privateAbsolutePathsIncluded: false
    },
    claimBoundary: verificationProfile.claimBoundary
  };
  const receiptBytes = canonicalJsonBytes(receipt);
  invariant(receiptBytes.length <= MAXIMUM_RECEIPT_BYTES, "template2-verifier-receipt-limit");
  invariant(!FORBIDDEN_PUBLIC_TEXT.test(receiptBytes.toString("utf8")),
    "template2-verifier-receipt-private-data");
  const receiptPath = path.join(runSet.directory, verificationProfile.runSet.receiptFile);
  writeCreateOnly(receiptPath, receiptBytes, verificationProfile.execution.maximumReceiptBytes);
  return Object.freeze({
    schema: RECEIPT_SCHEMA,
    status: "pass",
    caseCount: runSet.comparison.caseCount,
    totalRenderedBytes: runSet.comparison.totalRenderedBytes,
    receiptByteLength: receiptBytes.length,
    receiptSha256: sha256(receiptBytes)
  });
}

function main() {
  const result = verify(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error instanceof Template2VerificationError
      ? error.code
      : "template2-verifier-unexpected-failure";
    process.stderr.write(`Qwen Template2 parity verification failed: ${code}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  Template2VerificationError,
  canonicalJsonBytes,
  compareResultDocuments,
  sha256,
  validateResultDocument,
  validateArtifact,
  validateCandidateExecutable,
  validateCorpus,
  validateEnvironment,
  validateExecutionProfile,
  validateSource,
  validateVerificationProfile,
  verify
});
